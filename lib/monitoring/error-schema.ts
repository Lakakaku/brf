import Database from 'better-sqlite3';

/**
 * Error logging schema for BRF Portal
 * Comprehensive error tracking system with Swedish BRF context and categorization
 */

export const createErrorLogSchema = (db: Database.Database): void => {
  console.log('Creating error logging schema...');

  // Main error logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Error identification
      error_id TEXT NOT NULL UNIQUE DEFAULT (hex(randomblob(16))),
      correlation_id TEXT, -- For tracking related errors across services
      
      -- Error classification
      error_level TEXT NOT NULL CHECK (error_level IN (
        'debug', 'info', 'warning', 'error', 'critical', 'fatal'
      )),
      error_category TEXT NOT NULL CHECK (error_category IN (
        'auth', 'validation', 'database', 'network', 'payment', 'document',
        'booking', 'member_management', 'invoice', 'case_management', 
        'energy', 'contractor', 'board_meeting', 'queue', 'loan',
        'system', 'external_api', 'performance', 'security'
      )),
      error_subcategory TEXT, -- More specific categorization
      
      -- BRF-specific context
      brf_context TEXT CHECK (brf_context IN (
        'monthly_fees', 'annual_report', 'energy_declaration', 'board_election',
        'maintenance_case', 'contractor_evaluation', 'booking_system',
        'member_registration', 'payment_processing', 'document_approval',
        'meeting_protocol', 'queue_management', 'loan_tracking', 'audit_trail',
        'tax_reporting', 'insurance_claim', 'renovation_project', 'utility_billing'
      )),
      
      -- Error details
      error_message TEXT NOT NULL,
      error_message_sv TEXT, -- Swedish translation for user-facing errors
      error_code TEXT, -- Application-specific error code (e.g., 'BRF_001')
      
      -- Stack trace and debugging info
      stack_trace TEXT,
      source_file TEXT,
      source_line INTEGER,
      source_function TEXT,
      
      -- Request/Context information
      request_id TEXT,
      session_id TEXT,
      endpoint TEXT, -- API endpoint where error occurred
      http_method TEXT,
      request_url TEXT,
      
      -- User context
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      user_role TEXT,
      user_agent TEXT,
      ip_address TEXT,
      
      -- Related entities (BRF context)
      apartment_id TEXT REFERENCES apartments(id) ON DELETE SET NULL,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
      member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      meeting_id TEXT REFERENCES board_meetings(id) ON DELETE SET NULL,
      
      -- Error metadata
      environment TEXT DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
      application_version TEXT,
      browser_info TEXT DEFAULT '{}' CHECK (json_valid(browser_info)), -- Browser/device info
      
      -- Error frequency tracking
      occurrence_count INTEGER DEFAULT 1,
      first_occurrence_at TEXT NOT NULL,
      last_occurrence_at TEXT NOT NULL,
      
      -- Resolution tracking
      is_resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      resolved_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      resolution_notes TEXT,
      resolution_type TEXT CHECK (resolution_type IN (
        'fixed', 'workaround', 'configuration', 'user_error', 'duplicate', 'wont_fix'
      )),
      
      -- Notification tracking
      is_notified INTEGER DEFAULT 0,
      notified_at TEXT,
      notification_channels TEXT DEFAULT '[]' CHECK (json_valid(notification_channels)),
      
      -- Additional metadata
      additional_data TEXT DEFAULT '{}' CHECK (json_valid(additional_data)),
      tags TEXT DEFAULT '[]' CHECK (json_valid(tags)),
      
      -- Priority and impact assessment (for BRF operations)
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      impact_assessment TEXT CHECK (impact_assessment IN (
        'no_impact', 'minor', 'moderate', 'significant', 'critical'
      )),
      affects_operations INTEGER DEFAULT 0, -- Boolean: affects daily BRF operations
      affects_members INTEGER DEFAULT 0, -- Boolean: affects member experience
      
      -- Compliance and audit
      gdpr_relevant INTEGER DEFAULT 0, -- Boolean: involves personal data
      audit_required INTEGER DEFAULT 0, -- Boolean: requires audit trail
      regulatory_impact TEXT, -- Impact on Swedish regulatory compliance
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Error patterns table - for identifying recurring error patterns
  db.exec(`
    CREATE TABLE IF NOT EXISTS error_patterns (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Pattern identification
      pattern_hash TEXT NOT NULL, -- Hash of normalized error signature
      pattern_name TEXT NOT NULL,
      error_signature TEXT NOT NULL, -- Normalized error message/stack trace
      
      -- Pattern classification
      error_category TEXT NOT NULL,
      error_subcategory TEXT,
      brf_context TEXT,
      
      -- Pattern statistics
      occurrence_count INTEGER DEFAULT 0,
      affected_users_count INTEGER DEFAULT 0,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      
      -- Pattern analysis
      is_trending INTEGER DEFAULT 0, -- Boolean: increasing frequency
      trend_direction TEXT CHECK (trend_direction IN ('increasing', 'decreasing', 'stable')),
      avg_resolution_time_hours REAL DEFAULT 0,
      
      -- Auto-resolution configuration
      auto_resolve_enabled INTEGER DEFAULT 0,
      auto_resolve_criteria TEXT DEFAULT '{}' CHECK (json_valid(auto_resolve_criteria)),
      auto_notify_threshold INTEGER DEFAULT 5, -- Notify after X occurrences
      
      -- Pattern metadata
      pattern_severity TEXT DEFAULT 'medium' CHECK (pattern_severity IN ('low', 'medium', 'high', 'critical')),
      business_impact_description TEXT,
      suggested_fix TEXT,
      
      -- Status
      is_active INTEGER DEFAULT 1,
      is_monitored INTEGER DEFAULT 1, -- Boolean: actively monitor this pattern
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, pattern_hash)
    );
  `);

  // Error notifications table - for tracking notification delivery
  db.exec(`
    CREATE TABLE IF NOT EXISTS error_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Related error
      error_log_id INTEGER NOT NULL REFERENCES error_logs(id) ON DELETE CASCADE,
      error_pattern_id TEXT REFERENCES error_patterns(id) ON DELETE CASCADE,
      
      -- Notification details
      notification_type TEXT NOT NULL CHECK (notification_type IN (
        'immediate', 'aggregated', 'escalation', 'resolution'
      )),
      notification_channel TEXT NOT NULL CHECK (notification_channel IN (
        'email', 'sms', 'slack', 'webhook', 'in_app'
      )),
      
      -- Recipients
      recipient_type TEXT NOT NULL CHECK (recipient_type IN ('user', 'role', 'external')),
      recipient_id TEXT, -- User ID or role name
      recipient_contact TEXT, -- Email, phone, or webhook URL
      
      -- Message content
      subject TEXT,
      message_body TEXT,
      message_body_sv TEXT, -- Swedish version
      message_format TEXT DEFAULT 'text' CHECK (message_format IN ('text', 'html', 'json')),
      
      -- Delivery tracking
      status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'failed', 'bounced', 'suppressed'
      )),
      sent_at TEXT,
      delivered_at TEXT,
      failure_reason TEXT,
      
      -- Delivery attempts
      attempt_count INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      next_retry_at TEXT,
      
      -- Suppression (to prevent spam)
      suppressed_until TEXT,
      suppression_reason TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Error metrics aggregation table - for dashboard and reporting
  db.exec(`
    CREATE TABLE IF NOT EXISTS error_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Time period
      period_type TEXT NOT NULL CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      
      -- Overall error metrics
      total_errors INTEGER DEFAULT 0,
      unique_errors INTEGER DEFAULT 0, -- Distinct error patterns
      critical_errors INTEGER DEFAULT 0,
      resolved_errors INTEGER DEFAULT 0,
      unresolved_errors INTEGER DEFAULT 0,
      
      -- Error distribution by category
      auth_errors INTEGER DEFAULT 0,
      database_errors INTEGER DEFAULT 0,
      payment_errors INTEGER DEFAULT 0,
      document_errors INTEGER DEFAULT 0,
      booking_errors INTEGER DEFAULT 0,
      system_errors INTEGER DEFAULT 0,
      
      -- BRF-specific metrics
      member_affecting_errors INTEGER DEFAULT 0,
      operations_affecting_errors INTEGER DEFAULT 0,
      compliance_related_errors INTEGER DEFAULT 0,
      
      -- Performance impact
      avg_error_resolution_time_hours REAL DEFAULT 0,
      error_rate_per_request REAL DEFAULT 0, -- Errors per 1000 requests
      uptime_percentage REAL DEFAULT 100,
      
      -- User impact
      affected_users_count INTEGER DEFAULT 0,
      affected_apartments_count INTEGER DEFAULT 0,
      
      -- Trends
      error_trend TEXT CHECK (error_trend IN ('increasing', 'decreasing', 'stable')),
      compared_to_previous_period REAL DEFAULT 0, -- Percentage change
      
      -- Quality metrics
      mean_time_to_detection_minutes REAL DEFAULT 0,
      mean_time_to_resolution_hours REAL DEFAULT 0,
      first_response_time_minutes REAL DEFAULT 0,
      
      -- Additional metrics
      custom_metrics TEXT DEFAULT '{}' CHECK (json_valid(custom_metrics)),
      
      -- Metadata
      calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, period_type, period_start)
    );
  `);

  // Error suppression rules table - for managing notification noise
  db.exec(`
    CREATE TABLE IF NOT EXISTS error_suppression_rules (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Rule identification
      rule_name TEXT NOT NULL,
      description TEXT,
      
      -- Matching criteria
      error_category TEXT,
      error_subcategory TEXT,
      error_level TEXT,
      error_code TEXT,
      message_pattern TEXT, -- Regex pattern to match error messages
      
      -- BRF context matching
      brf_context TEXT,
      affects_operations INTEGER, -- Match errors affecting operations
      affects_members INTEGER, -- Match errors affecting members
      
      -- Suppression configuration
      suppression_type TEXT NOT NULL CHECK (suppression_type IN (
        'complete', 'rate_limit', 'escalation_only', 'business_hours_only'
      )),
      
      -- Rate limiting (for rate_limit type)
      max_notifications_per_hour INTEGER DEFAULT 1,
      max_notifications_per_day INTEGER DEFAULT 10,
      
      -- Time-based rules
      active_days TEXT DEFAULT '[1,2,3,4,5,6,7]' CHECK (json_valid(active_days)), -- 1=Monday, 7=Sunday
      active_hours_start TEXT DEFAULT '00:00',
      active_hours_end TEXT DEFAULT '23:59',
      
      -- Escalation rules
      escalation_threshold INTEGER DEFAULT 10, -- Escalate after X occurrences
      escalation_timeframe_minutes INTEGER DEFAULT 60,
      escalation_recipients TEXT DEFAULT '[]' CHECK (json_valid(escalation_recipients)),
      
      -- Rule status
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 100, -- Higher number = higher priority
      
      -- Usage tracking
      times_applied INTEGER DEFAULT 0,
      last_applied_at TEXT,
      
      -- Metadata
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, rule_name)
    );
  `);

  console.log('✅ Error logging schema created successfully');
};

export const createErrorLogIndexes = (db: Database.Database): void => {
  console.log('Creating error logging indexes...');

  // Error logs indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_cooperative ON error_logs(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_error_id ON error_logs(error_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_correlation ON error_logs(correlation_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(error_level);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(error_category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_brf_context ON error_logs(brf_context);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(is_resolved);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_first_occurrence ON error_logs(first_occurrence_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_priority ON error_logs(priority);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_impact ON error_logs(impact_assessment);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_operations ON error_logs(affects_operations);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_members ON error_logs(affects_members);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_apartment ON error_logs(apartment_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_case ON error_logs(case_id);`);

  // Composite indexes for common queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_category_level ON error_logs(error_category, error_level);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_coop_category_created ON error_logs(cooperative_id, error_category, created_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON error_logs(cooperative_id, is_resolved, priority) WHERE is_resolved = 0;`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_logs_recent ON error_logs(cooperative_id, created_at) WHERE created_at > datetime('now', '-7 days');`);

  // Error patterns indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_patterns_cooperative ON error_patterns(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_patterns_hash ON error_patterns(pattern_hash);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_patterns_category ON error_patterns(error_category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_patterns_trending ON error_patterns(is_trending);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_patterns_active ON error_patterns(is_active, is_monitored);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_patterns_occurrence_count ON error_patterns(occurrence_count);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_patterns_last_seen ON error_patterns(last_seen_at);`);

  // Error notifications indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_notifications_cooperative ON error_notifications(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_notifications_error_log ON error_notifications(error_log_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_notifications_pattern ON error_notifications(error_pattern_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_notifications_status ON error_notifications(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_notifications_channel ON error_notifications(notification_channel);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_notifications_recipient ON error_notifications(recipient_type, recipient_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_notifications_created ON error_notifications(created_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_notifications_retry ON error_notifications(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;`);

  // Error metrics indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_metrics_cooperative ON error_metrics(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_metrics_period ON error_metrics(period_type, period_start);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_metrics_lookup ON error_metrics(cooperative_id, period_type, period_start);`);

  // Error suppression rules indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_suppression_cooperative ON error_suppression_rules(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_suppression_active ON error_suppression_rules(is_active);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_suppression_category ON error_suppression_rules(error_category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_error_suppression_priority ON error_suppression_rules(priority);`);

  console.log('✅ Error logging indexes created successfully');
};

export const createErrorLogTriggers = (db: Database.Database): void => {
  console.log('Creating error logging triggers...');

  // Auto-update error patterns when new errors are logged
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_error_patterns
    AFTER INSERT ON error_logs
    FOR EACH ROW
    BEGIN
      -- Calculate pattern hash from normalized error signature
      INSERT OR IGNORE INTO error_patterns (
        cooperative_id, pattern_hash, pattern_name, error_signature,
        error_category, error_subcategory, brf_context,
        occurrence_count, first_seen_at, last_seen_at
      ) VALUES (
        NEW.cooperative_id,
        substr(
          hex(
            hash(COALESCE(NEW.error_code, '') || '|' || 
                 COALESCE(NEW.error_category, '') || '|' || 
                 COALESCE(substr(NEW.error_message, 1, 100), ''))
          ), 1, 16
        ),
        COALESCE(NEW.error_code, NEW.error_category || ' Error'),
        COALESCE(NEW.error_code, '') || '|' || 
        COALESCE(NEW.error_category, '') || '|' || 
        COALESCE(substr(NEW.error_message, 1, 100), ''),
        NEW.error_category,
        NEW.error_subcategory,
        NEW.brf_context,
        1,
        NEW.created_at,
        NEW.created_at
      );
      
      -- Update existing pattern if it already exists
      UPDATE error_patterns 
      SET 
        occurrence_count = occurrence_count + 1,
        last_seen_at = NEW.created_at,
        updated_at = datetime('now')
      WHERE cooperative_id = NEW.cooperative_id 
        AND pattern_hash = substr(
          hex(
            hash(COALESCE(NEW.error_code, '') || '|' || 
                 COALESCE(NEW.error_category, '') || '|' || 
                 COALESCE(substr(NEW.error_message, 1, 100), ''))
          ), 1, 16
        );
    END;
  `);

  // Update error log occurrence count for duplicates
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_error_occurrence_count
    AFTER INSERT ON error_logs
    FOR EACH ROW
    BEGIN
      -- Check if similar error exists in last hour
      UPDATE error_logs 
      SET 
        occurrence_count = occurrence_count + 1,
        last_occurrence_at = NEW.created_at,
        updated_at = datetime('now')
      WHERE id = (
        SELECT id FROM error_logs 
        WHERE cooperative_id = NEW.cooperative_id
          AND error_category = NEW.error_category
          AND error_code = NEW.error_code
          AND error_message = NEW.error_message
          AND user_id IS NEW.user_id
          AND created_at > datetime('now', '-1 hour')
          AND id != NEW.id
        ORDER BY created_at DESC 
        LIMIT 1
      );
      
      -- Delete the new duplicate if we found and updated an existing one
      DELETE FROM error_logs 
      WHERE id = NEW.id 
        AND EXISTS (
          SELECT 1 FROM error_logs 
          WHERE cooperative_id = NEW.cooperative_id
            AND error_category = NEW.error_category
            AND error_code = NEW.error_code
            AND error_message = NEW.error_message
            AND user_id IS NEW.user_id
            AND created_at > datetime('now', '-1 hour')
            AND id != NEW.id
            AND occurrence_count > 1
        );
    END;
  `);

  // Auto-categorize errors based on context
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS auto_categorize_errors
    AFTER INSERT ON error_logs
    FOR EACH ROW
    WHEN NEW.error_category IS NULL OR NEW.error_category = 'system'
    BEGIN
      UPDATE error_logs 
      SET 
        error_category = CASE
          WHEN NEW.endpoint LIKE '%/auth%' OR NEW.error_message LIKE '%authentication%' OR NEW.error_message LIKE '%authorization%' THEN 'auth'
          WHEN NEW.endpoint LIKE '%/payment%' OR NEW.error_message LIKE '%payment%' OR NEW.error_message LIKE '%invoice%' THEN 'payment'
          WHEN NEW.endpoint LIKE '%/document%' OR NEW.error_message LIKE '%document%' OR NEW.error_message LIKE '%upload%' THEN 'document'
          WHEN NEW.endpoint LIKE '%/booking%' OR NEW.error_message LIKE '%booking%' OR NEW.error_message LIKE '%reservation%' THEN 'booking'
          WHEN NEW.endpoint LIKE '%/member%' OR NEW.error_message LIKE '%member%' OR NEW.error_message LIKE '%user%' THEN 'member_management'
          WHEN NEW.endpoint LIKE '%/case%' OR NEW.error_message LIKE '%case%' OR NEW.error_message LIKE '%maintenance%' THEN 'case_management'
          WHEN NEW.error_message LIKE '%database%' OR NEW.error_message LIKE '%sql%' OR NEW.error_message LIKE '%connection%' THEN 'database'
          WHEN NEW.error_message LIKE '%network%' OR NEW.error_message LIKE '%timeout%' OR NEW.error_message LIKE '%fetch%' THEN 'network'
          WHEN NEW.error_message LIKE '%validation%' OR NEW.error_message LIKE '%invalid%' OR NEW.error_message LIKE '%format%' THEN 'validation'
          ELSE 'system'
        END,
        brf_context = CASE
          WHEN NEW.error_message LIKE '%monthly%fee%' OR NEW.error_message LIKE '%månadsavgift%' THEN 'monthly_fees'
          WHEN NEW.error_message LIKE '%energy%' OR NEW.error_message LIKE '%energi%' THEN 'energy_declaration'
          WHEN NEW.error_message LIKE '%contractor%' OR NEW.error_message LIKE '%entreprenör%' THEN 'contractor_evaluation'
          WHEN NEW.error_message LIKE '%meeting%' OR NEW.error_message LIKE '%möte%' THEN 'meeting_protocol'
          WHEN NEW.error_message LIKE '%queue%' OR NEW.error_message LIKE '%kö%' THEN 'queue_management'
          WHEN NEW.error_message LIKE '%loan%' OR NEW.error_message LIKE '%lån%' THEN 'loan_tracking'
          ELSE NEW.brf_context
        END
      WHERE id = NEW.id;
    END;
  `);

  // Clean up old resolved errors (retention policy)
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS cleanup_old_errors
    AFTER INSERT ON error_logs
    FOR EACH ROW
    BEGIN
      -- Delete resolved errors older than 1 year
      DELETE FROM error_logs 
      WHERE is_resolved = 1 
        AND resolved_at < datetime('now', '-1 year');
      
      -- Delete debug/info level errors older than 30 days
      DELETE FROM error_logs 
      WHERE error_level IN ('debug', 'info') 
        AND created_at < datetime('now', '-30 days');
      
      -- Delete low priority resolved errors older than 6 months
      DELETE FROM error_logs 
      WHERE is_resolved = 1 
        AND priority = 'low'
        AND resolved_at < datetime('now', '-6 months');
    END;
  `);

  // Update timestamps trigger
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_error_logs_timestamp
    AFTER UPDATE ON error_logs
    FOR EACH ROW
    BEGIN
      UPDATE error_logs 
      SET updated_at = datetime('now') 
      WHERE id = NEW.id;
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_error_patterns_timestamp
    AFTER UPDATE ON error_patterns
    FOR EACH ROW
    BEGIN
      UPDATE error_patterns 
      SET updated_at = datetime('now') 
      WHERE id = NEW.id;
    END;
  `);

  console.log('✅ Error logging triggers created successfully');
};

export const dropErrorLogSchema = (db: Database.Database): void => {
  console.log('Dropping error logging schema...');

  const tables = [
    'error_suppression_rules',
    'error_metrics',
    'error_notifications',
    'error_patterns',
    'error_logs'
  ];

  tables.forEach(table => {
    db.exec(`DROP TABLE IF EXISTS ${table};`);
  });

  console.log('✅ Error logging schema dropped successfully');
};