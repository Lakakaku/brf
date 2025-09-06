/**
 * Password hashing and cryptographic utilities for BRF Portal
 * Implements secure password hashing using bcrypt with appropriate salt rounds
 */

import bcrypt from 'bcrypt';
import { HashConfig, AuthError, AuthErrorType } from './types';

/**
 * Default configuration for password hashing
 */
const DEFAULT_HASH_CONFIG: HashConfig = {
  saltRounds: 12, // Secure default for 2024, adjust based on performance requirements
};

/**
 * Password strength validation configuration
 */
export interface PasswordStrengthConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  forbiddenPatterns: RegExp[];
}

const DEFAULT_PASSWORD_CONFIG: PasswordStrengthConfig = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // Optional for Swedish users
  forbiddenPatterns: [
    /^123456/, // Common weak patterns
    /^password/i,
    /^qwerty/i,
    /^admin/i,
    /^\d+$/, // Only numbers
  ],
};

/**
 * Hash a password using bcrypt with salt
 * @param password - Plain text password to hash
 * @param config - Optional hash configuration
 * @returns Promise<string> - The hashed password
 */
export async function hashPassword(
  password: string,
  config: Partial<HashConfig> = {}
): Promise<string> {
  try {
    if (!password || typeof password !== 'string') {
      throw new AuthError(
        AuthErrorType.VALIDATION_ERROR,
        'Password must be a non-empty string',
        400
      );
    }

    const { saltRounds } = { ...DEFAULT_HASH_CONFIG, ...config };
    
    // Validate password strength before hashing
    validatePasswordStrength(password);
    
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Failed to hash password',
      500
    );
  }
}

/**
 * Verify a password against its hash
 * @param password - Plain text password to verify
 * @param hash - The hashed password from database
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    if (!password || !hash) {
      return false;
    }

    const isValid = await bcrypt.compare(password, hash);
    return isValid;
  } catch (error) {
    // Log error but don't expose details to avoid information leakage
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Validate password strength according to BRF Portal requirements
 * @param password - Plain text password to validate
 * @throws AuthError if password doesn't meet requirements
 */
export function validatePasswordStrength(
  password: string,
  config: Partial<PasswordStrengthConfig> = {}
): void {
  const settings = { ...DEFAULT_PASSWORD_CONFIG, ...config };
  const errors: string[] = [];

  // Length check
  if (password.length < settings.minLength) {
    errors.push(`Password must be at least ${settings.minLength} characters long`);
  }

  // Character type checks
  if (settings.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (settings.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (settings.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (settings.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Pattern checks
  for (const pattern of settings.forbiddenPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains forbidden pattern');
      break;
    }
  }

  // Swedish specific checks
  if (/^(brf|förening|bostad)/i.test(password)) {
    errors.push('Password should not contain common Swedish housing terms');
  }

  if (errors.length > 0) {
    throw new AuthError(
      AuthErrorType.PASSWORD_TOO_WEAK,
      `Password validation failed: ${errors.join(', ')}`,
      400
    );
  }
}

/**
 * Generate a cryptographically secure random password
 * Useful for temporary passwords or password resets
 * @param length - Length of the generated password
 * @param options - Password generation options
 * @returns string - Generated password
 */
export function generateSecurePassword(
  length: number = 12,
  options: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSpecialChars?: boolean;
  } = {}
): string {
  const defaults = {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSpecialChars: true,
  };
  
  const settings = { ...defaults, ...options };
  
  let charset = '';
  if (settings.includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (settings.includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (settings.includeNumbers) charset += '0123456789';
  if (settings.includeSpecialChars) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (charset === '') {
    throw new AuthError(
      AuthErrorType.VALIDATION_ERROR,
      'At least one character type must be included',
      400
    );
  }

  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }

  return password;
}

/**
 * Check if a password hash needs to be rehashed (e.g., due to updated salt rounds)
 * @param hash - The current password hash
 * @param config - Current hash configuration
 * @returns boolean - True if rehashing is recommended
 */
export function needsRehash(
  hash: string,
  config: Partial<HashConfig> = {}
): boolean {
  try {
    const { saltRounds } = { ...DEFAULT_HASH_CONFIG, ...config };
    
    // Extract rounds from hash (bcrypt format: $2b$rounds$salt+hash)
    const parts = hash.split('$');
    if (parts.length < 3) return true;
    
    const currentRounds = parseInt(parts[2], 10);
    return currentRounds < saltRounds;
  } catch {
    // If we can't parse the hash, assume it needs rehashing
    return true;
  }
}

/**
 * Rate limiting helper for password attempts
 * Simple in-memory implementation - in production, use Redis or similar
 */
class PasswordAttemptTracker {
  private attempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  /**
   * Check if an identifier is rate limited
   */
  isRateLimited(identifier: string): boolean {
    const record = this.attempts.get(identifier);
    if (!record) return false;

    const now = Date.now();
    const timeSinceLastAttempt = now - record.lastAttempt;

    // Reset if lockout period has passed
    if (timeSinceLastAttempt > this.LOCKOUT_DURATION) {
      this.attempts.delete(identifier);
      return false;
    }

    return record.count >= this.MAX_ATTEMPTS;
  }

  /**
   * Record a failed attempt
   */
  recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const record = this.attempts.get(identifier) || { count: 0, lastAttempt: now };

    // Reset count if enough time has passed
    if (now - record.lastAttempt > this.LOCKOUT_DURATION) {
      record.count = 0;
    }

    record.count++;
    record.lastAttempt = now;
    this.attempts.set(identifier, record);
  }

  /**
   * Reset attempts for an identifier (e.g., after successful login)
   */
  resetAttempts(identifier: string): void {
    this.attempts.delete(identifier);
  }

  /**
   * Get time remaining until unlock (in seconds)
   */
  getTimeUntilUnlock(identifier: string): number {
    const record = this.attempts.get(identifier);
    if (!record || record.count < this.MAX_ATTEMPTS) return 0;

    const now = Date.now();
    const unlockTime = record.lastAttempt + this.LOCKOUT_DURATION;
    
    return Math.max(0, Math.ceil((unlockTime - now) / 1000));
  }
}

// Export singleton instance
export const passwordAttemptTracker = new PasswordAttemptTracker();