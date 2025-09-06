/**
 * Enhanced audit logging system for BRF Portal RBAC
 * Provides comprehensive security event logging and compliance tracking
 */

import { MemberRole, AuthUser } from './types';
import { BRF_PERMISSIONS } from './rbac';

/**
 * Audit event types for RBAC system
 */
export enum AuditEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Authorization Events
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_CHECK = 'PERMISSION_CHECK',
  ROLE_VERIFICATION = 'ROLE_VERIFICATION',
  
  // RBAC Management Events
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REMOVED = 'ROLE_REMOVED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  CUSTOM_PERMISSION_SET = 'CUSTOM_PERMISSION_SET',
  
  // User Management Events
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_DELETED = 'USER_DELETED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  
  // Security Events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  IP_BLOCKED = 'IP_BLOCKED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  
  // Financial Events (GDPR sensitive)
  FINANCIAL_DATA_ACCESSED = 'FINANCIAL_DATA_ACCESSED',
  FINANCIAL_DATA_EXPORTED = 'FINANCIAL_DATA_EXPORTED',
  INVOICE_APPROVED = 'INVOICE_APPROVED',
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
  
  // Member Data Events (GDPR sensitive)
  MEMBER_DATA_ACCESSED = 'MEMBER_DATA_ACCESSED',
  MEMBER_DATA_EXPORTED = 'MEMBER_DATA_EXPORTED',
  PERSONAL_DATA_UPDATED = 'PERSONAL_DATA_UPDATED',
  
  // Administrative Events
  SYSTEM_SETTINGS_CHANGED = 'SYSTEM_SETTINGS_CHANGED',
  COOPERATIVE_SETTINGS_CHANGED = 'COOPERATIVE_SETTINGS_CHANGED',
  AUDIT_LOG_ACCESSED = 'AUDIT_LOG_ACCESSED',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
}

/**
 * Audit severity levels
 */
export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Audit event context information
 */
export interface AuditContext {
  userId?: string;
  userRole?: MemberRole;
  cooperativeId: string;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  requestId?: string;
  timestamp: string;
}

/**
 * Detailed audit event data
 */
export interface AuditEventData {
  eventType: AuditEventType;
  severity: AuditSeverity;
  context: AuditContext;
  
  // Event-specific details
  entityType?: string;
  entityId?: string;
  resource?: string;
  action?: string;
  
  // Permission details
  requiredPermissions?: string[];
  grantedPermissions?: string[];
  deniedReason?: string;
  
  // Changes (before/after)
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  // Swedish BRF specific
  legalBasis?: string; // Legal basis for data processing
  gdprSensitive?: boolean;
  retentionPeriod?: number; // Days to retain the log entry
  
  // Error information
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;
}

/**
 * Audit log entry as stored in database
 */
export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  cooperativeId: string;
  userId?: string;
  userRole?: MemberRole;
  ipAddress: string;
  userAgent: string;
  
  // Event details
  action?: string;
  entityType?: string;
  entityId?: string;
  resource?: string;
  
  // Data changes
  oldValues?: string; // JSON string
  newValues?: string; // JSON string
  
  // Context and metadata
  metadata?: string; // JSON string
  sessionId?: string;
  requestId?: string;
  
  // GDPR and compliance
  gdprSensitive: boolean;
  legalBasis?: string;
  retentionDate?: string; // When to delete this entry
  
  // Timestamps
  createdAt: string;
}

/**
 * Audit configuration
 */
export interface AuditConfig {
  enabled: boolean;
  minSeverity: AuditSeverity;
  retentionDays: number;
  gdprRetentionDays: number;
  enableRealTimeAlerts: boolean;
  alertThresholds: {
    failedLogins: number;
    permissionDenials: number;
    suspiciousActivity: number;
  };
}

/**
 * Default audit configuration
 */
export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  enabled: true,
  minSeverity: AuditSeverity.LOW,
  retentionDays: 2555, // 7 years for financial compliance
  gdprRetentionDays: 1095, // 3 years for GDPR
  enableRealTimeAlerts: true,
  alertThresholds: {
    failedLogins: 5,
    permissionDenials: 10,
    suspiciousActivity: 3,
  },
};

/**
 * Audit logger class
 */
class AuditLogger {
  private config: AuditConfig;
  private alertCounters: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: AuditConfig = DEFAULT_AUDIT_CONFIG) {
    this.config = config;
  }

  /**
   * Log an audit event
   */
  async log(eventData: AuditEventData): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Check minimum severity
    if (this.getSeverityLevel(eventData.severity) < this.getSeverityLevel(this.config.minSeverity)) {
      return;
    }

    try {
      // Prepare audit log entry
      const logEntry = await this.prepareLogEntry(eventData);
      
      // Store in database
      await this.storeLogEntry(logEntry);
      
      // Check for alerts
      if (this.config.enableRealTimeAlerts) {
        await this.checkAlertThresholds(eventData);
      }
      
      // Log to console for development
      this.logToConsole(eventData, logEntry);
      
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking main application flow
    }
  }

  /**
   * Prepare audit log entry for database storage
   */
  private async prepareLogEntry(eventData: AuditEventData): Promise<AuditLogEntry> {
    const retentionDays = eventData.gdprSensitive 
      ? this.config.gdprRetentionDays 
      : this.config.retentionDays;
    
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + retentionDays);

    return {
      id: crypto.randomUUID(),
      eventType: eventData.eventType,
      severity: eventData.severity,
      cooperativeId: eventData.context.cooperativeId,
      userId: eventData.context.userId,
      userRole: eventData.context.userRole,
      ipAddress: eventData.context.ipAddress,
      userAgent: eventData.context.userAgent,
      action: eventData.action,
      entityType: eventData.entityType,
      entityId: eventData.entityId,
      resource: eventData.resource,
      oldValues: eventData.oldValues ? JSON.stringify(eventData.oldValues) : undefined,
      newValues: eventData.newValues ? JSON.stringify(eventData.newValues) : undefined,
      metadata: eventData.metadata ? JSON.stringify(eventData.metadata) : undefined,
      sessionId: eventData.context.sessionId,
      requestId: eventData.context.requestId,
      gdprSensitive: eventData.gdprSensitive || false,
      legalBasis: eventData.legalBasis,
      retentionDate: retentionDate.toISOString(),
      createdAt: eventData.context.timestamp,
    };
  }

  /**
   * Store audit log entry in database
   */
  private async storeLogEntry(logEntry: AuditLogEntry): Promise<void> {
    // TODO: Implement database storage
    // In a real implementation, this would insert into the audit_log table
    console.log('Storing audit log entry:', logEntry.id);
  }

  /**
   * Check if alert thresholds are exceeded
   */
  private async checkAlertThresholds(eventData: AuditEventData): Promise<void> {
    const key = `${eventData.context.cooperativeId}:${eventData.context.ipAddress}`;
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour window

    let counter = this.alertCounters.get(key);
    if (!counter || counter.resetTime < now) {
      counter = { count: 0, resetTime: now + windowMs };
    }

    // Increment counters based on event type
    let shouldAlert = false;
    let alertType = '';

    switch (eventData.eventType) {
      case AuditEventType.LOGIN_FAILED:
        counter.count++;
        if (counter.count >= this.config.alertThresholds.failedLogins) {
          shouldAlert = true;
          alertType = 'Multiple failed login attempts';
        }
        break;

      case AuditEventType.ACCESS_DENIED:
        counter.count++;
        if (counter.count >= this.config.alertThresholds.permissionDenials) {
          shouldAlert = true;
          alertType = 'Multiple permission denials';
        }
        break;

      case AuditEventType.SUSPICIOUS_ACTIVITY:
      case AuditEventType.BRUTE_FORCE_ATTEMPT:
        counter.count++;
        if (counter.count >= this.config.alertThresholds.suspiciousActivity) {
          shouldAlert = true;
          alertType = 'Suspicious activity detected';
        }
        break;
    }

    this.alertCounters.set(key, counter);

    if (shouldAlert) {
      await this.sendSecurityAlert(alertType, eventData);
    }
  }

  /**
   * Send security alert
   */
  private async sendSecurityAlert(alertType: string, eventData: AuditEventData): Promise<void> {
    const alertData = {
      type: alertType,
      cooperativeId: eventData.context.cooperativeId,
      ipAddress: eventData.context.ipAddress,
      timestamp: eventData.context.timestamp,
      severity: eventData.severity,
      eventType: eventData.eventType,
    };

    // TODO: Implement alert sending (email, SMS, push notification)
    console.warn('SECURITY ALERT:', alertData);
  }

  /**
   * Get numeric severity level for comparison
   */
  private getSeverityLevel(severity: AuditSeverity): number {
    const levels = {
      [AuditSeverity.LOW]: 1,
      [AuditSeverity.MEDIUM]: 2,
      [AuditSeverity.HIGH]: 3,
      [AuditSeverity.CRITICAL]: 4,
    };
    return levels[severity];
  }

  /**
   * Log to console for development
   */
  private logToConsole(eventData: AuditEventData, logEntry: AuditLogEntry): void {
    const logLevel = eventData.severity === AuditSeverity.CRITICAL || eventData.severity === AuditSeverity.HIGH 
      ? 'warn' : 'log';
    
    console[logLevel](`[AUDIT] ${eventData.eventType}:`, {
      id: logEntry.id,
      user: eventData.context.userId,
      role: eventData.context.userRole,
      cooperative: eventData.context.cooperativeId,
      severity: eventData.severity,
      timestamp: eventData.context.timestamp,
    });
  }
}

/**
 * Global audit logger instance
 */
const auditLogger = new AuditLogger();

/**
 * Convenience functions for logging common events
 */

/**
 * Log authentication event
 */
export async function logAuthEvent(
  eventType: AuditEventType,
  context: AuditContext,
  success: boolean,
  error?: string
): Promise<void> {
  await auditLogger.log({
    eventType,
    severity: success ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
    context,
    metadata: { success, error },
  });
}

/**
 * Log authorization event
 */
export async function logAuthorizationEvent(
  eventType: AuditEventType,
  context: AuditContext,
  resource: string,
  requiredPermissions: string[],
  granted: boolean,
  deniedReason?: string
): Promise<void> {
  await auditLogger.log({
    eventType,
    severity: granted ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
    context,
    resource,
    requiredPermissions,
    deniedReason,
    metadata: { granted },
  });
}

/**
 * Log RBAC management event
 */
export async function logRBACEvent(
  eventType: AuditEventType,
  context: AuditContext,
  targetUserId: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>
): Promise<void> {
  await auditLogger.log({
    eventType,
    severity: AuditSeverity.HIGH,
    context,
    entityType: 'user',
    entityId: targetUserId,
    oldValues,
    newValues,
    gdprSensitive: true,
    legalBasis: 'Contract performance - User management',
  });
}

/**
 * Log financial data access
 */
export async function logFinancialAccess(
  context: AuditContext,
  operation: string,
  entityType: string,
  entityId?: string,
  exported: boolean = false
): Promise<void> {
  await auditLogger.log({
    eventType: exported ? AuditEventType.FINANCIAL_DATA_EXPORTED : AuditEventType.FINANCIAL_DATA_ACCESSED,
    severity: exported ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
    context,
    action: operation,
    entityType,
    entityId,
    gdprSensitive: false, // Financial data is not personal data under GDPR
    legalBasis: 'Legitimate interest - Financial management',
  });
}

/**
 * Log member data access
 */
export async function logMemberDataAccess(
  context: AuditContext,
  operation: string,
  memberIds: string[],
  exported: boolean = false
): Promise<void> {
  for (const memberId of memberIds) {
    await auditLogger.log({
      eventType: exported ? AuditEventType.MEMBER_DATA_EXPORTED : AuditEventType.MEMBER_DATA_ACCESSED,
      severity: exported ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      context,
      action: operation,
      entityType: 'member',
      entityId: memberId,
      gdprSensitive: true,
      legalBasis: 'Legitimate interest - Member management',
    });
  }
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  eventType: AuditEventType,
  context: AuditContext,
  details?: Record<string, any>
): Promise<void> {
  await auditLogger.log({
    eventType,
    severity: AuditSeverity.CRITICAL,
    context,
    metadata: details,
  });
}

/**
 * Log system administration event
 */
export async function logAdminEvent(
  eventType: AuditEventType,
  context: AuditContext,
  entityType: string,
  entityId?: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>
): Promise<void> {
  await auditLogger.log({
    eventType,
    severity: AuditSeverity.HIGH,
    context,
    entityType,
    entityId,
    oldValues,
    newValues,
    legalBasis: 'Legitimate interest - System administration',
  });
}

/**
 * Query audit logs (for admin interface)
 */
export interface AuditLogQuery {
  cooperativeId: string;
  userId?: string;
  eventTypes?: AuditEventType[];
  severity?: AuditSeverity;
  startDate?: string;
  endDate?: string;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search audit logs
 */
export async function queryAuditLogs(query: AuditLogQuery): Promise<AuditLogEntry[]> {
  // TODO: Implement database query
  // This would query the audit_log table with the specified filters
  console.log('Querying audit logs:', query);
  return [];
}

/**
 * Generate audit report for compliance
 */
export async function generateAuditReport(
  cooperativeId: string,
  startDate: string,
  endDate: string,
  includeGDPRSensitive: boolean = false
): Promise<{
  summary: Record<string, number>;
  events: AuditLogEntry[];
  gdprCompliance: {
    sensitiveDataAccesses: number;
    dataExports: number;
    userManagementEvents: number;
  };
}> {
  // TODO: Implement audit report generation
  console.log('Generating audit report:', { cooperativeId, startDate, endDate });
  
  return {
    summary: {},
    events: [],
    gdprCompliance: {
      sensitiveDataAccesses: 0,
      dataExports: 0,
      userManagementEvents: 0,
    },
  };
}

/**
 * Clean up expired audit logs (GDPR compliance)
 */
export async function cleanupExpiredLogs(): Promise<{ deleted: number }> {
  // TODO: Implement log cleanup based on retention dates
  console.log('Cleaning up expired audit logs');
  return { deleted: 0 };
}

/**
 * Export all audit logging functions and types
 */
export {
  auditLogger as AuditLogger,
  AuditEventType,
  AuditSeverity,
  DEFAULT_AUDIT_CONFIG,
};

export type {
  AuditContext,
  AuditEventData,
  AuditLogEntry,
  AuditConfig,
  AuditLogQuery,
};