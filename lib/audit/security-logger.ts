/**
 * Security Event Logging System for BRF Portal
 * Comprehensive audit logging for password reset and authentication activities
 */

import Database from 'better-sqlite3';

/**
 * Security event severity levels
 */
export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security event interface
 */
export interface SecurityEvent {
  event: string;
  severity: SecurityEventSeverity;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  cooperativeId?: string;
  details?: Record<string, any>;
  timestamp?: string;
}

/**
 * Database connection for security logging
 */
function getSecurityDatabase(): Database.Database {
  const dbPath = process.env.DATABASE_PATH || './database/brf.db';
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Initialize security logging tables
 */
export function initializeSecurityLogging(): void {
  const db = getSecurityDatabase();
  
  try {
    // Create security events table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS security_events (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        event TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        
        -- Request information
        ip_address TEXT,
        user_agent TEXT,
        
        -- User and cooperative context
        user_id TEXT,
        cooperative_id TEXT,
        
        -- Event details (JSON)
        details TEXT CHECK (json_valid(details)),
        
        -- Timestamp
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        -- Indexes for performance
        FOREIGN KEY (user_id) REFERENCES members(id) ON DELETE SET NULL,
        FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE SET NULL
      );
    `);

    // Create indexes for security events
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_security_events_event ON security_events(event);
      CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
      CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);
      CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_security_events_cooperative ON security_events(cooperative_id);
      CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_security_events_lookup ON security_events(event, severity, created_at);
    `);

    // Create password reset audit table for detailed tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_audit (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        cooperative_id TEXT,
        
        -- Event details
        event_type TEXT NOT NULL CHECK (event_type IN ('request', 'verify', 'reset', 'failed')),
        email TEXT NOT NULL,
        user_id TEXT,
        
        -- Security context
        ip_address TEXT,
        user_agent TEXT,
        fingerprint TEXT,
        
        -- Token information (hashed)
        token_hash TEXT,
        
        -- Result
        success INTEGER DEFAULT 0,
        failure_reason TEXT,
        
        -- Timing
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (user_id) REFERENCES members(id) ON DELETE SET NULL,
        FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE SET NULL
      );
    `);

    // Create indexes for password reset audit
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_audit_email ON password_reset_audit(email);
      CREATE INDEX IF NOT EXISTS idx_password_reset_audit_ip ON password_reset_audit(ip_address);
      CREATE INDEX IF NOT EXISTS idx_password_reset_audit_event ON password_reset_audit(event_type);
      CREATE INDEX IF NOT EXISTS idx_password_reset_audit_created ON password_reset_audit(created_at);
      CREATE INDEX IF NOT EXISTS idx_password_reset_audit_lookup ON password_reset_audit(email, ip_address, event_type, created_at);
    `);

    console.log('✅ Security logging initialized successfully');
  } finally {
    db.close();
  }
}

/**
 * Log a security event
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  const db = getSecurityDatabase();
  
  try {
    const timestamp = event.timestamp || new Date().toISOString();
    
    // Insert into security events table
    db.prepare(`
      INSERT INTO security_events (
        event, severity, ip_address, user_agent, user_id, 
        cooperative_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.event,
      event.severity,
      event.ipAddress || null,
      event.userAgent || null,
      event.userId || null,
      event.cooperativeId || null,
      event.details ? JSON.stringify(event.details) : null,
      timestamp
    );

    // Log to console in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SECURITY] [${event.severity.toUpperCase()}] ${event.event}`, {
        ip: event.ipAddress,
        user: event.userId,
        details: event.details
      });
    }

    // For critical events, also log to external monitoring (in production)
    if (event.severity === 'critical' && process.env.NODE_ENV === 'production') {
      // Here you could integrate with external logging services like:
      // - Sentry
      // - LogRocket
      // - DataDog
      // - CloudWatch
      console.error(`[CRITICAL SECURITY EVENT] ${event.event}`, event);
    }

  } catch (error) {
    // Don't let logging errors break the application
    console.error('Failed to log security event:', error);
  } finally {
    db.close();
  }
}

/**
 * Log password reset specific events with detailed tracking
 */
export async function logPasswordResetEvent(
  eventType: 'request' | 'verify' | 'reset' | 'failed',
  email: string,
  options: {
    userId?: string;
    cooperativeId?: string;
    ipAddress?: string;
    userAgent?: string;
    fingerprint?: string;
    tokenHash?: string;
    success?: boolean;
    failureReason?: string;
  } = {}
): Promise<void> {
  const db = getSecurityDatabase();
  
  try {
    // Insert into password reset audit table
    db.prepare(`
      INSERT INTO password_reset_audit (
        event_type, email, user_id, cooperative_id, ip_address, 
        user_agent, fingerprint, token_hash, success, failure_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventType,
      email,
      options.userId || null,
      options.cooperativeId || null,
      options.ipAddress || null,
      options.userAgent || null,
      options.fingerprint || null,
      options.tokenHash || null,
      options.success ? 1 : 0,
      options.failureReason || null
    );

    // Also log to general security events
    const severity: SecurityEventSeverity = eventType === 'failed' ? 'medium' : 'info';
    await logSecurityEvent({
      event: `password_reset_${eventType}`,
      severity: severity as SecurityEventSeverity,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      userId: options.userId,
      cooperativeId: options.cooperativeId,
      details: {
        email: email,
        success: options.success,
        failureReason: options.failureReason,
        tokenHash: options.tokenHash ? 'present' : 'absent'
      }
    });

  } catch (error) {
    console.error('Failed to log password reset event:', error);
  } finally {
    db.close();
  }
}

/**
 * Get security event statistics for monitoring
 */
export async function getSecurityEventStatistics(
  timeframe: 'hour' | 'day' | 'week' | 'month' = 'day'
): Promise<{
  totalEvents: number;
  eventsBySeverity: Record<SecurityEventSeverity, number>;
  topEvents: Array<{ event: string; count: number }>;
  uniqueIPs: number;
  passwordResetEvents: number;
}> {
  const db = getSecurityDatabase();
  
  try {
    // Calculate time boundaries
    const now = new Date();
    const timeAgo = new Date();
    
    switch (timeframe) {
      case 'hour':
        timeAgo.setHours(timeAgo.getHours() - 1);
        break;
      case 'day':
        timeAgo.setDate(timeAgo.getDate() - 1);
        break;
      case 'week':
        timeAgo.setDate(timeAgo.getDate() - 7);
        break;
      case 'month':
        timeAgo.setMonth(timeAgo.getMonth() - 1);
        break;
    }

    // Total events
    const totalEvents = db.prepare(`
      SELECT COUNT(*) as count FROM security_events 
      WHERE created_at >= ?
    `).get(timeAgo.toISOString()) as any;

    // Events by severity
    const severityStats = db.prepare(`
      SELECT severity, COUNT(*) as count FROM security_events 
      WHERE created_at >= ?
      GROUP BY severity
    `).all(timeAgo.toISOString()) as any[];

    const eventsBySeverity: Record<SecurityEventSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    severityStats.forEach(stat => {
      eventsBySeverity[stat.severity as SecurityEventSeverity] = stat.count;
    });

    // Top events
    const topEvents = db.prepare(`
      SELECT event, COUNT(*) as count FROM security_events 
      WHERE created_at >= ?
      GROUP BY event
      ORDER BY count DESC
      LIMIT 10
    `).all(timeAgo.toISOString()) as any[];

    // Unique IPs
    const uniqueIPs = db.prepare(`
      SELECT COUNT(DISTINCT ip_address) as count FROM security_events 
      WHERE created_at >= ? AND ip_address IS NOT NULL
    `).get(timeAgo.toISOString()) as any;

    // Password reset events
    const passwordResetEvents = db.prepare(`
      SELECT COUNT(*) as count FROM password_reset_audit 
      WHERE created_at >= ?
    `).get(timeAgo.toISOString()) as any;

    return {
      totalEvents: totalEvents.count,
      eventsBySeverity,
      topEvents: topEvents.map(event => ({
        event: event.event,
        count: event.count
      })),
      uniqueIPs: uniqueIPs.count,
      passwordResetEvents: passwordResetEvents.count
    };

  } finally {
    db.close();
  }
}

/**
 * Get suspicious activity patterns
 */
export async function getSuspiciousActivity(
  timeframe: 'hour' | 'day' | 'week' = 'day'
): Promise<{
  highVolumeIPs: Array<{ ipAddress: string; eventCount: number }>;
  failedPasswordResets: Array<{ email: string; attempts: number; lastAttempt: string }>;
  criticalEvents: Array<{ event: string; ipAddress: string; createdAt: string }>;
}> {
  const db = getSecurityDatabase();
  
  try {
    // Calculate time boundary
    const timeAgo = new Date();
    switch (timeframe) {
      case 'hour':
        timeAgo.setHours(timeAgo.getHours() - 1);
        break;
      case 'day':
        timeAgo.setDate(timeAgo.getDate() - 1);
        break;
      case 'week':
        timeAgo.setDate(timeAgo.getDate() - 7);
        break;
    }

    // High volume IPs (more than 50 events in timeframe)
    const highVolumeIPs = db.prepare(`
      SELECT ip_address, COUNT(*) as eventCount FROM security_events 
      WHERE created_at >= ? AND ip_address IS NOT NULL
      GROUP BY ip_address
      HAVING eventCount > 50
      ORDER BY eventCount DESC
      LIMIT 20
    `).all(timeAgo.toISOString()) as any[];

    // Failed password reset attempts
    const failedPasswordResets = db.prepare(`
      SELECT email, COUNT(*) as attempts, MAX(created_at) as lastAttempt
      FROM password_reset_audit 
      WHERE created_at >= ? AND success = 0
      GROUP BY email
      HAVING attempts >= 3
      ORDER BY attempts DESC, lastAttempt DESC
      LIMIT 20
    `).all(timeAgo.toISOString()) as any[];

    // Critical events
    const criticalEvents = db.prepare(`
      SELECT event, ip_address, created_at FROM security_events 
      WHERE created_at >= ? AND severity = 'critical'
      ORDER BY created_at DESC
      LIMIT 50
    `).all(timeAgo.toISOString()) as any[];

    return {
      highVolumeIPs: highVolumeIPs.map(item => ({
        ipAddress: item.ip_address,
        eventCount: item.eventCount
      })),
      failedPasswordResets: failedPasswordResets.map(item => ({
        email: item.email,
        attempts: item.attempts,
        lastAttempt: item.lastAttempt
      })),
      criticalEvents: criticalEvents.map(item => ({
        event: item.event,
        ipAddress: item.ip_address,
        createdAt: item.created_at
      }))
    };

  } finally {
    db.close();
  }
}

/**
 * Clean up old security logs (run as background job)
 */
export async function cleanupSecurityLogs(
  retentionDays: number = 90
): Promise<{
  deletedEvents: number;
  deletedAuditRecords: number;
}> {
  const db = getSecurityDatabase();
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete old security events (keep critical events longer)
    const deletedEvents = db.prepare(`
      DELETE FROM security_events 
      WHERE created_at < ? AND severity != 'critical'
    `).run(cutoffDate.toISOString());

    // Delete old critical events (keep for 1 year)
    const criticalCutoff = new Date();
    criticalCutoff.setFullYear(criticalCutoff.getFullYear() - 1);
    
    const deletedCritical = db.prepare(`
      DELETE FROM security_events 
      WHERE created_at < ? AND severity = 'critical'
    `).run(criticalCutoff.toISOString());

    // Delete old password reset audit records
    const deletedAuditRecords = db.prepare(`
      DELETE FROM password_reset_audit 
      WHERE created_at < ?
    `).run(cutoffDate.toISOString());

    return {
      deletedEvents: deletedEvents.changes + deletedCritical.changes,
      deletedAuditRecords: deletedAuditRecords.changes
    };

  } finally {
    db.close();
  }
}