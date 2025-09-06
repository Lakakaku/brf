/**
 * Authentication module entry point for BRF Portal
 * Exports all authentication utilities for easy importing
 */

// Types and interfaces
export * from './types';

// Cryptographic utilities
export * from './crypto';

// JWT utilities
export * from './jwt';

// Session management
export * from './session';

// Authentication middleware
export * from './middleware';

// RBAC system
export * from './rbac';

// Authorization utilities
export * from './authorize';

// Audit logging
export * from './audit';

// Two-Factor Authentication
export * from './2fa';

// Convenience re-exports for common patterns
export {
  // Password utilities
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  generateSecurePassword,
  needsRehash,
  passwordAttemptTracker,
} from './crypto';

export {
  // JWT utilities
  generateToken,
  generateRefreshToken,
  verifyToken,
  validateToken,
  createTokenPair,
  revokeToken,
  extractTokenFromHeader,
  isTokenNearExpiration,
  tokenBlacklist,
} from './jwt';

export {
  // Session utilities
  getSession,
  createSession,
  updateSession,
  destroySession,
  refreshSession,
  isValidSession,
  generateCSRFToken,
  verifyCSRFToken,
  withSession,
  requireAuth as requireSessionAuth,
  requireRole,
} from './session';

export {
  // Middleware utilities
  authenticate,
  requireAuth,
  requireAdmin,
  requireBoard,
  requireChairman,
  requireTreasurer,
  requirePermissions,
  requireCooperativeAccess,
  authenticateApiKey,
  logAuthEvent,
} from './middleware';

// Common authentication patterns
export const AuthPatterns = {
  /**
   * Standard member authentication (session or JWT)
   */
  member: () => authenticate(),
  
  /**
   * Board member or higher
   */
  boardMember: () => authenticate({
    roles: ['board', 'chairman', 'treasurer', 'admin'],
  }),
  
  /**
   * Financial permissions (treasurer, chairman, or admin)
   */
  financial: () => authenticate({
    roles: ['treasurer', 'chairman', 'admin'],
  }),
  
  /**
   * Document management permissions
   */
  documentManager: () => authenticate({
    permissions: ['canUploadDocuments', 'canApproveDocuments'],
  }),
  
  /**
   * Invoice management permissions
   */
  invoiceManager: () => authenticate({
    permissions: ['canViewInvoices', 'canApproveInvoices'],
  }),
  
  /**
   * Member management permissions
   */
  memberManager: () => authenticate({
    permissions: ['canViewMembers', 'canManageMembers'],
  }),
  
  /**
   * Case management permissions
   */
  caseManager: () => authenticate({
    permissions: ['canAssignCases', 'canCloseCases'],
  }),
  
  /**
   * Session-only authentication (no JWT)
   */
  sessionOnly: () => authenticate({
    strategy: 'session',
  }),
  
  /**
   * JWT-only authentication (for API clients)
   */
  jwtOnly: () => authenticate({
    strategy: 'jwt',
  }),
  
  /**
   * CSRF protected session authentication
   */
  csrfProtected: () => authenticate({
    strategy: 'session',
    requireCSRF: true,
  }),
};

// Error handling utilities
export const AuthErrorHandlers = {
  /**
   * Create standardized error response for authentication failures
   */
  handleAuthError: (error: any) => {
    if (error instanceof AuthError) {
      return {
        error: error.message,
        code: error.type,
        statusCode: error.statusCode,
      };
    }
    
    return {
      error: 'Authentication failed',
      code: AuthErrorType.INTERNAL_ERROR,
      statusCode: 500,
    };
  },
  
  /**
   * Check if error is authentication-related
   */
  isAuthError: (error: any): error is AuthError => {
    return error instanceof AuthError;
  },
  
  /**
   * Create user-friendly error messages
   */
  getUserFriendlyMessage: (error: AuthError): string => {
    switch (error.type) {
      case AuthErrorType.INVALID_CREDENTIALS:
        return 'Felaktigt email eller lösenord';
      case AuthErrorType.USER_NOT_FOUND:
        return 'Användaren kunde inte hittas';
      case AuthErrorType.USER_INACTIVE:
        return 'Ditt konto är inaktiverat. Kontakta administratören.';
      case AuthErrorType.TOKEN_EXPIRED:
        return 'Din session har gått ut. Vänligen logga in igen.';
      case AuthErrorType.INSUFFICIENT_PERMISSIONS:
        return 'Du har inte tillräckliga behörigheter för denna åtgärd';
      case AuthErrorType.PASSWORD_TOO_WEAK:
        return 'Lösenordet uppfyller inte säkerhetskraven';
      case AuthErrorType.EMAIL_ALREADY_EXISTS:
        return 'En användare med denna email finns redan';
      case AuthErrorType.RATE_LIMIT_EXCEEDED:
        return 'För många försök. Vänligen försök igen senare.';
      case AuthErrorType.TWO_FACTOR_REQUIRED:
        return 'Tvåfaktorsautentisering krävs för att fortsätta.';
      case AuthErrorType.TWO_FACTOR_INVALID_CODE:
        return 'Fel verifieringskod. Kontrollera att klockan på din enhet är korrekt.';
      case AuthErrorType.TWO_FACTOR_SETUP_REQUIRED:
        return 'Du måste ställa in tvåfaktorsautentisering för att fortsätta.';
      case AuthErrorType.TWO_FACTOR_ALREADY_ENABLED:
        return 'Tvåfaktorsautentisering är redan aktiverad för detta konto.';
      case AuthErrorType.TWO_FACTOR_NOT_ENABLED:
        return 'Tvåfaktorsautentisering är inte aktiverad för detta konto.';
      case AuthErrorType.TWO_FACTOR_SETUP_TOKEN_INVALID:
        return 'Ogiltigt eller utgånget setup-token för tvåfaktorsautentisering.';
      case AuthErrorType.TWO_FACTOR_CODE_REPLAY:
        return 'Denna kod har redan använts. Vänta på nästa kod.';
      case AuthErrorType.TWO_FACTOR_BACKUP_CODE_INVALID:
        return 'Ogiltig backup-kod.';
      case AuthErrorType.TWO_FACTOR_RATE_LIMIT:
        return 'För många tvåfaktorsförsök. Vänta 15 minuter innan du försöker igen.';
      case AuthErrorType.TRUSTED_DEVICE_INVALID:
        return 'Ogiltig enhetstoken. Vänligen logga in igen.';
      default:
        return 'Ett oväntat fel uppstod. Försök igen.';
    }
  },
};

// Validation utilities
export const AuthValidators = {
  /**
   * Validate Swedish email format
   */
  validateSwedishEmail: (email: string): boolean => {
    const swedishEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return swedishEmailRegex.test(email);
  },
  
  /**
   * Validate Swedish phone number
   */
  validateSwedishPhone: (phone: string): boolean => {
    // Swedish phone number formats: +46, 0046, or domestic format
    const swedishPhoneRegex = /^(\+46|0046|0)[1-9]\d{8,9}$/;
    return swedishPhoneRegex.test(phone.replace(/[\s-]/g, ''));
  },
  
  /**
   * Validate Swedish personal number (personnummer)
   */
  validatePersonalNumber: (personalNumber: string): boolean => {
    // Basic format check for YYYYMMDD-XXXX or YYMMDD-XXXX
    const personalNumberRegex = /^(\d{6}|\d{8})-?\d{4}$/;
    return personalNumberRegex.test(personalNumber);
  },
  
  /**
   * Validate BRF organization number
   */
  validateOrgNumber: (orgNumber: string): boolean => {
    // Swedish organization number format: XXXXXX-XXXX
    const orgNumberRegex = /^\d{6}-?\d{4}$/;
    return orgNumberRegex.test(orgNumber);
  },
};

// Development and testing utilities
export const AuthTestUtils = {
  /**
   * Create mock user for testing
   */
  createMockUser: (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'member',
    cooperativeId: 'test-coop',
    isActive: true,
    permissions: {},
    lastLoginAt: new Date().toISOString(),
    ...overrides,
  }),
  
  /**
   * Create mock JWT payload
   */
  createMockJwtPayload: (overrides: Partial<any> = {}): any => ({
    userId: 'test-user-id',
    email: 'test@example.com',
    role: 'member',
    cooperativeId: 'test-coop',
    isActive: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  }),
  
  /**
   * Bypass authentication for testing
   */
  createBypassMiddleware: () => (handler: any) => handler,
};

// Version information
export const AUTH_VERSION = '1.0.0';
export const AUTH_BUILD_DATE = new Date().toISOString();

// Default export with common utilities
export default {
  // Main authentication patterns
  ...AuthPatterns,
  
  // Error handling
  ...AuthErrorHandlers,
  
  // Validation
  ...AuthValidators,
  
  // Testing utilities (only in development)
  ...(process.env.NODE_ENV === 'development' ? AuthTestUtils : {}),
  
  // Version info
  version: AUTH_VERSION,
  buildDate: AUTH_BUILD_DATE,
};