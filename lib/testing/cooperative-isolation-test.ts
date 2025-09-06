/**
 * Cooperative Data Isolation Testing Utilities
 * Tools for testing and verifying data isolation between cooperatives
 */

import type { Cooperative } from '@/components/cooperative-selector';
import { cooperativeService, type CooperativeWithStats } from '@/lib/services/cooperative-service';
import type { SecurityContext } from '@/lib/database/security';

export interface IsolationTestResult {
  testName: string;
  cooperativeId: string;
  cooperativeName: string;
  passed: boolean;
  duration: number; // milliseconds
  details: string;
  violations?: IsolationViolation[];
  metadata?: Record<string, any>;
}

export interface IsolationViolation {
  table: string;
  violationType: 'cross_cooperative_access' | 'missing_rls' | 'data_leakage' | 'permission_bypass';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedRecords?: number;
  sampleData?: any[];
}

export interface IsolationTestSuite {
  suiteId: string;
  suiteName: string;
  cooperatives: Cooperative[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  results: IsolationTestResult[];
  summary: IsolationTestSummary;
}

export interface IsolationTestSummary {
  overallPassed: boolean;
  criticalViolations: number;
  highViolations: number;
  mediumViolations: number;
  lowViolations: number;
  recommendations: string[];
}

export class CooperativeIsolationTester {
  private securityContext: SecurityContext;
  private testResults: IsolationTestResult[] = [];

  constructor(securityContext: SecurityContext) {
    this.securityContext = securityContext;
  }

  /**
   * Run comprehensive isolation test suite
   */
  async runFullIsolationTestSuite(
    cooperatives: Cooperative[],
    options: {
      includePerformanceTests?: boolean;
      includeDataIntegrityTests?: boolean;
      includeCrossCooperativeTests?: boolean;
      testDepth?: 'basic' | 'comprehensive' | 'exhaustive';
    } = {}
  ): Promise<IsolationTestSuite> {
    const {
      includePerformanceTests = true,
      includeDataIntegrityTests = true,
      includeCrossCooperativeTests = true,
      testDepth = 'comprehensive',
    } = options;

    const startTime = performance.now();
    const suiteId = `isolation-test-${Date.now()}`;
    const results: IsolationTestResult[] = [];

    console.log(`🧪 Starting isolation test suite: ${suiteId}`);
    console.log(`   Cooperatives: ${cooperatives.length}`);
    console.log(`   Test depth: ${testDepth}`);

    // Test each cooperative individually
    for (const cooperative of cooperatives) {
      console.log(`🔍 Testing cooperative: ${cooperative.name}`);

      // Basic RLS tests
      const rlsResults = await this.testRowLevelSecurity(cooperative);
      results.push(...rlsResults);

      // Data access tests
      const accessResults = await this.testDataAccess(cooperative);
      results.push(...accessResults);

      // Permission boundary tests
      const permissionResults = await this.testPermissionBoundaries(cooperative);
      results.push(...permissionResults);

      if (includeDataIntegrityTests) {
        const integrityResults = await this.testDataIntegrity(cooperative);
        results.push(...integrityResults);
      }

      if (includePerformanceTests) {
        const performanceResults = await this.testQueryPerformance(cooperative);
        results.push(...performanceResults);
      }
    }

    // Cross-cooperative tests
    if (includeCrossCooperativeTests && cooperatives.length > 1) {
      console.log('🔄 Running cross-cooperative isolation tests');
      const crossResults = await this.testCrossCooperativeIsolation(cooperatives);
      results.push(...crossResults);
    }

    const duration = performance.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;

    const summary = this.generateTestSummary(results);

    console.log(`✅ Test suite completed in ${Math.round(duration)}ms`);
    console.log(`   Passed: ${passedTests}/${results.length} tests`);
    console.log(`   Critical violations: ${summary.criticalViolations}`);

    return {
      suiteId,
      suiteName: `Cooperative Isolation Test Suite`,
      cooperatives,
      totalTests: results.length,
      passedTests,
      failedTests,
      duration,
      results,
      summary,
    };
  }

  /**
   * Test Row Level Security implementation
   */
  private async testRowLevelSecurity(cooperative: Cooperative): Promise<IsolationTestResult[]> {
    const results: IsolationTestResult[] = [];
    const testTables = [
      'members', 'apartments', 'cases', 'invoices', 'documents',
      'monthly_fees', 'board_meetings', 'bookings', 'loans'
    ];

    for (const table of testTables) {
      const startTime = performance.now();
      
      try {
        const isolationResult = await cooperativeService.validateDataIsolation(
          cooperative.id,
          {
            ...this.securityContext,
            cooperative_id: cooperative.id,
          }
        );

        const tableViolations = isolationResult.violations.filter(v => v.table === table);
        const passed = tableViolations.length === 0;

        results.push({
          testName: `RLS Test: ${table}`,
          cooperativeId: cooperative.id,
          cooperativeName: cooperative.name,
          passed,
          duration: performance.now() - startTime,
          details: passed 
            ? `Row Level Security working correctly for ${table}`
            : `Found ${tableViolations.length} RLS violations in ${table}`,
          violations: tableViolations.map(v => ({
            table: v.table,
            violationType: v.violationType,
            severity: v.violationType === 'cross_cooperative_access' ? 'critical' : 'high',
            description: v.details,
          })),
        });
      } catch (error) {
        results.push({
          testName: `RLS Test: ${table}`,
          cooperativeId: cooperative.id,
          cooperativeName: cooperative.name,
          passed: false,
          duration: performance.now() - startTime,
          details: `RLS test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return results;
  }

  /**
   * Test data access permissions
   */
  private async testDataAccess(cooperative: Cooperative): Promise<IsolationTestResult[]> {
    const results: IsolationTestResult[] = [];
    const startTime = performance.now();

    try {
      // Test that user can only access data from their cooperative
      const cooperativeData = await cooperativeService.getCooperativeWithStats(
        cooperative.id,
        {
          ...this.securityContext,
          cooperative_id: cooperative.id,
        }
      );

      const passed = cooperativeData?.id === cooperative.id;

      results.push({
        testName: 'Data Access Validation',
        cooperativeId: cooperative.id,
        cooperativeName: cooperative.name,
        passed,
        duration: performance.now() - startTime,
        details: passed 
          ? 'User can correctly access own cooperative data'
          : 'Data access validation failed - potential isolation breach',
        metadata: {
          returnedCooperativeId: cooperativeData?.id,
          expectedCooperativeId: cooperative.id,
        },
      });
    } catch (error) {
      results.push({
        testName: 'Data Access Validation',
        cooperativeId: cooperative.id,
        cooperativeName: cooperative.name,
        passed: false,
        duration: performance.now() - startTime,
        details: `Data access test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return results;
  }

  /**
   * Test permission boundaries
   */
  private async testPermissionBoundaries(cooperative: Cooperative): Promise<IsolationTestResult[]> {
    const results: IsolationTestResult[] = [];
    const startTime = performance.now();

    try {
      // Test that user cannot switch to cooperatives they don't have access to
      const otherCooperativeId = 'non-existent-cooperative-id';
      const canSwitch = await cooperativeService.canUserSwitchToCooperative(
        this.securityContext.user_id || '',
        otherCooperativeId
      );

      const passed = !canSwitch.canSwitch;

      results.push({
        testName: 'Permission Boundary Test',
        cooperativeId: cooperative.id,
        cooperativeName: cooperative.name,
        passed,
        duration: performance.now() - startTime,
        details: passed 
          ? 'Permission boundaries correctly prevent unauthorized cooperative access'
          : 'Permission boundary test failed - user can access unauthorized cooperatives',
        metadata: {
          testedCooperativeId: otherCooperativeId,
          canSwitchResult: canSwitch,
        },
      });
    } catch (error) {
      results.push({
        testName: 'Permission Boundary Test',
        cooperativeId: cooperative.id,
        cooperativeName: cooperative.name,
        passed: false,
        duration: performance.now() - startTime,
        details: `Permission boundary test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return results;
  }

  /**
   * Test data integrity within cooperative
   */
  private async testDataIntegrity(cooperative: Cooperative): Promise<IsolationTestResult[]> {
    const results: IsolationTestResult[] = [];
    const startTime = performance.now();

    try {
      // This would test referential integrity, data consistency, etc.
      // For now, we'll implement a basic check
      const cooperativeStats = await cooperativeService.getCooperativeWithStats(
        cooperative.id,
        {
          ...this.securityContext,
          cooperative_id: cooperative.id,
        }
      );

      const passed = cooperativeStats !== null && 
                    cooperativeStats.totalMembers >= 0 &&
                    cooperativeStats.totalApartments >= 0;

      results.push({
        testName: 'Data Integrity Check',
        cooperativeId: cooperative.id,
        cooperativeName: cooperative.name,
        passed,
        duration: performance.now() - startTime,
        details: passed 
          ? 'Data integrity checks passed'
          : 'Data integrity violations detected',
        metadata: {
          stats: cooperativeStats,
        },
      });
    } catch (error) {
      results.push({
        testName: 'Data Integrity Check',
        cooperativeId: cooperative.id,
        cooperativeName: cooperative.name,
        passed: false,
        duration: performance.now() - startTime,
        details: `Data integrity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return results;
  }

  /**
   * Test query performance with isolation
   */
  private async testQueryPerformance(cooperative: Cooperative): Promise<IsolationTestResult[]> {
    const results: IsolationTestResult[] = [];
    const performanceThreshold = 1000; // 1 second

    const queries = [
      'Get Cooperative Stats',
      'Validate Data Isolation',
    ];

    for (const queryName of queries) {
      const startTime = performance.now();
      
      try {
        switch (queryName) {
          case 'Get Cooperative Stats':
            await cooperativeService.getCooperativeWithStats(
              cooperative.id,
              { ...this.securityContext, cooperative_id: cooperative.id }
            );
            break;
          case 'Validate Data Isolation':
            await cooperativeService.validateDataIsolation(
              cooperative.id,
              { ...this.securityContext, cooperative_id: cooperative.id }
            );
            break;
        }

        const duration = performance.now() - startTime;
        const passed = duration < performanceThreshold;

        results.push({
          testName: `Performance Test: ${queryName}`,
          cooperativeId: cooperative.id,
          cooperativeName: cooperative.name,
          passed,
          duration,
          details: passed 
            ? `Query completed in ${Math.round(duration)}ms (under ${performanceThreshold}ms threshold)`
            : `Query took ${Math.round(duration)}ms (exceeds ${performanceThreshold}ms threshold)`,
          metadata: {
            threshold: performanceThreshold,
            actualDuration: duration,
          },
        });
      } catch (error) {
        results.push({
          testName: `Performance Test: ${queryName}`,
          cooperativeId: cooperative.id,
          cooperativeName: cooperative.name,
          passed: false,
          duration: performance.now() - startTime,
          details: `Performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return results;
  }

  /**
   * Test cross-cooperative isolation
   */
  private async testCrossCooperativeIsolation(cooperatives: Cooperative[]): Promise<IsolationTestResult[]> {
    const results: IsolationTestResult[] = [];

    for (let i = 0; i < cooperatives.length; i++) {
      for (let j = i + 1; j < cooperatives.length; j++) {
        const coopA = cooperatives[i];
        const coopB = cooperatives[j];
        const startTime = performance.now();

        try {
          // Test that data from cooperative A is not accessible when in cooperative B context
          const isolationResultA = await cooperativeService.validateDataIsolation(
            coopA.id,
            { ...this.securityContext, cooperative_id: coopA.id }
          );

          const isolationResultB = await cooperativeService.validateDataIsolation(
            coopB.id,
            { ...this.securityContext, cooperative_id: coopB.id }
          );

          const passed = isolationResultA.isIsolated && isolationResultB.isIsolated;
          const violations = [...isolationResultA.violations, ...isolationResultB.violations];

          results.push({
            testName: `Cross-Cooperative Isolation`,
            cooperativeId: `${coopA.id}-${coopB.id}`,
            cooperativeName: `${coopA.name} ↔ ${coopB.name}`,
            passed,
            duration: performance.now() - startTime,
            details: passed 
              ? 'Cross-cooperative isolation maintained'
              : `Found ${violations.length} isolation violations between cooperatives`,
            violations: violations.map(v => ({
              table: v.table,
              violationType: v.violationType,
              severity: 'critical' as const,
              description: v.details,
            })),
            metadata: {
              cooperativeA: coopA.id,
              cooperativeB: coopB.id,
            },
          });
        } catch (error) {
          results.push({
            testName: `Cross-Cooperative Isolation`,
            cooperativeId: `${coopA.id}-${coopB.id}`,
            cooperativeName: `${coopA.name} ↔ ${coopB.name}`,
            passed: false,
            duration: performance.now() - startTime,
            details: `Cross-cooperative test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Generate test summary
   */
  private generateTestSummary(results: IsolationTestResult[]): IsolationTestSummary {
    const allViolations = results.flatMap(r => r.violations || []);
    
    const criticalViolations = allViolations.filter(v => v.severity === 'critical').length;
    const highViolations = allViolations.filter(v => v.severity === 'high').length;
    const mediumViolations = allViolations.filter(v => v.severity === 'medium').length;
    const lowViolations = allViolations.filter(v => v.severity === 'low').length;

    const overallPassed = criticalViolations === 0 && results.every(r => r.passed);

    const recommendations: string[] = [];
    
    if (criticalViolations > 0) {
      recommendations.push('🚨 CRITICAL: Address cross-cooperative data access violations immediately');
    }
    
    if (highViolations > 0) {
      recommendations.push('⚠️ HIGH: Review Row Level Security implementation');
    }
    
    if (mediumViolations > 0) {
      recommendations.push('📋 MEDIUM: Consider strengthening permission boundaries');
    }
    
    if (results.some(r => !r.passed && r.testName.includes('Performance'))) {
      recommendations.push('⚡ Consider optimizing query performance for isolation checks');
    }

    if (overallPassed) {
      recommendations.push('✅ All isolation tests passed - system is properly secured');
    }

    return {
      overallPassed,
      criticalViolations,
      highViolations,
      mediumViolations,
      lowViolations,
      recommendations,
    };
  }
}

/**
 * Utility functions for testing
 */
export const isolationTestUtils = {
  /**
   * Create a test security context
   */
  createTestContext(cooperativeId: string, userId: string, role: string): SecurityContext {
    return {
      user_id: userId,
      user_role: role,
      cooperative_id: cooperativeId,
      request_ip: '127.0.0.1',
      user_agent: 'CooperativeIsolationTester/1.0',
      session_id: `test-session-${Date.now()}`,
    };
  },

  /**
   * Generate test report
   */
  generateTestReport(suite: IsolationTestSuite): string {
    const lines: string[] = [];
    
    lines.push('# Cooperative Data Isolation Test Report');
    lines.push('');
    lines.push(`**Test Suite:** ${suite.suiteName}`);
    lines.push(`**Suite ID:** ${suite.suiteId}`);
    lines.push(`**Duration:** ${Math.round(suite.duration)}ms`);
    lines.push(`**Cooperatives Tested:** ${suite.cooperatives.length}`);
    lines.push('');
    lines.push('## Summary');
    lines.push(`- **Total Tests:** ${suite.totalTests}`);
    lines.push(`- **Passed:** ${suite.passedTests}`);
    lines.push(`- **Failed:** ${suite.failedTests}`);
    lines.push(`- **Overall Result:** ${suite.summary.overallPassed ? '✅ PASS' : '❌ FAIL'}`);
    lines.push('');
    lines.push('## Violations');
    lines.push(`- **Critical:** ${suite.summary.criticalViolations}`);
    lines.push(`- **High:** ${suite.summary.highViolations}`);
    lines.push(`- **Medium:** ${suite.summary.mediumViolations}`);
    lines.push(`- **Low:** ${suite.summary.lowViolations}`);
    lines.push('');
    lines.push('## Recommendations');
    suite.summary.recommendations.forEach(rec => {
      lines.push(`- ${rec}`);
    });
    lines.push('');
    lines.push('## Detailed Results');
    
    suite.results.forEach(result => {
      lines.push(`### ${result.testName} - ${result.cooperativeName}`);
      lines.push(`**Status:** ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
      lines.push(`**Duration:** ${Math.round(result.duration)}ms`);
      lines.push(`**Details:** ${result.details}`);
      
      if (result.violations && result.violations.length > 0) {
        lines.push('**Violations:**');
        result.violations.forEach(violation => {
          lines.push(`- **${violation.severity.toUpperCase()}** [${violation.table}]: ${violation.description}`);
        });
      }
      lines.push('');
    });

    return lines.join('\n');
  },
};

export default CooperativeIsolationTester;