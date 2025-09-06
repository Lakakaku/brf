/**
 * Admin Impersonation API Route
 * Allows administrators to impersonate other users for testing and support
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  startImpersonation, 
  endImpersonation, 
  getActiveImpersonationSession,
  getImpersonationHistory,
  initializeImpersonationTables
} from '@/lib/auth/impersonation';
import { validateSession } from '@/lib/auth/tokens';
import { AuthError, AuthErrorType } from '@/lib/auth/types';

// Initialize impersonation tables on first import
initializeImpersonationTables();

/**
 * POST /api/auth/impersonate - Start impersonation session
 */
export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Validate current user session
    const sessionResult = await validateSession(token);
    if (!sessionResult.valid || !sessionResult.user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const currentUser = sessionResult.user;

    // Check if user is admin or chairman
    if (currentUser.role !== 'admin' && currentUser.role !== 'chairman') {
      return NextResponse.json(
        { error: 'Insufficient permissions to impersonate users' },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const { targetUserId, reason } = body;

    if (!targetUserId || !reason) {
      return NextResponse.json(
        { error: 'Target user ID and reason are required' },
        { status: 400 }
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Start impersonation
    const result = await startImpersonation({
      originalUser: currentUser,
      targetUserId,
      reason,
      ipAddress,
      userAgent,
      expirationMinutes: body.expirationMinutes || 60
    });

    // Return success response with tokens and session info
    return NextResponse.json({
      success: true,
      session: {
        sessionId: result.session.sessionId,
        impersonatedUser: {
          id: result.impersonatedUser.id,
          email: result.impersonatedUser.email,
          firstName: result.impersonatedUser.firstName,
          lastName: result.impersonatedUser.lastName,
          role: result.impersonatedUser.role,
          apartmentNumber: result.impersonatedUser.apartmentNumber
        },
        expiresAt: result.session.expiresAt,
        reason: result.session.reason
      },
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });

  } catch (error) {
    console.error('Impersonation error:', error);
    
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/impersonate - End impersonation session
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Validate session
    const sessionResult = await validateSession(token);
    if (!sessionResult.valid || !sessionResult.user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Get session ID from query or body
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // End impersonation
    await endImpersonation(
      sessionId,
      sessionResult.user.id,
      ipAddress,
      userAgent
    );

    return NextResponse.json({
      success: true,
      message: 'Impersonation session ended successfully'
    });

  } catch (error) {
    console.error('End impersonation error:', error);
    
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/impersonate - Get impersonation session status/history
 */
export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Validate session
    const sessionResult = await validateSession(token);
    if (!sessionResult.valid || !sessionResult.user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const user = sessionResult.user;

    // Check permissions
    if (user.role !== 'admin' && user.role !== 'chairman') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'active') {
      // Get active impersonation session
      const activeSession = await getActiveImpersonationSession(user.id);
      
      return NextResponse.json({
        success: true,
        activeSession
      });
    } else if (action === 'history') {
      // Get impersonation history
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const history = await getImpersonationHistory(user.id, limit);
      
      return NextResponse.json({
        success: true,
        history
      });
    } else {
      // Default: return both active session and recent history
      const activeSession = await getActiveImpersonationSession(user.id);
      const history = await getImpersonationHistory(user.id, 10);
      
      return NextResponse.json({
        success: true,
        activeSession,
        recentHistory: history
      });
    }

  } catch (error) {
    console.error('Get impersonation status error:', error);
    
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}