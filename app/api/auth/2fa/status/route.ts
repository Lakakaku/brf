/**
 * Two-Factor Authentication Status API Route
 * GET /api/auth/2fa/status - Get comprehensive 2FA status for authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  requireAuth, 
  AuthenticatedRequest,
  TwoFactorStatusResponse
} from '@/lib/auth';
import { 
  getTwoFactorStatus,
  hasTwoFactorEnabled 
} from '@/lib/auth/2fa';

/**
 * GET /api/auth/2fa/status
 * Get comprehensive 2FA status for authenticated user
 */
export const GET = requireAuth(async (
  req: AuthenticatedRequest,
  res: NextResponse
) => {
  try {
    const user = req.user!; // Safe to use ! after requireAuth
    
    // Get comprehensive 2FA status
    const status = await getTwoFactorStatus(user.id);
    
    return NextResponse.json(
      {
        success: true,
        data: {
          enabled: status.enabled,
          backupCodesRemaining: status.backupCodesRemaining,
          lastUsed: status.lastUsed,
          usageCount: status.usageCount,
        },
      } as TwoFactorStatusResponse,
      { status: 200 }
    );
    
  } catch (error) {
    console.error('2FA status error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Ett fel uppstod vid hämtning av tvåfaktorsautentisering status',
      } as TwoFactorStatusResponse,
      { status: 500 }
    );
  }
});