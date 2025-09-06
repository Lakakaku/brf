/**
 * Authorization middleware and utilities for BRF Portal
 * Implements route protection, permission checking, and cooperative isolation
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  MemberRole, 
  BRFPermissions, 
  AuthUser, 
  AuthError, 
  AuthErrorType 
} from './types';
import { 
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  canManageRole,
  meetsPermissionRequirement,
  PermissionRequirement,
  BRF_ROLES,
  RBAC_RATE_LIMITS
} from './rbac';
import { verifyJWT } from './jwt';
import { getSession } from './session';

/**
 * Authorization context for API requests
 */
export interface AuthContext {
  user: AuthUser;
  isAuthenticated: boolean;
  cooperativeId: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
}

/**
 * Authorization check result
 */
export interface AuthorizationResult {
  allowed: boolean;
  user: AuthUser | null;
  error?: AuthError;
  context?: AuthContext;
}

/**
 * Rate limiting store (in production, use Redis)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check rate limit for authorization operations
 */
function checkRateLimit(
  key: string,
  limit: { windowMs: number; maxAttempts: number }
): { allowed: boolean; remainingAttempts: number; resetTime: number } {
  const now = Date.now();
  const windowStart = now - limit.windowMs;
  
  // Clean up expired entries
  for (const [storedKey, data] of rateLimitStore.entries()) {
    if (data.resetTime < now) {
      rateLimitStore.delete(storedKey);
    }
  }
  
  const current = rateLimitStore.get(key);
  
  if (!current || current.resetTime < windowStart) {
    // First request in window or expired window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + limit.windowMs
    });
    
    return {
      allowed: true,
      remainingAttempts: limit.maxAttempts - 1,
      resetTime: now + limit.windowMs
    };
  }
  
  // Increment counter
  current.count++;
  rateLimitStore.set(key, current);
  
  return {
    allowed: current.count <= limit.maxAttempts,
    remainingAttempts: Math.max(0, limit.maxAttempts - current.count),
    resetTime: current.resetTime
  };
}

/**
 * Extract user from request (JWT token or session)
 */
async function extractUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    // Try JWT token first
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await verifyJWT(token);
      
      if (payload && payload.userId) {
        // Construct AuthUser from JWT payload
        return {
          id: payload.userId,
          email: payload.email,
          firstName: null,
          lastName: null,
          role: payload.role,
          cooperativeId: payload.cooperativeId,
          isActive: payload.isActive,
          permissions: {}, // Will be populated from role
          lastLoginAt: null,
        };
      }
    }
    
    // Fallback to session (for SSR)
    const session = await getSession(req);
    return session?.user || null;
  } catch (error) {
    console.error('Error extracting user from request:', error);
    return null;
  }
}

/**
 * Create authorization context from request
 */
function createAuthContext(req: NextRequest, user: AuthUser): AuthContext {
  return {
    user,
    isAuthenticated: true,
    cooperativeId: user.cooperativeId,
    ipAddress: req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip') || 
               'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
    requestId: crypto.randomUUID(),
  };
}

/**
 * Check if user belongs to the same cooperative as the resource
 */
export function checkCooperativeIsolation(
  userCooperativeId: string, 
  resourceCooperativeId: string
): boolean {
  return userCooperativeId === resourceCooperativeId;
}

/**
 * Main authorization function
 */
export async function authorize(
  req: NextRequest,
  requirements: PermissionRequirement | PermissionRequirement[] = []
): Promise<AuthorizationResult> {
  try {
    // Extract user from request
    const user = await extractUser(req);
    
    if (!user) {
      return {
        allowed: false,
        user: null,
        error: new AuthError(
          AuthErrorType.INVALID_TOKEN,
          'Authentication required',
          401
        )
      };
    }
    
    // Check if user is active
    if (!user.isActive) {
      return {
        allowed: false,
        user: null,
        error: new AuthError(
          AuthErrorType.USER_INACTIVE,
          'User account is inactive',
          403
        )
      };
    }
    
    // Create auth context
    const context = createAuthContext(req, user);
    
    // Rate limiting for authorization checks
    const rateLimitKey = `auth:${user.id}:${context.ipAddress}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, RBAC_RATE_LIMITS.PERMISSION_CHECK);
    
    if (!rateLimitResult.allowed) {
      return {
        allowed: false,
        user,
        error: new AuthError(
          AuthErrorType.RATE_LIMIT_EXCEEDED,
          'Too many authorization attempts',
          429
        ),
        context
      };
    }
    
    // Check permission requirements
    const requirementArray = Array.isArray(requirements) ? requirements : [requirements];
    
    for (const requirement of requirementArray) {
      const hasAccess = meetsPermissionRequirement(
        user.role,
        requirement,
        user.permissions
      );
      
      if (!hasAccess) {
        // Log permission denial for audit
        console.warn('Authorization denied:', {
          userId: user.id,
          role: user.role,
          requirement,
          timestamp: new Date().toISOString(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });
        
        return {
          allowed: false,
          user,
          error: new AuthError(
            AuthErrorType.INSUFFICIENT_PERMISSIONS,
            'Insufficient permissions for this operation',
            403
          ),
          context
        };
      }
    }
    
    return {
      allowed: true,
      user,
      context
    };
  } catch (error) {
    console.error('Authorization error:', error);
    
    return {
      allowed: false,
      user: null,
      error: new AuthError(
        AuthErrorType.INTERNAL_ERROR,
        'Authorization failed',
        500
      )
    };
  }
}

/**
 * Middleware wrapper for API routes
 */
export function withAuthorization(
  requirements: PermissionRequirement | PermissionRequirement[] = []
) {
  return function middleware(
    handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
  ) {
    return async function authorizedHandler(req: NextRequest): Promise<NextResponse> {
      // Authorize request
      const authResult = await authorize(req, requirements);
      
      if (!authResult.allowed) {
        const error = authResult.error!;
        
        return NextResponse.json(
          {
            error: error.type,
            message: error.message,
            timestamp: new Date().toISOString(),
          },
          { status: error.statusCode }
        );
      }
      
      // Call original handler with auth context
      try {
        return await handler(req, authResult.context!);
      } catch (error) {
        console.error('Handler error:', error);
        
        return NextResponse.json(
          {
            error: 'INTERNAL_ERROR',
            message: 'Internal server error',
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }
    };
  };
}

/**
 * Decorator for class methods (for future use with API controllers)
 */
export function RequiresPermission(
  requirement: PermissionRequirement
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (
      this: any,
      req: NextRequest,
      ...args: any[]
    ) {
      const authResult = await authorize(req, requirement);
      
      if (!authResult.allowed) {
        const error = authResult.error!;
        throw new AuthError(error.type, error.message, error.statusCode);
      }
      
      // Add auth context to method arguments
      return originalMethod.apply(this, [req, authResult.context, ...args]);
    };
    
    return descriptor;
  };
}

/**
 * Helper functions for common authorization patterns
 */

/**
 * Check if user can access cooperative data
 */
export async function authorizeCooperativeAccess(
  req: NextRequest,
  cooperativeId: string,
  requirements: PermissionRequirement[] = []
): Promise<AuthorizationResult> {
  const authResult = await authorize(req, requirements);
  
  if (!authResult.allowed) {
    return authResult;
  }
  
  // Check cooperative isolation
  if (!checkCooperativeIsolation(authResult.user!.cooperativeId, cooperativeId)) {
    return {
      allowed: false,
      user: authResult.user,
      error: new AuthError(
        AuthErrorType.INSUFFICIENT_PERMISSIONS,
        'Access denied to cooperative data',
        403
      ),
      context: authResult.context
    };
  }
  
  return authResult;
}

/**
 * Check if user can manage another user
 */
export async function authorizeUserManagement(
  req: NextRequest,
  targetUserId: string,
  targetUserRole: MemberRole
): Promise<AuthorizationResult> {
  const authResult = await authorize(req, [
    { type: 'single', permission: 'canManageMembers' }
  ]);
  
  if (!authResult.allowed) {
    return authResult;
  }
  
  const user = authResult.user!;
  
  // Users can always manage themselves (for basic operations)
  if (user.id === targetUserId) {
    return authResult;
  }
  
  // Check role hierarchy
  if (!canManageRole(user.role, targetUserRole)) {
    return {
      allowed: false,
      user,
      error: new AuthError(
        AuthErrorType.INSUFFICIENT_PERMISSIONS,
        'Cannot manage user with higher or equal role',
        403
      ),
      context: authResult.context
    };
  }
  
  return authResult;
}

/**
 * Check if user can access financial data
 */
export async function authorizeFinancialAccess(
  req: NextRequest,
  operation: 'view' | 'create' | 'approve' | 'export' = 'view'
): Promise<AuthorizationResult> {
  let requirement: PermissionRequirement;
  
  switch (operation) {
    case 'view':
      requirement = { type: 'single', permission: 'canViewFinancialReports' };
      break;
    case 'create':
      requirement = { type: 'single', permission: 'canCreateInvoices' };
      break;
    case 'approve':
      requirement = { type: 'single', permission: 'canApproveInvoices' };
      break;
    case 'export':
      requirement = { type: 'single', permission: 'canExportFinancialData' };
      break;
    default:
      requirement = { type: 'single', permission: 'canViewFinancialReports' };
  }
  
  return authorize(req, requirement);
}

/**
 * Check if user can access audit logs
 */
export async function authorizeAuditAccess(
  req: NextRequest
): Promise<AuthorizationResult> {
  const authResult = await authorize(req, [
    { type: 'single', permission: 'canAccessAuditLog' }
  ]);
  
  if (!authResult.allowed) {
    return authResult;
  }
  
  // Additional rate limiting for audit access
  const rateLimitKey = `audit:${authResult.user!.id}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, RBAC_RATE_LIMITS.AUDIT_ACCESS);
  
  if (!rateLimitResult.allowed) {
    return {
      allowed: false,
      user: authResult.user,
      error: new AuthError(
        AuthErrorType.RATE_LIMIT_EXCEEDED,
        'Audit access rate limit exceeded',
        429
      ),
      context: authResult.context
    };
  }
  
  return authResult;
}

/**
 * Utility for creating permission-based filters for data queries
 */
export function createPermissionFilter(
  user: AuthUser,
  entityType: string
): Record<string, any> {
  const filters: Record<string, any> = {
    cooperative_id: user.cooperativeId, // Always filter by cooperative
  };
  
  // Add additional filters based on role and permissions
  switch (entityType) {
    case 'members':
      if (!hasPermission(user.role, 'canViewMembers')) {
        filters.id = user.id; // Can only see themselves
      }
      break;
      
    case 'financial_reports':
      if (!hasPermission(user.role, 'canViewFinancialReports')) {
        return {}; // No access
      }
      break;
      
    case 'audit_log':
      if (!hasPermission(user.role, 'canAccessAuditLog')) {
        return {}; // No access
      }
      break;
      
    default:
      break;
  }
  
  return filters;
}

/**
 * Security headers for authorization responses
 */
export function createSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
  };
}

/**
 * Log authorization events for audit
 */
export function logAuthorizationEvent(
  event: 'access_granted' | 'access_denied' | 'rate_limit_exceeded',
  context: AuthContext,
  details: Record<string, any> = {}
): void {
  const logEntry = {
    event,
    timestamp: new Date().toISOString(),
    userId: context.user.id,
    userRole: context.user.role,
    cooperativeId: context.cooperativeId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
    ...details,
  };
  
  // In production, send to audit logging service
  console.log('Authorization event:', JSON.stringify(logEntry));
  
  // TODO: Store in audit_log table
}

/**
 * Export all authorization utilities
 */
export {
  authorize,
  withAuthorization,
  RequiresPermission,
  authorizeCooperativeAccess,
  authorizeUserManagement,
  authorizeFinancialAccess,
  authorizeAuditAccess,
  checkCooperativeIsolation,
  createPermissionFilter,
  createSecurityHeaders,
  logAuthorizationEvent,
};

export type {
  AuthContext,
  AuthorizationResult,
};