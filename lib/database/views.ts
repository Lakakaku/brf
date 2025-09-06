/**
 * Database views with built-in cooperative filtering for BRF Portal
 * 
 * This module creates and manages database views that automatically filter
 * data by cooperative_id to support Row-Level Security implementation.
 */

import Database from 'better-sqlite3';

/**
 * Create all cooperative-filtered views
 */
export function createCooperativeViews(db: Database.Database): void {
  console.log('Creating cooperative-filtered database views...');

  // Members view with role-based filtering
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_active_members AS
    SELECT 
      id,
      cooperative_id,
      user_id,
      email,
      first_name,
      last_name,
      phone,
      role,
      permissions,
      is_active,
      created_at,
      updated_at,
      last_login_at
    FROM members
    WHERE is_active = 1 AND deleted_at IS NULL;
  `);

  // Apartments with owner information
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_apartments_with_owners AS
    SELECT 
      a.id,
      a.cooperative_id,
      a.apartment_number,
      a.share_number,
      a.size_sqm,
      a.rooms,
      a.floor,
      a.building,
      a.monthly_fee,
      a.share_capital,
      a.ownership_date,
      a.created_at,
      a.updated_at,
      m.id as owner_id,
      m.first_name as owner_first_name,
      m.last_name as owner_last_name,
      m.email as owner_email,
      m.phone as owner_phone
    FROM apartments a
    LEFT JOIN members m ON a.owner_id = m.id AND m.deleted_at IS NULL
    ORDER BY a.apartment_number;
  `);

  // Outstanding monthly fees
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_outstanding_monthly_fees AS
    SELECT 
      mf.id,
      mf.cooperative_id,
      mf.apartment_id,
      mf.year,
      mf.month,
      mf.total_amount,
      mf.payment_status,
      mf.ocr_number,
      mf.created_at,
      a.apartment_number,
      m.first_name as owner_first_name,
      m.last_name as owner_last_name,
      m.email as owner_email,
      CASE 
        WHEN mf.payment_status = 'pending' AND date('now') > date(mf.year || '-' || printf('%02d', mf.month) || '-28')
        THEN 'overdue'
        ELSE mf.payment_status
      END as effective_status
    FROM monthly_fees mf
    JOIN apartments a ON mf.apartment_id = a.id
    LEFT JOIN members m ON a.owner_id = m.id AND m.deleted_at IS NULL
    WHERE mf.payment_status IN ('pending', 'overdue')
    ORDER BY mf.year DESC, mf.month DESC, a.apartment_number;
  `);

  // Outstanding invoices with payment status
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_outstanding_invoices AS
    SELECT 
      i.id,
      i.cooperative_id,
      i.invoice_number,
      i.supplier_name,
      i.supplier_org_number,
      i.total_amount,
      i.currency,
      i.invoice_date,
      i.due_date,
      i.payment_status,
      i.ocr_number,
      i.account_code,
      i.cost_center,
      i.created_at,
      CASE 
        WHEN i.payment_status = 'pending' AND date('now') > date(i.due_date)
        THEN julianday('now') - julianday(i.due_date)
        ELSE 0
      END as days_overdue,
      d.filename as document_filename
    FROM invoices i
    LEFT JOIN documents d ON i.document_id = d.id
    WHERE i.payment_status IN ('pending', 'overdue')
    ORDER BY i.due_date ASC;
  `);

  // Active cases with assignee information
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_active_cases AS
    SELECT 
      c.id,
      c.cooperative_id,
      c.case_number,
      c.title,
      c.description,
      c.category,
      c.priority,
      c.status,
      c.location,
      c.apartment_id,
      c.reported_at,
      c.started_at,
      c.created_at,
      c.updated_at,
      a.apartment_number,
      reporter.first_name as reporter_first_name,
      reporter.last_name as reporter_last_name,
      reporter.email as reporter_email,
      assignee.first_name as assignee_first_name,
      assignee.last_name as assignee_last_name,
      assignee.email as assignee_email,
      CASE 
        WHEN c.status = 'open' AND date('now') > date(c.reported_at, '+7 days')
        THEN 'urgent'
        ELSE c.priority
      END as effective_priority
    FROM cases c
    LEFT JOIN apartments a ON c.apartment_id = a.id
    LEFT JOIN members reporter ON c.reported_by = reporter.id AND reporter.deleted_at IS NULL
    LEFT JOIN members assignee ON c.assigned_to = assignee.id AND assignee.deleted_at IS NULL
    WHERE c.status NOT IN ('resolved', 'closed')
    ORDER BY 
      CASE c.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        WHEN 'low' THEN 4 
      END,
      c.reported_at ASC;
  `);

  // Upcoming board meetings
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_upcoming_board_meetings AS
    SELECT 
      bm.id,
      bm.cooperative_id,
      bm.meeting_number,
      bm.title,
      bm.meeting_type,
      bm.scheduled_date,
      bm.scheduled_time,
      bm.location,
      bm.notice_sent_date,
      bm.status,
      bm.quorum_met,
      bm.created_at,
      CASE 
        WHEN date('now') > date(bm.scheduled_date) AND bm.status = 'planned'
        THEN 'overdue'
        ELSE bm.status
      END as effective_status,
      CASE 
        WHEN bm.notice_sent_date IS NULL AND date(bm.scheduled_date) <= date('now', '+7 days')
        THEN 1
        ELSE 0
      END as notice_required
    FROM board_meetings bm
    WHERE bm.status IN ('planned', 'in_progress')
    ORDER BY bm.scheduled_date ASC;
  `);

  // Energy consumption with efficiency metrics
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_energy_consumption_analysis AS
    SELECT 
      ec.id,
      ec.cooperative_id,
      ec.year,
      ec.month,
      ec.electricity_kwh,
      ec.heating_kwh,
      ec.hot_water_kwh,
      ec.cooling_kwh,
      ec.total_cost,
      ec.kwh_per_sqm,
      ec.cost_per_sqm,
      ec.outdoor_temp_avg,
      ec.data_quality,
      ec.created_at,
      c.total_area_sqm,
      c.total_apartments,
      -- Calculate month-over-month changes
      LAG(ec.total_cost, 1) OVER (
        PARTITION BY ec.cooperative_id 
        ORDER BY ec.year, ec.month
      ) as prev_month_cost,
      LAG(ec.electricity_kwh + ec.heating_kwh + ec.hot_water_kwh + ec.cooling_kwh, 1) OVER (
        PARTITION BY ec.cooperative_id 
        ORDER BY ec.year, ec.month
      ) as prev_month_kwh
    FROM energy_consumption ec
    JOIN cooperatives c ON ec.cooperative_id = c.id AND c.deleted_at IS NULL
    ORDER BY ec.year DESC, ec.month DESC;
  `);

  // Booking availability for resources
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_booking_availability AS
    SELECT 
      br.id as resource_id,
      br.cooperative_id,
      br.name as resource_name,
      br.resource_type,
      br.description,
      br.location,
      br.capacity,
      br.booking_fee,
      br.is_active,
      br.out_of_order,
      br.available_from_time,
      br.available_to_time,
      br.available_weekdays,
      COUNT(b.id) as active_bookings,
      MAX(b.booking_date) as last_booking_date
    FROM booking_resources br
    LEFT JOIN bookings b ON br.id = b.resource_id 
      AND b.status IN ('confirmed', 'pending')
      AND date(b.booking_date) >= date('now')
    WHERE br.is_active = 1 AND br.out_of_order = 0
    GROUP BY br.id, br.cooperative_id, br.name, br.resource_type, br.description, 
             br.location, br.capacity, br.booking_fee, br.is_active, br.out_of_order,
             br.available_from_time, br.available_to_time, br.available_weekdays
    ORDER BY br.resource_type, br.name;
  `);

  // Contractor performance ratings
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_contractor_performance AS
    SELECT 
      cooperative_id,
      contractor_name,
      contractor_org_number,
      category,
      COUNT(*) as total_projects,
      AVG(overall_rating) as avg_overall_rating,
      AVG(quality_rating) as avg_quality_rating,
      AVG(timeliness_rating) as avg_timeliness_rating,
      AVG(communication_rating) as avg_communication_rating,
      AVG(price_rating) as avg_price_rating,
      SUM(project_value) as total_project_value,
      SUM(CASE WHEN would_recommend = 1 THEN 1 ELSE 0 END) as recommendations,
      MAX(created_at) as last_rating_date,
      is_approved_contractor,
      blacklisted
    FROM contractor_ratings
    WHERE blacklisted = 0
    GROUP BY cooperative_id, contractor_name, contractor_org_number, category, 
             is_approved_contractor, blacklisted
    HAVING COUNT(*) >= 1
    ORDER BY avg_overall_rating DESC, total_projects DESC;
  `);

  // Queue statistics and waiting times
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_queue_statistics AS
    SELECT 
      qp.cooperative_id,
      qp.queue_type,
      COUNT(*) as total_in_queue,
      COUNT(CASE WHEN qp.status = 'active' THEN 1 END) as active_positions,
      MIN(qp.queue_number) as first_queue_number,
      MAX(qp.queue_number) as last_queue_number,
      AVG(julianday('now') - julianday(qp.registration_date)) as avg_waiting_days,
      MIN(qp.registration_date) as oldest_registration,
      MAX(qp.registration_date) as newest_registration,
      SUM(qp.offers_received) as total_offers_made,
      SUM(qp.offers_declined) as total_offers_declined
    FROM queue_positions qp
    WHERE qp.status = 'active'
    GROUP BY qp.cooperative_id, qp.queue_type
    ORDER BY qp.queue_type;
  `);

  // Financial summary view
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_financial_summary AS
    SELECT 
      c.id as cooperative_id,
      c.name as cooperative_name,
      
      -- Monthly fee income (current month)
      COALESCE(mf.monthly_fee_income, 0) as current_monthly_fee_income,
      COALESCE(mf.outstanding_fees, 0) as outstanding_monthly_fees,
      
      -- Outstanding invoices
      COALESCE(inv.outstanding_invoices, 0) as outstanding_invoice_amount,
      COALESCE(inv.overdue_invoices, 0) as overdue_invoice_amount,
      
      -- Energy costs (current month)
      COALESCE(ec.current_energy_cost, 0) as current_energy_cost,
      
      -- Loan information
      COALESCE(l.total_loan_balance, 0) as total_loan_balance,
      COALESCE(l.monthly_loan_payments, 0) as monthly_loan_payments
      
    FROM cooperatives c
    
    LEFT JOIN (
      SELECT 
        cooperative_id,
        SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as monthly_fee_income,
        SUM(CASE WHEN payment_status IN ('pending', 'overdue') THEN total_amount ELSE 0 END) as outstanding_fees
      FROM monthly_fees 
      WHERE year = strftime('%Y', 'now') AND month = strftime('%m', 'now')
      GROUP BY cooperative_id
    ) mf ON c.id = mf.cooperative_id
    
    LEFT JOIN (
      SELECT 
        cooperative_id,
        SUM(CASE WHEN payment_status IN ('pending', 'overdue') THEN total_amount ELSE 0 END) as outstanding_invoices,
        SUM(CASE WHEN payment_status = 'overdue' THEN total_amount ELSE 0 END) as overdue_invoices
      FROM invoices
      GROUP BY cooperative_id
    ) inv ON c.id = inv.cooperative_id
    
    LEFT JOIN (
      SELECT 
        cooperative_id,
        total_cost as current_energy_cost
      FROM energy_consumption 
      WHERE year = strftime('%Y', 'now') AND month = strftime('%m', 'now')
    ) ec ON c.id = ec.cooperative_id
    
    LEFT JOIN (
      SELECT 
        cooperative_id,
        SUM(current_balance) as total_loan_balance,
        SUM(monthly_payment) as monthly_loan_payments
      FROM loans 
      WHERE status = 'active'
      GROUP BY cooperative_id
    ) l ON c.id = l.cooperative_id
    
    WHERE c.deleted_at IS NULL;
  `);

  console.log('✅ Cooperative-filtered database views created successfully');
}

/**
 * Drop all cooperative views
 */
export function dropCooperativeViews(db: Database.Database): void {
  console.log('Dropping cooperative-filtered database views...');

  const views = [
    'v_financial_summary',
    'v_queue_statistics', 
    'v_contractor_performance',
    'v_booking_availability',
    'v_energy_consumption_analysis',
    'v_upcoming_board_meetings',
    'v_active_cases',
    'v_outstanding_invoices',
    'v_outstanding_monthly_fees',
    'v_apartments_with_owners',
    'v_active_members'
  ];

  views.forEach(view => {
    db.exec(`DROP VIEW IF EXISTS ${view};`);
  });

  console.log('✅ Cooperative-filtered database views dropped successfully');
}

/**
 * Refresh materialized views (if needed for performance)
 */
export function refreshViews(db: Database.Database): void {
  // Since SQLite views are not materialized, no action needed
  // This function is here for future compatibility if we implement materialized views
  console.log('✅ Views refreshed (no action needed for SQLite)');
}

/**
 * Get view definition for debugging
 */
export function getViewDefinition(db: Database.Database, viewName: string): string | null {
  try {
    const result = db.prepare(`
      SELECT sql FROM sqlite_master 
      WHERE type = 'view' AND name = ?
    `).get(viewName) as { sql: string } | undefined;
    
    return result?.sql || null;
  } catch (error) {
    console.error(`Error getting view definition for ${viewName}:`, error);
    return null;
  }
}

/**
 * List all cooperative views
 */
export function listCooperativeViews(db: Database.Database): string[] {
  try {
    const results = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'view' AND name LIKE 'v_%'
      ORDER BY name
    `).all() as { name: string }[];
    
    return results.map(r => r.name);
  } catch (error) {
    console.error('Error listing cooperative views:', error);
    return [];
  }
}