/**
 * Current user API route for BRF Portal
 * Handles getting current user information and session validation
 */

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { 
  AuthUser, 
  AuthError, 
  AuthErrorType,
  DEFAULT_PERMISSIONS 
} from '@/lib/auth/types';
import { validateToken, extractTokenFromHeader } from '@/lib/auth/jwt';
import { validateSession } from '@/lib/auth/tokens';
import { logAuthEvent } from '@/lib/auth/middleware';

/**
 * Database connection
 */
function getDatabase(): Database.Database {
  const dbPath = process.env.DATABASE_PATH || './database/brf.db';
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Get user by ID with fresh data from database
 */
async function getUserById(userId: string): Promise<AuthUser | null> {
  const db = getDatabase();
  
  try {
    const row = db.prepare(`
      SELECT 
        m.id, m.email, m.first_name, m.last_name, m.role, 
        m.cooperative_id, m.is_active, m.permissions, m.last_login_at,
        c.name as cooperative_name, c.subdomain
      FROM members m
      LEFT JOIN cooperatives c ON m.cooperative_id = c.id
      WHERE m.id = ? AND m.deleted_at IS NULL
    `).get(userId) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      cooperativeId: row.cooperative_id,
      isActive: Boolean(row.is_active),
      permissions: row.permissions ? JSON.parse(row.permissions) : {},
      lastLoginAt: row.last_login_at,
    };
  } finally {
    db.close();
  }
}

/**
 * GET /api/auth/me
 * Get current user information
 */
export async function GET(request: NextRequest) {
  let user: AuthUser | null = null;
  
  try {
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Try to authenticate using different methods
    
    // Method 1: JWT Token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (token) {
      try {
        const payload = await validateToken(token);
        user = await getUserById(payload.userId);
        
        if (!user) {
          throw new AuthError(
            AuthErrorType.USER_NOT_FOUND,
            'User not found',
            404
          );
        }
        
        if (!user.isActive) {
          throw new AuthError(
            AuthErrorType.USER_INACTIVE,
            'User account is inactive',
            403
          );
        }
      } catch (tokenError) {
        // Token authentication failed, try other methods
        console.log('Token authentication failed:', tokenError);
      }
    }
    
    // Method 2: Session ID validation (if token auth failed)
    if (!user) {
      const sessionId = request.headers.get('x-session-id') || 
                       request.cookies.get('brf-session-id')?.value;
      
      if (sessionId) {
        const sessionResult = await validateSession(sessionId);
        if (sessionResult.isValid && sessionResult.user) {
          user = sessionResult.user;
        }
      }
    }
    
    // Method 3: Check existing iron-session (fallback)
    if (!user) {
      // This would require iron-session setup, but we'll skip for now
      // as we're focusing on JWT/token-based authentication
    }
    
    // If no authentication method worked
    if (!user) {
      await logAuthEvent('me_unauthorized', null, request, {
        ip: clientIp,
        userAgent,
        reason: 'no_valid_authentication'
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
          user: null,
          isLoggedIn: false
        },
        { status: 401 }
      );
    }
    
    // Check if user is still active (double-check)
    if (!user.isActive) {
      await logAuthEvent('me_inactive_user', user, request, {
        ip: clientIp,
        userAgent
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'User account is inactive',
          code: 'USER_INACTIVE',
          user: null,
          isLoggedIn: false
        },
        { status: 403 }
      );
    }
    
    // Return user information
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        cooperativeId: user.cooperativeId,
        isActive: user.isActive,
        permissions: {
          ...DEFAULT_PERMISSIONS[user.role],
          ...user.permissions,
        },
        lastLoginAt: user.lastLoginAt,
      },
      isLoggedIn: true,
      sessionInfo: {
        lastActivity: new Date().toISOString(),
        userAgent,
        ipAddress: clientIp
      }
    });
    
    // Log successful request
    await logAuthEvent('me_success', user, request, {
      ip: clientIp,
      userAgent
    });
    
    return response;
    
  } catch (error) {
    // Handle authentication errors
    if (error instanceof AuthError) {
      await logAuthEvent('me_auth_error', user, request, {
        error: error.message,
        errorType: error.type
      });
      
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.type,
          user: null,
          isLoggedIn: false
        },
        { status: error.statusCode }
      );
    }
    
    // Log unexpected errors
    console.error('Me API error:', error);
    
    await logAuthEvent('me_error', user, request, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        user: null,
        isLoggedIn: false
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/auth/me
 * Update current user information (limited fields)
 */
export async function PATCH(request: NextRequest) {
  let user: AuthUser | null = null;
  let requestBody: any;
  
  try {
    // Parse request body
    requestBody = await request.json();
    const { firstName, lastName, phone } = requestBody;
    
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Authenticate user (same logic as GET)
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (token) {
      const payload = await validateToken(token);
      user = await getUserById(payload.userId);
      
      if (!user) {
        throw new AuthError(
          AuthErrorType.USER_NOT_FOUND,
          'User not found',
          404
        );
      }
      
      if (!user.isActive) {
        throw new AuthError(
          AuthErrorType.USER_INACTIVE,
          'User account is inactive',
          403
        );
      }
    } else {
      throw new AuthError(
        AuthErrorType.INVALID_TOKEN,
        'Authentication token required',
        401
      );
    }
    
    // Validate input data
    const updates: any = {};
    if (firstName !== undefined) {
      if (typeof firstName !== 'string' || firstName.trim().length < 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'First name must be a non-empty string',
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }
      updates.first_name = firstName.trim();
    }
    
    if (lastName !== undefined) {
      if (typeof lastName !== 'string' || lastName.trim().length < 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Last name must be a non-empty string',
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }
      updates.last_name = lastName.trim();
    }
    
    if (phone !== undefined) {
      if (phone !== null && (typeof phone !== 'string' || phone.trim().length < 1)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Phone must be a string or null',
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }
      updates.phone = phone ? phone.trim() : null;
    }
    
    // If no valid updates
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid fields to update',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }
    
    // Update user in database
    const db = getDatabase();
    try {
      const updateFields = Object.keys(updates);
      const updateValues = Object.values(updates);
      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      
      const result = db.prepare(`
        UPDATE members 
        SET ${setClause}, updated_at = datetime('now')
        WHERE id = ?
      `).run(...updateValues, user.id);
      
      if (result.changes === 0) {
        throw new AuthError(
          AuthErrorType.USER_NOT_FOUND,
          'User not found or could not be updated',
          404
        );
      }
      
      // Get updated user data
      const updatedUser = await getUserById(user.id);
      
      if (!updatedUser) {
        throw new AuthError(
          AuthErrorType.USER_NOT_FOUND,
          'User not found after update',
          404
        );
      }
      
      // Log successful update
      await logAuthEvent('user_profile_updated', updatedUser, request, {
        ip: clientIp,
        userAgent,
        updatedFields: updateFields
      });
      
      return NextResponse.json({
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          cooperativeId: updatedUser.cooperativeId,
          isActive: updatedUser.isActive,
          permissions: {
            ...DEFAULT_PERMISSIONS[updatedUser.role],
            ...updatedUser.permissions,
          },
          lastLoginAt: updatedUser.lastLoginAt,
        },
        message: 'Profile updated successfully'
      });
      
    } finally {
      db.close();
    }
    
  } catch (error) {
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
    console.error('Me update API error:', error);
    
    await logAuthEvent('me_update_error', user, request, {
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
export async function POST() {
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

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}