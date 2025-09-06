/**
 * Logout API route for BRF Portal
 * Handles user logout by destroying sessions and revoking JWT tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  AuthError, 
  AuthErrorType 
} from '@/lib/auth/types';
import { revokeToken, extractTokenFromHeader } from '@/lib/auth/jwt';
import { destroySession, getSession } from '@/lib/auth/session';
import { logAuthEvent } from '@/lib/auth/middleware';

/**
 * Logout API handler
 */
export async function POST(request: NextRequest) {
  let user: any = null;
  
  try {
    // Get current session to identify user for logging
    try {
      const session = await getSession(request);
      user = session.user;
    } catch {
      // Continue with logout even if session retrieval fails
    }
    
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful'
    });
    
    // Destroy session
    try {
      await destroySession(request, response);
    } catch (sessionError) {
      console.error('Session destruction error:', sessionError);
      // Continue with logout process
    }
    
    // Revoke JWT token if present
    try {
      const authHeader = request.headers.get('authorization');
      const token = extractTokenFromHeader(authHeader);
      
      if (token) {
        revokeToken(token);
      }
    } catch (tokenError) {
      console.error('Token revocation error:', tokenError);
      // Continue with logout process
    }
    
    // Clear refresh token cookie
    response.cookies.delete('brf-refresh-token');
    
    // Clear any other auth-related cookies
    response.cookies.delete('brf-portal-session');
    
    // Log logout event
    await logAuthEvent('logout_success', user, request, {
      ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });
    
    return response;
    
  } catch (error) {
    // Handle authentication errors
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.type,
        },
        { status: error.statusCode }
      );
    }
    
    // Log unexpected errors
    console.error('Logout API error:', error);
    
    await logAuthEvent('logout_error', user, request, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Even if there's an error, we should return success for logout
    // to prevent users from getting stuck in logged-in state
    return NextResponse.json(
      {
        success: true,
        message: 'Logout completed with errors',
        warning: 'Some cleanup operations failed'
      },
      { status: 200 }
    );
  }
}

/**
 * Get current session status
 * Useful for checking if user is logged in
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        {
          isLoggedIn: false,
          user: null,
        }
      );
    }
    
    return NextResponse.json({
      isLoggedIn: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
        cooperativeId: session.user.cooperativeId,
        isActive: session.user.isActive,
        lastLoginAt: session.user.lastLoginAt,
      },
      loginTimestamp: session.loginTimestamp,
      csrfToken: session.csrfToken,
    });
    
  } catch (error) {
    console.error('Session status check error:', error);
    
    return NextResponse.json(
      {
        isLoggedIn: false,
        user: null,
        error: 'Failed to check session status'
      }
    );
  }
}

/**
 * Handle unsupported methods
 */
export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
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