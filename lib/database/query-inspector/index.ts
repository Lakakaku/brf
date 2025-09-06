/**
 * Database Query Inspector - Main Entry Point
 * 
 * This module provides comprehensive database query inspection, logging, and analysis
 * specifically designed for Swedish BRF (Bostadsrättsförening) operations.
 * 
 * Features:
 * - Real-time query performance monitoring
 * - Multi-tenant data isolation verification  
 * - GDPR compliance checking and reporting
 * - Swedish BRF-specific query templates
 * - K2/K3 accounting standards compliance
 * - Automated security auditing
 * - Performance optimization recommendations
 */

// Core modules
export * from './schema';
export * from './engine';
export * from './analyzer';
export * from './isolation-checker';
export * from './brf-templates';
export * from './gdpr-compliance';

// Main classes
export { QueryInspectorEngine, createQueryInspector, queryInspector } from './engine';
export { BRFQueryAnalyzer, createBRFQueryAnalyzer, brfQueryAnalyzer } from './analyzer';
export { MultiTenantIsolationChecker, createIsolationChecker, isolationChecker } from './isolation-checker';
export { BRFQueryTemplateManager, createBRFTemplateManager, brfTemplateManager } from './brf-templates';
export { GDPRComplianceChecker, createGDPRComplianceChecker, gdprComplianceChecker } from './gdpr-compliance';

// Schema utilities
export { 
  createQueryInspectorSchema, 
  createQueryInspectorIndexes, 
  createQueryInspectorTriggers,
  dropQueryInspectorSchema 
} from './schema';

import { getDatabase } from '../config';
import { QueryInspectorEngine } from './engine';
import { BRFQueryAnalyzer } from './analyzer';
import { MultiTenantIsolationChecker } from './isolation-checker';
import { BRFQueryTemplateManager } from './brf-templates';
import { GDPRComplianceChecker } from './gdpr-compliance';
import { 
  createQueryInspectorSchema, 
  createQueryInspectorIndexes, 
  createQueryInspectorTriggers 
} from './schema';
import type { RLSContext } from '../rls';

export interface QueryInspectorConfig {
  enableLogging?: boolean;
  enablePerformanceAnalysis?: boolean;
  enableGDPRTracking?: boolean;
  enableIsolationAudit?: boolean;
  enableBRFTemplates?: boolean;
  slowQueryThresholdMs?: number;
  memoryWarningThresholdKb?: number;
  logRetentionDays?: number;
  continuousMonitoringInterval?: number;
}

export interface QueryInspectionResult {
  queryId: string;
  executionTime: number;
  performanceScore: number;
  complianceStatus: {
    gdprCompliant: boolean;
    isolationVerified: boolean;
    brfStandardsCompliant: boolean;
  };
  violations: string[];
  recommendations: string[];
  brfCategory?: string;
}

/**
 * Integrated Query Inspector for Swedish BRF Systems
 */
export class IntegratedQueryInspector {
  private engine: QueryInspectorEngine;
  private analyzer: BRFQueryAnalyzer;
  private isolationChecker: MultiTenantIsolationChecker;
  private templateManager: BRFQueryTemplateManager;
  private gdprChecker: GDPRComplianceChecker;
  private config: QueryInspectorConfig;

  constructor(config: QueryInspectorConfig = {}) {
    this.config = {
      enableLogging: true,
      enablePerformanceAnalysis: true,
      enableGDPRTracking: true,
      enableIsolationAudit: true,
      enableBRFTemplates: true,
      slowQueryThresholdMs: 1000,
      memoryWarningThresholdKb: 10240,
      logRetentionDays: 90,
      continuousMonitoringInterval: 60,
      ...config
    };

    this.engine = new QueryInspectorEngine(this.config);
    this.analyzer = new BRFQueryAnalyzer();
    this.isolationChecker = new MultiTenantIsolationChecker();
    this.templateManager = new BRFQueryTemplateManager();
    this.gdprChecker = new GDPRComplianceChecker();
  }

  /**
   * Initialize the query inspector system
   */
  async initialize(): Promise<void> {
    const db = getDatabase();
    
    try {
      // Create schema
      createQueryInspectorSchema(db);
      createQueryInspectorIndexes(db);
      createQueryInspectorTriggers(db);
      
      console.log('✅ Query Inspector initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Query Inspector:', error);
      throw new Error('Query Inspector initialization failed');
    }
  }

  /**
   * Comprehensive query inspection and logging
   */
  async inspectQuery(
    query: string,
    parameters: any[],
    context: RLSContext,
    executionTimeMs: number,
    rowsAffected?: number
  ): Promise<QueryInspectionResult> {
    const queryId = `qi_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    try {
      // 1. Log query execution
      const executionResult = await this.engine.logQueryExecution(
        query, 
        parameters, 
        context, 
        executionTimeMs, 
        rowsAffected
      );

      // 2. Perform BRF-specific analysis if enabled
      let brfAnalysis;
      if (this.config.enablePerformanceAnalysis) {
        brfAnalysis = await this.analyzer.analyzeQueryPerformance(
          executionResult.query_hash, 
          context
        );
      }

      // 3. GDPR compliance check if enabled
      let gdprCheck;
      if (this.config.enableGDPRTracking) {
        gdprCheck = await this.gdprChecker.checkCompliance(
          query, 
          parameters, 
          context, 
          brfAnalysis?.pattern?.category
        );
      }

      // 4. Isolation verification if enabled
      let isolationCheck;
      if (this.config.enableIsolationAudit) {
        isolationCheck = await this.isolationChecker.testQueryIsolation(
          query,
          parameters,
          context,
          'filter' // Expected behavior for most BRF queries
        );
      }

      // Compile results
      const violations: string[] = [];
      const recommendations: string[] = [];

      if (gdprCheck && !gdprCheck.compliant) {
        violations.push(...gdprCheck.violations.map(v => v.description));
        recommendations.push(...gdprCheck.recommendations.map(r => r.description));
      }

      if (isolationCheck && !isolationCheck.passed) {
        violations.push(...isolationCheck.securityIssues.map(i => i.description));
        recommendations.push(...isolationCheck.recommendations);
      }

      if (brfAnalysis) {
        recommendations.push(...brfAnalysis.brfRecommendations);
      }

      return {
        queryId,
        executionTime: executionTimeMs,
        performanceScore: executionResult.performance_score,
        complianceStatus: {
          gdprCompliant: gdprCheck?.compliant ?? true,
          isolationVerified: isolationCheck?.passed ?? true,
          brfStandardsCompliant: brfAnalysis?.complianceChecks.every(c => c.compliant) ?? true
        },
        violations,
        recommendations,
        brfCategory: brfAnalysis?.pattern?.category
      };

    } catch (error) {
      console.error('Error during query inspection:', error);
      throw new Error(`Query inspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute BRF template with full inspection
   */
  async executeTemplate(
    templateId: string,
    parameters: Record<string, any>,
    context: RLSContext
  ): Promise<{
    results: any[];
    inspection: QueryInspectionResult;
  }> {
    const startTime = Date.now();
    
    const templateResult = await this.templateManager.executeTemplate(
      templateId, 
      parameters, 
      context
    );
    
    const executionTime = Date.now() - startTime;
    
    // Get template for query text
    const template = this.templateManager.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const inspection = await this.inspectQuery(
      template.sqlTemplate,
      Object.values(parameters),
      context,
      executionTime,
      templateResult.results.length
    );

    return {
      results: templateResult.results,
      inspection
    };
  }

  /**
   * Generate comprehensive dashboard data
   */
  async generateDashboard(cooperativeId: string): Promise<{
    brfDashboard: any;
    gdprReport: any;
    isolationReport: any;
    recommendations: string[];
  }> {
    const [brfDashboard, gdprReport, isolationReport] = await Promise.all([
      this.analyzer.generateBRFDashboard(cooperativeId),
      this.gdprChecker.generateComplianceReport(cooperativeId),
      this.isolationChecker.verifyIsolation(cooperativeId)
    ]);

    // Compile unified recommendations
    const recommendations = new Set<string>();
    
    brfDashboard.optimizationOpportunities.forEach((opp: any) => 
      recommendations.add(opp.description)
    );
    
    gdprReport.recommendations.forEach((rec: any) => 
      recommendations.add(rec.description)
    );
    
    isolationReport.recommendations.forEach(rec => 
      recommendations.add(rec)
    );

    return {
      brfDashboard,
      gdprReport,
      isolationReport,
      recommendations: Array.from(recommendations)
    };
  }

  /**
   * Start continuous monitoring for a cooperative
   */
  async startContinuousMonitoring(cooperativeId: string): Promise<void> {
    if (!this.config.continuousMonitoringInterval) return;

    console.log(`🔍 Starting continuous monitoring for cooperative ${cooperativeId}`);
    
    // Start isolation monitoring
    await this.isolationChecker.monitorIsolationContinuously(
      cooperativeId, 
      this.config.continuousMonitoringInterval
    );
  }

  /**
   * Get available BRF query templates
   */
  getBRFTemplates(): any[] {
    return this.templateManager.getTemplates();
  }

  /**
   * Get templates by category
   */
  getBRFTemplatesByCategory(category: string): any[] {
    return this.templateManager.getTemplatesByCategory(category as any);
  }

  /**
   * Get performance analysis for a specific query
   */
  async analyzeQueryPerformance(queryHash: string, context: RLSContext): Promise<any> {
    return this.analyzer.analyzeQueryPerformance(queryHash, context);
  }

  /**
   * Check GDPR compliance for a query
   */
  async checkGDPRCompliance(
    query: string, 
    parameters: any[], 
    context: RLSContext, 
    queryCategory?: string
  ): Promise<any> {
    return this.gdprChecker.checkCompliance(query, parameters, context, queryCategory);
  }

  /**
   * Verify multi-tenant isolation
   */
  async verifyIsolation(cooperativeId: string, testSuiteIds?: string[]): Promise<any> {
    return this.isolationChecker.verifyIsolation(cooperativeId, testSuiteIds);
  }

  /**
   * Get optimization suggestions for a template
   */
  getOptimizationSuggestions(templateId: string): any {
    return this.templateManager.generateOptimizationSuggestions(templateId);
  }

  /**
   * Log data subject request for GDPR compliance
   */
  async logDataSubjectRequest(
    cooperativeId: string,
    requestType: any,
    dataSubjectId: string,
    requestDetails: any,
    context: RLSContext
  ): Promise<string> {
    return this.gdprChecker.logDataSubjectRequest(
      cooperativeId, 
      requestType, 
      dataSubjectId, 
      requestDetails, 
      context
    );
  }

  /**
   * Clean up expired log entries
   */
  async cleanupExpiredLogs(): Promise<number> {
    const db = getDatabase();
    
    try {
      const result = db.prepare(`
        DELETE FROM query_execution_log 
        WHERE retention_until <= datetime('now')
      `).run();
      
      console.log(`🧹 Cleaned up ${result.changes} expired query log entries`);
      return result.changes;
    } catch (error) {
      console.error('Failed to cleanup expired logs:', error);
      return 0;
    }
  }

  /**
   * Generate system health report
   */
  async generateHealthReport(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{
      name: string;
      status: boolean;
      details: string;
    }>;
    recommendations: string[];
  }> {
    const checks = [];
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    try {
      // Check database connectivity
      const db = getDatabase();
      db.prepare('SELECT 1').get();
      checks.push({
        name: 'Database Connectivity',
        status: true,
        details: 'Database connection is working'
      });
    } catch (error) {
      checks.push({
        name: 'Database Connectivity',
        status: false,
        details: `Database connection failed: ${error}`
      });
      overallStatus = 'critical';
    }

    // Check table existence
    try {
      const db = getDatabase();
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE 'query_%' OR name LIKE '%_audit%'
      `).all();
      
      const requiredTables = ['query_execution_log', 'query_patterns', 'tenant_isolation_audit'];
      const missingTables = requiredTables.filter(
        table => !tables.some((t: any) => t.name === table)
      );
      
      if (missingTables.length === 0) {
        checks.push({
          name: 'Schema Integrity',
          status: true,
          details: 'All required tables exist'
        });
      } else {
        checks.push({
          name: 'Schema Integrity',
          status: false,
          details: `Missing tables: ${missingTables.join(', ')}`
        });
        overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
      }
    } catch (error) {
      checks.push({
        name: 'Schema Integrity',
        status: false,
        details: `Schema check failed: ${error}`
      });
      overallStatus = 'critical';
    }

    const recommendations: string[] = [];
    
    if (overallStatus !== 'healthy') {
      recommendations.push('Run initialize() to fix schema issues');
    }
    
    const failedChecks = checks.filter(c => !c.status);
    if (failedChecks.length > 0) {
      recommendations.push('Address failed health checks immediately');
    }

    return {
      status: overallStatus,
      checks,
      recommendations
    };
  }
}

/**
 * Factory function to create integrated query inspector
 */
export function createIntegratedQueryInspector(config?: QueryInspectorConfig): IntegratedQueryInspector {
  return new IntegratedQueryInspector(config);
}

/**
 * Global integrated query inspector instance
 */
export const integratedQueryInspector = createIntegratedQueryInspector();

/**
 * Convenience function to initialize the query inspector system
 */
export async function initializeQueryInspector(config?: QueryInspectorConfig): Promise<IntegratedQueryInspector> {
  const inspector = createIntegratedQueryInspector(config);
  await inspector.initialize();
  return inspector;
}

/**
 * Utility function to get query inspector health status
 */
export async function getQueryInspectorHealth(): Promise<any> {
  return integratedQueryInspector.generateHealthReport();
}

// Re-export key types for convenience
export type {
  QueryInspectionConfig,
  QueryExecutionResult,
  QueryAnalysis,
  TenantIsolationCheck,
  IsolationVerificationReport,
  BRFQueryTemplate,
  GDPRComplianceCheck
} from './engine';

export type {
  PerformanceMetrics,
  BRFQueryPattern,
  QueryOptimizationPlan,
  OptimizationStep
} from './analyzer';

export type {
  IsolationTestSuite,
  IsolationTestCase,
  IsolationTestResult,
  SecurityIssue
} from './isolation-checker';

export type {
  BRFQueryCategory,
  QueryParameter,
  PerformanceExpectations,
  ComplianceRequirements,
  SwedishLegalContext
} from './brf-templates';

export type {
  GDPRViolation,
  GDPRRecommendation,
  LegalBasisValidation,
  DataMinimizationCheck,
  RetentionCompliance,
  SubjectRightsImpact,
  GDPRViolationType,
  LegalBasis
} from './gdpr-compliance';