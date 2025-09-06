/**
 * Test Runner for BRF Multi-Tenant Isolation Tests
 * 
 * Comprehensive test runner that executes all isolation tests
 * and generates detailed reports for security and compliance auditing.
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface TestSuite {
  name: string;
  pattern: string;
  timeout: number;
  description: string;
}

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

interface TestReport {
  timestamp: string;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalDuration: number;
  suites: TestResult[];
  securityStatus: 'SECURE' | 'VULNERABLE' | 'NEEDS_REVIEW';
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
  recommendations: string[];
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Database Isolation Tests',
    pattern: 'tests/database/isolation.test.ts',
    timeout: 60000,
    description: 'Core database isolation and RLS functionality'
  },
  {
    name: 'Cooperative Switching Tests',
    pattern: 'tests/cooperative-switching-isolation.test.ts',
    timeout: 120000,
    description: 'Multi-tenant cooperative switching with complete data isolation'
  },
  {
    name: 'Session Switching Tests',
    pattern: 'tests/session-switching-isolation.test.ts',
    timeout: 90000,
    description: 'Advanced session management and user switching'
  },
  {
    name: 'Repository Isolation Tests',
    pattern: 'tests/database/repository-isolation.test.ts',
    timeout: 45000,
    description: 'Repository pattern data access isolation'
  },
  {
    name: 'Test Data Generators',
    pattern: 'tests/generators/*.test.ts',
    timeout: 30000,
    description: 'Swedish BRF test data generation validation'
  }
];

class IsolationTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.ensureTestDirectories();
  }

  /**
   * Ensure all necessary test directories exist
   */
  private ensureTestDirectories(): void {
    const directories = [
      'tests/reports',
      'tests/coverage',
      'tests/logs'
    ];

    directories.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Run a single test suite
   */
  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    console.log(chalk.blue(`\n🔍 Running ${suite.name}...`));
    console.log(chalk.gray(`   ${suite.description}`));

    return new Promise((resolve) => {
      const startTime = Date.now();
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      const jestProcess = spawn('npx', [
        'jest',
        suite.pattern,
        '--verbose',
        '--coverage',
        '--coverageDirectory=tests/coverage',
        '--testTimeout=' + suite.timeout,
        '--detectOpenHandles',
        '--forceExit'
      ], {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let output = '';
      let errorOutput = '';

      jestProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        process.stdout.write(chunk);
      });

      jestProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        process.stderr.write(chunk);
      });

      jestProcess.on('close', (code) => {
        const duration = Date.now() - startTime;

        // Parse Jest output for test results
        const testResults = this.parseJestOutput(output);
        passed = testResults.passed;
        failed = testResults.failed;
        skipped = testResults.skipped;

        const status = code === 0 ? 'PASSED' : 'FAILED';
        const statusColor = code === 0 ? chalk.green : chalk.red;

        console.log(statusColor(`\n✓ ${suite.name} ${status}`));
        console.log(`   Tests: ${chalk.green(passed)} passed, ${chalk.red(failed)} failed, ${chalk.yellow(skipped)} skipped`);
        console.log(`   Duration: ${duration}ms`);

        // Save detailed logs
        const logFile = join('tests/logs', `${suite.name.replace(/\s+/g, '-').toLowerCase()}.log`);
        writeFileSync(logFile, `STDOUT:\n${output}\n\nSTDERR:\n${errorOutput}`);

        resolve({
          suite: suite.name,
          passed,
          failed,
          skipped,
          duration,
          coverage: this.parseCoverageOutput(output)
        });
      });
    });
  }

  /**
   * Parse Jest test output for results
   */
  private parseJestOutput(output: string): { passed: number; failed: number; skipped: number } {
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    const skippedMatch = output.match(/(\d+) skipped/);

    return {
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0
    };
  }

  /**
   * Parse coverage information from Jest output
   */
  private parseCoverageOutput(output: string): { lines: number; functions: number; branches: number; statements: number } | undefined {
    // This is a simplified parser - in practice, you'd want more robust parsing
    const coverageMatch = output.match(/All files\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)/);
    
    if (coverageMatch) {
      return {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4])
      };
    }
    
    return undefined;
  }

  /**
   * Generate security assessment
   */
  private generateSecurityAssessment(results: TestResult[]): 'SECURE' | 'VULNERABLE' | 'NEEDS_REVIEW' {
    const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);
    const securityCriticalSuites = ['Database Isolation Tests', 'Cooperative Switching Tests', 'Session Switching Tests'];
    
    const criticalFailures = results
      .filter(result => securityCriticalSuites.includes(result.suite))
      .reduce((sum, result) => sum + result.failed, 0);

    if (criticalFailures > 0) {
      return 'VULNERABLE';
    } else if (totalFailed > 0) {
      return 'NEEDS_REVIEW';
    } else {
      return 'SECURE';
    }
  }

  /**
   * Generate compliance assessment
   */
  private generateComplianceAssessment(results: TestResult[]): 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING' {
    const gdprTests = results.filter(result => 
      result.suite.includes('Cooperative Switching') || 
      result.suite.includes('Database Isolation')
    );

    const gdprFailures = gdprTests.reduce((sum, result) => sum + result.failed, 0);
    
    if (gdprFailures > 0) {
      return 'NON_COMPLIANT';
    } else if (gdprTests.length === 0) {
      return 'PENDING';
    } else {
      return 'COMPLIANT';
    }
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(results: TestResult[], securityStatus: string, complianceStatus: string): string[] {
    const recommendations: string[] = [];
    
    const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);
    const averageDuration = results.reduce((sum, result) => sum + result.duration, 0) / results.length;

    if (totalFailed > 0) {
      recommendations.push(`Address ${totalFailed} failing test${totalFailed > 1 ? 's' : ''} before deployment`);
    }

    if (securityStatus === 'VULNERABLE') {
      recommendations.push('CRITICAL: Fix security vulnerabilities immediately');
      recommendations.push('Review and strengthen data isolation mechanisms');
    }

    if (complianceStatus === 'NON_COMPLIANT') {
      recommendations.push('Address GDPR compliance issues before handling personal data');
    }

    if (averageDuration > 30000) {
      recommendations.push('Consider optimizing test performance for faster CI/CD pipelines');
    }

    // Coverage recommendations
    const lowCoverage = results.filter(result => 
      result.coverage && (
        result.coverage.lines < 80 || 
        result.coverage.functions < 80 ||
        result.coverage.branches < 70
      )
    );

    if (lowCoverage.length > 0) {
      recommendations.push('Improve test coverage for critical isolation functions');
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests passing - continue regular security monitoring');
      recommendations.push('Schedule quarterly security reviews');
      recommendations.push('Monitor production audit logs for anomalous patterns');
    }

    return recommendations;
  }

  /**
   * Generate comprehensive test report
   */
  private generateTestReport(): TestReport {
    const totalTests = this.results.reduce((sum, result) => sum + result.passed + result.failed + result.skipped, 0);
    const totalPassed = this.results.reduce((sum, result) => sum + result.passed, 0);
    const totalFailed = this.results.reduce((sum, result) => sum + result.failed, 0);
    const totalDuration = Date.now() - this.startTime;

    const securityStatus = this.generateSecurityAssessment(this.results);
    const complianceStatus = this.generateComplianceAssessment(this.results);
    const recommendations = this.generateRecommendations(this.results, securityStatus, complianceStatus);

    return {
      timestamp: new Date().toISOString(),
      totalTests,
      totalPassed,
      totalFailed,
      totalDuration,
      suites: this.results,
      securityStatus,
      complianceStatus,
      recommendations
    };
  }

  /**
   * Generate HTML test report
   */
  private generateHTMLReport(report: TestReport): string {
    const statusColor = {
      'SECURE': '#28a745',
      'VULNERABLE': '#dc3545',
      'NEEDS_REVIEW': '#ffc107',
      'COMPLIANT': '#28a745',
      'NON_COMPLIANT': '#dc3545',
      'PENDING': '#6c757d'
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <title>BRF Multi-Tenant Isolation Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .status { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; margin: 5px; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .recommendations { background: #e9ecef; padding: 15px; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 BRF Multi-Tenant Isolation Test Report</h1>
        <p><strong>Generated:</strong> ${report.timestamp}</p>
        <p><strong>Total Tests:</strong> ${report.totalTests}</p>
        <p><strong>Duration:</strong> ${Math.round(report.totalDuration / 1000)}s</p>
        
        <div>
            <span class="status" style="background-color: ${statusColor[report.securityStatus]}">
                Security: ${report.securityStatus}
            </span>
            <span class="status" style="background-color: ${statusColor[report.complianceStatus]}">
                Compliance: ${report.complianceStatus}
            </span>
        </div>
    </div>

    <h2>Test Results Summary</h2>
    <p>
        <span class="passed">✓ ${report.totalPassed} passed</span> | 
        <span class="failed">✗ ${report.totalFailed} failed</span>
    </p>

    <h2>Test Suites</h2>
    ${report.suites.map(suite => `
        <div class="suite">
            <h3>${suite.suite}</h3>
            <p>
                <span class="passed">${suite.passed} passed</span> | 
                <span class="failed">${suite.failed} failed</span> | 
                <span class="skipped">${suite.skipped} skipped</span>
            </p>
            <p><strong>Duration:</strong> ${Math.round(suite.duration / 1000)}s</p>
            ${suite.coverage ? `
                <p><strong>Coverage:</strong> 
                Lines: ${suite.coverage.lines}% | 
                Functions: ${suite.coverage.functions}% | 
                Branches: ${suite.coverage.branches}%</p>
            ` : ''}
        </div>
    `).join('')}

    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;
  }

  /**
   * Run all isolation tests
   */
  async runAllTests(): Promise<void> {
    console.log(chalk.bold.blue('\n🔒 BRF Multi-Tenant Isolation Test Suite'));
    console.log(chalk.blue('================================================'));
    console.log(`Starting comprehensive isolation testing at ${new Date().toISOString()}`);
    
    this.startTime = Date.now();
    
    try {
      // Run all test suites
      for (const suite of TEST_SUITES) {
        const result = await this.runTestSuite(suite);
        this.results.push(result);
      }

      // Generate comprehensive report
      const report = this.generateTestReport();
      
      // Save JSON report
      const jsonReportPath = join('tests/reports', 'isolation-test-report.json');
      writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
      
      // Save HTML report
      const htmlReportPath = join('tests/reports', 'isolation-test-report.html');
      writeFileSync(htmlReportPath, this.generateHTMLReport(report));
      
      // Save markdown summary
      const markdownSummary = this.generateMarkdownSummary(report);
      const mdReportPath = join('tests/reports', 'isolation-test-summary.md');
      writeFileSync(mdReportPath, markdownSummary);

      // Print final summary
      this.printFinalSummary(report);
      
      console.log(chalk.blue(`\n📄 Reports generated:`));
      console.log(`   • JSON: ${jsonReportPath}`);
      console.log(`   • HTML: ${htmlReportPath}`);
      console.log(`   • Summary: ${mdReportPath}`);
      
      // Exit with appropriate code
      process.exit(report.totalFailed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error(chalk.red('❌ Test execution failed:'), error);
      process.exit(1);
    }
  }

  /**
   * Generate markdown summary
   */
  private generateMarkdownSummary(report: TestReport): string {
    return `# BRF Multi-Tenant Isolation Test Summary

**Generated:** ${report.timestamp}  
**Total Tests:** ${report.totalTests}  
**Duration:** ${Math.round(report.totalDuration / 1000)}s  

## Status
- **Security:** ${report.securityStatus}
- **GDPR Compliance:** ${report.complianceStatus}

## Results
- ✅ **Passed:** ${report.totalPassed}
- ❌ **Failed:** ${report.totalFailed}
- **Success Rate:** ${Math.round((report.totalPassed / report.totalTests) * 100)}%

## Test Suites

${report.suites.map(suite => `
### ${suite.suite}
- **Passed:** ${suite.passed}
- **Failed:** ${suite.failed} 
- **Duration:** ${Math.round(suite.duration / 1000)}s
${suite.coverage ? `- **Coverage:** Lines ${suite.coverage.lines}%, Functions ${suite.coverage.functions}%` : ''}
`).join('')}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Generated by BRF Portal Test Suite*`;
  }

  /**
   * Print final summary to console
   */
  private printFinalSummary(report: TestReport): void {
    console.log(chalk.bold.blue('\n📊 FINAL TEST SUMMARY'));
    console.log(chalk.blue('======================'));
    
    const successRate = Math.round((report.totalPassed / report.totalTests) * 100);
    const statusColor = report.totalFailed === 0 ? chalk.green : chalk.red;
    
    console.log(`${statusColor('●')} Tests: ${chalk.green(report.totalPassed)} passed, ${chalk.red(report.totalFailed)} failed`);
    console.log(`${statusColor('●')} Success Rate: ${successRate}%`);
    console.log(`${statusColor('●')} Security Status: ${report.securityStatus}`);
    console.log(`${statusColor('●')} Compliance: ${report.complianceStatus}`);
    
    if (report.totalFailed === 0) {
      console.log(chalk.green('\n✅ ALL ISOLATION TESTS PASSED'));
      console.log(chalk.green('   System is ready for multi-tenant production deployment'));
    } else {
      console.log(chalk.red('\n❌ SOME TESTS FAILED'));
      console.log(chalk.red('   Review failures before deployment'));
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new IsolationTestRunner();
  runner.runAllTests().catch(console.error);
}

export default IsolationTestRunner;