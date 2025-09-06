/**
 * Reset Password API Endpoint
 * Handles password reset completion with token validation and security measures
 * Supports Swedish BRF context with comprehensive audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { usePasswordResetToken } from '@/lib/auth/tokens';
import { sendPasswordResetConfirmationEmail } from '@/lib/email/password-reset';
import { 
  resetPasswordSchema, 
  ResetPasswordResponse,
  AuthError,
  AuthErrorType 
} from '@/lib/auth/types';
import { getClientIP, getUserAgent } from '@/lib/utils/request-utils';
import { logSecurityEvent } from '@/lib/audit/security-logger';
import { validatePasswordStrength } from '@/lib/utils/password-validator';

/**
 * Swedish error messages for password reset
 */
const SWEDISH_ERRORS = {
  VALIDATION_ERROR: 'Ogiltiga indata.',
  PASSWORD_TOO_WEAK: 'Lösenordet måste vara minst 8 tecken långt och innehålla både bokstäver och siffror.',
  PASSWORD_MISMATCH: 'Lösenorden stämmer inte överens.',
  INVALID_TOKEN: 'Ogiltig eller utgången återställningslänk.',
  TOKEN_EXPIRED: 'Återställningslänken har utgått. Begär en ny lösenordsåterställning.',
  TOKEN_USED: 'Denna återställningslänk har redan använts.',
  INTERNAL_ERROR: 'Ett tekniskt fel uppstod. Försök igen senare.',
  SUCCESS_MESSAGE: 'Ditt lösenord har återställts framgångsrikt. Du kan nu logga in med ditt nya lösenord.'
};

/**
 * Validate password strength according to BRF security requirements
 */
function validateBRFPasswordStrength(password: string): { valid: boolean; message?: string } {
  // Basic length check
  if (password.length < 8) {
    return { 
      valid: false, 
      message: 'Lösenordet måste vara minst 8 tecken långt.' 
    };
  }

  // Check for at least one letter and one number
  const hasLetter = /[a-zA-ZåäöÅÄÖ]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!hasLetter || !hasNumber) {
    return { 
      valid: false, 
      message: 'Lösenordet måste innehålla både bokstäver och siffror.' 
    };
  }

  // Check for common weak patterns
  const commonPatterns = [
    /123456/,
    /password/i,
    /lösenord/i,
    /qwerty/i,
    /admin/i
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      return { 
        valid: false, 
        message: 'Lösenordet får inte innehålla vanliga mönster som "123456" eller "password".' 
      };
    }
  }

  return { valid: true };
}

/**
 * POST /api/auth/reset-password
 * Complete password reset process
 */
export async function POST(request: NextRequest): Promise<NextResponse<ResetPasswordResponse>> {
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
        error: SWEDISH_ERRORS.VALIDATION_ERROR
      }, { status: 400 });
    }

    // Validate request data
    const validation = resetPasswordSchema.safeParse(body);
    if (!validation.success) {
      // Log validation failure for security monitoring
      await logSecurityEvent({
        event: 'password_reset_completion_validation_failed',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          token: body.token ? 'present' : 'missing',
          validationErrors: validation.error.errors
        },
        severity: 'low'
      });

      const errorMessage = validation.error.errors.find(e => e.path.includes('confirmPassword'))
        ? SWEDISH_ERRORS.PASSWORD_MISMATCH
        : SWEDISH_ERRORS.VALIDATION_ERROR;

      return NextResponse.json({
        success: false,
        error: errorMessage
      }, { status: 400 });
    }

    const { token, newPassword, confirmPassword } = validation.data;

    // Additional password confirmation check (double-check)
    if (newPassword !== confirmPassword) {
      await logSecurityEvent({
        event: 'password_reset_confirmation_mismatch',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          token: token ? 'present' : 'missing'
        },
        severity: 'low'
      });

      return NextResponse.json({
        success: false,
        error: SWEDISH_ERRORS.PASSWORD_MISMATCH
      }, { status: 400 });
    }

    // Validate password strength
    const passwordValidation = validateBRFPasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      await logSecurityEvent({
        event: 'password_reset_weak_password',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          token: token ? 'present' : 'missing',
          reason: passwordValidation.message
        },
        severity: 'low'
      });

      return NextResponse.json({
        success: false,
        error: passwordValidation.message || SWEDISH_ERRORS.PASSWORD_TOO_WEAK
      }, { status: 400 });
    }

    try {
      // Use the password reset token
      const result = await usePasswordResetToken(token, newPassword, {
        ipAddress: clientIP,
        userAgent: userAgent
      });

      if (!result.success || !result.user) {
        throw new AuthError(
          AuthErrorType.RESET_TOKEN_INVALID,
          'Failed to reset password',
          400
        );
      }

      // Send confirmation email
      try {
        await sendPasswordResetConfirmationEmail({
          email: result.user.email,
          firstName: result.user.firstName || '',
          ipAddress: clientIP,
          userAgent: userAgent
        });
      } catch (emailError) {
        // Log email failure but don't fail the password reset
        console.error('Failed to send password reset confirmation email:', emailError);
        
        await logSecurityEvent({
          event: 'password_reset_confirmation_email_failed',
          ipAddress: clientIP,
          userAgent: userAgent,
          details: {
            email: result.user.email,
            error: emailError instanceof Error ? emailError.message : 'Unknown error'
          },
          severity: 'medium'
        });
      }

      // Log successful password reset
      await logSecurityEvent({
        event: 'password_reset_completed',
        ipAddress: clientIP,
        userAgent: userAgent,
        userId: result.user.id,
        details: {
          email: result.user.email,
          cooperativeId: result.user.cooperativeId
        },
        severity: 'info'
      });

      return NextResponse.json({
        success: true,
        message: SWEDISH_ERRORS.SUCCESS_MESSAGE,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
          cooperativeId: result.user.cooperativeId,
          isActive: result.user.isActive,
          permissions: result.user.permissions,
          lastLoginAt: result.user.lastLoginAt
        }
      });

    } catch (error) {
      if (error instanceof AuthError) {
        // Handle specific authentication errors
        let errorMessage: string;
        let statusCode = error.statusCode;

        switch (error.type) {
          case AuthErrorType.RESET_TOKEN_INVALID:
            errorMessage = SWEDISH_ERRORS.INVALID_TOKEN;
            break;

          case AuthErrorType.RESET_TOKEN_EXPIRED:
            errorMessage = SWEDISH_ERRORS.TOKEN_EXPIRED;
            break;

          case AuthErrorType.RESET_TOKEN_USED:
            errorMessage = SWEDISH_ERRORS.TOKEN_USED;
            break;

          default:
            errorMessage = SWEDISH_ERRORS.INTERNAL_ERROR;
            statusCode = 500;
        }

        // Log authentication error
        await logSecurityEvent({
          event: 'password_reset_completion_failed',
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
          error: errorMessage
        }, { status: statusCode });
      }

      // Handle unexpected errors
      console.error('Unexpected error in reset password endpoint:', error);

      // Log unexpected error for monitoring
      await logSecurityEvent({
        event: 'password_reset_completion_system_error',
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
        error: SWEDISH_ERRORS.INTERNAL_ERROR
      }, { status: 500 });
    }

  } catch (error) {
    // Handle request parsing errors or other unexpected issues
    console.error('Failed to process reset password request:', error);

    // Log system error
    await logSecurityEvent({
      event: 'password_reset_completion_request_error',
      ipAddress: clientIP,
      userAgent: userAgent,
      details: {
        error: error instanceof Error ? error.message : 'Unknown request error'
      },
      severity: 'high'
    });

    return NextResponse.json({
      success: false,
      error: SWEDISH_ERRORS.INTERNAL_ERROR
    }, { status: 500 });
  }
}

/**
 * Handle unsupported HTTP methods
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'Metoden stöds inte'
  }, { status: 405 });
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'Metoden stöds inte'
  }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'Metoden stöds inte'
  }, { status: 405 });
}

export async function PATCH(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'Metoden stöds inte'
  }, { status: 405 });
}