/**
 * Session management utilities using iron-session for BRF Portal
 * Provides secure server-side session handling with encrypted cookies
 */

import { getIronSession } from 'iron-session';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { SessionData, IronSessionConfig, AuthUser, AuthError, AuthErrorType } from './types';

/**
 * Get session configuration from environment variables
 */
const getSessionConfig = (): IronSessionConfig => {
  const password = process.env.SESSION_SECRET;
  if (!password) {
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'SESSION_SECRET environment variable is required',
      500
    );
  }

  if (password.length < 32) {
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'SESSION_SECRET must be at least 32 characters long',
      500
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';

  return {
    cookieName: process.env.SESSION_COOKIE_NAME || 'brf-portal-session',
    password,
    cookieOptions: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400'), // 24 hours default
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    },
  };
};

/**
 * Get session from request/response pair
 * @param req - Next.js request object
 * @param res - Next.js response object
 * @returns Promise<SessionData> - Session data
 */
export async function getSession(
  req: NextRequest,
  res?: NextResponse
): Promise<SessionData> {
  try {
    const config = getSessionConfig();
    
    // Create a mock response if not provided (for API routes)
    const response = res || new NextResponse();
    
    const session = await getIronSession<SessionData>(req, response, {
      cookieName: config.cookieName,
      password: config.password,
      cookieOptions: config.cookieOptions,
    });

    // Initialize empty session if not exists
    if (!session.isLoggedIn) {
      session.isLoggedIn = false;
    }

    return session;
  } catch (error) {
    console.error('Session retrieval error:', error);
    
    // Return empty session on error
    return {
      isLoggedIn: false,
    };
  }
}

/**
 * Create a new session for an authenticated user
 * @param req - Next.js request object
 * @param res - Next.js response object
 * @param user - Authenticated user data
 * @returns Promise<SessionData> - Created session
 */
export async function createSession(
  req: NextRequest,
  res: NextResponse,
  user: AuthUser
): Promise<SessionData> {
  try {
    const session = await getSession(req, res);
    
    session.user = user;
    session.isLoggedIn = true;
    session.loginTimestamp = Date.now();
    session.csrfToken = generateCSRFToken();

    await session.save();
    
    return session;
  } catch (error) {
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Failed to create session',
      500
    );
  }
}

/**
 * Update an existing session
 * @param req - Next.js request object
 * @param res - Next.js response object
 * @param updates - Partial session updates
 * @returns Promise<SessionData> - Updated session
 */
export async function updateSession(
  req: NextRequest,
  res: NextResponse,
  updates: Partial<SessionData>
): Promise<SessionData> {
  try {
    const session = await getSession(req, res);
    
    Object.assign(session, updates);
    await session.save();
    
    return session;
  } catch (error) {
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Failed to update session',
      500
    );
  }
}

/**
 * Destroy a session (logout)
 * @param req - Next.js request object
 * @param res - Next.js response object
 * @returns Promise<void>
 */
export async function destroySession(
  req: NextRequest,
  res: NextResponse
): Promise<void> {
  try {
    const session = await getSession(req, res);
    
    session.user = undefined;
    session.isLoggedIn = false;
    session.loginTimestamp = undefined;
    session.csrfToken = undefined;

    await session.save();
  } catch (error) {
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Failed to destroy session',
      500
    );
  }
}

/**
 * Check if a session is valid and not expired
 * @param session - Session data to validate
 * @returns boolean - True if session is valid
 */
export function isValidSession(session: SessionData): boolean {
  if (!session.isLoggedIn || !session.user) {
    return false;
  }

  // Check if user is active
  if (!session.user.isActive) {
    return false;
  }

  // Check session timestamp if available
  if (session.loginTimestamp) {
    const config = getSessionConfig();
    const maxAge = config.cookieOptions.maxAge * 1000; // Convert to milliseconds
    const now = Date.now();
    
    if (now - session.loginTimestamp > maxAge) {
      return false;
    }
  }

  return true;
}

/**
 * Refresh session timestamp to extend its lifetime
 * @param req - Next.js request object
 * @param res - Next.js response object
 * @returns Promise<SessionData> - Refreshed session
 */
export async function refreshSession(
  req: NextRequest,
  res: NextResponse
): Promise<SessionData> {
  try {
    const session = await getSession(req, res);
    
    if (session.isLoggedIn && session.user) {
      session.loginTimestamp = Date.now();
      await session.save();
    }
    
    return session;
  } catch (error) {
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Failed to refresh session',
      500
    );
  }
}

/**
 * Generate a CSRF token for session security
 * @returns string - Generated CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token from session
 * @param session - Session data containing CSRF token
 * @param providedToken - CSRF token provided by client
 * @returns boolean - True if tokens match
 */
export function verifyCSRFToken(
  session: SessionData,
  providedToken: string | null
): boolean {
  if (!session.csrfToken || !providedToken) {
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(session.csrfToken, 'hex'),
    Buffer.from(providedToken, 'hex')
  );
}

/**
 * Session middleware for API routes
 * Provides session data to API handlers
 */
export interface SessionRequest extends NextRequest {
  session?: SessionData;
}

export type SessionHandler = (
  req: SessionRequest,
  res: NextResponse
) => Promise<NextResponse>;

/**
 * Higher-order function to add session support to API routes
 * @param handler - API route handler
 * @returns Enhanced handler with session support
 */
export function withSession(handler: SessionHandler): SessionHandler {
  return async (req: SessionRequest, res: NextResponse) => {
    try {
      // Get session and attach to request
      req.session = await getSession(req, res);
      
      // Call the original handler
      const response = await handler(req, res);
      
      return response;
    } catch (error) {
      console.error('Session middleware error:', error);
      
      // Continue without session on error
      return handler(req, res);
    }
  };
}

/**
 * Require authentication for API routes
 * @param handler - API route handler
 * @returns Protected handler that requires authentication
 */
export function requireAuth(handler: SessionHandler): SessionHandler {
  return withSession(async (req: SessionRequest, res: NextResponse) => {
    const session = req.session;
    
    if (!session || !isValidSession(session)) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return handler(req, res);
  });
}

/**
 * Require specific role for API routes
 * @param roles - Required roles (string or array)
 * @param handler - API route handler
 * @returns Protected handler that requires specific roles
 */
export function requireRole(
  roles: string | string[],
  handler: SessionHandler
): SessionHandler {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return requireAuth(async (req: SessionRequest, res: NextResponse) => {
    const session = req.session!; // Safe to use ! after requireAuth
    
    if (!session.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    return handler(req, res);
  });
}

/**
 * Session cleanup utilities
 */
export class SessionManager {
  private static instance: SessionManager;
  
  private constructor() {}
  
  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }
  
  /**
   * Clean up expired sessions
   * In a real implementation, this would clean up stored sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    // This would typically query a database or cache
    // For iron-session, cleanup is handled automatically by the browser
    // This method is here for future extensibility
    return 0;
  }
  
  /**
   * Get active session count
   * In a real implementation, this would count active sessions
   */
  async getActiveSessionCount(): Promise<number> {
    // Would query session store
    return 0;
  }
  
  /**
   * Force logout for a specific user
   * In a real implementation, this would invalidate all user sessions
   */
  async forceLogout(userId: string): Promise<void> {
    // Would mark user sessions as invalid in session store
    console.log(`Force logout requested for user: ${userId}`);
  }
}

/**
 * Session configuration validation
 */
export function validateSessionConfig(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  try {
    const config = getSessionConfig();
    
    if (!config.password || config.password.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters');
    }
    
    if (!config.cookieName) {
      errors.push('Session cookie name is required');
    }
    
    if (config.cookieOptions.maxAge < 300) {
      errors.push('Session max age should be at least 5 minutes');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Unknown configuration error'],
    };
  }
}

/**
 * Development utilities
 */
export const sessionUtils = {
  /**
   * Create a mock session for testing
   */
  createMockSession(user: Partial<AuthUser> = {}): SessionData {
    const mockUser: AuthUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'member',
      cooperativeId: 'test-coop',
      isActive: true,
      permissions: {},
      lastLoginAt: new Date().toISOString(),
      ...user,
    };
    
    return {
      user: mockUser,
      isLoggedIn: true,
      loginTimestamp: Date.now(),
      csrfToken: generateCSRFToken(),
    };
  },
  
  /**
   * Generate session configuration for testing
   */
  createTestConfig(): SessionConfig {
    return {
      cookieName: 'test-session',
      password: 'test-password-at-least-32-characters-long',
      cookieOptions: {
        secure: false,
        httpOnly: true,
        maxAge: 3600,
        sameSite: 'lax',
        path: '/',
      },
    };
  },
};