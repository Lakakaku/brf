import { getDatabase } from '../database/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Error Logger Service for BRF Portal
 * Provides comprehensive error logging with Swedish BRF context
 */

export interface ErrorLogEntry {
  id?: string;
  correlationId?: string;
  errorLevel: 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'fatal';
  errorCategory: 
    | 'auth' | 'validation' | 'database' | 'network' | 'payment' | 'document'
    | 'booking' | 'member_management' | 'invoice' | 'case_management' 
    | 'energy' | 'contractor' | 'board_meeting' | 'queue' | 'loan'
    | 'system' | 'external_api' | 'performance' | 'security';
  errorSubcategory?: string;
  brfContext?: 
    | 'monthly_fees' | 'annual_report' | 'energy_declaration' | 'board_election'
    | 'maintenance_case' | 'contractor_evaluation' | 'booking_system'
    | 'member_registration' | 'payment_processing' | 'document_approval'
    | 'meeting_protocol' | 'queue_management' | 'loan_tracking' | 'audit_trail'
    | 'tax_reporting' | 'insurance_claim' | 'renovation_project' | 'utility_billing';
  
  errorMessage: string;
  errorMessageSv?: string; // Swedish translation
  errorCode?: string;
  
  stackTrace?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceFunction?: string;
  
  // Request context
  requestId?: string;
  sessionId?: string;
  endpoint?: string;
  httpMethod?: string;
  requestUrl?: string;
  
  // User context
  cooperativeId?: string;
  userId?: string;
  userRole?: string;
  userAgent?: string;
  ipAddress?: string;
  
  // Related entities
  apartmentId?: string;
  invoiceId?: string;
  caseId?: string;
  memberId?: string;
  documentId?: string;
  meetingId?: string;
  
  // Additional metadata
  environment?: 'development' | 'staging' | 'production';
  applicationVersion?: string;
  browserInfo?: Record<string, any>;
  additionalData?: Record<string, any>;
  tags?: string[];
  
  // Priority and impact
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  impactAssessment?: 'no_impact' | 'minor' | 'moderate' | 'significant' | 'critical';
  affectsOperations?: boolean;
  affectsMembers?: boolean;
  
  // Compliance flags
  gdprRelevant?: boolean;
  auditRequired?: boolean;
  regulatoryImpact?: string;
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

export class ErrorLogger {
  private cooperativeId: string;
  private environment: string;
  private applicationVersion: string;
  
  constructor(
    cooperativeId: string, 
    environment = 'production',
    applicationVersion = '1.0.0'
  ) {
    this.cooperativeId = cooperativeId;
    this.environment = environment;
    this.applicationVersion = applicationVersion;
  }
  
  /**
   * Log an error with full context
   */
  async logError(entry: ErrorLogEntry): Promise<string> {
    const db = getDatabase();
    const errorId = uuidv4();
    const now = new Date().toISOString();
    
    try {
      const stmt = db.prepare(`
        INSERT INTO error_logs (
          error_id, cooperative_id, correlation_id, error_level, error_category,
          error_subcategory, brf_context, error_message, error_message_sv, error_code,
          stack_trace, source_file, source_line, source_function,
          request_id, session_id, endpoint, http_method, request_url,
          user_id, user_role, user_agent, ip_address,
          apartment_id, invoice_id, case_id, member_id, document_id, meeting_id,
          environment, application_version, browser_info, additional_data, tags,
          priority, impact_assessment, affects_operations, affects_members,
          gdpr_relevant, audit_required, regulatory_impact,
          first_occurrence_at, last_occurrence_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      
      stmt.run(
        errorId,
        entry.cooperativeId || this.cooperativeId,
        entry.correlationId,
        entry.errorLevel,
        entry.errorCategory,
        entry.errorSubcategory,
        entry.brfContext,
        entry.errorMessage,
        entry.errorMessageSv,
        entry.errorCode,
        entry.stackTrace,
        entry.sourceFile,
        entry.sourceLine,
        entry.sourceFunction,
        entry.requestId,
        entry.sessionId,
        entry.endpoint,
        entry.httpMethod,
        entry.requestUrl,
        entry.userId,
        entry.userRole,
        entry.userAgent,
        entry.ipAddress,
        entry.apartmentId,
        entry.invoiceId,
        entry.caseId,
        entry.memberId,
        entry.documentId,
        entry.meetingId,
        entry.environment || this.environment,
        entry.applicationVersion || this.applicationVersion,
        JSON.stringify(entry.browserInfo || {}),
        JSON.stringify(entry.additionalData || {}),
        JSON.stringify(entry.tags || []),
        entry.priority || 'medium',
        entry.impactAssessment,
        entry.affectsOperations ? 1 : 0,
        entry.affectsMembers ? 1 : 0,
        entry.gdprRelevant ? 1 : 0,
        entry.auditRequired ? 1 : 0,
        entry.regulatoryImpact,
        now,
        now
      );
      
      return errorId;
    } catch (error) {
      console.error('Failed to log error to database:', error);
      // Fallback to console logging
      console.error('Original error:', entry);
      throw error;
    }
  }
  
  /**
   * Quick logging methods for common scenarios
   */
  async critical(message: string, context?: Partial<ErrorLogEntry>): Promise<string> {
    return this.logError({
      errorLevel: 'critical',
      errorCategory: 'system',
      errorMessage: message,
      priority: 'urgent',
      impactAssessment: 'critical',
      affectsOperations: true,
      auditRequired: true,
      ...context
    });
  }
  
  async error(message: string, context?: Partial<ErrorLogEntry>): Promise<string> {
    return this.logError({
      errorLevel: 'error',
      errorCategory: 'system',
      errorMessage: message,
      priority: 'high',
      impactAssessment: 'moderate',
      ...context
    });
  }
  
  async warning(message: string, context?: Partial<ErrorLogEntry>): Promise<string> {
    return this.logError({
      errorLevel: 'warning',
      errorCategory: 'system',
      errorMessage: message,
      priority: 'medium',
      impactAssessment: 'minor',
      ...context
    });
  }
  
  async info(message: string, context?: Partial<ErrorLogEntry>): Promise<string> {
    return this.logError({
      errorLevel: 'info',
      errorCategory: 'system',
      errorMessage: message,
      priority: 'low',
      impactAssessment: 'no_impact',
      ...context
    });
  }
  
  /**
   * BRF-specific error logging methods
   */
  async logPaymentError(message: string, context?: Partial<ErrorLogEntry>): Promise<string> {
    return this.logError({
      errorLevel: 'error',
      errorCategory: 'payment',
      brfContext: 'payment_processing',
      errorMessage: message,
      errorMessageSv: this.translatePaymentError(message),
      priority: 'high',
      impactAssessment: 'significant',
      affectsMembers: true,
      auditRequired: true,
      ...context
    });
  }
  
  async logDocumentError(message: string, context?: Partial<ErrorLogEntry>): Promise<string> {
    return this.logError({
      errorLevel: 'error',
      errorCategory: 'document',
      brfContext: 'document_approval',
      errorMessage: message,
      errorMessageSv: this.translateDocumentError(message),
      priority: 'medium',
      impactAssessment: 'moderate',
      affectsOperations: true,
      ...context
    });
  }
  
  async logMemberError(message: string, context?: Partial<ErrorLogEntry>): Promise<string> {
    return this.logError({
      errorLevel: 'error',
      errorCategory: 'member_management',
      brfContext: 'member_registration',
      errorMessage: message,
      errorMessageSv: this.translateMemberError(message),
      priority: 'high',
      impactAssessment: 'significant',
      affectsMembers: true,
      gdprRelevant: true,
      ...context
    });
  }
  
  async logBookingError(message: string, context?: Partial<ErrorLogEntry>): Promise<string> {
    return this.logError({
      errorLevel: 'error',
      errorCategory: 'booking',
      brfContext: 'booking_system',
      errorMessage: message,
      errorMessageSv: this.translateBookingError(message),
      priority: 'medium',
      impactAssessment: 'moderate',
      affectsMembers: true,
      ...context
    });
  }
  
  /**
   * Get error patterns and metrics
   */
  async getErrorPatterns(
    limit = 50, 
    category?: string,
    timeframe = '7 days'
  ): Promise<ErrorPattern[]> {
    const db = getDatabase();
    
    let query = `
      SELECT 
        id, pattern_hash, pattern_name, error_signature, error_category,
        occurrence_count, first_seen_at, last_seen_at, is_trending
      FROM error_patterns 
      WHERE cooperative_id = ? 
        AND last_seen_at > datetime('now', '-${timeframe}')
    `;
    
    const params: any[] = [this.cooperativeId];
    
    if (category) {
      query += ' AND error_category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY occurrence_count DESC LIMIT ?';
    params.push(limit);
    
    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    
    return rows.map(row => ({
      id: row.id,
      patternHash: row.pattern_hash,
      patternName: row.pattern_name,
      errorSignature: row.error_signature,
      errorCategory: row.error_category,
      occurrenceCount: row.occurrence_count,
      firstSeenAt: new Date(row.first_seen_at),
      lastSeenAt: new Date(row.last_seen_at),
      isTrending: Boolean(row.is_trending)
    }));
  }
  
  async getErrorMetrics(timeframe = '24 hours'): Promise<ErrorMetrics> {
    const db = getDatabase();
    
    // Get overall metrics
    const metricsStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_errors,
        COUNT(DISTINCT error_category || error_code || substr(error_message, 1, 50)) as unique_errors,
        SUM(CASE WHEN error_level IN ('critical', 'fatal') THEN 1 ELSE 0 END) as critical_errors,
        SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END) as resolved_errors,
        AVG(CASE 
          WHEN is_resolved = 1 AND resolved_at IS NOT NULL 
          THEN (julianday(resolved_at) - julianday(created_at)) * 24 
          ELSE NULL 
        END) as avg_resolution_hours
      FROM error_logs 
      WHERE cooperative_id = ? 
        AND created_at > datetime('now', '-${timeframe}')
    `);
    
    const metrics = metricsStmt.get(this.cooperativeId) as any;
    
    // Get category breakdown
    const categoryStmt = db.prepare(`
      SELECT error_category, COUNT(*) as count
      FROM error_logs 
      WHERE cooperative_id = ? 
        AND created_at > datetime('now', '-${timeframe}')
      GROUP BY error_category
      ORDER BY count DESC
    `);
    
    const categoryRows = categoryStmt.all(this.cooperativeId) as any[];
    const categoryBreakdown: Record<string, number> = {};
    categoryRows.forEach(row => {
      categoryBreakdown[row.error_category] = row.count;
    });
    
    // Get BRF context breakdown
    const contextStmt = db.prepare(`
      SELECT brf_context, COUNT(*) as count
      FROM error_logs 
      WHERE cooperative_id = ? 
        AND created_at > datetime('now', '-${timeframe}')
        AND brf_context IS NOT NULL
      GROUP BY brf_context
      ORDER BY count DESC
    `);
    
    const contextRows = contextStmt.all(this.cooperativeId) as any[];
    const brfContextBreakdown: Record<string, number> = {};
    contextRows.forEach(row => {
      brfContextBreakdown[row.brf_context] = row.count;
    });
    
    // Calculate error rate (errors per hour)
    const hours = timeframe.includes('day') ? parseInt(timeframe) * 24 : 
                  timeframe.includes('hour') ? parseInt(timeframe) : 24;
    
    return {
      totalErrors: metrics.total_errors,
      uniqueErrors: metrics.unique_errors,
      criticalErrors: metrics.critical_errors,
      resolvedErrors: metrics.resolved_errors,
      errorRate: metrics.total_errors / hours,
      avgResolutionTime: metrics.avg_resolution_hours || 0,
      categoryBreakdown,
      brfContextBreakdown
    };
  }
  
  /**
   * Resolve an error
   */
  async resolveError(
    errorId: string, 
    resolvedBy: string, 
    resolutionNotes: string,
    resolutionType: 'fixed' | 'workaround' | 'configuration' | 'user_error' | 'duplicate' | 'wont_fix' = 'fixed'
  ): Promise<boolean> {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      UPDATE error_logs 
      SET 
        is_resolved = 1,
        resolved_at = datetime('now'),
        resolved_by = ?,
        resolution_notes = ?,
        resolution_type = ?,
        updated_at = datetime('now')
      WHERE error_id = ? AND cooperative_id = ?
    `);
    
    const result = stmt.run(resolvedBy, resolutionNotes, resolutionType, errorId, this.cooperativeId);
    return result.changes > 0;
  }
  
  /**
   * Swedish translation helpers
   */
  private translatePaymentError(message: string): string {
    const translations: Record<string, string> = {
      'Payment failed': 'Betalning misslyckades',
      'Invalid payment method': 'Ogiltig betalningsmetod',
      'Insufficient funds': 'Otillräckliga medel',
      'Payment timeout': 'Betalning timeout',
      'Payment processing error': 'Fel vid betalningsbehandling'
    };
    
    return translations[message] || message;
  }
  
  private translateDocumentError(message: string): string {
    const translations: Record<string, string> = {
      'Document upload failed': 'Dokumentuppladdning misslyckades',
      'Invalid file format': 'Ogiltigt filformat',
      'File too large': 'Filen är för stor',
      'Document processing error': 'Fel vid dokumentbehandling',
      'Document approval failed': 'Dokumentgodkännande misslyckades'
    };
    
    return translations[message] || message;
  }
  
  private translateMemberError(message: string): string {
    const translations: Record<string, string> = {
      'Member registration failed': 'Medlemsregistrering misslyckades',
      'Invalid member data': 'Ogiltiga medlemsdata',
      'Duplicate member': 'Dubblettmedlem',
      'Member authentication failed': 'Medlemsautentisering misslyckades',
      'Member update failed': 'Medlemsuppdatering misslyckades'
    };
    
    return translations[message] || message;
  }
  
  private translateBookingError(message: string): string {
    const translations: Record<string, string> = {
      'Booking failed': 'Bokning misslyckades',
      'Resource not available': 'Resurs ej tillgänglig',
      'Booking conflict': 'Bokningskonflikt',
      'Invalid booking time': 'Ogiltig bokningstid',
      'Booking cancellation failed': 'Bokningsavbokning misslyckades'
    };
    
    return translations[message] || message;
  }
}

// Global error logger instance
export const createErrorLogger = (cooperativeId: string) => {
  return new ErrorLogger(
    cooperativeId,
    process.env.NODE_ENV || 'development',
    process.env.APP_VERSION || '1.0.0'
  );
};

// Error logger middleware for Next.js API routes
export const withErrorLogging = (handler: any) => {
  return async (req: any, res: any) => {
    try {
      return await handler(req, res);
    } catch (error: any) {
      const cooperativeId = req.headers['x-cooperative-id'] || 'system';
      const logger = createErrorLogger(cooperativeId);
      
      await logger.logError({
        errorLevel: 'error',
        errorCategory: 'system',
        errorMessage: error.message,
        stackTrace: error.stack,
        endpoint: req.url,
        httpMethod: req.method,
        requestId: req.headers['x-request-id'],
        sessionId: req.headers['x-session-id'],
        userAgent: req.headers['user-agent'],
        ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        additionalData: {
          query: req.query,
          body: req.body
        }
      });
      
      // Re-throw the error to maintain normal error handling flow
      throw error;
    }
  };
};