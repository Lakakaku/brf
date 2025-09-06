/**
 * Two-Factor Authentication Disable API Route
 * POST /api/auth/2fa/disable - Disable 2FA for authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { 
  requireAuth, 
  AuthenticatedRequest,
  twoFactorDisableSchema,
  TwoFactorDisableResponse,
  AuthError,
  AuthErrorType,
  AuthErrorHandlers,
  verifyPassword 
} from '@/lib/auth';
import { 
  disableTwoFactor,
  hasTwoFactorEnabled,
  verifyTwoFactorCode,
  verifyBackupCode,
  logTwoFactorAudit 
} from '@/lib/auth/2fa';

/**
 * Database connection
 */
let db: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || './database/brf.db';
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA for authenticated user with proper verification
 */
export const POST = requireAuth(async (
  req: AuthenticatedRequest,
  res: NextResponse
) => {
  try {
    const user = req.user!; // Safe to use ! after requireAuth
    const body = await req.json();
    
    // Validate request body
    const validation = twoFactorDisableSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ogiltig förfrågningsdata',
        } as TwoFactorDisableResponse,
        { status: 400 }
      );
    }
    
    const { password, code } = validation.data;
    
    // Check if user has 2FA enabled
    const has2FA = await hasTwoFactorEnabled(user.id);
    if (!has2FA) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tvåfaktorsautentisering är inte aktiverad för detta konto',
        } as TwoFactorDisableResponse,
        { status: 400 }
      );
    }
    
    // Verify user's current password
    const database = getDatabase();
    const userRecord = database.prepare(`
      SELECT password_hash FROM members WHERE id = ?
    `).get(user.id) as { password_hash: string } | undefined;
    
    if (!userRecord) {
      return NextResponse.json(
        {
          success: false,
          error: 'Användare hittades inte',
        } as TwoFactorDisableResponse,
        { status: 404 }
      );
    }
    
    const isPasswordValid = await verifyPassword(password, userRecord.password_hash);
    if (!isPasswordValid) {
      // Log failed password verification
      const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
      const userAgent = req.headers.get('user-agent') || undefined;
      
      await logTwoFactorAudit(
        user.cooperativeId,
        user.id,
        'disabled',
        'Tvåfaktorsautentisering inaktivering misslyckades - fel lösenord',
        ip,
        userAgent,
        {
          userEmail: user.email,
          reason: 'invalid_password',
        },
        'medium'
      );
      
      return NextResponse.json(
        {
          success: false,
          error: 'Fel lösenord',
        } as TwoFactorDisableResponse,
        { status: 400 }
      );
    }
    
    // Get client information for audit logging
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;
    
    // If 2FA code is provided, verify it
    let codeVerificationPassed = false;
    let isBackupCode = false;
    
    if (code && code.trim()) {
      try {
        // First try as TOTP code
        const totpResult = await verifyTwoFactorCode(user.id, code, ip, userAgent);
        if (totpResult.success) {
          codeVerificationPassed = true;
          isBackupCode = totpResult.isBackupCode || false;
        }
      } catch (error) {
        // If TOTP verification fails, try as backup code
        try {
          const backupResult = await verifyBackupCode(user.id, code, ip, userAgent);
          if (backupResult.success) {
            codeVerificationPassed = true;
            isBackupCode = true;
          }
        } catch (backupError) {
          // Both TOTP and backup code verification failed
          await logTwoFactorAudit(
            user.cooperativeId,
            user.id,
            'disabled',
            'Tvåfaktorsautentisering inaktivering misslyckades - ogiltig 2FA-kod',
            ip,
            userAgent,
            {
              userEmail: user.email,
              reason: 'invalid_2fa_code',
              codeProvided: true,
            },
            'medium'
          );
          
          return NextResponse.json(
            {
              success: false,
              error: 'Ogiltig tvåfaktorsautentiseringskod',
            } as TwoFactorDisableResponse,
            { status: 400 }
          );
        }
      }
    }
    
    // Require 2FA code verification for security
    if (!codeVerificationPassed && code) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ogiltig tvåfaktorsautentiseringskod',
        } as TwoFactorDisableResponse,
        { status: 400 }
      );
    }
    
    // For extra security, require 2FA code when disabling
    if (!code || !codeVerificationPassed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tvåfaktorsautentiseringskod krävs för att inaktivera 2FA',
        } as TwoFactorDisableResponse,
        { status: 400 }
      );
    }
    
    // Disable 2FA
    await disableTwoFactor(
      user.id,
      user.cooperativeId,
      ip,
      userAgent,
      'User requested via web interface'
    );
    
    // Log successful disable with additional context
    await logTwoFactorAudit(
      user.cooperativeId,
      user.id,
      'disabled',
      'Tvåfaktorsautentisering inaktiverad av användare via webbgränssnitt',
      ip,
      userAgent,
      {
        userEmail: user.email,
        verificationMethod: isBackupCode ? 'backup_code' : 'totp',
        disableReason: 'user_request',
        interface: 'web_app',
      },
      'high'
    );
    
    return NextResponse.json(
      {
        success: true,
        message: 'Tvåfaktorsautentisering har inaktiverats för ditt konto',
      } as TwoFactorDisableResponse,
      { status: 200 }
    );
    
  } catch (error) {
    console.error('2FA disable error:', error);
    
    if (error instanceof AuthError) {
      const errorResponse = AuthErrorHandlers.handleAuthError(error);
      
      return NextResponse.json(
        {
          success: false,
          error: AuthErrorHandlers.getUserFriendlyMessage(error),
        } as TwoFactorDisableResponse,
        { status: errorResponse.statusCode }
      );
    }
    
    // Log unexpected errors
    const user = req.user;
    if (user) {
      const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
      const userAgent = req.headers.get('user-agent') || undefined;
      
      await logTwoFactorAudit(
        user.cooperativeId,
        user.id,
        'disabled',
        'Tvåfaktorsautentisering inaktivering misslyckades - systemfel',
        ip,
        userAgent,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userEmail: user.email,
        },
        'high'
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Ett oväntat fel uppstod vid inaktivering av tvåfaktorsautentisering',
      } as TwoFactorDisableResponse,
      { status: 500 }
    );
  }
});

/**
 * GET /api/auth/2fa/disable
 * Check if 2FA can be disabled and get current status
 */
export const GET = requireAuth(async (
  req: AuthenticatedRequest,
  res: NextResponse
) => {
  try {
    const user = req.user!; // Safe to use ! after requireAuth
    
    // Check if user has 2FA enabled
    const has2FA = await hasTwoFactorEnabled(user.id);
    
    // Check if there are any organizational policies preventing disable
    // (This would be configurable in a real implementation)
    const canDisable = true; // For now, always allow disable
    const requiresAdminApproval = false; // For now, no admin approval required
    
    return NextResponse.json(
      {
        success: true,
        data: {
          enabled: has2FA,
          canDisable,
          requiresAdminApproval,
          requiresPasswordVerification: true,
          requires2FAVerification: true,
        },
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('2FA disable status error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Ett fel uppstod vid kontroll av tvåfaktorsautentisering status',
      },
      { status: 500 }
    );
  }
});