/**
 * RLS-aware database utility functions for BRF Portal
 * 
 * This module provides high-level database operations with automatic
 * cooperative-based filtering and security controls.
 */

import Database from 'better-sqlite3';
import { RLSDatabase, createRLSDatabase, type RLSContext } from './rls';
import { SecurityMiddleware, createSecureContext, type SecurityContext } from './security';
import { createCooperativeViews } from './views';
import { getDatabase } from './config';

export interface DatabaseContext extends RLSContext {
  middleware?: SecurityMiddleware;
}

/**
 * Create a secure, RLS-aware database connection
 */
export function createSecureDatabase(
  context: SecurityContext,
  options: { enableSecurity?: boolean } = {}
): RLSDatabase {
  const db = getDatabase();
  const { enableSecurity = true } = options;
  
  if (enableSecurity) {
    const { middleware } = createSecureContext(db, context.cooperative_id, context);
    
    // Apply security checks
    if (!middleware.checkRateLimit(context)) {
      throw new Error('SECURITY_ERROR: Rate limit exceeded');
    }
    
    // Cleanup expired security records
    middleware.cleanup();
  }
  
  return createRLSDatabase(db, context);
}

/**
 * Execute database operations within a transaction with RLS
 */
export function withSecureTransaction<T>(
  context: SecurityContext,
  operation: (rlsDb: RLSDatabase) => T
): T {
  const db = getDatabase();
  const rlsDb = createSecureDatabase(context);
  
  const transaction = db.transaction(() => {
    return operation(rlsDb);
  });
  
  return transaction();
}

/**
 * High-level repository pattern implementation with RLS
 */
export abstract class SecureRepository<T = any> {
  protected rlsDb: RLSDatabase;
  protected tableName: string;
  protected context: SecurityContext;

  constructor(context: SecurityContext, tableName: string) {
    this.context = context;
    this.tableName = tableName;
    this.rlsDb = createSecureDatabase(context);
  }

  /**
   * Find all records with optional filtering
   */
  findAll(options: {
    where?: Record<string, any>;
    orderBy?: string;
    limit?: number;
    offset?: number;
  } = {}): T[] {
    return this.rlsDb.select<T>(this.tableName, options);
  }

  /**
   * Find a single record by ID
   */
  findById(id: string): T | null {
    return this.rlsDb.selectOne<T>(this.tableName, { where: { id } });
  }

  /**
   * Find records matching criteria
   */
  findWhere(where: Record<string, any>): T[] {
    return this.rlsDb.select<T>(this.tableName, { where });
  }

  /**
   * Find one record matching criteria
   */
  findOneWhere(where: Record<string, any>): T | null {
    return this.rlsDb.selectOne<T>(this.tableName, { where });
  }

  /**
   * Create a new record
   */
  create(data: Partial<T>): T {
    return this.rlsDb.insert<T>(this.tableName, data as Record<string, any>);
  }

  /**
   * Update records matching criteria
   */
  update(data: Partial<T>, where: Record<string, any> = {}): number {
    return this.rlsDb.update(this.tableName, data as Record<string, any>, where);
  }

  /**
   * Update a record by ID
   */
  updateById(id: string, data: Partial<T>): number {
    return this.update(data, { id });
  }

  /**
   * Delete records matching criteria
   */
  delete(where: Record<string, any> = {}): number {
    return this.rlsDb.delete(this.tableName, where);
  }

  /**
   * Delete a record by ID
   */
  deleteById(id: string): number {
    return this.delete({ id });
  }

  /**
   * Count records matching criteria
   */
  count(where: Record<string, any> = {}): number {
    return this.rlsDb.count(this.tableName, where);
  }

  /**
   * Check if any records exist matching criteria
   */
  exists(where: Record<string, any> = {}): boolean {
    return this.rlsDb.exists(this.tableName, where);
  }
}

/**
 * Members repository with role-specific operations
 */
export class MembersRepository extends SecureRepository {
  constructor(context: SecurityContext) {
    super(context, 'members');
  }

  /**
   * Find active members only
   */
  findActiveMembers(): any[] {
    return this.findWhere({ is_active: 1 });
  }

  /**
   * Find members by role
   */
  findByRole(role: string): any[] {
    return this.findWhere({ role, is_active: 1 });
  }

  /**
   * Find member by email
   */
  findByEmail(email: string): any | null {
    return this.findOneWhere({ email, is_active: 1 });
  }

  /**
   * Update member role (requires admin/chairman permissions)
   */
  updateRole(memberId: string, newRole: string): number {
    if (!['admin', 'chairman'].includes(this.context.user_role || '')) {
      throw new Error('AUTHORIZATION_ERROR: Insufficient permissions to change user roles');
    }
    return this.updateById(memberId, { role: newRole });
  }
}

/**
 * Apartments repository with ownership management
 */
export class ApartmentsRepository extends SecureRepository {
  constructor(context: SecurityContext) {
    super(context, 'apartments');
  }

  /**
   * Find apartments with owner information
   */
  findWithOwners(): any[] {
    return this.rlsDb.executeQuery(`
      SELECT * FROM v_apartments_with_owners 
      WHERE cooperative_id = ?
      ORDER BY apartment_number
    `, [this.context.cooperative_id]);
  }

  /**
   * Find vacant apartments
   */
  findVacant(): any[] {
    return this.findWhere({ owner_id: null });
  }

  /**
   * Transfer apartment ownership
   */
  transferOwnership(apartmentId: string, newOwnerId: string): number {
    if (!['admin', 'chairman', 'treasurer'].includes(this.context.user_role || '')) {
      throw new Error('AUTHORIZATION_ERROR: Insufficient permissions to transfer ownership');
    }
    
    return this.updateById(apartmentId, {
      owner_id: newOwnerId,
      ownership_date: new Date().toISOString()
    });
  }
}

/**
 * Cases repository with workflow management
 */
export class CasesRepository extends SecureRepository {
  constructor(context: SecurityContext) {
    super(context, 'cases');
  }

  /**
   * Find active cases with full details
   */
  findActiveCases(): any[] {
    return this.rlsDb.executeQuery(`
      SELECT * FROM v_active_cases 
      WHERE cooperative_id = ?
      ORDER BY effective_priority, reported_at
    `, [this.context.cooperative_id]);
  }

  /**
   * Find cases assigned to current user
   */
  findMyAssignedCases(): any[] {
    if (!this.context.user_id) {
      return [];
    }
    return this.findWhere({ assigned_to: this.context.user_id });
  }

  /**
   * Find cases reported by current user
   */
  findMyReportedCases(): any[] {
    if (!this.context.user_id) {
      return [];
    }
    return this.findWhere({ reported_by: this.context.user_id });
  }

  /**
   * Assign case to a member
   */
  assignCase(caseId: string, assigneeId: string): number {
    if (!['admin', 'chairman', 'treasurer', 'board'].includes(this.context.user_role || '')) {
      throw new Error('AUTHORIZATION_ERROR: Insufficient permissions to assign cases');
    }
    
    return this.updateById(caseId, {
      assigned_to: assigneeId,
      started_at: new Date().toISOString(),
      status: 'in_progress'
    });
  }

  /**
   * Update case status
   */
  updateStatus(caseId: string, status: string, notes?: string): number {
    const updateData: any = { status };
    
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    } else if (status === 'closed') {
      updateData.closed_at = new Date().toISOString();
    }
    
    return this.updateById(caseId, updateData);
  }
}

/**
 * Invoices repository with payment management
 */
export class InvoicesRepository extends SecureRepository {
  constructor(context: SecurityContext) {
    super(context, 'invoices');
  }

  /**
   * Find outstanding invoices
   */
  findOutstanding(): any[] {
    return this.rlsDb.executeQuery(`
      SELECT * FROM v_outstanding_invoices 
      WHERE cooperative_id = ?
      ORDER BY due_date
    `, [this.context.cooperative_id]);
  }

  /**
   * Mark invoice as paid
   */
  markPaid(invoiceId: string, paymentDate?: string): number {
    if (!['admin', 'chairman', 'treasurer'].includes(this.context.user_role || '')) {
      throw new Error('AUTHORIZATION_ERROR: Insufficient permissions to process payments');
    }
    
    return this.updateById(invoiceId, {
      payment_status: 'paid',
      payment_date: paymentDate || new Date().toISOString()
    });
  }

  /**
   * Get financial summary
   */
  getFinancialSummary(): any {
    const result = this.rlsDb.executeQuery(`
      SELECT * FROM v_financial_summary 
      WHERE cooperative_id = ?
    `, [this.context.cooperative_id]);
    
    return result[0] || null;
  }
}

/**
 * Monthly Fees repository
 */
export class MonthlyFeesRepository extends SecureRepository {
  constructor(context: SecurityContext) {
    super(context, 'monthly_fees');
  }

  /**
   * Find outstanding monthly fees
   */
  findOutstanding(): any[] {
    return this.rlsDb.executeQuery(`
      SELECT * FROM v_outstanding_monthly_fees 
      WHERE cooperative_id = ?
      ORDER BY year DESC, month DESC, apartment_number
    `, [this.context.cooperative_id]);
  }

  /**
   * Generate monthly fees for all apartments
   */
  generateForMonth(year: number, month: number): number {
    if (!['admin', 'chairman', 'treasurer'].includes(this.context.user_role || '')) {
      throw new Error('AUTHORIZATION_ERROR: Insufficient permissions to generate monthly fees');
    }

    const apartments = new ApartmentsRepository(this.context).findAll();
    let generated = 0;

    for (const apartment of apartments) {
      if (apartment.monthly_fee && apartment.monthly_fee > 0) {
        try {
          this.create({
            apartment_id: apartment.id,
            year,
            month,
            base_fee: apartment.monthly_fee,
            total_amount: apartment.monthly_fee,
            payment_status: 'pending'
          });
          generated++;
        } catch (error) {
          // Fee might already exist, skip
          console.warn(`Fee already exists for apartment ${apartment.apartment_number}`);
        }
      }
    }

    return generated;
  }
}

/**
 * Initialize database with RLS support
 */
export function initializeSecureDatabase(): void {
  const db = getDatabase();
  
  // Create cooperative-filtered views
  createCooperativeViews(db);
  
  console.log('✅ Secure database initialized with RLS support');
}

/**
 * Validate and sanitize user input
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Basic sanitization - remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Export commonly used repository classes
 */
export {
  MembersRepository,
  ApartmentsRepository,
  CasesRepository,
  InvoicesRepository,
  MonthlyFeesRepository
};

// Re-export database configuration functions
export { 
  getDatabase,
  closeDatabase,
  withTransaction,
  handleDatabaseError 
} from './config';