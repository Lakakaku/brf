/**
 * BankID Audit Logging System
 * Comprehensive logging for BankID authentication attempts and security events
 */

import Database from 'better-sqlite3';

/**
 * BankID audit event types
 */
export enum BankIDEventType {
  AUTH_INITIATED = 'auth_initiated',
  AUTH_STARTED = 'auth_started',
  AUTH_PENDING = 'auth_pending',
  AUTH_USER_SIGN = 'auth_user_sign',
  AUTH_COMPLETED = 'auth_completed',
  AUTH_FAILED = 'auth_failed',
  AUTH_CANCELLED = 'auth_cancelled',
  AUTH_EXPIRED = 'auth_expired',
  QR_GENERATED = 'qr_generated',
  QR_REFRESHED = 'qr_refreshed',
  DEVICE_SWITCH = 'device_switch',
  RATE_LIMITED = 'rate_limited',
  SECURITY_VIOLATION = 'security_violation',
  CONFIG_CHANGED = 'config_changed',
}

/**
 * BankID audit event severity levels
 */
export enum BankIDEventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * BankID audit event interface
 */
export interface BankIDAuditEvent {
  id?: string;
  eventType: BankIDEventType;
  severity: BankIDEventSeverity;
  
  // Session information
  sessionId?: string;
  orderRef?: string;
  
  // User information (anonymized if needed)
  userId?: string;
  cooperativeId?: string;
  personnummer?: string; // Hashed for privacy
  ipAddress: string;
  userAgent: string;
  
  // Request details
  method: 'same-device' | 'other-device' | 'unknown';
  endpoint?: string;
  
  // Technical details
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
  hintCode?: string;
  
  // Timing information
  duration?: number; // milliseconds
  timestamp: Date;
  
  // Geographic information
  country?: string;
  city?: string;
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  // Privacy and compliance
  gdprProcessed: boolean;
  retentionDate: Date; // When to delete this record
}

/**
 * BankID audit statistics
 */
export interface BankIDAuditStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  cancelledAttempts: number;
  averageDuration: number;
  
  // By time period
  attemptsLastHour: number;
  attemptsLastDay: number;
  attemptsLastWeek: number;
  
  // By method
  sameDeviceAttempts: number;
  otherDeviceAttempts: number;
  
  // Error breakdown
  topErrors: Array<{ errorCode: string; count: number; percentage: number }>;
  
  // Geographic distribution
  topCountries: Array<{ country: string; count: number; percentage: number }>;
  
  // Rate limiting
  rateLimitedAttempts: number;
  suspiciousAttempts: number;
}

/**
 * BankID audit logger class
 */
export class BankIDAuditLogger {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
    this.createTables();
  }

  /**
   * Create audit tables
   */
  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bankid_audit_log (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        
        -- Session information
        session_id TEXT,
        order_ref TEXT,
        
        -- User information (anonymized)
        user_id TEXT,
        cooperative_id TEXT,
        personnummer_hash TEXT, -- SHA-256 hash for privacy
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        
        -- Request details
        method TEXT,
        endpoint TEXT,
        
        -- Technical details
        status_code INTEGER,
        error_code TEXT,
        error_message TEXT,
        hint_code TEXT,
        
        -- Timing
        duration INTEGER, -- milliseconds
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        
        -- Geographic
        country TEXT,
        city TEXT,
        
        -- Metadata (JSON)
        metadata TEXT DEFAULT '{}' CHECK (json_valid(metadata)),
        
        -- Compliance
        gdpr_processed INTEGER DEFAULT 0,
        retention_date TEXT NOT NULL,
        
        -- Indexes
        INDEX idx_bankid_audit_timestamp (timestamp),
        INDEX idx_bankid_audit_event_type (event_type),
        INDEX idx_bankid_audit_severity (severity),
        INDEX idx_bankid_audit_user_id (user_id),
        INDEX idx_bankid_audit_cooperative_id (cooperative_id),
        INDEX idx_bankid_audit_ip_address (ip_address),
        INDEX idx_bankid_audit_order_ref (order_ref),
        INDEX idx_bankid_audit_retention (retention_date)
      );
    `);

    // Create cleanup trigger for GDPR compliance
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS cleanup_expired_bankid_audit
      AFTER INSERT ON bankid_audit_log
      BEGIN
        DELETE FROM bankid_audit_log 
        WHERE retention_date < datetime('now');
      END;
    `);
  }

  /**
   * Log a BankID audit event
   */
  async logEvent(event: Omit<BankIDAuditEvent, 'id' | 'timestamp' | 'gdprProcessed' | 'retentionDate'>): Promise<string> {
    const id = this.generateEventId();
    const timestamp = new Date();
    
    // Calculate retention date (2 years for security logs, 6 months for regular events)
    const retentionMonths = event.severity === BankIDEventSeverity.CRITICAL || 
                           event.eventType === BankIDEventType.SECURITY_VIOLATION ? 24 : 6;
    const retentionDate = new Date();
    retentionDate.setMonth(retentionDate.getMonth() + retentionMonths);

    // Hash personnummer for privacy
    const personnummerHash = event.personnummer ? this.hashPersonnummer(event.personnummer) : null;

    const stmt = this.db.prepare(`
      INSERT INTO bankid_audit_log (
        id, event_type, severity, session_id, order_ref, user_id, cooperative_id,
        personnummer_hash, ip_address, user_agent, method, endpoint, status_code,
        error_code, error_message, hint_code, duration, timestamp, country, city,
        metadata, gdpr_processed, retention_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      event.eventType,
      event.severity,
      event.sessionId || null,
      event.orderRef || null,
      event.userId || null,
      event.cooperativeId || null,
      personnummerHash,
      event.ipAddress,
      event.userAgent || null,
      event.method,
      event.endpoint || null,
      event.statusCode || null,
      event.errorCode || null,
      event.errorMessage || null,
      event.hintCode || null,
      event.duration || null,
      timestamp.toISOString(),
      event.country || null,
      event.city || null,
      JSON.stringify(event.metadata || {}),
      0, // GDPR processed flag
      retentionDate.toISOString()
    );

    return id;
  }

  /**
   * Log BankID authentication initiation
   */
  async logAuthInitiated(data: {
    sessionId: string;
    userId?: string;
    cooperativeId: string;
    personnummer?: string;
    ipAddress: string;
    userAgent: string;
    method: 'same-device' | 'other-device';
    metadata?: Record<string, any>;
  }): Promise<string> {
    return this.logEvent({
      eventType: BankIDEventType.AUTH_INITIATED,
      severity: BankIDEventSeverity.INFO,
      sessionId: data.sessionId,
      userId: data.userId,
      cooperativeId: data.cooperativeId,
      personnummer: data.personnummer,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      method: data.method,
      metadata: data.metadata,
    });
  }

  /**
   * Log BankID authentication started
   */
  async logAuthStarted(data: {
    sessionId: string;
    orderRef: string;
    ipAddress: string;
    userAgent: string;
    method: 'same-device' | 'other-device';
    metadata?: Record<string, any>;
  }): Promise<string> {
    return this.logEvent({
      eventType: BankIDEventType.AUTH_STARTED,
      severity: BankIDEventSeverity.INFO,
      sessionId: data.sessionId,
      orderRef: data.orderRef,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      method: data.method,
      metadata: data.metadata,
    });
  }

  /**
   * Log BankID authentication completion
   */
  async logAuthCompleted(data: {
    sessionId: string;
    orderRef: string;
    userId?: string;
    cooperativeId: string;
    personnummer: string;
    ipAddress: string;
    userAgent: string;
    method: 'same-device' | 'other-device';
    duration: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    return this.logEvent({
      eventType: BankIDEventType.AUTH_COMPLETED,
      severity: BankIDEventSeverity.INFO,
      sessionId: data.sessionId,
      orderRef: data.orderRef,
      userId: data.userId,
      cooperativeId: data.cooperativeId,
      personnummer: data.personnummer,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      method: data.method,
      duration: data.duration,
      metadata: data.metadata,
    });
  }

  /**
   * Log BankID authentication failure
   */
  async logAuthFailed(data: {
    sessionId: string;
    orderRef?: string;
    errorCode: string;
    errorMessage: string;
    hintCode?: string;
    ipAddress: string;
    userAgent: string;
    method: 'same-device' | 'other-device';
    duration?: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    return this.logEvent({
      eventType: BankIDEventType.AUTH_FAILED,
      severity: BankIDEventSeverity.WARNING,
      sessionId: data.sessionId,
      orderRef: data.orderRef,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      hintCode: data.hintCode,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      method: data.method,
      duration: data.duration,
      metadata: data.metadata,
    });
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(data: {
    violationType: string;
    description: string;
    ipAddress: string;
    userAgent: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    return this.logEvent({
      eventType: BankIDEventType.SECURITY_VIOLATION,
      severity: BankIDEventSeverity.CRITICAL,
      sessionId: data.sessionId,
      userId: data.userId,
      errorCode: data.violationType,
      errorMessage: data.description,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      method: 'unknown',
      metadata: data.metadata,
    });
  }

  /**
   * Log rate limiting event
   */
  async logRateLimited(data: {
    ipAddress: string;
    userAgent: string;
    attemptCount: number;
    windowDuration: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    return this.logEvent({
      eventType: BankIDEventType.RATE_LIMITED,
      severity: BankIDEventSeverity.WARNING,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      method: 'unknown',
      metadata: {
        attemptCount: data.attemptCount,
        windowDuration: data.windowDuration,
        ...data.metadata,
      },
    });
  }

  /**
   * Get audit statistics
   */
  getAuditStats(cooperativeId?: string, hoursBack: number = 24): BankIDAuditStats {
    const whereClause = cooperativeId ? 'WHERE cooperative_id = ?' : '';
    const params = cooperativeId ? [cooperativeId] : [];

    // Total attempts
    const totalAttempts = this.db.prepare(`
      SELECT COUNT(*) as count FROM bankid_audit_log 
      ${whereClause}
      AND event_type IN ('auth_initiated', 'auth_started')
    `).get(...params)?.count || 0;

    // Successful attempts
    const successfulAttempts = this.db.prepare(`
      SELECT COUNT(*) as count FROM bankid_audit_log 
      ${whereClause}
      AND event_type = 'auth_completed'
    `).get(...params)?.count || 0;

    // Failed attempts
    const failedAttempts = this.db.prepare(`
      SELECT COUNT(*) as count FROM bankid_audit_log 
      ${whereClause}
      AND event_type = 'auth_failed'
    `).get(...params)?.count || 0;

    // Cancelled attempts
    const cancelledAttempts = this.db.prepare(`
      SELECT COUNT(*) as count FROM bankid_audit_log 
      ${whereClause}
      AND event_type = 'auth_cancelled'
    `).get(...params)?.count || 0;

    // Average duration
    const avgDuration = this.db.prepare(`
      SELECT AVG(duration) as avg FROM bankid_audit_log 
      ${whereClause}
      AND event_type = 'auth_completed' AND duration IS NOT NULL
    `).get(...params)?.avg || 0;

    // Recent attempts
    const attemptsLastHour = this.db.prepare(`
      SELECT COUNT(*) as count FROM bankid_audit_log 
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} timestamp > datetime('now', '-1 hour')
      AND event_type IN ('auth_initiated', 'auth_started')
    `).get(...params)?.count || 0;

    // Method breakdown
    const sameDeviceAttempts = this.db.prepare(`
      SELECT COUNT(*) as count FROM bankid_audit_log 
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} method = 'same-device'
      AND event_type IN ('auth_initiated', 'auth_started')
    `).get(...params)?.count || 0;

    // Top errors
    const topErrors = this.db.prepare(`
      SELECT error_code, COUNT(*) as count,
             ROUND(COUNT(*) * 100.0 / ?, 2) as percentage
      FROM bankid_audit_log 
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} event_type = 'auth_failed' AND error_code IS NOT NULL
      GROUP BY error_code
      ORDER BY count DESC
      LIMIT 5
    `).all(...(cooperativeId ? [failedAttempts || 1, cooperativeId] : [failedAttempts || 1]));

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      cancelledAttempts,
      averageDuration: Math.round(avgDuration),
      attemptsLastHour,
      attemptsLastDay: 0, // Would implement similar query
      attemptsLastWeek: 0, // Would implement similar query
      sameDeviceAttempts,
      otherDeviceAttempts: totalAttempts - sameDeviceAttempts,
      topErrors: topErrors.map(row => ({
        errorCode: row.error_code,
        count: row.count,
        percentage: row.percentage,
      })),
      topCountries: [], // Would implement with geographic data
      rateLimitedAttempts: 0, // Would implement
      suspiciousAttempts: 0, // Would implement
    };
  }

  /**
   * Get recent audit events
   */
  getRecentEvents(cooperativeId?: string, limit: number = 100): BankIDAuditEvent[] {
    const whereClause = cooperativeId ? 'WHERE cooperative_id = ?' : '';
    const params = cooperativeId ? [cooperativeId, limit] : [limit];

    const events = this.db.prepare(`
      SELECT * FROM bankid_audit_log 
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(...params);

    return events.map(this.mapRowToEvent);
  }

  /**
   * Search audit events
   */
  searchEvents(criteria: {
    cooperativeId?: string;
    eventType?: BankIDEventType;
    severity?: BankIDEventSeverity;
    ipAddress?: string;
    orderRef?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): BankIDAuditEvent[] {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (criteria.cooperativeId) {
      whereClause += ' AND cooperative_id = ?';
      params.push(criteria.cooperativeId);
    }

    if (criteria.eventType) {
      whereClause += ' AND event_type = ?';
      params.push(criteria.eventType);
    }

    if (criteria.severity) {
      whereClause += ' AND severity = ?';
      params.push(criteria.severity);
    }

    if (criteria.ipAddress) {
      whereClause += ' AND ip_address = ?';
      params.push(criteria.ipAddress);
    }

    if (criteria.orderRef) {
      whereClause += ' AND order_ref = ?';
      params.push(criteria.orderRef);
    }

    if (criteria.fromDate) {
      whereClause += ' AND timestamp >= ?';
      params.push(criteria.fromDate.toISOString());
    }

    if (criteria.toDate) {
      whereClause += ' AND timestamp <= ?';
      params.push(criteria.toDate.toISOString());
    }

    const limit = criteria.limit || 100;
    params.push(limit);

    const events = this.db.prepare(`
      SELECT * FROM bankid_audit_log 
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(...params);

    return events.map(this.mapRowToEvent);
  }

  /**
   * Clean up expired audit records
   */
  cleanupExpiredRecords(): number {
    const result = this.db.prepare(`
      DELETE FROM bankid_audit_log 
      WHERE retention_date < datetime('now')
    `).run();

    return result.changes;
  }

  /**
   * Hash personnummer for privacy compliance
   */
  private hashPersonnummer(personnummer: string): string {
    // In a real implementation, use crypto.createHash('sha256')
    // This is a simple hash for mock purposes
    let hash = 0;
    for (let i = 0; i < personnummer.length; i++) {
      const char = personnummer.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  /**
   * Map database row to audit event
   */
  private mapRowToEvent = (row: any): BankIDAuditEvent => ({
    id: row.id,
    eventType: row.event_type as BankIDEventType,
    severity: row.severity as BankIDEventSeverity,
    sessionId: row.session_id,
    orderRef: row.order_ref,
    userId: row.user_id,
    cooperativeId: row.cooperative_id,
    personnummer: row.personnummer_hash, // This is hashed
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    method: row.method as 'same-device' | 'other-device' | 'unknown',
    endpoint: row.endpoint,
    statusCode: row.status_code,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    hintCode: row.hint_code,
    duration: row.duration,
    timestamp: new Date(row.timestamp),
    country: row.country,
    city: row.city,
    metadata: JSON.parse(row.metadata || '{}'),
    gdprProcessed: Boolean(row.gdpr_processed),
    retentionDate: new Date(row.retention_date),
  });
}

/**
 * Create global audit logger instance
 */
let auditLogger: BankIDAuditLogger | null = null;

export function createBankIDAuditLogger(database: Database.Database): BankIDAuditLogger {
  if (!auditLogger) {
    auditLogger = new BankIDAuditLogger(database);
  }
  return auditLogger;
}

/**
 * Get the global audit logger instance
 */
export function getBankIDAuditLogger(): BankIDAuditLogger {
  if (!auditLogger) {
    throw new Error('BankID audit logger not initialized. Call createBankIDAuditLogger first.');
  }
  return auditLogger;
}

/**
 * Helper function for middleware logging
 */
export async function auditBankIDRequest(
  eventType: BankIDEventType,
  req: any, // Express request object
  additionalData: Record<string, any> = {}
): Promise<string> {
  const logger = getBankIDAuditLogger();
  
  const sessionId = req.session?.id || req.sessionID;
  const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  return logger.logEvent({
    eventType,
    severity: BankIDEventSeverity.INFO,
    sessionId,
    ipAddress,
    userAgent,
    method: req.body?.method || 'unknown',
    endpoint: req.originalUrl || req.url,
    statusCode: req.statusCode,
    metadata: additionalData,
  });
}