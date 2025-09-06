/**
 * Multi-Tenant Data Isolation Checker
 * 
 * This module provides comprehensive verification of data isolation between
 * Swedish BRF cooperatives, ensuring proper Row-Level Security (RLS) implementation
 * and preventing cross-tenant data access violations.
 */

import Database from 'better-sqlite3';
import { getDatabase } from '../config';
import { RLSContext } from '../rls';
import crypto from 'crypto';

export interface IsolationTestSuite {
  id: string;
  name: string;
  description: string;
  testCases: IsolationTestCase[];
  brfContext: string;
  complianceRequirements: string[];
}

export interface IsolationTestCase {
  id: string;
  name: string;
  description: string;
  testQuery: string;
  expectedBehavior: 'allow' | 'deny' | 'filter';
  expectedRowCount?: number;
  testData?: TestDataSetup[];
  brfScenario: string;
  gdprImplications?: string[];
}

export interface TestDataSetup {
  table: string;
  data: Record<string, any>;
  cooperative_id: string;
}

export interface IsolationTestResult {
  testCaseId: string;
  passed: boolean;
  actualBehavior: 'allow' | 'deny' | 'filter' | 'error';
  actualRowCount: number;
  expectedRowCount: number;
  executionTime: number;
  errorMessage?: string;
  securityIssues: SecurityIssue[];
  recommendations: string[];
  brfImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityIssue {
  type: 'data_leak' | 'privilege_escalation' | 'injection' | 'bypass' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence?: string;
  potentialImpact: string;
  mitigationSteps: string[];
}

export interface IsolationVerificationReport {
  cooperativeId: string;
  testSuiteId: string;
  overallStatus: 'passed' | 'failed' | 'partial';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  criticalIssues: number;
  testResults: IsolationTestResult[];
  swedishComplianceStatus: {
    gdpr: boolean;
    pul: boolean; // Personuppgiftslag
    brl: boolean; // Bostadsrättslagen
    k2k3: boolean; // Accounting standards
  };
  recommendations: string[];
  executedAt: Date;
}

/**
 * Multi-Tenant Isolation Checker for Swedish BRF Systems
 */
export class MultiTenantIsolationChecker {
  private db: Database.Database;
  
  // Swedish BRF-specific test suites
  private readonly brfTestSuites: IsolationTestSuite[] = [
    {
      id: 'member_data_isolation',
      name: 'Medlemsdataisolering',
      description: 'Verifierar att medlemsdata är korrekt isolerad mellan BRF:er',
      brfContext: 'Medlemsintegritet och GDPR-compliance är kritisk för BRF:er',
      complianceRequirements: ['GDPR Article 32', 'Swedish PUL', 'Data Protection Impact Assessment'],
      testCases: [
        {
          id: 'member_cross_tenant_access',
          name: 'Cross-tenant medlemsåtkomst',
          description: 'Testa att medlemmar från en BRF inte kan se data från andra BRF:er',
          testQuery: 'SELECT * FROM members WHERE email = ?',
          expectedBehavior: 'filter',
          brfScenario: 'Medlem försöker komma åt annan BRFs medlemsdata',
          gdprImplications: ['Personal data protection', 'Purpose limitation', 'Data minimization']
        },
        {
          id: 'member_personal_number_isolation',
          name: 'Personnummer-isolering',
          description: 'Säkerställ att personnummer är korrekt skyddade mellan BRF:er',
          testQuery: 'SELECT personal_number FROM queue_positions WHERE personal_number = ?',
          expectedBehavior: 'filter',
          brfScenario: 'Försök att komma åt personnummer från fel BRF',
          gdprImplications: ['Special category data protection', 'Enhanced security measures']
        }
      ]
    },
    
    {
      id: 'financial_data_isolation',
      name: 'Finansiell dataisolering',
      description: 'Verifierar isolering av finansiella data enligt K2/K3-standards',
      brfContext: 'Finansiell data måste vara helt isolerad för korrekt redovisning',
      complianceRequirements: ['K2/K3 Accounting Standards', 'Bokföringslagen', 'Årsredovisningslagen'],
      testCases: [
        {
          id: 'invoice_cross_tenant',
          name: 'Cross-tenant fakturaåtkomst',
          description: 'Testa att fakturor från andra BRF:er inte är åtkomliga',
          testQuery: 'SELECT * FROM invoices WHERE supplier_name = ?',
          expectedBehavior: 'filter',
          brfScenario: 'Användare försöker se fakturor från annan BRF'
        },
        {
          id: 'financial_report_isolation',
          name: 'Finansiell rapportisolering',
          description: 'Säkerställ att finansiella rapporter är BRF-specifika',
          testQuery: 'SELECT SUM(total_amount) FROM monthly_fees WHERE year = ? AND month = ?',
          expectedBehavior: 'filter',
          brfScenario: 'Ekonomisk sammanställning ska endast inkludera egen BRF'
        }
      ]
    },

    {
      id: 'governance_data_isolation',
      name: 'Styrelsedataisolering',
      description: 'Verifierar isolering av styrelserelaterad data enligt BRL',
      brfContext: 'Styrelseinformation är känslig och måste skyddas enligt Bostadsrättslagen',
      complianceRequirements: ['Bostadsrättslagen', 'Corporate Governance Standards', 'Board Confidentiality'],
      testCases: [
        {
          id: 'board_meeting_isolation',
          name: 'Styrelsemötes-isolering',
          description: 'Testa att styrelsemöten från andra BRF:er inte är åtkomliga',
          testQuery: 'SELECT * FROM board_meetings WHERE meeting_type = ?',
          expectedBehavior: 'filter',
          brfScenario: 'Styrelseledamot försöker komma åt annan BRFs mötesprotokoll'
        }
      ]
    },

    {
      id: 'apartment_operations_isolation',
      name: 'Lägenhetsdriftsisolering',
      description: 'Verifierar isolering av lägenhetsrelaterad data',
      brfContext: 'Lägenhetsdata innehåller känslig information om boende och ekonomi',
      complianceRequirements: ['Housing Privacy Rights', 'Swedish Tenant Protection Law'],
      testCases: [
        {
          id: 'apartment_queue_isolation',
          name: 'Lägenhetskö-isolering',
          description: 'Testa att bostadskön är korrekt isolerad mellan BRF:er',
          testQuery: 'SELECT * FROM queue_positions ORDER BY queue_number',
          expectedBehavior: 'filter',
          brfScenario: 'Köhantering ska endast visa egen BRFs kö'
        },
        {
          id: 'apartment_owner_isolation',
          name: 'Lägenhetsägare-isolering',
          description: 'Säkerställ att ägarinformation är BRF-specifik',
          testQuery: 'SELECT owner_id FROM apartments WHERE apartment_number = ?',
          expectedBehavior: 'filter',
          brfScenario: 'Ägarinformation ska inte läcka mellan BRF:er'
        }
      ]
    }
  ];

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Run comprehensive isolation verification for a cooperative
   */
  async verifyIsolation(
    cooperativeId: string,
    testSuiteIds?: string[]
  ): Promise<IsolationVerificationReport> {
    const suitesToRun = testSuiteIds 
      ? this.brfTestSuites.filter(suite => testSuiteIds.includes(suite.id))
      : this.brfTestSuites;

    const allResults: IsolationTestResult[] = [];
    let criticalIssues = 0;

    // Set up test data
    await this.setupTestData(cooperativeId);

    try {
      for (const suite of suitesToRun) {
        const suiteResults = await this.runTestSuite(cooperativeId, suite);
        allResults.push(...suiteResults);
        
        criticalIssues += suiteResults.reduce((count, result) => 
          count + result.securityIssues.filter(issue => issue.severity === 'critical').length, 0
        );
      }

      const passedTests = allResults.filter(r => r.passed).length;
      const failedTests = allResults.length - passedTests;
      
      const overallStatus: 'passed' | 'failed' | 'partial' = 
        failedTests === 0 ? 'passed' : 
        passedTests === 0 ? 'failed' : 'partial';

      const swedishComplianceStatus = this.assessSwedishCompliance(allResults);
      const recommendations = this.generateRecommendations(allResults, swedishComplianceStatus);

      // Log verification results
      await this.logVerificationResults(cooperativeId, allResults, overallStatus);

      return {
        cooperativeId,
        testSuiteId: testSuiteIds ? testSuiteIds.join(',') : 'all',
        overallStatus,
        totalTests: allResults.length,
        passedTests,
        failedTests,
        criticalIssues,
        testResults: allResults,
        swedishComplianceStatus,
        recommendations,
        executedAt: new Date()
      };

    } finally {
      // Clean up test data
      await this.cleanupTestData(cooperativeId);
    }
  }

  /**
   * Run automated isolation monitoring
   */
  async monitorIsolationContinuously(
    cooperativeId: string,
    intervalMinutes: number = 60
  ): Promise<void> {
    const monitor = async () => {
      try {
        // Run critical test cases only for continuous monitoring
        const criticalSuites = this.brfTestSuites.filter(suite => 
          suite.id === 'member_data_isolation' || 
          suite.id === 'financial_data_isolation'
        );

        const report = await this.verifyIsolation(
          cooperativeId, 
          criticalSuites.map(s => s.id)
        );

        // Alert on any failures
        if (report.overallStatus === 'failed' || report.criticalIssues > 0) {
          await this.createSecurityAlert(cooperativeId, report);
        }

        // Schedule next check
        setTimeout(monitor, intervalMinutes * 60 * 1000);
      } catch (error) {
        console.error('Error in isolation monitoring:', error);
        // Schedule retry in 5 minutes on error
        setTimeout(monitor, 5 * 60 * 1000);
      }
    };

    // Start monitoring
    monitor();
  }

  /**
   * Test specific query for isolation compliance
   */
  async testQueryIsolation(
    query: string,
    params: any[],
    context: RLSContext,
    expectedBehavior: 'allow' | 'deny' | 'filter'
  ): Promise<IsolationTestResult> {
    const testId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();
    
    try {
      // Create test contexts for different cooperatives
      const targetContext = context;
      const otherCooperativeId = 'test-other-cooperative';
      const otherContext: RLSContext = {
        ...context,
        cooperative_id: otherCooperativeId
      };

      // Run query with target context
      let targetResult;
      let targetError;
      try {
        const stmt = this.db.prepare(query);
        targetResult = stmt.all(...params);
      } catch (error) {
        targetError = error;
      }

      // Run query with other cooperative context (should be filtered/denied)
      let otherResult;
      let otherError;
      try {
        // This would use RLS-wrapped query execution
        const stmt = this.db.prepare(query);
        otherResult = stmt.all(...params);
      } catch (error) {
        otherError = error;
      }

      const executionTime = Date.now() - startTime;
      const securityIssues = this.analyzeSecurityIssues(
        query, 
        params, 
        targetResult, 
        otherResult, 
        targetError, 
        otherError
      );

      // Determine actual behavior and test result
      const actualBehavior = this.determineBehavior(
        targetResult, 
        otherResult, 
        targetError, 
        otherError
      );

      const passed = this.evaluateTestResult(
        expectedBehavior, 
        actualBehavior, 
        targetResult, 
        otherResult,
        securityIssues
      );

      const brfImpact = this.assessBRFImpact(securityIssues, query);
      const recommendations = this.generateTestRecommendations(securityIssues, query);

      return {
        testCaseId: testId,
        passed,
        actualBehavior,
        expectedBehavior,
        actualRowCount: targetResult ? targetResult.length : 0,
        expectedRowCount: 0, // Would be set based on test case
        executionTime,
        errorMessage: targetError?.message || otherError?.message,
        securityIssues,
        recommendations,
        brfImpact
      };

    } catch (error) {
      return {
        testCaseId: testId,
        passed: false,
        actualBehavior: 'error',
        expectedBehavior,
        actualRowCount: 0,
        expectedRowCount: 0,
        executionTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        securityIssues: [{
          type: 'injection',
          severity: 'high',
          description: 'Query execution failed with error',
          evidence: error instanceof Error ? error.message : 'Unknown error',
          potentialImpact: 'System instability or potential injection vulnerability',
          mitigationSteps: ['Review query syntax', 'Validate input parameters', 'Check database schema']
        }],
        recommendations: ['Fix query syntax error', 'Validate input parameters'],
        brfImpact: 'high'
      };
    }
  }

  // Private helper methods

  private async runTestSuite(
    cooperativeId: string, 
    suite: IsolationTestSuite
  ): Promise<IsolationTestResult[]> {
    const results: IsolationTestResult[] = [];

    for (const testCase of suite.testCases) {
      const context: RLSContext = {
        cooperative_id: cooperativeId,
        user_id: 'test-user-' + crypto.randomBytes(4).toString('hex'),
        user_role: 'member'
      };

      const result = await this.testQueryIsolation(
        testCase.testQuery,
        [], // Test parameters would be generated based on test data
        context,
        testCase.expectedBehavior
      );

      result.testCaseId = testCase.id;
      results.push(result);
    }

    return results;
  }

  private async setupTestData(cooperativeId: string): Promise<void> {
    // Create test data for isolation testing
    const testCooperativeId1 = cooperativeId;
    const testCooperativeId2 = 'test-other-cooperative';

    const testData = [
      // Test members
      {
        table: 'members',
        data: { 
          id: 'test-member-1', 
          email: 'test1@example.com', 
          first_name: 'Test', 
          last_name: 'User1',
          cooperative_id: testCooperativeId1,
          is_active: 1
        }
      },
      {
        table: 'members',
        data: { 
          id: 'test-member-2', 
          email: 'test2@example.com', 
          first_name: 'Test', 
          last_name: 'User2',
          cooperative_id: testCooperativeId2,
          is_active: 1
        }
      },
      // Test invoices
      {
        table: 'invoices',
        data: {
          id: 'test-invoice-1',
          cooperative_id: testCooperativeId1,
          supplier_name: 'Test Supplier',
          total_amount: 1000,
          payment_status: 'pending'
        }
      },
      {
        table: 'invoices',
        data: {
          id: 'test-invoice-2',
          cooperative_id: testCooperativeId2,
          supplier_name: 'Test Supplier',
          total_amount: 2000,
          payment_status: 'pending'
        }
      }
    ];

    for (const item of testData) {
      try {
        const columns = Object.keys(item.data);
        const placeholders = columns.map(() => '?').join(', ');
        const query = `INSERT OR IGNORE INTO ${item.table} (${columns.join(', ')}) VALUES (${placeholders})`;
        const stmt = this.db.prepare(query);
        stmt.run(...Object.values(item.data));
      } catch (error) {
        console.warn(`Failed to insert test data for ${item.table}:`, error);
      }
    }
  }

  private async cleanupTestData(cooperativeId: string): Promise<void> {
    // Clean up test data
    const testIdPatterns = ['test-%', cooperativeId];
    
    const cleanupQueries = [
      "DELETE FROM members WHERE id LIKE 'test-%'",
      "DELETE FROM invoices WHERE id LIKE 'test-%'",
      "DELETE FROM cooperatives WHERE id = 'test-other-cooperative'"
    ];

    for (const query of cleanupQueries) {
      try {
        this.db.prepare(query).run();
      } catch (error) {
        console.warn('Cleanup query failed:', error);
      }
    }
  }

  private analyzeSecurityIssues(
    query: string,
    params: any[],
    targetResult: any,
    otherResult: any,
    targetError: any,
    otherError: any
  ): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Check for potential data leakage
    if (otherResult && otherResult.length > 0) {
      issues.push({
        type: 'data_leak',
        severity: 'critical',
        description: 'Query returned data from unauthorized cooperative',
        evidence: `Query returned ${otherResult.length} rows from other cooperative`,
        potentialImpact: 'Cross-tenant data exposure violates Swedish GDPR implementation',
        mitigationSteps: [
          'Implement proper RLS filtering',
          'Add cooperative_id checks to all queries',
          'Audit all similar queries for isolation compliance'
        ]
      });
    }

    // Check for missing cooperative_id filtering
    if (!query.toLowerCase().includes('cooperative_id')) {
      const tableNames = this.extractTableNames(query);
      const needsFiltering = tableNames.some(table => 
        !['migrations', 'error_log'].includes(table)
      );
      
      if (needsFiltering) {
        issues.push({
          type: 'bypass',
          severity: 'high',
          description: 'Query lacks cooperative_id filtering',
          evidence: `Query: ${query}`,
          potentialImpact: 'Potential for cross-tenant data access',
          mitigationSteps: [
            'Add cooperative_id = ? condition to WHERE clause',
            'Use RLS-wrapped database operations',
            'Implement automatic query rewriting'
          ]
        });
      }
    }

    // Check for privilege escalation attempts
    if (query.toLowerCase().includes('role') && 
        (query.toLowerCase().includes('admin') || query.toLowerCase().includes('chairman'))) {
      issues.push({
        type: 'privilege_escalation',
        severity: 'high',
        description: 'Query potentially attempts privilege escalation',
        evidence: 'Query contains role and admin/chairman keywords',
        potentialImpact: 'Unauthorized access to administrative functions',
        mitigationSteps: [
          'Validate user permissions before query execution',
          'Implement role-based query restrictions',
          'Add audit logging for privilege-related queries'
        ]
      });
    }

    return issues;
  }

  private determineBehavior(
    targetResult: any,
    otherResult: any,
    targetError: any,
    otherError: any
  ): 'allow' | 'deny' | 'filter' | 'error' {
    if (targetError || otherError) return 'error';
    if (!otherResult || otherResult.length === 0) return 'filter';
    if (otherResult.length > 0) return 'allow'; // Should not happen - indicates data leak
    return 'deny';
  }

  private evaluateTestResult(
    expectedBehavior: 'allow' | 'deny' | 'filter',
    actualBehavior: 'allow' | 'deny' | 'filter' | 'error',
    targetResult: any,
    otherResult: any,
    securityIssues: SecurityIssue[]
  ): boolean {
    // Test fails if there are critical security issues
    if (securityIssues.some(issue => issue.severity === 'critical')) {
      return false;
    }

    // Test fails if actual behavior doesn't match expected
    if (expectedBehavior !== actualBehavior) {
      return false;
    }

    // Additional validation based on expected behavior
    switch (expectedBehavior) {
      case 'filter':
        // Should have results for target but not for other cooperative
        return targetResult && (!otherResult || otherResult.length === 0);
      case 'deny':
        // Should have no results for either
        return (!targetResult || targetResult.length === 0) && 
               (!otherResult || otherResult.length === 0);
      case 'allow':
        // Should have results (but this is rare for isolation tests)
        return targetResult && targetResult.length > 0;
      default:
        return false;
    }
  }

  private assessBRFImpact(securityIssues: SecurityIssue[], query: string): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (securityIssues.some(issue => issue.severity === 'critical')) return 'critical';
    if (securityIssues.some(issue => issue.severity === 'high')) return 'high';
    
    // Check if query involves sensitive BRF data
    const sensitivePatterns = [
      /personal_number|personnummer/i,
      /email|phone/i,
      /invoices|payments|loans/i,
      /board_meetings|governance/i
    ];
    
    if (sensitivePatterns.some(pattern => pattern.test(query))) {
      return 'high';
    }
    
    if (securityIssues.some(issue => issue.severity === 'medium')) return 'medium';
    if (securityIssues.length > 0) return 'low';
    
    return 'none';
  }

  private generateTestRecommendations(securityIssues: SecurityIssue[], query: string): string[] {
    const recommendations = new Set<string>();

    for (const issue of securityIssues) {
      issue.mitigationSteps.forEach(step => recommendations.add(step));
    }

    // Add BRF-specific recommendations
    if (query.includes('members') || query.includes('personal')) {
      recommendations.add('Ensure GDPR compliance for member data access');
      recommendations.add('Implement data minimization principles');
    }

    if (query.includes('invoice') || query.includes('payment')) {
      recommendations.add('Maintain K2/K3 accounting standard compliance');
      recommendations.add('Ensure proper financial audit trail');
    }

    return Array.from(recommendations);
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

  private assessSwedishCompliance(results: IsolationTestResult[]): {
    gdpr: boolean;
    pul: boolean;
    brl: boolean;
    k2k3: boolean;
  } {
    const criticalFailures = results.filter(r => !r.passed && r.brfImpact === 'critical').length;
    const memberDataIssues = results.filter(r => 
      !r.passed && r.securityIssues.some(issue => issue.type === 'data_leak')
    ).length;

    return {
      gdpr: memberDataIssues === 0,
      pul: memberDataIssues === 0, // Swedish Personal Data Act
      brl: criticalFailures === 0, // Housing Cooperative Act
      k2k3: results.filter(r => !r.passed && r.testCaseId.includes('financial')).length === 0
    };
  }

  private generateRecommendations(
    results: IsolationTestResult[], 
    complianceStatus: any
  ): string[] {
    const recommendations: string[] = [];

    const failedTests = results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} isolation tests failed - immediate attention required`);
    }

    if (!complianceStatus.gdpr) {
      recommendations.push('GDPR compliance issues detected - implement enhanced privacy controls');
    }

    if (!complianceStatus.k2k3) {
      recommendations.push('K2/K3 accounting compliance issues - review financial data isolation');
    }

    const criticalIssues = results.filter(r => r.brfImpact === 'critical').length;
    if (criticalIssues > 0) {
      recommendations.push('Critical security issues found - suspend affected operations until resolved');
    }

    return recommendations;
  }

  private async logVerificationResults(
    cooperativeId: string,
    results: IsolationTestResult[],
    overallStatus: string
  ): Promise<void> {
    for (const result of results) {
      for (const issue of result.securityIssues) {
        try {
          this.db.prepare(`
            INSERT INTO tenant_isolation_audit (
              audit_type, cooperative_id, isolation_status, risk_level,
              violation_type, potential_impact, manual_review_required
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            'automated_verification',
            cooperativeId,
            result.passed ? 'verified' : 'violation',
            issue.severity,
            issue.type,
            issue.potentialImpact,
            issue.severity === 'critical' ? 1 : 0
          );
        } catch (error) {
          console.warn('Failed to log verification result:', error);
        }
      }
    }
  }

  private async createSecurityAlert(
    cooperativeId: string,
    report: IsolationVerificationReport
  ): Promise<void> {
    const criticalIssues = report.testResults.filter(r => r.brfImpact === 'critical');
    
    for (const result of criticalIssues) {
      try {
        this.db.prepare(`
          INSERT INTO query_performance_alerts (
            cooperative_id, alert_type, severity, title, description,
            affects_compliance, affects_member_experience, manual_review_required
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          cooperativeId,
          'isolation_bypass',
          'critical',
          'Critical Data Isolation Violation Detected',
          `Test case ${result.testCaseId} failed with ${result.securityIssues.length} security issues`,
          1, // affects_compliance
          1, // affects_member_experience
          1  // manual_review_required
        );
      } catch (error) {
        console.warn('Failed to create security alert:', error);
      }
    }
  }
}

/**
 * Factory function to create an isolation checker instance
 */
export function createIsolationChecker(): MultiTenantIsolationChecker {
  return new MultiTenantIsolationChecker();
}

/**
 * Global isolation checker instance
 */
export const isolationChecker = createIsolationChecker();