/**
 * Authentication type definitions for BRF Portal
 * Contains interfaces and types for user authentication, sessions, and JWT tokens
 */

import { z } from 'zod';

/**
 * BRF member roles with Swedish context
 */
export type MemberRole = 'member' | 'board' | 'chairman' | 'treasurer' | 'admin';

/**
 * Authentication user data stored in JWT tokens and sessions
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: MemberRole;
  cooperativeId: string;
  isActive: boolean;
  permissions: Record<string, any>;
  lastLoginAt: string | null;
}

/**
 * JWT token payload structure
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: MemberRole;
  cooperativeId: string;
  isActive: boolean;
  iat?: number; // Issued at
  exp?: number; // Expiration time
  jti?: string; // JWT ID
}

/**
 * Session data structure for iron-session
 */
export interface SessionData {
  user?: AuthUser;
  isLoggedIn: boolean;
  loginTimestamp?: number;
  csrfToken?: string;
}

/**
 * Login request validation schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

/**
 * Registration request validation schema
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  cooperativeId: z.string().min(1, 'Cooperative ID is required'),
  phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * Change password request validation schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * Refresh token payload structure
 */
export interface RefreshTokenPayload {
  userId: string;
  email: string;
  role: MemberRole;
  cooperativeId: string;
  isActive: boolean;
  tokenType: 'refresh';
  iat?: number; // Issued at
  exp?: number; // Expiration time
  jti?: string; // JWT ID
}

/**
 * Token pair with access and refresh tokens
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  tokenType?: 'bearer';
}

/**
 * Token refresh request schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Forgot password request validation schema
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Reset password request validation schema
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * Verify reset token request schema
 */
export const verifyResetTokenSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
});

/**
 * Two-Factor Authentication validation schemas
 */
export const twoFactorSetupSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const twoFactorVerifySetupSchema = z.object({
  setupToken: z.string().min(1, 'Setup token is required'),
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

export const twoFactorVerifySchema = z.object({
  code: z.string().min(1, 'Verification code is required'),
  trustDevice: z.boolean().optional().default(false),
});

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
  code: z.string().optional(), // TOTP code or backup code
});

export const twoFactorBackupCodesRegenerateSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
});

/**
 * Session monitoring configuration
 */
export interface SessionConfig {
  cookieName: string;
  password: string;
  cookieOptions: {
    secure: boolean;
    httpOnly: boolean;
    maxAge: number;
    sameSite: 'strict' | 'lax' | 'none';
    path: string;
  };
  // Session monitoring settings
  refreshThreshold: number; // Minutes before expiration to refresh
  warningThreshold: number; // Minutes before expiration to warn user
  checkInterval: number; // Milliseconds between session checks
}

/**
 * Client-side session state
 */
export interface ClientSessionState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  tokens: TokenPair | null;
  lastActivity: number;
  sessionExpiry: number | null;
  refreshInProgress: boolean;
  warningShown: boolean;
}

/**
 * Authentication response types
 */
export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  refreshToken?: string;
  tokenPair?: TokenPair;
  message?: string;
  error?: string;
}

/**
 * Token refresh response
 */
export interface RefreshTokenResponse {
  success: boolean;
  tokenPair?: TokenPair;
  user?: AuthUser;
  error?: string;
  code?: string;
}

/**
 * Forgot password response
 */
export interface ForgotPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
  rateLimitExceeded?: boolean;
  retryAfter?: number; // seconds until next attempt allowed
}

/**
 * Reset password response
 */
export interface ResetPasswordResponse {
  success: boolean;
  user?: AuthUser;
  message?: string;
  error?: string;
}

/**
 * Verify reset token response
 */
export interface VerifyResetTokenResponse {
  success: boolean;
  valid: boolean;
  expired?: boolean;
  used?: boolean;
  email?: string;
  error?: string;
}

/**
 * Password reset token data structure
 */
export interface PasswordResetToken {
  id: string;
  tokenHash: string;
  userId: string;
  email: string;
  cooperativeId: string;
  expiresAt: Date;
  isUsed: boolean;
  usedAt?: Date;
  requestIp?: string;
  requestUserAgent?: string;
  resetIp?: string;
  resetUserAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Password reset attempt tracking
 */
export interface PasswordResetAttempt {
  id: string;
  cooperativeId: string;
  email: string;
  requestIp: string;
  userAgent?: string;
  attemptCount: number;
  lastAttemptAt: Date;
  blockedUntil?: Date;
  status: 'pending' | 'sent' | 'failed' | 'blocked';
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Password hash configuration
 */
export interface HashConfig {
  saltRounds: number;
}

/**
 * JWT configuration
 */
export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
  algorithm: 'HS256' | 'HS384' | 'HS512';
}

/**
 * Iron session configuration for server-side sessions
 */
export interface IronSessionConfig {
  cookieName: string;
  password: string;
  cookieOptions: {
    secure: boolean;
    httpOnly: boolean;
    maxAge: number;
    sameSite: 'strict' | 'lax' | 'none';
    path: string;
  };
}

/**
 * Authentication error types
 */
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_INACTIVE = 'USER_INACTIVE',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  COOPERATIVE_NOT_FOUND = 'COOPERATIVE_NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RESET_TOKEN_INVALID = 'RESET_TOKEN_INVALID',
  RESET_TOKEN_EXPIRED = 'RESET_TOKEN_EXPIRED',
  RESET_TOKEN_USED = 'RESET_TOKEN_USED',
  PASSWORD_RESET_BLOCKED = 'PASSWORD_RESET_BLOCKED',
  // Two-Factor Authentication errors
  TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED',
  TWO_FACTOR_INVALID_CODE = 'TWO_FACTOR_INVALID_CODE',
  TWO_FACTOR_SETUP_REQUIRED = 'TWO_FACTOR_SETUP_REQUIRED',
  TWO_FACTOR_ALREADY_ENABLED = 'TWO_FACTOR_ALREADY_ENABLED',
  TWO_FACTOR_NOT_ENABLED = 'TWO_FACTOR_NOT_ENABLED',
  TWO_FACTOR_SETUP_TOKEN_INVALID = 'TWO_FACTOR_SETUP_TOKEN_INVALID',
  TWO_FACTOR_CODE_REPLAY = 'TWO_FACTOR_CODE_REPLAY',
  TWO_FACTOR_BACKUP_CODE_INVALID = 'TWO_FACTOR_BACKUP_CODE_INVALID',
  TWO_FACTOR_RATE_LIMIT = 'TWO_FACTOR_RATE_LIMIT',
  TRUSTED_DEVICE_INVALID = 'TRUSTED_DEVICE_INVALID',
}

/**
 * Authentication error class
 */
export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Member permissions structure for BRF context
 */
export interface BRFPermissions {
  // Document management
  canViewDocuments: boolean;
  canUploadDocuments: boolean;
  canApproveDocuments: boolean;
  
  // Invoice and financial management
  canViewInvoices: boolean;
  canApproveInvoices: boolean;
  canCreateInvoices: boolean;
  
  // Member management
  canViewMembers: boolean;
  canManageMembers: boolean;
  
  // Case management
  canCreateCases: boolean;
  canAssignCases: boolean;
  canCloseCases: boolean;
  
  // Board meeting management
  canScheduleMeetings: boolean;
  canEditProtocols: boolean;
  canApproveMeetingMinutes: boolean;
  
  // Booking management
  canMakeBookings: boolean;
  canManageBookings: boolean;
  canManageResources: boolean;
  
  // Financial reports
  canViewFinancialReports: boolean;
  canExportFinancialData: boolean;
  
  // Admin functions
  canManageCooperative: boolean;
  canAccessAuditLog: boolean;
  canManageSystemSettings: boolean;
  
  // Two-Factor Authentication permissions
  canManage2FA: boolean;
  canForceDisable2FA: boolean;
  canView2FAStatus: boolean;
  canEnforce2FA: boolean;
}

/**
 * Default permissions by role
 */
export const DEFAULT_PERMISSIONS: Record<MemberRole, Partial<BRFPermissions>> = {
  member: {
    canViewDocuments: true,
    canUploadDocuments: false,
    canCreateCases: true,
    canMakeBookings: true,
    canViewMembers: false,
    canManage2FA: true, // Members can manage their own 2FA
  },
  board: {
    canViewDocuments: true,
    canUploadDocuments: true,
    canApproveDocuments: true,
    canViewInvoices: true,
    canApproveInvoices: true,
    canViewMembers: true,
    canCreateCases: true,
    canAssignCases: true,
    canScheduleMeetings: true,
    canMakeBookings: true,
    canManageBookings: true,
    canViewFinancialReports: true,
  },
  chairman: {
    canViewDocuments: true,
    canUploadDocuments: true,
    canApproveDocuments: true,
    canViewInvoices: true,
    canApproveInvoices: true,
    canCreateInvoices: true,
    canViewMembers: true,
    canManageMembers: true,
    canCreateCases: true,
    canAssignCases: true,
    canCloseCases: true,
    canScheduleMeetings: true,
    canEditProtocols: true,
    canApproveMeetingMinutes: true,
    canMakeBookings: true,
    canManageBookings: true,
    canManageResources: true,
    canViewFinancialReports: true,
    canExportFinancialData: true,
  },
  treasurer: {
    canViewDocuments: true,
    canUploadDocuments: true,
    canApproveDocuments: true,
    canViewInvoices: true,
    canApproveInvoices: true,
    canCreateInvoices: true,
    canViewMembers: true,
    canCreateCases: true,
    canAssignCases: true,
    canScheduleMeetings: true,
    canEditProtocols: true,
    canMakeBookings: true,
    canManageBookings: true,
    canViewFinancialReports: true,
    canExportFinancialData: true,
  },
  admin: {
    canViewDocuments: true,
    canUploadDocuments: true,
    canApproveDocuments: true,
    canViewInvoices: true,
    canApproveInvoices: true,
    canCreateInvoices: true,
    canViewMembers: true,
    canManageMembers: true,
    canCreateCases: true,
    canAssignCases: true,
    canCloseCases: true,
    canScheduleMeetings: true,
    canEditProtocols: true,
    canApproveMeetingMinutes: true,
    canMakeBookings: true,
    canManageBookings: true,
    canManageResources: true,
    canViewFinancialReports: true,
    canExportFinancialData: true,
    canManageCooperative: true,
    canAccessAuditLog: true,
    canManageSystemSettings: true,
    canManage2FA: true,
    canForceDisable2FA: true,
    canView2FAStatus: true,
    canEnforce2FA: true,
  },
};

/**
 * Type guards
 */
export const isValidMemberRole = (role: string): role is MemberRole => {
  return ['member', 'board', 'chairman', 'treasurer', 'admin'].includes(role);
};

export const isAuthUser = (obj: any): obj is AuthUser => {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.email === 'string' &&
    isValidMemberRole(obj.role) &&
    typeof obj.cooperativeId === 'string' &&
    typeof obj.isActive === 'boolean'
  );
};

/**
 * Two-Factor Authentication interfaces
 */
export interface TwoFactorSecret {
  id: string;
  userId: string;
  cooperativeId: string;
  secretEncrypted: string;
  encryptionIv: string;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: 6 | 8;
  period: number;
  isVerified: boolean;
  verifiedAt?: Date;
  setupToken?: string;
  setupExpiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  lastVerifiedCode?: string;
  trustedDevices: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TwoFactorBackupCode {
  id: string;
  userId: string;
  cooperativeId: string;
  codeHash: string;
  codeSalt: string;
  isUsed: boolean;
  usedAt?: Date;
  usedIp?: string;
  usedUserAgent?: string;
  generationBatch: string;
  sequenceNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TwoFactorAttempt {
  id: string;
  cooperativeId: string;
  userId?: string;
  attemptType: 'totp' | 'backup_code' | 'setup_verify';
  email?: string;
  requestIp: string;
  userAgent?: string;
  providedCode: string; // Hashed
  isSuccessful: boolean;
  failureReason?: string;
  attemptCount: number;
  blockedUntil?: Date;
  sessionId?: string;
  loginAttemptId?: string;
  createdAt: Date;
}

export interface TwoFactorAuditLog {
  id: number;
  cooperativeId: string;
  userId?: string;
  eventType: 
    | 'setup_initiated'
    | 'setup_completed'
    | 'setup_cancelled'
    | 'totp_verified'
    | 'totp_failed'
    | 'backup_code_used'
    | 'backup_codes_regenerated'
    | 'disabled'
    | 'force_disabled'
    | 'recovery_used'
    | 'device_trusted'
    | 'device_untrusted';
  eventDescription: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  eventData: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  gdprCategory?: string;
  retentionUntil?: Date;
  createdAt: Date;
}

/**
 * Two-Factor Authentication response types
 */
export interface TwoFactorSetupResponse {
  success: boolean;
  data?: {
    secret: string;
    qrCodeUri: string;
    setupToken: string;
    backupCodes: string[];
    expiresAt: Date;
  };
  error?: string;
}

export interface TwoFactorVerifyResponse {
  success: boolean;
  isBackupCode?: boolean;
  backupCodesRemaining?: number;
  trustDeviceToken?: string;
  error?: string;
}

export interface TwoFactorStatusResponse {
  success: boolean;
  data?: {
    enabled: boolean;
    backupCodesRemaining: number;
    lastUsed?: Date;
    usageCount: number;
  };
  error?: string;
}

export interface TwoFactorBackupCodesResponse {
  success: boolean;
  backupCodes?: string[];
  error?: string;
}

export interface TwoFactorDisableResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Extended authentication user data with 2FA
 */
export interface AuthUserWith2FA extends AuthUser {
  hasTwoFactorEnabled: boolean;
  twoFactorVerified?: boolean;
  requiresTwoFactor?: boolean;
}

/**
 * Extended session data with 2FA state
 */
export interface SessionDataWith2FA extends SessionData {
  twoFactorPending?: boolean;
  twoFactorVerified?: boolean;
  twoFactorUserId?: string;
  twoFactorTimestamp?: number;
  trustedDeviceToken?: string;
}

/**
 * Login response with 2FA support
 */
export interface LoginResponseWith2FA extends AuthResponse {
  requiresTwoFactor?: boolean;
  twoFactorSetupRequired?: boolean;
  backupCodesRemaining?: number;
}

/**
 * Device trust configuration
 */
export interface TrustedDevice {
  fingerprint: string;
  name: string;
  userAgent: string;
  ipAddress: string;
  trustedAt: Date;
  lastUsed: Date;
  expiresAt?: Date;
}

/**
 * 2FA configuration for the application
 */
export interface TwoFactorConfig {
  enabled: boolean;
  enforced: boolean; // If true, all users must enable 2FA
  gracePeriodDays: number; // Grace period for mandatory 2FA
  maxBackupCodes: number;
  totpConfig: {
    secretLength: number;
    digits: 6 | 8;
    period: number;
    algorithm: 'SHA1' | 'SHA256' | 'SHA512';
    windowSize: number;
  };
  rateLimit: {
    maxAttemptsPerPeriod: number;
    periodMinutes: number;
    lockoutDurationMinutes: number;
  };
  deviceTrust: {
    enabled: boolean;
    maxTrustedDevices: number;
    trustDurationDays: number;
  };
}

/**
 * Inferred types from Zod schemas
 */
export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
export type VerifyResetTokenRequest = z.infer<typeof verifyResetTokenSchema>;
export type TwoFactorSetupRequest = z.infer<typeof twoFactorSetupSchema>;
export type TwoFactorVerifySetupRequest = z.infer<typeof twoFactorVerifySetupSchema>;
export type TwoFactorVerifyRequest = z.infer<typeof twoFactorVerifySchema>;
export type TwoFactorDisableRequest = z.infer<typeof twoFactorDisableSchema>;
export type TwoFactorBackupCodesRegenerateRequest = z.infer<typeof twoFactorBackupCodesRegenerateSchema>;