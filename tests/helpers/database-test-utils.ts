/**
 * Database Test Utilities
 * 
 * Helper functions for testing database isolation and security features
 * in the Swedish BRF management system.
 */

import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import { createRLSDatabase, RLSContext } from '@/lib/database/rls';
import { createSecureContext, SecurityContext } from '@/lib/database/security';
import { createSchema, createIndexes, createTriggers, dropSchema } from '@/lib/database/schema';
import { seedDevelopmentData, clearAllData } from '@/lib/database/seeds/development';

export interface TestCooperative {
  id: string;
  name: string;
  subdomain: string;
  org_number: string;
}

export interface TestMember {
  id: string;
  cooperative_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'member' | 'board' | 'chairman' | 'treasurer' | 'admin';
}

export interface TestApartment {
  id: string;
  cooperative_id: string;
  apartment_number: string;
  owner_id?: string;
}

export interface IsolationTestResult {
  testName: string;
  cooperativeId: string;
  operation: string;
  table: string;
  success: boolean;
  recordCount?: number;
  error?: string;
  executionTime: number;
  securityViolation?: boolean;
  auditLogEntries?: number;
}

/**
 * Create a test database with schema and seed data
 */
export function createTestDatabase(): Database.Database {
  // Create in-memory database for testing
  const db = new Database(':memory:');
  
  // Enable WAL mode and foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  return db;
}

/**
 * Initialize test database with schema and seed data
 */
export async function initializeTestDatabase(db: Database.Database): Promise<void> {
  // Create schema
  createSchema(db);
  createIndexes(db);
  createTriggers(db);
  
  // Seed with development data
  await seedDevelopmentData(db);
}

/**
 * Get test cooperatives from the database
 */
export function getTestCooperatives(db: Database.Database): TestCooperative[] {
  return db.prepare(`
    SELECT id, name, subdomain, org_number 
    FROM cooperatives 
    WHERE deleted_at IS NULL 
    ORDER BY created_at
  `).all() as TestCooperative[];
}

/**
 * Get test members for a cooperative
 */
export function getTestMembers(db: Database.Database, cooperativeId: string): TestMember[] {
  return db.prepare(`
    SELECT id, cooperative_id, email, first_name, last_name, role
    FROM members 
    WHERE cooperative_id = ? AND deleted_at IS NULL
    ORDER BY created_at
  `).all(cooperativeId) as TestMember[];
}

/**
 * Get test apartments for a cooperative
 */
export function getTestApartments(db: Database.Database, cooperativeId: string): TestApartment[] {
  return db.prepare(`
    SELECT id, cooperative_id, apartment_number, owner_id
    FROM apartments 
    WHERE cooperative_id = ?
    ORDER BY apartment_number
  `).all(cooperativeId) as TestApartment[];
}

/**
 * Create RLS context for testing
 */
export function createTestRLSContext(
  cooperativeId: string, 
  userId?: string, 
  userRole?: string
): RLSContext {
  return {
    cooperative_id: cooperativeId,
    user_id: userId,
    user_role: userRole,
    ip_address: '127.0.0.1',
    user_agent: 'test-agent'
  };
}

/**
 * Create security context for testing
 */
export function createTestSecurityContext(
  cooperativeId: string,
  userId?: string,
  userRole?: 'member' | 'board' | 'chairman' | 'treasurer' | 'admin'
): SecurityContext {
  return {
    cooperative_id: cooperativeId,
    user_id: userId,
    user_role: userRole,
    ip_address: '127.0.0.1',
    user_agent: 'test-agent',
    session_id: generateTestSessionId()
  };
}

/**
 * Generate a test session ID
 */
export function generateTestSessionId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Execute isolation test and capture results
 */
export async function executeIsolationTest(
  testName: string,
  operation: () => Promise<any> | any,
  expectedSecurityViolation: boolean = false
): Promise<IsolationTestResult> {
  const startTime = Date.now();
  let result: IsolationTestResult = {
    testName,
    cooperativeId: 'unknown',
    operation: 'unknown',
    table: 'unknown',
    success: false,
    executionTime: 0,
    securityViolation: false
  };

  try {
    const operationResult = await operation();
    const executionTime = Date.now() - startTime;
    
    result = {
      ...result,
      success: !expectedSecurityViolation,
      executionTime,
      recordCount: Array.isArray(operationResult) ? operationResult.length : 1
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    const isSecurityViolation = error.message && (
      error.message.includes('RLS_VIOLATION') ||
      error.message.includes('RLS_ERROR') ||
      error.message.includes('AUTHORIZATION_DENIED')
    );
    
    result = {
      ...result,
      success: expectedSecurityViolation && isSecurityViolation,
      executionTime,
      error: error.message,
      securityViolation: isSecurityViolation
    };
  }

  return result;
}

/**
 * Test data isolation for a specific table
 */
export async function testTableIsolation(
  db: Database.Database,
  table: string,
  cooperativeId: string,
  otherCooperativeId: string
): Promise<IsolationTestResult[]> {
  const results: IsolationTestResult[] = [];
  const rlsDb = createRLSDatabase(db, createTestRLSContext(cooperativeId));
  
  // Test 1: Select own cooperative data
  const ownDataTest = await executeIsolationTest(
    `${table} - Select own cooperative data`,
    async () => {
      return rlsDb.select(table);
    }
  );
  results.push({
    ...ownDataTest,
    cooperativeId,
    operation: 'SELECT',
    table
  });

  // Test 2: Try to select other cooperative data (should return empty)
  const otherRlsDb = createRLSDatabase(db, createTestRLSContext(otherCooperativeId));
  const otherDataTest = await executeIsolationTest(
    `${table} - Other cooperative should see different data`,
    async () => {
      const ownData = rlsDb.select(table);
      const otherData = otherRlsDb.select(table);
      
      // Both should return data, but different data
      if (ownData.length === 0 && otherData.length === 0) {
        throw new Error('Both cooperatives returned empty results');
      }
      
      // Check that no records overlap
      const ownIds = ownData.map((record: any) => record.id);
      const otherIds = otherData.map((record: any) => record.id);
      const overlap = ownIds.filter(id => otherIds.includes(id));
      
      if (overlap.length > 0) {
        throw new Error(`Data isolation violation: ${overlap.length} overlapping records`);
      }
      
      return { ownCount: ownData.length, otherCount: otherData.length, overlap: overlap.length };
    }
  );
  results.push({
    ...otherDataTest,
    cooperativeId: otherCooperativeId,
    operation: 'ISOLATION_CHECK',
    table
  });

  return results;
}

/**
 * Test RLS bypass attempts
 */
export async function testRLSBypassAttempts(
  db: Database.Database,
  cooperativeId: string,
  otherCooperativeId: string
): Promise<IsolationTestResult[]> {
  const results: IsolationTestResult[] = [];
  const rlsDb = createRLSDatabase(db, createTestRLSContext(cooperativeId));
  
  // Attempt 1: Try to insert data for different cooperative
  const insertBypassTest = await executeIsolationTest(
    'RLS Bypass - Insert different cooperative_id',
    async () => {
      return rlsDb.insert('members', {
        email: 'bypass.test@example.com',
        first_name: 'Bypass',
        last_name: 'Test',
        cooperative_id: otherCooperativeId, // This should be rejected
        role: 'member'
      });
    },
    true // Expected to fail
  );
  results.push({
    ...insertBypassTest,
    cooperativeId,
    operation: 'INSERT_BYPASS',
    table: 'members'
  });

  // Attempt 2: Try to update cooperative_id to different value
  const updateBypassTest = await executeIsolationTest(
    'RLS Bypass - Update cooperative_id',
    async () => {
      const members = rlsDb.select('members', { limit: 1 });
      if (members.length === 0) {
        throw new Error('No members found for test');
      }
      
      return rlsDb.update('members', 
        { cooperative_id: otherCooperativeId },
        { id: members[0].id }
      );
    },
    true // Expected to fail
  );
  results.push({
    ...updateBypassTest,
    cooperativeId,
    operation: 'UPDATE_BYPASS',
    table: 'members'
  });

  // Attempt 3: Try dangerous custom query
  const queryBypassTest = await executeIsolationTest(
    'RLS Bypass - Dangerous custom query',
    async () => {
      return rlsDb.executeQuery(
        "SELECT * FROM members WHERE cooperative_id != ? UNION SELECT * FROM members",
        [cooperativeId]
      );
    },
    true // Expected to fail
  );
  results.push({
    ...queryBypassTest,
    cooperativeId,
    operation: 'CUSTOM_QUERY_BYPASS',
    table: 'members'
  });

  return results;
}

/**
 * Test soft delete isolation
 */
export async function testSoftDeleteIsolation(
  db: Database.Database,
  cooperativeId: string
): Promise<IsolationTestResult[]> {
  const results: IsolationTestResult[] = [];
  const rlsDb = createRLSDatabase(db, createTestRLSContext(cooperativeId));
  
  // Create a test member
  const testMember = rlsDb.insert('members', {
    email: 'softdelete.test@example.com',
    first_name: 'SoftDelete',
    last_name: 'Test',
    role: 'member'
  });

  // Test 1: Verify member exists
  const existsTest = await executeIsolationTest(
    'Soft Delete - Member exists before deletion',
    async () => {
      return rlsDb.select('members', { where: { id: testMember.id } });
    }
  );
  results.push({
    ...existsTest,
    cooperativeId,
    operation: 'SELECT_BEFORE_DELETE',
    table: 'members'
  });

  // Test 2: Soft delete the member
  const deleteTest = await executeIsolationTest(
    'Soft Delete - Delete member',
    async () => {
      return rlsDb.delete('members', { id: testMember.id });
    }
  );
  results.push({
    ...deleteTest,
    cooperativeId,
    operation: 'SOFT_DELETE',
    table: 'members'
  });

  // Test 3: Verify member is no longer visible
  const hiddenTest = await executeIsolationTest(
    'Soft Delete - Member hidden after deletion',
    async () => {
      const members = rlsDb.select('members', { where: { id: testMember.id } });
      if (members.length > 0) {
        throw new Error('Soft-deleted member is still visible');
      }
      return members;
    }
  );
  results.push({
    ...hiddenTest,
    cooperativeId,
    operation: 'SELECT_AFTER_DELETE',
    table: 'members'
  });

  // Test 4: Verify member still exists in database (with deleted_at)
  const stillExistsTest = await executeIsolationTest(
    'Soft Delete - Member still exists in database',
    async () => {
      const rawMember = db.prepare('SELECT * FROM members WHERE id = ?').get(testMember.id);
      if (!rawMember) {
        throw new Error('Member was hard-deleted instead of soft-deleted');
      }
      if (!rawMember.deleted_at) {
        throw new Error('Member was not marked as deleted');
      }
      return rawMember;
    }
  );
  results.push({
    ...stillExistsTest,
    cooperativeId,
    operation: 'VERIFY_SOFT_DELETE',
    table: 'members'
  });

  return results;
}

/**
 * Test audit log isolation
 */
export async function testAuditLogIsolation(
  db: Database.Database,
  cooperativeId: string,
  otherCooperativeId: string
): Promise<IsolationTestResult[]> {
  const results: IsolationTestResult[] = [];
  const rlsDb = createRLSDatabase(db, createTestRLSContext(cooperativeId));
  const otherRlsDb = createRLSDatabase(db, createTestRLSContext(otherCooperativeId));
  
  // Clear existing audit logs for clean test
  db.prepare('DELETE FROM audit_log').run();
  
  // Perform operations that should generate audit logs
  rlsDb.insert('members', {
    email: 'audit.test@example.com',
    first_name: 'Audit',
    last_name: 'Test',
    role: 'member'
  });
  
  otherRlsDb.insert('members', {
    email: 'audit.other@example.com',
    first_name: 'Other',
    last_name: 'Test',
    role: 'member'
  });

  // Test: Verify audit logs are isolated by cooperative
  const auditIsolationTest = await executeIsolationTest(
    'Audit Log - Isolation by cooperative',
    async () => {
      const ownAuditLogs = db.prepare(
        'SELECT * FROM audit_log WHERE cooperative_id = ?'
      ).all(cooperativeId);
      
      const otherAuditLogs = db.prepare(
        'SELECT * FROM audit_log WHERE cooperative_id = ?'
      ).all(otherCooperativeId);
      
      if (ownAuditLogs.length === 0) {
        throw new Error('No audit logs found for own cooperative');
      }
      
      if (otherAuditLogs.length === 0) {
        throw new Error('No audit logs found for other cooperative');
      }
      
      // Check that no audit logs reference the wrong cooperative
      const crossContamination = [
        ...ownAuditLogs.filter((log: any) => log.cooperative_id === otherCooperativeId),
        ...otherAuditLogs.filter((log: any) => log.cooperative_id === cooperativeId)
      ];
      
      if (crossContamination.length > 0) {
        throw new Error(`Audit log isolation violation: ${crossContamination.length} cross-contaminated entries`);
      }
      
      return { ownLogs: ownAuditLogs.length, otherLogs: otherAuditLogs.length };
    }
  );
  results.push({
    ...auditIsolationTest,
    cooperativeId,
    operation: 'AUDIT_ISOLATION',
    table: 'audit_log'
  });

  return results;
}

/**
 * Test transaction isolation
 */
export async function testTransactionIsolation(
  db: Database.Database,
  cooperativeId: string,
  otherCooperativeId: string
): Promise<IsolationTestResult[]> {
  const results: IsolationTestResult[] = [];
  
  // Test: Transaction boundaries maintain cooperative isolation
  const transactionTest = await executeIsolationTest(
    'Transaction - Cooperative isolation maintained',
    async () => {
      const transaction = db.transaction(() => {
        const rlsDb1 = createRLSDatabase(db, createTestRLSContext(cooperativeId));
        const rlsDb2 = createRLSDatabase(db, createTestRLSContext(otherCooperativeId));
        
        // Both operations should succeed within their own cooperative contexts
        const member1 = rlsDb1.insert('members', {
          email: 'transaction1@example.com',
          first_name: 'Transaction1',
          last_name: 'Test',
          role: 'member'
        });
        
        const member2 = rlsDb2.insert('members', {
          email: 'transaction2@example.com',
          first_name: 'Transaction2',
          last_name: 'Test',
          role: 'member'
        });
        
        // Verify isolation within transaction
        const coop1Members = rlsDb1.select('members', { 
          where: { email: 'transaction2@example.com' } 
        });
        const coop2Members = rlsDb2.select('members', { 
          where: { email: 'transaction1@example.com' } 
        });
        
        if (coop1Members.length > 0 || coop2Members.length > 0) {
          throw new Error('Transaction isolation violation: Cross-cooperative data visible');
        }
        
        return { member1: member1.id, member2: member2.id };
      });
      
      return transaction();
    }
  );
  results.push({
    ...transactionTest,
    cooperativeId,
    operation: 'TRANSACTION_ISOLATION',
    table: 'members'
  });

  return results;
}

/**
 * Performance test for isolation with large datasets
 */
export async function testIsolationPerformance(
  db: Database.Database,
  cooperativeId: string,
  recordCount: number = 1000
): Promise<IsolationTestResult> {
  const rlsDb = createRLSDatabase(db, createTestRLSContext(cooperativeId));
  
  return await executeIsolationTest(
    `Performance - Select with ${recordCount} records`,
    async () => {
      // First, create many test records
      const insertStmt = db.prepare(`
        INSERT INTO cases (id, cooperative_id, case_number, title, category, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const transaction = db.transaction(() => {
        for (let i = 0; i < recordCount; i++) {
          insertStmt.run(
            randomBytes(16).toString('hex'),
            cooperativeId,
            i + 1,
            `Performance Test Case ${i + 1}`,
            'maintenance',
            'normal',
            'open'
          );
        }
      });
      
      transaction();
      
      // Now test selection performance
      const startTime = Date.now();
      const results = rlsDb.select('cases');
      const selectionTime = Date.now() - startTime;
      
      return { count: results.length, selectionTime };
    }
  );
}

/**
 * Clean up test database
 */
export function cleanupTestDatabase(db: Database.Database): void {
  try {
    clearAllData(db);
    db.close();
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  }
}

/**
 * Generate test report summary
 */
export function generateTestReportSummary(results: IsolationTestResult[]): {
  total: number;
  passed: number;
  failed: number;
  securityViolationsDetected: number;
  averageExecutionTime: number;
  tablesTestedCount: number;
  cooperativesTestedCount: number;
} {
  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = total - passed;
  const securityViolationsDetected = results.filter(r => r.securityViolation).length;
  const averageExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / total;
  const tablesTestedCount = new Set(results.map(r => r.table)).size;
  const cooperativesTestedCount = new Set(results.map(r => r.cooperativeId)).size;
  
  return {
    total,
    passed,
    failed,
    securityViolationsDetected,
    averageExecutionTime: Math.round(averageExecutionTime * 100) / 100,
    tablesTestedCount,
    cooperativesTestedCount
  };
}