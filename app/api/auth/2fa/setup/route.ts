/**
 * Two-Factor Authentication Setup API Route
 * POST /api/auth/2fa/setup - Initialize 2FA setup for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  requireAuth, 
  AuthenticatedRequest,
  twoFactorSetupSchema,
  TwoFactorSetupResponse,
  AuthError,
  AuthErrorType,
  AuthErrorHandlers 
} from '@/lib/auth';
import { 
  initializeTwoFactorSetup,
  hasTwoFactorEnabled,
  logTwoFactorAudit 
} from '@/lib/auth/2fa';
import Database from 'better-sqlite3';

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
 * Get cooperative information
 */
async function getCooperativeInfo(cooperativeId: string): Promise<{ name: string } | null> {
  try {
    const database = getDatabase();
    const cooperative = database.prepare(`
      SELECT name FROM cooperatives WHERE id = ?
    `).get(cooperativeId) as { name: string } | undefined;
    
    return cooperative || null;
  } catch (error) {
    console.error('Failed to get cooperative info:', error);
    return null;
  }
}

/**
 * POST /api/auth/2fa/setup
 * Initialize 2FA setup process for authenticated user
 */
export const POST = requireAuth(async (
  req: AuthenticatedRequest,
  res: NextResponse
) => {
  try {
    const user = req.user!; // Safe to use ! after requireAuth
    const body = await req.json();
    
    // Validate request body
    const validation = twoFactorSetupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ogiltig förfrågningsdata',
          details: validation.error.issues,
        } as TwoFactorSetupResponse,
        { status: 400 }
      );
    }
    
    const { email } = validation.data;
    
    // Verify email matches user's email
    if (email !== user.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email-adressen matchar inte ditt konto',
        } as TwoFactorSetupResponse,
        { status: 400 }
      );
    }
    
    // Check if user already has 2FA enabled
    const has2FA = await hasTwoFactorEnabled(user.id);
    if (has2FA) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tvåfaktorsautentisering är redan aktiverad för detta konto',
        } as TwoFactorSetupResponse,
        { status: 400 }
      );
    }
    
    // Get cooperative information
    const cooperative = await getCooperativeInfo(user.cooperativeId);
    if (!cooperative) {
      return NextResponse.json(
        {
          success: false,
          error: 'Kunde inte hitta bostadsrättföreningens information',
        } as TwoFactorSetupResponse,
        { status: 500 }
      );
    }
    
    // Get client information for audit logging
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;
    
    // Initialize 2FA setup
    const setupData = await initializeTwoFactorSetup(
      user.id,
      user.cooperativeId,
      user.email,
      cooperative.name
    );
    
    // Log successful setup initiation
    await logTwoFactorAudit(
      user.cooperativeId,
      user.id,
      'setup_initiated',
      'Tvåfaktorsautentisering setup påbörjad via API',
      ip,
      userAgent,
      {
        userEmail: user.email,
        cooperativeName: cooperative.name,
        setupMethod: 'web_app',
      },
      'medium'
    );
    
    return NextResponse.json(
      {
        success: true,
        data: {
          secret: setupData.secret,
          qrCodeUri: setupData.qrCodeUri,
          setupToken: setupData.setupToken,
          backupCodes: setupData.backupCodes,
          expiresAt: setupData.expiresAt,
        },
      } as TwoFactorSetupResponse,
      { status: 200 }
    );
    
  } catch (error) {
    console.error('2FA setup error:', error);
    
    if (error instanceof AuthError) {
      const errorResponse = AuthErrorHandlers.handleAuthError(error);
      
      return NextResponse.json(
        {
          success: false,
          error: AuthErrorHandlers.getUserFriendlyMessage(error),
        } as TwoFactorSetupResponse,
        { status: errorResponse.statusCode }
      );
    }
    
    // Log unexpected errors for monitoring
    const user = req.user;
    if (user) {
      const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
      const userAgent = req.headers.get('user-agent') || undefined;
      
      await logTwoFactorAudit(
        user.cooperativeId,
        user.id,
        'setup_initiated',
        'Tvåfaktorsautentisering setup misslyckades - systemfel',
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
        error: 'Ett oväntat fel uppstod. Försök igen senare.',
      } as TwoFactorSetupResponse,
      { status: 500 }
    );
  }
});

/**
 * GET /api/auth/2fa/setup
 * Check current 2FA setup status for authenticated user
 */
export const GET = requireAuth(async (
  req: AuthenticatedRequest,
  res: NextResponse
) => {
  try {
    const user = req.user!; // Safe to use ! after requireAuth
    
    // Check if user has 2FA enabled
    const has2FA = await hasTwoFactorEnabled(user.id);
    
    // Check for pending setup
    const database = getDatabase();
    const pendingSetup = database.prepare(`
      SELECT 
        setup_token, 
        setup_expires_at,
        created_at
      FROM two_factor_secrets 
      WHERE user_id = ? 
        AND is_verified = 0 
        AND setup_token IS NOT NULL
        AND setup_expires_at > datetime('now')
    `).get(user.id) as {
      setup_token: string;
      setup_expires_at: string;
      created_at: string;
    } | undefined;
    
    return NextResponse.json(
      {
        success: true,
        data: {
          enabled: has2FA,
          hasPendingSetup: Boolean(pendingSetup),
          pendingSetupExpires: pendingSetup?.setup_expires_at,
          pendingSetupCreated: pendingSetup?.created_at,
        },
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('2FA setup status error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Ett fel uppstod vid kontroll av tvåfaktorsautentisering status',
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/auth/2fa/setup
 * Cancel pending 2FA setup
 */
export const DELETE = requireAuth(async (
  req: AuthenticatedRequest,
  res: NextResponse
) => {
  try {
    const user = req.user!; // Safe to use ! after requireAuth
    
    // Delete pending setup
    const database = getDatabase();
    const result = database.prepare(`
      DELETE FROM two_factor_secrets 
      WHERE user_id = ? 
        AND is_verified = 0
    `).run(user.id);
    
    // Also delete any generated backup codes for unverified setup
    database.prepare(`
      DELETE FROM two_factor_backup_codes 
      WHERE user_id = ?
        AND user_id NOT IN (
          SELECT user_id FROM two_factor_secrets 
          WHERE user_id = ? AND is_verified = 1
        )
    `).run(user.id, user.id);
    
    if (result.changes > 0) {
      // Log cancellation
      const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
      const userAgent = req.headers.get('user-agent') || undefined;
      
      await logTwoFactorAudit(
        user.cooperativeId,
        user.id,
        'setup_cancelled',
        'Tvåfaktorsautentisering setup avbruten av användare',
        ip,
        userAgent,
        {
          userEmail: user.email,
          method: 'api_delete',
        },
        'low'
      );
    }
    
    return NextResponse.json(
      {
        success: true,
        message: result.changes > 0 
          ? 'Pågående tvåfaktorsautentisering setup avbruten'
          : 'Ingen pågående setup att avbryta',
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('2FA setup cancellation error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Ett fel uppstod vid avbrytande av tvåfaktorsautentisering setup',
      },
      { status: 500 }
    );
  }
});