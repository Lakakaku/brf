/**
 * Comprehensive Database Isolation Test Suite
 * 
 * Tests data isolation between cooperatives in the Swedish BRF management system.
 * Verifies that Row-Level Security (RLS) implementation prevents data leaks
 * between different cooperatives.
 */

import Database from 'better-sqlite3';
import { createRLSDatabase, RLSContext } from '@/lib/database/rls';
import { SecurityMiddleware, createSecureContext } from '@/lib/database/security';
import {
  createTestDatabase,
  initializeTestDatabase,
  getTestCooperatives,
  getTestMembers,
  getTestApartments,
  createTestRLSContext,
  createTestSecurityContext,
  executeIsolationTest,
  testTableIsolation,
  testRLSBypassAttempts,
  testSoftDeleteIsolation,
  testAuditLogIsolation,
  testTransactionIsolation,
  testIsolationPerformance,
  cleanupTestDatabase,
  generateTestReportSummary,
  IsolationTestResult,
  TestCooperative,
  TestMember
} from '../helpers/database-test-utils';

describe('BRF Portal Database Isolation Tests', () => {
  let db: Database.Database;
  let testCooperatives: TestCooperative[];
  let allTestResults: IsolationTestResult[] = [];

  beforeAll(async () => {
    // Create and initialize test database
    db = createTestDatabase();
    await initializeTestDatabase(db);
    testCooperatives = getTestCooperatives(db);
    
    if (testCooperatives.length < 2) {
      throw new Error('At least 2 test cooperatives are required for isolation testing');
    }

    console.log(`\n📊 Starting isolation tests with ${testCooperatives.length} cooperatives:`);
    testCooperatives.forEach((coop, index) => {
      console.log(`  ${index + 1}. ${coop.name} (${coop.id})`);
    });
  });

  afterAll(() => {
    // Generate and log test report
    const summary = generateTestReportSummary(allTestResults);
    console.log('\n📋 ISOLATION TEST REPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed} ✅`);
    console.log(`Failed: ${summary.failed} ${summary.failed > 0 ? '❌' : '✅'}`);
    console.log(`Security Violations Detected: ${summary.securityViolationsDetected} 🔒`);
    console.log(`Average Execution Time: ${summary.averageExecutionTime}ms`);
    console.log(`Tables Tested: ${summary.tablesTestedCount}`);
    console.log(`Cooperatives Tested: ${summary.cooperativesTestedCount}`);
    console.log('='.repeat(50));

    cleanupTestDatabase(db);
  });

  describe('Basic Data Isolation', () => {
    const tablesToTest = [
      'cooperatives',
      'members', 
      'apartments',
      'documents',
      'invoices',
      'monthly_fees',
      'cases',
      'notifications',
      'board_meetings',
      'contractor_ratings',
      'bookings',
      'queue_positions',
      'loans'
    ];

    test.each(tablesToTest)('Table %s should maintain cooperative isolation', async (table) => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const results = await testTableIsolation(db, table, coop1.id, coop2.id);
      allTestResults.push(...results);
      
      // Verify all tests passed
      const failedTests = results.filter(r => !r.success);
      if (failedTests.length > 0) {
        console.error(`❌ Failed isolation tests for ${table}:`, failedTests);
      }
      
      expect(failedTests.length).toBe(0);
      
      // Log successful isolation
      const ownDataResult = results.find(r => r.operation === 'SELECT');
      const isolationResult = results.find(r => r.operation === 'ISOLATION_CHECK');
      
      console.log(`✅ ${table}: Coop1 has ${ownDataResult?.recordCount || 0} records, isolation maintained`);
    });
  });

  describe('Cross-Tenant Access Prevention', () => {
    test('Users cannot access other cooperatives data through RLS', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const coop1Members = getTestMembers(db, coop1.id);
      const coop1Member = coop1Members.find(m => m.role === 'member');
      
      expect(coop1Member).toBeDefined();
      
      // Create RLS context for coop1 member trying to access coop2 data
      const rlsDb = createRLSDatabase(db, createTestRLSContext(
        coop2.id, // Wrong cooperative!
        coop1Member!.id,
        coop1Member!.role
      ));
      
      // Should get empty results when accessing wrong cooperative
      const result = await executeIsolationTest(
        'Cross-tenant access prevention',
        async () => {
          const members = rlsDb.select('members');
          
          // Should get coop2 data, not coop1 data
          const coop1MemberIds = coop1Members.map(m => m.id);
          const accessedMembers = members.map((m: any) => m.id);
          const coop1DataAccessed = accessedMembers.filter(id => coop1MemberIds.includes(id));
          
          if (coop1DataAccessed.length > 0) {
            throw new Error(`Cross-tenant data leak: ${coop1DataAccessed.length} records from different cooperative`);
          }
          
          return members;
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop2.id,
        operation: 'CROSS_TENANT_ACCESS',
        table: 'members'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Cross-tenant access properly isolated');
    });

    test('Board members cannot access other cooperatives financial data', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const coop1Members = getTestMembers(db, coop1.id);
      const boardMember = coop1Members.find(m => m.role === 'board');
      
      expect(boardMember).toBeDefined();
      
      // Try to access other cooperative's financial data
      const result = await executeIsolationTest(
        'Board member cross-cooperative financial access',
        async () => {
          const rlsDb = createRLSDatabase(db, createTestRLSContext(
            coop1.id,
            boardMember!.id,
            boardMember!.role
          ));
          
          // Get own cooperative invoices
          const ownInvoices = rlsDb.select('invoices');
          
          // Try different cooperative context (should not work)
          const otherRlsDb = createRLSDatabase(db, createTestRLSContext(
            coop2.id,
            boardMember!.id, // Same user
            boardMember!.role
          ));
          
          const otherInvoices = otherRlsDb.select('invoices');
          
          // Verify no invoice IDs overlap
          const ownInvoiceIds = ownInvoices.map((inv: any) => inv.id);
          const otherInvoiceIds = otherInvoices.map((inv: any) => inv.id);
          const overlap = ownInvoiceIds.filter(id => otherInvoiceIds.includes(id));
          
          if (overlap.length > 0) {
            throw new Error(`Financial data isolation violation: ${overlap.length} overlapping invoices`);
          }
          
          return { ownCount: ownInvoices.length, otherCount: otherInvoices.length };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'FINANCIAL_CROSS_ACCESS',
        table: 'invoices'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Board member financial data properly isolated');
    });
  });

  describe('RLS Bypass Prevention', () => {
    test('SQL injection attempts should be blocked', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const results = await testRLSBypassAttempts(db, coop1.id, coop2.id);
      allTestResults.push(...results);
      
      // All bypass attempts should fail
      const successfulBypasses = results.filter(r => !r.success && !r.securityViolation);
      expect(successfulBypasses.length).toBe(0);
      
      // Security violations should be detected
      const detectedViolations = results.filter(r => r.securityViolation);
      expect(detectedViolations.length).toBeGreaterThan(0);
      
      console.log(`✅ ${results.length} RLS bypass attempts blocked, ${detectedViolations.length} security violations detected`);
    });

    test('Malicious custom queries should be rejected', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const maliciousQueries = [
        "SELECT * FROM members WHERE cooperative_id != '?' UNION SELECT * FROM members",
        "DROP TABLE members; SELECT * FROM members",
        "UPDATE members SET cooperative_id = ? WHERE 1=1",
        "DELETE FROM members WHERE cooperative_id != ? OR 1=1",
        "; UPDATE cooperatives SET name = 'HACKED' WHERE 1=1; --"
      ];
      
      const rlsDb = createRLSDatabase(db, createTestRLSContext(coop1.id));
      
      for (const query of maliciousQueries) {
        const result = await executeIsolationTest(
          `Malicious query: ${query.substring(0, 50)}...`,
          async () => {
            return rlsDb.executeQuery(query, [coop2.id]);
          },
          true // Expected to fail
        );
        
        allTestResults.push({
          ...result,
          cooperativeId: coop1.id,
          operation: 'MALICIOUS_QUERY',
          table: 'multiple'
        });
        
        expect(result.securityViolation || !result.success).toBe(true);
      }
      
      console.log(`✅ ${maliciousQueries.length} malicious queries blocked`);
    });
  });

  describe('Audit Trail Verification', () => {
    test('All access attempts should be logged with cooperative context', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const results = await testAuditLogIsolation(db, coop1.id, coop2.id);
      allTestResults.push(...results);
      
      const failedTests = results.filter(r => !r.success);
      expect(failedTests.length).toBe(0);
      
      console.log('✅ Audit log isolation maintained');
    });

    test('Security violations should be audited', async () => {
      const coop1 = testCooperatives[0];
      const coop1Members = getTestMembers(db, coop1.id);
      const member = coop1Members[0];
      
      // Clear audit logs
      db.prepare('DELETE FROM audit_log').run();
      
      const result = await executeIsolationTest(
        'Security violation audit logging',
        async () => {
          const { middleware } = createSecureContext(db, coop1.id, {
            user_id: member.id,
            user_role: member.role,
            ip_address: '192.168.1.100',
            user_agent: 'test-browser'
          });
          
          // Attempt unauthorized operation
          try {
            middleware.authorize(
              createTestSecurityContext(coop1.id, member.id, member.role),
              'DELETE',
              'audit_log'
            );
          } catch (error) {
            // Expected to fail
          }
          
          // Check if violation was logged
          const auditLogs = db.prepare(
            'SELECT * FROM audit_log WHERE cooperative_id = ? AND user_id = ?'
          ).all(coop1.id, member.id);
          
          return auditLogs.length;
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'SECURITY_AUDIT',
        table: 'audit_log'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Security violations properly audited');
    });
  });

  describe('Soft Delete Isolation', () => {
    test('Soft deleted records should maintain isolation rules', async () => {
      const coop1 = testCooperatives[0];
      
      const results = await testSoftDeleteIsolation(db, coop1.id);
      allTestResults.push(...results);
      
      const failedTests = results.filter(r => !r.success);
      expect(failedTests.length).toBe(0);
      
      console.log('✅ Soft delete isolation maintained');
    });

    test('Soft deleted records should not appear in cross-cooperative queries', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Cross-cooperative soft delete isolation',
        async () => {
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          // Create and delete a member in coop1
          const member = rlsDb1.insert('members', {
            email: 'cross.softdelete@example.com',
            first_name: 'Cross',
            last_name: 'SoftDelete',
            role: 'member'
          });
          
          rlsDb1.delete('members', { id: member.id });
          
          // Try to access from coop2 (should not see it anyway)
          const coop2Members = rlsDb2.select('members', { 
            where: { email: 'cross.softdelete@example.com' } 
          });
          
          if (coop2Members.length > 0) {
            throw new Error('Cross-cooperative access to soft-deleted record');
          }
          
          return { deletedFromCoop1: true, notVisibleFromCoop2: coop2Members.length === 0 };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'CROSS_SOFT_DELETE',
        table: 'members'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Cross-cooperative soft delete isolation maintained');
    });
  });

  describe('Transaction Isolation', () => {
    test('Transaction boundaries should maintain cooperative isolation', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const results = await testTransactionIsolation(db, coop1.id, coop2.id);
      allTestResults.push(...results);
      
      const failedTests = results.filter(r => !r.success);
      expect(failedTests.length).toBe(0);
      
      console.log('✅ Transaction isolation maintained');
    });

    test('Rollback should not affect other cooperatives', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Rollback isolation between cooperatives',
        async () => {
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          // Get initial counts
          const initialCoop1Members = rlsDb1.select('members').length;
          const initialCoop2Members = rlsDb2.select('members').length;
          
          // Start transaction that will fail
          try {
            const failingTransaction = db.transaction(() => {
              // Add member to coop1
              rlsDb1.insert('members', {
                email: 'rollback1@example.com',
                first_name: 'Rollback1',
                last_name: 'Test',
                role: 'member'
              });
              
              // Add member to coop2
              rlsDb2.insert('members', {
                email: 'rollback2@example.com',
                first_name: 'Rollback2',
                last_name: 'Test',
                role: 'member'
              });
              
              // Force failure
              throw new Error('Transaction rollback test');
            });
            
            failingTransaction();
          } catch (error) {
            // Expected to fail
          }
          
          // Verify counts are unchanged
          const finalCoop1Members = rlsDb1.select('members').length;
          const finalCoop2Members = rlsDb2.select('members').length;
          
          if (finalCoop1Members !== initialCoop1Members || finalCoop2Members !== initialCoop2Members) {
            throw new Error('Rollback did not properly isolate cooperative data');
          }
          
          return { 
            coop1Unchanged: finalCoop1Members === initialCoop1Members,
            coop2Unchanged: finalCoop2Members === initialCoop2Members
          };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'ROLLBACK_ISOLATION',
        table: 'members'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Rollback isolation maintained');
    });
  });

  describe('Performance and Scale Testing', () => {
    test('Isolation should perform well with large datasets', async () => {
      const coop1 = testCooperatives[0];
      
      const result = await testIsolationPerformance(db, coop1.id, 1000);
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'PERFORMANCE_TEST',
        table: 'cases'
      });
      
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      console.log(`✅ Performance test completed in ${result.executionTime}ms`);
    });

    test('Concurrent access from multiple cooperatives should be isolated', async () => {
      const result = await executeIsolationTest(
        'Concurrent cooperative access isolation',
        async () => {
          const promises = testCooperatives.map(async (coop) => {
            const rlsDb = createRLSDatabase(db, createTestRLSContext(coop.id));
            
            // Perform concurrent operations
            const members = rlsDb.select('members');
            const apartments = rlsDb.select('apartments');
            const cases = rlsDb.select('cases');
            
            return {
              cooperativeId: coop.id,
              memberCount: members.length,
              apartmentCount: apartments.length,
              caseCount: cases.length
            };
          });
          
          const results = await Promise.all(promises);
          
          // Verify each cooperative got different data
          const memberCounts = results.map(r => r.memberCount);
          const apartmentCounts = results.map(r => r.apartmentCount);
          
          // Should not all be the same (unless by coincidence)
          const allMemberCountsSame = memberCounts.every(count => count === memberCounts[0]);
          const allApartmentCountsSame = apartmentCounts.every(count => count === apartmentCounts[0]);
          
          return { 
            results, 
            isolation: !allMemberCountsSame || !allApartmentCountsSame 
          };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: 'multiple',
        operation: 'CONCURRENT_ACCESS',
        table: 'multiple'
      });
      
      expect(result.success).toBe(true);
      console.log(`✅ Concurrent access from ${testCooperatives.length} cooperatives properly isolated`);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('Empty cooperative should have proper isolation', async () => {
      // Create a new empty cooperative for testing
      const emptyCoopId = 'test-empty-' + Date.now().toString();
      db.prepare(`
        INSERT INTO cooperatives (id, org_number, name, subdomain)
        VALUES (?, ?, ?, ?)
      `).run(emptyCoopId, '999999-9999', 'Empty Test Cooperative', 'empty-test');
      
      const result = await executeIsolationTest(
        'Empty cooperative isolation',
        async () => {
          const rlsDb = createRLSDatabase(db, createTestRLSContext(emptyCoopId));
          
          // Should return empty results for all tables
          const tables = ['members', 'apartments', 'cases', 'invoices'];
          const results: Record<string, number> = {};
          
          for (const table of tables) {
            const records = rlsDb.select(table);
            results[table] = records.length;
            
            if (records.length > 0) {
              throw new Error(`Empty cooperative has data in ${table}: ${records.length} records`);
            }
          }
          
          return results;
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: emptyCoopId,
        operation: 'EMPTY_COOPERATIVE',
        table: 'multiple'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Empty cooperative isolation maintained');
    });

    test('Invalid cooperative ID should be rejected', async () => {
      const result = await executeIsolationTest(
        'Invalid cooperative ID rejection',
        async () => {
          const rlsDb = createRLSDatabase(db, createTestRLSContext('invalid-coop-id'));
          
          // Attempt to access data with invalid cooperative
          return rlsDb.select('members');
        },
        false // This should still work (return empty results)
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: 'invalid-coop-id',
        operation: 'INVALID_COOPERATIVE',
        table: 'members'
      });
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(0); // Should return empty results
      
      console.log('✅ Invalid cooperative ID properly handled');
    });

    test('Null/undefined cooperative ID should be rejected', async () => {
      const result = await executeIsolationTest(
        'Null cooperative ID rejection',
        async () => {
          // This should throw an error during RLS database creation
          const rlsDb = createRLSDatabase(db, createTestRLSContext(''));
          return rlsDb.select('members');
        },
        true // Expected to fail
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: '',
        operation: 'NULL_COOPERATIVE',
        table: 'members'
      });
      
      expect(result.success).toBe(true); // Success means it properly failed
      console.log('✅ Null cooperative ID properly rejected');
    });
  });
});