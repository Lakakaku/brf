/**
 * Admin Impersonation System for BRF Portal
 * Allows administrators to temporarily assume the identity of other users
 * for testing and support purposes with full audit logging
 */

import Database from 'better-sqlite3';
import { 
  AuthUser, 
  AuthError, 
  AuthErrorType,
  MemberRole,
  TokenPair 
} from './types';
import { createEnhancedTokenPair } from './tokens';
import { generateTokenId } from './jwt';
import { logAuthEvent } from './middleware';

/**
 * Impersonation session data
 */
export interface ImpersonationSession {
  sessionId: string;
  originalUserId: string;
  originalUserEmail: string;
  originalUserRole: MemberRole;
  impersonatedUserId: string;
  impersonatedUserEmail: string;
  impersonatedUserRole: MemberRole;
  cooperativeId: string;
  startedAt: Date;
  expiresAt: Date;
  endedAt?: Date;
  reason: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * Impersonation audit entry
 */
export interface ImpersonationAudit {
  id: string;
  sessionId: string;
  action: 'start' | 'end' | 'expire' | 'error';
  performedBy: string;
  targetUser: string;
  cooperativeId: string;
  reason?: string;
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

/**
 * Database connection
 */
function getDatabase(): Database.Database {
  const dbPath = process.env.DATABASE_PATH || './database/brf.db';
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Initialize impersonation tables
 */
export function initializeImpersonationTables(): void {
  const db = getDatabase();
  
  try {
    // Create impersonation sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS impersonation_sessions (
        session_id TEXT PRIMARY KEY,
        original_user_id TEXT NOT NULL,
        original_user_email TEXT NOT NULL,
        original_user_role TEXT NOT NULL,
        impersonated_user_id TEXT NOT NULL,
        impersonated_user_email TEXT NOT NULL,
        impersonated_user_role TEXT NOT NULL,
        cooperative_id TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        ended_at TEXT,
        reason TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (original_user_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (impersonated_user_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE
      );
    `);

    // Create impersonation audit log table
    db.exec(`
      CREATE TABLE IF NOT EXISTS impersonation_audit (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        session_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('start', 'end', 'expire', 'error')),
        performed_by TEXT NOT NULL,
        target_user TEXT NOT NULL,
        cooperative_id TEXT NOT NULL,
        reason TEXT,
        metadata TEXT, -- JSON string
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (session_id) REFERENCES impersonation_sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE
      );
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_original ON impersonation_sessions(original_user_id);
      CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_impersonated ON impersonation_sessions(impersonated_user_id);
      CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active ON impersonation_sessions(ended_at, expires_at);
      CREATE INDEX IF NOT EXISTS idx_impersonation_audit_session ON impersonation_audit(session_id);
      CREATE INDEX IF NOT EXISTS idx_impersonation_audit_user ON impersonation_audit(performed_by);
    `);
    
    console.log('✅ Impersonation tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize impersonation tables:', error);
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Check if a user can impersonate others
 */
export function canImpersonate(userRole: MemberRole): boolean {
  // Only admins and chairman can impersonate
  return userRole === 'admin' || userRole === 'chairman';
}

/**
 * Check if a user can be impersonated
 */
export function canBeImpersonated(
  targetRole: MemberRole, 
  initiatorRole: MemberRole
): boolean {
  // Admins can impersonate anyone
  if (initiatorRole === 'admin') {
    return true;
  }
  
  // Chairman can impersonate anyone except admins
  if (initiatorRole === 'chairman') {
    return targetRole !== 'admin';
  }
  
  return false;
}

/**
 * Start an impersonation session
 */
export async function startImpersonation(params: {
  originalUser: AuthUser;
  targetUserId: string;
  reason: string;
  ipAddress: string;
  userAgent: string;
  expirationMinutes?: number;
}): Promise<{
  session: ImpersonationSession;
  tokens: TokenPair;
  impersonatedUser: AuthUser;
}> {
  const { 
    originalUser, 
    targetUserId, 
    reason, 
    ipAddress, 
    userAgent,
    expirationMinutes = 60 // Default 1 hour
  } = params;

  const db = getDatabase();

  try {
    // Check if original user can impersonate
    if (!canImpersonate(originalUser.role)) {
      throw new AuthError(
        AuthErrorType.FORBIDDEN,
        'User does not have permission to impersonate',
        403
      );
    }

    // Get target user
    const targetUserStmt = db.prepare(`
      SELECT 
        m.id,
        m.email,
        m.first_name,
        m.last_name,
        m.role,
        m.apartment_number,
        m.phone_number,
        m.cooperative_id,
        m.is_active,
        m.created_at,
        m.updated_at,
        c.name as cooperative_name,
        c.org_number as cooperative_org_number
      FROM members m
      JOIN cooperatives c ON m.cooperative_id = c.id
      WHERE m.id = ? AND m.cooperative_id = ?
    `);

    const targetUser = targetUserStmt.get(targetUserId, originalUser.cooperativeId) as any;

    if (!targetUser) {
      throw new AuthError(
        AuthErrorType.NOT_FOUND,
        'Target user not found',
        404
      );
    }

    // Check if target can be impersonated
    if (!canBeImpersonated(targetUser.role as MemberRole, originalUser.role)) {
      throw new AuthError(
        AuthErrorType.FORBIDDEN,
        'Target user cannot be impersonated by current user',
        403
      );
    }

    // Check for existing active impersonation session
    const existingSessionStmt = db.prepare(`
      SELECT session_id 
      FROM impersonation_sessions 
      WHERE original_user_id = ? 
        AND ended_at IS NULL 
        AND datetime(expires_at) > datetime('now')
    `);

    const existingSession = existingSessionStmt.get(originalUser.id) as any;

    if (existingSession) {
      // End existing session
      const endSessionStmt = db.prepare(`
        UPDATE impersonation_sessions 
        SET ended_at = datetime('now'), 
            updated_at = datetime('now')
        WHERE session_id = ?
      `);
      endSessionStmt.run(existingSession.session_id);
    }

    // Create new impersonation session
    const sessionId = generateTokenId();
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    const createSessionStmt = db.prepare(`
      INSERT INTO impersonation_sessions (
        session_id,
        original_user_id,
        original_user_email,
        original_user_role,
        impersonated_user_id,
        impersonated_user_email,
        impersonated_user_role,
        cooperative_id,
        expires_at,
        reason,
        ip_address,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    createSessionStmt.run(
      sessionId,
      originalUser.id,
      originalUser.email,
      originalUser.role,
      targetUser.id,
      targetUser.email,
      targetUser.role,
      originalUser.cooperativeId,
      expiresAt.toISOString(),
      reason,
      ipAddress,
      userAgent
    );

    // Create audit log entry
    const auditStmt = db.prepare(`
      INSERT INTO impersonation_audit (
        session_id,
        action,
        performed_by,
        target_user,
        cooperative_id,
        reason,
        metadata,
        ip_address,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    auditStmt.run(
      sessionId,
      'start',
      originalUser.id,
      targetUser.id,
      originalUser.cooperativeId,
      reason,
      JSON.stringify({
        originalRole: originalUser.role,
        targetRole: targetUser.role,
        expirationMinutes
      }),
      ipAddress,
      userAgent
    );

    // Create impersonated user object
    const impersonatedUser: AuthUser = {
      id: targetUser.id,
      email: targetUser.email,
      firstName: targetUser.first_name,
      lastName: targetUser.last_name,
      role: targetUser.role as MemberRole,
      apartmentNumber: targetUser.apartment_number,
      phoneNumber: targetUser.phone_number,
      cooperativeId: targetUser.cooperative_id,
      cooperativeName: targetUser.cooperative_name,
      cooperativeOrgNumber: targetUser.cooperative_org_number,
      isActive: targetUser.is_active === 1,
      createdAt: new Date(targetUser.created_at),
      updatedAt: new Date(targetUser.updated_at),
      // Add impersonation metadata
      isImpersonated: true,
      impersonationSessionId: sessionId,
      impersonatedBy: {
        id: originalUser.id,
        email: originalUser.email,
        name: `${originalUser.firstName} ${originalUser.lastName}`,
        role: originalUser.role
      }
    };

    // Create special tokens for impersonation session
    const tokens = await createEnhancedTokenPair(
      impersonatedUser,
      ipAddress,
      userAgent,
      false, // Don't remember impersonation sessions
      sessionId // Pass session ID for tracking
    );

    // Log auth event
    await logAuthEvent({
      userId: originalUser.id,
      event: 'impersonation_start',
      success: true,
      ipAddress,
      userAgent,
      metadata: {
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
        sessionId,
        reason
      }
    });

    const session: ImpersonationSession = {
      sessionId,
      originalUserId: originalUser.id,
      originalUserEmail: originalUser.email,
      originalUserRole: originalUser.role,
      impersonatedUserId: targetUser.id,
      impersonatedUserEmail: targetUser.email,
      impersonatedUserRole: targetUser.role as MemberRole,
      cooperativeId: originalUser.cooperativeId,
      startedAt: new Date(),
      expiresAt,
      reason,
      ipAddress,
      userAgent
    };

    return {
      session,
      tokens,
      impersonatedUser
    };

  } catch (error) {
    // Log error to audit
    if (error instanceof AuthError) {
      await logAuthEvent({
        userId: originalUser.id,
        event: 'impersonation_error',
        success: false,
        ipAddress,
        userAgent,
        metadata: {
          targetUserId,
          error: error.message,
          type: error.type
        }
      });
    }
    throw error;
  } finally {
    db.close();
  }
}

/**
 * End an impersonation session
 */
export async function endImpersonation(
  sessionId: string,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const db = getDatabase();

  try {
    // Get session
    const sessionStmt = db.prepare(`
      SELECT * FROM impersonation_sessions 
      WHERE session_id = ? AND original_user_id = ?
    `);

    const session = sessionStmt.get(sessionId, userId) as any;

    if (!session) {
      throw new AuthError(
        AuthErrorType.NOT_FOUND,
        'Impersonation session not found',
        404
      );
    }

    if (session.ended_at) {
      throw new AuthError(
        AuthErrorType.INVALID_TOKEN,
        'Impersonation session already ended',
        400
      );
    }

    // End session
    const endSessionStmt = db.prepare(`
      UPDATE impersonation_sessions 
      SET ended_at = datetime('now'), 
          updated_at = datetime('now')
      WHERE session_id = ?
    `);

    endSessionStmt.run(sessionId);

    // Create audit log entry
    const auditStmt = db.prepare(`
      INSERT INTO impersonation_audit (
        session_id,
        action,
        performed_by,
        target_user,
        cooperative_id,
        ip_address,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    auditStmt.run(
      sessionId,
      'end',
      session.original_user_id,
      session.impersonated_user_id,
      session.cooperative_id,
      ipAddress,
      userAgent
    );

    // Log auth event
    await logAuthEvent({
      userId: session.original_user_id,
      event: 'impersonation_end',
      success: true,
      ipAddress,
      userAgent,
      metadata: {
        sessionId,
        targetUserId: session.impersonated_user_id,
        duration: Date.now() - new Date(session.started_at).getTime()
      }
    });

  } finally {
    db.close();
  }
}

/**
 * Get active impersonation session for a user
 */
export async function getActiveImpersonationSession(
  userId: string
): Promise<ImpersonationSession | null> {
  const db = getDatabase();

  try {
    const stmt = db.prepare(`
      SELECT * FROM impersonation_sessions 
      WHERE original_user_id = ? 
        AND ended_at IS NULL 
        AND datetime(expires_at) > datetime('now')
      ORDER BY started_at DESC
      LIMIT 1
    `);

    const session = stmt.get(userId) as any;

    if (!session) {
      return null;
    }

    return {
      sessionId: session.session_id,
      originalUserId: session.original_user_id,
      originalUserEmail: session.original_user_email,
      originalUserRole: session.original_user_role as MemberRole,
      impersonatedUserId: session.impersonated_user_id,
      impersonatedUserEmail: session.impersonated_user_email,
      impersonatedUserRole: session.impersonated_user_role as MemberRole,
      cooperativeId: session.cooperative_id,
      startedAt: new Date(session.started_at),
      expiresAt: new Date(session.expires_at),
      endedAt: session.ended_at ? new Date(session.ended_at) : undefined,
      reason: session.reason,
      ipAddress: session.ip_address,
      userAgent: session.user_agent
    };

  } finally {
    db.close();
  }
}

/**
 * Get impersonation history for a user
 */
export async function getImpersonationHistory(
  userId: string,
  limit: number = 50
): Promise<ImpersonationSession[]> {
  const db = getDatabase();

  try {
    const stmt = db.prepare(`
      SELECT * FROM impersonation_sessions 
      WHERE original_user_id = ? OR impersonated_user_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `);

    const sessions = stmt.all(userId, userId, limit) as any[];

    return sessions.map(session => ({
      sessionId: session.session_id,
      originalUserId: session.original_user_id,
      originalUserEmail: session.original_user_email,
      originalUserRole: session.original_user_role as MemberRole,
      impersonatedUserId: session.impersonated_user_id,
      impersonatedUserEmail: session.impersonated_user_email,
      impersonatedUserRole: session.impersonated_user_role as MemberRole,
      cooperativeId: session.cooperative_id,
      startedAt: new Date(session.started_at),
      expiresAt: new Date(session.expires_at),
      endedAt: session.ended_at ? new Date(session.ended_at) : undefined,
      reason: session.reason,
      ipAddress: session.ip_address,
      userAgent: session.user_agent
    }));

  } finally {
    db.close();
  }
}

/**
 * Get impersonation audit log
 */
export async function getImpersonationAuditLog(
  cooperativeId: string,
  limit: number = 100
): Promise<ImpersonationAudit[]> {
  const db = getDatabase();

  try {
    const stmt = db.prepare(`
      SELECT * FROM impersonation_audit 
      WHERE cooperative_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const entries = stmt.all(cooperativeId, limit) as any[];

    return entries.map(entry => ({
      id: entry.id,
      sessionId: entry.session_id,
      action: entry.action as 'start' | 'end' | 'expire' | 'error',
      performedBy: entry.performed_by,
      targetUser: entry.target_user,
      cooperativeId: entry.cooperative_id,
      reason: entry.reason,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
      ipAddress: entry.ip_address,
      userAgent: entry.user_agent,
      createdAt: new Date(entry.created_at)
    }));

  } finally {
    db.close();
  }
}

/**
 * Clean up expired impersonation sessions
 */
export async function cleanupExpiredImpersonationSessions(): Promise<number> {
  const db = getDatabase();

  try {
    // Mark expired sessions as ended
    const updateStmt = db.prepare(`
      UPDATE impersonation_sessions 
      SET ended_at = expires_at, 
          updated_at = datetime('now')
      WHERE ended_at IS NULL 
        AND datetime(expires_at) <= datetime('now')
    `);

    const result = updateStmt.run();

    // Create audit entries for expired sessions
    const expiredStmt = db.prepare(`
      SELECT session_id, original_user_id, impersonated_user_id, cooperative_id
      FROM impersonation_sessions 
      WHERE ended_at = expires_at
        AND NOT EXISTS (
          SELECT 1 FROM impersonation_audit 
          WHERE session_id = impersonation_sessions.session_id 
            AND action = 'expire'
        )
    `);

    const expired = expiredStmt.all() as any[];

    const auditStmt = db.prepare(`
      INSERT INTO impersonation_audit (
        session_id,
        action,
        performed_by,
        target_user,
        cooperative_id,
        reason
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const session of expired) {
      auditStmt.run(
        session.session_id,
        'expire',
        session.original_user_id,
        session.impersonated_user_id,
        session.cooperative_id,
        'Session expired'
      );
    }

    return result.changes;

  } finally {
    db.close();
  }
}

/**
 * Validate impersonation session
 */
export async function validateImpersonationSession(
  sessionId: string
): Promise<boolean> {
  const db = getDatabase();

  try {
    const stmt = db.prepare(`
      SELECT 1 FROM impersonation_sessions 
      WHERE session_id = ? 
        AND ended_at IS NULL 
        AND datetime(expires_at) > datetime('now')
    `);

    const valid = stmt.get(sessionId);
    return !!valid;

  } finally {
    db.close();
  }
}