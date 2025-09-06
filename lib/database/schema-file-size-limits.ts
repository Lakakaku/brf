/**
 * File Size Limits Schema Extension for BRF Portal
 * Provides configurable file size management per cooperative and document type
 */

import Database from 'better-sqlite3';

/**
 * Create file size limit related tables
 */
export const createFileSizeLimitSchema = (db: Database.Database): void => {
  console.log('Creating file size limit schema...');

  // File size limit configurations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_size_limit_configs (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Configuration scope
      config_type TEXT NOT NULL CHECK (config_type IN ('global', 'document_type', 'user_override', 'user_specific')),
      config_name TEXT NOT NULL, -- e.g., 'global', 'invoice', 'protocol', 'user:user_id', 'admin_override'
      
      -- Size limits (in bytes)
      max_file_size_bytes INTEGER NOT NULL DEFAULT 524288000, -- 500MB default
      max_batch_size_bytes INTEGER, -- Total size for batch uploads
      max_daily_size_bytes INTEGER, -- Daily upload limit per user/cooperative
      max_monthly_size_bytes INTEGER, -- Monthly upload limit
      
      -- Document type specific settings (applies when config_type = 'document_type')
      document_type TEXT CHECK (document_type IN (
        'invoice', 'protocol', 'contract', 'financial_report', 'technical_report',
        'insurance', 'legal', 'maintenance', 'energy', 'tenant_related',
        'board_materials', 'general', 'unknown', 'image', 'video', 'audio'
      )),
      document_category TEXT, -- Additional categorization
      
      -- User-specific settings (applies when config_type = 'user_specific' or 'user_override')
      user_id TEXT REFERENCES members(id) ON DELETE CASCADE,
      role_based TEXT, -- 'board', 'member', 'admin', 'external'
      
      -- File type restrictions
      allowed_mime_types TEXT DEFAULT '[]' CHECK (json_valid(allowed_mime_types)), -- JSON array
      blocked_mime_types TEXT DEFAULT '[]' CHECK (json_valid(blocked_mime_types)), -- JSON array
      allowed_extensions TEXT DEFAULT '[]' CHECK (json_valid(allowed_extensions)), -- JSON array
      blocked_extensions TEXT DEFAULT '[]' CHECK (json_valid(blocked_extensions)), -- JSON array
      
      -- Compression and optimization settings
      auto_compress_enabled INTEGER DEFAULT 0,
      compression_threshold_bytes INTEGER, -- Auto-compress files larger than this
      compression_quality INTEGER DEFAULT 85 CHECK (compression_quality BETWEEN 1 AND 100), -- 1-100 for images
      suggest_compression_at_bytes INTEGER, -- Suggest compression to user at this size
      
      -- Priority and inheritance
      priority INTEGER DEFAULT 100, -- Lower numbers = higher priority for rule application
      inherits_from TEXT, -- ID of parent configuration to inherit from
      
      -- Status and validation
      is_active INTEGER DEFAULT 1,
      is_system_default INTEGER DEFAULT 0, -- Cannot be deleted if true
      validation_mode TEXT DEFAULT 'strict' CHECK (validation_mode IN ('strict', 'warning', 'log_only')),
      
      -- Swedish language settings
      display_name_sv TEXT, -- Swedish display name for UI
      description_sv TEXT, -- Swedish description
      error_message_sv TEXT, -- Custom Swedish error message
      
      -- Administrative tracking
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      approved_by TEXT REFERENCES members(id) ON DELETE SET NULL, -- For sensitive changes
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      effective_from TEXT DEFAULT (datetime('now')), -- When this configuration becomes active
      effective_until TEXT, -- When this configuration expires
      
      -- Ensure uniqueness per cooperative and scope
      UNIQUE(cooperative_id, config_type, config_name, document_type, user_id)
    );
  `);

  // Storage quota usage tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS storage_quota_usage (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Usage scope
      usage_scope TEXT NOT NULL CHECK (usage_scope IN ('cooperative', 'user', 'document_type', 'monthly', 'daily')),
      scope_identifier TEXT, -- user_id, document_type, or date for temporal scopes
      
      -- Usage statistics (in bytes)
      current_usage_bytes INTEGER DEFAULT 0,
      peak_usage_bytes INTEGER DEFAULT 0,
      total_files_count INTEGER DEFAULT 0,
      total_uploads_count INTEGER DEFAULT 0,
      
      -- Limits and thresholds
      soft_limit_bytes INTEGER, -- Warning threshold
      hard_limit_bytes INTEGER, -- Absolute limit
      quota_limit_bytes INTEGER, -- Allocated quota
      
      -- Time period tracking (for temporal scopes)
      period_type TEXT CHECK (period_type IN ('day', 'week', 'month', 'year', 'unlimited')),
      period_start TEXT, -- Start of current period
      period_end TEXT, -- End of current period
      
      -- Usage breakdown by document type
      document_type_breakdown TEXT DEFAULT '{}' CHECK (json_valid(document_type_breakdown)), -- JSON with type:bytes
      mime_type_breakdown TEXT DEFAULT '{}' CHECK (json_valid(mime_type_breakdown)), -- JSON with mime:bytes
      
      -- Status and alerts
      status TEXT DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical', 'exceeded')),
      last_warning_sent TEXT, -- When we last sent a warning notification
      warning_count INTEGER DEFAULT 0,
      alert_settings TEXT DEFAULT '{}' CHECK (json_valid(alert_settings)), -- JSON alert configuration
      
      -- Metadata
      last_calculated TEXT NOT NULL DEFAULT (datetime('now')),
      calculation_job_id TEXT, -- Background job that calculated this
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      -- Performance indexes
      UNIQUE(cooperative_id, usage_scope, scope_identifier, period_type, period_start)
    );
  `);

  // File size violation audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_size_violation_log (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Violation details
      violation_type TEXT NOT NULL CHECK (violation_type IN (
        'file_too_large', 'batch_too_large', 'daily_quota_exceeded', 'monthly_quota_exceeded',
        'document_type_limit_exceeded', 'user_limit_exceeded', 'storage_quota_full',
        'mime_type_blocked', 'extension_blocked', 'compression_required'
      )),
      severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
      
      -- File and upload context
      original_filename TEXT,
      file_size_bytes INTEGER,
      mime_type TEXT,
      document_type TEXT,
      batch_id TEXT, -- Reference to upload batch if applicable
      upload_session_id TEXT,
      
      -- User and request context
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      user_email TEXT,
      user_role TEXT,
      request_ip TEXT,
      user_agent TEXT,
      
      -- Limit configuration that was violated
      violated_config_id TEXT REFERENCES file_size_limit_configs(id) ON DELETE SET NULL,
      configured_limit_bytes INTEGER,
      actual_size_bytes INTEGER,
      
      -- Resolution and action taken
      action_taken TEXT CHECK (action_taken IN (
        'rejected', 'auto_compressed', 'manual_review', 'admin_override', 'quota_increased', 'ignored'
      )),
      resolution_details TEXT,
      resolved_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      resolved_at TEXT,
      
      -- Swedish language messages
      violation_message_sv TEXT, -- Swedish error message shown to user
      suggested_action_sv TEXT, -- Swedish suggestion for resolution
      
      -- Additional context data
      context_data TEXT DEFAULT '{}' CHECK (json_valid(context_data)), -- JSON with additional details
      
      -- Notification tracking
      notification_sent INTEGER DEFAULT 0,
      notification_type TEXT, -- 'email', 'ui', 'sms', 'webhook'
      notification_details TEXT DEFAULT '{}' CHECK (json_valid(notification_details)),
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      -- Index for performance
      INDEX(cooperative_id, created_at),
      INDEX(user_id, created_at),
      INDEX(violation_type, severity)
    );
  `);

  // File compression suggestions and results
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_compression_suggestions (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- File identification
      original_filename TEXT NOT NULL,
      original_size_bytes INTEGER NOT NULL,
      original_mime_type TEXT,
      document_type TEXT,
      
      -- User context
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      suggested_to_user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Compression analysis
      compression_potential TEXT DEFAULT 'unknown' CHECK (compression_potential IN (
        'high', 'medium', 'low', 'minimal', 'not_recommended', 'unknown'
      )),
      estimated_compressed_size_bytes INTEGER,
      estimated_compression_ratio REAL, -- 0.0 to 1.0
      recommended_quality INTEGER, -- For image compression
      recommended_format TEXT, -- Suggested output format
      
      -- Compression methods available
      available_methods TEXT DEFAULT '[]' CHECK (json_valid(available_methods)), -- JSON array of methods
      recommended_method TEXT, -- Best method for this file
      
      -- User interaction
      suggestion_status TEXT DEFAULT 'pending' CHECK (suggestion_status IN (
        'pending', 'accepted', 'declined', 'ignored', 'auto_applied', 'expired'
      )),
      user_response_at TEXT,
      user_feedback TEXT, -- Optional user feedback about suggestion
      
      -- Compression results (if applied)
      compression_applied INTEGER DEFAULT 0,
      actual_compressed_size_bytes INTEGER,
      actual_compression_ratio REAL,
      compression_method_used TEXT,
      compression_quality_used INTEGER,
      compression_job_id TEXT,
      compressed_file_path TEXT,
      
      -- Cost-benefit analysis
      storage_saved_bytes INTEGER,
      processing_time_seconds REAL,
      bandwidth_saved_estimate_bytes INTEGER,
      
      -- Swedish language content
      suggestion_title_sv TEXT,
      suggestion_message_sv TEXT,
      benefits_description_sv TEXT,
      
      -- Expiration and cleanup
      suggestion_expires_at TEXT DEFAULT (datetime('now', '+7 days')),
      auto_cleanup_after TEXT DEFAULT (datetime('now', '+30 days')),
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      -- Performance indexes
      INDEX(cooperative_id, suggestion_status),
      INDEX(user_id, created_at),
      INDEX(suggestion_expires_at)
    );
  `);

  // Administrative overrides and approvals
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_size_admin_overrides (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Override context
      override_type TEXT NOT NULL CHECK (override_type IN (
        'single_file', 'user_temporary', 'user_permanent', 'document_type', 'global_adjustment'
      )),
      override_reason TEXT NOT NULL,
      
      -- File/User context
      affected_file_path TEXT,
      affected_user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      affected_document_type TEXT,
      
      -- Override details
      original_limit_bytes INTEGER NOT NULL,
      new_limit_bytes INTEGER NOT NULL,
      limit_increase_bytes INTEGER GENERATED ALWAYS AS (new_limit_bytes - original_limit_bytes),
      
      -- Approval workflow
      requested_by TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      approved_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN (
        'pending', 'approved', 'rejected', 'auto_approved', 'expired'
      )),
      
      -- Temporal scope
      effective_from TEXT DEFAULT (datetime('now')),
      effective_until TEXT, -- NULL for permanent overrides
      auto_expire INTEGER DEFAULT 0, -- Auto-expire when effective_until is reached
      
      -- Justification and audit trail
      business_justification TEXT NOT NULL, -- Required business reason
      risk_assessment TEXT, -- Security/business risk assessment
      stakeholder_notification TEXT DEFAULT '{}' CHECK (json_valid(stakeholder_notification)), -- Who was notified
      
      -- Approval workflow details
      approval_requested_at TEXT DEFAULT (datetime('now')),
      approval_deadline TEXT,
      approval_comments TEXT,
      rejection_reason TEXT,
      
      -- Usage tracking
      times_used INTEGER DEFAULT 0,
      total_bytes_processed INTEGER DEFAULT 0,
      last_used_at TEXT,
      
      -- Swedish language content
      override_description_sv TEXT,
      approval_notes_sv TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      -- Performance and audit indexes
      INDEX(cooperative_id, approval_status),
      INDEX(requested_by, created_at),
      INDEX(approved_by, created_at),
      INDEX(effective_from, effective_until)
    );
  `);

  console.log('✅ File size limit schema created successfully');
};

/**
 * Create indexes for file size limit tables
 */
export const createFileSizeLimitIndexes = (db: Database.Database): void => {
  console.log('Creating file size limit indexes...');

  // File size limit configs indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_file_size_configs_cooperative ON file_size_limit_configs(cooperative_id);
    CREATE INDEX IF NOT EXISTS idx_file_size_configs_type ON file_size_limit_configs(config_type);
    CREATE INDEX IF NOT EXISTS idx_file_size_configs_document_type ON file_size_limit_configs(document_type);
    CREATE INDEX IF NOT EXISTS idx_file_size_configs_user ON file_size_limit_configs(user_id);
    CREATE INDEX IF NOT EXISTS idx_file_size_configs_active ON file_size_limit_configs(is_active, effective_from, effective_until);
    CREATE INDEX IF NOT EXISTS idx_file_size_configs_priority ON file_size_limit_configs(cooperative_id, priority);
  `);

  // Storage quota usage indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_storage_quota_cooperative ON storage_quota_usage(cooperative_id);
    CREATE INDEX IF NOT EXISTS idx_storage_quota_scope ON storage_quota_usage(usage_scope, scope_identifier);
    CREATE INDEX IF NOT EXISTS idx_storage_quota_period ON storage_quota_usage(period_start, period_end);
    CREATE INDEX IF NOT EXISTS idx_storage_quota_status ON storage_quota_usage(status, last_warning_sent);
    CREATE INDEX IF NOT EXISTS idx_storage_quota_calculation ON storage_quota_usage(last_calculated);
  `);

  // File size violation log indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_violation_log_cooperative ON file_size_violation_log(cooperative_id);
    CREATE INDEX IF NOT EXISTS idx_violation_log_user ON file_size_violation_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_violation_log_type ON file_size_violation_log(violation_type);
    CREATE INDEX IF NOT EXISTS idx_violation_log_severity ON file_size_violation_log(severity);
    CREATE INDEX IF NOT EXISTS idx_violation_log_created ON file_size_violation_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_violation_log_resolution ON file_size_violation_log(action_taken, resolved_at);
  `);

  // File compression suggestions indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_compression_suggestions_cooperative ON file_compression_suggestions(cooperative_id);
    CREATE INDEX IF NOT EXISTS idx_compression_suggestions_user ON file_compression_suggestions(user_id);
    CREATE INDEX IF NOT EXISTS idx_compression_suggestions_status ON file_compression_suggestions(suggestion_status);
    CREATE INDEX IF NOT EXISTS idx_compression_suggestions_expires ON file_compression_suggestions(suggestion_expires_at);
    CREATE INDEX IF NOT EXISTS idx_compression_suggestions_cleanup ON file_compression_suggestions(auto_cleanup_after);
  `);

  // Admin overrides indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_admin_overrides_cooperative ON file_size_admin_overrides(cooperative_id);
    CREATE INDEX IF NOT EXISTS idx_admin_overrides_requested_by ON file_size_admin_overrides(requested_by);
    CREATE INDEX IF NOT EXISTS idx_admin_overrides_approved_by ON file_size_admin_overrides(approved_by);
    CREATE INDEX IF NOT EXISTS idx_admin_overrides_status ON file_size_admin_overrides(approval_status);
    CREATE INDEX IF NOT EXISTS idx_admin_overrides_effective ON file_size_admin_overrides(effective_from, effective_until);
    CREATE INDEX IF NOT EXISTS idx_admin_overrides_user ON file_size_admin_overrides(affected_user_id);
  `);

  console.log('✅ File size limit indexes created successfully');
};

/**
 * Create triggers for file size limit tables
 */
export const createFileSizeLimitTriggers = (db: Database.Database): void => {
  console.log('Creating file size limit triggers...');

  // Update timestamps trigger for file_size_limit_configs
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_file_size_configs_timestamp
    AFTER UPDATE ON file_size_limit_configs
    BEGIN
      UPDATE file_size_limit_configs 
      SET updated_at = datetime('now') 
      WHERE id = NEW.id;
    END;
  `);

  // Update timestamps trigger for storage_quota_usage
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_storage_quota_timestamp
    AFTER UPDATE ON storage_quota_usage
    BEGIN
      UPDATE storage_quota_usage 
      SET updated_at = datetime('now') 
      WHERE id = NEW.id;
    END;
  `);

  // Update timestamps trigger for file_compression_suggestions
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_compression_suggestions_timestamp
    AFTER UPDATE ON file_compression_suggestions
    BEGIN
      UPDATE file_compression_suggestions 
      SET updated_at = datetime('now') 
      WHERE id = NEW.id;
    END;
  `);

  // Update timestamps trigger for file_size_admin_overrides
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_admin_overrides_timestamp
    AFTER UPDATE ON file_size_admin_overrides
    BEGIN
      UPDATE file_size_admin_overrides 
      SET updated_at = datetime('now') 
      WHERE id = NEW.id;
    END;
  `);

  // Auto-expire admin overrides trigger
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS auto_expire_admin_overrides
    BEFORE UPDATE ON file_size_admin_overrides
    WHEN NEW.effective_until IS NOT NULL 
    AND NEW.effective_until < datetime('now')
    AND NEW.auto_expire = 1
    AND NEW.approval_status = 'approved'
    BEGIN
      UPDATE file_size_admin_overrides 
      SET approval_status = 'expired'
      WHERE id = NEW.id;
    END;
  `);

  console.log('✅ File size limit triggers created successfully');
};

/**
 * Insert default file size limit configurations
 */
export const insertDefaultFileSizeLimits = (db: Database.Database): void => {
  console.log('Inserting default file size limit configurations...');

  // Get all cooperatives to create default configs for each
  const cooperatives = db.prepare('SELECT id FROM cooperatives').all() as { id: string }[];

  const insertDefaultConfig = db.prepare(`
    INSERT OR IGNORE INTO file_size_limit_configs (
      cooperative_id, config_type, config_name, max_file_size_bytes, 
      document_type, display_name_sv, description_sv, is_system_default,
      auto_compress_enabled, suggest_compression_at_bytes, compression_threshold_bytes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const coop of cooperatives) {
    // Global default limit
    insertDefaultConfig.run([
      coop.id, 'global', 'global', 524288000, // 500MB
      null,
      'Global filstorlek gräns',
      'Standard filstorlek gräns för alla dokument',
      1, 0, 104857600, 209715200 // Suggest compression at 100MB, auto at 200MB
    ]);

    // Document type specific limits
    const documentTypeLimits = [
      { type: 'invoice', size: 52428800, name: 'Fakturor', desc: 'Leverantörsfakturor och räkningar' }, // 50MB
      { type: 'protocol', size: 104857600, name: 'Protokoll', desc: 'Styrelsemöten och föreningsstämmor' }, // 100MB
      { type: 'contract', size: 104857600, name: 'Avtal', desc: 'Avtal och överenskommelser' }, // 100MB
      { type: 'financial_report', size: 209715200, name: 'Ekonomiska rapporter', desc: 'Årsredovisningar och bokslut' }, // 200MB
      { type: 'technical_report', size: 314572800, name: 'Tekniska rapporter', desc: 'Besiktningar och tekniska utredningar' }, // 300MB
      { type: 'image', size: 104857600, name: 'Bilder', desc: 'Foton och bildmaterial' }, // 100MB
      { type: 'video', size: 1073741824, name: 'Video', desc: 'Videofilmer och inspelningar' }, // 1GB
      { type: 'audio', size: 209715200, name: 'Ljud', desc: 'Ljudfiler och inspelningar' }, // 200MB
    ];

    for (const docType of documentTypeLimits) {
      insertDefaultConfig.run([
        coop.id, 'document_type', docType.type, docType.size,
        docType.type,
        docType.name,
        docType.desc,
        1, 1, Math.floor(docType.size * 0.5), Math.floor(docType.size * 0.8) // Enable auto-compress for doc types
      ]);
    }
  }

  console.log(`✅ Default file size limit configurations inserted for ${cooperatives.length} cooperatives`);
};