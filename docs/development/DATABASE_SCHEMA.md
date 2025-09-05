# BRF Portal - Database Schema Design

## Multi-Tenant Architecture Overview

The database uses PostgreSQL with Row-Level Security (RLS) to ensure complete data isolation between cooperatives. Every table includes a `cooperative_id` column, and RLS policies enforce that users can only access data from their own cooperative.

## Core Design Principles

1. **Tenant Isolation**: Strict data segregation using RLS
2. **GDPR Compliance**: PII encryption and audit trails
3. **Performance**: Strategic indexing and partitioning
4. **Scalability**: Designed for 10,000+ cooperatives
5. **Audit Trail**: Immutable logging for financial data

## Database Configuration

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geographic data

-- Create custom types
CREATE TYPE user_role AS ENUM ('member', 'board', 'chairman', 'treasurer', 'admin');
CREATE TYPE document_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
CREATE TYPE case_priority AS ENUM ('urgent', 'high', 'normal', 'low');
CREATE TYPE case_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
```

## Core Tables

### Cooperatives Table

```sql
CREATE TABLE cooperatives (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_number VARCHAR(12) UNIQUE NOT NULL, -- Swedish org number
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(63) UNIQUE NOT NULL, -- For multi-tenant routing

    -- Address
    street_address VARCHAR(255),
    postal_code VARCHAR(10),
    city VARCHAR(100),

    -- Configuration
    settings JSONB DEFAULT '{}',
    features JSONB DEFAULT '{"standard": true}', -- Feature flags

    -- Subscription
    subscription_tier VARCHAR(20) DEFAULT 'standard',
    subscription_status VARCHAR(20) DEFAULT 'active',
    trial_ends_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete
);

-- Indexes
CREATE INDEX idx_cooperatives_subdomain ON cooperatives(subdomain);
CREATE INDEX idx_cooperatives_org_number ON cooperatives(org_number);
```

### Members Table (Extended from Supabase Auth)

```sql
-- Supabase auth.users handles authentication
-- We extend it with our member profiles
CREATE TABLE members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id),

    -- Personal information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),

    -- Role and permissions
    role user_role DEFAULT 'member',
    permissions JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    deleted_at TIMESTAMP,

    UNIQUE(user_id, cooperative_id)
);

-- Indexes
CREATE INDEX idx_members_cooperative ON members(cooperative_id);
CREATE INDEX idx_members_user ON members(user_id);

-- RLS Policies using Supabase auth
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_isolation ON members
    FOR ALL
    USING (
        cooperative_id IN (
            SELECT cooperative_id FROM members
            WHERE user_id = auth.uid()
        )
    );
```

### Apartments Table

```sql
CREATE TABLE apartments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id),

    -- Identification
    apartment_number VARCHAR(10) NOT NULL,
    share_number VARCHAR(20),

    -- Physical attributes
    size_sqm DECIMAL(10, 2),
    rooms DECIMAL(3, 1),
    floor INTEGER,
    building VARCHAR(50),

    -- Financial
    monthly_fee DECIMAL(10, 2),
    share_capital DECIMAL(12, 2),

    -- Current ownership
    owner_id UUID REFERENCES members(id),
    ownership_date DATE,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(cooperative_id, apartment_number)
);

-- Indexes
CREATE INDEX idx_apartments_cooperative ON apartments(cooperative_id);
CREATE INDEX idx_apartments_owner ON apartments(owner_id);
```

### Documents Table

```sql
CREATE TABLE documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id),

    -- Document info
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    s3_key VARCHAR(500) NOT NULL,

    -- Classification
    document_type VARCHAR(50), -- invoice, protocol, contract, etc
    category VARCHAR(50),
    tags TEXT[],

    -- Processing status
    status document_status DEFAULT 'pending',
    processed_at TIMESTAMP,
    processing_error TEXT,

    -- Extracted data
    extracted_data JSONB,
    ocr_text TEXT,
    confidence_score DECIMAL(3, 2),

    -- Relations
    uploaded_by UUID REFERENCES members(id),
    related_case_id UUID,
    related_invoice_id UUID,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_documents_cooperative ON documents(cooperative_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_status ON documents(status);
CREATE GIN INDEX idx_documents_tags ON documents USING gin(tags);
CREATE GIN INDEX idx_documents_extracted ON documents USING gin(extracted_data);

-- Full-text search
CREATE INDEX idx_documents_fts ON documents USING gin(to_tsvector('swedish', ocr_text));
```

### Financial Tables

#### Invoices

```sql
CREATE TABLE invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id),

    -- Invoice details
    invoice_number VARCHAR(100),
    supplier_name VARCHAR(255),
    supplier_org_number VARCHAR(20),

    -- Amounts
    amount_excl_vat DECIMAL(12, 2),
    vat_amount DECIMAL(12, 2),
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'SEK',

    -- Dates
    invoice_date DATE,
    due_date DATE,
    payment_date DATE,

    -- Payment info
    payment_status payment_status DEFAULT 'pending',
    ocr_number VARCHAR(30),
    bankgiro VARCHAR(20),
    plusgiro VARCHAR(20),

    -- Accounting
    account_code VARCHAR(10),
    cost_center VARCHAR(20),
    project_code VARCHAR(20),

    -- Relations
    document_id UUID REFERENCES documents(id),
    approved_by UUID REFERENCES members(id),
    case_id UUID,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_invoices_cooperative ON invoices(cooperative_id);
CREATE INDEX idx_invoices_status ON invoices(payment_status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
```

#### Monthly Fees

```sql
CREATE TABLE monthly_fees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id),
    apartment_id UUID REFERENCES apartments(id),

    -- Period
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,

    -- Amounts
    base_fee DECIMAL(10, 2),
    parking_fee DECIMAL(10, 2),
    storage_fee DECIMAL(10, 2),
    other_fees JSONB DEFAULT '{}',
    total_amount DECIMAL(10, 2) NOT NULL,

    -- Payment
    payment_status payment_status DEFAULT 'pending',
    paid_date DATE,
    payment_method VARCHAR(20), -- autogiro, invoice, swish

    -- References
    ocr_number VARCHAR(30) UNIQUE,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(apartment_id, year, month)
);

-- Indexes
CREATE INDEX idx_monthly_fees_cooperative ON monthly_fees(cooperative_id);
CREATE INDEX idx_monthly_fees_apartment ON monthly_fees(apartment_id);
CREATE INDEX idx_monthly_fees_period ON monthly_fees(year, month);
CREATE INDEX idx_monthly_fees_status ON monthly_fees(payment_status);
```

### Case Management

```sql
CREATE TABLE cases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id),

    -- Case details
    case_number SERIAL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),

    -- Priority and status
    priority case_priority DEFAULT 'normal',
    status case_status DEFAULT 'open',

    -- Location
    location VARCHAR(100), -- apartment, laundry, garage, etc
    apartment_id UUID REFERENCES apartments(id),

    -- People involved
    reported_by UUID REFERENCES members(id),
    assigned_to UUID REFERENCES members(id),
    contractor_id UUID,

    -- Timeline
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_cases_cooperative ON cases(cooperative_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_priority ON cases(priority);
CREATE INDEX idx_cases_reported_by ON cases(reported_by);
```

### Communication Tables

#### Notifications

```sql
CREATE TABLE notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id),

    -- Recipient
    member_id UUID REFERENCES members(id),

    -- Content
    type VARCHAR(50), -- payment_reminder, case_update, announcement
    title VARCHAR(255),
    message TEXT,
    data JSONB,

    -- Delivery
    channels TEXT[], -- email, sms, push, in_app
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_notifications_member ON notifications(member_id);
CREATE INDEX idx_notifications_unread ON notifications(member_id, is_read) WHERE is_read = false;
```

### Audit Trail

```sql
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    cooperative_id UUID NOT NULL,

    -- Actor
    user_id UUID,
    user_role VARCHAR(20),
    ip_address INET,
    user_agent TEXT,

    -- Action
    action VARCHAR(50), -- create, update, delete, approve, etc
    entity_type VARCHAR(50), -- invoice, member, document, etc
    entity_id UUID,

    -- Changes
    old_values JSONB,
    new_values JSONB,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partitioning by month for performance
CREATE TABLE audit_log_2025_01 PARTITION OF audit_log
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Indexes
CREATE INDEX idx_audit_cooperative ON audit_log(cooperative_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

## Row-Level Security (RLS) Setup

```sql
-- Enable RLS on all tenant tables
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for each table
CREATE POLICY apartments_isolation ON apartments
    FOR ALL
    USING (cooperative_id = current_setting('app.current_cooperative')::uuid);

CREATE POLICY documents_isolation ON documents
    FOR ALL
    USING (cooperative_id = current_setting('app.current_cooperative')::uuid);

CREATE POLICY invoices_isolation ON invoices
    FOR ALL
    USING (cooperative_id = current_setting('app.current_cooperative')::uuid);

-- Function to set current cooperative
CREATE OR REPLACE FUNCTION set_current_cooperative(coop_id UUID)
RETURNS void AS $
BEGIN
    PERFORM set_config('app.current_cooperative', coop_id::text, false);
END;
$ LANGUAGE plpgsql;
```

## Database Functions

### Automatic Updated Timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_cooperatives_updated_at BEFORE UPDATE ON cooperatives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ... repeat for all tables
```

### Generate OCR Number

```sql
CREATE OR REPLACE FUNCTION generate_ocr_number(
    coop_id INTEGER,
    apartment_num INTEGER,
    year INTEGER,
    month INTEGER
) RETURNS VARCHAR AS $
DECLARE
    base_number VARCHAR;
    check_digit INTEGER;
BEGIN
    base_number := LPAD(coop_id::text, 4, '0') ||
                   LPAD(apartment_num::text, 4, '0') ||
                   year::text ||
                   LPAD(month::text, 2, '0');

    -- Luhn algorithm for check digit
    check_digit := calculate_luhn_check_digit(base_number);

    RETURN base_number || check_digit::text;
END;
$ LANGUAGE plpgsql;
```

## Migration Strategy

### Initial Setup

```sql
-- Migration 001: Create base schema
BEGIN;
    -- Create all tables
    -- Create indexes
    -- Setup RLS
COMMIT;

-- Migration 002: Seed initial data
BEGIN;
    -- Insert default cooperatives
    -- Insert test users
    -- Insert sample documents
COMMIT;
```

### Data Migration from Legacy Systems

```sql
-- Import from Excel/CSV
COPY apartments_import FROM '/tmp/apartments.csv' CSV HEADER;

-- Transform and insert
INSERT INTO apartments (cooperative_id, apartment_number, size_sqm, rooms)
SELECT
    '${COOPERATIVE_ID}',
    apartment_number,
    CAST(size AS DECIMAL),
    CAST(rooms AS DECIMAL)
FROM apartments_import;
```

## Performance Optimizations

### Indexing Strategy

```sql
-- Composite indexes for common queries
CREATE INDEX idx_monthly_fees_lookup
    ON monthly_fees(cooperative_id, year, month, payment_status);

CREATE INDEX idx_documents_search
    ON documents(cooperative_id, document_type, status);

-- Partial indexes for active records
CREATE INDEX idx_members_active
    ON members(cooperative_id, email)
    WHERE is_active = true AND deleted_at IS NULL;
```

### Query Optimization Examples

```sql
-- Efficient member lookup with apartment
CREATE VIEW member_apartments AS
SELECT
    m.*,
    a.apartment_number,
    a.size_sqm,
    a.monthly_fee
FROM members m
LEFT JOIN apartments a ON a.owner_id = m.id
WHERE m.deleted_at IS NULL;

-- Materialized view for dashboard stats
CREATE MATERIALIZED VIEW cooperative_stats AS
SELECT
    cooperative_id,
    COUNT(DISTINCT apartment_id) as total_apartments,
    COUNT(DISTINCT CASE WHEN role = 'board' THEN id END) as board_members,
    COUNT(DISTINCT id) as total_members,
    AVG(monthly_fee) as avg_monthly_fee
FROM members m
JOIN apartments a ON a.cooperative_id = m.cooperative_id
GROUP BY cooperative_id;

-- Refresh daily
CREATE INDEX ON cooperative_stats(cooperative_id);
```

## Backup and Recovery

### Backup Strategy

```sql
-- Continuous archiving
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'aws s3 cp %p s3://backup/wal/%f';

-- Point-in-time recovery
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET max_wal_senders = 3;
```

### Data Retention

```sql
-- Archive old audit logs
CREATE TABLE audit_log_archive (LIKE audit_log INCLUDING ALL);

-- Move old data
INSERT INTO audit_log_archive
SELECT * FROM audit_log
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM audit_log
WHERE created_at < NOW() - INTERVAL '1 year';
```

---

_Schema Version: 1.0_
_Last Updated: January 2025_
