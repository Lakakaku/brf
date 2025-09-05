import Database from 'better-sqlite3';

/**
 * SQLite schema creation script for BRF Portal
 * Adapted from PostgreSQL schema to SQLite syntax
 */

export const createSchema = (db: Database.Database): void => {
  // Enable foreign key constraints
  db.pragma('foreign_keys = ON');

  // Create migrations table first
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Cooperatives table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cooperatives (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      org_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      subdomain TEXT UNIQUE NOT NULL,
      
      -- Address
      street_address TEXT,
      postal_code TEXT,
      city TEXT,
      
      -- Configuration (stored as JSON text)
      settings TEXT DEFAULT '{}' CHECK (json_valid(settings)),
      features TEXT DEFAULT '{"standard": true}' CHECK (json_valid(features)),
      
      -- Subscription
      subscription_tier TEXT DEFAULT 'standard',
      subscription_status TEXT DEFAULT 'active',
      trial_ends_at TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);

  // Members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      user_id TEXT, -- Optional for SQLite (no Supabase auth)
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Authentication
      email TEXT NOT NULL,
      password_hash TEXT,
      
      -- Personal information
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      
      -- Role and permissions
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'board', 'chairman', 'treasurer', 'admin')),
      permissions TEXT DEFAULT '{}' CHECK (json_valid(permissions)),
      
      -- Status
      is_active INTEGER DEFAULT 1,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT,
      deleted_at TEXT,
      
      UNIQUE(email, cooperative_id)
    );
  `);

  // Apartments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS apartments (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Identification
      apartment_number TEXT NOT NULL,
      share_number TEXT,
      
      -- Physical attributes
      size_sqm REAL,
      rooms REAL,
      floor INTEGER,
      building TEXT,
      
      -- Financial
      monthly_fee REAL,
      share_capital REAL,
      
      -- Current ownership
      owner_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      ownership_date TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, apartment_number)
    );
  `);

  // Documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Document info
      filename TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      file_path TEXT NOT NULL, -- Local file path instead of S3 key
      
      -- Classification
      document_type TEXT, -- invoice, protocol, contract, etc
      category TEXT,
      tags TEXT DEFAULT '[]' CHECK (json_valid(tags)), -- JSON array as text
      
      -- Processing status
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      processed_at TEXT,
      processing_error TEXT,
      
      -- Extracted data
      extracted_data TEXT CHECK (json_valid(extracted_data)),
      ocr_text TEXT,
      confidence_score REAL,
      
      -- Relations
      uploaded_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      related_case_id TEXT,
      related_invoice_id TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);

  // Invoices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Invoice details
      invoice_number TEXT,
      supplier_name TEXT,
      supplier_org_number TEXT,
      
      -- Amounts
      amount_excl_vat REAL,
      vat_amount REAL,
      total_amount REAL NOT NULL,
      currency TEXT DEFAULT 'SEK',
      
      -- Dates
      invoice_date TEXT,
      due_date TEXT,
      payment_date TEXT,
      
      -- Payment info
      payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
      ocr_number TEXT,
      bankgiro TEXT,
      plusgiro TEXT,
      
      -- Accounting
      account_code TEXT,
      cost_center TEXT,
      project_code TEXT,
      
      -- Relations
      document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      approved_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      case_id TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Monthly fees table
  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_fees (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      apartment_id TEXT REFERENCES apartments(id) ON DELETE SET NULL,
      
      -- Period
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      
      -- Amounts
      base_fee REAL,
      parking_fee REAL,
      storage_fee REAL,
      other_fees TEXT DEFAULT '{}' CHECK (json_valid(other_fees)),
      total_amount REAL NOT NULL,
      
      -- Payment
      payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
      paid_date TEXT,
      payment_method TEXT, -- autogiro, invoice, swish
      
      -- References
      ocr_number TEXT UNIQUE,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(apartment_id, year, month)
    );
  `);

  // Cases table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Case details
      case_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      
      -- Priority and status
      priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
      status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
      
      -- Location
      location TEXT, -- apartment, laundry, garage, etc
      apartment_id TEXT REFERENCES apartments(id) ON DELETE SET NULL,
      
      -- People involved
      reported_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      assigned_to TEXT REFERENCES members(id) ON DELETE SET NULL,
      contractor_id TEXT,
      
      -- Timeline
      reported_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      resolved_at TEXT,
      closed_at TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, case_number)
    );
  `);

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Recipient
      member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Content
      type TEXT, -- payment_reminder, case_update, announcement
      title TEXT,
      message TEXT,
      data TEXT CHECK (json_valid(data)),
      
      -- Delivery
      channels TEXT DEFAULT '[]' CHECK (json_valid(channels)), -- email, sms, push, in_app
      is_read INTEGER DEFAULT 0,
      read_at TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Audit log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT NOT NULL,
      
      -- Actor
      user_id TEXT,
      user_role TEXT,
      ip_address TEXT,
      user_agent TEXT,
      
      -- Action
      action TEXT, -- create, update, delete, approve, etc
      entity_type TEXT, -- invoice, member, document, etc
      entity_id TEXT,
      
      -- Changes
      old_values TEXT CHECK (json_valid(old_values)),
      new_values TEXT CHECK (json_valid(new_values)),
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('✅ Database schema created successfully');
};

export const createIndexes = (db: Database.Database): void => {
  console.log('Creating database indexes...');

  // Cooperatives indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cooperatives_subdomain ON cooperatives(subdomain);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cooperatives_org_number ON cooperatives(org_number);`
  );

  // Members indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_members_cooperative ON members(cooperative_id);`
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_members_active ON members(cooperative_id, is_active) WHERE deleted_at IS NULL;`
  );

  // Apartments indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_apartments_cooperative ON apartments(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_apartments_owner ON apartments(owner_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_apartments_number ON apartments(cooperative_id, apartment_number);`
  );

  // Documents indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_documents_cooperative ON documents(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);`
  );

  // Invoices indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_invoices_cooperative ON invoices(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_invoices_document ON invoices(document_id);`
  );

  // Monthly fees indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_monthly_fees_cooperative ON monthly_fees(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_monthly_fees_apartment ON monthly_fees(apartment_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_monthly_fees_period ON monthly_fees(year, month);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_monthly_fees_status ON monthly_fees(payment_status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_monthly_fees_lookup ON monthly_fees(cooperative_id, year, month, payment_status);`
  );

  // Cases indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cases_cooperative ON cases(cooperative_id);`
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority);`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cases_reported_by ON cases(reported_by);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cases_apartment ON cases(apartment_id);`
  );

  // Notifications indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_notifications_member ON notifications(member_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(member_id, is_read) WHERE is_read = 0;`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);`
  );

  // Audit log indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_audit_cooperative ON audit_log(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);`
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);`
  );

  console.log('✅ Database indexes created successfully');
};

export const createTriggers = (db: Database.Database): void => {
  console.log('Creating database triggers...');

  // Updated timestamp triggers for all tables
  const tablesWithUpdatedAt = [
    'cooperatives',
    'members',
    'apartments',
    'documents',
    'invoices',
    'monthly_fees',
    'cases',
  ];

  tablesWithUpdatedAt.forEach(table => {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_${table}_updated_at
      AFTER UPDATE ON ${table}
      FOR EACH ROW
      BEGIN
        UPDATE ${table} SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  });

  // Auto-increment case_number trigger
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS auto_increment_case_number
    AFTER INSERT ON cases
    FOR EACH ROW
    WHEN NEW.case_number IS NULL
    BEGIN
      UPDATE cases 
      SET case_number = (
        SELECT COALESCE(MAX(case_number), 0) + 1 
        FROM cases 
        WHERE cooperative_id = NEW.cooperative_id
      )
      WHERE id = NEW.id;
    END;
  `);

  // Audit log triggers for important tables
  const auditTables = ['invoices', 'members', 'apartments', 'cases'];
  const tablesWithSoftDelete = ['invoices', 'members', 'apartments']; // Tables that have deleted_at column

  auditTables.forEach(table => {
    // INSERT audit
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS audit_${table}_insert
      AFTER INSERT ON ${table}
      FOR EACH ROW
      BEGIN
        INSERT INTO audit_log (
          cooperative_id, action, entity_type, entity_id, new_values
        ) VALUES (
          NEW.cooperative_id, 'create', '${table}', NEW.id, 
          json_object(${getTableColumns(table)
            .map(col => `'${col}', NEW.${col}`)
            .join(', ')})
        );
      END;
    `);

    // UPDATE audit
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS audit_${table}_update
      AFTER UPDATE ON ${table}
      FOR EACH ROW
      BEGIN
        INSERT INTO audit_log (
          cooperative_id, action, entity_type, entity_id, old_values, new_values
        ) VALUES (
          NEW.cooperative_id, 'update', '${table}', NEW.id,
          json_object(${getTableColumns(table)
            .map(col => `'${col}', OLD.${col}`)
            .join(', ')}),
          json_object(${getTableColumns(table)
            .map(col => `'${col}', NEW.${col}`)
            .join(', ')})
        );
      END;
    `);

    // DELETE audit (soft delete) - only for tables with deleted_at column
    if (tablesWithSoftDelete.includes(table)) {
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS audit_${table}_delete
        AFTER UPDATE ON ${table}
        FOR EACH ROW
        WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
        BEGIN
          INSERT INTO audit_log (
            cooperative_id, action, entity_type, entity_id, old_values
          ) VALUES (
            NEW.cooperative_id, 'delete', '${table}', NEW.id,
            json_object(${getTableColumns(table)
              .map(col => `'${col}', OLD.${col}`)
              .join(', ')})
          );
        END;
      `);
    }
  });

  console.log('✅ Database triggers created successfully');
};

// Helper function to get table columns for audit triggers
function getTableColumns(table: string): string[] {
  const commonColumns = ['id', 'cooperative_id', 'created_at', 'updated_at'];

  const tableSpecificColumns: { [key: string]: string[] } = {
    invoices: [
      ...commonColumns,
      'invoice_number',
      'supplier_name',
      'total_amount',
      'payment_status',
    ],
    members: [
      ...commonColumns,
      'email',
      'first_name',
      'last_name',
      'role',
      'is_active',
    ],
    apartments: [
      ...commonColumns,
      'apartment_number',
      'owner_id',
      'monthly_fee',
    ],
    cases: [
      ...commonColumns,
      'case_number',
      'title',
      'status',
      'priority',
      'reported_by',
    ],
  };

  return tableSpecificColumns[table] || commonColumns;
}

export const dropSchema = (db: Database.Database): void => {
  console.log('Dropping database schema...');

  const tables = [
    'audit_log',
    'notifications',
    'cases',
    'monthly_fees',
    'invoices',
    'documents',
    'apartments',
    'members',
    'cooperatives',
    'migrations',
  ];

  tables.forEach(table => {
    db.exec(`DROP TABLE IF EXISTS ${table};`);
  });

  console.log('✅ Database schema dropped successfully');
};
