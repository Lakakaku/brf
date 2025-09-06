/**
 * Forgot Password API Endpoint
 * Handles password reset requests with rate limiting and security measures
 * Supports Swedish BRF context with comprehensive audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/lib/auth/tokens';
import { sendPasswordResetEmail } from '@/lib/email/password-reset';
import { 
  forgotPasswordSchema, 
  ForgotPasswordResponse,
  AuthError,
  AuthErrorType 
} from '@/lib/auth/types';
import { getClientIP, getUserAgent } from '@/lib/utils/request-utils';
import { logSecurityEvent } from '@/lib/audit/security-logger';

/**
 * Swedish error messages for password reset
 */
const SWEDISH_ERRORS = {
  VALIDATION_ERROR: 'Ogiltig e-postadress.',
  USER_NOT_FOUND: 'Om denna e-postadress finns i vårt system kommer du att få ett meddelande med instruktioner för återställning av lösenord.',
  RATE_LIMIT_EXCEEDED: 'För många förfrågningar. Försök igen om {minutes} minuter.',
  USER_INACTIVE: 'Kontot är inaktiverat. Kontakta BRF-styrelsen för hjälp.',
  INTERNAL_ERROR: 'Ett tekniskt fel uppstod. Försök igen senare.',
  PASSWORD_RESET_BLOCKED: 'Lösenordsåterställning tillfälligt blockerad. Försök igen om {minutes} minuter.'
};

/**
 * Format Swedish error messages with dynamic values
 */
function formatSwedishError(template: string, values: Record<string, any>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return values[key] || match;
  });
}

/**
 * POST /api/auth/forgot-password
 * Initiate password reset process
 */
export async function POST(request: NextRequest): Promise<NextResponse<ForgotPasswordResponse>> {
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
    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      // Log validation failure for security monitoring
      await logSecurityEvent({
        event: 'password_reset_validation_failed',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          email: body.email || 'unknown',
          validationErrors: validation.error.errors
        },
        severity: 'low'
      });

      return NextResponse.json({
        success: false,
        error: SWEDISH_ERRORS.VALIDATION_ERROR
      }, { status: 400 });
    }

    const { email } = validation.data;

    try {
      // Create password reset token
      const { token, expiresAt } = await createPasswordResetToken(email, {
        ipAddress: clientIP,
        userAgent: userAgent
      });

      // Send password reset email
      await sendPasswordResetEmail({
        email,
        token,
        expiresAt,
        ipAddress: clientIP,
        userAgent: userAgent
      });

      // Log successful password reset request
      await logSecurityEvent({
        event: 'password_reset_requested',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          email: email,
          tokenExpiry: expiresAt.toISOString()
        },
        severity: 'info'
      });

      // Always return success message to prevent user enumeration
      return NextResponse.json({
        success: true,
        message: 'Om din e-postadress finns i vårt system kommer du att få ett meddelande med instruktioner för återställning av lösenord inom några minuter.'
      });

    } catch (error) {
      if (error instanceof AuthError) {
        // Handle specific authentication errors
        let errorMessage: string;
        let statusCode = error.statusCode;
        let retryAfter: number | undefined;

        switch (error.type) {
          case AuthErrorType.USER_NOT_FOUND:
            // Don't reveal if user exists - return success message
            return NextResponse.json({
              success: true,
              message: SWEDISH_ERRORS.USER_NOT_FOUND
            });

          case AuthErrorType.USER_INACTIVE:
            errorMessage = SWEDISH_ERRORS.USER_INACTIVE;
            break;

          case AuthErrorType.RATE_LIMIT_EXCEEDED:
            // Extract retry time from error message
            const minutesMatch = error.message.match(/(\d+)\s+minutes/);
            const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 60;
            retryAfter = minutes * 60; // Convert to seconds

            errorMessage = formatSwedishError(SWEDISH_ERRORS.RATE_LIMIT_EXCEEDED, { minutes });
            break;

          case AuthErrorType.PASSWORD_RESET_BLOCKED:
            // Extract retry time from error message
            const blockedMinutesMatch = error.message.match(/(\d+)\s+minutes/);
            const blockedMinutes = blockedMinutesMatch ? parseInt(blockedMinutesMatch[1]) : 60;
            retryAfter = blockedMinutes * 60; // Convert to seconds

            errorMessage = formatSwedishError(SWEDISH_ERRORS.PASSWORD_RESET_BLOCKED, { 
              minutes: blockedMinutes 
            });
            break;

          default:
            errorMessage = SWEDISH_ERRORS.INTERNAL_ERROR;
            statusCode = 500;
        }

        // Log authentication error
        await logSecurityEvent({
          event: 'password_reset_failed',
          ipAddress: clientIP,
          userAgent: userAgent,
          details: {
            email: email,
            errorType: error.type,
            errorMessage: error.message
          },
          severity: error.type === AuthErrorType.RATE_LIMIT_EXCEEDED ? 'medium' : 'high'
        });

        const response: ForgotPasswordResponse = {
          success: false,
          error: errorMessage,
          rateLimitExceeded: error.type === AuthErrorType.RATE_LIMIT_EXCEEDED || 
                            error.type === AuthErrorType.PASSWORD_RESET_BLOCKED,
          retryAfter
        };

        return NextResponse.json(response, { status: statusCode });
      }

      // Handle unexpected errors
      console.error('Unexpected error in forgot password endpoint:', error);

      // Log unexpected error for monitoring
      await logSecurityEvent({
        event: 'password_reset_system_error',
        ipAddress: clientIP,
        userAgent: userAgent,
        details: {
          email: email,
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
    console.error('Failed to process forgot password request:', error);

    // Log system error
    await logSecurityEvent({
      event: 'password_reset_request_error',
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