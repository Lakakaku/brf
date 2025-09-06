/**
 * Two-Factor Authentication Backup Codes API Route
 * POST /api/auth/2fa/backup-codes - Regenerate backup codes
 * GET /api/auth/2fa/backup-codes - Get backup codes status
 */

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { 
  requireAuth, 
  AuthenticatedRequest,
  twoFactorBackupCodesRegenerateSchema,
  TwoFactorBackupCodesResponse,
  AuthError,
  AuthErrorType,
  AuthErrorHandlers,
  verifyPassword 
} from '@/lib/auth';
import { 
  regenerateBackupCodes,
  hasTwoFactorEnabled,
  getTwoFactorStatus,
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
 * GET /api/auth/2fa/backup-codes
 * Get backup codes status for authenticated user
 */
export const GET = requireAuth(async (
  req: AuthenticatedRequest,
  res: NextResponse
) => {
  try {
    const user = req.user!; // Safe to use ! after requireAuth
    
    // Check if user has 2FA enabled
    const has2FA = await hasTwoFactorEnabled(user.id);
    if (!has2FA) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tvåfaktorsautentisering är inte aktiverad för detta konto',
        } as TwoFactorBackupCodesResponse,
        { status: 400 }
      );
    }
    
    // Get status including backup codes count
    const status = await getTwoFactorStatus(user.id);
    
    // Get additional backup codes information
    const database = getDatabase();
    const backupCodeStats = database.prepare(`
      SELECT 
        COUNT(*) as total_codes,
        COUNT(CASE WHEN is_used = 0 THEN 1 END) as unused_codes,
        COUNT(CASE WHEN is_used = 1 THEN 1 END) as used_codes,
        MAX(created_at) as last_generated,
        generation_batch
      FROM two_factor_backup_codes 
      WHERE user_id = ?
      GROUP BY generation_batch
      ORDER BY created_at DESC
      LIMIT 1
    `).get(user.id) as {
      total_codes: number;
      unused_codes: number;
      used_codes: number;
      last_generated: string;
      generation_batch: string;
    } | undefined;
    
    return NextResponse.json(
      {
        success: true,
        data: {
          totalCodes: backupCodeStats?.total_codes || 0,
          remainingCodes: status.backupCodesRemaining,
          usedCodes: backupCodeStats?.used_codes || 0,
          lastGenerated: backupCodeStats?.last_generated,
          generationBatch: backupCodeStats?.generation_batch,
        },
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Backup codes status error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Ett fel uppstod vid hämtning av backup-koder status',
      } as TwoFactorBackupCodesResponse,
      { status: 500 }
    );
  }
});

/**
 * POST /api/auth/2fa/backup-codes
 * Regenerate backup codes for authenticated user
 */
export const POST = requireAuth(async (
  req: AuthenticatedRequest,
  res: NextResponse
) => {
  try {
    const user = req.user!; // Safe to use ! after requireAuth
    const body = await req.json();
    
    // Validate request body
    const validation = twoFactorBackupCodesRegenerateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ogiltig förfrågningsdata',
        } as TwoFactorBackupCodesResponse,
        { status: 400 }
      );
    }
    
    const { password } = validation.data;
    
    // Check if user has 2FA enabled
    const has2FA = await hasTwoFactorEnabled(user.id);
    if (!has2FA) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tvåfaktorsautentisering är inte aktiverad för detta konto',
        } as TwoFactorBackupCodesResponse,
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
        } as TwoFactorBackupCodesResponse,
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
        'backup_codes_regenerated',
        'Backup-koder regenerering misslyckades - fel lösenord',
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
        } as TwoFactorBackupCodesResponse,
        { status: 400 }
      );
    }
    
    // Get client information for audit logging
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;
    
    // Regenerate backup codes
    const newBackupCodes = await regenerateBackupCodes(
      user.id,
      user.cooperativeId
    );
    
    // Log successful regeneration
    await logTwoFactorAudit(
      user.cooperativeId,
      user.id,
      'backup_codes_regenerated',
      'Backup-koder regenererade av användare',
      ip,
      userAgent,
      {
        userEmail: user.email,
        codesGenerated: newBackupCodes.length,
        previousCodesInvalidated: true,
      },
      'medium'
    );
    
    return NextResponse.json(
      {
        success: true,
        backupCodes: newBackupCodes,
      } as TwoFactorBackupCodesResponse,
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    
    if (error instanceof AuthError) {
      const errorResponse = AuthErrorHandlers.handleAuthError(error);
      
      return NextResponse.json(
        {
          success: false,
          error: AuthErrorHandlers.getUserFriendlyMessage(error),
        } as TwoFactorBackupCodesResponse,
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
        'backup_codes_regenerated',
        'Backup-koder regenerering misslyckades - systemfel',
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
        error: 'Ett oväntat fel uppstod vid regenerering av backup-koder',
      } as TwoFactorBackupCodesResponse,
      { status: 500 }
    );
  }
});