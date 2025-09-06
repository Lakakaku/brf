import Database from 'better-sqlite3';

/**
 * Migration 005: Add mock configurations table
 * Adds support for persistent API mock configurations
 */

export function up(db: Database.Database): void {
  console.log('Running migration 005: Add mock configurations table');

  // Mock configurations table - For storing persistent API mock configurations
  db.exec(`
    CREATE TABLE IF NOT EXISTS mock_configurations (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Configuration identification
      name TEXT NOT NULL, -- Human readable name
      description TEXT,
      
      -- Mock target specification
      service TEXT NOT NULL, -- bankid, fortnox, kivra, swedish_banks, etc.
      endpoint TEXT NOT NULL, -- API endpoint path
      method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
      scenario TEXT NOT NULL, -- Scenario name (success, failure, timeout, etc.)
      
      -- Response configuration
      delay_ms INTEGER DEFAULT 0 CHECK (delay_ms >= 0 AND delay_ms <= 30000), -- Response delay in milliseconds
      response_status INTEGER DEFAULT 200 CHECK (response_status >= 100 AND response_status <= 599),
      response_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(response_data)), -- JSON response payload
      headers TEXT DEFAULT '{}' CHECK (json_valid(headers)), -- Custom response headers
      
      -- Status and environment
      is_enabled INTEGER DEFAULT 1, -- Boolean: is this mock active
      environment TEXT DEFAULT 'development' CHECK (environment IN ('development', 'staging', 'production', 'test')),
      
      -- Categorization and search
      tags TEXT DEFAULT '[]' CHECK (json_valid(tags)), -- JSON array of tags for categorization
      
      -- Usage tracking
      usage_count INTEGER DEFAULT 0, -- Number of times this mock has been used
      last_used_at TEXT, -- Last time this mock was triggered
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      deleted_at TEXT,
      
      -- Ensure unique mock configurations per service/endpoint/method/scenario
      UNIQUE(cooperative_id, service, endpoint, method, scenario, environment)
    );
  `);

  // Mock usage history table - For tracking mock invocations
  db.exec(`
    CREATE TABLE IF NOT EXISTS mock_usage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      mock_configuration_id TEXT REFERENCES mock_configurations(id) ON DELETE SET NULL,
      
      -- Request details
      service TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      scenario TEXT NOT NULL,
      
      -- Request context
      request_data TEXT DEFAULT '{}' CHECK (json_valid(request_data)), -- Request payload/params
      request_headers TEXT DEFAULT '{}' CHECK (json_valid(request_headers)),
      user_agent TEXT,
      ip_address TEXT,
      
      -- Response details
      response_status INTEGER NOT NULL,
      response_data TEXT NOT NULL CHECK (json_valid(response_data)),
      response_headers TEXT DEFAULT '{}' CHECK (json_valid(response_headers)),
      response_time_ms INTEGER, -- Actual response time including delay
      
      -- Processing details
      delay_applied_ms INTEGER DEFAULT 0,
      is_from_database INTEGER DEFAULT 1, -- Boolean: was this from database config or in-memory
      
      -- Context and correlation
      correlation_id TEXT, -- For tracing related requests
      session_id TEXT,
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Mock templates table - For reusable mock response templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS mock_templates (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE, -- NULL for global templates
      
      -- Template identification
      name TEXT NOT NULL,
      description TEXT,
      service TEXT NOT NULL,
      category TEXT DEFAULT 'general' CHECK (category IN ('general', 'success', 'error', 'timeout', 'validation', 'authentication')),
      
      -- Template content
      response_template TEXT NOT NULL CHECK (json_valid(response_template)), -- JSON template with variables
      headers_template TEXT DEFAULT '{}' CHECK (json_valid(headers_template)),
      status_code INTEGER DEFAULT 200 CHECK (status_code >= 100 AND status_code <= 599),
      
      -- Template variables and schema
      variables TEXT DEFAULT '[]' CHECK (json_valid(variables)), -- Available template variables
      schema TEXT CHECK (json_valid(schema)), -- JSON schema for validation
      
      -- Template metadata
      tags TEXT DEFAULT '[]' CHECK (json_valid(tags)),
      
      -- Usage tracking
      usage_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      
      -- Status
      is_active INTEGER DEFAULT 1,
      is_system_template INTEGER DEFAULT 0, -- Boolean for system-provided templates
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      UNIQUE(cooperative_id, name, service)
    );
  `);

  // Mock scenarios table - For predefined scenario configurations
  db.exec(`
    CREATE TABLE IF NOT EXISTS mock_scenarios (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE, -- NULL for global scenarios
      
      -- Scenario identification
      name TEXT NOT NULL,
      display_name TEXT NOT NULL, -- Human-readable name
      description TEXT,
      service TEXT NOT NULL,
      
      -- Scenario configuration
      default_status_code INTEGER DEFAULT 200,
      default_delay_ms INTEGER DEFAULT 0,
      default_response_template TEXT DEFAULT '{}' CHECK (json_valid(default_response_template)),
      default_headers TEXT DEFAULT '{}' CHECK (json_valid(default_headers)),
      
      -- Scenario metadata
      category TEXT DEFAULT 'general',
      tags TEXT DEFAULT '[]' CHECK (json_valid(tags)),
      difficulty_level TEXT DEFAULT 'normal' CHECK (difficulty_level IN ('easy', 'normal', 'hard', 'expert')),
      use_cases TEXT DEFAULT '[]' CHECK (json_valid(use_cases)), -- JSON array of use case descriptions
      
      -- Documentation
      documentation_url TEXT,
      examples TEXT DEFAULT '[]' CHECK (json_valid(examples)), -- JSON array of example requests/responses
      
      -- Status
      is_active INTEGER DEFAULT 1,
      is_system_scenario INTEGER DEFAULT 0, -- Boolean for system-provided scenarios
      
      -- Usage tracking
      usage_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      UNIQUE(cooperative_id, service, name)
    );
  `);

  console.log('✅ Migration 005 completed: Mock configurations tables created');
}

export function down(db: Database.Database): void {
  console.log('Rolling back migration 005: Remove mock configurations tables');
  
  db.exec('DROP TABLE IF EXISTS mock_scenarios;');
  db.exec('DROP TABLE IF EXISTS mock_templates;');
  db.exec('DROP TABLE IF EXISTS mock_usage_history;');
  db.exec('DROP TABLE IF EXISTS mock_configurations;');
  
  console.log('✅ Migration 005 rollback completed');
}