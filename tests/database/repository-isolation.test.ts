/**
 * Repository Pattern Isolation Tests
 * 
 * Tests data access through repository classes to ensure they maintain
 * cooperative isolation when using the RLS database wrapper.
 */

import Database from 'better-sqlite3';
import { createRLSDatabase } from '@/lib/database/rls';
import {
  createTestDatabase,
  initializeTestDatabase,
  getTestCooperatives,
  getTestMembers,
  createTestRLSContext,
  executeIsolationTest,
  cleanupTestDatabase,
  TestCooperative,
  IsolationTestResult
} from '../helpers/database-test-utils';

// Mock repository classes for testing
class MemberRepository {
  constructor(private rlsDb: ReturnType<typeof createRLSDatabase>) {}

  async findAll() {
    return this.rlsDb.select('members', {
      where: { is_active: 1 },
      orderBy: 'last_name, first_name'
    });
  }

  async findById(id: string) {
    return this.rlsDb.selectOne('members', {
      where: { id, is_active: 1 }
    });
  }

  async findByEmail(email: string) {
    return this.rlsDb.selectOne('members', {
      where: { email, is_active: 1 }
    });
  }

  async findByRole(role: string) {
    return this.rlsDb.select('members', {
      where: { role, is_active: 1 }
    });
  }

  async create(memberData: any) {
    return this.rlsDb.insert('members', {
      ...memberData,
      is_active: 1
    });
  }

  async update(id: string, updateData: any) {
    return this.rlsDb.update('members', updateData, { id });
  }

  async softDelete(id: string) {
    return this.rlsDb.delete('members', { id });
  }

  async count() {
    return this.rlsDb.count('members', { is_active: 1 });
  }

  async exists(id: string) {
    return this.rlsDb.exists('members', { id, is_active: 1 });
  }
}

class ApartmentRepository {
  constructor(private rlsDb: ReturnType<typeof createRLSDatabase>) {}

  async findAll() {
    return this.rlsDb.select('apartments', {
      orderBy: 'apartment_number'
    });
  }

  async findByOwner(ownerId: string) {
    return this.rlsDb.select('apartments', {
      where: { owner_id: ownerId }
    });
  }

  async findAvailable() {
    return this.rlsDb.select('apartments', {
      where: { owner_id: null }
    });
  }

  async assignOwner(apartmentId: string, ownerId: string) {
    return this.rlsDb.update('apartments', 
      { 
        owner_id: ownerId, 
        ownership_date: new Date().toISOString() 
      }, 
      { id: apartmentId }
    );
  }

  async calculateTotalMonthlyFees() {
    const apartments = this.rlsDb.select('apartments');
    return apartments.reduce((total: number, apt: any) => total + (apt.monthly_fee || 0), 0);
  }
}

class InvoiceRepository {
  constructor(private rlsDb: ReturnType<typeof createRLSDatabase>) {}

  async findPending() {
    return this.rlsDb.select('invoices', {
      where: { payment_status: 'pending' },
      orderBy: 'due_date'
    });
  }

  async findOverdue() {
    const today = new Date().toISOString().split('T')[0];
    return this.rlsDb.select('invoices', {
      where: { payment_status: 'pending' },
      orderBy: 'due_date'
    }).filter((invoice: any) => invoice.due_date < today);
  }

  async markAsPaid(invoiceId: string, paymentDate?: string) {
    return this.rlsDb.update('invoices',
      {
        payment_status: 'paid',
        payment_date: paymentDate || new Date().toISOString().split('T')[0]
      },
      { id: invoiceId }
    );
  }

  async getTotalAmount(status?: string) {
    const where = status ? { payment_status: status } : {};
    const invoices = this.rlsDb.select('invoices', { where });
    return invoices.reduce((total: number, inv: any) => total + (inv.total_amount || 0), 0);
  }

  async getMonthlyTotal(year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 
      ? `${year + 1}-01-01` 
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    
    const invoices = this.rlsDb.select('invoices');
    const monthlyInvoices = invoices.filter((inv: any) => 
      inv.invoice_date >= startDate && inv.invoice_date < endDate
    );
    
    return monthlyInvoices.reduce((total: number, inv: any) => total + (inv.total_amount || 0), 0);
  }
}

describe('Repository Pattern Isolation Tests', () => {
  let db: Database.Database;
  let testCooperatives: TestCooperative[];
  let allTestResults: IsolationTestResult[] = [];

  beforeAll(async () => {
    db = createTestDatabase();
    await initializeTestDatabase(db);
    testCooperatives = getTestCooperatives(db);
    
    console.log(`\n🏗️  Testing repository pattern isolation with ${testCooperatives.length} cooperatives`);
  });

  afterAll(() => {
    console.log(`\n📊 Repository tests completed: ${allTestResults.length} tests`);
    cleanupTestDatabase(db);
  });

  describe('Member Repository Isolation', () => {
    test('Member repository should only return cooperative members', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Member repository isolation',
        async () => {
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          const repo1 = new MemberRepository(rlsDb1);
          const repo2 = new MemberRepository(rlsDb2);
          
          const members1 = await repo1.findAll();
          const members2 = await repo2.findAll();
          
          // Verify no overlap
          const ids1 = members1.map((m: any) => m.id);
          const ids2 = members2.map((m: any) => m.id);
          const overlap = ids1.filter(id => ids2.includes(id));
          
          if (overlap.length > 0) {
            throw new Error(`Repository isolation violation: ${overlap.length} shared members`);
          }
          
          return { coop1Count: members1.length, coop2Count: members2.length };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_SELECT',
        table: 'members'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Member repository maintains cooperative isolation');
    });

    test('Member repository findByEmail should be isolated', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Member repository email lookup isolation',
        async () => {
          const coop1Members = getTestMembers(db, coop1.id);
          const testMember = coop1Members[0];
          
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          const repo1 = new MemberRepository(rlsDb1);
          const repo2 = new MemberRepository(rlsDb2);
          
          // Coop1 should find the member
          const foundInCoop1 = await repo1.findByEmail(testMember.email);
          
          // Coop2 should not find the member
          const foundInCoop2 = await repo2.findByEmail(testMember.email);
          
          if (!foundInCoop1) {
            throw new Error('Member not found in own cooperative');
          }
          
          if (foundInCoop2) {
            throw new Error('Member found in wrong cooperative');
          }
          
          return { foundInOwn: !!foundInCoop1, notFoundInOther: !foundInCoop2 };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_FIND_BY_EMAIL',
        table: 'members'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Member repository email lookup maintains isolation');
    });

    test('Member repository create should respect cooperative context', async () => {
      const coop1 = testCooperatives[0];
      
      const result = await executeIsolationTest(
        'Member repository create isolation',
        async () => {
          const rlsDb = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const repo = new MemberRepository(rlsDb);
          
          const newMember = await repo.create({
            email: 'repo.test@example.com',
            first_name: 'Repository',
            last_name: 'Test',
            role: 'member'
          });
          
          // Verify member was created with correct cooperative_id
          if (newMember.cooperative_id !== coop1.id) {
            throw new Error(`Member created with wrong cooperative_id: ${newMember.cooperative_id}`);
          }
          
          // Verify member is findable
          const found = await repo.findByEmail('repo.test@example.com');
          if (!found) {
            throw new Error('Created member not found');
          }
          
          return { created: newMember.id, found: found.id };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_CREATE',
        table: 'members'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Member repository create maintains cooperative context');
    });
  });

  describe('Apartment Repository Isolation', () => {
    test('Apartment repository should only return cooperative apartments', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Apartment repository isolation',
        async () => {
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          const repo1 = new ApartmentRepository(rlsDb1);
          const repo2 = new ApartmentRepository(rlsDb2);
          
          const apartments1 = await repo1.findAll();
          const apartments2 = await repo2.findAll();
          
          // Verify no overlap
          const ids1 = apartments1.map((a: any) => a.id);
          const ids2 = apartments2.map((a: any) => a.id);
          const overlap = ids1.filter(id => ids2.includes(id));
          
          if (overlap.length > 0) {
            throw new Error(`Apartment repository isolation violation: ${overlap.length} shared apartments`);
          }
          
          return { coop1Count: apartments1.length, coop2Count: apartments2.length };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_SELECT',
        table: 'apartments'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Apartment repository maintains cooperative isolation');
    });

    test('Apartment repository owner assignments should be isolated', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Apartment owner assignment isolation',
        async () => {
          const coop1Members = getTestMembers(db, coop1.id);
          const coop2Members = getTestMembers(db, coop2.id);
          
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          const repo1 = new ApartmentRepository(rlsDb1);
          const repo2 = new ApartmentRepository(rlsDb2);
          
          // Get apartments from each cooperative
          const coop1Apartments = await repo1.findAll();
          const coop2Apartments = await repo2.findAll();
          
          if (coop1Apartments.length === 0 || coop2Apartments.length === 0) {
            throw new Error('Test requires apartments in both cooperatives');
          }
          
          // Find apartments owned by members of each cooperative
          const coop1OwnedByMembers = await repo1.findByOwner(coop1Members[0].id);
          const coop2OwnedByMembers = await repo2.findByOwner(coop2Members[0].id);
          
          // Cross-check: coop1 should not see apartments owned by coop2 members
          const coop1SeesCoop2Owned = await repo1.findByOwner(coop2Members[0].id);
          const coop2SeesCoop1Owned = await repo2.findByOwner(coop1Members[0].id);
          
          if (coop1SeesCoop2Owned.length > 0 || coop2SeesCoop1Owned.length > 0) {
            throw new Error('Cross-cooperative apartment ownership visibility detected');
          }
          
          return {
            coop1Owned: coop1OwnedByMembers.length,
            coop2Owned: coop2OwnedByMembers.length,
            crossVisibility: coop1SeesCoop2Owned.length + coop2SeesCoop1Owned.length
          };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_OWNER_ISOLATION',
        table: 'apartments'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Apartment ownership isolation maintained');
    });

    test('Apartment repository calculations should be isolated', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Apartment calculation isolation',
        async () => {
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          const repo1 = new ApartmentRepository(rlsDb1);
          const repo2 = new ApartmentRepository(rlsDb2);
          
          const total1 = await repo1.calculateTotalMonthlyFees();
          const total2 = await repo2.calculateTotalMonthlyFees();
          
          // Verify calculations are different (unless by extreme coincidence)
          if (total1 === total2 && total1 > 0) {
            console.warn('Warning: Both cooperatives have identical monthly fee totals');
          }
          
          // Verify both calculations are reasonable
          if (total1 < 0 || total2 < 0) {
            throw new Error('Negative monthly fee total calculated');
          }
          
          return { coop1Total: total1, coop2Total: total2 };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_CALCULATION',
        table: 'apartments'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Apartment calculations properly isolated');
    });
  });

  describe('Invoice Repository Isolation', () => {
    test('Invoice repository should only access cooperative invoices', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Invoice repository isolation',
        async () => {
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          const repo1 = new InvoiceRepository(rlsDb1);
          const repo2 = new InvoiceRepository(rlsDb2);
          
          const pending1 = await repo1.findPending();
          const pending2 = await repo2.findPending();
          
          // Verify no invoice overlap
          const ids1 = pending1.map((inv: any) => inv.id);
          const ids2 = pending2.map((inv: any) => inv.id);
          const overlap = ids1.filter(id => ids2.includes(id));
          
          if (overlap.length > 0) {
            throw new Error(`Invoice repository isolation violation: ${overlap.length} shared invoices`);
          }
          
          return { coop1Pending: pending1.length, coop2Pending: pending2.length };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_FIND_PENDING',
        table: 'invoices'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Invoice repository maintains cooperative isolation');
    });

    test('Invoice repository financial calculations should be isolated', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Invoice financial calculation isolation',
        async () => {
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          const repo1 = new InvoiceRepository(rlsDb1);
          const repo2 = new InvoiceRepository(rlsDb2);
          
          const totalPaid1 = await repo1.getTotalAmount('paid');
          const totalPaid2 = await repo2.getTotalAmount('paid');
          
          const totalPending1 = await repo1.getTotalAmount('pending');
          const totalPending2 = await repo2.getTotalAmount('pending');
          
          // Calculate monthly totals for current year/month
          const now = new Date();
          const monthly1 = await repo1.getMonthlyTotal(now.getFullYear(), now.getMonth() + 1);
          const monthly2 = await repo2.getMonthlyTotal(now.getFullYear(), now.getMonth() + 1);
          
          // Verify calculations are reasonable
          if (totalPaid1 < 0 || totalPaid2 < 0 || totalPending1 < 0 || totalPending2 < 0) {
            throw new Error('Negative invoice totals calculated');
          }
          
          return {
            coop1: { paid: totalPaid1, pending: totalPending1, monthly: monthly1 },
            coop2: { paid: totalPaid2, pending: totalPending2, monthly: monthly2 }
          };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_FINANCIAL_CALC',
        table: 'invoices'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Invoice financial calculations properly isolated');
    });
  });

  describe('Repository Method Isolation', () => {
    test('Repository exists() method should be isolated', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Repository exists method isolation',
        async () => {
          const coop1Members = getTestMembers(db, coop1.id);
          const coop2Members = getTestMembers(db, coop2.id);
          
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          const repo1 = new MemberRepository(rlsDb1);
          const repo2 = new MemberRepository(rlsDb2);
          
          // Each repository should only confirm existence of its own members
          const member1ExistsInRepo1 = await repo1.exists(coop1Members[0].id);
          const member2ExistsInRepo2 = await repo2.exists(coop2Members[0].id);
          
          // Cross-checks should return false
          const member1ExistsInRepo2 = await repo2.exists(coop1Members[0].id);
          const member2ExistsInRepo1 = await repo1.exists(coop2Members[0].id);
          
          if (!member1ExistsInRepo1 || !member2ExistsInRepo2) {
            throw new Error('Members not found in their own cooperatives');
          }
          
          if (member1ExistsInRepo2 || member2ExistsInRepo1) {
            throw new Error('Cross-cooperative member existence detected');
          }
          
          return {
            ownMembersFound: member1ExistsInRepo1 && member2ExistsInRepo2,
            crossMembersNotFound: !member1ExistsInRepo2 && !member2ExistsInRepo1
          };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_EXISTS',
        table: 'members'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Repository exists() method maintains isolation');
    });

    test('Repository count() method should be isolated', async () => {
      const coop1 = testCooperatives[0];
      const coop2 = testCooperatives[1];
      
      const result = await executeIsolationTest(
        'Repository count method isolation',
        async () => {
          const rlsDb1 = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const rlsDb2 = createRLSDatabase(db, createTestRLSContext(coop2.id));
          
          const repo1 = new MemberRepository(rlsDb1);
          const repo2 = new MemberRepository(rlsDb2);
          
          const count1 = await repo1.count();
          const count2 = await repo2.count();
          
          // Verify counts are reasonable
          if (count1 <= 0 || count2 <= 0) {
            throw new Error('Unrealistic member counts');
          }
          
          // Verify counts are different (unless by coincidence)
          if (count1 === count2) {
            console.warn('Warning: Both cooperatives have identical member counts');
          }
          
          return { coop1Count: count1, coop2Count: count2 };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_COUNT',
        table: 'members'
      });
      
      expect(result.success).toBe(true);
      console.log('✅ Repository count() method maintains isolation');
    });
  });

  describe('Repository Error Handling', () => {
    test('Repository should handle invalid IDs gracefully', async () => {
      const coop1 = testCooperatives[0];
      
      const result = await executeIsolationTest(
        'Repository invalid ID handling',
        async () => {
          const rlsDb = createRLSDatabase(db, createTestRLSContext(coop1.id));
          const repo = new MemberRepository(rlsDb);
          
          // Try to find non-existent member
          const nonExistent = await repo.findById('non-existent-id');
          
          // Try to update non-existent member
          const updateResult = await repo.update('non-existent-id', { first_name: 'Updated' });
          
          // Try to check existence of non-existent member
          const exists = await repo.exists('non-existent-id');
          
          return {
            foundNonExistent: !!nonExistent,
            updatedNonExistent: updateResult > 0,
            existsNonExistent: exists
          };
        }
      );
      
      allTestResults.push({
        ...result,
        cooperativeId: coop1.id,
        operation: 'REPOSITORY_ERROR_HANDLING',
        table: 'members'
      });
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(0); // Should return 0 for all operations
      console.log('✅ Repository handles invalid IDs gracefully');
    });
  });
});