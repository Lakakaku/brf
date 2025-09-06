/**
 * Two-Factor Authentication Verify API Route
 * POST /api/auth/2fa/verify - Verify TOTP/backup code and complete 2FA setup
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  twoFactorVerifySetupSchema,
  twoFactorVerifySchema,
  TwoFactorVerifyResponse,
  AuthError,
  AuthErrorHandlers 
} from '@/lib/auth';
import { 
  completeTwoFactorSetup,
  verifyTwoFactorCode,
  getTwoFactorStatus,
  logTwoFactorAudit 
} from '@/lib/auth/2fa';

/**
 * POST /api/auth/2fa/verify
 * Verify 2FA code during setup or login
 */
export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;
    
    // Check if this is setup verification (has setupToken) or login verification
    if (body.setupToken) {
      // Setup verification flow
      const validation = twoFactorVerifySetupSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Ogiltig förfrågningsdata',
          } as TwoFactorVerifyResponse,
          { status: 400 }
        );
      }
      
      const { setupToken, code } = validation.data;
      
      // Complete 2FA setup
      const result = await completeTwoFactorSetup(setupToken, code, ip, userAgent);
      
      if (result.success) {
        // Get status after successful setup
        const status = await getTwoFactorStatus(result.userId!);
        
        return NextResponse.json(
          {
            success: true,
            backupCodesRemaining: status.backupCodesRemaining,
          } as TwoFactorVerifyResponse,
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Verifiering misslyckades',
          } as TwoFactorVerifyResponse,
          { status: 400 }
        );
      }
      
    } else {
      // Login verification flow (requires authentication)
      // This would typically be called from the login endpoint
      // For now, return error as this should be handled by login flow
      return NextResponse.json(
        {
          success: false,
          error: 'Denna endpoint är för setup-verifiering. Använd login-flödet för inloggningsverifiering.',
        } as TwoFactorVerifyResponse,
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('2FA verify error:', error);
    
    if (error instanceof AuthError) {
      const errorResponse = AuthErrorHandlers.handleAuthError(error);
      
      return NextResponse.json(
        {
          success: false,
          error: AuthErrorHandlers.getUserFriendlyMessage(error),
        } as TwoFactorVerifyResponse,
        { status: errorResponse.statusCode }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Ett oväntat fel uppstod vid verifiering',
      } as TwoFactorVerifyResponse,
      { status: 500 }
    );
  }
};

/**
 * Helper endpoint to verify codes during login (used internally)
 * This will be called by the login route when 2FA is required
 */
export async function verifyCodeForUser(
  userId: string,
  code: string,
  trustDevice: boolean,
  ip: string,
  userAgent?: string
): Promise<TwoFactorVerifyResponse> {
  try {
    // Verify the 2FA code
    const result = await verifyTwoFactorCode(userId, code, ip, userAgent);
    
    if (result.success) {
      // Get updated status
      const status = await getTwoFactorStatus(userId);
      
      // TODO: Implement device trust token generation if trustDevice is true
      let trustDeviceToken: string | undefined;
      if (trustDevice) {
        // Generate device trust token (would implement device fingerprinting)
        // For now, just indicate that device trust was requested
        trustDeviceToken = 'device_trust_not_implemented';
      }
      
      return {
        success: true,
        isBackupCode: result.isBackupCode,
        backupCodesRemaining: status.backupCodesRemaining,
        trustDeviceToken,
      };
    } else {
      return {
        success: false,
        error: 'Ogiltig verifieringskod',
      };
    }
    
  } catch (error) {
    console.error('2FA verification error:', error);
    
    if (error instanceof AuthError) {
      return {
        success: false,
        error: AuthErrorHandlers.getUserFriendlyMessage(error),
      };
    }
    
    return {
      success: false,
      error: 'Ett fel uppstod vid verifiering av tvåfaktorsautentisering',
    };
  }
}