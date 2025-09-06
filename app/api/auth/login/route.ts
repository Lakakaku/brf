/**
 * Enhanced Login API route for BRF Portal with Two-Factor Authentication support
 * Handles email/password authentication with optional 2FA verification
 */

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { 
  loginSchema, 
  AuthUser, 
  AuthError, 
  AuthErrorType,
  isValidMemberRole,
  DEFAULT_PERMISSIONS,
  LoginResponseWith2FA,
  SessionDataWith2FA 
} from '@/lib/auth/types';
import { verifyPassword, passwordAttemptTracker } from '@/lib/auth/crypto';
import { createTokenPair } from '@/lib/auth/jwt';
import { createEnhancedTokenPair, initializeTokenStorage } from '@/lib/auth/tokens';
import { createSession } from '@/lib/auth/session';
import { logAuthEvent } from '@/lib/auth/middleware';
import { 
  hasTwoFactorEnabled, 
  getTwoFactorStatus, 
  verifyTwoFactorCode, 
  logTwoFactorAudit 
} from '@/lib/auth/2fa';

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
 * Get user by email and cooperative
 * @param email - User email
 * @param cooperativeId - Optional cooperative ID filter
 * @returns User data or null
 */
async function getUserByEmail(
  email: string, 
  cooperativeId?: string
): Promise<AuthUser | null> {
  const db = getDatabase();
  
  try {
    let query = `
      SELECT 
        m.id, m.email, m.first_name, m.last_name, m.role, 
        m.cooperative_id, m.is_active, m.permissions, m.password_hash,
        c.name as cooperative_name, c.subdomain
      FROM members m
      LEFT JOIN cooperatives c ON m.cooperative_id = c.id
      WHERE m.email = ? AND m.deleted_at IS NULL
    `;
    
    const params = [email.toLowerCase()];
    
    if (cooperativeId) {
      query += ' AND m.cooperative_id = ?';
      params.push(cooperativeId);
    }
    
    const row = db.prepare(query).get(...params) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      cooperativeId: row.cooperative_id,
      isActive: Boolean(row.is_active),
      permissions: row.permissions ? JSON.parse(row.permissions) : {},
      lastLoginAt: null, // Will be updated after successful login
      passwordHash: row.password_hash, // Temporary for verification
      cooperativeName: row.cooperative_name,
      cooperativeSubdomain: row.subdomain,
    } as any;
  } finally {
    db.close();
  }
}

/**
 * Update user's last login timestamp
 * @param userId - User ID to update
 */
async function updateLastLogin(userId: string): Promise<void> {
  const db = getDatabase();
  
  try {
    db.prepare(`
      UPDATE members 
      SET last_login_at = datetime('now')
      WHERE id = ?
    `).run(userId);
  } finally {
    db.close();
  }
}

/**
 * Enhanced login schema with 2FA support
 */
const enhancedLoginSchema = loginSchema.extend({
  twoFactorCode: loginSchema.shape.email.optional(), // Optional 2FA code
  trustDevice: loginSchema.shape.rememberMe.optional().default(false), // Optional device trust
});

/**
 * Login API handler with 2FA support
 */
export async function POST(request: NextRequest) {
  let requestBody: any;
  let userEmail: string | null = null;
  
  try {
    // Parse and validate request body
    requestBody = await request.json();
    const { 
      email, 
      password, 
      rememberMe, 
      cooperativeId, 
      twoFactorCode,
      trustDevice 
    } = enhancedLoginSchema.parse(requestBody);
    userEmail = email;
    
    // Rate limiting check
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `login:${email}:${clientIp}`;
    
    if (passwordAttemptTracker.isRateLimited(rateLimitKey)) {
      const timeUntilUnlock = passwordAttemptTracker.getTimeUntilUnlock(rateLimitKey);
      
      await logAuthEvent('login_rate_limited', null, request, {
        email,
        ip: clientIp,
        timeUntilUnlock,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'För många inloggningsförsök. Försök igen senare.',
          code: 'RATE_LIMITED',
          retryAfter: timeUntilUnlock,
        } as LoginResponseWith2FA,
        { status: 429 }
      );
    }
    
    // Get user by email
    const user = await getUserByEmail(email, cooperativeId);
    
    if (!user) {
      // Record failed attempt for rate limiting
      passwordAttemptTracker.recordAttempt(rateLimitKey);
      
      await logAuthEvent('login_user_not_found', null, request, {
        email,
        ip: clientIp,
        cooperativeId,
      });
      
      throw new AuthError(
        AuthErrorType.INVALID_CREDENTIALS,
        'Fel email eller lösenord',
        401
      );
    }
    
    // Check if user is active
    if (!user.isActive) {
      await logAuthEvent('login_user_inactive', user, request, {
        email,
        ip: clientIp,
      });
      
      throw new AuthError(
        AuthErrorType.USER_INACTIVE,
        'Ditt konto är inaktiverat. Kontakta administratören.',
        401
      );
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, (user as any).passwordHash);
    
    if (!isPasswordValid) {
      // Record failed attempt for rate limiting
      passwordAttemptTracker.recordAttempt(rateLimitKey);
      
      await logAuthEvent('login_invalid_password', user, request, {
        email,
        ip: clientIp,
      });
      
      throw new AuthError(
        AuthErrorType.INVALID_CREDENTIALS,
        'Fel email eller lösenord',
        401
      );
    }
    
    // Remove password hash from user object for security
    const authenticatedUser: AuthUser = {\n      id: user.id,\n      email: user.email,\n      firstName: user.firstName,\n      lastName: user.lastName,\n      role: user.role,\n      cooperativeId: user.cooperativeId,\n      isActive: user.isActive,\n      permissions: { ...DEFAULT_PERMISSIONS[user.role], ...user.permissions },\n      lastLoginAt: user.lastLoginAt,\n    };\n    \n    // Check if user has 2FA enabled\n    const has2FA = await hasTwoFactorEnabled(authenticatedUser.id);\n    \n    if (has2FA) {\n      // 2FA is enabled - verify 2FA code\n      if (!twoFactorCode || !twoFactorCode.trim()) {\n        // 2FA code is required but not provided\n        await logAuthEvent('login_2fa_required', authenticatedUser, request, {\n          ip: clientIp,\n          email: authenticatedUser.email,\n          cooperativeId: authenticatedUser.cooperativeId,\n        });\n        \n        const twoFactorStatus = await getTwoFactorStatus(authenticatedUser.id);\n        \n        return NextResponse.json(\n          {\n            success: false,\n            requiresTwoFactor: true,\n            message: 'Tvåfaktorsautentisering krävs',\n            user: {\n              id: authenticatedUser.id,\n              email: authenticatedUser.email,\n              firstName: authenticatedUser.firstName,\n              lastName: authenticatedUser.lastName,\n            },\n            backupCodesRemaining: twoFactorStatus.backupCodesRemaining,\n          } as LoginResponseWith2FA,\n          { status: 200 } // 200 because password was correct, just need 2FA\n        );\n      }\n      \n      // Verify 2FA code\n      try {\n        const twoFactorResult = await verifyTwoFactorCode(\n          authenticatedUser.id,\n          twoFactorCode,\n          clientIp,\n          request.headers.get('user-agent') || undefined\n        );\n        \n        if (!twoFactorResult.success) {\n          // 2FA verification failed\n          passwordAttemptTracker.recordAttempt(rateLimitKey);\n          \n          await logAuthEvent('login_2fa_failed', authenticatedUser, request, {\n            ip: clientIp,\n            email: authenticatedUser.email,\n            cooperativeId: authenticatedUser.cooperativeId,\n            isBackupCode: twoFactorResult.isBackupCode,\n          });\n          \n          const twoFactorStatus = await getTwoFactorStatus(authenticatedUser.id);\n          \n          return NextResponse.json(\n            {\n              success: false,\n              requiresTwoFactor: true,\n              error: 'Fel verifieringskod för tvåfaktorsautentisering',\n              user: {\n                id: authenticatedUser.id,\n                email: authenticatedUser.email,\n                firstName: authenticatedUser.firstName,\n                lastName: authenticatedUser.lastName,\n              },\n              backupCodesRemaining: twoFactorStatus.backupCodesRemaining,\n            } as LoginResponseWith2FA,\n            { status: 400 }\n          );\n        }\n        \n        // 2FA verification successful\n        const twoFactorStatus = await getTwoFactorStatus(authenticatedUser.id);\n        \n        await logTwoFactorAudit(\n          authenticatedUser.cooperativeId,\n          authenticatedUser.id,\n          'totp_verified',\n          `2FA verifiering lyckades vid inloggning${twoFactorResult.isBackupCode ? ' (backup-kod använd)' : ''}`,\n          clientIp,\n          request.headers.get('user-agent') || undefined,\n          {\n            loginMethod: 'web_app',\n            isBackupCode: twoFactorResult.isBackupCode,\n            backupCodesRemaining: twoFactorStatus.backupCodesRemaining,\n            trustDeviceRequested: trustDevice,\n          },\n          'low'\n        );\n        \n      } catch (twoFactorError) {\n        // Handle rate limiting from 2FA module\n        if (twoFactorError instanceof AuthError && twoFactorError.type === AuthErrorType.TWO_FACTOR_RATE_LIMIT) {\n          const twoFactorStatus = await getTwoFactorStatus(authenticatedUser.id);\n          \n          return NextResponse.json(\n            {\n              success: false,\n              requiresTwoFactor: true,\n              error: 'För många tvåfaktorsförsök. Vänta 15 minuter innan du försöker igen.',\n              user: {\n                id: authenticatedUser.id,\n                email: authenticatedUser.email,\n                firstName: authenticatedUser.firstName,\n                lastName: authenticatedUser.lastName,\n              },\n              backupCodesRemaining: twoFactorStatus.backupCodesRemaining,\n            } as LoginResponseWith2FA,\n            { status: 429 }\n          );\n        }\n        \n        if (twoFactorError instanceof AuthError) {\n          const twoFactorStatus = await getTwoFactorStatus(authenticatedUser.id);\n          \n          return NextResponse.json(\n            {\n              success: false,\n              requiresTwoFactor: true,\n              error: twoFactorError.message,\n              user: {\n                id: authenticatedUser.id,\n                email: authenticatedUser.email,\n                firstName: authenticatedUser.firstName,\n                lastName: authenticatedUser.lastName,\n              },\n              backupCodesRemaining: twoFactorStatus.backupCodesRemaining,\n            } as LoginResponseWith2FA,\n            { status: twoFactorError.statusCode }\n          );\n        }\n        \n        // Unexpected 2FA error\n        await logTwoFactorAudit(\n          authenticatedUser.cooperativeId,\n          authenticatedUser.id,\n          'totp_failed',\n          '2FA verifiering misslyckades vid inloggning - systemfel',\n          clientIp,\n          request.headers.get('user-agent') || undefined,\n          {\n            error: twoFactorError instanceof Error ? twoFactorError.message : 'Unknown error',\n            loginMethod: 'web_app',\n          },\n          'high'\n        );\n        \n        throw new AuthError(\n          AuthErrorType.INTERNAL_ERROR,\n          'Ett fel uppstod vid verifiering av tvåfaktorsautentisering',\n          500\n        );\n      }\n    }\n    \n    // Update last login timestamp\n    await updateLastLogin(authenticatedUser.id);\n    authenticatedUser.lastLoginAt = new Date().toISOString();\n    \n    // Create response with user data\n    let response = NextResponse.json({\n      success: true,\n      user: authenticatedUser,\n      message: 'Inloggning lyckades',\n      requiresTwoFactor: false,\n    } as LoginResponseWith2FA);\n    \n    // Create session with 2FA information\n    try {\n      const sessionData: SessionDataWith2FA = {\n        user: authenticatedUser,\n        isLoggedIn: true,\n        loginTimestamp: Date.now(),\n        twoFactorVerified: has2FA, // Mark as 2FA verified if 2FA was required and passed\n        twoFactorTimestamp: has2FA ? Date.now() : undefined,\n      };\n      \n      await createSession(request, response, authenticatedUser);\n    } catch (sessionError) {\n      console.error('Session creation error:', sessionError);\n      // Continue without session - JWT will still work\n    }\n    \n    // Initialize token storage (only needs to be done once)\n    try {\n      initializeTokenStorage();\n    } catch (storageError) {\n      console.log('Token storage already initialized or initialization failed:', storageError);\n    }\n    \n    // Generate enhanced JWT tokens with database storage\n    try {\n      const enhancedTokenPair = await createEnhancedTokenPair(authenticatedUser, {\n        rememberMe: rememberMe || false,\n        deviceInfo: {\n          ip: clientIp,\n          userAgent: request.headers.get('user-agent') || undefined,\n        },\n        twoFactorVerified: has2FA, // Include 2FA status in token\n      });\n      \n      // Set JWT tokens in response headers\n      response.headers.set('X-Access-Token', enhancedTokenPair.accessToken);\n      response.headers.set('X-Refresh-Token', enhancedTokenPair.refreshToken);\n      response.headers.set('X-Token-Expires-At', enhancedTokenPair.accessTokenExpiresAt.toISOString());\n      response.headers.set('X-Refresh-Expires-At', enhancedTokenPair.refreshTokenExpiresAt.toISOString());\n      \n      // Set secure cookies\n      const isProduction = process.env.NODE_ENV === 'production';\n      const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60; // 7 days or 24 hours\n      \n      response.cookies.set('refresh-token', enhancedTokenPair.refreshToken, {\n        httpOnly: true,\n        secure: isProduction,\n        sameSite: 'strict',\n        maxAge,\n        path: '/',\n      });\n      \n    } catch (tokenError) {\n      console.error('Enhanced token creation error:', tokenError);\n      \n      // Fallback to basic token creation\n      try {\n        const basicTokenPair = await createTokenPair(authenticatedUser);\n        response.headers.set('X-Access-Token', basicTokenPair.accessToken);\n        response.headers.set('X-Refresh-Token', basicTokenPair.refreshToken);\n        response.headers.set('X-Token-Expires-At', basicTokenPair.accessTokenExpiresAt.toISOString());\n      } catch (fallbackError) {\n        console.error('Fallback token creation error:', fallbackError);\n        // Session-only authentication will still work\n      }\n    }\n    \n    // Get 2FA status for response\n    let twoFactorStatus;\n    if (has2FA) {\n      twoFactorStatus = await getTwoFactorStatus(authenticatedUser.id);\n    }\n    \n    // Log successful login\n    await logAuthEvent('login_success', authenticatedUser, request, {\n      ip: clientIp,\n      rememberMe: rememberMe || false,\n      cooperativeId: authenticatedUser.cooperativeId,\n      twoFactorEnabled: has2FA,\n      twoFactorUsed: has2FA && !!twoFactorCode,\n      trustDeviceRequested: trustDevice || false,\n    });\n    \n    // Update response with 2FA status\n    const loginResponse: LoginResponseWith2FA = {\n      success: true,\n      user: authenticatedUser,\n      message: 'Inloggning lyckades',\n      requiresTwoFactor: false, // Already handled\n      backupCodesRemaining: twoFactorStatus?.backupCodesRemaining,\n    };\n    \n    return NextResponse.json(loginResponse, {\n      status: 200,\n      headers: response.headers,\n    });\n    \n  } catch (error) {\n    // Handle validation errors\n    if (error instanceof Error && error.name === 'ZodError') {\n      return NextResponse.json(\n        {\n          success: false,\n          error: 'Ogiltig förfrågningsdata',\n          code: 'VALIDATION_ERROR',\n          details: (error as any).errors,\n        } as LoginResponseWith2FA,\n        { status: 400 }\n      );\n    }\n    \n    // Handle authentication errors\n    if (error instanceof AuthError) {\n      return NextResponse.json(\n        {\n          success: false,\n          error: error.message,\n          code: error.type,\n        } as LoginResponseWith2FA,\n        { status: error.statusCode }\n      );\n    }\n    \n    // Log unexpected errors\n    console.error('Login API error:', error);\n    \n    await logAuthEvent('login_error', null, request, {\n      email: userEmail,\n      error: error instanceof Error ? error.message : 'Unknown error',\n    });\n    \n    return NextResponse.json(\n      {\n        success: false,\n        error: 'Internt serverfel',\n        code: 'INTERNAL_ERROR',\n      } as LoginResponseWith2FA,\n      { status: 500 }\n    );\n  }\n}\n\n/**\n * Handle unsupported methods\n */\nexport async function GET() {\n  return NextResponse.json(\n    { error: 'Metod ej tillåten' },\n    { status: 405 }\n  );\n}\n\nexport async function PUT() {\n  return NextResponse.json(\n    { error: 'Metod ej tillåten' },\n    { status: 405 }\n  );\n}\n\nexport async function DELETE() {\n  return NextResponse.json(\n    { error: 'Metod ej tillåten' },\n    { status: 405 }\n  );\n}\n\nexport async function PATCH() {\n  return NextResponse.json(\n    { error: 'Metod ej tillåten' },\n    { status: 405 }\n  );\n}