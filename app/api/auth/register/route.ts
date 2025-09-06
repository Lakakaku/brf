/**
 * Registration API route for BRF Portal
 * Handles new user registration (for testing and development purposes)
 * In production, this would typically be restricted or use invitation-based registration
 */

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { 
  registerSchema, 
  AuthUser, 
  AuthError, 
  AuthErrorType,
  isValidMemberRole,
  DEFAULT_PERMISSIONS 
} from '@/lib/auth/types';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/crypto';
import { createTokenPair } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
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
 * Check if email already exists in cooperative
 * @param email - Email to check
 * @param cooperativeId - Cooperative ID
 * @returns boolean - True if email exists
 */
async function emailExists(email: string, cooperativeId: string): Promise<boolean> {
  const db = getDatabase();
  
  try {
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM members 
      WHERE email = ? AND cooperative_id = ? AND deleted_at IS NULL
    `).get(email.toLowerCase(), cooperativeId) as { count: number };
    
    return result.count > 0;
  } finally {
    db.close();
  }
}

/**
 * Check if cooperative exists
 * @param cooperativeId - Cooperative ID to check
 * @returns boolean - True if cooperative exists
 */
async function cooperativeExists(cooperativeId: string): Promise<boolean> {
  const db = getDatabase();
  
  try {
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM cooperatives 
      WHERE id = ? AND deleted_at IS NULL
    `).get(cooperativeId) as { count: number };
    
    return result.count > 0;
  } finally {
    db.close();
  }
}

/**
 * Create a new member in the database
 * @param userData - User registration data
 * @param passwordHash - Hashed password
 * @returns Created user data
 */
async function createMember(
  userData: {
    email: string;
    firstName: string;
    lastName: string;
    cooperativeId: string;
    phone?: string;
  },
  passwordHash: string
): Promise<AuthUser> {
  const db = getDatabase();
  
  try {
    // Generate user ID
    const userId = require('crypto').randomBytes(16).toString('hex');
    
    // Insert new member
    const stmt = db.prepare(`
      INSERT INTO members (
        id, cooperative_id, email, password_hash,
        first_name, last_name, phone, role, is_active,
        permissions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    const defaultRole = 'member';
    const defaultPermissions = JSON.stringify(DEFAULT_PERMISSIONS[defaultRole] || {});
    
    stmt.run(
      userId,
      userData.cooperativeId,
      userData.email.toLowerCase(),
      passwordHash,
      userData.firstName,
      userData.lastName,
      userData.phone || null,
      defaultRole,
      1, // is_active
      defaultPermissions
    );
    
    return {
      id: userId,
      email: userData.email.toLowerCase(),
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: defaultRole,
      cooperativeId: userData.cooperativeId,
      isActive: true,
      permissions: DEFAULT_PERMISSIONS[defaultRole] || {},
      lastLoginAt: null,
    };
  } finally {
    db.close();
  }
}

/**
 * Registration API handler
 */
export async function POST(request: NextRequest) {
  let requestBody: any;
  let userEmail: string | null = null;
  
  try {
    // Check if registration is enabled
    const registrationEnabled = process.env.ENABLE_REGISTRATION === 'true' || 
                               process.env.NODE_ENV === 'development';
    
    if (!registrationEnabled) {
      return NextResponse.json(
        {
          error: 'Registration is currently disabled',
          code: 'REGISTRATION_DISABLED',
        },
        { status: 403 }
      );
    }
    
    // Parse and validate request body
    requestBody = await request.json();
    const { 
      email, 
      password, 
      confirmPassword,
      firstName, 
      lastName, 
      cooperativeId,
      phone 
    } = registerSchema.parse(requestBody);
    
    userEmail = email;
    
    // Validate password strength
    validatePasswordStrength(password);
    
    // Check if cooperative exists
    if (!(await cooperativeExists(cooperativeId))) {
      return NextResponse.json(
        {
          error: 'Invalid cooperative ID',
          code: 'COOPERATIVE_NOT_FOUND',
        },
        { status: 400 }
      );
    }
    
    // Check if email already exists in this cooperative
    if (await emailExists(email, cooperativeId)) {
      await logAuthEvent('registration_failed', null, request, {
        email,
        reason: 'email_exists',
        cooperativeId,
      });
      
      return NextResponse.json(
        {
          error: 'An account with this email already exists',
          code: 'EMAIL_EXISTS',
        },
        { status: 409 }
      );
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create new member
    const newUser = await createMember(
      {
        email,
        firstName,
        lastName,
        cooperativeId,
        phone,
      },
      passwordHash
    );
    
    // Update last login to current time
    newUser.lastLoginAt = new Date().toISOString();
    
    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        cooperativeId: newUser.cooperativeId,
        isActive: newUser.isActive,
        permissions: newUser.permissions,
        lastLoginAt: newUser.lastLoginAt,
      },
      message: 'Registration successful',
    }, { status: 201 });
    
    // Create session for the new user
    try {
      await createSession(request, response, newUser);
    } catch (sessionError) {
      console.error('Session creation error during registration:', sessionError);
      // Continue without session - user can login manually
    }
    
    // Generate JWT tokens
    try {
      const tokenPair = await createTokenPair(newUser);
      
      response.headers.set('X-Access-Token', tokenPair.accessToken);
      response.headers.set('X-Refresh-Token', tokenPair.refreshToken);
    } catch (tokenError) {
      console.error('Token creation error during registration:', tokenError);
      // Continue without tokens - user can login manually
    }
    
    // Log successful registration
    await logAuthEvent('registration_success', newUser, request, {
      ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
      cooperativeId: newUser.cooperativeId,
    });
    
    return response;
    
  } catch (error) {
    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          details: (error as any).errors,
        },
        { status: 400 }
      );
    }
    
    // Handle authentication errors (e.g., password too weak)
    if (error instanceof AuthError) {
      await logAuthEvent('registration_failed', null, request, {
        email: userEmail,
        reason: error.type,
        message: error.message,
      });
      
      return NextResponse.json(
        {
          error: error.message,
          code: error.type,
        },
        { status: error.statusCode }
      );
    }
    
    // Handle database constraint errors
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return NextResponse.json(
        {
          error: 'An account with this email already exists',
          code: 'EMAIL_EXISTS',
        },
        { status: 409 }
      );
    }
    
    // Log unexpected errors
    console.error('Registration API error:', error);
    
    await logAuthEvent('registration_error', null, request, {
      email: userEmail,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * Get registration configuration and validation rules
 */
export async function GET() {
  try {
    const registrationEnabled = process.env.ENABLE_REGISTRATION === 'true' || 
                               process.env.NODE_ENV === 'development';
    
    return NextResponse.json({
      enabled: registrationEnabled,
      passwordRequirements: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
      },
      fields: {
        email: { required: true, type: 'email' },
        password: { required: true, type: 'password' },
        confirmPassword: { required: true, type: 'password' },
        firstName: { required: true, type: 'text' },
        lastName: { required: true, type: 'text' },
        cooperativeId: { required: true, type: 'text' },
        phone: { required: false, type: 'tel' },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get registration configuration',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
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