/**
 * Chunked Upload Manager
 * Handles large file uploads with chunking, resumability, and integrity verification
 */

import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SwedishMessages, MessageFormatter } from './messages';
import type { 
  ChunkedUploadSession, 
  ChunkedUploadChunk, 
  ChunkedUploadEvent 
} from './chunked-upload-schema';

export interface ChunkedUploadConfig {
  database: Database.Database;
  defaultChunkSize?: number; // Default 2MB
  maxFileSize?: number; // Default 500MB
  maxConcurrentChunks?: number; // Default 3 concurrent chunks
  sessionExpirationHours?: number; // Default 24 hours
  storageBasePath?: string;
  tempStoragePath?: string;
  enableIntegrityVerification?: boolean;
  enableVirusScanning?: boolean;
  autoCleanupEnabled?: boolean;
}

export interface CreateSessionOptions {
  cooperativeId: string;
  uploadedBy?: string;
  filename: string;
  fileSize: number;
  chunkSize?: number;
  fileHash?: string; // Expected final file hash
  mimeType?: string;
  contentType?: string;
  metadata?: Record<string, any>;
  batchId?: string; // Optional link to bulk upload batch
  maxRetriesPerChunk?: number;
  concurrentChunksAllowed?: number;
  validationRules?: Record<string, any>;
  virusScanEnabled?: boolean;
}

export interface UploadChunkOptions {
  sessionId: string;
  chunkNumber: number;
  chunkData: Buffer;
  chunkHash?: string;
  isLastChunk?: boolean;
}

export interface ChunkedUploadProgress {
  sessionId: string;
  uploadId: string;
  filename: string;
  status: string;
  progressPercentage: number;
  chunksUploaded: number;
  totalChunks: number;
  fileSize: number;
  uploadedSize: number;
  remainingSize: number;
  estimatedCompletionTime?: string;
  currentChunks: Array<{
    chunkNumber: number;
    status: string;
    uploadProgress?: number;
  }>;
  errors: string[];
  warnings: string[];
  uploadSpeed?: number; // Bytes per second
}

export class ChunkedUploadManager {
  private db: Database.Database;
  private config: Required<ChunkedUploadConfig>;
  
  // Prepared statements for performance
  private createSessionStmt: Database.Statement;
  private getSessionStmt: Database.Statement;
  private updateSessionStmt: Database.Statement;
  private createChunkStmt: Database.Statement;
  private getChunkStmt: Database.Statement;
  private updateChunkStmt: Database.Statement;
  private getSessionChunksStmt: Database.Statement;
  private logEventStmt: Database.Statement;

  constructor(config: ChunkedUploadConfig) {
    this.db = config.database;
    this.config = {
      database: config.database,
      defaultChunkSize: config.defaultChunkSize || 2 * 1024 * 1024, // 2MB
      maxFileSize: config.maxFileSize || 500 * 1024 * 1024, // 500MB
      maxConcurrentChunks: config.maxConcurrentChunks || 3,
      sessionExpirationHours: config.sessionExpirationHours || 24,
      storageBasePath: config.storageBasePath || '/uploads/chunked',
      tempStoragePath: config.tempStoragePath || '/tmp/chunked-uploads',
      enableIntegrityVerification: config.enableIntegrityVerification !== false,
      enableVirusScanning: config.enableVirusScanning !== false,
      autoCleanupEnabled: config.autoCleanupEnabled !== false,
    };

    this.initializePreparedStatements();
    this.ensureStorageDirectories();
  }

  /**
   * Initialize prepared statements for better performance
   */
  private initializePreparedStatements(): void {
    this.createSessionStmt = this.db.prepare(`
      INSERT INTO chunked_upload_sessions (
        cooperative_id, uploaded_by, original_filename, file_size, chunk_size, 
        total_chunks, file_hash, mime_type, content_type, upload_id, storage_path,
        expires_at, metadata, batch_id, max_retries_per_chunk, concurrent_chunks_allowed,
        validation_rules, virus_scan_enabled, auto_cleanup_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id, upload_id
    `);

    this.getSessionStmt = this.db.prepare(`
      SELECT * FROM chunked_upload_sessions WHERE id = ?
    `);

    this.updateSessionStmt = this.db.prepare(`
      UPDATE chunked_upload_sessions 
      SET status = ?, progress_percentage = ?, chunks_uploaded = ?, chunks_failed = ?,
          final_file_path = ?, completed_at = ?, error_message = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    this.createChunkStmt = this.db.prepare(`
      INSERT INTO chunked_upload_chunks (
        session_id, chunk_number, chunk_size, expected_hash, storage_path
      ) VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `);

    this.getChunkStmt = this.db.prepare(`
      SELECT * FROM chunked_upload_chunks 
      WHERE session_id = ? AND chunk_number = ?
    `);

    this.updateChunkStmt = this.db.prepare(`
      UPDATE chunked_upload_chunks
      SET status = ?, chunk_hash = ?, upload_started_at = ?, upload_completed_at = ?,
          upload_duration_ms = ?, upload_speed_bps = ?, error_message = ?, retry_count = ?,
          last_retry_at = ?, upload_attempts = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    this.getSessionChunksStmt = this.db.prepare(`
      SELECT * FROM chunked_upload_chunks 
      WHERE session_id = ? 
      ORDER BY chunk_number
    `);

    this.logEventStmt = this.db.prepare(`
      INSERT INTO chunked_upload_events (
        session_id, chunk_id, event_type, event_level, event_message, 
        event_data, user_id, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  /**
   * Ensure storage directories exist
   */
  private async ensureStorageDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.config.storageBasePath, { recursive: true });
      await fs.mkdir(this.config.tempStoragePath, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directories:', error);
    }
  }

  /**
   * Create a new chunked upload session
   */
  async createSession(options: CreateSessionOptions): Promise<{
    sessionId: string;
    uploadId: string;
    chunkSize: number;
    totalChunks: number;
    expiresAt: string;
  }> {
    // Validate file size
    if (options.fileSize > this.config.maxFileSize) {
      throw new Error(
        SwedishMessages.errors.FILE_TOO_LARGE + 
        ` (Max: ${MessageFormatter.formatFileSize(this.config.maxFileSize)})`
      );
    }

    if (options.fileSize <= 0) {
      throw new Error(SwedishMessages.errors.FILE_EMPTY);
    }

    // Calculate chunk parameters
    const chunkSize = options.chunkSize || this.config.defaultChunkSize;
    const totalChunks = Math.ceil(options.fileSize / chunkSize);
    const uploadId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(
      Date.now() + (this.config.sessionExpirationHours * 60 * 60 * 1000)
    ).toISOString();

    // Create storage path
    const storagePath = path.join(
      this.config.tempStoragePath,
      options.cooperativeId,
      uploadId
    );

    await fs.mkdir(storagePath, { recursive: true });

    // Create session in database
    const session = this.createSessionStmt.get(
      options.cooperativeId,
      options.uploadedBy || null,
      options.filename,
      options.fileSize,
      chunkSize,
      totalChunks,
      options.fileHash || null,
      options.mimeType || null,
      options.contentType || null,
      uploadId,
      storagePath,
      expiresAt,
      JSON.stringify(options.metadata || {}),
      options.batchId || null,
      options.maxRetriesPerChunk || 3,
      options.concurrentChunksAllowed || this.config.maxConcurrentChunks,
      options.validationRules ? JSON.stringify(options.validationRules) : null,
      options.virusScanEnabled !== false ? 1 : 0,
      this.config.autoCleanupEnabled ? 1 : 0
    ) as any;

    // Create chunk records
    for (let i = 0; i < totalChunks; i++) {
      const chunkStoragePath = path.join(storagePath, `chunk_${i.toString().padStart(6, '0')}`);
      this.createChunkStmt.run(
        session.id,
        i,
        i === totalChunks - 1 ? options.fileSize % chunkSize || chunkSize : chunkSize,
        null, // Expected hash will be set when chunk is uploaded
        chunkStoragePath
      );
    }

    // Log session creation
    this.logEvent({
      sessionId: session.id,
      eventType: 'session_created',
      eventLevel: 'info',
      eventMessage: `Chunked upload session created for file: ${options.filename}`,
      eventData: {
        filename: options.filename,
        fileSize: options.fileSize,
        totalChunks,
        chunkSize
      },
      userId: options.uploadedBy
    });

    return {
      sessionId: session.id,
      uploadId: session.upload_id,
      chunkSize,
      totalChunks,
      expiresAt
    };
  }

  /**
   * Upload a single chunk
   */
  async uploadChunk(options: UploadChunkOptions): Promise<{
    chunkId: string;
    chunkHash: string;
    uploadSpeed: number;
    nextChunkNumber?: number;
  }> {
    const startTime = Date.now();

    // Get session and validate
    const session = this.getSessionStmt.get(options.sessionId) as ChunkedUploadSession | undefined;
    if (!session) {
      throw new Error(SwedishMessages.errors.BATCH_NOT_FOUND);
    }

    if (session.status === 'expired') {
      throw new Error(SwedishMessages.errors.BATCH_CANCELLED);
    }

    if (session.status === 'completed') {
      throw new Error(SwedishMessages.errors.BATCH_ALREADY_STARTED);
    }

    // Get chunk record
    const chunk = this.getChunkStmt.get(options.sessionId, options.chunkNumber) as ChunkedUploadChunk | undefined;
    if (!chunk) {
      throw new Error(`Chunk ${options.chunkNumber} not found`);
    }

    if (chunk.status === 'uploaded') {
      // Chunk already uploaded, return existing info
      return {
        chunkId: chunk.id,
        chunkHash: chunk.chunk_hash || '',
        uploadSpeed: chunk.upload_speed_bps || 0,
        nextChunkNumber: this.getNextPendingChunk(options.sessionId, options.chunkNumber)
      };
    }

    try {
      // Update chunk status to uploading
      this.updateChunkStmt.run(
        'uploading',
        null, // chunk_hash
        new Date().toISOString(), // upload_started_at
        null, // upload_completed_at
        null, // upload_duration_ms
        null, // upload_speed_bps
        null, // error_message
        chunk.retry_count, // retry_count
        null, // last_retry_at
        chunk.upload_attempts + 1, // upload_attempts
        chunk.id
      );

      // Calculate chunk hash
      const chunkHash = crypto.createHash('sha256').update(options.chunkData).digest('hex');

      // Verify expected size
      if (options.chunkData.length !== chunk.chunk_size) {
        throw new Error(
          `Chunk size mismatch: expected ${chunk.chunk_size}, got ${options.chunkData.length}`
        );
      }

      // Verify provided hash if given
      if (options.chunkHash && options.chunkHash !== chunkHash) {
        throw new Error(SwedishMessages.errors.UPLOAD_SIZE_MISMATCH);
      }

      // Write chunk to storage
      if (!chunk.storage_path) {
        throw new Error('Chunk storage path not set');
      }

      await fs.writeFile(chunk.storage_path, options.chunkData);

      // Calculate upload metrics
      const uploadDuration = Date.now() - startTime;
      const uploadSpeed = Math.round((options.chunkData.length / uploadDuration) * 1000); // bytes per second

      // Update chunk status to uploaded
      this.updateChunkStmt.run(
        'uploaded',
        chunkHash,
        chunk.upload_started_at || new Date().toISOString(),
        new Date().toISOString(),
        uploadDuration,
        uploadSpeed,
        null, // error_message
        chunk.retry_count,
        null, // last_retry_at
        chunk.upload_attempts + 1,
        chunk.id
      );

      // Update session progress
      await this.updateSessionProgress(options.sessionId);

      // Log chunk upload
      this.logEvent({
        sessionId: options.sessionId,
        chunkId: chunk.id,
        eventType: 'chunk_uploaded',
        eventLevel: 'info',
        eventMessage: `Chunk ${options.chunkNumber} uploaded successfully`,
        eventData: {
          chunkNumber: options.chunkNumber,
          chunkSize: options.chunkData.length,
          chunkHash,
          uploadDuration,
          uploadSpeed
        }
      });

      // Check if all chunks are uploaded
      if (await this.areAllChunksUploaded(options.sessionId)) {
        await this.assembleFile(options.sessionId);
      }

      return {
        chunkId: chunk.id,
        chunkHash,
        uploadSpeed,
        nextChunkNumber: this.getNextPendingChunk(options.sessionId, options.chunkNumber)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update chunk status to failed
      this.updateChunkStmt.run(
        'failed',
        null, // chunk_hash
        chunk.upload_started_at || new Date().toISOString(),
        null, // upload_completed_at
        Date.now() - startTime,
        null, // upload_speed_bps
        errorMessage,
        chunk.retry_count + 1,
        new Date().toISOString(),
        chunk.upload_attempts + 1,
        chunk.id
      );

      // Log chunk failure
      this.logEvent({
        sessionId: options.sessionId,
        chunkId: chunk.id,
        eventType: 'chunk_failed',
        eventLevel: 'error',
        eventMessage: `Chunk ${options.chunkNumber} upload failed: ${errorMessage}`,
        eventData: {
          chunkNumber: options.chunkNumber,
          error: errorMessage,
          retryCount: chunk.retry_count + 1
        }
      });

      throw error;
    }
  }

  /**
   * Retry a failed chunk
   */
  async retryChunk(sessionId: string, chunkNumber: number): Promise<{
    canRetry: boolean;
    retriesLeft: number;
    chunkId: string;
  }> {
    const session = this.getSessionStmt.get(sessionId) as ChunkedUploadSession | undefined;
    if (!session) {
      throw new Error(SwedishMessages.errors.BATCH_NOT_FOUND);
    }

    const chunk = this.getChunkStmt.get(sessionId, chunkNumber) as ChunkedUploadChunk | undefined;
    if (!chunk) {
      throw new Error(`Chunk ${chunkNumber} not found`);
    }

    if (chunk.status !== 'failed') {
      throw new Error(`Chunk ${chunkNumber} is not in failed state`);
    }

    const canRetry = chunk.retry_count < session.max_retries_per_chunk;
    const retriesLeft = Math.max(0, session.max_retries_per_chunk - chunk.retry_count);

    if (canRetry) {
      // Reset chunk to pending for retry
      this.updateChunkStmt.run(
        'pending',
        null, // chunk_hash
        null, // upload_started_at
        null, // upload_completed_at
        null, // upload_duration_ms
        null, // upload_speed_bps
        null, // error_message
        chunk.retry_count, // Keep retry count for tracking
        new Date().toISOString(), // last_retry_at
        chunk.upload_attempts, // Keep attempt count
        chunk.id
      );

      // Log retry
      this.logEvent({
        sessionId,
        chunkId: chunk.id,
        eventType: 'chunk_retried',
        eventLevel: 'info',
        eventMessage: `Chunk ${chunkNumber} prepared for retry (${retriesLeft} retries left)`,
        eventData: {
          chunkNumber,
          retryCount: chunk.retry_count,
          retriesLeft
        }
      });
    }

    return {
      canRetry,
      retriesLeft,
      chunkId: chunk.id
    };
  }

  /**
   * Get upload progress for a session
   */
  getProgress(sessionId: string): ChunkedUploadProgress | null {
    const session = this.getSessionStmt.get(sessionId) as ChunkedUploadSession | undefined;
    if (!session) return null;

    const chunks = this.getSessionChunksStmt.all(sessionId) as ChunkedUploadChunk[];
    
    const uploadedChunks = chunks.filter(c => c.status === 'uploaded');
    const failedChunks = chunks.filter(c => c.status === 'failed');
    const uploadingChunks = chunks.filter(c => c.status === 'uploading');
    
    const uploadedSize = uploadedChunks.reduce((sum, chunk) => sum + chunk.chunk_size, 0);
    const remainingSize = session.file_size - uploadedSize;
    
    // Calculate average upload speed
    const totalUploadTime = uploadedChunks.reduce((sum, chunk) => 
      sum + (chunk.upload_duration_ms || 0), 0
    );
    const avgUploadSpeed = totalUploadTime > 0 
      ? Math.round(uploadedSize / (totalUploadTime / 1000))
      : undefined;

    // Estimate completion time
    let estimatedCompletionTime: string | undefined;
    if (avgUploadSpeed && remainingSize > 0) {
      const estimatedSeconds = remainingSize / avgUploadSpeed;
      estimatedCompletionTime = new Date(Date.now() + (estimatedSeconds * 1000)).toISOString();
    }

    const errors = failedChunks
      .filter(c => c.error_message)
      .map(c => `Chunk ${c.chunk_number}: ${c.error_message}`);

    const warnings: string[] = [];
    const retriedChunks = chunks.filter(c => c.retry_count > 0);
    if (retriedChunks.length > 0) {
      warnings.push(`${retriedChunks.length} chunks required retries`);
    }

    return {
      sessionId,
      uploadId: session.upload_id,
      filename: session.original_filename,
      status: session.status,
      progressPercentage: session.progress_percentage,
      chunksUploaded: uploadedChunks.length,
      totalChunks: session.total_chunks,
      fileSize: session.file_size,
      uploadedSize,
      remainingSize,
      estimatedCompletionTime,
      currentChunks: uploadingChunks.map(c => ({
        chunkNumber: c.chunk_number,
        status: c.status,
        uploadProgress: c.status === 'uploading' ? 50 : 0 // Simplified progress
      })),
      errors,
      warnings,
      uploadSpeed: avgUploadSpeed
    };
  }

  /**
   * Cancel an upload session
   */
  async cancelSession(sessionId: string): Promise<boolean> {
    const session = this.getSessionStmt.get(sessionId) as ChunkedUploadSession | undefined;
    if (!session) return false;

    if (session.status === 'completed') {
      return false; // Cannot cancel completed upload
    }

    // Update session status
    this.updateSessionStmt.run(
      'cancelled', // status
      session.progress_percentage,
      session.chunks_uploaded,
      session.chunks_failed,
      null, // final_file_path
      null, // completed_at
      SwedishMessages.errors.BATCH_CANCELLED,
      sessionId
    );

    // Cancel all pending chunks
    this.db.prepare(`
      UPDATE chunked_upload_chunks 
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE session_id = ? AND status IN ('pending', 'uploading')
    `).run(sessionId);

    // Log cancellation
    this.logEvent({
      sessionId,
      eventType: 'session_cancelled',
      eventLevel: 'info',
      eventMessage: 'Upload session cancelled by user',
      eventData: { reason: 'user_cancelled' }
    });

    // Cleanup storage if auto cleanup is enabled
    if (session.auto_cleanup_enabled && session.storage_path) {
      try {
        await fs.rm(session.storage_path, { recursive: true, force: true });
      } catch (error) {
        console.error(`Failed to cleanup storage for session ${sessionId}:`, error);
      }
    }

    return true;
  }

  /**
   * Resume an upload session
   */
  async resumeSession(sessionId: string): Promise<{
    canResume: boolean;
    missingChunks: number[];
    completedChunks: number[];
  }> {
    const session = this.getSessionStmt.get(sessionId) as ChunkedUploadSession | undefined;
    if (!session) {
      throw new Error(SwedishMessages.errors.BATCH_NOT_FOUND);
    }

    if (!session.resumable) {
      throw new Error('Session is not resumable');
    }

    if (session.status === 'expired') {
      throw new Error(SwedishMessages.errors.BATCH_CANCELLED);
    }

    if (session.status === 'completed') {
      return {
        canResume: false,
        missingChunks: [],
        completedChunks: Array.from({ length: session.total_chunks }, (_, i) => i)
      };
    }

    const chunks = this.getSessionChunksStmt.all(sessionId) as ChunkedUploadChunk[];
    const completedChunks = chunks
      .filter(c => c.status === 'uploaded')
      .map(c => c.chunk_number);
    
    const missingChunks = chunks
      .filter(c => c.status !== 'uploaded')
      .map(c => c.chunk_number);

    // Update session status to uploading if it was paused
    if (session.status === 'pending') {
      this.updateSessionStmt.run(
        'uploading',
        session.progress_percentage,
        session.chunks_uploaded,
        session.chunks_failed,
        session.final_file_path,
        session.completed_at,
        null, // error_message
        sessionId
      );
    }

    return {
      canResume: true,
      missingChunks: missingChunks.sort((a, b) => a - b),
      completedChunks: completedChunks.sort((a, b) => a - b)
    };
  }

  /**
   * Update session progress based on uploaded chunks
   */
  private async updateSessionProgress(sessionId: string): Promise<void> {
    const session = this.getSessionStmt.get(sessionId) as ChunkedUploadSession | undefined;
    if (!session) return;

    const chunks = this.getSessionChunksStmt.all(sessionId) as ChunkedUploadChunk[];
    const uploadedChunks = chunks.filter(c => c.status === 'uploaded').length;
    const failedChunks = chunks.filter(c => c.status === 'failed').length;
    const progressPercentage = (uploadedChunks / session.total_chunks) * 100;

    this.updateSessionStmt.run(
      session.status,
      progressPercentage,
      uploadedChunks,
      failedChunks,
      session.final_file_path,
      session.completed_at,
      session.error_message,
      sessionId
    );
  }

  /**
   * Check if all chunks are uploaded
   */
  private async areAllChunksUploaded(sessionId: string): Promise<boolean> {
    const result = this.db.prepare(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN status = 'uploaded' THEN 1 ELSE 0 END) as uploaded
      FROM chunked_upload_chunks 
      WHERE session_id = ?
    `).get(sessionId) as any;

    return result.total === result.uploaded && result.total > 0;
  }

  /**
   * Get the next pending chunk number
   */
  private getNextPendingChunk(sessionId: string, currentChunk: number): number | undefined {
    const nextChunk = this.db.prepare(`
      SELECT chunk_number FROM chunked_upload_chunks 
      WHERE session_id = ? AND status = 'pending' AND chunk_number > ?
      ORDER BY chunk_number 
      LIMIT 1
    `).get(sessionId, currentChunk) as any;

    return nextChunk?.chunk_number;
  }

  /**
   * Assemble the final file from chunks
   */
  private async assembleFile(sessionId: string): Promise<void> {
    const session = this.getSessionStmt.get(sessionId) as ChunkedUploadSession | undefined;
    if (!session) return;

    this.logEvent({
      sessionId,
      eventType: 'assembly_started',
      eventLevel: 'info',
      eventMessage: 'Starting file assembly from chunks'
    });

    try {
      // Update session status to assembling
      this.updateSessionStmt.run(
        'assembling',
        session.progress_percentage,
        session.chunks_uploaded,
        session.chunks_failed,
        session.final_file_path,
        session.completed_at,
        null,
        sessionId
      );

      const chunks = this.getSessionChunksStmt.all(sessionId) as ChunkedUploadChunk[];
      const finalFilePath = path.join(
        this.config.storageBasePath,
        session.cooperative_id,
        `${session.upload_id}_${session.original_filename}`
      );

      // Ensure final directory exists
      await fs.mkdir(path.dirname(finalFilePath), { recursive: true });

      // Assemble file by concatenating chunks in order
      const writeStream = await fs.open(finalFilePath, 'w');
      
      try {
        for (const chunk of chunks.sort((a, b) => a.chunk_number - b.chunk_number)) {
          if (!chunk.storage_path) {
            throw new Error(`Chunk ${chunk.chunk_number} storage path not found`);
          }
          
          const chunkData = await fs.readFile(chunk.storage_path);
          await writeStream.write(chunkData);
        }
      } finally {
        await writeStream.close();
      }

      // Verify final file if hash was provided
      if (session.file_hash && this.config.enableIntegrityVerification) {
        const fileData = await fs.readFile(finalFilePath);
        const actualHash = crypto.createHash('sha256').update(fileData).digest('hex');
        
        if (actualHash !== session.file_hash) {
          throw new Error(
            `File integrity check failed: expected ${session.file_hash}, got ${actualHash}`
          );
        }
      }

      // Update session as completed
      this.updateSessionStmt.run(
        'completed',
        100.0,
        session.chunks_uploaded,
        session.chunks_failed,
        finalFilePath,
        new Date().toISOString(),
        null,
        sessionId
      );

      this.logEvent({
        sessionId,
        eventType: 'assembly_completed',
        eventLevel: 'info',
        eventMessage: 'File assembly completed successfully',
        eventData: {
          finalFilePath,
          fileSize: session.file_size
        }
      });

      // Cleanup chunk files if auto cleanup is enabled
      if (session.auto_cleanup_enabled && session.storage_path) {
        try {
          await fs.rm(session.storage_path, { recursive: true, force: true });
        } catch (error) {
          console.error(`Failed to cleanup chunks for session ${sessionId}:`, error);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown assembly error';
      
      // Update session as failed
      this.updateSessionStmt.run(
        'failed',
        session.progress_percentage,
        session.chunks_uploaded,
        session.chunks_failed,
        session.final_file_path,
        null,
        errorMessage,
        sessionId
      );

      this.logEvent({
        sessionId,
        eventType: 'session_failed',
        eventLevel: 'error',
        eventMessage: `File assembly failed: ${errorMessage}`,
        eventData: { error: errorMessage }
      });

      throw error;
    }
  }

  /**
   * Log an event
   */
  private logEvent(options: {
    sessionId: string;
    chunkId?: string;
    eventType: ChunkedUploadEvent['event_type'];
    eventLevel: ChunkedUploadEvent['event_level'];
    eventMessage: string;
    eventData?: any;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): void {
    try {
      this.logEventStmt.run(
        options.sessionId,
        options.chunkId || null,
        options.eventType,
        options.eventLevel,
        options.eventMessage,
        options.eventData ? JSON.stringify(options.eventData) : null,
        options.userId || null,
        options.ipAddress || null,
        options.userAgent || null
      );
    } catch (error) {
      console.error('Failed to log chunked upload event:', error);
    }
  }

  /**
   * Get session by upload ID
   */
  getSessionByUploadId(uploadId: string): ChunkedUploadSession | null {
    const session = this.db.prepare(`
      SELECT * FROM chunked_upload_sessions WHERE upload_id = ?
    `).get(uploadId) as ChunkedUploadSession | undefined;

    return session || null;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<{
    expired: number;
    cleaned: number;
  }> {
    // Mark expired sessions
    const expiredResult = this.db.prepare(`
      UPDATE chunked_upload_sessions 
      SET status = 'expired', updated_at = datetime('now')
      WHERE status IN ('pending', 'uploading') 
        AND expires_at < datetime('now')
    `).run();

    // Get sessions to cleanup
    const sessionsToCleanup = this.db.prepare(`
      SELECT id, storage_path, final_file_path
      FROM chunked_upload_sessions 
      WHERE status = 'expired' 
        AND auto_cleanup_enabled = 1
        AND updated_at < datetime('now', '-1 hour')
    `).all() as ChunkedUploadSession[];

    let cleaned = 0;
    for (const session of sessionsToCleanup) {
      try {
        // Cleanup storage
        if (session.storage_path) {
          await fs.rm(session.storage_path, { recursive: true, force: true });
        }
        if (session.final_file_path) {
          await fs.unlink(session.final_file_path);
        }

        // Delete session record
        this.db.prepare('DELETE FROM chunked_upload_sessions WHERE id = ?').run(session.id);
        cleaned++;
      } catch (error) {
        console.error(`Failed to cleanup session ${session.id}:`, error);
      }
    }

    return {
      expired: expiredResult.changes,
      cleaned
    };
  }
}

export default ChunkedUploadManager;