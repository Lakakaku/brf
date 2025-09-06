/**
 * Verify Reset Token API Endpoint
 * Validates password reset tokens without consuming them
 * Supports Swedish BRF context with comprehensive security logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPasswordResetToken } from '@/lib/auth/tokens';
import { 
  verifyResetTokenSchema, 
  VerifyResetTokenResponse,
  AuthError,
  AuthErrorType 
} from '@/lib/auth/types';
import { getClientIP, getUserAgent } from '@/lib/utils/request-utils';
import { logSecurityEvent } from '@/lib/audit/security-logger';

/**
 * Swedish messages for token verification
 */
const SWEDISH_MESSAGES = {
  VALIDATION_ERROR: 'Ogiltig token.',
  TOKEN_VALID: 'Token är giltig.',
  TOKEN_INVALID: 'Ogiltig eller utgången återställningslänk.',
  TOKEN_EXPIRED: 'Återställningslänken har utgått.',
  TOKEN_USED: 'Denna återställningslänk har redan använts.',
  INTERNAL_ERROR: 'Ett tekniskt fel uppstod. Försök igen senare.'
};

/**
 * POST /api/auth/verify-reset-token
 * Verify a password reset token
 */
export async function POST(request: NextRequest): Promise<NextResponse<VerifyResetTokenResponse>> {
  const clientIP = getClientIP(request);
  const userAgent = getUserAgent(request);

  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: SWEDISH_MESSAGES.VALIDATION_ERROR
      }, { status: 400 });
    }

    // Validate request data
    const validation = verifyResetTokenSchema.safeParse(body);
    if (!validation.success) {
      // Log validation failure for security monitoring
      await logSecurityEvent({
        event: 'password_reset_token_validation_failed',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          token: body.token ? 'present' : 'missing',
          validationErrors: validation.error.errors
        },
        severity: 'low'
      });

      return NextResponse.json({
        success: false,
        valid: false,
        error: SWEDISH_MESSAGES.VALIDATION_ERROR
      }, { status: 400 });
    }

    const { token } = validation.data;

    try {
      // Verify the token
      const verification = await verifyPasswordResetToken(token);

      if (verification.valid && verification.user) {
        // Token is valid
        await logSecurityEvent({
          event: 'password_reset_token_verified',
          ipAddress: clientIP,
          userAgent: userAgent,
          userId: verification.user.id,
          details: {
            email: verification.user.email,
            cooperativeId: verification.user.cooperativeId
          },
          severity: 'info'
        });

        return NextResponse.json({
          success: true,
          valid: true,
          email: verification.email
        });
      } else {
        // Token is invalid, expired, or used
        let errorMessage = SWEDISH_MESSAGES.TOKEN_INVALID;
        let expired = false;
        let used = false;

        if (verification.expired) {
          errorMessage = SWEDISH_MESSAGES.TOKEN_EXPIRED;
          expired = true;
        } else if (verification.used) {
          errorMessage = SWEDISH_MESSAGES.TOKEN_USED;
          used = true;
        }

        // Log token verification failure
        await logSecurityEvent({
          event: 'password_reset_token_verification_failed',
          ipAddress: clientIP,
          userAgent: userAgent,
          details: {
            email: verification.email,
            expired: expired,
            used: used,
            reason: expired ? 'expired' : used ? 'already_used' : 'invalid'
          },
          severity: 'medium'
        });

        return NextResponse.json({
          success: true, // Request was processed successfully
          valid: false,
          expired: expired,
          used: used,
          email: verification.email,
          error: errorMessage
        });
      }
    } catch (error) {
      if (error instanceof AuthError) {
        // Handle specific authentication errors
        let errorMessage = SWEDISH_MESSAGES.INTERNAL_ERROR;

        // Log authentication error
        await logSecurityEvent({
          event: 'password_reset_token_verification_error',
          ipAddress: clientIP,
          userAgent: userAgent,
          details: {
            token: token ? 'present' : 'missing',
            errorType: error.type,
            errorMessage: error.message
          },
          severity: 'high'
        });

        return NextResponse.json({
          success: false,
          valid: false,
          error: errorMessage
        }, { status: 500 });
      }

      // Handle unexpected errors
      console.error('Unexpected error in verify reset token endpoint:', error);

      // Log unexpected error for monitoring
      await logSecurityEvent({
        event: 'password_reset_token_verification_system_error',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          token: token ? 'present' : 'missing',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        severity: 'high'
      });

      return NextResponse.json({
        success: false,
        valid: false,
        error: SWEDISH_MESSAGES.INTERNAL_ERROR
      }, { status: 500 });
    }

  } catch (error) {
    // Handle request parsing errors or other unexpected issues
    console.error('Failed to process verify reset token request:', error);

    // Log system error
    await logSecurityEvent({
      event: 'password_reset_token_verification_request_error',
      ipAddress: clientIP,
      userAgent: userAgent,
      details: {
        error: error instanceof Error ? error.message : 'Unknown request error'
      },
      severity: 'high'
    });

    return NextResponse.json({
      success: false,
      valid: false,
      error: SWEDISH_MESSAGES.INTERNAL_ERROR
    }, { status: 500 });
  }
}

/**
 * GET /api/auth/verify-reset-token?token=<token>
 * Verify a password reset token via query parameter (for email links)
 */
export async function GET(request: NextRequest): Promise<NextResponse<VerifyResetTokenResponse>> {
  const clientIP = getClientIP(request);
  const userAgent = getUserAgent(request);

  try {
    // Get token from query parameters
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      await logSecurityEvent({
        event: 'password_reset_token_verification_missing_token',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          method: 'GET'
        },
        severity: 'low'
      });

      return NextResponse.json({
        success: false,
        valid: false,
        error: SWEDISH_MESSAGES.VALIDATION_ERROR
      }, { status: 400 });
    }

    // Validate token format
    const validation = verifyResetTokenSchema.safeParse({ token });
    if (!validation.success) {
      await logSecurityEvent({
        event: 'password_reset_token_validation_failed',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          method: 'GET',
          token: 'invalid_format',
          validationErrors: validation.error.errors
        },
        severity: 'low'
      });

      return NextResponse.json({
        success: false,
        valid: false,
        error: SWEDISH_MESSAGES.VALIDATION_ERROR
      }, { status: 400 });
    }

    try {
      // Verify the token
      const verification = await verifyPasswordResetToken(token);

      if (verification.valid && verification.user) {
        // Token is valid
        await logSecurityEvent({
          event: 'password_reset_token_verified',
          ipAddress: clientIP,
          userAgent: userAgent,
          userId: verification.user.id,
          details: {
            method: 'GET',
            email: verification.user.email,
            cooperativeId: verification.user.cooperativeId
          },
          severity: 'info'
        });

        return NextResponse.json({
          success: true,
          valid: true,
          email: verification.email
        });
      } else {
        // Token is invalid, expired, or used
        let errorMessage = SWEDISH_MESSAGES.TOKEN_INVALID;
        let expired = false;
        let used = false;

        if (verification.expired) {
          errorMessage = SWEDISH_MESSAGES.TOKEN_EXPIRED;
          expired = true;
        } else if (verification.used) {
          errorMessage = SWEDISH_MESSAGES.TOKEN_USED;
          used = true;
        }

        // Log token verification failure
        await logSecurityEvent({
          event: 'password_reset_token_verification_failed',
          ipAddress: clientIP,
          userAgent: userAgent,
          details: {
            method: 'GET',
            email: verification.email,
            expired: expired,
            used: used,
            reason: expired ? 'expired' : used ? 'already_used' : 'invalid'
          },
          severity: 'medium'
        });

        return NextResponse.json({
          success: true, // Request was processed successfully
          valid: false,
          expired: expired,
          used: used,
          email: verification.email,
          error: errorMessage
        });
      }
    } catch (error) {
      // Handle verification errors (similar to POST)
      console.error('Error verifying reset token via GET:', error);

      await logSecurityEvent({
        event: 'password_reset_token_verification_error',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          method: 'GET',
          token: token ? 'present' : 'missing',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        severity: 'high'
      });

      return NextResponse.json({
        success: false,
        valid: false,
        error: SWEDISH_MESSAGES.INTERNAL_ERROR
      }, { status: 500 });
    }

  } catch (error) {
    // Handle request processing errors
    console.error('Failed to process GET verify reset token request:', error);

    await logSecurityEvent({
      event: 'password_reset_token_verification_request_error',
      ipAddress: clientIP,
      userAgent: userAgent,
      details: {
        method: 'GET',
        error: error instanceof Error ? error.message : 'Unknown request error'
      },
      severity: 'high'
    });

    return NextResponse.json({
      success: false,
      valid: false,
      error: SWEDISH_MESSAGES.INTERNAL_ERROR
    }, { status: 500 });
  }
}

/**
 * Handle unsupported HTTP methods
 */
export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    valid: false,
    error: 'Metoden stöds inte'
  }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    valid: false,
    error: 'Metoden stöds inte'
  }, { status: 405 });
}

export async function PATCH(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    valid: false,
    error: 'Metoden stöds inte'
  }, { status: 405 });
}