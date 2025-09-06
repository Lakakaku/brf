/**
 * Database Query Inspector Schema
 * 
 * This module defines the database schema for query logging, performance tracking,
 * and analysis specifically designed for Swedish BRF cooperative housing systems.
 * 
 * Features:
 * - Query execution logging with performance metrics
 * - Multi-tenant data isolation verification
 * - GDPR compliance checking for data access patterns
 * - Swedish BRF-specific query categorization
 * - Query optimization recommendations
 */

import Database from 'better-sqlite3';

/**
 * Create query inspector tables and indexes
 */
export function createQueryInspectorSchema(db: Database.Database): void {
  console.log('Creating query inspector schema...');

  // Query execution log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_execution_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT, -- NULL for system-wide queries
      
      -- Query identification
      query_hash TEXT NOT NULL, -- SHA-256 hash of the normalized query
      query_text TEXT NOT NULL, -- Original SQL query text
      query_normalized TEXT, -- Normalized query for pattern analysis
      query_type TEXT NOT NULL CHECK (query_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRANSACTION')),
      
      -- Execution context
      user_id TEXT,
      user_role TEXT,
      session_id TEXT,
      request_ip TEXT,
      user_agent TEXT,
      
      -- Performance metrics
      execution_time_ms REAL NOT NULL,
      rows_affected INTEGER DEFAULT 0,
      rows_examined INTEGER DEFAULT 0,
      memory_used_kb REAL DEFAULT 0,
      cpu_time_ms REAL DEFAULT 0,
      
      -- Query analysis
      table_names TEXT DEFAULT '[]' CHECK (json_valid(table_names)), -- JSON array of involved tables
      index_usage TEXT DEFAULT '{}' CHECK (json_valid(index_usage)), -- JSON object of index usage stats
      join_complexity INTEGER DEFAULT 0, -- Number of joins in the query
      where_conditions TEXT DEFAULT '[]' CHECK (json_valid(where_conditions)), -- JSON array of WHERE conditions
      
      -- BRF-specific categorization
      brf_category TEXT CHECK (brf_category IN (
        'member_management', 'apartment_operations', 'financial_operations', 
        'document_management', 'case_management', 'energy_monitoring',
        'contractor_evaluation', 'booking_system', 'queue_management',
        'board_governance', 'audit_compliance', 'system_administration'
      )),
      
      -- Data access patterns
      data_sensitivity_level TEXT DEFAULT 'public' CHECK (data_sensitivity_level IN ('public', 'internal', 'confidential', 'personal')),
      gdpr_relevant INTEGER DEFAULT 0, -- Boolean: contains personal data
      pii_fields_accessed TEXT DEFAULT '[]' CHECK (json_valid(pii_fields_accessed)), -- JSON array of PII fields accessed
      
      -- Multi-tenant isolation verification
      cooperative_isolation_verified INTEGER DEFAULT 0, -- Boolean: confirmed proper isolation
      isolation_bypass_risk INTEGER DEFAULT 0, -- Boolean: potential isolation bypass detected
      cross_tenant_check_passed INTEGER DEFAULT 1, -- Boolean: cross-tenant access validation passed
      
      -- Error and warnings
      execution_status TEXT DEFAULT 'success' CHECK (execution_status IN ('success', 'error', 'timeout', 'cancelled')),
      error_message TEXT,
      warning_flags TEXT DEFAULT '[]' CHECK (json_valid(warning_flags)), -- JSON array of warning types
      
      -- Swedish regulatory compliance
      k2_k3_compliance INTEGER DEFAULT 1, -- Boolean: complies with K2/K3 accounting standards
      financial_audit_relevant INTEGER DEFAULT 0, -- Boolean: query affects financial audit trail
      board_governance_relevant INTEGER DEFAULT 0, -- Boolean: affects board governance records
      
      -- Query optimization
      optimization_score INTEGER DEFAULT 50 CHECK (optimization_score BETWEEN 0 AND 100), -- Performance score (0-100)
      needs_optimization INTEGER DEFAULT 0, -- Boolean: query needs performance optimization
      recommended_indexes TEXT DEFAULT '[]' CHECK (json_valid(recommended_indexes)), -- JSON array of recommended indexes
      optimization_suggestions TEXT DEFAULT '[]' CHECK (json_valid(optimization_suggestions)), -- JSON array of optimization suggestions
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      retention_until TEXT -- When this log entry can be purged for GDPR compliance
    );
  `);

  // Query patterns table - for analyzing common query patterns
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_patterns (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      
      -- Pattern identification
      pattern_hash TEXT UNIQUE NOT NULL, -- SHA-256 of the normalized pattern
      pattern_template TEXT NOT NULL, -- Parameterized query template
      pattern_description TEXT,
      pattern_category TEXT,
      
      -- Usage statistics
      execution_count INTEGER DEFAULT 0,
      total_execution_time_ms REAL DEFAULT 0,
      avg_execution_time_ms REAL DEFAULT 0,
      min_execution_time_ms REAL DEFAULT 0,
      max_execution_time_ms REAL DEFAULT 0,
      
      -- Performance characteristics
      performance_rating TEXT DEFAULT 'unknown' CHECK (performance_rating IN ('excellent', 'good', 'fair', 'poor', 'critical', 'unknown')),
      scalability_concern INTEGER DEFAULT 0, -- Boolean: has scalability issues
      resource_intensive INTEGER DEFAULT 0, -- Boolean: uses significant resources
      
      -- BRF-specific analysis
      brf_impact_level TEXT DEFAULT 'low' CHECK (brf_impact_level IN ('low', 'medium', 'high', 'critical')),
      affects_member_data INTEGER DEFAULT 0, -- Boolean: accesses member personal data
      affects_financial_data INTEGER DEFAULT 0, -- Boolean: accesses financial records
      affects_governance INTEGER DEFAULT 0, -- Boolean: affects board governance
      
      -- Optimization recommendations
      optimization_priority TEXT DEFAULT 'low' CHECK (optimization_priority IN ('low', 'medium', 'high', 'critical')),
      recommended_actions TEXT DEFAULT '[]' CHECK (json_valid(recommended_actions)), -- JSON array of recommended actions
      
      -- Pattern discovery
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Query performance alerts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_performance_alerts (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT, -- NULL for system-wide alerts
      
      -- Alert details
      alert_type TEXT NOT NULL CHECK (alert_type IN (
        'slow_query', 'high_memory_usage', 'excessive_rows_examined', 
        'missing_index', 'table_scan', 'isolation_bypass', 'gdpr_violation',
        'optimization_opportunity', 'unusual_pattern', 'resource_exhaustion'
      )),
      severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      
      -- Related query information
      query_hash TEXT,
      pattern_hash TEXT,
      query_execution_log_id INTEGER REFERENCES query_execution_log(id),
      
      -- Alert context
      threshold_exceeded REAL, -- The value that exceeded the threshold
      threshold_limit REAL, -- The defined threshold limit
      impact_assessment TEXT, -- Assessment of the impact
      
      -- BRF-specific context
      affects_compliance INTEGER DEFAULT 0, -- Boolean: affects regulatory compliance
      affects_member_experience INTEGER DEFAULT 0, -- Boolean: impacts member experience
      financial_implications INTEGER DEFAULT 0, -- Boolean: has financial implications
      
      -- Alert lifecycle
      status TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'false_positive')),
      acknowledged_by TEXT,
      acknowledged_at TEXT,
      resolved_by TEXT,
      resolved_at TEXT,
      resolution_notes TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Database schema analysis table - for tracking schema changes and performance impact
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_analysis (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      
      -- Schema information
      table_name TEXT NOT NULL,
      column_name TEXT,
      index_name TEXT,
      constraint_name TEXT,
      
      -- Analysis type
      analysis_type TEXT NOT NULL CHECK (analysis_type IN (
        'table_scan', 'index_usage', 'constraint_validation', 'column_statistics',
        'fragmentation_analysis', 'growth_trend', 'performance_impact'
      )),
      
      -- Metrics
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      metric_unit TEXT, -- e.g., 'ms', 'bytes', 'rows', 'percentage'
      baseline_value REAL, -- Previous or expected value for comparison
      
      -- BRF-specific context
      business_impact TEXT CHECK (business_impact IN ('none', 'low', 'medium', 'high', 'critical')),
      regulatory_relevance INTEGER DEFAULT 0, -- Boolean: relevant for compliance
      member_facing_impact INTEGER DEFAULT 0, -- Boolean: impacts member-facing operations
      
      -- Recommendations
      optimization_needed INTEGER DEFAULT 0, -- Boolean: optimization recommended
      recommended_action TEXT,
      estimated_improvement_pct REAL, -- Expected improvement percentage
      
      -- Metadata
      analysis_date TEXT NOT NULL DEFAULT (datetime('now')),
      retention_until TEXT
    );
  `);

  // Multi-tenant isolation audit table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_isolation_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      
      -- Audit context
      audit_type TEXT NOT NULL CHECK (audit_type IN (
        'query_isolation_check', 'data_leak_detection', 'cross_tenant_access',
        'privilege_escalation', 'rls_bypass_attempt', 'suspicious_pattern'
      )),
      cooperative_id TEXT NOT NULL,
      user_id TEXT,
      
      -- Query details
      query_hash TEXT,
      query_text TEXT,
      tables_accessed TEXT DEFAULT '[]' CHECK (json_valid(tables_accessed)), -- JSON array
      
      -- Isolation verification
      isolation_status TEXT NOT NULL CHECK (isolation_status IN ('verified', 'suspicious', 'violation', 'error')),
      cooperative_filter_applied INTEGER DEFAULT 0, -- Boolean: cooperative_id filter was applied
      rls_checks_passed INTEGER DEFAULT 0, -- Boolean: all RLS checks passed
      cross_tenant_data_detected INTEGER DEFAULT 0, -- Boolean: detected access to other tenant data
      
      -- Risk assessment
      risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
      violation_type TEXT, -- Type of isolation violation if detected
      potential_impact TEXT, -- Description of potential impact
      
      -- Swedish BRF context
      affects_member_privacy INTEGER DEFAULT 0, -- Boolean: affects member privacy
      gdpr_violation_potential INTEGER DEFAULT 0, -- Boolean: potential GDPR violation
      financial_data_exposure INTEGER DEFAULT 0, -- Boolean: potential financial data exposure
      board_data_exposure INTEGER DEFAULT 0, -- Boolean: potential board governance data exposure
      
      -- Response and mitigation
      automated_response_taken INTEGER DEFAULT 0, -- Boolean: automated response executed
      response_actions TEXT DEFAULT '[]' CHECK (json_valid(response_actions)), -- JSON array
      manual_review_required INTEGER DEFAULT 0, -- Boolean: requires manual review
      
      -- Metadata
      detected_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      reviewed_by TEXT,
      resolution_status TEXT DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'false_positive', 'investigating'))
    );
  `);

  // GDPR data access log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS gdpr_data_access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT NOT NULL,
      
      -- Access details
      data_subject_id TEXT, -- ID of the person whose data was accessed (member_id or external person)
      data_category TEXT NOT NULL CHECK (data_category IN (
        'personal_identification', 'contact_information', 'financial_records',
        'housing_details', 'communication_history', 'service_usage', 'preferences',
        'biometric_data', 'health_information', 'special_categories'
      )),
      
      -- Access context
      user_id TEXT, -- Who accessed the data
      user_role TEXT,
      access_purpose TEXT NOT NULL CHECK (access_purpose IN (
        'service_provision', 'contract_fulfillment', 'legal_obligation',
        'legitimate_interest', 'consent', 'vital_interest', 'public_task'
      )),
      legal_basis TEXT NOT NULL CHECK (legal_basis IN (
        'consent', 'contract', 'legal_obligation', 'vital_interests', 
        'public_task', 'legitimate_interests'
      )),
      
      -- Technical details
      query_hash TEXT,
      pii_fields_accessed TEXT DEFAULT '[]' CHECK (json_valid(pii_fields_accessed)), -- JSON array
      sensitive_data_accessed INTEGER DEFAULT 0, -- Boolean: special category data accessed
      
      -- Swedish specific compliance
      personal_number_accessed INTEGER DEFAULT 0, -- Boolean: personnummer accessed
      financial_data_accessed INTEGER DEFAULT 0, -- Boolean: financial information accessed
      contact_details_accessed INTEGER DEFAULT 0, -- Boolean: contact information accessed
      
      -- Data subject rights tracking
      supports_portability INTEGER DEFAULT 1, -- Boolean: data can be exported
      supports_rectification INTEGER DEFAULT 1, -- Boolean: data can be corrected
      supports_erasure INTEGER DEFAULT 0, -- Boolean: data can be deleted (considering legal obligations)
      
      -- Audit trail
      request_ip TEXT,
      session_id TEXT,
      automated_processing INTEGER DEFAULT 0, -- Boolean: part of automated processing
      retention_period_days INTEGER, -- How long this access should be logged
      
      -- Metadata
      access_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      retention_until TEXT NOT NULL -- When this log entry should be deleted
    );
  `);

  console.log('✅ Query inspector schema created successfully');
}

/**
 * Create indexes for query inspector tables
 */
export function createQueryInspectorIndexes(db: Database.Database): void {
  console.log('Creating query inspector indexes...');

  // Query execution log indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_execution_log_cooperative ON query_execution_log(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_execution_log_hash ON query_execution_log(query_hash);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_execution_log_user ON query_execution_log(user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_execution_log_time ON query_execution_log(created_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_execution_log_performance ON query_execution_log(execution_time_ms);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_execution_log_brf_category ON query_execution_log(brf_category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_execution_log_gdpr ON query_execution_log(gdpr_relevant, data_sensitivity_level);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_execution_log_optimization ON query_execution_log(needs_optimization, optimization_score);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_execution_log_status ON query_execution_log(execution_status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_execution_log_retention ON query_execution_log(retention_until);`);

  // Query patterns indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_patterns_hash ON query_patterns(pattern_hash);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_patterns_category ON query_patterns(pattern_category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_patterns_performance ON query_patterns(performance_rating);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_patterns_priority ON query_patterns(optimization_priority);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_patterns_usage ON query_patterns(execution_count);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_patterns_brf_impact ON query_patterns(brf_impact_level);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_patterns_updated ON query_patterns(last_seen_at);`);

  // Query performance alerts indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_alerts_cooperative ON query_performance_alerts(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_alerts_type ON query_performance_alerts(alert_type);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_alerts_severity ON query_performance_alerts(severity);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_alerts_status ON query_performance_alerts(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_alerts_query ON query_performance_alerts(query_hash);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_alerts_created ON query_performance_alerts(created_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_query_performance_alerts_compliance ON query_performance_alerts(affects_compliance);`);

  // Schema analysis indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_analysis_table ON schema_analysis(table_name);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_analysis_type ON schema_analysis(analysis_type);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_analysis_metric ON schema_analysis(metric_name);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_analysis_impact ON schema_analysis(business_impact);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_analysis_date ON schema_analysis(analysis_date);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_analysis_optimization ON schema_analysis(optimization_needed);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_analysis_retention ON schema_analysis(retention_until);`);

  // Tenant isolation audit indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_cooperative ON tenant_isolation_audit(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_type ON tenant_isolation_audit(audit_type);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_status ON tenant_isolation_audit(isolation_status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_risk ON tenant_isolation_audit(risk_level);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_user ON tenant_isolation_audit(user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_detected ON tenant_isolation_audit(detected_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_resolution ON tenant_isolation_audit(resolution_status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_gdpr ON tenant_isolation_audit(gdpr_violation_potential);`);

  // GDPR data access log indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gdpr_data_access_log_cooperative ON gdpr_data_access_log(cooperative_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gdpr_data_access_log_subject ON gdpr_data_access_log(data_subject_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gdpr_data_access_log_category ON gdpr_data_access_log(data_category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gdpr_data_access_log_user ON gdpr_data_access_log(user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gdpr_data_access_log_purpose ON gdpr_data_access_log(access_purpose);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gdpr_data_access_log_basis ON gdpr_data_access_log(legal_basis);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gdpr_data_access_log_timestamp ON gdpr_data_access_log(access_timestamp);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gdpr_data_access_log_retention ON gdpr_data_access_log(retention_until);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gdpr_data_access_log_sensitive ON gdpr_data_access_log(sensitive_data_accessed);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gdpr_data_access_log_personal_number ON gdpr_data_access_log(personal_number_accessed);`);

  console.log('✅ Query inspector indexes created successfully');
}

/**
 * Create triggers for query inspector tables
 */
export function createQueryInspectorTriggers(db: Database.Database): void {
  console.log('Creating query inspector triggers...');

  // Auto-update pattern statistics when new query execution is logged
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_query_pattern_stats
    AFTER INSERT ON query_execution_log
    FOR EACH ROW
    WHEN NEW.query_hash IS NOT NULL
    BEGIN
      INSERT OR REPLACE INTO query_patterns (
        pattern_hash,
        pattern_template,
        pattern_description,
        execution_count,
        total_execution_time_ms,
        avg_execution_time_ms,
        min_execution_time_ms,
        max_execution_time_ms,
        last_seen_at,
        updated_at
      )
      SELECT 
        NEW.query_hash,
        NEW.query_normalized,
        'Auto-generated pattern from query execution',
        COALESCE((SELECT execution_count FROM query_patterns WHERE pattern_hash = NEW.query_hash), 0) + 1,
        COALESCE((SELECT total_execution_time_ms FROM query_patterns WHERE pattern_hash = NEW.query_hash), 0) + NEW.execution_time_ms,
        (COALESCE((SELECT total_execution_time_ms FROM query_patterns WHERE pattern_hash = NEW.query_hash), 0) + NEW.execution_time_ms) / (COALESCE((SELECT execution_count FROM query_patterns WHERE pattern_hash = NEW.query_hash), 0) + 1),
        MIN(COALESCE((SELECT min_execution_time_ms FROM query_patterns WHERE pattern_hash = NEW.query_hash), NEW.execution_time_ms), NEW.execution_time_ms),
        MAX(COALESCE((SELECT max_execution_time_ms FROM query_patterns WHERE pattern_hash = NEW.query_hash), NEW.execution_time_ms), NEW.execution_time_ms),
        datetime('now'),
        datetime('now');
    END;
  `);

  // Auto-create performance alerts for slow queries
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS create_slow_query_alert
    AFTER INSERT ON query_execution_log
    FOR EACH ROW
    WHEN NEW.execution_time_ms > 1000 -- Queries taking more than 1 second
    BEGIN
      INSERT INTO query_performance_alerts (
        cooperative_id,
        alert_type,
        severity,
        title,
        description,
        query_hash,
        query_execution_log_id,
        threshold_exceeded,
        threshold_limit,
        impact_assessment,
        affects_member_experience
      ) VALUES (
        NEW.cooperative_id,
        'slow_query',
        CASE 
          WHEN NEW.execution_time_ms > 5000 THEN 'critical'
          WHEN NEW.execution_time_ms > 3000 THEN 'error'
          WHEN NEW.execution_time_ms > 2000 THEN 'warning'
          ELSE 'info'
        END,
        'Slow Query Detected',
        'Query execution time exceeded performance threshold: ' || NEW.execution_time_ms || 'ms',
        NEW.query_hash,
        NEW.id,
        NEW.execution_time_ms,
        1000,
        CASE 
          WHEN NEW.brf_category IN ('member_management', 'apartment_operations', 'booking_system') THEN 'High - affects member-facing operations'
          WHEN NEW.brf_category IN ('financial_operations', 'board_governance') THEN 'Medium - affects administrative operations'
          ELSE 'Low - system operations'
        END,
        CASE 
          WHEN NEW.brf_category IN ('member_management', 'apartment_operations', 'booking_system') THEN 1
          ELSE 0
        END
      );
    END;
  `);

  // Auto-update query patterns updated_at timestamp
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_query_patterns_updated_at
    AFTER UPDATE ON query_patterns
    FOR EACH ROW
    BEGIN
      UPDATE query_patterns SET updated_at = datetime('now') WHERE pattern_hash = NEW.pattern_hash;
    END;
  `);

  // Auto-update performance alerts updated_at timestamp
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_query_performance_alerts_updated_at
    AFTER UPDATE ON query_performance_alerts
    FOR EACH ROW
    BEGIN
      UPDATE query_performance_alerts SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `);

  // Auto-set retention dates for GDPR compliance
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS set_gdpr_retention_date
    AFTER INSERT ON gdpr_data_access_log
    FOR EACH ROW
    WHEN NEW.retention_until IS NULL
    BEGIN
      UPDATE gdpr_data_access_log 
      SET retention_until = datetime(NEW.access_timestamp, '+3 years') -- Default 3 year retention for audit purposes
      WHERE id = NEW.id;
    END;
  `);

  console.log('✅ Query inspector triggers created successfully');
}

/**
 * Drop query inspector schema (for cleanup/reset)
 */
export function dropQueryInspectorSchema(db: Database.Database): void {
  console.log('Dropping query inspector schema...');

  const tables = [
    'gdpr_data_access_log',
    'tenant_isolation_audit',
    'schema_analysis',
    'query_performance_alerts',
    'query_patterns',
    'query_execution_log'
  ];

  tables.forEach(table => {
    db.exec(`DROP TABLE IF EXISTS ${table};`);
  });

  console.log('✅ Query inspector schema dropped successfully');
}