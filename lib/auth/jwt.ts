/**
 * JWT token generation and validation utilities for BRF Portal
 * Handles secure token creation, verification, and management
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JwtPayload, JwtConfig, AuthError, AuthErrorType, AuthUser } from './types';

/**
 * Default JWT configuration
 * In production, these should come from environment variables
 */
const getJwtConfig = (): JwtConfig => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'JWT_SECRET environment variable is required',
      500
    );
  }

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  };
};

/**
 * Generate a JWT token for an authenticated user
 * @param user - The authenticated user data
 * @param options - Token generation options
 * @returns Promise<{ token: string; expiresAt: Date }> - Token and expiration
 */
export async function generateToken(
  user: AuthUser,
  options: {
    expiresIn?: string;
    jti?: string;
  } = {}
): Promise<{ token: string; expiresAt: Date }> {
  try {
    const config = getJwtConfig();
    const expiresIn = options.expiresIn || config.expiresIn;
    const jti = options.jti || generateTokenId();

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      cooperativeId: user.cooperativeId,
      isActive: user.isActive,
      jti,
    };

    const token = jwt.sign(payload, config.secret, {
      expiresIn,
      algorithm: config.algorithm,
      issuer: 'brf-portal',
      audience: user.cooperativeId,
    });

    // Calculate expiration date
    const decoded = jwt.decode(token) as any;
    const expiresAt = new Date(decoded.exp * 1000);

    return { token, expiresAt };
  } catch (error) {
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Failed to generate JWT token',
      500
    );
  }
}

/**
 * Generate a refresh token with longer expiration
 * @param user - The authenticated user data
 * @returns Promise<{ token: string; expiresAt: Date }>
 */
export async function generateRefreshToken(
  user: AuthUser
): Promise<{ token: string; expiresAt: Date }> {
  const config = getJwtConfig();
  return generateToken(user, {
    expiresIn: config.refreshExpiresIn,
    jti: generateTokenId('refresh'),
  });
}

/**
 * Verify and decode a JWT token
 * @param token - The JWT token to verify
 * @param options - Verification options
 * @returns Promise<JwtPayload> - Decoded token payload
 */
export async function verifyToken(
  token: string,
  options: {
    audience?: string;
    ignoreExpiration?: boolean;
  } = {}
): Promise<JwtPayload> {
  try {
    if (!token || typeof token !== 'string') {
      throw new AuthError(
        AuthErrorType.INVALID_TOKEN,
        'Token is required',
        401
      );
    }

    const config = getJwtConfig();
    
    const payload = jwt.verify(token, config.secret, {
      algorithms: [config.algorithm],
      issuer: 'brf-portal',
      audience: options.audience,
      ignoreExpiration: options.ignoreExpiration || false,
    }) as JwtPayload;

    // Validate required fields
    if (!payload.userId || !payload.email || !payload.role || !payload.cooperativeId) {
      throw new AuthError(
        AuthErrorType.INVALID_TOKEN,
        'Token missing required fields',
        401
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError(
        AuthErrorType.TOKEN_EXPIRED,
        'Token has expired',
        401
      );
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError(
        AuthErrorType.INVALID_TOKEN,
        'Invalid token',
        401
      );
    }

    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Token verification failed',
      500
    );
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader - The Authorization header value
 * @returns string | null - Extracted token or null
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  return match ? match[1] : null;
}

/**
 * Check if a token is about to expire (within threshold)
 * @param token - The JWT token to check
 * @param thresholdMinutes - Minutes before expiration to consider "about to expire"
 * @returns boolean - True if token expires within threshold
 */
export function isTokenNearExpiration(
  token: string,
  thresholdMinutes: number = 15
): boolean {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return true;

    const expirationTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const thresholdTime = currentTime + (thresholdMinutes * 60 * 1000);

    return expirationTime <= thresholdTime;
  } catch {
    return true; // If we can't decode, assume it's expired
  }
}

/**
 * Generate a unique token ID for JWT tracking
 * @param prefix - Optional prefix for the token ID
 * @returns string - Unique token identifier
 */
export function generateTokenId(prefix: string = 'jwt'): string {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${timestamp}_${randomBytes}`;
}

/**
 * Create token pair (access + refresh) for a user
 * @param user - The authenticated user data
 * @returns Promise<TokenPair> - Access and refresh tokens
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export async function createTokenPair(user: AuthUser): Promise<TokenPair> {
  const [access, refresh] = await Promise.all([
    generateToken(user),
    generateRefreshToken(user)
  ]);

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshTokenExpiresAt: refresh.expiresAt,
  };
}

/**
 * Token blacklist management
 * Simple in-memory implementation - in production, use Redis or database
 */
class TokenBlacklist {
  private blacklistedTokens: Set<string> = new Set();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired tokens every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, 60 * 60 * 1000);
  }

  /**
   * Add a token to the blacklist
   */
  addToken(token: string): void {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.jti) {
        this.blacklistedTokens.add(decoded.jti);
      }
    } catch {
      // If we can't decode, add the full token
      this.blacklistedTokens.add(token);
    }
  }

  /**
   * Check if a token is blacklisted
   */
  isBlacklisted(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.jti) {
        return this.blacklistedTokens.has(decoded.jti);
      }
      return this.blacklistedTokens.has(token);
    } catch {
      return this.blacklistedTokens.has(token);
    }
  }

  /**
   * Remove expired tokens from blacklist
   */
  private cleanupExpiredTokens(): void {
    const now = Math.floor(Date.now() / 1000);
    const tokensToRemove: string[] = [];

    for (const tokenOrJti of this.blacklistedTokens) {
      try {
        // Try to decode if it looks like a JWT
        if (tokenOrJti.includes('.')) {
          const decoded = jwt.decode(tokenOrJti) as any;
          if (decoded && decoded.exp && decoded.exp < now) {
            tokensToRemove.push(tokenOrJti);
          }
        }
      } catch {
        // Keep tokens we can't decode (better safe than sorry)
        continue;
      }
    }

    tokensToRemove.forEach(token => {
      this.blacklistedTokens.delete(token);
    });
  }

  /**
   * Clear all blacklisted tokens (for testing)
   */
  clear(): void {
    this.blacklistedTokens.clear();
  }

  /**
   * Get blacklist size (for monitoring)
   */
  size(): number {
    return this.blacklistedTokens.size;
  }

  /**
   * Cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
export const tokenBlacklist = new TokenBlacklist();

/**
 * Validate token and check blacklist
 * @param token - JWT token to validate
 * @param options - Verification options
 * @returns Promise<JwtPayload> - Valid token payload
 */
export async function validateToken(
  token: string,
  options: {
    audience?: string;
    ignoreExpiration?: boolean;
  } = {}
): Promise<JwtPayload> {
  // Check blacklist first
  if (tokenBlacklist.isBlacklisted(token)) {
    throw new AuthError(
      AuthErrorType.INVALID_TOKEN,
      'Token has been revoked',
      401
    );
  }

  // Verify the token
  return verifyToken(token, options);
}

/**
 * Revoke a token by adding it to blacklist
 * @param token - JWT token to revoke
 */
export function revokeToken(token: string): void {
  tokenBlacklist.addToken(token);
}

/**
 * Create a secure API key for service-to-service communication
 * @param cooperativeId - The cooperative ID
 * @param service - Service identifier
 * @param expiresIn - Token expiration
 * @returns Promise<string> - API key token
 */
export async function createApiKey(
  cooperativeId: string,
  service: string,
  expiresIn: string = '1y'
): Promise<string> {
  const config = getJwtConfig();
  
  const payload = {
    type: 'api_key',
    cooperativeId,
    service,
    jti: generateTokenId('api'),
  };

  return jwt.sign(payload, config.secret, {
    expiresIn,
    algorithm: config.algorithm,
    issuer: 'brf-portal-api',
    audience: cooperativeId,
  });
}

/**
 * Verify an API key token
 * @param apiKey - The API key to verify
 * @returns Promise<{ cooperativeId: string; service: string }> - API key data
 */
export async function verifyApiKey(
  apiKey: string
): Promise<{ cooperativeId: string; service: string }> {
  try {
    const config = getJwtConfig();
    
    const payload = jwt.verify(apiKey, config.secret, {
      algorithms: [config.algorithm],
      issuer: 'brf-portal-api',
    }) as any;

    if (payload.type !== 'api_key' || !payload.cooperativeId || !payload.service) {
      throw new AuthError(
        AuthErrorType.INVALID_TOKEN,
        'Invalid API key format',
        401
      );
    }

    return {
      cooperativeId: payload.cooperativeId,
      service: payload.service,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError(
        AuthErrorType.TOKEN_EXPIRED,
        'API key has expired',
        401
      );
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError(
        AuthErrorType.INVALID_TOKEN,
        'Invalid API key',
        401
      );
    }

    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'API key verification failed',
      500
    );
  }
}