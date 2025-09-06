/**
 * Database Query Inspector Engine
 * 
 * This module provides the core query inspection and logging functionality
 * for Swedish BRF cooperative housing systems with multi-tenant security,
 * performance analysis, and GDPR compliance.
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import { RLSContext } from '../rls';
import { getDatabase } from '../config';

export interface QueryInspectionConfig {
  enableLogging: boolean;
  enablePerformanceAnalysis: boolean;
  enableGDPRTracking: boolean;
  enableIsolationAudit: boolean;
  slowQueryThresholdMs: number;
  memoryWarningThresholdKb: number;
  logRetentionDays: number;
}

export interface QueryExecutionResult {
  id: number;
  query_hash: string;
  execution_time_ms: number;
  rows_affected: number;
  performance_score: number;
  warnings: string[];
  recommendations: string[];
}

export interface QueryAnalysis {
  hash: string;
  normalized: string;
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION';
  tables: string[];
  joins: number;
  whereConditions: any[];
  indexUsage: Record<string, any>;
  brfCategory?: string;
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'personal';
  gdprRelevant: boolean;
  piiFields: string[];
  optimizationScore: number;
  recommendations: string[];
}

export interface TenantIsolationCheck {
  verified: boolean;
  cooperativeFilterApplied: boolean;
  rlsChecksPassed: boolean;
  crossTenantDataDetected: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  violations: string[];
}

/**
 * Main Query Inspector Engine Class
 */
export class QueryInspectorEngine {
  private db: Database.Database;
  private config: QueryInspectionConfig;
  
  // Swedish BRF-specific table categorization
  private readonly brfTableCategories: Record<string, string> = {
    // Member management
    'members': 'member_management',
    'member_sessions': 'member_management',
    'member_preferences': 'member_management',
    
    // Housing and apartment operations
    'apartments': 'apartment_operations',
    'apartment_transfers': 'apartment_operations',
    'queue_positions': 'queue_management',
    
    // Financial operations (Swedish K2/K3 compliance)
    'invoices': 'financial_operations',
    'monthly_fees': 'financial_operations',
    'loans': 'financial_operations',
    'loan_payments': 'financial_operations',
    'payment_reminders': 'financial_operations',
    
    // Document and case management
    'documents': 'document_management',
    'cases': 'case_management',
    'case_updates': 'case_management',
    
    // Board governance (Swedish cooperative law compliance)
    'board_meetings': 'board_governance',
    'meeting_protocols': 'board_governance',
    'board_decisions': 'board_governance',
    
    // Building and energy management
    'energy_consumption': 'energy_monitoring',
    'maintenance_requests': 'case_management',
    'contractor_ratings': 'contractor_evaluation',
    
    // Facility booking system
    'booking_resources': 'booking_system',
    'bookings': 'booking_system',
    
    // Audit and compliance
    'audit_log': 'audit_compliance',
    'gdpr_data_access_log': 'audit_compliance',
    'tenant_isolation_audit': 'audit_compliance',
    
    // System administration
    'cooperatives': 'system_administration',
    'feature_flags': 'system_administration',
    'notifications': 'system_administration'
  };

  // PII field patterns for GDPR compliance
  private readonly piiFieldPatterns = [
    /personal_number|personnummer/i,
    /first_name|last_name|full_name/i,
    /email|email_address/i,
    /phone|telefon|mobile/i,
    /address|street|postal_code|city/i,
    /birth_date|date_of_birth|födelsedatum/i,
    /bank_account|account_number/i,
    /ip_address|user_agent/i
  ];

  constructor(config: Partial<QueryInspectionConfig> = {}) {
    this.db = getDatabase();
    this.config = {
      enableLogging: true,
      enablePerformanceAnalysis: true,
      enableGDPRTracking: true,
      enableIsolationAudit: true,
      slowQueryThresholdMs: 1000,
      memoryWarningThresholdKb: 10 * 1024, // 10MB
      logRetentionDays: 90,
      ...config
    };
  }

  /**
   * Intercept and analyze a query before execution
   */
  async interceptQuery(
    query: string,
    params: any[] = [],
    context: RLSContext
  ): Promise<{
    allowExecution: boolean;
    modifiedQuery?: string;
    modifiedParams?: any[];
    warnings: string[];
    analysis: QueryAnalysis;
  }> {
    const analysis = this.analyzeQuery(query, params, context);
    const isolationCheck = this.checkTenantIsolation(query, params, context);
    
    const warnings: string[] = [];
    let allowExecution = true;
    let modifiedQuery = query;
    let modifiedParams = params;

    // Check for isolation violations
    if (!isolationCheck.verified || isolationCheck.crossTenantDataDetected) {
      if (isolationCheck.riskLevel === 'critical') {
        allowExecution = false;
        warnings.push('CRITICAL: Query blocked due to tenant isolation violation');
      } else {
        warnings.push(`WARNING: Potential tenant isolation issue (${isolationCheck.riskLevel})`);
      }
      
      // Log the isolation audit
      this.logTenantIsolationAudit(query, params, context, isolationCheck);
    }

    // Auto-inject cooperative_id filtering if missing and required
    if (this.shouldAutoInjectCooperativeFilter(analysis, context)) {
      const injection = this.injectCooperativeFilter(query, params, context);
      modifiedQuery = injection.query;
      modifiedParams = injection.params;
      warnings.push('INFO: Auto-injected cooperative_id filter for data isolation');
    }

    // Check for GDPR compliance
    if (analysis.gdprRelevant && !this.validateGDPRCompliance(analysis, context)) {
      warnings.push('WARNING: Query accesses personal data without proper legal basis');
    }

    // Performance warnings
    if (analysis.optimizationScore < 50) {
      warnings.push('WARNING: Query has poor performance characteristics');
    }

    return {
      allowExecution,
      modifiedQuery,
      modifiedParams,
      warnings,
      analysis
    };
  }

  /**
   * Log query execution with performance metrics and analysis
   */
  async logQueryExecution(
    query: string,
    params: any[],
    context: RLSContext,
    executionTimeMs: number,
    rowsAffected: number = 0,
    error?: Error
  ): Promise<QueryExecutionResult> {
    if (!this.config.enableLogging) {
      return this.createMinimalResult(query, executionTimeMs);
    }

    const analysis = this.analyzeQuery(query, params, context);
    const performanceScore = this.calculatePerformanceScore(analysis, executionTimeMs, rowsAffected);
    const warnings = this.generateWarnings(analysis, executionTimeMs, error);
    const recommendations = this.generateRecommendations(analysis, performanceScore);

    // Insert into query execution log
    const logEntry = this.db.prepare(`
      INSERT INTO query_execution_log (
        cooperative_id, query_hash, query_text, query_normalized, query_type,
        user_id, user_role, session_id, request_ip, user_agent,
        execution_time_ms, rows_affected, table_names, join_complexity,
        where_conditions, brf_category, data_sensitivity_level, gdpr_relevant,
        pii_fields_accessed, cooperative_isolation_verified, optimization_score,
        needs_optimization, recommended_indexes, optimization_suggestions,
        execution_status, error_message, warning_flags, k2_k3_compliance,
        financial_audit_relevant, board_governance_relevant, retention_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = logEntry.run(
      context.cooperative_id,
      analysis.hash,
      query,
      analysis.normalized,
      analysis.type,
      context.user_id,
      context.user_role,
      null, // session_id - would need to be passed in context
      context.ip_address,
      context.user_agent,
      executionTimeMs,
      rowsAffected,
      JSON.stringify(analysis.tables),
      analysis.joins,
      JSON.stringify(analysis.whereConditions),
      analysis.brfCategory,
      analysis.sensitivityLevel,
      analysis.gdprRelevant ? 1 : 0,
      JSON.stringify(analysis.piiFields),
      1, // cooperative_isolation_verified - would be set by isolation check
      performanceScore,
      performanceScore < 50 ? 1 : 0,
      JSON.stringify([]), // recommended_indexes - would be generated by analysis
      JSON.stringify(recommendations),
      error ? 'error' : 'success',
      error?.message || null,
      JSON.stringify(warnings),
      this.isK2K3Compliant(analysis) ? 1 : 0,
      this.isFinancialAuditRelevant(analysis) ? 1 : 0,
      this.isBoardGovernanceRelevant(analysis) ? 1 : 0,
      new Date(Date.now() + this.config.logRetentionDays * 24 * 60 * 60 * 1000).toISOString()
    );

    // Log GDPR data access if relevant
    if (analysis.gdprRelevant && this.config.enableGDPRTracking) {
      this.logGDPRDataAccess(analysis, context, query);
    }

    return {
      id: result.lastInsertRowid as number,
      query_hash: analysis.hash,
      execution_time_ms: executionTimeMs,
      rows_affected: rowsAffected,
      performance_score: performanceScore,
      warnings: warnings,
      recommendations: recommendations
    };
  }

  /**
   * Analyze query structure, performance, and compliance characteristics
   */
  private analyzeQuery(query: string, params: any[], context: RLSContext): QueryAnalysis {
    const normalized = this.normalizeQuery(query);
    const hash = this.generateQueryHash(normalized);
    const type = this.extractQueryType(query);
    const tables = this.extractTableNames(query);
    const joins = this.countJoins(query);
    const whereConditions = this.extractWhereConditions(query, params);
    
    // Swedish BRF-specific categorization
    const brfCategory = this.categorizeBRFQuery(tables);
    const sensitivityLevel = this.determineSensitivityLevel(tables, query);
    const piiFields = this.extractPIIFields(query);
    const gdprRelevant = piiFields.length > 0 || sensitivityLevel === 'personal';
    
    // Performance analysis
    const optimizationScore = this.calculateOptimizationScore(query, tables, joins, whereConditions);
    const recommendations = this.generateOptimizationRecommendations(query, tables, joins, optimizationScore);

    return {
      hash,
      normalized,
      type,
      tables,
      joins,
      whereConditions,
      indexUsage: {}, // Would be populated by EXPLAIN analysis in a real implementation
      brfCategory,
      sensitivityLevel,
      gdprRelevant,
      piiFields,
      optimizationScore,
      recommendations
    };
  }

  /**
   * Check multi-tenant data isolation compliance
   */
  private checkTenantIsolation(query: string, params: any[], context: RLSContext): TenantIsolationCheck {
    const tables = this.extractTableNames(query);
    const violations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    // Check if cooperative_id filtering is applied
    const cooperativeFilterApplied = query.toLowerCase().includes('cooperative_id');
    
    // Check for potential cross-tenant access patterns
    const crossTenantPatterns = [
      /SELECT.*FROM.*WHERE(?!.*cooperative_id)/i,
      /UPDATE.*SET(?!.*cooperative_id)/i,
      /DELETE.*FROM(?!.*WHERE.*cooperative_id)/i
    ];
    
    let crossTenantDataDetected = false;
    
    for (const pattern of crossTenantPatterns) {
      if (pattern.test(query)) {
        const needsCooperativeFilter = tables.some(table => 
          this.brfTableCategories[table] && table !== 'migrations'
        );
        
        if (needsCooperativeFilter && !cooperativeFilterApplied) {
          crossTenantDataDetected = true;
          violations.push(`Query on table ${tables.join(', ')} lacks cooperative_id filtering`);
          riskLevel = 'high';
        }
      }
    }

    // Check for privilege escalation attempts
    if (query.toLowerCase().includes('role') && query.toLowerCase().includes('admin')) {
      if (context.user_role !== 'admin' && context.user_role !== 'chairman') {
        violations.push('Potential privilege escalation detected');
        riskLevel = 'critical';
      }
    }

    // Check for sensitive data access
    const sensitiveTableAccess = tables.some(table => 
      ['members', 'queue_positions', 'gdpr_data_access_log'].includes(table)
    );
    
    if (sensitiveTableAccess && !cooperativeFilterApplied) {
      violations.push('Access to sensitive data without proper filtering');
      riskLevel = Math.max(riskLevel === 'low' ? 'medium' : riskLevel, 'medium') as any;
    }

    return {
      verified: violations.length === 0,
      cooperativeFilterApplied,
      rlsChecksPassed: violations.length === 0,
      crossTenantDataDetected,
      riskLevel,
      violations
    };
  }

  /**
   * Auto-inject cooperative_id filtering for data isolation
   */
  private injectCooperativeFilter(query: string, params: any[], context: RLSContext): { query: string; params: any[] } {
    const tables = this.extractTableNames(query);
    const needsFilter = tables.some(table => 
      this.brfTableCategories[table] && table !== 'migrations'
    );

    if (!needsFilter || query.toLowerCase().includes('cooperative_id')) {
      return { query, params };
    }

    // Simple injection for SELECT queries (more sophisticated logic would be needed for production)
    if (query.toLowerCase().trim().startsWith('select')) {
      const whereClause = query.toLowerCase().includes('where') ? 
        ` AND cooperative_id = ?` : 
        ` WHERE cooperative_id = ?`;
      
      const modifiedQuery = query + whereClause;
      const modifiedParams = [...params, context.cooperative_id];
      
      return { query: modifiedQuery, params: modifiedParams };
    }

    return { query, params };
  }

  /**
   * Log tenant isolation audit entry
   */
  private logTenantIsolationAudit(
    query: string, 
    params: any[], 
    context: RLSContext, 
    check: TenantIsolationCheck
  ): void {
    if (!this.config.enableIsolationAudit) return;

    const tables = this.extractTableNames(query);
    
    this.db.prepare(`
      INSERT INTO tenant_isolation_audit (
        audit_type, cooperative_id, user_id, query_hash, query_text,
        tables_accessed, isolation_status, cooperative_filter_applied,
        rls_checks_passed, cross_tenant_data_detected, risk_level,
        violation_type, potential_impact, affects_member_privacy,
        gdpr_violation_potential, financial_data_exposure,
        automated_response_taken, manual_review_required
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'query_isolation_check',
      context.cooperative_id,
      context.user_id,
      this.generateQueryHash(query),
      query,
      JSON.stringify(tables),
      check.verified ? 'verified' : (check.riskLevel === 'critical' ? 'violation' : 'suspicious'),
      check.cooperativeFilterApplied ? 1 : 0,
      check.rlsChecksPassed ? 1 : 0,
      check.crossTenantDataDetected ? 1 : 0,
      check.riskLevel,
      check.violations.join('; ') || null,
      this.assessPotentialImpact(check, tables),
      tables.some(t => ['members', 'queue_positions'].includes(t)) ? 1 : 0,
      check.riskLevel === 'critical' ? 1 : 0,
      tables.some(t => ['invoices', 'monthly_fees', 'loans'].includes(t)) ? 1 : 0,
      0, // automated_response_taken
      check.riskLevel === 'critical' ? 1 : 0
    );
  }

  /**
   * Log GDPR data access for compliance tracking
   */
  private logGDPRDataAccess(analysis: QueryAnalysis, context: RLSContext, query: string): void {
    if (!analysis.gdprRelevant) return;

    const dataCategories = this.categorizeGDPRData(analysis.tables, analysis.piiFields);
    
    for (const category of dataCategories) {
      this.db.prepare(`
        INSERT INTO gdpr_data_access_log (
          cooperative_id, data_category, user_id, user_role,
          access_purpose, legal_basis, query_hash, pii_fields_accessed,
          sensitive_data_accessed, personal_number_accessed,
          financial_data_accessed, contact_details_accessed,
          request_ip, automated_processing, retention_period_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        context.cooperative_id,
        category,
        context.user_id,
        context.user_role,
        'service_provision', // Default purpose
        'legitimate_interests', // Default legal basis for BRF operations
        analysis.hash,
        JSON.stringify(analysis.piiFields),
        analysis.sensitivityLevel === 'personal' ? 1 : 0,
        analysis.piiFields.some(field => field.includes('personal_number')) ? 1 : 0,
        analysis.tables.some(t => ['invoices', 'monthly_fees', 'loans'].includes(t)) ? 1 : 0,
        analysis.piiFields.some(field => ['email', 'phone', 'address'].some(p => field.includes(p))) ? 1 : 0,
        context.ip_address,
        1, // automated_processing
        1095 // 3 years retention
      );
    }
  }

  // Helper methods for query analysis

  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\b\d+\b/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/"[^"]*"/g, '?')
      .trim()
      .toLowerCase();
  }

  private generateQueryHash(query: string): string {
    return crypto.createHash('sha256').update(query).digest('hex');
  }

  private extractQueryType(query: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION' {
    const upperQuery = query.toUpperCase().trim();
    if (upperQuery.startsWith('SELECT')) return 'SELECT';
    if (upperQuery.startsWith('INSERT')) return 'INSERT';
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
    if (upperQuery.startsWith('DELETE')) return 'DELETE';
    return 'TRANSACTION';
  }

  private extractTableNames(query: string): string[] {
    const tableRegex = /(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    const matches = [];
    let match;
    
    while ((match = tableRegex.exec(query)) !== null) {
      matches.push(match[1].toLowerCase());
    }
    
    return [...new Set(matches)];
  }

  private countJoins(query: string): number {
    const joinMatches = query.match(/\b(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b/gi);
    return joinMatches ? joinMatches.length : 0;
  }

  private extractWhereConditions(query: string, params: any[]): any[] {
    // Simplified implementation - would need more sophisticated parsing for production
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+HAVING|\s*$)/i);
    return whereMatch ? [{ condition: whereMatch[1], params }] : [];
  }

  private categorizeBRFQuery(tables: string[]): string | undefined {
    for (const table of tables) {
      if (this.brfTableCategories[table]) {
        return this.brfTableCategories[table];
      }
    }
    return undefined;
  }

  private determineSensitivityLevel(tables: string[], query: string): 'public' | 'internal' | 'confidential' | 'personal' {
    // Personal data tables
    if (tables.some(t => ['members', 'queue_positions', 'gdpr_data_access_log'].includes(t))) {
      return 'personal';
    }
    
    // Confidential business data
    if (tables.some(t => ['invoices', 'loans', 'board_meetings'].includes(t))) {
      return 'confidential';
    }
    
    // Internal operations data
    if (tables.some(t => ['cases', 'bookings', 'energy_consumption'].includes(t))) {
      return 'internal';
    }
    
    return 'public';
  }

  private extractPIIFields(query: string): string[] {
    const piiFields: string[] = [];
    
    for (const pattern of this.piiFieldPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        piiFields.push(matches[0]);
      }
    }
    
    return [...new Set(piiFields)];
  }

  private calculateOptimizationScore(query: string, tables: string[], joins: number, whereConditions: any[]): number {
    let score = 100;
    
    // Penalize for table scans (no WHERE clause)
    if (whereConditions.length === 0 && query.toLowerCase().includes('select')) {
      score -= 30;
    }
    
    // Penalize for excessive joins
    if (joins > 3) {
      score -= (joins - 3) * 10;
    }
    
    // Penalize for SELECT *
    if (query.includes('SELECT *')) {
      score -= 15;
    }
    
    // Penalize for missing ORDER BY with LIMIT
    if (query.includes('LIMIT') && !query.includes('ORDER BY')) {
      score -= 20;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private generateOptimizationRecommendations(query: string, tables: string[], joins: number, score: number): string[] {
    const recommendations: string[] = [];
    
    if (score < 50) {
      recommendations.push('Query performance is below optimal threshold');
    }
    
    if (query.includes('SELECT *')) {
      recommendations.push('Avoid SELECT * - specify only needed columns');
    }
    
    if (joins > 3) {
      recommendations.push('Consider reducing the number of joins or using subqueries');
    }
    
    if (query.includes('LIMIT') && !query.includes('ORDER BY')) {
      recommendations.push('Add ORDER BY clause when using LIMIT for consistent results');
    }
    
    return recommendations;
  }

  private calculatePerformanceScore(analysis: QueryAnalysis, executionTime: number, rowsAffected: number): number {
    let score = analysis.optimizationScore;
    
    // Adjust based on execution time
    if (executionTime > 5000) score -= 30;
    else if (executionTime > 2000) score -= 20;
    else if (executionTime > 1000) score -= 10;
    
    // Adjust based on rows affected for non-SELECT queries
    if (analysis.type !== 'SELECT' && rowsAffected > 1000) {
      score -= 15;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private generateWarnings(analysis: QueryAnalysis, executionTime: number, error?: Error): string[] {
    const warnings: string[] = [];
    
    if (error) {
      warnings.push(`Execution error: ${error.message}`);
    }
    
    if (executionTime > this.config.slowQueryThresholdMs) {
      warnings.push('Slow query detected');
    }
    
    if (analysis.gdprRelevant && analysis.sensitivityLevel === 'personal') {
      warnings.push('Query accesses personal data - ensure GDPR compliance');
    }
    
    if (analysis.optimizationScore < 50) {
      warnings.push('Query optimization recommended');
    }
    
    return warnings;
  }

  private generateRecommendations(analysis: QueryAnalysis, performanceScore: number): string[] {
    const recommendations = [...analysis.recommendations];
    
    if (performanceScore < 60) {
      recommendations.push('Consider adding appropriate database indexes');
    }
    
    if (analysis.gdprRelevant) {
      recommendations.push('Ensure proper legal basis for accessing personal data');
    }
    
    return recommendations;
  }

  // Additional helper methods

  private shouldAutoInjectCooperativeFilter(analysis: QueryAnalysis, context: RLSContext): boolean {
    return analysis.tables.some(table => 
      this.brfTableCategories[table] && 
      table !== 'migrations' && 
      !analysis.normalized.includes('cooperative_id')
    );
  }

  private validateGDPRCompliance(analysis: QueryAnalysis, context: RLSContext): boolean {
    // Simplified GDPR validation - would need more sophisticated logic for production
    return true; // Assume compliance for now
  }

  private isK2K3Compliant(analysis: QueryAnalysis): boolean {
    // Check if query follows Swedish K2/K3 accounting standards
    const financialTables = ['invoices', 'monthly_fees', 'loans', 'loan_payments'];
    return !analysis.tables.some(table => financialTables.includes(table)) || 
           analysis.tables.includes('audit_log'); // Financial operations should have audit trail
  }

  private isFinancialAuditRelevant(analysis: QueryAnalysis): boolean {
    const financialTables = ['invoices', 'monthly_fees', 'loans', 'loan_payments'];
    return analysis.tables.some(table => financialTables.includes(table));
  }

  private isBoardGovernanceRelevant(analysis: QueryAnalysis): boolean {
    const governanceTables = ['board_meetings', 'cases', 'contractor_ratings'];
    return analysis.tables.some(table => governanceTables.includes(table));
  }

  private assessPotentialImpact(check: TenantIsolationCheck, tables: string[]): string {
    if (check.riskLevel === 'critical') {
      return 'Critical - potential data breach across cooperatives';
    }
    if (check.riskLevel === 'high') {
      return 'High - unauthorized access to sensitive data possible';
    }
    if (check.riskLevel === 'medium') {
      return 'Medium - data isolation weakened';
    }
    return 'Low - minor isolation concern';
  }

  private categorizeGDPRData(tables: string[], piiFields: string[]): string[] {
    const categories = new Set<string>();
    
    if (tables.includes('members') || piiFields.some(f => f.includes('name'))) {
      categories.add('personal_identification');
    }
    
    if (piiFields.some(f => ['email', 'phone'].some(p => f.includes(p)))) {
      categories.add('contact_information');
    }
    
    if (tables.some(t => ['invoices', 'monthly_fees', 'loans'].includes(t))) {
      categories.add('financial_records');
    }
    
    if (tables.includes('apartments') || tables.includes('queue_positions')) {
      categories.add('housing_details');
    }
    
    return Array.from(categories);
  }

  private createMinimalResult(query: string, executionTime: number): QueryExecutionResult {
    return {
      id: 0,
      query_hash: this.generateQueryHash(query),
      execution_time_ms: executionTime,
      rows_affected: 0,
      performance_score: 50,
      warnings: [],
      recommendations: []
    };
  }
}

/**
 * Factory function to create a query inspector instance
 */
export function createQueryInspector(config?: Partial<QueryInspectionConfig>): QueryInspectorEngine {
  return new QueryInspectorEngine(config);
}

/**
 * Global query inspector instance
 */
export const queryInspector = createQueryInspector();