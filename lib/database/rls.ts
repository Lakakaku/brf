/**
 * Mock Row-Level Security (RLS) Implementation for SQLite
 * 
 * Since SQLite doesn't have native RLS like PostgreSQL, this module provides
 * a mock implementation that ensures cooperative-based data isolation through
 * automatic query filtering and validation.
 */

import Database from 'better-sqlite3';
import { auditSecurityAccess } from './security';

export interface RLSContext {
  cooperative_id: string;
  user_id?: string;
  user_role?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface QueryOptions {
  select?: string[];
  where?: Record<string, any>;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateData {
  [key: string]: any;
}

/**
 * RLS-aware database wrapper that automatically adds cooperative_id filtering
 */
export class RLSDatabase {
  private db: Database.Database;
  private context: RLSContext;

  constructor(db: Database.Database, context: RLSContext) {
    this.db = db;
    this.context = context;
    
    // Validate cooperative_id exists
    if (!context.cooperative_id) {
      throw new Error('RLS_ERROR: cooperative_id is required for all database operations');
    }
  }

  /**
   * Execute a SELECT query with automatic cooperative_id filtering
   */
  select<T = any>(table: string, options: QueryOptions = {}): T[] {
    this.validateTable(table);
    
    const { select = ['*'], where = {}, orderBy, limit, offset } = options;
    
    // Always filter by cooperative_id (except for tables that don't have it)
    const cooperativeFilter = this.shouldFilterByCooperative(table) 
      ? { cooperative_id: this.context.cooperative_id, ...where }
      : where;
    
    // Build the query
    const selectClause = Array.isArray(select) ? select.join(', ') : select;
    let query = `SELECT ${selectClause} FROM ${table}`;
    
    const whereClause = this.buildWhereClause(cooperativeFilter);
    if (whereClause.clause) {
      query += ` WHERE ${whereClause.clause}`;
    }
    
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    if (offset) {
      query += ` OFFSET ${offset}`;
    }
    
    // Log the security access
    auditSecurityAccess({
      cooperative_id: this.context.cooperative_id,
      user_id: this.context.user_id,
      user_role: this.context.user_role,
      ip_address: this.context.ip_address,
      user_agent: this.context.user_agent,
      action: 'SELECT',
      table,
      query,
      success: true
    });
    
    const stmt = this.db.prepare(query);
    return stmt.all(whereClause.params);
  }

  /**
   * Execute a SELECT query and return the first result
   */
  selectOne<T = any>(table: string, options: QueryOptions = {}): T | null {
    const results = this.select<T>(table, { ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Insert a record with automatic cooperative_id injection
   */
  insert<T = any>(table: string, data: Record<string, any>): T {
    this.validateTable(table);
    this.validateWriteAccess(table);
    
    // Automatically inject cooperative_id if the table supports it
    const insertData = this.shouldFilterByCooperative(table)
      ? { ...data, cooperative_id: this.context.cooperative_id }
      : data;
    
    // Validate that we're not trying to insert data for a different cooperative
    if (insertData.cooperative_id && insertData.cooperative_id !== this.context.cooperative_id) {
      const error = new Error('RLS_VIOLATION: Attempt to insert data for different cooperative');
      this.logSecurityViolation('INSERT', table, error.message, insertData);
      throw error;
    }
    
    const columns = Object.keys(insertData);
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    
    auditSecurityAccess({
      cooperative_id: this.context.cooperative_id,
      user_id: this.context.user_id,
      user_role: this.context.user_role,
      ip_address: this.context.ip_address,
      user_agent: this.context.user_agent,
      action: 'INSERT',
      table,
      query,
      data: insertData,
      success: true
    });
    
    const stmt = this.db.prepare(query);
    return stmt.get(Object.values(insertData));
  }

  /**
   * Update records with automatic cooperative_id filtering
   */
  update(table: string, data: UpdateData, where: Record<string, any> = {}): number {
    this.validateTable(table);
    this.validateWriteAccess(table);
    
    // Always filter by cooperative_id (except for tables that don't have it)
    const cooperativeFilter = this.shouldFilterByCooperative(table)
      ? { cooperative_id: this.context.cooperative_id, ...where }
      : where;
    
    // Prevent updating cooperative_id to a different value
    if (data.cooperative_id && data.cooperative_id !== this.context.cooperative_id) {
      const error = new Error('RLS_VIOLATION: Attempt to update cooperative_id to different value');
      this.logSecurityViolation('UPDATE', table, error.message, data);
      throw error;
    }
    
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const whereClause = this.buildWhereClause(cooperativeFilter);
    
    let query = `UPDATE ${table} SET ${setClause}`;
    if (whereClause.clause) {
      query += ` WHERE ${whereClause.clause}`;
    }
    
    const params = [...Object.values(data), ...whereClause.params];
    
    auditSecurityAccess({
      cooperative_id: this.context.cooperative_id,
      user_id: this.context.user_id,
      user_role: this.context.user_role,
      ip_address: this.context.ip_address,
      user_agent: this.context.user_agent,
      action: 'UPDATE',
      table,
      query,
      data,
      where: cooperativeFilter,
      success: true
    });
    
    const stmt = this.db.prepare(query);
    return stmt.run(params).changes;
  }

  /**
   * Delete records with automatic cooperative_id filtering (soft delete when supported)
   */
  delete(table: string, where: Record<string, any> = {}): number {
    this.validateTable(table);
    this.validateWriteAccess(table);
    
    // Always filter by cooperative_id
    const cooperativeFilter = this.shouldFilterByCooperative(table)
      ? { cooperative_id: this.context.cooperative_id, ...where }
      : where;
    
    // Check if table supports soft delete
    const supportsSoftDelete = this.supportsSoftDelete(table);
    
    let query: string;
    let params: any[];
    
    if (supportsSoftDelete) {
      // Perform soft delete by setting deleted_at timestamp
      const whereClause = this.buildWhereClause(cooperativeFilter);
      query = `UPDATE ${table} SET deleted_at = datetime('now')`;
      if (whereClause.clause) {
        query += ` WHERE ${whereClause.clause}`;
      }
      params = whereClause.params;
    } else {
      // Perform hard delete
      const whereClause = this.buildWhereClause(cooperativeFilter);
      query = `DELETE FROM ${table}`;
      if (whereClause.clause) {
        query += ` WHERE ${whereClause.clause}`;
      }
      params = whereClause.params;
    }
    
    auditSecurityAccess({
      cooperative_id: this.context.cooperative_id,
      user_id: this.context.user_id,
      user_role: this.context.user_role,
      ip_address: this.context.ip_address,
      user_agent: this.context.user_agent,
      action: supportsSoftDelete ? 'SOFT_DELETE' : 'DELETE',
      table,
      query,
      where: cooperativeFilter,
      success: true
    });
    
    const stmt = this.db.prepare(query);
    return stmt.run(params).changes;
  }

  /**
   * Execute a custom query with automatic cooperative_id validation
   */
  executeQuery<T = any>(query: string, params: any[] = []): T[] {
    // Validate that the query doesn't attempt to bypass RLS
    this.validateQuery(query);
    
    auditSecurityAccess({
      cooperative_id: this.context.cooperative_id,
      user_id: this.context.user_id,
      user_role: this.context.user_role,
      ip_address: this.context.ip_address,
      user_agent: this.context.user_agent,
      action: 'CUSTOM_QUERY',
      table: 'multiple',
      query,
      success: true
    });
    
    const stmt = this.db.prepare(query);
    return stmt.all(params);
  }

  /**
   * Get count of records with automatic cooperative_id filtering
   */
  count(table: string, where: Record<string, any> = {}): number {
    this.validateTable(table);
    
    const cooperativeFilter = this.shouldFilterByCooperative(table)
      ? { cooperative_id: this.context.cooperative_id, ...where }
      : where;
    
    const whereClause = this.buildWhereClause(cooperativeFilter);
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    
    if (whereClause.clause) {
      query += ` WHERE ${whereClause.clause}`;
    }
    
    const stmt = this.db.prepare(query);
    const result = stmt.get(whereClause.params) as { count: number };
    return result.count;
  }

  /**
   * Check if a record exists with cooperative_id filtering
   */
  exists(table: string, where: Record<string, any> = {}): boolean {
    return this.count(table, where) > 0;
  }

  // Private helper methods

  private validateTable(table: string): void {
    const allowedTables = [
      'cooperatives', 'members', 'apartments', 'documents', 'invoices',
      'monthly_fees', 'cases', 'notifications', 'board_meetings',
      'energy_consumption', 'contractor_ratings', 'booking_resources',
      'bookings', 'queue_positions', 'loans', 'loan_payments', 'audit_log'
    ];
    
    if (!allowedTables.includes(table)) {
      const error = new Error(`RLS_ERROR: Table '${table}' is not allowed`);
      this.logSecurityViolation('TABLE_VALIDATION', table, error.message);
      throw error;
    }
  }

  private shouldFilterByCooperative(table: string): boolean {
    // Tables that don't have cooperative_id column
    const noCooperativeIdTables = ['migrations'];
    return !noCooperativeIdTables.includes(table);
  }

  private supportsSoftDelete(table: string): boolean {
    const softDeleteTables = ['cooperatives', 'members', 'apartments', 'documents'];
    return softDeleteTables.includes(table);
  }

  private validateWriteAccess(table: string): void {
    // Additional role-based access control can be implemented here
    const restrictedTables = ['audit_log'];
    
    if (restrictedTables.includes(table)) {
      if (this.context.user_role !== 'admin' && this.context.user_role !== 'system') {
        const error = new Error(`RLS_ERROR: Insufficient permissions to write to table '${table}'`);
        this.logSecurityViolation('WRITE_ACCESS', table, error.message);
        throw error;
      }
    }
  }

  private validateQuery(query: string): void {
    const dangerousPatterns = [
      /DROP\s+TABLE/i,
      /CREATE\s+TABLE/i,
      /ALTER\s+TABLE/i,
      /TRUNCATE/i,
      /DELETE.*FROM.*WHERE.*cooperative_id\s*!=\s*/i,
      /UPDATE.*SET.*cooperative_id\s*=/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        const error = new Error('RLS_VIOLATION: Query contains potentially dangerous operations');
        this.logSecurityViolation('QUERY_VALIDATION', 'multiple', error.message, { query });
        throw error;
      }
    }
  }

  private buildWhereClause(where: Record<string, any>): { clause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    
    for (const [key, value] of Object.entries(where)) {
      if (value === null) {
        conditions.push(`${key} IS NULL`);
      } else if (value === undefined) {
        continue; // Skip undefined values
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ');
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...value);
      } else {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }
    
    return {
      clause: conditions.length > 0 ? conditions.join(' AND ') : '',
      params
    };
  }

  private logSecurityViolation(action: string, table: string, message: string, data?: any): void {
    auditSecurityAccess({
      cooperative_id: this.context.cooperative_id,
      user_id: this.context.user_id,
      user_role: this.context.user_role,
      ip_address: this.context.ip_address,
      user_agent: this.context.user_agent,
      action,
      table,
      message,
      data,
      success: false
    });
  }
}

/**
 * Helper function to create an RLS-aware database instance
 */
export function createRLSDatabase(db: Database.Database, context: RLSContext): RLSDatabase {
  return new RLSDatabase(db, context);
}

/**
 * Helper function to validate cooperative access
 */
export function validateCooperativeAccess(db: Database.Database, cooperativeId: string, userId?: string): boolean {
  try {
    // Check if cooperative exists
    const cooperative = db.prepare('SELECT id FROM cooperatives WHERE id = ? AND deleted_at IS NULL').get(cooperativeId);
    if (!cooperative) {
      return false;
    }
    
    // If userId is provided, check if user is a member of the cooperative
    if (userId) {
      const member = db.prepare(
        'SELECT id FROM members WHERE user_id = ? AND cooperative_id = ? AND is_active = 1 AND deleted_at IS NULL'
      ).get(userId, cooperativeId);
      return !!member;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating cooperative access:', error);
    return false;
  }
}

/**
 * Utility function to get user's cooperative memberships
 */
export function getUserCooperatives(db: Database.Database, userId: string): string[] {
  try {
    const memberships = db.prepare(`
      SELECT DISTINCT cooperative_id 
      FROM members 
      WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL
    `).all(userId);
    
    return memberships.map((m: any) => m.cooperative_id);
  } catch (error) {
    console.error('Error getting user cooperatives:', error);
    return [];
  }
}

/**
 * Helper to create a view with automatic cooperative filtering
 */
export function createCooperativeView(db: Database.Database, viewName: string, baseTable: string, selectClause: string = '*'): void {
  const viewQuery = `
    CREATE VIEW IF NOT EXISTS ${viewName} AS
    SELECT ${selectClause}
    FROM ${baseTable}
    WHERE cooperative_id = ? AND deleted_at IS NULL
  `;
  
  db.exec(viewQuery);
}