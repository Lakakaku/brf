import Database from 'better-sqlite3';
import {
  createErrorLogSchema,
  createErrorLogIndexes,
  createErrorLogTriggers
} from '../monitoring/error-schema.js';
import {
  createFileSizeLimitSchema,
  createFileSizeLimitIndexes,
  createFileSizeLimitTriggers,
  insertDefaultFileSizeLimits
} from './schema-file-size-limits.js';

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
      
      -- Swedish Legal & Regulatory
      registration_date TEXT, -- When the cooperative was legally registered
      board_structure TEXT DEFAULT '{}' CHECK (json_valid(board_structure)), -- Board composition (ordförande, sekreterare, etc.)
      fiscal_year_end TEXT DEFAULT '06-30', -- Fiscal year end date (usually June 30 for BRFs)
      accounting_standard TEXT DEFAULT 'K2' CHECK (accounting_standard IN ('K2', 'K3')), -- K2 or K3 accounting standard
      annual_report_filed TEXT, -- Last annual report filing date
      tax_number TEXT, -- Swedish tax registration number
      
      -- Building & Property
      building_year INTEGER, -- Year building was constructed
      total_apartments INTEGER, -- Number of apartments
      total_area_sqm REAL, -- Total building area in square meters
      property_designation TEXT, -- Swedish property designation (fastighetsbeteckning)
      land_lease INTEGER DEFAULT 0, -- Boolean if building is on leased land (tomträtt)
      
      -- Energy & Environmental
      energy_certificate TEXT CHECK (energy_certificate IN ('A', 'B', 'C', 'D', 'E', 'F', 'G') OR energy_certificate IS NULL), -- Energy performance certificate class (A-G)
      energy_certificate_expires TEXT, -- Certificate expiration date
      district_heating INTEGER DEFAULT 0, -- Boolean for district heating connection
      green_certification TEXT, -- Environmental certification (Miljöbyggnad, etc.)
      
      -- Financial Configuration
      default_interest_rate REAL DEFAULT 8.0, -- Default interest rate for late payments (%)
      payment_reminder_fee REAL DEFAULT 60.0, -- Fee for payment reminders (SEK)
      debt_collection_fee REAL DEFAULT 350.0, -- Fee for debt collection (SEK)
      bank_account_number TEXT, -- Primary bank account
      bankgiro_number TEXT, -- Bankgiro payment number
      plusgiro_number TEXT, -- Plusgiro payment number
      
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

  // Board meetings table - Swedish legal compliance for BRF governance
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_meetings (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Meeting identification
      meeting_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      meeting_type TEXT DEFAULT 'regular' CHECK (meeting_type IN ('regular', 'extraordinary', 'annual', 'constituting')),
      
      -- Schedule
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT,
      actual_start_time TEXT,
      actual_end_time TEXT,
      location TEXT,
      
      -- Legal requirements
      notice_sent_date TEXT, -- Kallelse skickad (required 7+ days before)
      protocol_approved_date TEXT,
      protocol_approved_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      protocol_adjustments TEXT, -- Justeringar
      
      -- Participants
      attendees TEXT DEFAULT '[]' CHECK (json_valid(attendees)), -- JSON array of member IDs
      absentees TEXT DEFAULT '[]' CHECK (json_valid(absentees)),
      quorum_met INTEGER DEFAULT 0, -- Boolean for beslutförhet
      
      -- Documents
      agenda TEXT, -- Dagordning
      protocol_text TEXT, -- Protokoll
      appendices TEXT DEFAULT '[]' CHECK (json_valid(appendices)), -- JSON array of document IDs
      
      -- Status
      status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
      
      -- GDPR compliance
      personal_data_processed INTEGER DEFAULT 0,
      gdpr_notes TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, meeting_number)
    );
  `);

  // Energy consumption table - For energy tracking and optimization
  db.exec(`
    CREATE TABLE IF NOT EXISTS energy_consumption (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Period
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      
      -- Energy types and consumption
      electricity_kwh REAL DEFAULT 0,
      heating_kwh REAL DEFAULT 0,
      hot_water_kwh REAL DEFAULT 0,
      cooling_kwh REAL DEFAULT 0,
      
      -- Costs (SEK)
      electricity_cost REAL DEFAULT 0,
      heating_cost REAL DEFAULT 0,
      hot_water_cost REAL DEFAULT 0,
      cooling_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      
      -- External data
      outdoor_temp_avg REAL, -- Average outdoor temperature
      heating_degree_days REAL, -- Graddagar
      
      -- Efficiency metrics
      kwh_per_sqm REAL, -- kWh per square meter
      cost_per_sqm REAL, -- SEK per square meter
      
      -- Data source and quality
      data_source TEXT DEFAULT 'manual' CHECK (data_source IN ('manual', 'meter_reading', 'api', 'estimated')),
      data_quality TEXT DEFAULT 'good' CHECK (data_quality IN ('excellent', 'good', 'fair', 'poor')),
      reading_date TEXT,
      
      -- Notes and adjustments
      notes TEXT,
      weather_adjusted INTEGER DEFAULT 0, -- Väderkorrigerad
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, year, month)
    );
  `);

  // Contractor ratings table - For contractor evaluation and procurement
  db.exec(`
    CREATE TABLE IF NOT EXISTS contractor_ratings (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Contractor info
      contractor_name TEXT NOT NULL,
      contractor_org_number TEXT,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      
      -- Work category
      category TEXT NOT NULL, -- plumbing, electrical, cleaning, renovation, etc
      subcategory TEXT,
      
      -- Project details
      project_description TEXT NOT NULL,
      work_performed_date TEXT,
      project_value REAL,
      currency TEXT DEFAULT 'SEK',
      
      -- Ratings (1-5 scale)
      quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
      timeliness_rating INTEGER CHECK (timeliness_rating BETWEEN 1 AND 5),
      communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
      price_rating INTEGER CHECK (price_rating BETWEEN 1 AND 5),
      overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
      
      -- Detailed feedback
      positive_feedback TEXT,
      negative_feedback TEXT,
      would_recommend INTEGER DEFAULT 1, -- Boolean
      
      -- Relations
      case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      rated_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Status
      is_approved_contractor INTEGER DEFAULT 0, -- För godkänd leverantör
      blacklisted INTEGER DEFAULT 0,
      blacklist_reason TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Booking resources table - For laundry room and common area bookings
  db.exec(`
    CREATE TABLE IF NOT EXISTS booking_resources (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Resource info
      name TEXT NOT NULL, -- Tvättstuga A, Festlokal, Gästparkering
      resource_type TEXT NOT NULL CHECK (resource_type IN ('laundry', 'party_room', 'guest_parking', 'sauna', 'gym', 'storage', 'other')),
      description TEXT,
      location TEXT,
      capacity INTEGER DEFAULT 1,
      
      -- Booking rules
      max_booking_duration_hours INTEGER DEFAULT 3,
      min_booking_duration_hours INTEGER DEFAULT 1,
      advance_booking_days INTEGER DEFAULT 14, -- Max days in advance
      booking_fee REAL DEFAULT 0,
      deposit_required REAL DEFAULT 0,
      
      -- Availability
      is_active INTEGER DEFAULT 1,
      available_from_time TEXT DEFAULT '06:00', -- Daily availability start
      available_to_time TEXT DEFAULT '22:00',   -- Daily availability end
      available_weekdays TEXT DEFAULT '[1,2,3,4,5,6,7]' CHECK (json_valid(available_weekdays)), -- 1=Monday, 7=Sunday
      
      -- Access control
      key_required INTEGER DEFAULT 0,
      key_location TEXT,
      access_instructions TEXT,
      
      -- Maintenance
      last_maintenance_date TEXT,
      next_maintenance_date TEXT,
      maintenance_notes TEXT,
      out_of_order INTEGER DEFAULT 0,
      out_of_order_reason TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Booking table for resource reservations
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      resource_id TEXT NOT NULL REFERENCES booking_resources(id) ON DELETE CASCADE,
      
      -- Booking details
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      apartment_id TEXT REFERENCES apartments(id) ON DELETE SET NULL,
      
      -- Time slot
      booking_date TEXT NOT NULL, -- YYYY-MM-DD
      start_time TEXT NOT NULL,   -- HH:MM
      end_time TEXT NOT NULL,     -- HH:MM
      duration_hours REAL NOT NULL,
      
      -- Status
      status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
      cancelled_at TEXT,
      cancel_reason TEXT,
      
      -- Payment
      fee_amount REAL DEFAULT 0,
      deposit_amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'waived')),
      payment_method TEXT,
      
      -- Usage notes
      special_requests TEXT,
      usage_notes TEXT,
      damage_reported TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Queue positions table - For apartment waiting queue management
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue_positions (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Queue member info
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      personal_number TEXT, -- Personnummer (GDPR sensitive)
      email TEXT NOT NULL,
      phone TEXT,
      
      -- Address
      current_address TEXT,
      postal_code TEXT,
      city TEXT,
      
      -- Queue details
      queue_number INTEGER NOT NULL,
      registration_date TEXT NOT NULL,
      queue_type TEXT DEFAULT 'general' CHECK (queue_type IN ('general', 'internal', 'emergency', 'senior')),
      
      -- Apartment preferences
      preferred_apartment_types TEXT DEFAULT '[]' CHECK (json_valid(preferred_apartment_types)), -- JSON array: ["1 rum", "2 rum"]
      preferred_floors TEXT DEFAULT '[]' CHECK (json_valid(preferred_floors)),
      min_size_sqm REAL,
      max_rent REAL,
      
      -- Status
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'offered', 'accepted', 'declined', 'removed')),
      inactive_reason TEXT,
      
      -- Activity tracking
      last_contact_date TEXT,
      contact_method TEXT, -- phone, email, letter
      response_required_by TEXT,
      
      -- Offers and history
      offers_received INTEGER DEFAULT 0,
      offers_declined INTEGER DEFAULT 0,
      last_offer_date TEXT,
      last_offer_apartment_id TEXT REFERENCES apartments(id) ON DELETE SET NULL,
      
      -- GDPR compliance
      consent_marketing INTEGER DEFAULT 0,
      consent_data_processing INTEGER DEFAULT 1,
      data_retention_date TEXT, -- When to delete personal data
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, queue_number)
    );
  `);

  // Loans table - For tracking cooperative loans and amortization
  db.exec(`
    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Loan identification
      loan_number TEXT NOT NULL,
      lender_name TEXT NOT NULL, -- Bank or financial institution
      loan_type TEXT CHECK (loan_type IN ('mortgage', 'renovation', 'construction', 'bridging', 'other')),
      
      -- Loan terms
      original_amount REAL NOT NULL,
      current_balance REAL NOT NULL,
      currency TEXT DEFAULT 'SEK',
      interest_rate REAL NOT NULL, -- Annual percentage rate
      interest_type TEXT DEFAULT 'variable' CHECK (interest_type IN ('fixed', 'variable')),
      
      -- Dates
      loan_date TEXT NOT NULL,
      maturity_date TEXT,
      next_rate_adjustment_date TEXT, -- For variable rate loans
      
      -- Amortization
      monthly_payment REAL,
      amortization_amount REAL, -- Monthly amortization
      amortization_free_until TEXT, -- Amorteringsfrihet
      
      -- Security and guarantees
      security_type TEXT, -- Property mortgage, bank guarantee, etc
      security_amount REAL,
      guarantors TEXT DEFAULT '[]' CHECK (json_valid(guarantors)), -- JSON array of guarantor info
      
      -- Covenants and conditions
      loan_to_value_ratio REAL, -- Belåningsgrad
      debt_service_coverage_ratio REAL,
      financial_covenants TEXT DEFAULT '{}' CHECK (json_valid(financial_covenants)),
      
      -- Status and flags
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'defaulted', 'refinanced')),
      is_green_loan INTEGER DEFAULT 0, -- Miljölån
      government_subsidized INTEGER DEFAULT 0,
      
      -- Contact and documentation
      contact_person TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      loan_agreement_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, loan_number)
    );
  `);

  // Loan payments table - For tracking loan payment history
  db.exec(`
    CREATE TABLE IF NOT EXISTS loan_payments (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      
      -- Payment details
      payment_date TEXT NOT NULL,
      payment_amount REAL NOT NULL,
      interest_amount REAL DEFAULT 0,
      amortization_amount REAL DEFAULT 0,
      fees REAL DEFAULT 0,
      
      -- Payment method and reference
      payment_method TEXT, -- bank_transfer, direct_debit, check
      payment_reference TEXT,
      transaction_id TEXT,
      
      -- Status
      status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
      
      -- Balance after payment
      remaining_balance REAL,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Password reset tokens table - For secure password reset functionality
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Token details
      token_hash TEXT UNIQUE NOT NULL, -- SHA-256 hash of the reset token
      user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      email TEXT NOT NULL, -- Store email for audit purposes
      
      -- Security and expiration
      expires_at TEXT NOT NULL,
      is_used INTEGER DEFAULT 0, -- Single-use token
      used_at TEXT,
      
      -- Rate limiting and audit trail
      request_ip TEXT,
      request_user_agent TEXT,
      reset_ip TEXT, -- IP that used the token
      reset_user_agent TEXT, -- User agent that used the token
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Password reset attempt tracking table - For rate limiting and security monitoring
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_attempts (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Request details
      email TEXT NOT NULL,
      request_ip TEXT NOT NULL,
      user_agent TEXT,
      
      -- Rate limiting
      attempt_count INTEGER DEFAULT 1,
      last_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
      blocked_until TEXT, -- Temporary blocking for excessive attempts
      
      -- Status tracking
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'blocked')),
      failure_reason TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Two-factor authentication secrets table - For TOTP implementation
  db.exec(`
    CREATE TABLE IF NOT EXISTS two_factor_secrets (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      
      -- TOTP Configuration
      secret_encrypted TEXT NOT NULL, -- AES-256 encrypted TOTP secret
      encryption_iv TEXT NOT NULL, -- Initialization vector for encryption
      algorithm TEXT DEFAULT 'SHA1' CHECK (algorithm IN ('SHA1', 'SHA256', 'SHA512')),
      digits INTEGER DEFAULT 6 CHECK (digits IN (6, 8)),
      period INTEGER DEFAULT 30, -- Time step in seconds
      
      -- Backup information for recovery
      recovery_secret TEXT, -- Encrypted recovery secret
      recovery_iv TEXT, -- IV for recovery secret encryption
      
      -- Setup and verification
      is_verified INTEGER DEFAULT 0, -- Whether 2FA setup is complete
      verified_at TEXT,
      setup_token TEXT, -- Temporary token during setup process
      setup_expires_at TEXT,
      
      -- Security and audit
      last_used_at TEXT,
      usage_count INTEGER DEFAULT 0,
      last_verified_code TEXT, -- Hash of last verified code (prevent replay)
      
      -- Device trust (optional)
      trusted_devices TEXT DEFAULT '[]' CHECK (json_valid(trusted_devices)), -- JSON array of trusted device fingerprints
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(user_id) -- One 2FA secret per user
    );
  `);

  // Two-factor authentication backup codes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      
      -- Backup code
      code_hash TEXT NOT NULL, -- SHA-256 hash of the backup code
      code_salt TEXT NOT NULL, -- Salt for the backup code hash
      
      -- Usage tracking
      is_used INTEGER DEFAULT 0,
      used_at TEXT,
      used_ip TEXT,
      used_user_agent TEXT,
      
      -- Security
      generation_batch TEXT NOT NULL, -- UUID to group codes generated together
      sequence_number INTEGER NOT NULL, -- Order within the batch (1-10 typically)
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(code_hash) -- Ensure backup codes are unique
    );
  `);

  // Two-factor authentication attempts table - For rate limiting and security monitoring
  db.exec(`
    CREATE TABLE IF NOT EXISTS two_factor_attempts (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Request details
      attempt_type TEXT NOT NULL CHECK (attempt_type IN ('totp', 'backup_code', 'setup_verify')),
      email TEXT,
      request_ip TEXT NOT NULL,
      user_agent TEXT,
      
      -- Attempt details
      provided_code TEXT, -- Hashed version of provided code for audit
      is_successful INTEGER DEFAULT 0,
      failure_reason TEXT,
      
      -- Rate limiting
      attempt_count INTEGER DEFAULT 1,
      blocked_until TEXT, -- Temporary blocking for excessive attempts
      
      -- Session context
      session_id TEXT, -- Session identifier for tracking
      login_attempt_id TEXT, -- Link to login attempt if applicable
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Two-factor authentication audit log - Comprehensive 2FA event logging
  db.exec(`
    CREATE TABLE IF NOT EXISTS two_factor_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Event details
      event_type TEXT NOT NULL CHECK (event_type IN (
        'setup_initiated', 'setup_completed', 'setup_cancelled',
        'totp_verified', 'totp_failed', 'backup_code_used', 'backup_codes_regenerated',
        'disabled', 'force_disabled', 'recovery_used', 'device_trusted', 'device_untrusted'
      )),
      event_description TEXT NOT NULL,
      
      -- Context
      ip_address TEXT,
      user_agent TEXT,
      session_id TEXT,
      
      -- Additional data
      event_data TEXT DEFAULT '{}' CHECK (json_valid(event_data)),
      
      -- Security classification
      risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
      
      -- Compliance and retention
      gdpr_category TEXT, -- Category for GDPR compliance
      retention_until TEXT, -- When this log entry can be purged
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Feature flags table - For feature toggle management
  db.exec(`
    CREATE TABLE IF NOT EXISTS feature_flags (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE, -- NULL for global flags
      
      -- Feature identification
      key TEXT NOT NULL, -- Unique feature key (e.g., 'new_payment_system')
      name TEXT NOT NULL, -- Human-readable name
      description TEXT,
      
      -- Flag configuration
      is_enabled INTEGER DEFAULT 0, -- Boolean: is this feature enabled
      environment TEXT DEFAULT 'all' CHECK (environment IN ('all', 'development', 'staging', 'production')),
      
      -- Targeting and rules
      target_type TEXT DEFAULT 'all' CHECK (target_type IN ('all', 'percentage', 'users', 'roles', 'apartments')),
      target_config TEXT DEFAULT '{}' CHECK (json_valid(target_config)), -- JSON config for targeting rules
      
      -- Feature metadata
      category TEXT DEFAULT 'general' CHECK (category IN ('general', 'auth', 'payments', 'documents', 'bookings', 'admin', 'ui', 'api')),
      tags TEXT DEFAULT '[]' CHECK (json_valid(tags)), -- JSON array for categorization
      
      -- Feature lifecycle
      status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived', 'deprecated')),
      rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
      
      -- Dependencies and conflicts
      dependencies TEXT DEFAULT '[]' CHECK (json_valid(dependencies)), -- Required feature flags
      conflicts TEXT DEFAULT '[]' CHECK (json_valid(conflicts)), -- Conflicting feature flags
      
      -- Testing and validation
      testing_notes TEXT,
      validation_rules TEXT DEFAULT '{}' CHECK (json_valid(validation_rules)),
      
      -- Audit and management
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Scheduling
      enabled_at TEXT, -- When the feature was enabled
      disabled_at TEXT, -- When the feature was disabled
      expires_at TEXT, -- Auto-disable date
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      
      -- Ensure unique feature keys per cooperative (or global)
      UNIQUE(key, cooperative_id)
    );
  `);

  // Feature flag usage log table - For tracking feature flag evaluations and usage
  db.exec(`
    CREATE TABLE IF NOT EXISTS feature_flag_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Feature flag reference
      feature_flag_id TEXT NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
      feature_key TEXT NOT NULL, -- Denormalized for performance
      
      -- Usage context
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      session_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      
      -- Evaluation result
      is_enabled INTEGER NOT NULL, -- Boolean: was feature enabled for this evaluation
      evaluation_reason TEXT, -- Why was this result returned (percentage, user_match, etc.)
      
      -- Context data
      context_data TEXT DEFAULT '{}' CHECK (json_valid(context_data)), -- Additional context used in evaluation
      
      -- Performance metrics
      evaluation_time_ms REAL, -- Time taken to evaluate the flag
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Feature flag variants table - For A/B testing and multivariate flags
  db.exec(`
    CREATE TABLE IF NOT EXISTS feature_flag_variants (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE,
      feature_flag_id TEXT NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
      
      -- Variant details
      key TEXT NOT NULL, -- Variant key (e.g., 'control', 'treatment_a', 'treatment_b')
      name TEXT NOT NULL, -- Human-readable name
      description TEXT,
      
      -- Configuration
      is_control INTEGER DEFAULT 0, -- Boolean: is this the control variant
      weight INTEGER DEFAULT 50 CHECK (weight BETWEEN 0 AND 100), -- Percentage weight for this variant
      config TEXT DEFAULT '{}' CHECK (json_valid(config)), -- JSON configuration for this variant
      
      -- Status
      is_active INTEGER DEFAULT 1,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(feature_flag_id, key)
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

  // Webhook endpoints table - For managing webhook endpoints and configurations
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Endpoint configuration
      name TEXT NOT NULL, -- Human readable name
      url TEXT NOT NULL, -- Webhook URL endpoint
      service_type TEXT NOT NULL CHECK (service_type IN ('bankid', 'fortnox', 'kivra', 'payment', 'notification', 'custom')),
      description TEXT,
      
      -- Authentication and security
      secret TEXT, -- Webhook secret for signature verification
      auth_header TEXT, -- Custom auth header if needed
      auth_token TEXT, -- Bearer token or API key
      
      -- Configuration
      events TEXT DEFAULT '[]' CHECK (json_valid(events)), -- JSON array of event types to listen for
      headers TEXT DEFAULT '{}' CHECK (json_valid(headers)), -- Custom headers to send
      timeout_seconds INTEGER DEFAULT 30, -- Request timeout
      retry_attempts INTEGER DEFAULT 3, -- Number of retry attempts
      retry_backoff_seconds INTEGER DEFAULT 60, -- Backoff time between retries
      
      -- Status and health
      is_active INTEGER DEFAULT 1,
      is_verified INTEGER DEFAULT 0, -- Whether endpoint URL has been verified
      last_success_at TEXT, -- Last successful webhook delivery
      last_failure_at TEXT, -- Last failed webhook delivery
      consecutive_failures INTEGER DEFAULT 0,
      
      -- Rate limiting
      rate_limit_requests INTEGER DEFAULT 100, -- Requests per minute
      rate_limit_window_minutes INTEGER DEFAULT 1,
      
      -- Environment and testing
      environment TEXT DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production', 'test')),
      test_mode INTEGER DEFAULT 0, -- Boolean for test mode
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      deleted_at TEXT,
      
      UNIQUE(cooperative_id, name)
    );
  `);

  // Webhook events table - For storing webhook event logs and deliveries
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      endpoint_id TEXT REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
      
      -- Event identification
      event_id TEXT UNIQUE NOT NULL, -- Unique event identifier
      event_type TEXT NOT NULL, -- payment.completed, bankid.auth.success, etc.
      source_service TEXT NOT NULL, -- bankid, fortnox, kivra, internal
      correlation_id TEXT, -- For tracing related events
      
      -- Event data
      payload TEXT NOT NULL CHECK (json_valid(payload)), -- JSON payload
      payload_size INTEGER, -- Size in bytes
      headers_received TEXT DEFAULT '{}' CHECK (json_valid(headers_received)), -- Incoming headers
      
      -- Delivery information
      delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'retrying', 'skipped')),
      delivery_attempts INTEGER DEFAULT 0,
      last_delivery_attempt TEXT,
      next_retry_at TEXT,
      
      -- Response data
      response_status_code INTEGER,
      response_headers TEXT DEFAULT '{}' CHECK (json_valid(response_headers)),
      response_body TEXT,
      response_time_ms INTEGER,
      
      -- Error information
      error_message TEXT,
      error_details TEXT CHECK (json_valid(error_details)),
      
      -- Security and validation
      signature_valid INTEGER DEFAULT 1, -- Boolean for signature verification
      ip_address TEXT, -- Source IP address
      user_agent TEXT,
      
      -- Processing flags
      is_test_event INTEGER DEFAULT 0,
      is_replayed INTEGER DEFAULT 0, -- Boolean for replayed events
      original_event_id TEXT, -- Reference to original event if this is a replay
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      processed_at TEXT
    );
  `);

  // Webhook subscriptions table - For managing event subscriptions
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
      
      -- Subscription details
      event_type TEXT NOT NULL, -- payment.completed, bankid.*, etc. (supports wildcards)
      event_pattern TEXT, -- Regex pattern for advanced matching
      
      -- Filtering and conditions
      filter_conditions TEXT DEFAULT '{}' CHECK (json_valid(filter_conditions)), -- JSON filter conditions
      
      -- Configuration
      is_active INTEGER DEFAULT 1,
      batch_size INTEGER DEFAULT 1, -- Number of events to batch together
      batch_timeout_seconds INTEGER DEFAULT 0, -- Max time to wait for batch
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(endpoint_id, event_type)
    );
  `);

  // Webhook templates table - For storing reusable webhook payloads and configurations
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_templates (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT REFERENCES cooperatives(id) ON DELETE CASCADE, -- NULL for global templates
      
      -- Template identification
      name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT,
      
      -- Template content
      payload_template TEXT NOT NULL CHECK (json_valid(payload_template)), -- JSON template with variables
      headers_template TEXT DEFAULT '{}' CHECK (json_valid(headers_template)),
      
      -- Variables and schema
      variables TEXT DEFAULT '[]' CHECK (json_valid(variables)), -- Available template variables
      schema TEXT CHECK (json_valid(schema)), -- JSON schema for validation
      
      -- Template metadata
      category TEXT DEFAULT 'general' CHECK (category IN ('general', 'payment', 'auth', 'notification', 'integration')),
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
      
      UNIQUE(cooperative_id, name, service_type, event_type)
    );
  `);

  // Webhook rate limits table - For tracking rate limit usage per endpoint
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_rate_limits (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
      
      -- Time window
      window_start TEXT NOT NULL, -- Start of the rate limit window
      window_end TEXT NOT NULL, -- End of the rate limit window
      
      -- Usage tracking
      request_count INTEGER DEFAULT 0,
      limit_exceeded INTEGER DEFAULT 0, -- Boolean for whether limit was exceeded
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(endpoint_id, window_start)
    );
  `);

  // Webhook simulator sessions table - For managing webhook testing sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_simulator_sessions (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Session details
      name TEXT NOT NULL,
      description TEXT,
      service_type TEXT NOT NULL,
      
      -- Configuration
      base_url TEXT, -- Base URL for simulated services
      scenarios TEXT DEFAULT '[]' CHECK (json_valid(scenarios)), -- Test scenarios
      
      -- Session state
      is_active INTEGER DEFAULT 1,
      events_sent INTEGER DEFAULT 0,
      events_failed INTEGER DEFAULT 0,
      
      -- Timing
      started_at TEXT,
      ended_at TEXT,
      duration_seconds INTEGER,
      
      -- Created by
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Bulk upload batches table - For managing bulk file upload operations
  db.exec(`
    CREATE TABLE IF NOT EXISTS bulk_upload_batches (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Batch identification
      batch_name TEXT,
      batch_description TEXT,
      batch_number INTEGER NOT NULL, -- Auto-incremented per cooperative
      
      -- Batch configuration
      max_files INTEGER DEFAULT 500,
      max_total_size_mb INTEGER DEFAULT 1024, -- 1GB default
      allowed_file_types TEXT DEFAULT '[]' CHECK (json_valid(allowed_file_types)), -- ["pdf", "docx", "xlsx", "jpg", "png"]
      processing_mode TEXT DEFAULT 'parallel' CHECK (processing_mode IN ('parallel', 'sequential')),
      concurrent_uploads INTEGER DEFAULT 10, -- Number of concurrent file uploads
      
      -- Upload source and metadata
      upload_source TEXT DEFAULT 'web' CHECK (upload_source IN ('web', 'api', 'ftp', 'email')),
      uploaded_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      upload_method TEXT DEFAULT 'multipart' CHECK (upload_method IN ('multipart', 'chunked', 'direct')),
      
      -- Status and progress
      status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'validating', 'uploading', 'processing', 'completed', 
        'failed', 'cancelled', 'partially_completed'
      )),
      progress_percentage REAL DEFAULT 0.0 CHECK (progress_percentage BETWEEN 0.0 AND 100.0),
      
      -- File counts and statistics
      total_files INTEGER DEFAULT 0,
      files_uploaded INTEGER DEFAULT 0,
      files_processed INTEGER DEFAULT 0,
      files_completed INTEGER DEFAULT 0,
      files_failed INTEGER DEFAULT 0,
      files_skipped INTEGER DEFAULT 0,
      
      -- Size statistics (in bytes)
      total_size_bytes INTEGER DEFAULT 0,
      uploaded_size_bytes INTEGER DEFAULT 0,
      processed_size_bytes INTEGER DEFAULT 0,
      
      -- Processing times and performance
      started_at TEXT,
      completed_at TEXT,
      upload_duration_seconds INTEGER,
      processing_duration_seconds INTEGER,
      average_file_processing_time_ms REAL,
      throughput_files_per_second REAL,
      throughput_mb_per_second REAL,
      
      -- Error tracking and retry configuration
      max_retries INTEGER DEFAULT 3,
      retry_delay_seconds INTEGER DEFAULT 60,
      current_retry_count INTEGER DEFAULT 0,
      error_threshold_percentage REAL DEFAULT 10.0, -- Fail batch if > X% of files fail
      
      -- Queue and priority management
      queue_priority INTEGER DEFAULT 5 CHECK (queue_priority BETWEEN 1 AND 10), -- 1=highest, 10=lowest
      queue_position INTEGER,
      estimated_completion_time TEXT, -- ISO timestamp
      
      -- Resource management
      memory_usage_mb REAL,
      cpu_usage_percentage REAL,
      disk_space_required_mb REAL,
      network_bandwidth_mbps REAL,
      
      -- Validation and quality control
      validation_rules TEXT DEFAULT '{}' CHECK (json_valid(validation_rules)), -- JSON validation config
      duplicate_handling TEXT DEFAULT 'skip' CHECK (duplicate_handling IN ('skip', 'overwrite', 'rename', 'fail')),
      virus_scan_enabled INTEGER DEFAULT 1,
      virus_scan_status TEXT DEFAULT 'pending' CHECK (virus_scan_status IN ('pending', 'scanning', 'clean', 'infected', 'failed')),
      
      -- Storage and organization
      storage_path TEXT, -- Base path where batch files are stored
      temp_storage_path TEXT, -- Temporary storage during processing
      archive_after_completion INTEGER DEFAULT 1, -- Auto-archive completed batches
      retention_days INTEGER DEFAULT 90, -- How long to keep batch data
      
      -- Notifications and reporting
      notify_on_completion INTEGER DEFAULT 1,
      notify_on_errors INTEGER DEFAULT 1,
      notification_email TEXT,
      report_generated INTEGER DEFAULT 0,
      report_file_path TEXT,
      
      -- API and integration
      api_key_used TEXT, -- If uploaded via API
      webhook_url TEXT, -- Callback URL for status updates
      external_batch_id TEXT, -- External system batch identifier
      correlation_id TEXT, -- For tracing across systems
      
      -- Metadata and tags
      tags TEXT DEFAULT '[]' CHECK (json_valid(tags)),
      metadata TEXT DEFAULT '{}' CHECK (json_valid(metadata)),
      
      -- Audit and compliance
      gdpr_consent INTEGER DEFAULT 0,
      data_classification TEXT DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
      retention_policy TEXT DEFAULT 'standard',
      
      -- Timestamps
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      
      UNIQUE(cooperative_id, batch_number)
    );
  `);

  // Bulk upload queue table - For managing upload queue and scheduling
  db.exec(`
    CREATE TABLE IF NOT EXISTS bulk_upload_queue (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      batch_id TEXT NOT NULL REFERENCES bulk_upload_batches(id) ON DELETE CASCADE,
      
      -- Queue details
      queue_type TEXT DEFAULT 'upload' CHECK (queue_type IN ('upload', 'processing', 'retry', 'cleanup')),
      priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
      queue_position INTEGER NOT NULL,
      
      -- Scheduling
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      expires_at TEXT, -- Queue item expiration
      
      -- Worker assignment
      worker_id TEXT, -- ID of the worker processing this item
      worker_type TEXT DEFAULT 'default' CHECK (worker_type IN ('default', 'heavy', 'fast', 'specialized')),
      max_processing_time_minutes INTEGER DEFAULT 60,
      
      -- Dependencies and prerequisites
      dependencies TEXT DEFAULT '[]' CHECK (json_valid(dependencies)), -- JSON array of batch IDs that must complete first
      prerequisite_checks TEXT DEFAULT '{}' CHECK (json_valid(prerequisite_checks)), -- Validation checks
      
      -- Resource requirements
      required_memory_mb INTEGER DEFAULT 512,
      required_cpu_cores INTEGER DEFAULT 1,
      required_disk_space_mb INTEGER DEFAULT 1024,
      
      -- Status and progress
      status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled', 'expired')),
      progress_details TEXT DEFAULT '{}' CHECK (json_valid(progress_details)),
      
      -- Error handling
      error_message TEXT,
      error_details TEXT CHECK (json_valid(error_details)),
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      next_retry_at TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Bulk upload files table - For tracking individual files in bulk uploads
  db.exec(`
    CREATE TABLE IF NOT EXISTS bulk_upload_files (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      batch_id TEXT NOT NULL REFERENCES bulk_upload_batches(id) ON DELETE CASCADE,
      
      -- File identification and metadata
      original_filename TEXT NOT NULL,
      sanitized_filename TEXT,
      file_extension TEXT,
      mime_type TEXT,
      content_type TEXT,
      
      -- File size and validation
      file_size_bytes INTEGER NOT NULL,
      file_hash_md5 TEXT, -- For duplicate detection
      file_hash_sha256 TEXT, -- For integrity verification
      is_duplicate INTEGER DEFAULT 0,
      duplicate_of_file_id TEXT REFERENCES bulk_upload_files(id) ON DELETE SET NULL,
      
      -- Processing order and priority
      processing_order INTEGER, -- Order within the batch
      priority INTEGER DEFAULT 5,
      depends_on_file_id TEXT REFERENCES bulk_upload_files(id) ON DELETE SET NULL,
      
      -- Upload status and progress
      upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN (
        'pending', 'uploading', 'uploaded', 'failed', 'cancelled', 'skipped'
      )),
      upload_progress_percentage REAL DEFAULT 0.0,
      upload_started_at TEXT,
      upload_completed_at TEXT,
      upload_duration_seconds INTEGER,
      upload_speed_mbps REAL,
      
      -- Processing status and progress
      processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN (
        'pending', 'processing', 'processed', 'failed', 'skipped'
      )),
      processing_started_at TEXT,
      processing_completed_at TEXT,
      processing_duration_seconds INTEGER,
      
      -- Storage information
      temp_file_path TEXT, -- Temporary storage during upload
      final_file_path TEXT, -- Final storage location
      storage_backend TEXT DEFAULT 'local' CHECK (storage_backend IN ('local', 's3', 'azure', 'gcs')),
      storage_key TEXT, -- Storage system key/path
      storage_url TEXT, -- Access URL
      
      -- Virus scanning and security
      virus_scan_status TEXT DEFAULT 'pending' CHECK (virus_scan_status IN ('pending', 'scanning', 'clean', 'infected', 'failed', 'skipped')),
      virus_scan_result TEXT,
      virus_scan_engine TEXT,
      quarantined INTEGER DEFAULT 0,
      quarantine_reason TEXT,
      
      -- Content extraction and analysis
      content_extracted INTEGER DEFAULT 0,
      ocr_performed INTEGER DEFAULT 0,
      text_content TEXT,
      extracted_metadata TEXT DEFAULT '{}' CHECK (json_valid(extracted_metadata)),
      confidence_score REAL, -- OCR/extraction confidence
      
      -- Document classification and categorization
      document_type TEXT, -- invoice, contract, protocol, etc.
      category TEXT,
      subcategory TEXT,
      auto_classified INTEGER DEFAULT 0,
      classification_confidence REAL,
      manual_classification TEXT,
      
      -- Validation and quality checks
      validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'warning')),
      validation_errors TEXT DEFAULT '[]' CHECK (json_valid(validation_errors)),
      validation_warnings TEXT DEFAULT '[]' CHECK (json_valid(validation_warnings)),
      quality_score REAL, -- Overall file quality score 0-100
      
      -- Error handling and retry
      error_count INTEGER DEFAULT 0,
      last_error_message TEXT,
      last_error_details TEXT CHECK (json_valid(last_error_details)),
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      next_retry_at TEXT,
      
      -- Relations and linking
      document_id TEXT REFERENCES documents(id) ON DELETE SET NULL, -- Link to created document
      related_invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      related_case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
      
      -- User interaction and approval
      requires_manual_review INTEGER DEFAULT 0,
      manual_review_completed INTEGER DEFAULT 0,
      reviewed_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_revision')),
      approval_notes TEXT,
      
      -- Indexing and search
      searchable_content TEXT, -- Processed content for full-text search
      keywords TEXT DEFAULT '[]' CHECK (json_valid(keywords)),
      search_index_updated INTEGER DEFAULT 0,
      
      -- Performance metrics
      processing_metrics TEXT DEFAULT '{}' CHECK (json_valid(processing_metrics)),
      performance_score REAL, -- Processing performance score
      
      -- API and external integration
      external_file_id TEXT, -- External system file identifier
      source_system TEXT, -- System that provided the file
      import_batch_reference TEXT,
      
      -- Metadata and custom fields
      custom_fields TEXT DEFAULT '{}' CHECK (json_valid(custom_fields)),
      tags TEXT DEFAULT '[]' CHECK (json_valid(tags)),
      notes TEXT,
      
      -- Timestamps
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(batch_id, processing_order)
    );
  `);

  // Bulk upload workers table - For managing worker processes and load balancing
  db.exec(`
    CREATE TABLE IF NOT EXISTS bulk_upload_workers (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      
      -- Worker identification
      worker_name TEXT NOT NULL,
      worker_type TEXT DEFAULT 'default' CHECK (worker_type IN ('default', 'heavy', 'fast', 'specialized')),
      worker_version TEXT,
      process_id INTEGER,
      hostname TEXT,
      
      -- Worker capabilities
      max_concurrent_batches INTEGER DEFAULT 1,
      max_concurrent_files INTEGER DEFAULT 10,
      supported_file_types TEXT DEFAULT '[]' CHECK (json_valid(supported_file_types)),
      max_file_size_mb INTEGER DEFAULT 100,
      
      -- Resource limits
      memory_limit_mb INTEGER DEFAULT 1024,
      cpu_cores INTEGER DEFAULT 1,
      disk_space_mb INTEGER DEFAULT 5120,
      network_bandwidth_mbps INTEGER DEFAULT 100,
      
      -- Status and health
      status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'maintenance', 'offline', 'error')),
      health_status TEXT DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy')),
      last_heartbeat_at TEXT,
      heartbeat_interval_seconds INTEGER DEFAULT 30,
      
      -- Current workload
      current_batches INTEGER DEFAULT 0,
      current_files INTEGER DEFAULT 0,
      current_memory_usage_mb REAL DEFAULT 0,
      current_cpu_usage_percentage REAL DEFAULT 0,
      
      -- Performance metrics
      total_batches_processed INTEGER DEFAULT 0,
      total_files_processed INTEGER DEFAULT 0,
      total_processing_time_hours REAL DEFAULT 0,
      average_batch_processing_minutes REAL,
      average_file_processing_seconds REAL,
      success_rate_percentage REAL DEFAULT 100.0,
      
      -- Configuration
      configuration TEXT DEFAULT '{}' CHECK (json_valid(configuration)),
      feature_flags TEXT DEFAULT '{}' CHECK (json_valid(feature_flags)),
      
      -- Error tracking
      error_count INTEGER DEFAULT 0,
      last_error_at TEXT,
      last_error_message TEXT,
      consecutive_errors INTEGER DEFAULT 0,
      
      -- Maintenance and lifecycle
      started_at TEXT NOT NULL,
      last_maintenance_at TEXT,
      next_maintenance_at TEXT,
      restart_count INTEGER DEFAULT 0,
      uptime_seconds INTEGER DEFAULT 0,
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      UNIQUE(worker_name)
    );
  `);

  // Bulk upload events table - For comprehensive event logging and audit trail
  db.exec(`
    CREATE TABLE IF NOT EXISTS bulk_upload_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Event identification
      event_type TEXT NOT NULL CHECK (event_type IN (
        'batch_created', 'batch_started', 'batch_completed', 'batch_failed', 'batch_cancelled',
        'file_uploaded', 'file_processed', 'file_failed', 'file_skipped',
        'validation_started', 'validation_completed', 'validation_failed',
        'virus_scan_started', 'virus_scan_completed', 'virus_scan_failed',
        'worker_assigned', 'worker_started', 'worker_completed', 'worker_failed',
        'error_occurred', 'retry_attempted', 'manual_intervention_required',
        'notification_sent', 'webhook_called', 'api_request_received'
      )),
      event_level TEXT DEFAULT 'info' CHECK (event_level IN ('debug', 'info', 'warning', 'error', 'critical')),
      event_source TEXT NOT NULL, -- 'api', 'worker', 'scheduler', 'webhook', etc.
      
      -- Event context
      batch_id TEXT REFERENCES bulk_upload_batches(id) ON DELETE SET NULL,
      file_id TEXT REFERENCES bulk_upload_files(id) ON DELETE SET NULL,
      worker_id TEXT REFERENCES bulk_upload_workers(id) ON DELETE SET NULL,
      user_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Event details
      event_message TEXT NOT NULL,
      event_details TEXT DEFAULT '{}' CHECK (json_valid(event_details)),
      event_data TEXT CHECK (json_valid(event_data)),
      
      -- Request/Response information
      request_id TEXT,
      session_id TEXT,
      correlation_id TEXT,
      request_ip TEXT,
      user_agent TEXT,
      
      -- Performance and metrics
      duration_ms INTEGER,
      memory_usage_mb REAL,
      cpu_usage_percentage REAL,
      
      -- Error information
      error_code TEXT,
      error_message TEXT,
      error_stack_trace TEXT,
      resolution_status TEXT CHECK (resolution_status IN ('pending', 'resolved', 'ignored', 'escalated')),
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Bulk upload settings table - For cooperative-specific bulk upload configurations
  db.exec(`
    CREATE TABLE IF NOT EXISTS bulk_upload_settings (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- General settings
      max_batch_size INTEGER DEFAULT 500,
      max_file_size_mb INTEGER DEFAULT 100,
      max_total_batch_size_gb REAL DEFAULT 5.0,
      allowed_file_types TEXT DEFAULT '["pdf","docx","xlsx","jpg","jpeg","png","txt","csv"]' CHECK (json_valid(allowed_file_types)),
      
      -- Processing settings
      default_processing_mode TEXT DEFAULT 'parallel' CHECK (default_processing_mode IN ('parallel', 'sequential')),
      max_concurrent_uploads INTEGER DEFAULT 10,
      max_concurrent_processing INTEGER DEFAULT 5,
      auto_start_processing INTEGER DEFAULT 1,
      
      -- Quality and validation settings
      enable_virus_scanning INTEGER DEFAULT 1,
      enable_duplicate_detection INTEGER DEFAULT 1,
      enable_ocr INTEGER DEFAULT 1,
      enable_auto_classification INTEGER DEFAULT 1,
      quality_threshold REAL DEFAULT 75.0,
      
      -- Storage and retention settings
      default_storage_path TEXT DEFAULT '/uploads/bulk/',
      archive_completed_batches INTEGER DEFAULT 1,
      archive_after_days INTEGER DEFAULT 30,
      delete_temp_files_immediately INTEGER DEFAULT 1,
      retention_policy TEXT DEFAULT 'standard',
      
      -- Notification settings
      notify_on_completion INTEGER DEFAULT 1,
      notify_on_errors INTEGER DEFAULT 1,
      notification_emails TEXT DEFAULT '[]' CHECK (json_valid(notification_emails)),
      slack_webhook_url TEXT,
      teams_webhook_url TEXT,
      
      -- Rate limiting settings
      max_batches_per_hour INTEGER DEFAULT 10,
      max_batches_per_day INTEGER DEFAULT 50,
      max_files_per_hour INTEGER DEFAULT 1000,
      rate_limit_window_minutes INTEGER DEFAULT 60,
      
      -- API and webhook settings
      api_rate_limit_requests_per_minute INTEGER DEFAULT 100,
      webhook_timeout_seconds INTEGER DEFAULT 30,
      webhook_retry_attempts INTEGER DEFAULT 3,
      
      -- Performance settings
      memory_limit_mb INTEGER DEFAULT 2048,
      cpu_limit_percentage REAL DEFAULT 80.0,
      parallel_processing_factor REAL DEFAULT 1.0,
      
      -- Security settings
      require_2fa_for_bulk_uploads INTEGER DEFAULT 0,
      allow_external_uploads INTEGER DEFAULT 0,
      whitelist_ip_addresses TEXT DEFAULT '[]' CHECK (json_valid(whitelist_ip_addresses)),
      
      -- Feature flags
      features TEXT DEFAULT '{}' CHECK (json_valid(features)),
      experimental_features TEXT DEFAULT '{}' CHECK (json_valid(experimental_features)),
      
      -- Custom settings
      custom_settings TEXT DEFAULT '{}' CHECK (json_valid(custom_settings)),
      
      -- Metadata
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      UNIQUE(cooperative_id)
    );
  `);

  // File duplicates table - For tracking duplicate files and their relationships
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_duplicates (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Original and duplicate file references
      original_file_id TEXT, -- Can reference documents.id or bulk_upload_files.id
      duplicate_file_id TEXT, -- Can reference documents.id or bulk_upload_files.id
      original_file_type TEXT DEFAULT 'document' CHECK (original_file_type IN ('document', 'upload_file')),
      duplicate_file_type TEXT DEFAULT 'document' CHECK (duplicate_file_type IN ('document', 'upload_file')),
      
      -- Detection details
      detection_algorithm TEXT NOT NULL CHECK (detection_algorithm IN ('md5', 'sha256', 'perceptual', 'content', 'metadata', 'fuzzy')),
      similarity_score REAL NOT NULL DEFAULT 0.0 CHECK (similarity_score >= 0.0 AND similarity_score <= 1.0),
      confidence_level TEXT DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high')),
      
      -- File comparison data
      original_hash_md5 TEXT,
      duplicate_hash_md5 TEXT,
      original_hash_sha256 TEXT,
      duplicate_hash_sha256 TEXT,
      original_size_bytes INTEGER,
      duplicate_size_bytes INTEGER,
      original_filename TEXT,
      duplicate_filename TEXT,
      
      -- BRF-specific metadata comparison
      original_document_type TEXT, -- invoice, protocol, contract, etc
      duplicate_document_type TEXT,
      metadata_similarity REAL DEFAULT 0.0,
      content_similarity REAL DEFAULT 0.0,
      
      -- Detection status and resolution
      status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'reviewed', 'resolved', 'ignored', 'false_positive')),
      resolution_action TEXT CHECK (resolution_action IN ('keep_original', 'keep_duplicate', 'keep_both', 'merge', 'delete_original', 'delete_duplicate')),
      resolution_reason TEXT,
      
      -- Quality comparison
      original_quality_score REAL DEFAULT 0.0,
      duplicate_quality_score REAL DEFAULT 0.0,
      recommended_action TEXT CHECK (recommended_action IN ('keep_original', 'keep_duplicate', 'keep_both', 'merge', 'manual_review')),
      
      -- Review and timestamps
      detected_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      resolved_at TEXT,
      reviewed_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      resolved_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Additional metadata
      detection_details TEXT DEFAULT '{}' CHECK (json_valid(detection_details)), -- JSON with algorithm-specific details
      comparison_metrics TEXT DEFAULT '{}' CHECK (json_valid(comparison_metrics)), -- JSON with detailed comparison metrics
      user_feedback TEXT DEFAULT '{}' CHECK (json_valid(user_feedback)), -- JSON with user feedback and corrections
      
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      
      UNIQUE(original_file_id, duplicate_file_id, detection_algorithm)
    );
  `);

  // Duplicate detection rules table - Configurable rules per cooperative
  db.exec(`
    CREATE TABLE IF NOT EXISTS duplicate_detection_rules (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Rule configuration
      rule_name TEXT NOT NULL,
      rule_description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      priority INTEGER DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
      
      -- Algorithm settings
      algorithms TEXT DEFAULT '["md5", "sha256"]' CHECK (json_valid(algorithms)), -- JSON array of algorithms to use
      similarity_threshold REAL DEFAULT 0.95 CHECK (similarity_threshold >= 0.0 AND similarity_threshold <= 1.0),
      confidence_threshold TEXT DEFAULT 'medium' CHECK (confidence_threshold IN ('low', 'medium', 'high')),
      
      -- File type filters
      file_types TEXT DEFAULT '[]' CHECK (json_valid(file_types)), -- JSON array of file extensions
      document_types TEXT DEFAULT '[]' CHECK (json_valid(document_types)), -- JSON array of BRF document types
      min_file_size_bytes INTEGER DEFAULT 0,
      max_file_size_bytes INTEGER DEFAULT 0, -- 0 means no limit
      
      -- BRF-specific rules
      check_invoice_numbers BOOLEAN DEFAULT TRUE,
      check_meeting_dates BOOLEAN DEFAULT TRUE,
      check_contractor_names BOOLEAN DEFAULT TRUE,
      check_apartment_references BOOLEAN DEFAULT TRUE,
      
      -- Auto-resolution settings
      auto_resolve BOOLEAN DEFAULT FALSE,
      auto_resolution_action TEXT DEFAULT 'keep_original' CHECK (auto_resolution_action IN ('keep_original', 'keep_duplicate', 'keep_both', 'manual_review')),
      auto_resolution_conditions TEXT DEFAULT '{}' CHECK (json_valid(auto_resolution_conditions)), -- JSON with conditions
      
      -- Notifications
      notify_on_detection BOOLEAN DEFAULT TRUE,
      notify_users TEXT DEFAULT '[]' CHECK (json_valid(notify_users)), -- JSON array of user IDs
      notification_threshold INTEGER DEFAULT 1, -- Notify after N duplicates
      
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      UNIQUE(cooperative_id, rule_name)
    );
  `);

  // Duplicate detection sessions table - Track batch detection operations
  db.exec(`
    CREATE TABLE IF NOT EXISTS duplicate_detection_sessions (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES bulk_upload_batches(id) ON DELETE CASCADE,
      
      -- Session details
      session_type TEXT DEFAULT 'batch' CHECK (session_type IN ('batch', 'scheduled', 'manual', 'realtime')),
      session_status TEXT DEFAULT 'pending' CHECK (session_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
      
      -- Processing details
      total_files_scanned INTEGER DEFAULT 0,
      duplicate_groups_found INTEGER DEFAULT 0,
      total_duplicates_found INTEGER DEFAULT 0,
      false_positives_found INTEGER DEFAULT 0,
      
      -- Algorithm performance
      algorithms_used TEXT DEFAULT '[]' CHECK (json_valid(algorithms_used)), -- JSON array
      processing_time_seconds REAL DEFAULT 0.0,
      memory_usage_mb REAL DEFAULT 0.0,
      cpu_usage_percentage REAL DEFAULT 0.0,
      
      -- Results and actions
      auto_resolved_count INTEGER DEFAULT 0,
      manual_review_count INTEGER DEFAULT 0,
      ignored_count INTEGER DEFAULT 0,
      
      -- Timestamps and tracking
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      cancelled_at TEXT,
      started_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      
      -- Configuration and results
      detection_config TEXT DEFAULT '{}' CHECK (json_valid(detection_config)), -- JSON with session config
      session_results TEXT DEFAULT '{}' CHECK (json_valid(session_results)), -- JSON with detailed results
      error_details TEXT DEFAULT '{}' CHECK (json_valid(error_details)), -- JSON with error information
      
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Duplicate groups table - Group related duplicates together
  db.exec(`
    CREATE TABLE IF NOT EXISTS duplicate_groups (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      detection_session_id TEXT REFERENCES duplicate_detection_sessions(id) ON DELETE CASCADE,
      
      -- Group details
      group_name TEXT, -- Auto-generated or user-defined
      group_type TEXT DEFAULT 'exact' CHECK (group_type IN ('exact', 'similar', 'related', 'fuzzy')),
      master_file_id TEXT, -- The file chosen as the "master" in the group
      master_file_type TEXT DEFAULT 'document' CHECK (master_file_type IN ('document', 'upload_file')),
      
      -- Group statistics
      total_files INTEGER DEFAULT 0,
      total_size_bytes INTEGER DEFAULT 0,
      oldest_file_date TEXT,
      newest_file_date TEXT,
      
      -- Resolution status
      resolution_status TEXT DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'in_progress', 'resolved', 'ignored')),
      resolution_strategy TEXT CHECK (resolution_strategy IN ('keep_master', 'keep_newest', 'keep_largest', 'keep_best_quality', 'merge_all', 'manual')),
      auto_resolvable BOOLEAN DEFAULT FALSE,
      
      -- Quality and recommendation
      group_quality_score REAL DEFAULT 0.0,
      recommended_master_id TEXT,
      confidence_score REAL DEFAULT 0.0,
      
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by TEXT REFERENCES members(id) ON DELETE SET NULL
    );
  `);

  // Duplicate group members table - Files belonging to duplicate groups
  db.exec(`
    CREATE TABLE IF NOT EXISTS duplicate_group_members (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      group_id TEXT NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- File reference
      file_id TEXT NOT NULL,
      file_type TEXT DEFAULT 'document' CHECK (file_type IN ('document', 'upload_file')),
      
      -- File details
      filename TEXT,
      file_size_bytes INTEGER DEFAULT 0,
      file_hash_md5 TEXT,
      file_hash_sha256 TEXT,
      mime_type TEXT,
      
      -- Quality and metadata
      quality_score REAL DEFAULT 0.0,
      is_master BOOLEAN DEFAULT FALSE,
      similarity_to_master REAL DEFAULT 0.0,
      keep_file BOOLEAN, -- NULL means undecided, TRUE/FALSE for resolution
      
      -- BRF-specific metadata
      document_type TEXT,
      document_date TEXT,
      apartment_reference TEXT,
      invoice_number TEXT,
      contractor_name TEXT,
      
      -- Status tracking
      member_status TEXT DEFAULT 'active' CHECK (member_status IN ('active', 'resolved', 'deleted', 'ignored')),
      resolution_action TEXT CHECK (resolution_action IN ('keep', 'delete', 'merge', 'archive')),
      
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      
      UNIQUE(group_id, file_id, file_type)
    );
  `);

  // Duplicate detection statistics table - Performance and usage tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS duplicate_detection_stats (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
      
      -- Time period
      stats_date TEXT NOT NULL, -- Date in YYYY-MM-DD format
      stats_period TEXT DEFAULT 'daily' CHECK (stats_period IN ('hourly', 'daily', 'weekly', 'monthly')),
      
      -- Detection statistics
      files_scanned INTEGER DEFAULT 0,
      duplicates_detected INTEGER DEFAULT 0,
      duplicate_groups_created INTEGER DEFAULT 0,
      false_positives INTEGER DEFAULT 0,
      
      -- Resolution statistics  
      auto_resolved INTEGER DEFAULT 0,
      manually_resolved INTEGER DEFAULT 0,
      ignored_duplicates INTEGER DEFAULT 0,
      storage_saved_bytes INTEGER DEFAULT 0,
      
      -- Algorithm performance
      average_detection_time_ms REAL DEFAULT 0.0,
      average_similarity_score REAL DEFAULT 0.0,
      most_effective_algorithm TEXT,
      
      -- User engagement
      user_reviews INTEGER DEFAULT 0,
      user_corrections INTEGER DEFAULT 0,
      user_feedback_positive INTEGER DEFAULT 0,
      user_feedback_negative INTEGER DEFAULT 0,
      
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      
      UNIQUE(cooperative_id, stats_date, stats_period)
    );
  `);

  // Create error logging schema
  createErrorLogSchema(db);
  
  // Create file size limit schema
  createFileSizeLimitSchema(db);
  
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
  // Swedish BRF regulatory indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cooperatives_tax_number ON cooperatives(tax_number);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cooperatives_property_designation ON cooperatives(property_designation);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cooperatives_accounting_standard ON cooperatives(accounting_standard);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cooperatives_fiscal_year_end ON cooperatives(fiscal_year_end);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cooperatives_annual_report_filed ON cooperatives(annual_report_filed);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cooperatives_energy_certificate ON cooperatives(energy_certificate);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cooperatives_energy_certificate_expires ON cooperatives(energy_certificate_expires);`
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

  // Board meetings indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_board_meetings_cooperative ON board_meetings(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_board_meetings_date ON board_meetings(scheduled_date);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_board_meetings_status ON board_meetings(status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_board_meetings_meeting_number ON board_meetings(cooperative_id, meeting_number);`
  );

  // Energy consumption indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_energy_consumption_cooperative ON energy_consumption(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_energy_consumption_period ON energy_consumption(year, month);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_energy_consumption_lookup ON energy_consumption(cooperative_id, year, month);`
  );

  // Contractor ratings indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_contractor_ratings_cooperative ON contractor_ratings(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_contractor_ratings_category ON contractor_ratings(category);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_contractor_ratings_contractor ON contractor_ratings(contractor_name);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_contractor_ratings_overall ON contractor_ratings(overall_rating);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_contractor_ratings_case ON contractor_ratings(case_id);`
  );

  // Booking resources indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_booking_resources_cooperative ON booking_resources(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_booking_resources_type ON booking_resources(resource_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_booking_resources_active ON booking_resources(is_active, out_of_order);`
  );

  // Bookings indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bookings_cooperative ON bookings(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bookings_resource ON bookings(resource_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bookings_member ON bookings(member_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bookings_datetime ON bookings(booking_date, start_time);`
  );

  // Queue positions indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_queue_positions_cooperative ON queue_positions(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_queue_positions_queue_number ON queue_positions(cooperative_id, queue_number);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_queue_positions_status ON queue_positions(status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_queue_positions_email ON queue_positions(email);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_queue_positions_registration ON queue_positions(registration_date);`
  );

  // Loans indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_loans_cooperative ON loans(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_loans_loan_number ON loans(cooperative_id, loan_number);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_loans_lender ON loans(lender_name);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_loans_maturity ON loans(maturity_date);`
  );

  // Loan payments indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_loan_payments_cooperative ON loan_payments(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_loan_payments_date ON loan_payments(payment_date);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_loan_payments_status ON loan_payments(status);`
  );

  // Password reset tokens indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_cooperative ON password_reset_tokens(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active ON password_reset_tokens(is_used, expires_at);`
  );

  // Password reset attempts indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_cooperative ON password_reset_attempts(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_email ON password_reset_attempts(email);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_ip ON password_reset_attempts(request_ip);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_lookup ON password_reset_attempts(email, request_ip, last_attempt_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_blocked ON password_reset_attempts(blocked_until);`
  );

  // Two-factor authentication secrets indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_secrets_cooperative ON two_factor_secrets(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_secrets_user ON two_factor_secrets(user_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_secrets_verified ON two_factor_secrets(is_verified);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_secrets_setup_token ON two_factor_secrets(setup_token);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_secrets_expires ON two_factor_secrets(setup_expires_at);`
  );

  // Two-factor backup codes indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_cooperative ON two_factor_backup_codes(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_user ON two_factor_backup_codes(user_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_hash ON two_factor_backup_codes(code_hash);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_batch ON two_factor_backup_codes(generation_batch);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_unused ON two_factor_backup_codes(user_id, is_used) WHERE is_used = 0;`
  );

  // Two-factor attempts indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_cooperative ON two_factor_attempts(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user ON two_factor_attempts(user_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_ip ON two_factor_attempts(request_ip);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_type ON two_factor_attempts(attempt_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_rate_limit ON two_factor_attempts(user_id, request_ip, created_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_blocked ON two_factor_attempts(blocked_until);`
  );

  // Two-factor audit log indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_audit_cooperative ON two_factor_audit_log(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_audit_user ON two_factor_audit_log(user_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_audit_event_type ON two_factor_audit_log(event_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_audit_created ON two_factor_audit_log(created_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_audit_risk ON two_factor_audit_log(risk_level);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_two_factor_audit_retention ON two_factor_audit_log(retention_until);`
  );

  // Feature flags indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flags_cooperative ON feature_flags(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flags_key_cooperative ON feature_flags(key, cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flags_status ON feature_flags(status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(is_enabled, status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flags_environment ON feature_flags(environment);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flags_expires ON feature_flags(expires_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flags_active ON feature_flags(cooperative_id, is_enabled, status) WHERE deleted_at IS NULL;`
  );

  // Feature flag usage indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_usage_cooperative ON feature_flag_usage(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_usage_flag ON feature_flag_usage(feature_flag_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_usage_key ON feature_flag_usage(feature_key);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_usage_user ON feature_flag_usage(user_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_usage_created ON feature_flag_usage(created_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_usage_lookup ON feature_flag_usage(feature_key, cooperative_id, created_at);`
  );

  // Feature flag variants indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_variants_cooperative ON feature_flag_variants(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_variants_flag ON feature_flag_variants(feature_flag_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_variants_key ON feature_flag_variants(key);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_variants_active ON feature_flag_variants(feature_flag_id, is_active);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_flag_variants_control ON feature_flag_variants(feature_flag_id, is_control);`
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

  // Webhook endpoints indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_cooperative ON webhook_endpoints(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_service_type ON webhook_endpoints(service_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints(is_active, environment);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_health ON webhook_endpoints(cooperative_id, consecutive_failures, is_active);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_name ON webhook_endpoints(cooperative_id, name);`
  );

  // Webhook events indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_cooperative ON webhook_events(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_endpoint ON webhook_events(endpoint_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source_service);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(delivery_status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_correlation ON webhook_events(correlation_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_retry ON webhook_events(delivery_status, next_retry_at) WHERE delivery_status = 'retrying';`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_events_failed ON webhook_events(cooperative_id, delivery_status, created_at) WHERE delivery_status = 'failed';`
  );

  // Webhook subscriptions indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_cooperative ON webhook_subscriptions(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_endpoint ON webhook_subscriptions(endpoint_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_event_type ON webhook_subscriptions(event_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(endpoint_id, is_active);`
  );

  // Webhook templates indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_templates_cooperative ON webhook_templates(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_templates_service ON webhook_templates(service_type, event_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_templates_category ON webhook_templates(category);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_templates_active ON webhook_templates(is_active, is_system_template);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_templates_usage ON webhook_templates(usage_count, last_used_at);`
  );

  // Webhook rate limits indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_cooperative ON webhook_rate_limits(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_endpoint ON webhook_rate_limits(endpoint_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_window ON webhook_rate_limits(endpoint_id, window_start, window_end);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_exceeded ON webhook_rate_limits(limit_exceeded, window_end);`
  );

  // Webhook simulator sessions indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_simulator_sessions_cooperative ON webhook_simulator_sessions(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_simulator_sessions_service ON webhook_simulator_sessions(service_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_simulator_sessions_active ON webhook_simulator_sessions(is_active);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_webhook_simulator_sessions_created_by ON webhook_simulator_sessions(created_by);`
  );

  // Bulk upload batches indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_batches_cooperative ON bulk_upload_batches(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_batches_batch_number ON bulk_upload_batches(cooperative_id, batch_number);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_batches_status ON bulk_upload_batches(status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_batches_uploaded_by ON bulk_upload_batches(uploaded_by);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_batches_created_at ON bulk_upload_batches(created_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_batches_queue_priority ON bulk_upload_batches(queue_priority, queue_position);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_batches_active ON bulk_upload_batches(cooperative_id, status) WHERE deleted_at IS NULL;`
  );

  // Bulk upload queue indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_queue_cooperative ON bulk_upload_queue(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_queue_batch ON bulk_upload_queue(batch_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_queue_status ON bulk_upload_queue(status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_queue_priority ON bulk_upload_queue(priority, queue_position);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_queue_worker ON bulk_upload_queue(worker_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_queue_scheduled ON bulk_upload_queue(scheduled_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_queue_retry ON bulk_upload_queue(status, next_retry_at) WHERE status = 'failed';`
  );

  // Bulk upload files indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_cooperative ON bulk_upload_files(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_batch ON bulk_upload_files(batch_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_upload_status ON bulk_upload_files(upload_status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_processing_status ON bulk_upload_files(processing_status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_processing_order ON bulk_upload_files(batch_id, processing_order);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_hash_md5 ON bulk_upload_files(file_hash_md5);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_hash_sha256 ON bulk_upload_files(file_hash_sha256);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_duplicate ON bulk_upload_files(is_duplicate, duplicate_of_file_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_virus_scan ON bulk_upload_files(virus_scan_status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_document ON bulk_upload_files(document_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_validation ON bulk_upload_files(validation_status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_manual_review ON bulk_upload_files(requires_manual_review, manual_review_completed);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_approval ON bulk_upload_files(approval_status);`
  );

  // Bulk upload workers indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_workers_name ON bulk_upload_workers(worker_name);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_workers_type ON bulk_upload_workers(worker_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_workers_status ON bulk_upload_workers(status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_workers_health ON bulk_upload_workers(health_status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_workers_heartbeat ON bulk_upload_workers(last_heartbeat_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_workers_available ON bulk_upload_workers(status, health_status, current_batches);`
  );

  // Bulk upload events indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_events_cooperative ON bulk_upload_events(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_events_batch ON bulk_upload_events(batch_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_events_file ON bulk_upload_events(file_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_events_worker ON bulk_upload_events(worker_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_events_type ON bulk_upload_events(event_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_events_level ON bulk_upload_events(event_level);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_events_created ON bulk_upload_events(created_at);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_events_correlation ON bulk_upload_events(correlation_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_events_lookup ON bulk_upload_events(cooperative_id, event_type, created_at);`
  );

  // Bulk upload settings indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_bulk_upload_settings_cooperative ON bulk_upload_settings(cooperative_id);`
  );

  // File duplicates indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_file_duplicates_cooperative ON file_duplicates(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_file_duplicates_original ON file_duplicates(original_file_id, original_file_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_file_duplicates_duplicate ON file_duplicates(duplicate_file_id, duplicate_file_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_file_duplicates_status ON file_duplicates(status, confidence_level);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_file_duplicates_algorithm ON file_duplicates(detection_algorithm, similarity_score);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_file_duplicates_hashes ON file_duplicates(original_hash_md5, duplicate_hash_md5);`
  );

  // Duplicate detection rules indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_rules_cooperative ON duplicate_detection_rules(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_rules_active ON duplicate_detection_rules(is_active, priority);`
  );

  // Duplicate detection sessions indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_sessions_cooperative ON duplicate_detection_sessions(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_sessions_batch ON duplicate_detection_sessions(batch_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_sessions_status ON duplicate_detection_sessions(session_status, started_at);`
  );

  // Duplicate groups indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_groups_cooperative ON duplicate_groups(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_groups_session ON duplicate_groups(detection_session_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_groups_status ON duplicate_groups(resolution_status);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_groups_master ON duplicate_groups(master_file_id, master_file_type);`
  );

  // Duplicate group members indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_group_members_group ON duplicate_group_members(group_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_group_members_cooperative ON duplicate_group_members(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_group_members_file ON duplicate_group_members(file_id, file_type);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_group_members_status ON duplicate_group_members(member_status);`
  );

  // Duplicate detection statistics indexes
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_stats_cooperative ON duplicate_detection_stats(cooperative_id);`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_duplicate_stats_date ON duplicate_detection_stats(stats_date, stats_period);`
  );

  // Create error logging indexes
  createErrorLogIndexes(db);
  
  // Create file size limit indexes
  createFileSizeLimitIndexes(db);
  
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
    'board_meetings',
    'energy_consumption',
    'contractor_ratings',
    'booking_resources',
    'bookings',
    'queue_positions',
    'loans',
    'loan_payments',
    'password_reset_tokens',
    'password_reset_attempts',
    'two_factor_secrets',
    'two_factor_backup_codes',
    'feature_flags',
    'feature_flag_variants',
    'webhook_endpoints',
    'webhook_events',
    'webhook_subscriptions',
    'webhook_templates',
    'webhook_rate_limits',
    'webhook_simulator_sessions',
    'bulk_upload_batches',
    'bulk_upload_queue',
    'bulk_upload_files',
    'bulk_upload_workers',
    'bulk_upload_settings',
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
  const auditTables = [
    'cooperatives',
    'invoices', 
    'members', 
    'apartments', 
    'cases',
    'board_meetings',
    'contractor_ratings',
    'bookings',
    'queue_positions',
    'loans',
    'feature_flags',
    'webhook_endpoints',
    'webhook_events',
    'webhook_templates',
    'bulk_upload_batches',
    'bulk_upload_files'
  ];
  const tablesWithSoftDelete = ['cooperatives', 'invoices', 'members', 'apartments', 'webhook_endpoints', 'bulk_upload_batches']; // Tables that have deleted_at column

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

  // Create error logging triggers
  createErrorLogTriggers(db);
  
  // Create file size limit triggers
  createFileSizeLimitTriggers(db);
  
  console.log('✅ Database triggers created successfully');
};

// Helper function to get table columns for audit triggers
function getTableColumns(table: string): string[] {
  const commonColumns = ['id', 'cooperative_id', 'created_at', 'updated_at'];

  const tableSpecificColumns: { [key: string]: string[] } = {
    cooperatives: [
      ...commonColumns,
      'org_number',
      'name',
      'subdomain',
      'registration_date',
      'accounting_standard',
      'fiscal_year_end',
      'annual_report_filed',
      'tax_number',
      'building_year',
      'total_apartments',
      'total_area_sqm',
      'property_designation',
      'land_lease',
      'energy_certificate',
      'energy_certificate_expires',
      'district_heating',
      'green_certification',
      'default_interest_rate',
      'payment_reminder_fee',
      'debt_collection_fee',
      'bank_account_number',
      'bankgiro_number',
      'plusgiro_number',
    ],
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
    board_meetings: [
      ...commonColumns,
      'meeting_number',
      'title',
      'meeting_type',
      'scheduled_date',
      'status',
    ],
    contractor_ratings: [
      ...commonColumns,
      'contractor_name',
      'category',
      'overall_rating',
      'would_recommend',
      'rated_by',
    ],
    bookings: [
      ...commonColumns,
      'resource_id',
      'member_id',
      'booking_date',
      'status',
    ],
    queue_positions: [
      ...commonColumns,
      'queue_number',
      'first_name',
      'last_name',
      'email',
      'status',
    ],
    loans: [
      ...commonColumns,
      'loan_number',
      'lender_name',
      'original_amount',
      'current_balance',
      'status',
    ],
    feature_flags: [
      ...commonColumns,
      'key',
      'name',
      'is_enabled',
      'category',
      'status',
      'rollout_percentage',
      'created_by',
      'updated_by',
    ],
    bulk_upload_batches: [
      ...commonColumns,
      'batch_name',
      'batch_number',
      'status',
      'uploaded_by',
      'total_files',
      'files_completed',
      'files_failed',
      'progress_percentage',
    ],
    bulk_upload_files: [
      ...commonColumns,
      'batch_id',
      'original_filename',
      'upload_status',
      'processing_status',
      'validation_status',
      'document_id',
      'approval_status',
    ],
  };

  return tableSpecificColumns[table] || commonColumns;
}

export const dropSchema = (db: Database.Database): void => {
  console.log('Dropping database schema...');

  const tables = [
    'bulk_upload_events',
    'bulk_upload_settings',
    'bulk_upload_files',
    'bulk_upload_workers',
    'bulk_upload_queue',
    'bulk_upload_batches',
    'webhook_simulator_sessions',
    'webhook_rate_limits',
    'webhook_subscriptions',
    'webhook_templates',
    'webhook_events',
    'webhook_endpoints',
    'feature_flag_usage',
    'feature_flag_variants',
    'feature_flags',
    'two_factor_audit_log',
    'two_factor_attempts',
    'two_factor_backup_codes',
    'two_factor_secrets',
    'audit_log',
    'password_reset_attempts',
    'password_reset_tokens',
    'loan_payments',
    'loans',
    'bookings',
    'booking_resources',
    'queue_positions',
    'contractor_ratings',
    'energy_consumption',
    'board_meetings',
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
