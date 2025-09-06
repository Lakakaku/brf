/**
 * BankID Integration Layer
 * Connects BankID mock/real implementation with the BRF Portal auth system
 */

import { bankIDConfig, createBankIDClient, type RealBankIDClient } from '@/lib/config/bankid';
import { validatePersonnummer } from '@/lib/utils/swedish';
import { 
  createBankIDAuditLogger, 
  BankIDEventType, 
  BankIDEventSeverity,
  type BankIDAuditLogger 
} from '@/lib/audit/bankid';
import { 
  getEmailVerificationTemplate, 
  sendMockEmail, 
  generateVerificationCode,
  generateVerificationUrl 
} from '@/lib/email/templates';

/**
 * BankID integration service
 */
export class BankIDIntegrationService {
  private client: RealBankIDClient;
  private auditLogger: BankIDAuditLogger | null = null;

  constructor(database?: any) {
    this.client = createBankIDClient(bankIDConfig);
    
    if (database) {
      this.auditLogger = createBankIDAuditLogger(database);
    }
  }

  /**
   * Initiate BankID authentication
   */
  async initiateAuth(params: {
    personnummer?: string;
    endUserIp: string;
    userAgent: string;
    method: 'same-device' | 'other-device';
    cooperativeId: string;
    sessionId: string;
    userId?: string;
  }) {
    try {
      // Validate personnummer if provided
      if (params.personnummer) {
        const validation = validatePersonnummer(params.personnummer);
        if (!validation.isValid) {
          await this.auditLogger?.logAuthFailed({
            sessionId: params.sessionId,
            errorCode: 'INVALID_PERSONNUMMER',
            errorMessage: 'Invalid Swedish personal number format',
            ipAddress: params.endUserIp,
            userAgent: params.userAgent,
            method: params.method,
          });
          
          throw new Error('Ogiltigt personnummer');
        }
      }

      // Log initiation
      await this.auditLogger?.logAuthInitiated({
        sessionId: params.sessionId,
        userId: params.userId,
        cooperativeId: params.cooperativeId,
        personnummer: params.personnummer,
        ipAddress: params.endUserIp,
        userAgent: params.userAgent,
        method: params.method,
      });

      // Start BankID authentication
      const response = await this.client.auth(
        params.personnummer || '',
        params.endUserIp,
        'BRF Portal - Säker inloggning'
      );

      // Log successful start
      await this.auditLogger?.logAuthStarted({
        sessionId: params.sessionId,
        orderRef: response.orderRef,
        ipAddress: params.endUserIp,
        userAgent: params.userAgent,
        method: params.method,
        metadata: {
          qrStartToken: response.qrStartToken ? 'present' : 'missing',
          autoStartToken: response.autoStartToken ? 'present' : 'missing',
        },
      });

      return response;
    } catch (error: any) {
      await this.auditLogger?.logAuthFailed({
        sessionId: params.sessionId,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message,
        ipAddress: params.endUserIp,
        userAgent: params.userAgent,
        method: params.method,
      });

      throw error;
    }
  }

  /**
   * Collect BankID authentication status
   */
  async collectAuth(params: {
    orderRef: string;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    method: 'same-device' | 'other-device';
  }) {
    try {
      const response = await this.client.collect(params.orderRef);

      // Log based on status
      if (response.status === 'complete' && response.completionData) {
        await this.auditLogger?.logAuthCompleted({
          sessionId: params.sessionId,
          orderRef: params.orderRef,
          cooperativeId: '', // Would be filled from session
          personnummer: response.completionData.user.personalNumber,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          method: params.method,
          duration: 0, // Would calculate from start time
          metadata: {
            deviceIp: response.completionData.device.ipAddress,
            certificateNotBefore: response.completionData.cert.notBefore,
            certificateNotAfter: response.completionData.cert.notAfter,
          },
        });
      } else if (response.status === 'failed') {
        await this.auditLogger?.logAuthFailed({
          sessionId: params.sessionId,
          orderRef: params.orderRef,
          errorCode: response.hintCode || 'UNKNOWN_ERROR',
          errorMessage: 'BankID authentication failed',
          hintCode: response.hintCode,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          method: params.method,
        });
      }

      return response;
    } catch (error: any) {
      await this.auditLogger?.logAuthFailed({
        sessionId: params.sessionId,
        orderRef: params.orderRef,
        errorCode: error.code || 'COLLECT_ERROR',
        errorMessage: error.message,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        method: params.method,
      });

      throw error;
    }
  }

  /**
   * Cancel BankID authentication
   */
  async cancelAuth(params: {
    orderRef: string;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    method: 'same-device' | 'other-device';
  }) {
    try {
      await this.client.cancel(params.orderRef);

      await this.auditLogger?.logEvent({
        eventType: BankIDEventType.AUTH_CANCELLED,
        severity: BankIDEventSeverity.INFO,
        sessionId: params.sessionId,
        orderRef: params.orderRef,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        method: params.method,
      });
    } catch (error: any) {
      // Log cancellation error, but don't throw
      await this.auditLogger?.logEvent({
        eventType: BankIDEventType.AUTH_FAILED,
        severity: BankIDEventSeverity.WARNING,
        sessionId: params.sessionId,
        orderRef: params.orderRef,
        errorCode: error.code || 'CANCEL_ERROR',
        errorMessage: error.message,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        method: params.method,
      });
    }
  }

  /**
   * Process user registration with BankID data
   */
  async processRegistration(params: {
    bankidUser: {
      personalNumber: string;
      name: string;
      givenName: string;
      surname: string;
    };
    email: string;
    phone: string;
    cooperativeId: string;
    apartmentNumber?: string;
    sessionId: string;
    ipAddress: string;
  }) {
    try {
      // Generate verification code and URL
      const verificationCode = generateVerificationCode();
      const verificationUrl = generateVerificationUrl(
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'verification-token' // Would be generated properly
      );

      // Send verification email
      const emailTemplate = getEmailVerificationTemplate({
        firstName: params.bankidUser.givenName,
        verificationCode,
        verificationUrl,
        expiresInMinutes: 15,
      });

      await sendMockEmail(params.email, emailTemplate, {
        email: params.email,
      });

      // Log registration initiation
      await this.auditLogger?.logEvent({
        eventType: BankIDEventType.AUTH_COMPLETED,
        severity: BankIDEventSeverity.INFO,
        sessionId: params.sessionId,
        cooperativeId: params.cooperativeId,
        personnummer: params.bankidUser.personalNumber,
        ipAddress: params.ipAddress,
        userAgent: '',
        method: 'unknown',
        metadata: {
          registrationType: 'bankid',
          email: params.email,
          apartmentNumber: params.apartmentNumber,
          verificationSent: true,
        },
      });

      return {
        success: true,
        verificationRequired: true,
        message: 'Verifieringsmejl skickat',
      };
    } catch (error: any) {
      await this.auditLogger?.logEvent({
        eventType: BankIDEventType.AUTH_FAILED,
        severity: BankIDEventSeverity.ERROR,
        sessionId: params.sessionId,
        cooperativeId: params.cooperativeId,
        errorCode: 'REGISTRATION_ERROR',
        errorMessage: error.message,
        ipAddress: params.ipAddress,
        userAgent: '',
        method: 'unknown',
        metadata: {
          registrationType: 'bankid',
          email: params.email,
        },
      });

      throw error;
    }
  }

  /**
   * Get authentication statistics
   */
  getAuthStats(cooperativeId?: string) {
    return this.auditLogger?.getAuditStats(cooperativeId);
  }

  /**
   * Search authentication events
   */
  searchAuthEvents(criteria: any) {
    return this.auditLogger?.searchEvents(criteria) || [];
  }
}

/**
 * Default integration service instance
 */
let integrationService: BankIDIntegrationService | null = null;

export function getBankIDIntegrationService(database?: any): BankIDIntegrationService {
  if (!integrationService) {
    integrationService = new BankIDIntegrationService(database);
  }
  return integrationService;
}

/**
 * Middleware factory for BankID route protection
 */
export function createBankIDMiddleware(database?: any) {
  const service = getBankIDIntegrationService(database);

  return {
    /**
     * Rate limiting middleware
     */
    rateLimit: async (req: any, res: any, next: any) => {
      try {
        // Implementation would check rate limits
        // For now, just pass through
        next();
      } catch (error: any) {
        await service.auditLogger?.logRateLimited({
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          attemptCount: 1,
          windowDuration: 900000, // 15 minutes
        });

        res.status(429).json({
          success: false,
          error: 'För många försök. Försök igen senare.',
          retryAfter: 900, // seconds
        });
      }
    },

    /**
     * Security validation middleware
     */
    validateSecurity: async (req: any, res: any, next: any) => {
      try {
        // Basic security checks
        if (!req.headers['user-agent']) {
          await service.auditLogger?.logSecurityViolation({
            violationType: 'MISSING_USER_AGENT',
            description: 'Request missing User-Agent header',
            ipAddress: req.ip,
            userAgent: 'missing',
            sessionId: req.session?.id,
          });

          return res.status(400).json({
            success: false,
            error: 'Ogiltig begäran',
          });
        }

        next();
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Säkerhetsvalidering misslyckades',
        });
      }
    },
  };
}

/**
 * Helper function to extract IP address from request
 */
export function getClientIpAddress(req: any): string {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
}

/**
 * Helper function to extract user agent from request
 */
export function getClientUserAgent(req: any): string {
  return req.get('User-Agent') || 'unknown';
}

/**
 * Helper function for session management
 */
export function getOrCreateSessionId(req: any): string {
  if (req.session?.id) {
    return req.session.id;
  }
  
  if (req.sessionID) {
    return req.sessionID;
  }
  
  // Generate a simple session ID for mock purposes
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}