/**
 * Database Schema Extension for Chunked Uploads
 * Extends the existing database schema with chunked upload tables
 */

import Database from 'better-sqlite3';

export interface ChunkedUploadSession {
  id: string;
  cooperative_id: string;
  uploaded_by: string | null;
  original_filename: string;
  file_size: number;
  chunk_size: number;
  total_chunks: number;
  file_hash: string | null; // Expected final file hash
  mime_type: string | null;
  content_type: string | null;
  upload_id: string; // Unique identifier for the upload session
  status: 'pending' | 'uploading' | 'assembling' | 'completed' | 'failed' | 'cancelled' | 'expired';
  progress_percentage: number;
  chunks_uploaded: number;
  chunks_failed: number;
  storage_path: string | null; // Path where chunks are stored
  final_file_path: string | null; // Path of the assembled file
  expires_at: string; // ISO date string
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_message: string | null;
  metadata: string; // JSON metadata
  batch_id: string | null; // Optional link to bulk upload batch
  resumable: number; // 1 = can resume, 0 = cannot resume
  max_retries_per_chunk: number;
  concurrent_chunks_allowed: number;
  validation_rules: string | null; // JSON validation rules
  virus_scan_enabled: number;
  auto_cleanup_enabled: number;
}

export interface ChunkedUploadChunk {
  id: string;
  session_id: string;
  chunk_number: number; // 0-based chunk index
  chunk_size: number;
  chunk_hash: string | null; // Hash of the chunk data
  expected_hash: string | null; // Expected hash for validation
  storage_path: string | null;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'cancelled';
  upload_attempts: number;
  upload_started_at: string | null;
  upload_completed_at: string | null;
  upload_duration_ms: number | null;
  upload_speed_bps: number | null; // Bytes per second
  error_message: string | null;
  retry_count: number;
  last_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChunkedUploadEvent {
  id: string;
  session_id: string;
  chunk_id: string | null;
  event_type: 'session_created' | 'session_started' | 'chunk_uploaded' | 'chunk_failed' | 'chunk_retried' | 'session_completed' | 'session_failed' | 'session_cancelled' | 'session_expired' | 'assembly_started' | 'assembly_completed' | 'validation_started' | 'validation_completed';
  event_level: 'info' | 'warning' | 'error' | 'debug';
  event_message: string;
  event_data: string | null; // JSON data
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * Initialize chunked upload tables in the database
 */
export function initializeChunkedUploadTables(db: Database.Database): void {
  // Chunked upload sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunked_upload_sessions (
      id TEXT PRIMARY KEY DEFAULT (uuid()),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      uploaded_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      original_filename TEXT NOT NULL,
      file_size INTEGER NOT NULL CHECK (file_size > 0),
      chunk_size INTEGER NOT NULL DEFAULT 1048576 CHECK (chunk_size > 0), -- Default 1MB chunks
      total_chunks INTEGER NOT NULL CHECK (total_chunks > 0),
      file_hash TEXT, -- Expected final file hash (SHA-256)
      mime_type TEXT,
      content_type TEXT,
      upload_id TEXT NOT NULL UNIQUE, -- Client-provided upload identifier
      status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'uploading', 'assembling', 'completed', 'failed', 'cancelled', 'expired'
      )),
      progress_percentage REAL DEFAULT 0.0 CHECK (progress_percentage >= 0.0 AND progress_percentage <= 100.0),
      chunks_uploaded INTEGER DEFAULT 0 CHECK (chunks_uploaded >= 0),
      chunks_failed INTEGER DEFAULT 0 CHECK (chunks_failed >= 0),
      storage_path TEXT, -- Base directory for chunks
      final_file_path TEXT, -- Final assembled file path
      expires_at TEXT NOT NULL, -- ISO 8601 datetime
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      error_message TEXT,
      metadata TEXT DEFAULT '{}' CHECK (json_valid(metadata)), -- JSON metadata
      batch_id TEXT REFERENCES bulk_upload_batches(id) ON DELETE SET NULL,
      resumable INTEGER DEFAULT 1 CHECK (resumable IN (0, 1)),
      max_retries_per_chunk INTEGER DEFAULT 3 CHECK (max_retries_per_chunk >= 0),
      concurrent_chunks_allowed INTEGER DEFAULT 3 CHECK (concurrent_chunks_allowed > 0),
      validation_rules TEXT CHECK (validation_rules IS NULL OR json_valid(validation_rules)),
      virus_scan_enabled INTEGER DEFAULT 1 CHECK (virus_scan_enabled IN (0, 1)),
      auto_cleanup_enabled INTEGER DEFAULT 1 CHECK (auto_cleanup_enabled IN (0, 1))
    );
  `);

  // Chunked upload chunks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunked_upload_chunks (
      id TEXT PRIMARY KEY DEFAULT (uuid()),
      session_id TEXT NOT NULL REFERENCES chunked_upload_sessions(id) ON DELETE CASCADE,
      chunk_number INTEGER NOT NULL CHECK (chunk_number >= 0),
      chunk_size INTEGER NOT NULL CHECK (chunk_size > 0),
      chunk_hash TEXT, -- Actual hash of uploaded chunk
      expected_hash TEXT, -- Expected hash for integrity verification
      storage_path TEXT, -- File path of the stored chunk
      status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'uploading', 'uploaded', 'failed', 'cancelled'
      )),
      upload_attempts INTEGER DEFAULT 0 CHECK (upload_attempts >= 0),
      upload_started_at TEXT,
      upload_completed_at TEXT,
      upload_duration_ms INTEGER CHECK (upload_duration_ms >= 0),
      upload_speed_bps INTEGER CHECK (upload_speed_bps >= 0), -- Bytes per second
      error_message TEXT,
      retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
      last_retry_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, chunk_number)
    );
  `);

  // Chunked upload events table for logging and monitoring
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunked_upload_events (
      id TEXT PRIMARY KEY DEFAULT (uuid()),
      session_id TEXT NOT NULL REFERENCES chunked_upload_sessions(id) ON DELETE CASCADE,
      chunk_id TEXT REFERENCES chunked_upload_chunks(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (event_type IN (
        'session_created', 'session_started', 'chunk_uploaded', 'chunk_failed', 'chunk_retried',
        'session_completed', 'session_failed', 'session_cancelled', 'session_expired',
        'assembly_started', 'assembly_completed', 'validation_started', 'validation_completed'
      )),
      event_level TEXT DEFAULT 'info' CHECK (event_level IN ('info', 'warning', 'error', 'debug')),
      event_message TEXT NOT NULL,
      event_data TEXT CHECK (event_data IS NULL OR json_valid(event_data)), -- JSON event data
      user_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create indexes for optimal performance
  db.exec(`
    -- Chunked upload sessions indexes
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_sessions_cooperative ON chunked_upload_sessions(cooperative_id);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_sessions_uploaded_by ON chunked_upload_sessions(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_sessions_upload_id ON chunked_upload_sessions(upload_id);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_sessions_status ON chunked_upload_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_sessions_expires_at ON chunked_upload_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_sessions_created_at ON chunked_upload_sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_sessions_batch ON chunked_upload_sessions(batch_id);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_sessions_active ON chunked_upload_sessions(cooperative_id, status) 
      WHERE status IN ('pending', 'uploading', 'assembling');

    -- Chunked upload chunks indexes
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_chunks_session ON chunked_upload_chunks(session_id);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_chunks_session_number ON chunked_upload_chunks(session_id, chunk_number);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_chunks_status ON chunked_upload_chunks(status);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_chunks_pending ON chunked_upload_chunks(session_id, status) 
      WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_chunks_failed ON chunked_upload_chunks(session_id, status, retry_count) 
      WHERE status = 'failed';

    -- Chunked upload events indexes
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_events_session ON chunked_upload_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_events_chunk ON chunked_upload_events(chunk_id);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_events_type ON chunked_upload_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_events_level ON chunked_upload_events(event_level);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_events_created ON chunked_upload_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_chunked_upload_events_session_created ON chunked_upload_events(session_id, created_at);
  `);

  // Create triggers for automatic updated_at timestamps
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trigger_chunked_upload_sessions_updated_at
      AFTER UPDATE ON chunked_upload_sessions
      BEGIN
        UPDATE chunked_upload_sessions SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS trigger_chunked_upload_chunks_updated_at
      AFTER UPDATE ON chunked_upload_chunks
      BEGIN
        UPDATE chunked_upload_chunks SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
  `);

  // Add foreign key pragma
  db.pragma('foreign_keys = ON');
  
  console.log('✅ Chunked upload tables initialized');
}

/**
 * Create RLS (Row Level Security) policies for chunked uploads
 */
export function createChunkedUploadRLSPolicies(db: Database.Database): void {
  // Note: SQLite doesn't have RLS like PostgreSQL, but we can create views
  // that enforce cooperative isolation
  
  db.exec(`
    -- View for cooperative-filtered chunked upload sessions
    CREATE VIEW IF NOT EXISTS v_cooperative_chunked_upload_sessions AS
    SELECT * FROM chunked_upload_sessions 
    WHERE cooperative_id = get_current_cooperative_id();

    -- View for cooperative-filtered chunked upload chunks
    CREATE VIEW IF NOT EXISTS v_cooperative_chunked_upload_chunks AS
    SELECT c.* FROM chunked_upload_chunks c
    JOIN chunked_upload_sessions s ON c.session_id = s.id
    WHERE s.cooperative_id = get_current_cooperative_id();

    -- View for cooperative-filtered chunked upload events
    CREATE VIEW IF NOT EXISTS v_cooperative_chunked_upload_events AS
    SELECT e.* FROM chunked_upload_events e
    JOIN chunked_upload_sessions s ON e.session_id = s.id
    WHERE s.cooperative_id = get_current_cooperative_id();
  `);
  
  console.log('✅ Chunked upload RLS policies created');
}

/**
 * Clean up expired chunked upload sessions
 */
export function createChunkedUploadCleanupFunction(db: Database.Database): void {
  const cleanupExpiredSessions = db.prepare(`
    UPDATE chunked_upload_sessions 
    SET status = 'expired', updated_at = datetime('now')
    WHERE status IN ('pending', 'uploading') 
      AND expires_at < datetime('now')
  `);

  const getExpiredSessionsForCleanup = db.prepare(`
    SELECT id, storage_path, final_file_path
    FROM chunked_upload_sessions 
    WHERE status = 'expired' 
      AND auto_cleanup_enabled = 1
      AND updated_at < datetime('now', '-1 hour') -- Wait 1 hour before cleanup
  `);

  const deleteExpiredSession = db.prepare(`
    DELETE FROM chunked_upload_sessions WHERE id = ?
  `);

  // Export cleanup functions
  (global as any).cleanupExpiredChunkedUploads = () => {
    const result = cleanupExpiredSessions.run();
    console.log(`Marked ${result.changes} chunked upload sessions as expired`);
    
    // Get sessions that can be cleaned up
    const sessionsToCleanup = getExpiredSessionsForCleanup.all() as any[];
    
    for (const session of sessionsToCleanup) {
      try {
        // Here you would add file system cleanup logic
        // For now, just delete the database record
        deleteExpiredSession.run(session.id);
        console.log(`Cleaned up expired session: ${session.id}`);
      } catch (error) {
        console.error(`Failed to cleanup session ${session.id}:`, error);
      }
    }
    
    return {
      expired: result.changes,
      cleaned: sessionsToCleanup.length
    };
  };
  
  console.log('✅ Chunked upload cleanup functions created');
}

// Export table names for reference
export const CHUNKED_UPLOAD_TABLES = [
  'chunked_upload_sessions',
  'chunked_upload_chunks', 
  'chunked_upload_events'
] as const;

// Export view names for reference
export const CHUNKED_UPLOAD_VIEWS = [
  'v_cooperative_chunked_upload_sessions',
  'v_cooperative_chunked_upload_chunks',
  'v_cooperative_chunked_upload_events'
] as const;