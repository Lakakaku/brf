/**
 * BRF Portal Library Exports
 * Central export point for all library functionality
 */

// Swedish utilities
export * from './utils/swedish';

// BankID configuration and client
export * from './config/bankid';

// Email templates and utilities
export * from './email/templates';

// BankID audit logging
export * from './audit/bankid';

// BankID integration service
export * from './auth/bankid-integration';

// Feature flags system
export * from './features';

// Re-export commonly used types
export type {
  PersonnummerInfo,
  SwedishPhoneInfo,
  BankIDConfig,
  BankIDAuthResponse,
  BankIDCollectResponse,
  BankIDCompletionData,
  BankIDAuditEvent,
  BankIDAuditStats,
  EmailTemplate,
  EmailTemplateData,
  MockEmailResult,
} from './utils/swedish';