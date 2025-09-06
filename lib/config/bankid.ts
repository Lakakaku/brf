/**
 * BankID Configuration and Integration Setup
 * Handles both mock and real BankID integration with environment-based configuration
 */

/**
 * BankID environment types
 */
export type BankIDEnvironment = 'mock' | 'test' | 'production';

/**
 * BankID method types
 */
export type BankIDMethod = 'same-device' | 'other-device';

/**
 * BankID configuration interface
 */
export interface BankIDConfig {
  // Environment settings
  environment: BankIDEnvironment;
  enabled: boolean;
  
  // API Configuration
  apiUrl: string;
  certificatePath?: string;
  certificatePassword?: string;
  
  // Mock settings
  mockDelay: number;
  mockSuccessRate: number;
  mockQRRefreshInterval: number;
  
  // Real BankID settings
  timeout: number;
  qrStartToken?: string;
  qrStartSecret?: string;
  
  // Feature flags
  features: {
    sameDevice: boolean;
    otherDevice: boolean;
    autoStart: boolean;
    qrGeneration: boolean;
    biometrics: boolean;
  };
  
  // UI Configuration
  ui: {
    showPersonnummerInput: boolean;
    allowMethodSwitch: boolean;
    showProgress: boolean;
    animateQR: boolean;
    customStyling: boolean;
  };
  
  // Security settings
  security: {
    requireHTTPS: boolean;
    validateCertificates: boolean;
    auditLog: boolean;
    rateLimit: {
      enabled: boolean;
      maxAttempts: number;
      windowMs: number;
    };
  };
  
  // Localization
  locale: 'sv' | 'en';
  
  // Integration hooks
  hooks: {
    onAuthStart?: string; // Webhook URL
    onAuthComplete?: string; // Webhook URL
    onAuthFailed?: string; // Webhook URL
    onAuthCancelled?: string; // Webhook URL
  };
}

/**
 * Default BankID configuration
 */
export const defaultBankIDConfig: BankIDConfig = {
  environment: 'mock',
  enabled: true,
  
  // Mock API URL for development
  apiUrl: process.env.NODE_ENV === 'production' 
    ? 'https://appapi2.bankid.com/rp/v6.0'  // Production
    : 'https://appapi2.test.bankid.com/rp/v6.0', // Test
  
  // Mock settings
  mockDelay: 2000,
  mockSuccessRate: 0.85,
  mockQRRefreshInterval: 1000,
  
  // Real BankID settings
  timeout: 300000, // 5 minutes
  
  // Feature flags
  features: {
    sameDevice: true,
    otherDevice: true,
    autoStart: false,
    qrGeneration: true,
    biometrics: true,
  },
  
  // UI Configuration
  ui: {
    showPersonnummerInput: true,
    allowMethodSwitch: true,
    showProgress: true,
    animateQR: true,
    customStyling: true,
  },
  
  // Security settings
  security: {
    requireHTTPS: process.env.NODE_ENV === 'production',
    validateCertificates: true,
    auditLog: true,
    rateLimit: {
      enabled: true,
      maxAttempts: 5,
      windowMs: 900000, // 15 minutes
    },
  },
  
  // Localization
  locale: 'sv',
  
  // Integration hooks
  hooks: {},
};

/**
 * Load BankID configuration from environment variables
 */
export function loadBankIDConfig(): BankIDConfig {
  const config = { ...defaultBankIDConfig };
  
  // Environment detection
  if (process.env.BANKID_ENVIRONMENT) {
    config.environment = process.env.BANKID_ENVIRONMENT as BankIDEnvironment;
  }
  
  // API Configuration
  if (process.env.BANKID_API_URL) {
    config.apiUrl = process.env.BANKID_API_URL;
  }
  
  if (process.env.BANKID_CERTIFICATE_PATH) {
    config.certificatePath = process.env.BANKID_CERTIFICATE_PATH;
  }
  
  if (process.env.BANKID_CERTIFICATE_PASSWORD) {
    config.certificatePassword = process.env.BANKID_CERTIFICATE_PASSWORD;
  }
  
  // Mock settings
  if (process.env.BANKID_MOCK_DELAY) {
    config.mockDelay = parseInt(process.env.BANKID_MOCK_DELAY, 10);
  }
  
  if (process.env.BANKID_MOCK_SUCCESS_RATE) {
    config.mockSuccessRate = parseFloat(process.env.BANKID_MOCK_SUCCESS_RATE);
  }
  
  // Feature flags
  if (process.env.BANKID_SAME_DEVICE === 'false') {
    config.features.sameDevice = false;
  }
  
  if (process.env.BANKID_OTHER_DEVICE === 'false') {
    config.features.otherDevice = false;
  }
  
  if (process.env.BANKID_AUTO_START === 'true') {
    config.features.autoStart = true;
  }
  
  // Security settings
  if (process.env.BANKID_RATE_LIMIT_MAX_ATTEMPTS) {
    config.security.rateLimit.maxAttempts = parseInt(process.env.BANKID_RATE_LIMIT_MAX_ATTEMPTS, 10);
  }
  
  // Webhook URLs
  if (process.env.BANKID_WEBHOOK_AUTH_START) {
    config.hooks.onAuthStart = process.env.BANKID_WEBHOOK_AUTH_START;
  }
  
  if (process.env.BANKID_WEBHOOK_AUTH_COMPLETE) {
    config.hooks.onAuthComplete = process.env.BANKID_WEBHOOK_AUTH_COMPLETE;
  }
  
  return config;
}

/**
 * Get current BankID configuration
 */
export const bankIDConfig = loadBankIDConfig();

/**
 * Check if BankID is in mock mode
 */
export function isMockMode(): boolean {
  return bankIDConfig.environment === 'mock';
}

/**
 * Check if BankID is enabled
 */
export function isBankIDEnabled(): boolean {
  return bankIDConfig.enabled;
}

/**
 * Get BankID API base URL
 */
export function getBankIDApiUrl(): string {
  return bankIDConfig.apiUrl;
}

/**
 * BankID API endpoints
 */
export const BankIDEndpoints = {
  AUTH: '/auth',
  SIGN: '/sign',
  COLLECT: '/collect',
  CANCEL: '/cancel',
} as const;

/**
 * BankID hint codes for collect responses
 */
export const BankIDHintCodes = {
  OUTSTANDING_TRANSACTION: 'outstandingTransaction',
  NO_CLIENT: 'noClient',
  STARTED: 'started',
  USER_SIGN: 'userSign',
  USER_CANCEL: 'userCancel',
  EXPIRED_TRANSACTION: 'expiredTransaction',
  CERTIFICATE_ERR: 'certificateErr',
  USER_DECLINE: 'userDecline',
  START_FAILED: 'startFailed',
} as const;

/**
 * BankID status codes
 */
export const BankIDStatusCodes = {
  PENDING: 'pending',
  COMPLETE: 'complete',
  FAILED: 'failed',
} as const;

/**
 * Swedish BankID error messages
 */
export const BankIDErrorMessages = {
  INVALID_PARAMETERS: 'Ogiltiga parametrar',
  UNAUTHORIZED: 'Obehörig åtkomst',
  NOT_FOUND: 'Order hittades inte',
  REQUEST_TIMEOUT: 'Begäran tog för lång tid',
  UNSUPPORTED_MEDIA_TYPE: 'Medietyp stöds inte',
  INTERNAL_ERROR: 'Internt fel',
  MAINTENANCE: 'Underhållsläge',
  
  // Client errors
  ALREADY_IN_PROGRESS: 'En legitimering pågår redan',
  INVALID_PERSONAL_NUMBER: 'Ogiltigt personnummer',
  
  // User errors
  USER_CANCEL: 'Användaren avbröt',
  CANCELLED: 'Avbruten',
  START_FAILED: 'Kunde inte starta BankID-appen',
  NO_CLIENT: 'BankID-appen kunde inte hittas',
  EXPIRED_TRANSACTION: 'Tiden löpte ut',
  CERTIFICATE_ERR: 'Certifikatfel',
  USER_DECLINE: 'Användaren avböjde',
} as const;

/**
 * BankID certificate types
 */
export enum BankIDCertificateType {
  TEST = 'test',
  PRODUCTION = 'production',
}

/**
 * Real BankID integration interface
 * Placeholder for future implementation
 */
export interface RealBankIDClient {
  auth(personalNumber: string, endUserIp: string, userVisibleData?: string): Promise<BankIDAuthResponse>;
  collect(orderRef: string): Promise<BankIDCollectResponse>;
  cancel(orderRef: string): Promise<void>;
}

/**
 * BankID authentication response
 */
export interface BankIDAuthResponse {
  orderRef: string;
  autoStartToken?: string;
  qrStartToken?: string;
  qrStartSecret?: string;
}

/**
 * BankID collect response
 */
export interface BankIDCollectResponse {
  orderRef: string;
  status: string;
  hintCode?: string;
  progressStatus?: number;
  completionData?: BankIDCompletionData;
}

/**
 * BankID completion data
 */
export interface BankIDCompletionData {
  user: {
    personalNumber: string;
    name: string;
    givenName: string;
    surname: string;
  };
  device: {
    ipAddress: string;
    uhi?: string;
  };
  cert: {
    notBefore: string;
    notAfter: string;
  };
  signature?: string;
  ocspResponse?: string;
}

/**
 * Mock BankID client implementation
 */
export class MockBankIDClient implements RealBankIDClient {
  private config: BankIDConfig;
  private activeOrders = new Map<string, any>();

  constructor(config: BankIDConfig) {
    this.config = config;
  }

  async auth(personalNumber: string, endUserIp: string, userVisibleData?: string): Promise<BankIDAuthResponse> {
    // Validate input
    if (!personalNumber || personalNumber.length < 10) {
      throw new Error(BankIDErrorMessages.INVALID_PERSONAL_NUMBER);
    }

    const orderRef = this.generateOrderRef();
    const qrStartToken = this.generateQRToken();
    const qrStartSecret = this.generateQRSecret();

    // Store mock order
    this.activeOrders.set(orderRef, {
      personalNumber,
      endUserIp,
      userVisibleData,
      status: 'pending',
      startTime: Date.now(),
      qrStartToken,
      qrStartSecret,
    });

    // Simulate API delay
    await this.delay(this.config.mockDelay * 0.5);

    return {
      orderRef,
      qrStartToken,
      qrStartSecret,
    };
  }

  async collect(orderRef: string): Promise<BankIDCollectResponse> {
    const order = this.activeOrders.get(orderRef);
    
    if (!order) {
      throw new Error(BankIDErrorMessages.NOT_FOUND);
    }

    const now = Date.now();
    const elapsed = now - order.startTime;
    
    // Check for timeout
    if (elapsed > this.config.timeout) {
      order.status = 'failed';
      order.hintCode = BankIDHintCodes.EXPIRED_TRANSACTION;
    }

    // Simulate progression
    if (order.status === 'pending') {
      const progress = Math.min(elapsed / (this.config.timeout * 0.6), 1);
      order.progressStatus = Math.floor(progress * 100);

      if (elapsed > this.config.mockDelay) {
        // Random success/failure based on success rate
        const shouldSucceed = Math.random() < this.config.mockSuccessRate;
        
        if (shouldSucceed) {
          order.status = 'complete';
          order.completionData = this.generateCompletionData(order.personalNumber);
        } else {
          order.status = 'failed';
          order.hintCode = this.getRandomErrorCode();
        }
      } else if (elapsed > this.config.mockDelay * 0.7) {
        order.hintCode = BankIDHintCodes.USER_SIGN;
      } else {
        order.hintCode = BankIDHintCodes.OUTSTANDING_TRANSACTION;
      }
    }

    // Simulate API delay
    await this.delay(200);

    const response: BankIDCollectResponse = {
      orderRef,
      status: order.status,
      hintCode: order.hintCode,
      progressStatus: order.progressStatus,
    };

    if (order.status === 'complete') {
      response.completionData = order.completionData;
      this.activeOrders.delete(orderRef); // Clean up
    }

    return response;
  }

  async cancel(orderRef: string): Promise<void> {
    const order = this.activeOrders.get(orderRef);
    
    if (order) {
      order.status = 'failed';
      order.hintCode = BankIDHintCodes.USER_CANCEL;
      this.activeOrders.delete(orderRef);
    }

    await this.delay(100);
  }

  private generateOrderRef(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  private generateQRToken(): string {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  private generateQRSecret(): string {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  private generateCompletionData(personalNumber: string): BankIDCompletionData {
    // Mock Swedish names
    const names = [
      { given: 'Anna', surname: 'Andersson' },
      { given: 'Erik', surname: 'Eriksson' },
      { given: 'Maria', surname: 'Johansson' },
      { given: 'Lars', surname: 'Larsson' },
      { given: 'Ingrid', surname: 'Nilsson' },
    ];
    
    const name = names[Math.floor(Math.random() * names.length)];
    
    return {
      user: {
        personalNumber,
        name: `${name.given} ${name.surname}`,
        givenName: name.given,
        surname: name.surname,
      },
      device: {
        ipAddress: '192.168.1.100',
        uhi: 'mock-device-identifier',
      },
      cert: {
        notBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      signature: 'mock-signature-data',
      ocspResponse: 'mock-ocsp-response',
    };
  }

  private getRandomErrorCode(): string {
    const errorCodes = [
      BankIDHintCodes.USER_CANCEL,
      BankIDHintCodes.EXPIRED_TRANSACTION,
      BankIDHintCodes.CERTIFICATE_ERR,
      BankIDHintCodes.START_FAILED,
      BankIDHintCodes.NO_CLIENT,
    ];
    
    return errorCodes[Math.floor(Math.random() * errorCodes.length)];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create BankID client based on configuration
 */
export function createBankIDClient(config: BankIDConfig = bankIDConfig): RealBankIDClient {
  if (config.environment === 'mock') {
    return new MockBankIDClient(config);
  }
  
  // TODO: Implement real BankID client when ready for production
  throw new Error('Real BankID client not yet implemented. Use mock mode for development.');
}

/**
 * Generate QR code data for BankID
 */
export function generateBankIDQRData(qrStartToken: string, qrStartSecret: string, time: number = Date.now()): string {
  const qrTime = Math.floor(time / 1000);
  const qrAuthData = `bankid.${qrStartToken}.${qrTime}.${qrStartSecret}`;
  return qrAuthData;
}

/**
 * Validate BankID configuration
 */
export function validateBankIDConfig(config: BankIDConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.apiUrl) {
    errors.push('API URL is required');
  }

  if (config.environment === 'production' && !config.certificatePath) {
    errors.push('Certificate path is required for production');
  }

  if (config.security.rateLimit.maxAttempts < 1) {
    errors.push('Rate limit max attempts must be greater than 0');
  }

  if (config.timeout < 30000) {
    errors.push('Timeout must be at least 30 seconds');
  }

  if (config.mockSuccessRate < 0 || config.mockSuccessRate > 1) {
    errors.push('Mock success rate must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get BankID configuration status for admin panel
 */
export function getBankIDStatus() {
  const validation = validateBankIDConfig(bankIDConfig);
  
  return {
    enabled: bankIDConfig.enabled,
    environment: bankIDConfig.environment,
    features: bankIDConfig.features,
    validation,
    endpoints: {
      apiUrl: bankIDConfig.apiUrl,
      webhooks: Object.keys(bankIDConfig.hooks).length,
    },
  };
}