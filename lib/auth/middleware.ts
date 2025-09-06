/**
 * Authentication middleware for BRF Portal API routes
 * Provides authentication and authorization utilities for Next.js API handlers
 */

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { 
  AuthUser, 
  AuthError, 
  AuthErrorType, 
  MemberRole, 
  BRFPermissions, 
  DEFAULT_PERMISSIONS,
  isValidMemberRole 
} from './types';
import { validateToken, extractTokenFromHeader } from './jwt';
import { getSession, isValidSession, SessionData } from './session';
import { passwordAttemptTracker } from './crypto';

/**
 * Database connection for authentication queries
 */
let db: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || './database/brf.db';
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Authentication strategy types
 */
export type AuthStrategy = 'session' | 'jwt' | 'both';

/**
 * Authentication options for middleware
 */
export interface AuthOptions {
  strategy?: AuthStrategy;
  roles?: MemberRole[];
  permissions?: (keyof BRFPermissions)[];
  allowInactive?: boolean;
  requireCSRF?: boolean;
}

/**
 * Authenticated request interface
 */
export interface AuthenticatedRequest extends NextRequest {
  user?: AuthUser;
  session?: SessionData;
}

/**
 * API handler with authentication support
 */
export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: NextResponse
) => Promise<NextResponse>;

/**
 * Get user from database by ID
 * @param userId - User ID to lookup
 * @param cooperativeId - Cooperative ID for additional security
 * @returns Promise<AuthUser | null> - User data or null if not found
 */
async function getUserById(userId: string, cooperativeId?: string): Promise<AuthUser | null> {
  try {
    const database = getDatabase();
    
    let query = `
      SELECT 
        id, email, first_name, last_name, role, 
        cooperative_id, is_active, permissions, last_login_at
      FROM members 
      WHERE id = ? AND deleted_at IS NULL
    `;
    
    const params = [userId];
    
    if (cooperativeId) {
      query += ' AND cooperative_id = ?';
      params.push(cooperativeId);
    }
    
    const row = database.prepare(query).get(...params) as any;
    
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
  } catch (error) {
    console.error('Database error in getUserById:', error);
    return null;
  }
}

/**
 * Authenticate request using session
 * @param req - Request object
 * @returns Promise<AuthUser | null> - Authenticated user or null
 */
async function authenticateWithSession(req: AuthenticatedRequest): Promise<AuthUser | null> {
  try {
    const session = await getSession(req);
    
    if (!isValidSession(session) || !session.user) {
      return null;
    }
    
    // Verify user still exists and is active
    const user = await getUserById(session.user.id, session.user.cooperativeId);
    
    if (!user || !user.isActive) {
      return null;
    }
    
    req.session = session;
    return user;
  } catch (error) {
    console.error('Session authentication error:', error);
    return null;
  }
}

/**
 * Authenticate request using JWT token
 * @param req - Request object
 * @returns Promise<AuthUser | null> - Authenticated user or null
 */
async function authenticateWithJWT(req: AuthenticatedRequest): Promise<AuthUser | null> {
  try {
    const authHeader = req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) return null;
    
    const payload = await validateToken(token);
    
    // Verify user still exists and is active
    const user = await getUserById(payload.userId, payload.cooperativeId);
    
    if (!user || !user.isActive) {
      return null;
    }
    
    return user;
  } catch (error) {
    if (error instanceof AuthError) {
      // Log authentication errors but don't expose details
      console.error('JWT authentication error:', error.message);
    }
    return null;
  }
}

/**
 * Check if user has required role
 * @param user - User to check
 * @param requiredRoles - Required roles
 * @returns boolean - True if user has any of the required roles
 */
function hasRequiredRole(user: AuthUser, requiredRoles: MemberRole[]): boolean {
  if (requiredRoles.length === 0) return true;
  return requiredRoles.includes(user.role);
}

/**
 * Check if user has required permissions
 * @param user - User to check
 * @param requiredPermissions - Required permissions
 * @returns boolean - True if user has all required permissions
 */
function hasRequiredPermissions(
  user: AuthUser, 
  requiredPermissions: (keyof BRFPermissions)[]
): boolean {
  if (requiredPermissions.length === 0) return true;
  
  // Get default permissions for user role
  const defaultPermissions = DEFAULT_PERMISSIONS[user.role] || {};
  
  // Merge with user-specific permissions
  const userPermissions = { ...defaultPermissions, ...user.permissions };
  
  // Check if user has all required permissions
  return requiredPermissions.every(permission => 
    userPermissions[permission] === true
  );
}

/**
 * Rate limiting middleware
 * @param req - Request object
 * @param identifier - Rate limiting identifier (IP, user ID, etc.)
 * @returns boolean - True if request is allowed
 */
function checkRateLimit(req: AuthenticatedRequest, identifier: string): boolean {
  // Simple IP-based rate limiting
  const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const rateLimitKey = `${identifier}:${ip}`;
  
  return !passwordAttemptTracker.isRateLimited(rateLimitKey);
}

/**
 * Main authentication middleware
 * @param options - Authentication options
 * @returns Middleware function
 */
export function authenticate(options: AuthOptions = {}) {
  const {
    strategy = 'both',
    roles = [],
    permissions = [],
    allowInactive = false,
    requireCSRF = false,
  } = options;
  
  return function authMiddleware(handler: AuthenticatedHandler): AuthenticatedHandler {
    return async (req: AuthenticatedRequest, res: NextResponse) => {
      try {
        let user: AuthUser | null = null;
        
        // Try authentication strategies
        if (strategy === 'session' || strategy === 'both') {
          user = await authenticateWithSession(req);
        }
        
        if (!user && (strategy === 'jwt' || strategy === 'both')) {
          user = await authenticateWithJWT(req);
        }
        
        // Check if authentication is required
        if (!user) {
          return NextResponse.json(
            { error: 'Authentication required', code: 'UNAUTHORIZED' },
            { status: 401 }
          );
        }
        
        // Check if user is active (unless explicitly allowed)
        if (!allowInactive && !user.isActive) {
          return NextResponse.json(
            { error: 'Account is inactive', code: 'ACCOUNT_INACTIVE' },
            { status: 403 }
          );
        }
        
        // Check required roles
        if (!hasRequiredRole(user, roles)) {
          return NextResponse.json(
            { 
              error: 'Insufficient permissions', 
              code: 'INSUFFICIENT_ROLE',
              required: roles,
              current: user.role,
            },
            { status: 403 }
          );
        }
        
        // Check required permissions
        if (!hasRequiredPermissions(user, permissions)) {
          return NextResponse.json(
            { 
              error: 'Insufficient permissions', 
              code: 'INSUFFICIENT_PERMISSIONS',
              required: permissions,
            },
            { status: 403 }
          );
        }
        
        // CSRF protection for session-based authentication
        if (requireCSRF && req.session) {
          const csrfToken = req.headers.get('x-csrf-token');
          
          if (!csrfToken || !req.session.csrfToken || csrfToken !== req.session.csrfToken) {
            return NextResponse.json(
              { error: 'Invalid CSRF token', code: 'INVALID_CSRF' },
              { status: 403 }
            );
          }
        }
        
        // Attach user to request
        req.user = user;
        
        // Call the protected handler
        return handler(req, res);
        
      } catch (error) {
        console.error('Authentication middleware error:', error);
        
        return NextResponse.json(
          { error: 'Authentication failed', code: 'AUTH_ERROR' },
          { status: 500 }
        );
      }
    };
  };
}

/**
 * Require authentication (any valid user)
 */
export const requireAuth = authenticate();

/**
 * Require admin role
 */
export const requireAdmin = authenticate({
  roles: ['admin'],
});

/**
 * Require board member or higher
 */
export const requireBoard = authenticate({
  roles: ['board', 'chairman', 'treasurer', 'admin'],
});

/**
 * Require chairman role
 */
export const requireChairman = authenticate({
  roles: ['chairman', 'admin'],
});

/**
 * Require treasurer role
 */
export const requireTreasurer = authenticate({
  roles: ['treasurer', 'chairman', 'admin'],
});

/**
 * Create permission-based middleware
 * @param permissions - Required permissions
 * @returns Middleware function
 */
export function requirePermissions(...permissions: (keyof BRFPermissions)[]) {
  return authenticate({
    permissions,
  });
}

/**
 * Cooperative isolation middleware
 * Ensures users can only access data from their own cooperative
 */
export function requireCooperativeAccess(handler: AuthenticatedHandler): AuthenticatedHandler {
  return requireAuth(async (req: AuthenticatedRequest, res: NextResponse) => {
    const user = req.user!; // Safe after requireAuth
    
    // Extract cooperative ID from request (URL param, body, query, etc.)
    const url = new URL(req.url);
    const cooperativeId = 
      url.searchParams.get('cooperativeId') ||
      url.pathname.split('/').find(segment => segment.startsWith('coop-')) ||
      req.headers.get('x-cooperative-id');
    
    // If cooperative ID is specified, ensure it matches user's cooperative
    if (cooperativeId && cooperativeId !== user.cooperativeId) {
      return NextResponse.json(
        { 
          error: 'Access denied to this cooperative', 
          code: 'COOPERATIVE_ACCESS_DENIED' 
        },
        { status: 403 }
      );
    }
    
    return handler(req, res);
  });
}

/**
 * API key authentication for service-to-service communication
 * @param req - Request object
 * @returns Promise<{ cooperativeId: string; service: string } | null>
 */
export async function authenticateApiKey(
  req: NextRequest
): Promise<{ cooperativeId: string; service: string } | null> {
  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return null;
    
    const { verifyApiKey } = await import('./jwt');
    return await verifyApiKey(apiKey);
  } catch (error) {
    console.error('API key authentication error:', error);
    return null;
  }
}

/**
 * Error handling utilities
 */
export function createAuthErrorResponse(
  error: AuthError
): NextResponse {
  const statusCode = error.statusCode || 401;
  
  return NextResponse.json(
    {
      error: error.message,
      code: error.type,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * Audit logging for authentication events
 * @param event - Authentication event
 * @param user - User involved (if any)
 * @param req - Request object
 * @param additional - Additional data to log
 */
export async function logAuthEvent(
  event: string,
  user: AuthUser | null,
  req: NextRequest,
  additional: Record<string, any> = {}
): Promise<void> {
  try {
    const database = getDatabase();
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    database.prepare(`
      INSERT INTO audit_log (
        cooperative_id, user_id, user_role, ip_address, user_agent,
        action, entity_type, entity_id, new_values, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      user?.cooperativeId || 'system',
      user?.id || null,
      user?.role || null,
      ip,
      userAgent,
      event,
      'auth',
      user?.id || null,
      JSON.stringify(additional)
    );
  } catch (error) {
    console.error('Failed to log auth event:', error);
  }
}

/**
 * Development utilities
 */
export const authMiddlewareUtils = {
  /**
   * Create a mock authenticated request for testing
   */
  createMockAuthRequest(user: Partial<AuthUser> = {}): AuthenticatedRequest {
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
    
    const request = new NextRequest('http://localhost/api/test') as AuthenticatedRequest;
    request.user = mockUser;
    
    return request;
  },
  
  /**
   * Skip authentication for testing
   */
  bypassAuth(handler: AuthenticatedHandler): AuthenticatedHandler {
    return async (req: AuthenticatedRequest, res: NextResponse) => {
      // Add mock user if none exists
      if (!req.user) {
        req.user = {
          id: 'test-user',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'admin',
          cooperativeId: 'test-coop',
          isActive: true,
          permissions: {},
          lastLoginAt: new Date().toISOString(),
        };
      }
      
      return handler(req, res);
    };
  },
};