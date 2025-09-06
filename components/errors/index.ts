/**
 * Error Management Components for BRF Portal
 * Swedish localized error logging and management system
 */

export { default as ErrorFilters } from './ErrorFilters';
export type { ErrorFilterOptions } from './ErrorFilters';

export { default as ErrorDetailDialog } from './ErrorDetailDialog';
export type { ErrorLogDetail } from './ErrorDetailDialog';

// Export types for external use
export interface ErrorLog {
  id: number;
  errorId: string;
  correlationId?: string;
  errorLevel: 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'fatal';
  errorCategory: string;
  errorSubcategory?: string;
  brfContext?: string;
  errorMessage: string;
  errorMessageSv?: string;
  errorCode?: string;
  stackTrace?: string;
  endpoint?: string;
  userId?: string;
  userRole?: string;
  apartmentId?: string;
  caseId?: string;
  occurrenceCount: number;
  firstOccurrenceAt: string;
  lastOccurrenceAt: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  impactAssessment?: string;
  affectsOperations: boolean;
  affectsMembers: boolean;
  createdAt: string;
}

export interface ErrorMetrics {
  totalErrors: number;
  uniqueErrors: number;
  criticalErrors: number;
  resolvedErrors: number;
  errorRate: number;
  avgResolutionTime: number;
  categoryBreakdown: Record<string, number>;
  brfContextBreakdown: Record<string, number>;
}

export interface ErrorPattern {
  id: string;
  patternHash: string;
  patternName: string;
  errorSignature: string;
  errorCategory: string;
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isTrending: boolean;
}

// BRF-specific error categories
export const BRF_ERROR_CATEGORIES = {
  AUTH: 'auth',
  VALIDATION: 'validation', 
  DATABASE: 'database',
  NETWORK: 'network',
  PAYMENT: 'payment',
  DOCUMENT: 'document',
  BOOKING: 'booking',
  MEMBER_MANAGEMENT: 'member_management',
  INVOICE: 'invoice',
  CASE_MANAGEMENT: 'case_management',
  ENERGY: 'energy',
  CONTRACTOR: 'contractor',
  BOARD_MEETING: 'board_meeting',
  QUEUE: 'queue',
  LOAN: 'loan',
  SYSTEM: 'system',
  EXTERNAL_API: 'external_api',
  PERFORMANCE: 'performance',
  SECURITY: 'security'
} as const;

// BRF-specific contexts
export const BRF_CONTEXTS = {
  MONTHLY_FEES: 'monthly_fees',
  ANNUAL_REPORT: 'annual_report',
  ENERGY_DECLARATION: 'energy_declaration',
  BOARD_ELECTION: 'board_election',
  MAINTENANCE_CASE: 'maintenance_case',
  CONTRACTOR_EVALUATION: 'contractor_evaluation',
  BOOKING_SYSTEM: 'booking_system',
  MEMBER_REGISTRATION: 'member_registration',
  PAYMENT_PROCESSING: 'payment_processing',
  DOCUMENT_APPROVAL: 'document_approval',
  MEETING_PROTOCOL: 'meeting_protocol',
  QUEUE_MANAGEMENT: 'queue_management',
  LOAN_TRACKING: 'loan_tracking',
  AUDIT_TRAIL: 'audit_trail',
  TAX_REPORTING: 'tax_reporting',
  INSURANCE_CLAIM: 'insurance_claim',
  RENOVATION_PROJECT: 'renovation_project',
  UTILITY_BILLING: 'utility_billing'
} as const;

// Error levels
export const ERROR_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
  FATAL: 'fatal'
} as const;

// Priority levels
export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
} as const;