/**
 * Security middleware for BRF Portal database operations
 * 
 * Provides authentication, authorization, audit logging, and security monitoring
 * for all database operations with cooperative-based isolation.
 */

import Database from 'better-sqlite3';
import { createHash, randomBytes } from 'crypto';

export interface SecurityContext {
  cooperative_id: string;
  user_id?: string;
  user_role?: 'member' | 'board' | 'chairman' | 'treasurer' | 'admin';
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
}

export interface AuditLogEntry {
  cooperative_id: string;
  user_id?: string;
  user_role?: string;
  ip_address?: string;
  user_agent?: string;
  action: string;
  table?: string;
  entity_id?: string;
  query?: string;
  data?: any;
  where?: any;
  message?: string;
  success: boolean;
  timestamp?: string;
}

export interface SecurityConfig {
  enableAuditLogging: boolean;
  enableRateLimiting: boolean;
  maxRequestsPerMinute: number;
  enableQueryAnalysis: boolean;
  suspiciousActivityThreshold: number;
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enableAuditLogging: true,
  enableRateLimiting: true,
  maxRequestsPerMinute: 100,
  enableQueryAnalysis: true,
  suspiciousActivityThreshold: 10
};

/**
 * Security middleware class for database operations
 */
export class SecurityMiddleware {
  private db: Database.Database;
  private config: SecurityConfig;
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
  private suspiciousActivityStore: Map<string, number> = new Map();

  constructor(db: Database.Database, config: Partial<SecurityConfig> = {}) {
    this.db = db;
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  /**
   * Authenticate user and validate their access to the cooperative
   */
  async authenticate(token: string, cooperativeId: string): Promise<SecurityContext | null> {
    try {
      // In a real implementation, this would validate JWT tokens
      // For now, we'll implement a simple token-based authentication
      const sessionData = this.validateSessionToken(token);
      if (!sessionData) {
        this.logSecurityEvent('AUTHENTICATION_FAILED', { token: this.hashSensitiveData(token) });
        return null;
      }

      // Verify user has access to the cooperative
      const member = this.db.prepare(`
        SELECT id, user_id, role, is_active 
        FROM members 
        WHERE user_id = ? AND cooperative_id = ? AND is_active = 1 AND deleted_at IS NULL
      `).get(sessionData.user_id, cooperativeId);

      if (!member) {
        this.logSecurityEvent('UNAUTHORIZED_COOPERATIVE_ACCESS', {
          user_id: sessionData.user_id,
          cooperative_id: cooperativeId
        });
        return null;
      }

      const context: SecurityContext = {
        cooperative_id: cooperativeId,
        user_id: sessionData.user_id,
        user_role: member.role,
        session_id: sessionData.session_id
      };

      this.logSecurityEvent('AUTHENTICATION_SUCCESS', context);
      return context;
    } catch (error) {
      this.logSecurityEvent('AUTHENTICATION_ERROR', { error: error.message });
      return null;
    }
  }

  /**
   * Check if user has permission for a specific action on a table
   */
  authorize(context: SecurityContext, action: string, table: string, data?: any): boolean {
    try {
      const permission = this.checkPermission(context, action, table, data);
      
      if (!permission.allowed) {
        this.logSecurityEvent('AUTHORIZATION_DENIED', {
          ...context,
          action,
          table,
          reason: permission.reason
        });
        return false;
      }

      return true;
    } catch (error) {
      this.logSecurityEvent('AUTHORIZATION_ERROR', {
        ...context,
        action,
        table,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Apply rate limiting based on user and IP address
   */
  checkRateLimit(context: SecurityContext): boolean {
    if (!this.config.enableRateLimiting) return true;

    const key = `${context.user_id || 'anonymous'}-${context.ip_address || 'unknown'}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    
    const current = this.rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (current.count >= this.config.maxRequestsPerMinute) {
      this.logSecurityEvent('RATE_LIMIT_EXCEEDED', context);
      return false;
    }
    
    current.count++;
    return true;
  }

  /**
   * Analyze query for suspicious patterns
   */
  analyzeQuery(query: string, context: SecurityContext): boolean {
    if (!this.config.enableQueryAnalysis) return true;

    const suspiciousPatterns = [
      { pattern: /UNION.*SELECT/i, severity: 'HIGH', type: 'SQL_INJECTION' },
      { pattern: /';.*--/i, severity: 'HIGH', type: 'SQL_INJECTION' },
      { pattern: /\bOR\s+1\s*=\s*1\b/i, severity: 'HIGH', type: 'SQL_INJECTION' },
      { pattern: /cooperative_id\s*!=\s*\?/i, severity: 'MEDIUM', type: 'RLS_BYPASS' },
      { pattern: /DELETE.*FROM.*WHERE.*1\s*=\s*1/i, severity: 'HIGH', type: 'MASS_DELETE' },
      { pattern: /UPDATE.*SET.*WHERE.*1\s*=\s*1/i, severity: 'HIGH', type: 'MASS_UPDATE' }
    ];

    for (const { pattern, severity, type } of suspiciousPatterns) {
      if (pattern.test(query)) {
        this.logSuspiciousActivity(context, type, { query: this.sanitizeQuery(query), severity });
        
        if (severity === 'HIGH') {
          return false; // Block high-severity queries
        }
      }
    }

    return true;
  }

  /**
   * Log security-related events
   */
  private logSecurityEvent(event: string, data: any): void {
    try {
      const logEntry = {
        event,
        data: this.sanitizeLogData(data),
        timestamp: new Date().toISOString()
      };

      console.log(`SECURITY_EVENT: ${event}`, logEntry);
      
      // In production, you might want to send this to a dedicated security logging service
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Track suspicious activity and implement progressive security measures
   */
  private logSuspiciousActivity(context: SecurityContext, type: string, details: any): void {
    const key = `${context.user_id || 'anonymous'}-${context.ip_address || 'unknown'}`;
    const currentCount = this.suspiciousActivityStore.get(key) || 0;
    const newCount = currentCount + 1;
    
    this.suspiciousActivityStore.set(key, newCount);
    
    this.logSecurityEvent('SUSPICIOUS_ACTIVITY', {
      ...context,
      type,
      details,
      count: newCount
    });
    
    // Implement progressive security measures
    if (newCount >= this.config.suspiciousActivityThreshold) {
      this.logSecurityEvent('SECURITY_THRESHOLD_EXCEEDED', {
        ...context,
        type,
        count: newCount
      });
      
      // In a real implementation, you might:
      // - Temporarily block the user/IP
      // - Require additional authentication
      // - Alert security team
    }
  }

  /**
   * Validate session token (simplified implementation)
   */
  private validateSessionToken(token: string): { user_id: string; session_id: string } | null {
    try {
      // In a real implementation, this would validate JWT tokens or session tokens
      // For demo purposes, we'll accept tokens in format "user_id.session_id"
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      
      return {
        user_id: parts[0],
        session_id: parts[1]
      };
    } catch {
      return null;
    }
  }

  /**
   * Check user permissions for specific actions
   */
  private checkPermission(
    context: SecurityContext, 
    action: string, 
    table: string, 
    data?: any
  ): { allowed: boolean; reason?: string } {
    const { user_role } = context;
    
    // Admin users have full access
    if (user_role === 'admin') {
      return { allowed: true };
    }

    // Define table-specific permissions
    const tablePermissions: Record<string, Record<string, string[]>> = {
      cooperatives: {
        SELECT: ['admin', 'chairman', 'treasurer', 'board', 'member'],
        UPDATE: ['admin', 'chairman', 'treasurer'],
        INSERT: ['admin'],
        DELETE: ['admin']
      },
      members: {
        SELECT: ['admin', 'chairman', 'treasurer', 'board', 'member'],
        UPDATE: ['admin', 'chairman', 'treasurer'],
        INSERT: ['admin', 'chairman'],
        DELETE: ['admin', 'chairman']
      },
      apartments: {
        SELECT: ['admin', 'chairman', 'treasurer', 'board', 'member'],
        UPDATE: ['admin', 'chairman', 'treasurer'],
        INSERT: ['admin', 'chairman', 'treasurer'],
        DELETE: ['admin', 'chairman']
      },
      invoices: {
        SELECT: ['admin', 'chairman', 'treasurer', 'board'],
        UPDATE: ['admin', 'chairman', 'treasurer'],
        INSERT: ['admin', 'chairman', 'treasurer'],
        DELETE: ['admin', 'chairman', 'treasurer']
      },
      monthly_fees: {
        SELECT: ['admin', 'chairman', 'treasurer', 'board', 'member'],
        UPDATE: ['admin', 'chairman', 'treasurer'],
        INSERT: ['admin', 'chairman', 'treasurer'],
        DELETE: ['admin', 'chairman', 'treasurer']
      },
      cases: {
        SELECT: ['admin', 'chairman', 'treasurer', 'board', 'member'],
        UPDATE: ['admin', 'chairman', 'treasurer', 'board'],
        INSERT: ['admin', 'chairman', 'treasurer', 'board', 'member'],
        DELETE: ['admin', 'chairman', 'treasurer']
      },
      documents: {
        SELECT: ['admin', 'chairman', 'treasurer', 'board', 'member'],
        UPDATE: ['admin', 'chairman', 'treasurer', 'board'],
        INSERT: ['admin', 'chairman', 'treasurer', 'board', 'member'],
        DELETE: ['admin', 'chairman', 'treasurer']
      },
      board_meetings: {
        SELECT: ['admin', 'chairman', 'treasurer', 'board'],
        UPDATE: ['admin', 'chairman', 'treasurer'],
        INSERT: ['admin', 'chairman', 'treasurer'],
        DELETE: ['admin', 'chairman']
      },
      audit_log: {
        SELECT: ['admin', 'chairman'],
        UPDATE: [],
        INSERT: [], // Only system can insert
        DELETE: []
      }
    };

    const allowedRoles = tablePermissions[table]?.[action] || [];
    
    if (!user_role || !allowedRoles.includes(user_role)) {
      return { 
        allowed: false, 
        reason: `Role '${user_role}' not permitted for action '${action}' on table '${table}'` 
      };
    }

    // Additional checks for sensitive operations
    if (action === 'UPDATE' && table === 'members' && data?.role) {
      // Only admin and chairman can change roles
      if (!['admin', 'chairman'].includes(user_role)) {
        return { allowed: false, reason: 'Insufficient permissions to change user roles' };
      }
    }

    return { allowed: true };
  }

  /**
   * Hash sensitive data for logging
   */
  private hashSensitiveData(data: string): string {
    return createHash('sha256').update(data).digest('hex').substring(0, 8) + '...';
  }

  /**
   * Sanitize query for safe logging
   */
  private sanitizeQuery(query: string): string {
    // Remove or mask potential sensitive data in queries
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password = '[REDACTED]'")
      .replace(/token\s*=\s*'[^']*'/gi, "token = '[REDACTED]'")
      .substring(0, 500); // Limit query length in logs
  }

  /**
   * Sanitize log data to prevent data leakage
   */
  private sanitizeLogData(data: any): any {
    if (typeof data !== 'object' || data === null) return data;
    
    const sanitized = { ...data };
    const sensitiveKeys = ['password', 'token', 'personal_number', 'api_key'];
    
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Clean up expired rate limiting and suspicious activity records
   */
  cleanup(): void {
    const now = Date.now();
    
    // Clean up expired rate limit entries
    for (const [key, value] of this.rateLimitStore.entries()) {
      if (now > value.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
    
    // Reset suspicious activity counters daily
    if (Math.random() < 0.001) { // 0.1% chance per operation
      this.suspiciousActivityStore.clear();
    }
  }
}

/**
 * Audit logging function for database operations
 */
export function auditSecurityAccess(entry: AuditLogEntry): void {
  try {
    // Log to console for development
    console.log('AUDIT:', {
      timestamp: entry.timestamp || new Date().toISOString(),
      cooperative_id: entry.cooperative_id,
      user_id: entry.user_id,
      action: entry.action,
      table: entry.table,
      success: entry.success,
      message: entry.message
    });

    // In production, you would typically:
    // 1. Write to a dedicated audit log table
    // 2. Send to external security monitoring system
    // 3. Ensure logs are tamper-proof
    
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(userId: string): string {
  const sessionId = randomBytes(16).toString('hex');
  return `${userId}.${sessionId}`;
}

/**
 * Validate cooperative access with security context
 */
export function validateSecureCooperativeAccess(
  db: Database.Database, 
  context: SecurityContext
): boolean {
  try {
    // Verify cooperative exists and is active
    const cooperative = db.prepare(`
      SELECT id, subscription_status 
      FROM cooperatives 
      WHERE id = ? AND deleted_at IS NULL
    `).get(context.cooperative_id);
    
    if (!cooperative) {
      auditSecurityAccess({
        ...context,
        action: 'VALIDATE_COOPERATIVE_ACCESS',
        success: false,
        message: 'Cooperative not found or deleted'
      });
      return false;
    }
    
    if (cooperative.subscription_status !== 'active') {
      auditSecurityAccess({
        ...context,
        action: 'VALIDATE_COOPERATIVE_ACCESS',
        success: false,
        message: 'Cooperative subscription inactive'
      });
      return false;
    }
    
    // If user is specified, verify membership
    if (context.user_id) {
      const member = db.prepare(`
        SELECT id, is_active, role
        FROM members 
        WHERE user_id = ? AND cooperative_id = ? AND deleted_at IS NULL
      `).get(context.user_id, context.cooperative_id);
      
      if (!member || !member.is_active) {
        auditSecurityAccess({
          ...context,
          action: 'VALIDATE_MEMBER_ACCESS',
          success: false,
          message: 'User is not an active member of cooperative'
        });
        return false;
      }
    }
    
    return true;
  } catch (error) {
    auditSecurityAccess({
      ...context,
      action: 'VALIDATE_COOPERATIVE_ACCESS',
      success: false,
      message: `Validation error: ${error.message}`
    });
    return false;
  }
}

/**
 * Create a secure database context with middleware
 */
export function createSecureContext(
  db: Database.Database,
  cooperativeId: string,
  options: Partial<SecurityContext & SecurityConfig> = {}
): { context: SecurityContext; middleware: SecurityMiddleware } {
  const context: SecurityContext = {
    cooperative_id: cooperativeId,
    user_id: options.user_id,
    user_role: options.user_role,
    ip_address: options.ip_address,
    user_agent: options.user_agent,
    session_id: options.session_id
  };

  const middleware = new SecurityMiddleware(db, options);
  
  return { context, middleware };
}