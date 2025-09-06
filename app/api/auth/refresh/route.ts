/**
 * Token refresh API route for BRF Portal
 * Handles refresh token validation and access token renewal
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  refreshTokenSchema, 
  RefreshTokenResponse,
  AuthError, 
  AuthErrorType,
  DEFAULT_PERMISSIONS 
} from '@/lib/auth/types';
import { 
  refreshAccessToken, 
  revokeRefreshToken,
  isRefreshTokenExpiringSoon 
} from '@/lib/auth/tokens';
import { logAuthEvent } from '@/lib/auth/middleware';

/**
 * Rate limiting for refresh token requests
 * Simple in-memory implementation - in production use Redis
 */
const refreshAttempts = new Map<string, { count: number; resetTime: number }>();
const REFRESH_RATE_LIMIT = 10; // Max 10 refresh attempts per minute
const REFRESH_RATE_WINDOW = 60 * 1000; // 1 minute

function checkRefreshRateLimit(key: string): boolean {
  const now = Date.now();
  const attempts = refreshAttempts.get(key);
  
  if (!attempts || now > attempts.resetTime) {
    refreshAttempts.set(key, { count: 1, resetTime: now + REFRESH_RATE_WINDOW });
    return false; // Not rate limited
  }
  
  if (attempts.count >= REFRESH_RATE_LIMIT) {
    return true; // Rate limited
  }
  
  attempts.count++;
  return false;
}

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
export async function POST(request: NextRequest) {
  let requestBody: any;
  let clientIp: string | null = null;
  
  try {
    // Parse and validate request body
    requestBody = await request.json();
    const { refreshToken } = refreshTokenSchema.parse(requestBody);
    
    // Get client information
    clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Rate limiting
    const rateLimitKey = `refresh:${clientIp}`;
    if (checkRefreshRateLimit(rateLimitKey)) {
      await logAuthEvent('refresh_rate_limited', null, request, {
        ip: clientIp,
        userAgent
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Too many refresh attempts. Please wait before trying again.',
          code: 'RATE_LIMITED',
        } satisfies RefreshTokenResponse,
        { status: 429 }
      );
    }
    
    // Validate refresh token and get new token pair
    const result = await refreshAccessToken(refreshToken, {
      userAgent,
      ipAddress: clientIp
    });
    
    // Check if refresh token is expiring soon and warn client
    const isExpiringSoon = await isRefreshTokenExpiringSoon(result.refreshToken, 72); // 3 days
    
    // Prepare response
    const response = NextResponse.json({
      success: true,
      tokenPair: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        refreshTokenExpiresAt: result.refreshTokenExpiresAt,
        tokenType: 'bearer' as const
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        cooperativeId: result.user.cooperativeId,
        isActive: result.user.isActive,
        permissions: {
          ...DEFAULT_PERMISSIONS[result.user.role],
          ...result.user.permissions,
        },
        lastLoginAt: result.user.lastLoginAt,
      },
      ...(isExpiringSoon && {
        warning: 'Refresh token expires soon. Please re-authenticate.',
        code: 'REFRESH_TOKEN_EXPIRING'
      })
    } satisfies RefreshTokenResponse);
    
    // Set new tokens in response headers for client-side storage
    response.headers.set('X-Access-Token', result.accessToken);
    response.headers.set('X-Refresh-Token', result.refreshToken);
    response.headers.set('X-Session-Id', result.sessionId);
    
    // Update refresh token cookie if it was rotated
    if (result.refreshToken !== refreshToken) {
      response.cookies.set('brf-refresh-token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
    }
    
    // Log successful refresh
    await logAuthEvent('token_refreshed', result.user, request, {
      ip: clientIp,
      userAgent,
      sessionId: result.sessionId,
      tokenRotated: result.refreshToken !== refreshToken
    });
    
    return response;
    
  } catch (error) {
    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
        } satisfies RefreshTokenResponse,
        { status: 400 }
      );
    }
    
    // Handle authentication errors
    if (error instanceof AuthError) {
      // Log failed refresh attempt
      await logAuthEvent('token_refresh_failed', null, request, {
        ip: clientIp,
        error: error.message,
        errorType: error.type
      });
      
      // If refresh token is invalid or expired, clear the cookie
      if (error.type === AuthErrorType.REFRESH_TOKEN_EXPIRED || 
          error.type === AuthErrorType.REFRESH_TOKEN_INVALID) {
        const response = NextResponse.json(
          {
            success: false,
            error: error.message,
            code: error.type,
          } satisfies RefreshTokenResponse,
          { status: error.statusCode }
        );
        
        // Clear refresh token cookie
        response.cookies.set('brf-refresh-token', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 0,
          path: '/',
        });
        
        return response;
      }
      
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.type,
        } satisfies RefreshTokenResponse,
        { status: error.statusCode }
      );
    }
    
    // Log unexpected errors
    console.error('Token refresh API error:', error);
    
    await logAuthEvent('token_refresh_error', null, request, {
      ip: clientIp,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      } satisfies RefreshTokenResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/refresh
 * Revoke refresh token (logout)
 */
export async function DELETE(request: NextRequest) {
  let requestBody: any;
  let clientIp: string | null = null;
  
  try {
    // Parse and validate request body
    requestBody = await request.json();
    const { refreshToken } = refreshTokenSchema.parse(requestBody);
    
    // Get client information
    clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Revoke the refresh token
    await revokeRefreshToken(refreshToken, 'user_logout');
    
    // Prepare response
    const response = NextResponse.json({
      success: true,
      message: 'Refresh token revoked successfully'
    });
    
    // Clear refresh token cookie
    response.cookies.set('brf-refresh-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });
    
    // Log token revocation
    await logAuthEvent('refresh_token_revoked', null, request, {
      ip: clientIp,
      userAgent,
      reason: 'user_logout'
    });
    
    return response;
    
  } catch (error) {
    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }
    
    // Handle authentication errors
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.type,
        },
        { status: error.statusCode }
      );
    }
    
    // Log unexpected errors
    console.error('Token revocation API error:', error);
    
    await logAuthEvent('refresh_token_revocation_error', null, request, {
      ip: clientIp,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle unsupported methods
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}