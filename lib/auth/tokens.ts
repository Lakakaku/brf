/**
 * Enhanced token management system for BRF Portal
 * Advanced JWT token management with refresh tokens, blacklisting, and automatic renewal
 */

import Database from 'better-sqlite3';
import { 
  AuthUser, 
  TokenPair, 
  RefreshTokenPayload, 
  AuthError, 
  AuthErrorType,
  JwtPayload,
  PasswordResetToken,
  PasswordResetAttempt
} from './types';
import { 
  generateToken, 
  generateRefreshToken, 
  verifyToken, 
  tokenBlacklist,
  generateTokenId,
  isTokenNearExpiration
} from './jwt';

/**
 * Database connection for token storage
 */
function getDatabase(): Database.Database {
  const dbPath = process.env.DATABASE_PATH || './database/brf.db';
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Token storage table creation (run once on startup)
 */
export function initializeTokenStorage(): void {
  const db = getDatabase();
  
  try {
    // Create refresh tokens table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        jti TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        cooperative_id TEXT NOT NULL,
        token_family TEXT NOT NULL, -- For token rotation
        expires_at TEXT NOT NULL,
        is_revoked INTEGER DEFAULT 0,
        revoked_at TEXT,
        revoked_reason TEXT,
        last_used_at TEXT,
        user_agent TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        -- Indexes for performance
        FOREIGN KEY (user_id) REFERENCES members(id) ON DELETE CASCADE
      );
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_jti ON refresh_tokens(jti);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(token_family);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(is_revoked, expires_at);
    `);

    // Create session tokens table for client-side session tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_tokens (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        session_id TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        cooperative_id TEXT NOT NULL,
        refresh_token_jti TEXT,
        device_fingerprint TEXT,
        user_agent TEXT,
        ip_address TEXT,
        expires_at TEXT NOT NULL,
        last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (user_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (refresh_token_jti) REFERENCES refresh_tokens(jti) ON DELETE SET NULL
      );
    `);

    // Create indexes for session tokens
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_tokens_session ON session_tokens(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON session_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_session_tokens_active ON session_tokens(is_active, expires_at);
      CREATE INDEX IF NOT EXISTS idx_session_tokens_activity ON session_tokens(last_activity_at);
    `);

    console.log('✅ Token storage initialized successfully');
  } finally {
    db.close();
  }
}

/**
 * Enhanced token pair creation with database storage
 */
export async function createEnhancedTokenPair(
  user: AuthUser,
  options: {
    userAgent?: string;
    ipAddress?: string;
    deviceFingerprint?: string;
    rememberMe?: boolean;
  } = {}
): Promise<TokenPair & { sessionId: string }> {
  const db = getDatabase();
  
  try {
    // Generate token family for rotation tracking
    const tokenFamily = generateTokenId('family');
    const sessionId = generateTokenId('session');
    
    // Create access and refresh tokens
    const [accessToken, refreshToken] = await Promise.all([
      generateToken(user),
      generateRefreshToken(user)
    ]);

    // Decode refresh token to get JTI
    const refreshPayload = await verifyToken(refreshToken.token, { ignoreExpiration: true });
    
    // Store refresh token in database
    const refreshTokenExpiry = new Date(refreshToken.expiresAt);
    db.prepare(`
      INSERT INTO refresh_tokens (
        jti, user_id, cooperative_id, token_family, expires_at,
        user_agent, ip_address, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      refreshPayload.jti,
      user.id,
      user.cooperativeId,
      tokenFamily,
      refreshTokenExpiry.toISOString(),
      options.userAgent || null,
      options.ipAddress || null
    );

    // Create session tracking entry
    const sessionExpiry = new Date();
    sessionExpiry.setHours(sessionExpiry.getHours() + (options.rememberMe ? 24 * 7 : 24)); // 7 days or 24 hours

    db.prepare(`
      INSERT INTO session_tokens (
        session_id, user_id, cooperative_id, refresh_token_jti,
        device_fingerprint, user_agent, ip_address, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      user.id,
      user.cooperativeId,
      refreshPayload.jti,
      options.deviceFingerprint || null,
      options.userAgent || null,
      options.ipAddress || null,
      sessionExpiry.toISOString()
    );

    return {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshTokenExpiresAt: refreshToken.expiresAt,
      tokenType: 'bearer' as const,
      sessionId
    };
  } finally {
    db.close();
  }
}

/**
 * Refresh access token using refresh token (with rotation)
 */
export async function refreshAccessToken(
  refreshToken: string,
  options: {
    userAgent?: string;
    ipAddress?: string;
  } = {}
): Promise<TokenPair & { user: AuthUser; sessionId: string }> {
  const db = getDatabase();
  
  try {
    // Verify refresh token
    let refreshPayload: JwtPayload;
    try {
      refreshPayload = await verifyToken(refreshToken, { ignoreExpiration: false });
    } catch (error) {
      if (error instanceof AuthError && error.type === AuthErrorType.TOKEN_EXPIRED) {
        throw new AuthError(
          AuthErrorType.REFRESH_TOKEN_EXPIRED,
          'Refresh token has expired',
          401
        );
      }
      throw new AuthError(
        AuthErrorType.REFRESH_TOKEN_INVALID,
        'Invalid refresh token',
        401
      );
    }

    // Check if refresh token exists and is valid in database
    const storedToken = db.prepare(`
      SELECT rt.*, m.id, m.email, m.first_name, m.last_name, m.role, 
             m.cooperative_id, m.is_active, m.permissions, m.last_login_at
      FROM refresh_tokens rt
      JOIN members m ON rt.user_id = m.id
      WHERE rt.jti = ? AND rt.is_revoked = 0 AND rt.expires_at > datetime('now')
    `).get(refreshPayload.jti) as any;

    if (!storedToken) {
      throw new AuthError(
        AuthErrorType.REFRESH_TOKEN_INVALID,
        'Refresh token not found or has been revoked',
        401
      );
    }

    // Create user object
    const user: AuthUser = {
      id: storedToken.id,
      email: storedToken.email,
      firstName: storedToken.first_name,
      lastName: storedToken.last_name,
      role: storedToken.role,
      cooperativeId: storedToken.cooperative_id,
      isActive: Boolean(storedToken.is_active),
      permissions: storedToken.permissions ? JSON.parse(storedToken.permissions) : {},
      lastLoginAt: storedToken.last_login_at,
    };

    // Check if user is still active
    if (!user.isActive) {
      // Revoke all tokens for this user
      await revokeAllUserTokens(user.id);
      throw new AuthError(
        AuthErrorType.USER_INACTIVE,
        'User account has been deactivated',
        403
      );
    }

    // Update last used timestamp
    db.prepare(`
      UPDATE refresh_tokens 
      SET last_used_at = datetime('now'), updated_at = datetime('now')
      WHERE jti = ?
    `).run(refreshPayload.jti);

    // Generate new access token
    const newAccessToken = await generateToken(user);

    // For security, rotate refresh token if it's close to expiration (within 1 day)
    let newRefreshToken = refreshToken;
    let refreshTokenExpiresAt = new Date(storedToken.expires_at);

    if (isTokenNearExpiration(refreshToken, 24 * 60)) { // 24 hours in minutes
      // Generate new refresh token
      const rotatedRefreshToken = await generateRefreshToken(user);
      newRefreshToken = rotatedRefreshToken.token;
      refreshTokenExpiresAt = rotatedRefreshToken.expiresAt;

      // Get new JTI
      const newRefreshPayload = await verifyToken(newRefreshToken, { ignoreExpiration: true });

      // Insert new refresh token
      db.prepare(`
        INSERT INTO refresh_tokens (
          jti, user_id, cooperative_id, token_family, expires_at,
          user_agent, ip_address, last_used_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        newRefreshPayload.jti,
        user.id,
        user.cooperativeId,
        storedToken.token_family,
        refreshTokenExpiresAt.toISOString(),
        options.userAgent || null,
        options.ipAddress || null
      );

      // Revoke old refresh token
      db.prepare(`
        UPDATE refresh_tokens 
        SET is_revoked = 1, revoked_at = datetime('now'), revoked_reason = 'rotated'
        WHERE jti = ?
      `).run(refreshPayload.jti);
    }

    // Get session ID
    const session = db.prepare(`
      SELECT session_id FROM session_tokens 
      WHERE refresh_token_jti = ? AND is_active = 1
    `).get(refreshPayload.jti) as any;

    const sessionId = session?.session_id || generateTokenId('session');

    // Update session activity
    db.prepare(`
      UPDATE session_tokens 
      SET last_activity_at = datetime('now'), updated_at = datetime('now')
      WHERE session_id = ?
    `).run(sessionId);

    return {
      accessToken: newAccessToken.token,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt: newAccessToken.expiresAt,
      refreshTokenExpiresAt: refreshTokenExpiresAt,
      tokenType: 'bearer' as const,
      user,
      sessionId
    };
  } finally {
    db.close();
  }
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(
  refreshToken: string,
  reason: string = 'user_logout'
): Promise<void> {
  const db = getDatabase();
  
  try {
    // Verify and decode token to get JTI
    const payload = await verifyToken(refreshToken, { ignoreExpiration: true });
    
    // Revoke in database
    db.prepare(`
      UPDATE refresh_tokens 
      SET is_revoked = 1, revoked_at = datetime('now'), revoked_reason = ?, updated_at = datetime('now')
      WHERE jti = ?
    `).run(reason, payload.jti);

    // Deactivate associated session
    db.prepare(`
      UPDATE session_tokens 
      SET is_active = 0, updated_at = datetime('now')
      WHERE refresh_token_jti = ?
    `).run(payload.jti);

    // Add to blacklist for immediate invalidation
    tokenBlacklist.addToken(refreshToken);
  } finally {
    db.close();
  }
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllUserTokens(
  userId: string,
  reason: string = 'user_logout_all'
): Promise<void> {
  const db = getDatabase();
  
  try {
    // Get all active refresh tokens for the user
    const tokens = db.prepare(`
      SELECT jti FROM refresh_tokens 
      WHERE user_id = ? AND is_revoked = 0
    `).all(userId) as any[];

    // Revoke all refresh tokens
    db.prepare(`
      UPDATE refresh_tokens 
      SET is_revoked = 1, revoked_at = datetime('now'), revoked_reason = ?, updated_at = datetime('now')
      WHERE user_id = ? AND is_revoked = 0
    `).run(reason, userId);

    // Deactivate all sessions
    db.prepare(`
      UPDATE session_tokens 
      SET is_active = 0, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(userId);

    // Add all tokens to blacklist (if we have the full tokens)
    // Note: This is a limitation - we only store JTIs, not full tokens
    // In production, consider using Redis with full token storage
  } finally {
    db.close();
  }
}

/**
 * Validate session and get user info
 */
export async function validateSession(sessionId: string): Promise<{
  isValid: boolean;
  user?: AuthUser;
  sessionExpiry?: Date;
}> {
  const db = getDatabase();
  
  try {
    const session = db.prepare(`
      SELECT st.*, m.id, m.email, m.first_name, m.last_name, m.role, 
             m.cooperative_id, m.is_active, m.permissions, m.last_login_at
      FROM session_tokens st
      JOIN members m ON st.user_id = m.id
      WHERE st.session_id = ? AND st.is_active = 1 AND st.expires_at > datetime('now')
    `).get(sessionId) as any;

    if (!session) {
      return { isValid: false };
    }

    // Update last activity
    db.prepare(`
      UPDATE session_tokens 
      SET last_activity_at = datetime('now'), updated_at = datetime('now')
      WHERE session_id = ?
    `).run(sessionId);

    const user: AuthUser = {
      id: session.id,
      email: session.email,
      firstName: session.first_name,
      lastName: session.last_name,
      role: session.role,
      cooperativeId: session.cooperative_id,
      isActive: Boolean(session.is_active),
      permissions: session.permissions ? JSON.parse(session.permissions) : {},
      lastLoginAt: session.last_login_at,
    };

    return {
      isValid: true,
      user,
      sessionExpiry: new Date(session.expires_at)
    };
  } finally {
    db.close();
  }
}

/**
 * Cleanup expired tokens (run as background job)
 */
export async function cleanupExpiredTokens(): Promise<{
  expiredRefreshTokens: number;
  expiredSessions: number;
}> {
  const db = getDatabase();
  
  try {
    // Delete expired refresh tokens
    const expiredRefreshResult = db.prepare(`
      DELETE FROM refresh_tokens 
      WHERE expires_at < datetime('now')
    `).run();

    // Deactivate expired sessions
    const expiredSessionsResult = db.prepare(`
      UPDATE session_tokens 
      SET is_active = 0, updated_at = datetime('now')
      WHERE expires_at < datetime('now') AND is_active = 1
    `).run();

    return {
      expiredRefreshTokens: expiredRefreshResult.changes,
      expiredSessions: expiredSessionsResult.changes
    };
  } finally {
    db.close();
  }
}

/**
 * Get active sessions for a user
 */
export async function getUserActiveSessions(userId: string): Promise<Array<{
  sessionId: string;
  userAgent?: string;
  ipAddress?: string;
  lastActivity: string;
  createdAt: string;
  expiresAt: string;
}>> {
  const db = getDatabase();
  
  try {
    const sessions = db.prepare(`
      SELECT session_id, user_agent, ip_address, last_activity_at, created_at, expires_at
      FROM session_tokens 
      WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now')
      ORDER BY last_activity_at DESC
    `).all(userId) as any[];

    return sessions.map(session => ({
      sessionId: session.session_id,
      userAgent: session.user_agent,
      ipAddress: session.ip_address,
      lastActivity: session.last_activity_at,
      createdAt: session.created_at,
      expiresAt: session.expires_at
    }));
  } finally {
    db.close();
  }
}

/**
 * Revoke a specific session
 */
export async function revokeSession(
  sessionId: string, 
  reason: string = 'user_revoked'
): Promise<void> {
  const db = getDatabase();
  
  try {
    // Get the session to find associated refresh token
    const session = db.prepare(`
      SELECT refresh_token_jti FROM session_tokens WHERE session_id = ?
    `).get(sessionId) as any;

    if (session) {
      // Revoke associated refresh token
      db.prepare(`
        UPDATE refresh_tokens 
        SET is_revoked = 1, revoked_at = datetime('now'), revoked_reason = ?, updated_at = datetime('now')
        WHERE jti = ?
      `).run(reason, session.refresh_token_jti);
    }

    // Deactivate session
    db.prepare(`
      UPDATE session_tokens 
      SET is_active = 0, updated_at = datetime('now')
      WHERE session_id = ?
    `).run(sessionId);
  } finally {
    db.close();
  }
}

/**
 * Check if refresh token is about to expire
 */
export async function isRefreshTokenExpiringSoon(
  refreshToken: string,
  thresholdHours: number = 24
): Promise<boolean> {
  try {
    const payload = await verifyToken(refreshToken, { ignoreExpiration: true });
    if (!payload.exp) return true;

    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const thresholdTime = currentTime + (thresholdHours * 60 * 60 * 1000);

    return expirationTime <= thresholdTime;
  } catch {
    return true; // If we can't decode, assume it's expiring
  }
}

/**
 * Get token statistics for monitoring
 */
export async function getTokenStatistics(): Promise<{
  activeRefreshTokens: number;
  activeSessions: number;
  revokedTokens: number;
  expiredTokens: number;
}> {
  const db = getDatabase();
  
  try {
    const activeRefreshTokens = db.prepare(`
      SELECT COUNT(*) as count FROM refresh_tokens 
      WHERE is_revoked = 0 AND expires_at > datetime('now')
    `).get() as any;

    const activeSessions = db.prepare(`
      SELECT COUNT(*) as count FROM session_tokens 
      WHERE is_active = 1 AND expires_at > datetime('now')
    `).get() as any;

    const revokedTokens = db.prepare(`
      SELECT COUNT(*) as count FROM refresh_tokens WHERE is_revoked = 1
    `).get() as any;

    const expiredTokens = db.prepare(`
      SELECT COUNT(*) as count FROM refresh_tokens 
      WHERE expires_at <= datetime('now')
    `).get() as any;

    return {
      activeRefreshTokens: activeRefreshTokens.count,
      activeSessions: activeSessions.count,
      revokedTokens: revokedTokens.count,
      expiredTokens: expiredTokens.count
    };
  } finally {
    db.close();
  }
}

/**
 * ============================================================================
 * PASSWORD RESET TOKEN MANAGEMENT
 * ============================================================================
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Generate a secure password reset token
 * @returns {string} - Cryptographically secure random token
 */
function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a password reset token for secure storage
 * @param token - The plain text token
 * @returns {Promise<string>} - Hashed token
 */
async function hashPasswordResetToken(token: string): Promise<string> {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a password reset token for a user
 * @param email - User's email address
 * @param options - Request tracking options
 * @returns {Promise<{ token: string; expiresAt: Date }>} - Reset token and expiry
 */
export async function createPasswordResetToken(
  email: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
  } = {}
): Promise<{ token: string; expiresAt: Date }> {
  const db = getDatabase();
  
  try {
    // Check if user exists
    const user = db.prepare(`
      SELECT id, cooperative_id, email, is_active 
      FROM members 
      WHERE email = ? AND deleted_at IS NULL
    `).get(email) as any;

    if (!user) {
      throw new AuthError(
        AuthErrorType.USER_NOT_FOUND,
        'No account found with this email address',
        404
      );
    }

    if (!user.is_active) {
      throw new AuthError(
        AuthErrorType.USER_INACTIVE,
        'Account is deactivated',
        403
      );
    }

    // Check rate limiting
    await checkPasswordResetRateLimit(email, options.ipAddress || '');

    // Invalidate any existing tokens for this user
    db.prepare(`
      DELETE FROM password_reset_tokens 
      WHERE user_id = ? OR (email = ? AND expires_at > datetime('now'))
    `).run(user.id, email);

    // Generate new token
    const token = generatePasswordResetToken();
    const tokenHash = await hashPasswordResetToken(token);
    
    // Set expiration to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store token in database
    db.prepare(`
      INSERT INTO password_reset_tokens (
        token_hash, user_id, email, cooperative_id, expires_at,
        request_ip, request_user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      tokenHash,
      user.id,
      email,
      user.cooperative_id,
      expiresAt.toISOString(),
      options.ipAddress || null,
      options.userAgent || null
    );

    // Update attempt tracking
    await recordPasswordResetAttempt(email, options.ipAddress || '', 'sent');

    // Log password reset request
    db.prepare(`
      INSERT INTO audit_log (
        cooperative_id, user_id, action, entity_type, entity_id,
        ip_address, user_agent, new_values
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.cooperative_id,
      user.id,
      'password_reset_requested',
      'password_reset',
      user.id,
      options.ipAddress || null,
      options.userAgent || null,
      JSON.stringify({
        email: email,
        expires_at: expiresAt.toISOString(),
        request_timestamp: new Date().toISOString()
      })
    );

    return { token, expiresAt };
  } finally {
    db.close();
  }
}

/**
 * Verify a password reset token
 * @param token - The reset token to verify
 * @returns {Promise<{ valid: boolean; user?: AuthUser; expired?: boolean; used?: boolean }>}
 */
export async function verifyPasswordResetToken(
  token: string
): Promise<{ 
  valid: boolean; 
  user?: AuthUser; 
  expired?: boolean; 
  used?: boolean;
  email?: string;
}> {
  const db = getDatabase();
  
  try {
    const tokenHash = await hashPasswordResetToken(token);
    
    // Find token in database with user info
    const storedToken = db.prepare(`
      SELECT 
        rt.*,
        m.id as user_id, m.email, m.first_name, m.last_name, 
        m.role, m.cooperative_id, m.is_active, m.permissions, m.last_login_at
      FROM password_reset_tokens rt
      JOIN members m ON rt.user_id = m.id
      WHERE rt.token_hash = ? AND m.deleted_at IS NULL
    `).get(tokenHash) as any;

    if (!storedToken) {
      return { valid: false };
    }

    // Check if token is already used
    if (storedToken.is_used) {
      return { 
        valid: false, 
        used: true,
        email: storedToken.email 
      };
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(storedToken.expires_at);
    if (now > expiresAt) {
      return { 
        valid: false, 
        expired: true,
        email: storedToken.email 
      };
    }

    // Check if user is still active
    if (!storedToken.is_active) {
      return { 
        valid: false,
        email: storedToken.email 
      };
    }

    // Create user object
    const user: AuthUser = {
      id: storedToken.user_id,
      email: storedToken.email,
      firstName: storedToken.first_name,
      lastName: storedToken.last_name,
      role: storedToken.role,
      cooperativeId: storedToken.cooperative_id,
      isActive: Boolean(storedToken.is_active),
      permissions: storedToken.permissions ? JSON.parse(storedToken.permissions) : {},
      lastLoginAt: storedToken.last_login_at,
    };

    return { 
      valid: true, 
      user,
      email: storedToken.email 
    };
  } finally {
    db.close();
  }
}

/**
 * Use a password reset token to reset password
 * @param token - The reset token
 * @param newPassword - New password to set
 * @param options - Request tracking options
 * @returns {Promise<{ success: boolean; user?: AuthUser }>}
 */
export async function usePasswordResetToken(
  token: string,
  newPassword: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
  } = {}
): Promise<{ success: boolean; user?: AuthUser }> {
  const db = getDatabase();
  
  try {
    // First verify the token
    const verification = await verifyPasswordResetToken(token);
    
    if (!verification.valid || !verification.user) {
      throw new AuthError(
        AuthErrorType.RESET_TOKEN_INVALID,
        'Invalid or expired reset token',
        400
      );
    }

    if (verification.expired) {
      throw new AuthError(
        AuthErrorType.RESET_TOKEN_EXPIRED,
        'Reset token has expired',
        400
      );
    }

    if (verification.used) {
      throw new AuthError(
        AuthErrorType.RESET_TOKEN_USED,
        'Reset token has already been used',
        400
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user's password
    db.prepare(`
      UPDATE members 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(passwordHash, verification.user.id);

    // Mark token as used
    const tokenHash = await hashPasswordResetToken(token);
    db.prepare(`
      UPDATE password_reset_tokens 
      SET 
        is_used = 1, 
        used_at = datetime('now'),
        reset_ip = ?,
        reset_user_agent = ?,
        updated_at = datetime('now')
      WHERE token_hash = ?
    `).run(options.ipAddress || null, options.userAgent || null, tokenHash);

    // Revoke all existing sessions for security
    await revokeAllUserTokens(verification.user.id, 'password_reset');

    // Log successful password reset
    db.prepare(`
      INSERT INTO audit_log (
        cooperative_id, user_id, action, entity_type, entity_id,
        ip_address, user_agent, new_values
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      verification.user.cooperativeId,
      verification.user.id,
      'password_reset_completed',
      'password_reset',
      verification.user.id,
      options.ipAddress || null,
      options.userAgent || null,
      JSON.stringify({
        email: verification.user.email,
        reset_timestamp: new Date().toISOString(),
        sessions_revoked: true
      })
    );

    return { success: true, user: verification.user };
  } finally {
    db.close();
  }
}

/**
 * Check password reset rate limiting
 * @param email - User's email
 * @param ipAddress - Request IP address
 * @throws {AuthError} - If rate limit is exceeded
 */
async function checkPasswordResetRateLimit(email: string, ipAddress: string): Promise<void> {
  const db = getDatabase();
  
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check email-based rate limiting (max 3 requests per hour per email)
    const emailAttempts = db.prepare(`
      SELECT COUNT(*) as count, MAX(last_attempt_at) as last_attempt
      FROM password_reset_attempts 
      WHERE email = ? AND last_attempt_at > ?
    `).get(email, oneHourAgo.toISOString()) as any;

    if (emailAttempts.count >= 3) {
      const lastAttempt = new Date(emailAttempts.last_attempt);
      const retryAfter = Math.ceil((lastAttempt.getTime() + 60 * 60 * 1000 - now.getTime()) / 1000);
      
      throw new AuthError(
        AuthErrorType.RATE_LIMIT_EXCEEDED,
        `Too many password reset requests. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        429
      );
    }

    // Check IP-based rate limiting (max 10 requests per hour per IP)
    const ipAttempts = db.prepare(`
      SELECT COUNT(*) as count, MAX(last_attempt_at) as last_attempt
      FROM password_reset_attempts 
      WHERE request_ip = ? AND last_attempt_at > ?
    `).get(ipAddress, oneHourAgo.toISOString()) as any;

    if (ipAttempts.count >= 10) {
      const lastAttempt = new Date(ipAttempts.last_attempt);
      const retryAfter = Math.ceil((lastAttempt.getTime() + 60 * 60 * 1000 - now.getTime()) / 1000);
      
      throw new AuthError(
        AuthErrorType.RATE_LIMIT_EXCEEDED,
        `Too many password reset requests from this location. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        429
      );
    }

    // Check if this email/IP combination is temporarily blocked
    const blocked = db.prepare(`
      SELECT blocked_until FROM password_reset_attempts 
      WHERE email = ? AND request_ip = ? AND blocked_until > datetime('now')
    `).get(email, ipAddress) as any;

    if (blocked) {
      const blockedUntil = new Date(blocked.blocked_until);
      const retryAfter = Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000);
      
      throw new AuthError(
        AuthErrorType.PASSWORD_RESET_BLOCKED,
        `Password reset temporarily blocked. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        429
      );
    }
  } finally {
    db.close();
  }
}

/**
 * Record a password reset attempt for rate limiting
 * @param email - User's email
 * @param ipAddress - Request IP address
 * @param status - Attempt status
 * @param failureReason - Reason if failed
 */
async function recordPasswordResetAttempt(
  email: string,
  ipAddress: string,
  status: 'pending' | 'sent' | 'failed' | 'blocked' = 'pending',
  failureReason?: string
): Promise<void> {
  const db = getDatabase();
  
  try {
    // Get cooperative ID from email
    const member = db.prepare(`
      SELECT cooperative_id FROM members WHERE email = ? AND deleted_at IS NULL
    `).get(email) as any;

    if (!member) {
      return; // Don't record attempts for non-existent users
    }

    // Check if we have an existing attempt record for this email/IP combination
    const existing = db.prepare(`
      SELECT id, attempt_count FROM password_reset_attempts 
      WHERE email = ? AND request_ip = ?
      ORDER BY last_attempt_at DESC 
      LIMIT 1
    `).get(email, ipAddress) as any;

    if (existing) {
      // Update existing record
      const newCount = existing.attempt_count + 1;
      let blockedUntil = null;

      // Block if too many failed attempts
      if (status === 'failed' && newCount >= 5) {
        const blockDuration = Math.min(newCount * 5, 60); // 5 minutes to 1 hour
        blockedUntil = new Date();
        blockedUntil.setMinutes(blockedUntil.getMinutes() + blockDuration);
        status = 'blocked';
      }

      db.prepare(`
        UPDATE password_reset_attempts 
        SET 
          attempt_count = ?,
          last_attempt_at = datetime('now'),
          status = ?,
          failure_reason = ?,
          blocked_until = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        newCount,
        status,
        failureReason || null,
        blockedUntil ? blockedUntil.toISOString() : null,
        existing.id
      );
    } else {
      // Create new record
      db.prepare(`
        INSERT INTO password_reset_attempts (
          cooperative_id, email, request_ip, attempt_count, 
          status, failure_reason
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        member.cooperative_id,
        email,
        ipAddress,
        1,
        status,
        failureReason || null
      );
    }
  } finally {
    db.close();
  }
}

/**
 * Clean up expired password reset tokens (run as background job)
 */
export async function cleanupExpiredPasswordResetTokens(): Promise<{
  expiredTokens: number;
  oldAttempts: number;
}> {
  const db = getDatabase();
  
  try {
    // Delete expired tokens
    const expiredTokensResult = db.prepare(`
      DELETE FROM password_reset_tokens 
      WHERE expires_at < datetime('now')
    `).run();

    // Delete old attempt records (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const oldAttemptsResult = db.prepare(`
      DELETE FROM password_reset_attempts 
      WHERE last_attempt_at < ?
    `).run(sevenDaysAgo.toISOString());

    return {
      expiredTokens: expiredTokensResult.changes,
      oldAttempts: oldAttemptsResult.changes
    };
  } finally {
    db.close();
  }
}

/**
 * Get password reset statistics for monitoring
 */
export async function getPasswordResetStatistics(): Promise<{
  activeTokens: number;
  usedTokensToday: number;
  attemptsToday: number;
  blockedAttempts: number;
}> {
  const db = getDatabase();
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeTokens = db.prepare(`
      SELECT COUNT(*) as count FROM password_reset_tokens 
      WHERE is_used = 0 AND expires_at > datetime('now')
    `).get() as any;

    const usedTokensToday = db.prepare(`
      SELECT COUNT(*) as count FROM password_reset_tokens 
      WHERE is_used = 1 AND used_at >= ?
    `).get(today.toISOString()) as any;

    const attemptsToday = db.prepare(`
      SELECT COUNT(*) as count FROM password_reset_attempts 
      WHERE last_attempt_at >= ?
    `).get(today.toISOString()) as any;

    const blockedAttempts = db.prepare(`
      SELECT COUNT(*) as count FROM password_reset_attempts 
      WHERE blocked_until > datetime('now')
    `).get() as any;

    return {
      activeTokens: activeTokens.count,
      usedTokensToday: usedTokensToday.count,
      attemptsToday: attemptsToday.count,
      blockedAttempts: blockedAttempts.count
    };
  } finally {
    db.close();
  }
}