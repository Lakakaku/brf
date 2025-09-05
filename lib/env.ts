/**
 * Environment Variables Configuration and Validation
 *
 * This module provides type-safe access to environment variables with
 * validation, defaults, and proper error handling for the BRF Portal.
 *
 * Swedish BRF (Bostadsrättsförening) housing cooperative management platform.
 */

import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const requiredString = z.string().min(1, 'Required string cannot be empty');
const optionalString = z.string().optional();
const requiredNumber = z.coerce.number().min(0);
const optionalNumber = z.coerce.number().min(0).optional();
const booleanString = z
  .enum(['true', 'false'])
  .transform(val => val === 'true');
const optionalBooleanString = z
  .enum(['true', 'false'])
  .transform(val => val === 'true')
  .optional();

// Environment types
const environmentSchema = z.enum(['development', 'staging', 'production']);

// Database URL validation with different patterns for different databases
const databaseUrlSchema = z.string().refine(
  url => {
    // SQLite pattern
    if (url.startsWith('file:')) return true;
    // PostgreSQL pattern
    if (url.match(/^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+/)) return true;
    return false;
  },
  { message: 'Invalid database URL format' }
);

// API Key validation (basic format checking)
const apiKeySchema = z.string().min(10, 'API key too short').optional();

// URL validation
const urlSchema = z.string().url().optional();

// Swedish organization number validation (10 digits, format: XXXXXXXXXX)
const orgNumberSchema = z
  .string()
  .regex(/^\d{10}$/, 'Invalid Swedish organization number')
  .optional();

// Swedish phone number validation
const phoneSchema = z
  .string()
  .regex(/^\+46[0-9]{8,9}$/, 'Invalid Swedish phone number format')
  .optional();

// Email validation
const emailSchema = z.string().email().optional();

// =============================================================================
// MAIN ENVIRONMENT SCHEMA
// =============================================================================

const envSchema = z.object({
  // Environment Configuration
  NODE_ENV: environmentSchema.default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('BRF Portal'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  DEBUG: booleanString.default(true),

  // Database Configuration
  DATABASE_URL: databaseUrlSchema.default('file:./database/brf_portal.db'),
  DATABASE_POOL_MIN: optionalNumber.default(2),
  DATABASE_POOL_MAX: optionalNumber.default(10),
  DATABASE_POOL_TIMEOUT: optionalNumber.default(30),
  DATABASE_LOG_QUERIES: optionalBooleanString.default(false),
  DATABASE_BACKUP_ENABLED: optionalBooleanString.default(false),
  DATABASE_BACKUP_SCHEDULE: optionalString,
  DATABASE_BACKUP_RETENTION_DAYS: optionalNumber.default(30),

  // Authentication & Session
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: requiredString.min(
    32,
    'NextAuth secret must be at least 32 characters'
  ),
  SESSION_TIMEOUT: optionalNumber.default(86400),
  REFRESH_TOKEN_EXPIRY: optionalNumber.default(604800),

  // Password Requirements
  PASSWORD_MIN_LENGTH: optionalNumber.default(8),
  PASSWORD_REQUIRE_UPPERCASE: optionalBooleanString.default(true),
  PASSWORD_REQUIRE_LOWERCASE: optionalBooleanString.default(true),
  PASSWORD_REQUIRE_NUMBERS: optionalBooleanString.default(true),
  PASSWORD_REQUIRE_SYMBOLS: optionalBooleanString.default(true),

  // Swedish BankID Integration
  BANKID_ENABLED: optionalBooleanString.default(false),
  BANKID_ENVIRONMENT: z.enum(['test', 'production']).default('test'),
  BANKID_API_URL: urlSchema,
  BANKID_CLIENT_CERT_PATH: optionalString,
  BANKID_CLIENT_CERT_PASSWORD: optionalString,
  BANKID_CA_CERT_PATH: optionalString,
  BANKID_TIMEOUT_SECONDS: optionalNumber.default(60),
  BANKID_MAX_RETRIES: optionalNumber.default(3),

  // Fallback Auth
  ENABLE_EMAIL_AUTH: optionalBooleanString.default(true),
  ENABLE_TEST_USERS: optionalBooleanString.default(true),

  // External APIs
  OPENAI_API_KEY: apiKeySchema,
  OPENAI_MODEL: z.string().default('gpt-4'),
  OPENAI_MAX_TOKENS: optionalNumber.default(4000),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),

  ANTHROPIC_API_KEY: apiKeySchema,
  GOOGLE_AI_API_KEY: apiKeySchema,

  // OCR Service
  OCR_SERVICE_URL: urlSchema,
  OCR_API_KEY: apiKeySchema,

  // Swedish Business Integrations
  FORTNOX_API_URL: urlSchema.default('https://api.fortnox.se/3'),
  FORTNOX_CLIENT_SECRET: apiKeySchema,
  FORTNOX_ACCESS_TOKEN: apiKeySchema,

  VISMA_API_URL: urlSchema.default('https://eaccountingapi.vismaonline.com/v2'),
  VISMA_CLIENT_ID: apiKeySchema,
  VISMA_CLIENT_SECRET: apiKeySchema,
  VISMA_REDIRECT_URI: urlSchema,

  KIVRA_API_URL: urlSchema.default('https://api.kivra.com/v1'),
  KIVRA_API_KEY: apiKeySchema,
  KIVRA_SENDER_ID: optionalString,

  BOLAGSVERKET_API_URL: urlSchema.default('https://api.bolagsverket.se/v1'),
  BOLAGSVERKET_API_KEY: apiKeySchema,

  // Payment & Banking
  STRIPE_PUBLISHABLE_KEY: apiKeySchema,
  STRIPE_SECRET_KEY: apiKeySchema,
  STRIPE_WEBHOOK_SECRET: apiKeySchema,

  SWISH_API_URL: urlSchema,
  SWISH_MERCHANT_ID: optionalString,
  SWISH_CLIENT_CERT_PATH: optionalString,
  SWISH_CLIENT_CERT_PASSWORD: optionalString,

  BANKGIROT_API_URL: urlSchema,
  BANKGIROT_CUSTOMER_ID: optionalString,
  BANKGIROT_API_KEY: apiKeySchema,

  AUTOGIRO_CUSTOMER_NUMBER: optionalString,
  AUTOGIRO_BANK_ACCOUNT: optionalString,

  // File Storage
  AWS_REGION: z.string().default('eu-north-1'),
  AWS_ACCESS_KEY_ID: apiKeySchema,
  AWS_SECRET_ACCESS_KEY: apiKeySchema,
  AWS_S3_BUCKET: optionalString.default('brf-portal-documents'),
  AWS_S3_BUCKET_REGION: z.string().default('eu-north-1'),

  LOCAL_STORAGE_PATH: z.string().default('./storage/uploads'),
  LOCAL_STORAGE_MAX_SIZE: z.string().default('100MB'),

  MAX_FILE_SIZE: z.string().default('50MB'),
  MAX_TOTAL_SIZE: z.string().default('500MB'),
  ALLOWED_FILE_TYPES: z
    .string()
    .default('pdf,jpg,jpeg,png,doc,docx,xls,xlsx,txt'),

  DOCUMENT_QUEUE_ENABLED: optionalBooleanString.default(true),
  DOCUMENT_PROCESSING_TIMEOUT: optionalNumber.default(300),

  // Email Services
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalNumber.default(587),
  SMTP_SECURE: optionalBooleanString.default(false),
  SMTP_USER: emailSchema,
  SMTP_PASS: optionalString,

  SENDGRID_API_KEY: apiKeySchema,
  MAILGUN_API_KEY: apiKeySchema,
  MAILGUN_DOMAIN: optionalString,

  FROM_EMAIL: emailSchema.default('noreply@brfportal.se'),
  FROM_NAME: z.string().default('BRF Portal'),
  REPLY_TO_EMAIL: emailSchema.default('support@brfportal.se'),

  EMAIL_TEMPLATE_DIR: z.string().default('./templates/email'),
  EMAIL_BASE_URL: urlSchema,

  // SMS & Notifications
  SMS_PROVIDER: z.enum(['46elks', 'twilio']).default('46elks'),
  SMS_API_URL: urlSchema,
  SMS_API_USERNAME: optionalString,
  SMS_API_PASSWORD: optionalString,
  SMS_FROM_NUMBER: optionalString.default('BRFPortal'),

  TWILIO_ACCOUNT_SID: apiKeySchema,
  TWILIO_AUTH_TOKEN: apiKeySchema,
  TWILIO_PHONE_NUMBER: phoneSchema,

  // Firebase for push notifications
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_PRIVATE_KEY_ID: optionalString,
  FIREBASE_PRIVATE_KEY: optionalString,
  FIREBASE_CLIENT_EMAIL: emailSchema,
  FIREBASE_CLIENT_ID: optionalString,

  // Energy APIs
  SALLY_R_API_KEY: apiKeySchema,
  SALLY_R_API_URL: urlSchema,
  ELIQ_API_KEY: apiKeySchema,
  ELIQ_API_URL: urlSchema,
  SMHI_API_URL: urlSchema.default(
    'https://opendata-download-metobs.smhi.se/api'
  ),
  NORDPOOL_API_URL: urlSchema.default('https://www.nordpoolgroup.com/api'),

  // Caching & Performance
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: optionalString,
  REDIS_DB: optionalNumber.default(0),

  CACHE_TTL_DEFAULT: optionalNumber.default(3600),
  CACHE_TTL_STATIC: optionalNumber.default(86400),
  CACHE_TTL_DYNAMIC: optionalNumber.default(300),

  RATE_LIMIT_WINDOW: optionalNumber.default(900),
  RATE_LIMIT_MAX: optionalNumber.default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL: optionalBooleanString.default(true),

  // Monitoring & Logging
  SENTRY_DSN: urlSchema,
  SENTRY_ENVIRONMENT: environmentSchema.default('development'),
  SENTRY_TRACE_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),
  LOG_FILE_ENABLED: optionalBooleanString.default(false),
  LOG_FILE_PATH: z.string().default('./logs/app.log'),
  LOG_FILE_MAX_SIZE: z.string().default('10MB'),
  LOG_FILE_MAX_FILES: optionalNumber.default(5),

  PERFORMANCE_MONITORING_ENABLED: optionalBooleanString.default(false),
  SLOW_QUERY_THRESHOLD: optionalNumber.default(1000),

  // Security
  ENCRYPTION_KEY: requiredString.min(
    32,
    'Encryption key must be at least 32 characters'
  ),
  JWT_SIGNING_KEY: requiredString.min(
    32,
    'JWT signing key must be at least 32 characters'
  ),

  CSRF_SECRET: optionalString,
  CSRF_COOKIE_NAME: z.string().default('csrf-token'),

  CSP_ENABLED: optionalBooleanString.default(true),
  CSP_REPORT_URI: z.string().default('/api/security/csp-report'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: optionalBooleanString.default(true),

  HSTS_MAX_AGE: optionalNumber.default(31536000),
  HSTS_INCLUDE_SUBDOMAINS: optionalBooleanString.default(true),

  // GDPR & Compliance
  GDPR_DATA_RETENTION_DEFAULT: optionalNumber.default(2555), // 7 years
  GDPR_LOG_RETENTION: optionalNumber.default(90),
  GDPR_SESSION_RETENTION: optionalNumber.default(30),

  COOKIE_CONSENT_REQUIRED: optionalBooleanString.default(true),
  ANALYTICS_ENABLED: optionalBooleanString.default(false),

  DATA_EXPORT_ENABLED: optionalBooleanString.default(true),
  DATA_DELETION_ENABLED: optionalBooleanString.default(true),
  DATA_ANONYMIZATION_ENABLED: optionalBooleanString.default(true),

  // Testing & Development
  TEST_DATABASE_URL: z.string().default('file:./database/test.db'),

  MOCK_BANKID: optionalBooleanString.default(true),
  MOCK_EMAIL: optionalBooleanString.default(true),
  MOCK_SMS: optionalBooleanString.default(true),
  MOCK_PAYMENT: optionalBooleanString.default(true),
  MOCK_EXTERNAL_APIS: optionalBooleanString.default(true),

  STORYBOOK_ENABLED: optionalBooleanString.default(false),
  API_DOCS_ENABLED: optionalBooleanString.default(true),
  DEBUG_TOOLBAR_ENABLED: optionalBooleanString.default(false),

  SEED_TEST_USERS: optionalBooleanString.default(false),
  SEED_TEST_COOPERATIVES: optionalBooleanString.default(false),
  SEED_TEST_DOCUMENTS: optionalBooleanString.default(false),

  // Deployment & Infrastructure
  DEPLOYMENT_ENV: environmentSchema.default('development'),
  DEPLOYMENT_REGION: z.string().default('eu-north-1'),
  DEPLOYMENT_VERSION: z.string().default('1.0.0'),

  HEALTH_CHECK_ENABLED: optionalBooleanString.default(true),
  HEALTH_CHECK_ENDPOINT: z.string().default('/api/health'),
  HEALTH_CHECK_TIMEOUT: optionalNumber.default(5000),

  AUTO_SCALE_MIN_INSTANCES: optionalNumber.default(1),
  AUTO_SCALE_MAX_INSTANCES: optionalNumber.default(10),
  AUTO_SCALE_TARGET_CPU: optionalNumber.default(70),

  BACKUP_ENABLED: optionalBooleanString.default(false),
  BACKUP_SCHEDULE: optionalString,
  BACKUP_S3_BUCKET: optionalString,
  BACKUP_RETENTION_DAYS: optionalNumber.default(90),

  // Feature Flags
  FEATURE_BANKID_AUTH: optionalBooleanString.default(false),
  FEATURE_AI_PROCESSING: optionalBooleanString.default(false),
  FEATURE_PAYMENT_PROCESSING: optionalBooleanString.default(false),
  FEATURE_EMAIL_NOTIFICATIONS: optionalBooleanString.default(true),
  FEATURE_SMS_NOTIFICATIONS: optionalBooleanString.default(false),

  FEATURE_ENERGY_OPTIMIZATION: optionalBooleanString.default(false),
  FEATURE_ADVANCED_ANALYTICS: optionalBooleanString.default(false),
  FEATURE_WHITE_LABEL: optionalBooleanString.default(false),
  FEATURE_API_ACCESS: optionalBooleanString.default(false),

  // API Quotas
  API_RATE_LIMIT_PER_HOUR: optionalNumber.default(1000),
  API_RATE_LIMIT_PER_DAY: optionalNumber.default(10000),

  OPENAI_MONTHLY_QUOTA: optionalNumber.default(1000000),
  BANKID_MONTHLY_QUOTA: optionalNumber.default(5000),
  SMS_MONTHLY_QUOTA: optionalNumber.default(1000),

  // Multi-tenant
  MULTI_TENANT_MODE: optionalBooleanString.default(true),
  DEFAULT_TENANT_FEATURES: z.string().default('["standard"]'),
  MAX_TENANTS_PER_INSTANCE: optionalNumber.default(1000),

  ENABLE_SUBDOMAIN_ROUTING: optionalBooleanString.default(false),
  BASE_DOMAIN: optionalString,
  WILDCARD_DOMAIN: optionalString,

  // Localization
  DEFAULT_LOCALE: z.string().default('sv-SE'),
  SUPPORTED_LOCALES: z.string().default('sv-SE,en-US,fi-FI,da-DK,no-NO'),
  DEFAULT_CURRENCY: z.string().default('SEK'),
  DATE_FORMAT: z.string().default('YYYY-MM-DD'),
  TIME_FORMAT: z.string().default('HH:mm'),

  TRANSLATION_API_KEY: apiKeySchema,
  AUTO_TRANSLATE_ENABLED: optionalBooleanString.default(false),
});

// =============================================================================
// ENVIRONMENT VALIDATION AND EXPORT
// =============================================================================

/**
 * Validates and parses environment variables
 */
function validateEnv(): z.infer<typeof envSchema> {
  try {
    const parsed = envSchema.parse(process.env);

    // Additional validation logic
    validateConditionalRequirements(parsed);

    return parsed;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Validates conditional requirements between environment variables
 */
function validateConditionalRequirements(env: z.infer<typeof envSchema>) {
  // BankID validation
  if (env.BANKID_ENABLED) {
    if (!env.BANKID_CLIENT_CERT_PATH || !env.BANKID_CLIENT_CERT_PASSWORD) {
      throw new Error(
        'BankID is enabled but certificate configuration is missing'
      );
    }
  }

  // Production environment validations
  if (env.NODE_ENV === 'production') {
    const requiredInProduction = [
      'NEXTAUTH_SECRET',
      'ENCRYPTION_KEY',
      'JWT_SIGNING_KEY',
    ];

    for (const key of requiredInProduction) {
      if (!env[key as keyof typeof env]) {
        throw new Error(`${key} is required in production environment`);
      }
    }

    // Warn about mock services in production
    if (env.MOCK_BANKID || env.MOCK_EMAIL || env.MOCK_SMS) {
      console.warn('WARNING: Mock services are enabled in production');
    }
  }

  // Payment processing validation
  if (env.FEATURE_PAYMENT_PROCESSING) {
    if (!env.BANKGIROT_API_KEY && !env.STRIPE_SECRET_KEY) {
      throw new Error(
        'Payment processing is enabled but no payment provider is configured'
      );
    }
  }

  // Email validation
  if (env.FEATURE_EMAIL_NOTIFICATIONS && !env.MOCK_EMAIL) {
    if (!env.SMTP_HOST && !env.SENDGRID_API_KEY && !env.MAILGUN_API_KEY) {
      throw new Error(
        'Email notifications enabled but no email service configured'
      );
    }
  }

  // SMS validation
  if (env.FEATURE_SMS_NOTIFICATIONS && !env.MOCK_SMS) {
    if (!env.SMS_API_USERNAME && !env.TWILIO_ACCOUNT_SID) {
      throw new Error(
        'SMS notifications enabled but no SMS service configured'
      );
    }
  }
}

/**
 * Environment configuration object with type safety
 */
let env: z.infer<typeof envSchema>;

try {
  env = validateEnv();
} catch (error: any) {
  // In development, provide fallback values
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    console.warn('Using fallback environment values for development');
    env = {
      NODE_ENV: 'development',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET:
        'development-secret-key-minimum-32-characters-long-for-security',
      ENCRYPTION_KEY: 'development-encryption-key-32-chars',
      JWT_SIGNING_KEY: 'development-jwt-signing-key-32-chars',
      // Add other required fields with defaults
    } as z.infer<typeof envSchema>;
  } else {
    throw error;
  }
}

/**
 * Utility functions for environment-specific logic
 */
export const EnvUtils = {
  isDevelopment: () => env.NODE_ENV === 'development',
  isStaging: () => env.NODE_ENV === 'staging',
  isProduction: () => env.NODE_ENV === 'production',

  isBankIdEnabled: () => env.BANKID_ENABLED && !env.MOCK_BANKID,
  isAiEnabled: () => env.FEATURE_AI_PROCESSING && !!env.OPENAI_API_KEY,
  isPaymentEnabled: () => env.FEATURE_PAYMENT_PROCESSING,

  getDbUrl: () =>
    env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL,

  shouldMockService: (
    service: 'bankid' | 'email' | 'sms' | 'payment' | 'apis'
  ) => {
    switch (service) {
      case 'bankid':
        return env.MOCK_BANKID;
      case 'email':
        return env.MOCK_EMAIL;
      case 'sms':
        return env.MOCK_SMS;
      case 'payment':
        return env.MOCK_PAYMENT;
      case 'apis':
        return env.MOCK_EXTERNAL_APIS;
      default:
        return false;
    }
  },

  getApiQuota: (service: 'openai' | 'bankid' | 'sms') => {
    switch (service) {
      case 'openai':
        return env.OPENAI_MONTHLY_QUOTA;
      case 'bankid':
        return env.BANKID_MONTHLY_QUOTA;
      case 'sms':
        return env.SMS_MONTHLY_QUOTA;
      default:
        return 0;
    }
  },
};

/**
 * Type-safe environment configuration
 */
export type Environment = typeof env;

/**
 * Export validated environment variables
 */
export { env };

/**
 * Default export for convenience
 */
export default env;
