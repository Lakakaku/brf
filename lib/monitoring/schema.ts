import Database from 'better-sqlite3';

/**
 * Performance monitoring schema for BRF Portal
 * Tracks system performance, database queries, and BRF-specific metrics
 */

export const createPerformanceSchema = (db: Database.Database): void => {
  console.log('Creating performance monitoring schema...');

  // System performance metrics
  db.exec(`
    CREATE TABLE IF NOT EXISTS performance_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Metric identification
      metric_name TEXT NOT NULL, -- cpu_usage, memory_usage, response_time, etc.
      metric_category TEXT NOT NULL CHECK (metric_category IN (
        'system', 'database', 'api', 'user_session', 'brf_operations'
      )),
      metric_type TEXT NOT NULL CHECK (metric_type IN (
        'counter', 'gauge', 'histogram', 'timer'
      )),
      
      -- Metric values
      value REAL NOT NULL,
      unit TEXT NOT NULL, -- ms, bytes, percent, count, etc.
      
      -- Context and metadata
      endpoint TEXT, -- API endpoint if applicable
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      session_id TEXT,
      request_id TEXT, -- Unique request identifier
      
      -- Additional context data
      metadata TEXT DEFAULT '{}' CHECK (json_valid(metadata)),
      tags TEXT DEFAULT '{}' CHECK (json_valid(tags)),
      
      -- Timestamp
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      -- Indexes for performance
      FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE
    );
  `);

  // Database query performance tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Query identification
      query_hash TEXT NOT NULL, -- SHA256 hash of normalized query
      query_type TEXT NOT NULL CHECK (query_type IN (
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRANSACTION'
      )),
      table_name TEXT,
      operation TEXT, -- specific operation like 'find_invoices', 'create_member'
      
      -- Performance metrics
      execution_time_ms REAL NOT NULL,
      rows_affected INTEGER DEFAULT 0,
      rows_examined INTEGER DEFAULT 0,
      
      -- Query context
      endpoint TEXT, -- API endpoint that triggered the query
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      session_id TEXT,
      request_id TEXT,
      
      -- Query metadata
      is_slow_query INTEGER DEFAULT 0, -- Boolean: execution time > threshold
      query_plan TEXT, -- SQLite query plan if available
      parameters TEXT DEFAULT '{}' CHECK (json_valid(parameters)), -- Query parameters (sanitized)
      
      -- Error tracking
      error_occurred INTEGER DEFAULT 0,
      error_message TEXT,
      
      -- Timestamp
      executed_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE
    );
  `);

  // API endpoint performance metrics
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Request identification
      request_id TEXT NOT NULL UNIQUE,
      method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
      endpoint TEXT NOT NULL,
      route_pattern TEXT, -- /api/cooperatives/[id]/invoices
      
      -- Performance metrics
      response_time_ms REAL NOT NULL,
      status_code INTEGER NOT NULL,
      response_size_bytes INTEGER DEFAULT 0,
      request_size_bytes INTEGER DEFAULT 0,
      
      -- User context
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      user_role TEXT,
      session_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      
      -- Additional metrics
      database_queries_count INTEGER DEFAULT 0,
      database_time_ms REAL DEFAULT 0,
      cache_hits INTEGER DEFAULT 0,
      cache_misses INTEGER DEFAULT 0,
      
      -- Error tracking
      error_occurred INTEGER DEFAULT 0,
      error_type TEXT,
      error_message TEXT,
      
      -- BRF context
      apartment_id TEXT REFERENCES apartments(id) ON DELETE SET NULL,
      case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
      
      -- Timestamp
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE
    );
  `);

  // BRF-specific business metrics
  db.exec(`
    CREATE TABLE IF NOT EXISTS brf_business_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Metric period
      period_type TEXT NOT NULL CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
      period_start TEXT NOT NULL, -- ISO date string
      period_end TEXT NOT NULL,
      
      -- Financial metrics
      invoices_processed INTEGER DEFAULT 0,
      invoices_approved INTEGER DEFAULT 0,
      total_invoice_amount REAL DEFAULT 0,
      payment_collection_rate REAL DEFAULT 0, -- Percentage
      overdue_payments_count INTEGER DEFAULT 0,
      overdue_amount REAL DEFAULT 0,
      
      -- Member activity metrics
      active_members_count INTEGER DEFAULT 0,
      login_count INTEGER DEFAULT 0,
      document_uploads INTEGER DEFAULT 0,
      case_reports INTEGER DEFAULT 0,
      booking_requests INTEGER DEFAULT 0,
      
      -- System usage metrics
      api_requests INTEGER DEFAULT 0,
      average_response_time_ms REAL DEFAULT 0,
      error_rate REAL DEFAULT 0, -- Percentage
      uptime_percentage REAL DEFAULT 100,
      
      -- BRF operational metrics
      energy_cost_per_sqm REAL DEFAULT 0,
      maintenance_cases_opened INTEGER DEFAULT 0,
      maintenance_cases_resolved INTEGER DEFAULT 0,
      board_meeting_attendance_rate REAL DEFAULT 0,
      
      -- Efficiency metrics
      case_resolution_time_avg_days REAL DEFAULT 0,
      invoice_approval_time_avg_hours REAL DEFAULT 0,
      member_response_rate REAL DEFAULT 0,
      
      -- Additional metrics as JSON
      custom_metrics TEXT DEFAULT '{}' CHECK (json_valid(custom_metrics)),
      
      -- Metadata
      calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, period_type, period_start)
    );
  `);

  // Real-time alerts configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS performance_alerts (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Alert configuration
      alert_name TEXT NOT NULL,
      alert_type TEXT NOT NULL CHECK (alert_type IN (
        'threshold', 'anomaly', 'trend', 'availability'
      )),
      metric_name TEXT NOT NULL,
      metric_category TEXT NOT NULL,
      
      -- Threshold configuration
      threshold_value REAL,
      threshold_operator TEXT CHECK (threshold_operator IN ('>', '<', '>=', '<=', '=')),
      threshold_duration_minutes INTEGER DEFAULT 5, -- Alert after X minutes above threshold
      
      -- Alert settings
      is_active INTEGER DEFAULT 1,
      severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      notification_channels TEXT DEFAULT '["email"]' CHECK (json_valid(notification_channels)),
      
      -- Recipients
      notify_roles TEXT DEFAULT '["admin", "board"]' CHECK (json_valid(notify_roles)),
      notify_emails TEXT DEFAULT '[]' CHECK (json_valid(notify_emails)),
      
      -- Suppression settings
      suppress_duration_minutes INTEGER DEFAULT 60, -- Don't repeat alert for X minutes
      max_alerts_per_day INTEGER DEFAULT 10,
      
      -- Alert history tracking
      last_triggered_at TEXT,
      trigger_count_today INTEGER DEFAULT 0,
      total_trigger_count INTEGER DEFAULT 0,
      
      -- Metadata
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, alert_name)
    );
  `);

  // Alert history log
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      alert_id TEXT NOT NULL REFERENCES performance_alerts(id) ON DELETE CASCADE,
      
      -- Alert event details
      event_type TEXT NOT NULL CHECK (event_type IN ('triggered', 'resolved', 'suppressed')),
      metric_value REAL NOT NULL,
      threshold_value REAL,
      
      -- Context
      metric_name TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      
      -- Notification tracking
      notifications_sent TEXT DEFAULT '[]' CHECK (json_valid(notifications_sent)),
      notification_status TEXT DEFAULT 'pending' CHECK (notification_status IN (
        'pending', 'sent', 'failed', 'suppressed'
      )),
      
      -- Resolution tracking
      resolved_at TEXT,
      resolved_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      resolution_notes TEXT,
      
      -- Metadata
      triggered_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Performance monitoring sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS monitoring_sessions (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Session details
      session_name TEXT NOT NULL,
      session_type TEXT NOT NULL CHECK (session_type IN (
        'load_test', 'stress_test', 'monitoring', 'benchmark'
      )),
      description TEXT,
      
      -- Configuration
      duration_minutes INTEGER NOT NULL,
      metrics_collected TEXT DEFAULT '[]' CHECK (json_valid(metrics_collected)),
      sampling_interval_seconds INTEGER DEFAULT 60,
      
      -- Status
      status TEXT DEFAULT 'planned' CHECK (status IN (
        'planned', 'running', 'completed', 'failed', 'cancelled'
      )),
      
      -- Results summary
      total_requests INTEGER DEFAULT 0,
      success_rate REAL DEFAULT 0,
      average_response_time_ms REAL DEFAULT 0,
      p95_response_time_ms REAL DEFAULT 0,
      error_rate REAL DEFAULT 0,
      
      -- Performance baselines
      baseline_cpu_percent REAL,
      baseline_memory_mb REAL,
      baseline_response_time_ms REAL,
      
      -- Timestamps
      started_at TEXT,
      completed_at TEXT,
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('✅ Performance monitoring schema created successfully');
};

export const createPerformanceIndexes = (db: Database.Database): void => {
  console.log('Creating performance monitoring indexes...');

  // Performance metrics indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_performance_metrics_cooperative ON performance_metrics(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_performance_metrics_category ON performance_metrics(metric_category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded ON performance_metrics(recorded_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_performance_metrics_lookup ON performance_metrics(cooperative_id, metric_category, metric_name, recorded_at);`);

  // Query performance indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_cooperative ON query_performance(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_hash ON query_performance(query_hash);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_table ON query_performance(table_name);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_slow ON query_performance(is_slow_query, execution_time_ms);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_executed ON query_performance(executed_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_lookup ON query_performance(cooperative_id, table_name, executed_at);`);

  // API performance indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_performance_cooperative ON api_performance(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_performance_endpoint ON api_performance(endpoint);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_performance_status ON api_performance(status_code);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_performance_response_time ON api_performance(response_time_ms);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_performance_started ON api_performance(started_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_performance_user ON api_performance(user_id);`);

  // BRF business metrics indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_brf_metrics_cooperative ON brf_business_metrics(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_brf_metrics_period ON brf_business_metrics(period_type, period_start);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_brf_metrics_lookup ON brf_business_metrics(cooperative_id, period_type, period_start);`);

  // Performance alerts indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_performance_alerts_cooperative ON performance_alerts(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_performance_alerts_active ON performance_alerts(is_active);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_performance_alerts_metric ON performance_alerts(metric_name, metric_category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_performance_alerts_triggered ON performance_alerts(last_triggered_at);`);

  // Alert history indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alert_history_cooperative ON alert_history(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alert_history_alert ON alert_history(alert_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON alert_history(triggered_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(notification_status);`);

  // Monitoring sessions indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_monitoring_sessions_cooperative ON monitoring_sessions(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_monitoring_sessions_status ON monitoring_sessions(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_monitoring_sessions_type ON monitoring_sessions(session_type);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_monitoring_sessions_started ON monitoring_sessions(started_at);`);

  console.log('✅ Performance monitoring indexes created successfully');
};

export const createPerformanceTriggers = (db: Database.Database): void => {
  console.log('Creating performance monitoring triggers...');

  // Auto-mark slow queries
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS mark_slow_queries
    AFTER INSERT ON query_performance
    FOR EACH ROW
    WHEN NEW.execution_time_ms > 1000 -- 1 second threshold
    BEGIN
      UPDATE query_performance 
      SET is_slow_query = 1 
      WHERE id = NEW.id;
    END;
  `);

  // Update alert trigger counts
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_alert_counts
    AFTER INSERT ON alert_history
    FOR EACH ROW
    WHEN NEW.event_type = 'triggered'
    BEGIN
      UPDATE performance_alerts 
      SET 
        last_triggered_at = NEW.triggered_at,
        total_trigger_count = total_trigger_count + 1,
        trigger_count_today = CASE 
          WHEN date(last_triggered_at) = date('now') 
          THEN trigger_count_today + 1 
          ELSE 1 
        END
      WHERE id = NEW.alert_id;
    END;
  `);

  // Clean up old performance data (retention policy)
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS cleanup_old_performance_data
    AFTER INSERT ON performance_metrics
    FOR EACH ROW
    BEGIN
      -- Delete metrics older than 90 days
      DELETE FROM performance_metrics 
      WHERE recorded_at < datetime('now', '-90 days');
      
      -- Delete query performance older than 30 days (keep slow queries longer)
      DELETE FROM query_performance 
      WHERE executed_at < datetime('now', '-30 days') 
        AND is_slow_query = 0;
      
      -- Delete slow queries older than 180 days
      DELETE FROM query_performance 
      WHERE executed_at < datetime('now', '-180 days');
      
      -- Delete API performance older than 60 days
      DELETE FROM api_performance 
      WHERE started_at < datetime('now', '-60 days');
    END;
  `);

  console.log('✅ Performance monitoring triggers created successfully');
};

export const dropPerformanceSchema = (db: Database.Database): void => {
  console.log('Dropping performance monitoring schema...');

  const tables = [
    'monitoring_sessions',
    'alert_history',
    'performance_alerts',
    'brf_business_metrics',
    'api_performance',
    'query_performance',
    'performance_metrics'
  ];

  tables.forEach(table => {
    db.exec(`DROP TABLE IF EXISTS ${table};`);
  });

  console.log('✅ Performance monitoring schema dropped successfully');
};