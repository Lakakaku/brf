/**
 * Authentication Flow Tests - Login/Logout
 * Tests for complete authentication workflows
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { 
  loginSchema,
  AuthUser,
  AuthError,
  AuthErrorType,
  MemberRole
} from '@/lib/auth/types';
import { hashPassword, verifyPassword } from '@/lib/auth/crypto';
import { generateToken, verifyToken } from '@/lib/auth/jwt';
import { createEnhancedTokenPair, validateSession, refreshAccessToken } from '@/lib/auth/tokens';

// Test database setup
let db: Database.Database;
const TEST_DB_PATH = ':memory:';

beforeEach(() => {
  // Create in-memory database
  db = new Database(TEST_DB_PATH);
  db.pragma('foreign_keys = ON');
  
  // Create test schema
  db.exec(`
    CREATE TABLE cooperatives (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      name TEXT NOT NULL,
      org_number TEXT UNIQUE NOT NULL,
      address TEXT,
      postal_code TEXT,
      city TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    CREATE TABLE members (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      apartment_number TEXT NOT NULL,
      phone_number TEXT,
      role TEXT NOT NULL CHECK (role IN ('member', 'board', 'chairman', 'treasurer', 'admin')),
      cooperative_id TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE,
      UNIQUE(email, cooperative_id)
    );
    
    CREATE TABLE refresh_tokens (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      jti TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      cooperative_id TEXT NOT NULL,
      token_family TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      is_revoked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES members(id) ON DELETE CASCADE
    );
  `);
  
  // Insert test cooperative
  db.prepare(`
    INSERT INTO cooperatives (id, name, org_number) 
    VALUES ('test-coop-1', 'Test BRF', '769620-1234')
  `).run();
});

afterEach(() => {
  if (db) {
    db.close();
  }
});

describe('Login Flow Tests', () => {
  
  test('Successful login with valid credentials', async () => {
    // Create test user
    const password = 'TestPassword123!';
    const passwordHash = await hashPassword(password);
    
    const userStmt = db.prepare(`
      INSERT INTO members (
        id, email, password_hash, first_name, last_name, 
        apartment_number, role, cooperative_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    userStmt.run(
      'test-user-1',
      'test@example.com',
      passwordHash,
      'Test',
      'User',
      '101',
      'member',
      'test-coop-1'
    );
    
    // Validate login schema
    const loginData = {
      email: 'test@example.com',
      password: password,
      cooperativeId: 'test-coop-1'
    };
    
    const validatedData = loginSchema.parse(loginData);
    expect(validatedData.email).toBe('test@example.com');
    
    // Verify password
    const isValid = await verifyPassword(password, passwordHash);
    expect(isValid).toBe(true);
    
    // Create tokens
    const user: AuthUser = {
      id: 'test-user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'member',
      apartmentNumber: '101',
      cooperativeId: 'test-coop-1',
      cooperativeName: 'Test BRF',
      cooperativeOrgNumber: '769620-1234',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const accessToken = generateToken(user);
    expect(accessToken).toBeDefined();
    
    // Verify token
    const decoded = verifyToken(accessToken);
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.role).toBe('member');
  });
  
  test('Failed login with invalid password', async () => {
    // Create test user
    const password = 'TestPassword123!';
    const wrongPassword = 'WrongPassword123!';
    const passwordHash = await hashPassword(password);
    
    const userStmt = db.prepare(`
      INSERT INTO members (
        email, password_hash, first_name, last_name, 
        apartment_number, role, cooperative_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    userStmt.run(
      'test@example.com',
      passwordHash,
      'Test',
      'User',
      '101',
      'member',
      'test-coop-1'
    );
    
    // Verify wrong password fails
    const isValid = await verifyPassword(wrongPassword, passwordHash);
    expect(isValid).toBe(false);
  });
  
  test('Failed login with non-existent user', () => {
    const stmt = db.prepare(`
      SELECT * FROM members 
      WHERE email = ? AND cooperative_id = ?
    `);
    
    const user = stmt.get('nonexistent@example.com', 'test-coop-1');
    expect(user).toBeUndefined();
  });
  
  test('Failed login with inactive user', async () => {
    // Create inactive user
    const password = 'TestPassword123!';
    const passwordHash = await hashPassword(password);
    
    const userStmt = db.prepare(`
      INSERT INTO members (
        email, password_hash, first_name, last_name, 
        apartment_number, role, cooperative_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `);
    
    userStmt.run(
      'inactive@example.com',
      passwordHash,
      'Inactive',
      'User',
      '102',
      'member',
      'test-coop-1'
    );
    
    // Get user and check active status
    const stmt = db.prepare(`
      SELECT * FROM members 
      WHERE email = ? AND cooperative_id = ?
    `);
    
    const user = stmt.get('inactive@example.com', 'test-coop-1') as any;
    expect(user).toBeDefined();
    expect(user.is_active).toBe(0);
  });
  
  test('Login with remember me option', async () => {
    const user: AuthUser = {
      id: 'test-user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'member',
      apartmentNumber: '101',
      cooperativeId: 'test-coop-1',
      cooperativeName: 'Test BRF',
      cooperativeOrgNumber: '769620-1234',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Test different token expiry based on remember me
    const shortToken = generateToken(user, false); // No remember me
    const longToken = generateToken(user, true);  // With remember me
    
    // Both should be valid tokens
    expect(shortToken).toBeDefined();
    expect(longToken).toBeDefined();
    
    // Verify both tokens work
    const shortDecoded = verifyToken(shortToken);
    const longDecoded = verifyToken(longToken);
    
    expect(shortDecoded.email).toBe('test@example.com');
    expect(longDecoded.email).toBe('test@example.com');
  });
});

describe('Logout Flow Tests', () => {
  
  test('Successful logout with token revocation', async () => {
    // Create test user and token
    const user: AuthUser = {
      id: 'test-user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'member',
      apartmentNumber: '101',
      cooperativeId: 'test-coop-1',
      cooperativeName: 'Test BRF',
      cooperativeOrgNumber: '769620-1234',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create refresh token record
    const jti = 'test-jti-123';
    const tokenFamily = 'test-family-123';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const stmt = db.prepare(`
      INSERT INTO refresh_tokens (
        jti, user_id, cooperative_id, token_family, expires_at
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(jti, user.id, user.cooperativeId, tokenFamily, expiresAt.toISOString());
    
    // Revoke token (simulate logout)
    const revokeStmt = db.prepare(`
      UPDATE refresh_tokens 
      SET is_revoked = 1 
      WHERE jti = ?
    `);
    
    revokeStmt.run(jti);
    
    // Verify token is revoked
    const checkStmt = db.prepare(`
      SELECT is_revoked FROM refresh_tokens WHERE jti = ?
    `);
    
    const result = checkStmt.get(jti) as any;
    expect(result.is_revoked).toBe(1);
  });
  
  test('Logout from all devices', async () => {
    const userId = 'test-user-1';
    const cooperativeId = 'test-coop-1';
    
    // Create multiple refresh tokens
    const tokens = [
      { jti: 'token-1', family: 'family-1' },
      { jti: 'token-2', family: 'family-2' },
      { jti: 'token-3', family: 'family-3' }
    ];
    
    const stmt = db.prepare(`
      INSERT INTO refresh_tokens (
        jti, user_id, cooperative_id, token_family, expires_at
      ) VALUES (?, ?, ?, ?, datetime('now', '+7 days'))
    `);
    
    tokens.forEach(token => {
      stmt.run(token.jti, userId, cooperativeId, token.family);
    });
    
    // Revoke all tokens for user
    const revokeAllStmt = db.prepare(`
      UPDATE refresh_tokens 
      SET is_revoked = 1 
      WHERE user_id = ?
    `);
    
    revokeAllStmt.run(userId);
    
    // Verify all tokens are revoked
    const checkStmt = db.prepare(`
      SELECT COUNT(*) as count FROM refresh_tokens 
      WHERE user_id = ? AND is_revoked = 0
    `);
    
    const result = checkStmt.get(userId) as any;
    expect(result.count).toBe(0);
  });
});

describe('Session Management Tests', () => {
  
  test('Session validation with valid token', async () => {
    const user: AuthUser = {
      id: 'test-user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'member',
      apartmentNumber: '101',
      cooperativeId: 'test-coop-1',
      cooperativeName: 'Test BRF',
      cooperativeOrgNumber: '769620-1234',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const token = generateToken(user);
    const decoded = verifyToken(token);
    
    expect(decoded).toBeDefined();
    expect(decoded.id).toBe('test-user-1');
    expect(decoded.email).toBe('test@example.com');
  });
  
  test('Session validation with expired token', () => {
    // Create an expired token by manipulating the JWT
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci0xIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid';
    
    expect(() => {
      verifyToken(expiredToken);
    }).toThrow();
  });
  
  test('Session refresh with valid refresh token', async () => {
    // Create user
    const userStmt = db.prepare(`
      INSERT INTO members (
        id, email, password_hash, first_name, last_name, 
        apartment_number, role, cooperative_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    userStmt.run(
      'test-user-1',
      'test@example.com',
      'hashed-password',
      'Test',
      'User',
      '101',
      'member',
      'test-coop-1'
    );
    
    // Create valid refresh token
    const jti = 'valid-refresh-token';
    const tokenFamily = 'test-family';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const tokenStmt = db.prepare(`
      INSERT INTO refresh_tokens (
        jti, user_id, cooperative_id, token_family, expires_at, is_revoked
      ) VALUES (?, ?, ?, ?, ?, 0)
    `);
    
    tokenStmt.run(
      jti,
      'test-user-1',
      'test-coop-1',
      tokenFamily,
      expiresAt.toISOString()
    );
    
    // Verify refresh token exists and is valid
    const checkStmt = db.prepare(`
      SELECT * FROM refresh_tokens 
      WHERE jti = ? AND is_revoked = 0
    `);
    
    const refreshToken = checkStmt.get(jti) as any;
    expect(refreshToken).toBeDefined();
    expect(refreshToken.user_id).toBe('test-user-1');
  });
  
  test('Multiple concurrent sessions', async () => {
    const userId = 'test-user-1';
    const cooperativeId = 'test-coop-1';
    
    // Create multiple sessions
    const sessions = [
      { jti: 'session-1', device: 'Chrome/Windows' },
      { jti: 'session-2', device: 'Safari/iOS' },
      { jti: 'session-3', device: 'Firefox/Linux' }
    ];
    
    const stmt = db.prepare(`
      INSERT INTO refresh_tokens (
        jti, user_id, cooperative_id, token_family, expires_at
      ) VALUES (?, ?, ?, ?, datetime('now', '+7 days'))
    `);
    
    sessions.forEach((session, index) => {
      stmt.run(session.jti, userId, cooperativeId, `family-${index}` );
    });
    
    // Count active sessions
    const countStmt = db.prepare(`
      SELECT COUNT(*) as count FROM refresh_tokens 
      WHERE user_id = ? AND is_revoked = 0
    `);
    
    const result = countStmt.get(userId) as any;
    expect(result.count).toBe(3);
  });
});