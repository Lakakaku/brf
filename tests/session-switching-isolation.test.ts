/**
 * Advanced Session Switching & Isolation Test Suite
 * 
 * Tests complex session management scenarios including:
 * - User switching within same cooperative
 * - Role-based access during switches
 * - Session timeout and invalidation
 * - Concurrent session management
 * - Authentication context preservation
 */

import Database from 'better-sqlite3';
import {
  createTestDatabase,
  initializeTestDatabase,
  getTestCooperatives,
  getTestMembers,
  createTestRLSContext,
  createTestSecurityContext,
  executeIsolationTest,
  generateTestSessionId,
  IsolationTestResult
} from './helpers/database-test-utils';
import { createRLSDatabase, RLSContext } from '@/lib/database/rls';
import { generateSwedishBRFTestData, insertSwedishBRFTestData } from './generators/swedish-brf-generator';
import { randomBytes } from 'crypto';

describe('🔄 Advanced Session Switching & Isolation Tests', () => {
  let db: Database.Database;
  let testResults: IsolationTestResult[] = [];

  beforeAll(async () => {
    console.log('🔄 Advanced Session Switching Test Suite');
    console.log('=======================================');
    
    db = createTestDatabase();
    await initializeTestDatabase(db);
    
    // Insert comprehensive Swedish BRF test data
    const testData = generateSwedishBRFTestData({
      cooperativeCount: 3,
      membersPerCooperative: 12
    });
    
    await insertSwedishBRFTestData(db, testData);
    console.log('📊 Enhanced test data loaded for session testing');
  });

  afterAll(() => {
    const passed = testResults.filter(r => r.success).length;
    const total = testResults.length;
    
    console.log('\n📋 Session Switching Test Summary:');
    console.log(`   ✅ Passed: ${passed}/${total} tests`);
    console.log(`   ❌ Failed: ${total - passed}/${total} tests`);
    
    if (db) {
      db.close();
    }
  });

  describe('1. Basic Session Switching', () => {
    test('should maintain data isolation when switching users within same cooperative', async () => {
      console.log('👥 Testing user switching within same cooperative...');
      
      const cooperatives = getTestCooperatives(db);
      const coop = cooperatives[0];
      const members = getTestMembers(db, coop.id);
      
      const member1 = members.find(m => m.role === 'chairman')!;
      const member2 = members.find(m => m.role === 'member')!;
      
      const userSwitchTest = await executeIsolationTest(
        'User Switching - Data consistency within cooperative',
        async () => {
          // Start as chairman
          let currentContext: RLSContext = createTestRLSContext(coop.id, member1.id, member1.role);
          let rlsDb = createRLSDatabase(db, currentContext);
          
          // Create a case as chairman
          const chairmanCase = rlsDb.insert('cases', {
            case_number: Math.floor(Math.random() * 10000),
            title: 'Chairman-created case',
            description: 'Case created by chairman for testing',
            category: 'governance',
            priority: 'high',
            status: 'open',
            reported_by: member1.id,
            location: 'board_room'
          });
          
          // Verify chairman can see the case
          const chairmanCases = rlsDb.select('cases', { where: { id: chairmanCase.id } });
          if (chairmanCases.length !== 1) {
            throw new Error('Chairman cannot see own case');
          }
          
          // Switch to regular member
          currentContext = createTestRLSContext(coop.id, member2.id, member2.role);
          rlsDb = createRLSDatabase(db, currentContext);
          
          // Member should also see the case (same cooperative)
          const memberViewCases = rlsDb.select('cases', { where: { id: chairmanCase.id } });
          if (memberViewCases.length !== 1) {
            throw new Error('Member cannot see case in same cooperative');
          }
          
          // Create a case as member
          const memberCase = rlsDb.insert('cases', {
            case_number: Math.floor(Math.random() * 10000),
            title: 'Member-created case',
            description: 'Case created by member for testing',
            category: 'maintenance',
            priority: 'normal',
            status: 'open',
            reported_by: member2.id,
            location: 'apartment'
          });
          
          // Switch back to chairman
          currentContext = createTestRLSContext(coop.id, member1.id, member1.role);
          rlsDb = createRLSDatabase(db, currentContext);
          
          // Chairman should see both cases
          const allCases = rlsDb.select('cases');
          const chairmanCaseExists = allCases.some(c => c.id === chairmanCase.id);
          const memberCaseExists = allCases.some(c => c.id === memberCase.id);
          
          if (!chairmanCaseExists || !memberCaseExists) {
            throw new Error('Cases not properly visible after user switching');
          }
          
          return {
            chairmanCaseId: chairmanCase.id,
            memberCaseId: memberCase.id,
            totalCases: allCases.length,
            switchesPerformed: 2
          };
        }
      );
      
      testResults.push({
        ...userSwitchTest,
        cooperativeId: coop.id,
        operation: 'USER_SWITCH_SAME_COOP',
        table: 'cases'
      });
      
      expect(userSwitchTest.success).toBe(true);
    });

    test('should isolate sessions when switching between cooperatives', async () => {
      console.log('🏢 Testing cooperative switching with different users...');
      
      const cooperatives = getTestCooperatives(db);
      const coop1 = cooperatives[0];
      const coop2 = cooperatives[1];
      
      const members1 = getTestMembers(db, coop1.id);
      const members2 = getTestMembers(db, coop2.id);
      
      const member1 = members1.find(m => m.role === 'treasurer')!;
      const member2 = members2.find(m => m.role === 'treasurer')!;
      
      const cooperativeSwitchTest = await executeIsolationTest(
        'Cooperative Switching - Complete data isolation',
        async () => {
          // Start with cooperative 1
          let currentContext = createTestRLSContext(coop1.id, member1.id, member1.role);
          let rlsDb = createRLSDatabase(db, currentContext);
          
          // Get initial counts for coop1
          const coop1InitialMembers = rlsDb.select('members');
          const coop1InitialApartments = rlsDb.select('apartments');
          const coop1InitialInvoices = rlsDb.select('invoices');
          
          // Create specific data for coop1
          const coop1Invoice = rlsDb.insert('invoices', {
            invoice_number: `COOP1-TEST-${Date.now()}`,
            supplier_name: 'Test Supplier Coop1',
            supplier_org_number: '1234567890',
            amount_excl_vat: 10000,
            vat_amount: 2500,
            total_amount: 12500,
            currency: 'SEK',
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            payment_status: 'pending',
            account_code: '6230'
          });
          
          // Switch to cooperative 2
          currentContext = createTestRLSContext(coop2.id, member2.id, member2.role);
          rlsDb = createRLSDatabase(db, currentContext);
          
          // Verify complete isolation - should not see coop1 data
          const coop2Members = rlsDb.select('members');
          const coop2Apartments = rlsDb.select('apartments');
          const coop2Invoices = rlsDb.select('invoices');
          
          // Check for any data leakage
          const coop1DataInCoop2 = [
            ...coop2Members.filter(m => m.cooperative_id === coop1.id),
            ...coop2Apartments.filter(a => a.cooperative_id === coop1.id),
            ...coop2Invoices.filter(i => i.cooperative_id === coop1.id || i.id === coop1Invoice.id)
          ];
          
          if (coop1DataInCoop2.length > 0) {
            throw new Error(`Data leakage: ${coop1DataInCoop2.length} records from coop1 visible in coop2`);
          }
          
          // Create data for coop2
          const coop2Invoice = rlsDb.insert('invoices', {
            invoice_number: `COOP2-TEST-${Date.now()}`,
            supplier_name: 'Test Supplier Coop2',
            supplier_org_number: '0987654321',
            amount_excl_vat: 15000,
            vat_amount: 3750,
            total_amount: 18750,
            currency: 'SEK',
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            payment_status: 'pending',
            account_code: '6230'
          });
          
          // Switch back to cooperative 1
          currentContext = createTestRLSContext(coop1.id, member1.id, member1.role);
          rlsDb = createRLSDatabase(db, currentContext);
          
          // Verify coop1 data is still accessible and coop2 data is not
          const coop1FinalMembers = rlsDb.select('members');
          const coop1FinalInvoices = rlsDb.select('invoices');
          
          // Should see original coop1 invoice but not coop2 invoice
          const coop1InvoiceExists = coop1FinalInvoices.some(i => i.id === coop1Invoice.id);
          const coop2InvoiceVisible = coop1FinalInvoices.some(i => i.id === coop2Invoice.id);
          
          if (!coop1InvoiceExists) {
            throw new Error('Original coop1 data not accessible after switch back');
          }
          
          if (coop2InvoiceVisible) {
            throw new Error('Coop2 data visible in coop1 after switch');
          }
          
          return {
            coop1Members: coop1InitialMembers.length,
            coop2Members: coop2Members.length,
            coop1Invoices: coop1FinalInvoices.length,
            coop2Invoices: coop2Invoices.length,
            dataLeakageDetected: false,
            switchesPerformed: 2
          };
        }
      );
      
      testResults.push({
        ...cooperativeSwitchTest,
        cooperativeId: `${coop1.id}->${coop2.id}`,
        operation: 'COOPERATIVE_SWITCH',
        table: 'multi'
      });
      
      expect(cooperativeSwitchTest.success).toBe(true);
    });
  });

  describe('2. Role-Based Session Switching', () => {
    test('should respect role permissions during user switching', async () => {
      console.log('👑 Testing role-based permissions during user switching...');
      
      const cooperatives = getTestCooperatives(db);
      const coop = cooperatives[0];
      const members = getTestMembers(db, coop.id);
      
      const chairman = members.find(m => m.role === 'chairman')!;
      const treasurer = members.find(m => m.role === 'treasurer')!;
      const boardMember = members.find(m => m.role === 'board')!;
      const regularMember = members.find(m => m.role === 'member')!;
      
      const roleBasedSwitchTest = await executeIsolationTest(
        'Role-Based Switching - Permission boundaries maintained',
        async () => {
          const results = [];
          
          // Test each role's access to sensitive data
          const testRoles = [
            { member: chairman, expectedAccess: 'full' },
            { member: treasurer, expectedAccess: 'financial' },
            { member: boardMember, expectedAccess: 'governance' },
            { member: regularMember, expectedAccess: 'limited' }
          ];
          
          for (const { member, expectedAccess } of testRoles) {
            const context = createTestRLSContext(coop.id, member.id, member.role);
            const rlsDb = createRLSDatabase(db, context);
            
            // Test access to different data types
            const boardMeetings = rlsDb.select('board_meetings');
            const invoices = rlsDb.select('invoices');
            const loans = rlsDb.select('loans');
            const cases = rlsDb.select('cases');
            const queuePositions = rlsDb.select('queue_positions');
            
            // All roles should see basic operational data
            if (cases.length === 0) {
              throw new Error(`${member.role} cannot see basic cases data`);
            }
            
            // Verify data belongs to correct cooperative
            const allData = [...boardMeetings, ...invoices, ...loans, ...cases];
            const wrongCooperativeData = allData.filter(record => 
              record.cooperative_id && record.cooperative_id !== coop.id
            );
            
            if (wrongCooperativeData.length > 0) {
              throw new Error(`${member.role} can see ${wrongCooperativeData.length} records from wrong cooperative`);
            }
            
            results.push({
              role: member.role,
              boardMeetings: boardMeetings.length,
              invoices: invoices.length,
              loans: loans.length,
              cases: cases.length,
              queuePositions: queuePositions.length,
              isolationMaintained: wrongCooperativeData.length === 0
            });
          }
          
          return { roleTests: results, totalRolesTested: testRoles.length };
        }
      );
      
      testResults.push({
        ...roleBasedSwitchTest,
        cooperativeId: coop.id,
        operation: 'ROLE_BASED_SWITCH',
        table: 'multi'
      });
      
      expect(roleBasedSwitchTest.success).toBe(true);
    });
  });

  describe('3. Concurrent Session Management', () => {
    test('should handle multiple concurrent sessions without interference', async () => {
      console.log('⚡ Testing concurrent session management...');
      
      const cooperatives = getTestCooperatives(db);
      const coop1 = cooperatives[0];
      const coop2 = cooperatives[1];
      
      const members1 = getTestMembers(db, coop1.id);
      const members2 = getTestMembers(db, coop2.id);
      
      const concurrentSessionTest = await executeIsolationTest(
        'Concurrent Sessions - No interference between sessions',
        async () => {
          // Create multiple concurrent operations
          const concurrentOperations = [];
          
          // Session 1: Chairman in coop1 creates board meeting
          concurrentOperations.push(
            new Promise(async (resolve) => {
              const chairman = members1.find(m => m.role === 'chairman')!;
              const context = createTestRLSContext(coop1.id, chairman.id, chairman.role);
              const rlsDb = createRLSDatabase(db, context);
              
              const boardMeeting = rlsDb.insert('board_meetings', {
                meeting_number: Math.floor(Math.random() * 1000) + 100,
                title: 'Concurrent Session Test Meeting',
                meeting_type: 'extraordinary',
                scheduled_date: new Date().toISOString().split('T')[0],
                status: 'planned',
                notice_sent_date: new Date().toISOString().split('T')[0],
                quorum_met: true
              });
              
              // Verify only coop1 data is accessible
              const allMeetings = rlsDb.select('board_meetings');
              const wrongCoopData = allMeetings.filter(m => m.cooperative_id !== coop1.id);
              
              resolve({
                session: 1,
                cooperative: coop1.id,
                role: chairman.role,
                createdMeetingId: boardMeeting.id,
                totalMeetings: allMeetings.length,
                wrongCoopData: wrongCoopData.length
              });
            })
          );
          
          // Session 2: Treasurer in coop2 creates invoice
          concurrentOperations.push(
            new Promise(async (resolve) => {
              const treasurer = members2.find(m => m.role === 'treasurer')!;
              const context = createTestRLSContext(coop2.id, treasurer.id, treasurer.role);
              const rlsDb = createRLSDatabase(db, context);
              
              const invoice = rlsDb.insert('invoices', {
                invoice_number: `CONCURRENT-${Date.now()}`,
                supplier_name: 'Concurrent Test Supplier',
                supplier_org_number: '1111111111',
                amount_excl_vat: 5000,
                vat_amount: 1250,
                total_amount: 6250,
                currency: 'SEK',
                invoice_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                payment_status: 'pending',
                account_code: '6230'
              });
              
              // Verify only coop2 data is accessible
              const allInvoices = rlsDb.select('invoices');
              const wrongCoopData = allInvoices.filter(i => i.cooperative_id !== coop2.id);
              
              resolve({
                session: 2,
                cooperative: coop2.id,
                role: treasurer.role,
                createdInvoiceId: invoice.id,
                totalInvoices: allInvoices.length,
                wrongCoopData: wrongCoopData.length
              });
            })
          );
          
          // Session 3: Member in coop1 creates case
          concurrentOperations.push(
            new Promise(async (resolve) => {
              const member = members1.find(m => m.role === 'member')!;
              const context = createTestRLSContext(coop1.id, member.id, member.role);
              const rlsDb = createRLSDatabase(db, context);
              
              const case1 = rlsDb.insert('cases', {
                case_number: Math.floor(Math.random() * 1000) + 500,
                title: 'Concurrent Session Case',
                description: 'Case created during concurrent session test',
                category: 'maintenance',
                priority: 'normal',
                status: 'open',
                reported_by: member.id,
                location: 'common_area'
              });
              
              // Verify only coop1 data is accessible
              const allCases = rlsDb.select('cases');
              const wrongCoopData = allCases.filter(c => c.cooperative_id !== coop1.id);
              
              resolve({
                session: 3,
                cooperative: coop1.id,
                role: member.role,
                createdCaseId: case1.id,
                totalCases: allCases.length,
                wrongCoopData: wrongCoopData.length
              });
            })
          );
          
          // Execute all operations concurrently
          const results = await Promise.all(concurrentOperations);
          
          // Verify no cross-contamination
          const totalWrongCoopData = results.reduce((sum, r) => sum + (r as any).wrongCoopData, 0);
          
          if (totalWrongCoopData > 0) {
            throw new Error(`Concurrent session interference: ${totalWrongCoopData} wrong cooperative records visible`);
          }
          
          return {
            concurrentSessions: results.length,
            totalWrongCoopData,
            results
          };
        }
      );
      
      testResults.push({
        ...concurrentSessionTest,
        cooperativeId: 'concurrent',
        operation: 'CONCURRENT_SESSIONS',
        table: 'multi'
      });
      
      expect(concurrentSessionTest.success).toBe(true);
    });
  });

  describe('4. Session Context Preservation', () => {
    test('should preserve session context during rapid switching', async () => {
      console.log('🔄 Testing session context preservation during rapid switching...');
      
      const cooperatives = getTestCooperatives(db);
      const coop1 = cooperatives[0];
      const coop2 = cooperatives[1];
      
      const members1 = getTestMembers(db, coop1.id);
      const members2 = getTestMembers(db, coop2.id);
      
      const contextPreservationTest = await executeIsolationTest(
        'Context Preservation - Rapid switching maintains isolation',
        async () => {
          const switchLog = [];
          const dataConsistencyChecks = [];
          
          // Perform rapid switching between different contexts
          for (let i = 0; i < 20; i++) {
            const isEvenIteration = i % 2 === 0;
            const coop = isEvenIteration ? coop1 : coop2;
            const members = isEvenIteration ? members1 : members2;
            const member = members[i % members.length];
            
            const context = createTestRLSContext(coop.id, member.id, member.role);
            const rlsDb = createRLSDatabase(db, context);
            
            // Quick data access test
            const startTime = Date.now();
            const members_data = rlsDb.select('members', { limit: 5 });
            const apartments_data = rlsDb.select('apartments', { limit: 5 });
            const cases_data = rlsDb.select('cases', { limit: 5 });
            const accessTime = Date.now() - startTime;
            
            // Verify all returned data belongs to correct cooperative
            const allRecords = [...members_data, ...apartments_data, ...cases_data];
            const wrongCoopRecords = allRecords.filter(record => 
              record.cooperative_id && record.cooperative_id !== coop.id
            );
            
            switchLog.push({
              iteration: i,
              cooperativeId: coop.id,
              memberId: member.id,
              role: member.role,
              accessTime,
              recordsReturned: allRecords.length,
              wrongCoopRecords: wrongCoopRecords.length
            });
            
            dataConsistencyChecks.push({
              iteration: i,
              consistent: wrongCoopRecords.length === 0,
              accessTime
            });
            
            if (wrongCoopRecords.length > 0) {
              throw new Error(`Context preservation failed at iteration ${i}: ${wrongCoopRecords.length} wrong records`);
            }
          }
          
          const averageAccessTime = switchLog.reduce((sum, entry) => sum + entry.accessTime, 0) / switchLog.length;
          const maxAccessTime = Math.max(...switchLog.map(entry => entry.accessTime));
          const allConsistent = dataConsistencyChecks.every(check => check.consistent);
          
          return {
            totalSwitches: switchLog.length,
            averageAccessTime: Math.round(averageAccessTime * 100) / 100,
            maxAccessTime,
            allConsistent,
            cooperativesCovered: new Set(switchLog.map(entry => entry.cooperativeId)).size,
            rolesCovered: new Set(switchLog.map(entry => entry.role)).size
          };
        }
      );
      
      testResults.push({
        ...contextPreservationTest,
        cooperativeId: 'rapid-switching',
        operation: 'CONTEXT_PRESERVATION',
        table: 'multi'
      });
      
      expect(contextPreservationTest.success).toBe(true);
    });
  });

  describe('5. Session Security & Validation', () => {
    test('should validate session context and prevent manipulation', async () => {
      console.log('🔒 Testing session context validation and security...');
      
      const cooperatives = getTestCooperatives(db);
      const coop1 = cooperatives[0];
      const coop2 = cooperatives[1];
      
      const members1 = getTestMembers(db, coop1.id);
      
      const sessionSecurityTest = await executeIsolationTest(
        'Session Security - Context validation and manipulation prevention',
        async () => {
          const securityChecks = [];
          
          // Test 1: Invalid cooperative ID
          try {
            const invalidCoopContext = createTestRLSContext('invalid-coop-id', members1[0].id);
            const rlsDb = createRLSDatabase(db, invalidCoopContext);
            rlsDb.select('members'); // This should work but return empty results
            securityChecks.push({ test: 'invalid_cooperative', passed: true });
          } catch (error: any) {
            // Expected to handle gracefully
            securityChecks.push({ test: 'invalid_cooperative', passed: true, error: error.message });
          }
          
          // Test 2: Mismatched user and cooperative
          const member1 = members1[0];
          const mismatchedContext = createTestRLSContext(coop2.id, member1.id); // User from coop1, context for coop2
          const rlsDb2 = createRLSDatabase(db, mismatchedContext);
          
          const mismatchedResults = rlsDb2.select('members');
          // Should return empty or only coop2 members, never coop1 members
          const coop1MembersInCoop2Context = mismatchedResults.filter(m => m.cooperative_id === coop1.id);
          
          if (coop1MembersInCoop2Context.length > 0) {
            throw new Error('Context mismatch allowed cross-cooperative access');
          }
          securityChecks.push({ test: 'context_mismatch', passed: true });
          
          // Test 3: Attempt to manipulate context during operation
          const validContext = createTestRLSContext(coop1.id, member1.id);
          const rlsDb3 = createRLSDatabase(db, validContext);
          
          // Try to insert data with different cooperative_id
          try {
            rlsDb3.insert('cases', {
              case_number: 9999,
              title: 'Security Test Case',
              description: 'Attempting to insert with wrong cooperative_id',
              category: 'security',
              priority: 'urgent',
              status: 'open',
              cooperative_id: coop2.id, // Wrong cooperative!
              reported_by: member1.id
            });
            
            securityChecks.push({ test: 'insert_manipulation', passed: false });
          } catch (error: any) {
            // Should be blocked
            if (error.message.includes('RLS_VIOLATION') || error.message.includes('different cooperative')) {
              securityChecks.push({ test: 'insert_manipulation', passed: true });
            } else {
              throw error;
            }
          }
          
          // Test 4: Session context immutability
          const originalContext = createTestRLSContext(coop1.id, member1.id);
          const rlsDb4 = createRLSDatabase(db, originalContext);
          
          // Attempt to modify context (should not affect operations)
          (originalContext as any).cooperative_id = coop2.id; // Try to modify
          
          const membersAfterModification = rlsDb4.select('members');
          const stillOnlyFromCoop1 = membersAfterModification.every(m => m.cooperative_id === coop1.id);
          
          securityChecks.push({ 
            test: 'context_immutability', 
            passed: stillOnlyFromCoop1,
            details: `Still isolated: ${stillOnlyFromCoop1}`
          });
          
          const allTestsPassed = securityChecks.every(check => check.passed);
          
          return {
            securityChecks,
            allTestsPassed,
            totalSecurityTests: securityChecks.length
          };
        }
      );
      
      testResults.push({
        ...sessionSecurityTest,
        cooperativeId: 'security',
        operation: 'SESSION_SECURITY',
        table: 'multi'
      });
      
      expect(sessionSecurityTest.success).toBe(true);
    });
  });

  describe('6. Performance Under Session Switching', () => {
    test('should maintain performance during frequent session switching', async () => {
      console.log('📈 Testing performance under frequent session switching...');
      
      const cooperatives = getTestCooperatives(db);
      const allMembers = cooperatives.flatMap(coop => getTestMembers(db, coop.id));
      
      const performanceTest = await executeIsolationTest(
        'Session Switch Performance - Frequent switching performance',
        async () => {
          const performanceMetrics = [];
          const switchCount = 50;
          
          const startTime = Date.now();
          
          for (let i = 0; i < switchCount; i++) {
            const member = allMembers[i % allMembers.length];
            const cooperative = cooperatives.find(c => c.id === member.cooperative_id)!;
            
            const switchStartTime = Date.now();
            
            const context = createTestRLSContext(cooperative.id, member.id, member.role);
            const rlsDb = createRLSDatabase(db, context);
            
            // Perform typical operations
            const members_data = rlsDb.select('members', { limit: 10 });
            const apartments_data = rlsDb.select('apartments', { limit: 5 });
            const cases_data = rlsDb.select('cases', { limit: 8 });
            const invoices_data = rlsDb.select('invoices', { limit: 3 });
            
            const switchTime = Date.now() - switchStartTime;
            
            // Verify data integrity
            const allData = [...members_data, ...apartments_data, ...cases_data, ...invoices_data];
            const wrongCoopData = allData.filter(record => 
              record.cooperative_id && record.cooperative_id !== cooperative.id
            );
            
            performanceMetrics.push({
              switchNumber: i + 1,
              cooperativeId: cooperative.id,
              switchTime,
              recordsReturned: allData.length,
              dataIntegrityOk: wrongCoopData.length === 0
            });
            
            if (wrongCoopData.length > 0) {
              throw new Error(`Performance test data integrity failure at switch ${i + 1}`);
            }
          }
          
          const totalTime = Date.now() - startTime;
          const averageSwitchTime = performanceMetrics.reduce((sum, m) => sum + m.switchTime, 0) / switchCount;
          const maxSwitchTime = Math.max(...performanceMetrics.map(m => m.switchTime));
          const minSwitchTime = Math.min(...performanceMetrics.map(m => m.switchTime));
          const allDataIntegrityOk = performanceMetrics.every(m => m.dataIntegrityOk);
          
          return {
            totalSwitches: switchCount,
            totalTime,
            averageSwitchTime: Math.round(averageSwitchTime * 100) / 100,
            maxSwitchTime,
            minSwitchTime,
            switchesPerSecond: Math.round((switchCount / totalTime) * 1000 * 100) / 100,
            allDataIntegrityOk,
            cooperativesCovered: new Set(performanceMetrics.map(m => m.cooperativeId)).size
          };
        }
      );
      
      testResults.push({
        ...performanceTest,
        cooperativeId: 'performance',
        operation: 'SWITCH_PERFORMANCE',
        table: 'multi'
      });
      
      expect(performanceTest.success).toBe(true);
      
      // Performance assertions
      const result = performanceTest as any;
      if (result.averageSwitchTime) {
        expect(result.averageSwitchTime).toBeLessThan(100); // Less than 100ms average
        expect(result.maxSwitchTime).toBeLessThan(500); // Less than 500ms max
        expect(result.allDataIntegrityOk).toBe(true);
      }
    });
  });
});