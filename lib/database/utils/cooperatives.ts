import Database from 'better-sqlite3';
import { getDatabase } from '../config';
import {
  Cooperative,
  CreateCooperative,
  UpdateCooperative,
  CooperativeStats,
  DatabaseResult,
} from '../types';

export class CooperativeUtils {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Create a new cooperative
   */
  create(data: CreateCooperative): DatabaseResult<Cooperative> {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO cooperatives (
          id, org_number, name, subdomain, street_address, postal_code, city,
          settings, features, subscription_tier, subscription_status, 
          trial_ends_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        id,
        data.org_number,
        data.name,
        data.subdomain,
        data.street_address,
        data.postal_code,
        data.city,
        data.settings,
        data.features,
        data.subscription_tier,
        data.subscription_status,
        data.trial_ends_at,
        now,
        now
      );

      if (result.changes > 0) {
        const cooperative = this.findById(id);
        return {
          success: true,
          data: cooperative.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Failed to create cooperative' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find cooperative by ID
   */
  findById(id: string): DatabaseResult<Cooperative> {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM cooperatives WHERE id = ? AND deleted_at IS NULL'
      );
      const cooperative = stmt.get(id) as Cooperative | undefined;

      if (cooperative) {
        return { success: true, data: cooperative };
      }

      return { success: false, error: 'Cooperative not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find cooperative by subdomain
   */
  findBySubdomain(subdomain: string): DatabaseResult<Cooperative> {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM cooperatives WHERE subdomain = ? AND deleted_at IS NULL'
      );
      const cooperative = stmt.get(subdomain) as Cooperative | undefined;

      if (cooperative) {
        return { success: true, data: cooperative };
      }

      return { success: false, error: 'Cooperative not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find cooperative by organization number
   */
  findByOrgNumber(orgNumber: string): DatabaseResult<Cooperative> {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM cooperatives WHERE org_number = ? AND deleted_at IS NULL'
      );
      const cooperative = stmt.get(orgNumber) as Cooperative | undefined;

      if (cooperative) {
        return { success: true, data: cooperative };
      }

      return { success: false, error: 'Cooperative not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update cooperative
   */
  update(data: UpdateCooperative): DatabaseResult<Cooperative> {
    try {
      const { id, ...updateData } = data;
      const now = new Date().toISOString();

      // Build dynamic UPDATE query
      const fields = Object.keys(updateData).filter(
        key => updateData[key as keyof typeof updateData] !== undefined
      );

      if (fields.length === 0) {
        return { success: false, error: 'No fields to update' };
      }

      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(
        field => updateData[field as keyof typeof updateData]
      );

      const stmt = this.db.prepare(`
        UPDATE cooperatives 
        SET ${setClause}, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `);

      const result = stmt.run(...values, now, id);

      if (result.changes > 0) {
        const cooperative = this.findById(id);
        return {
          success: true,
          data: cooperative.data,
          affected_rows: result.changes,
        };
      }

      return {
        success: false,
        error: 'Cooperative not found or no changes made',
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Soft delete cooperative
   */
  delete(id: string): DatabaseResult<void> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE cooperatives 
        SET deleted_at = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `);

      const result = stmt.run(now, now, id);

      if (result.changes > 0) {
        return { success: true, affected_rows: result.changes };
      }

      return { success: false, error: 'Cooperative not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * List all cooperatives with optional filtering
   */
  list(filters?: {
    subscription_tier?: string;
    subscription_status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): DatabaseResult<Cooperative[]> {
    try {
      let query = 'SELECT * FROM cooperatives WHERE deleted_at IS NULL';
      const params: any[] = [];

      if (filters) {
        if (filters.subscription_tier) {
          query += ' AND subscription_tier = ?';
          params.push(filters.subscription_tier);
        }

        if (filters.subscription_status) {
          query += ' AND subscription_status = ?';
          params.push(filters.subscription_status);
        }

        if (filters.search) {
          query +=
            ' AND (name LIKE ? OR org_number LIKE ? OR subdomain LIKE ?)';
          const searchTerm = `%${filters.search}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }
      }

      query += ' ORDER BY created_at DESC';

      if (filters?.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);

        if (filters.offset) {
          query += ' OFFSET ?';
          params.push(filters.offset);
        }
      }

      const stmt = this.db.prepare(query);
      const cooperatives = stmt.all(...params) as Cooperative[];

      return { success: true, data: cooperatives };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get cooperative statistics
   */
  getStats(cooperativeId: string): DatabaseResult<CooperativeStats> {
    try {
      const stats = this.db.transaction(() => {
        // Total apartments
        const apartmentCount = this.db
          .prepare(
            `
          SELECT COUNT(*) as count 
          FROM apartments 
          WHERE cooperative_id = ?
        `
          )
          .get(cooperativeId) as { count: number };

        // Total members
        const memberCount = this.db
          .prepare(
            `
          SELECT COUNT(*) as count 
          FROM members 
          WHERE cooperative_id = ? AND is_active = 1 AND deleted_at IS NULL
        `
          )
          .get(cooperativeId) as { count: number };

        // Board members
        const boardCount = this.db
          .prepare(
            `
          SELECT COUNT(*) as count 
          FROM members 
          WHERE cooperative_id = ? AND role IN ('chairman', 'treasurer', 'board') 
            AND is_active = 1 AND deleted_at IS NULL
        `
          )
          .get(cooperativeId) as { count: number };

        // Average monthly fee
        const avgFeeResult = this.db
          .prepare(
            `
          SELECT AVG(monthly_fee) as avg_fee 
          FROM apartments 
          WHERE cooperative_id = ? AND monthly_fee IS NOT NULL
        `
          )
          .get(cooperativeId) as { avg_fee: number };

        // Current month revenue
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const currentRevenue = this.db
          .prepare(
            `
          SELECT COALESCE(SUM(total_amount), 0) as revenue
          FROM monthly_fees 
          WHERE cooperative_id = ? AND year = ? AND month = ? AND payment_status = 'paid'
        `
          )
          .get(cooperativeId, currentYear, currentMonth) as { revenue: number };

        // Outstanding invoices
        const outstandingInvoices = this.db
          .prepare(
            `
          SELECT COUNT(*) as count 
          FROM invoices 
          WHERE cooperative_id = ? AND payment_status IN ('pending', 'overdue')
        `
          )
          .get(cooperativeId) as { count: number };

        // Overdue monthly fees
        const overdueFees = this.db
          .prepare(
            `
          SELECT COUNT(*) as count 
          FROM monthly_fees 
          WHERE cooperative_id = ? AND payment_status = 'overdue'
        `
          )
          .get(cooperativeId) as { count: number };

        // Open cases
        const openCases = this.db
          .prepare(
            `
          SELECT COUNT(*) as count 
          FROM cases 
          WHERE cooperative_id = ? AND status IN ('open', 'in_progress')
        `
          )
          .get(cooperativeId) as { count: number };

        return {
          cooperative_id: cooperativeId,
          total_apartments: apartmentCount.count,
          total_members: memberCount.count,
          board_members: boardCount.count,
          avg_monthly_fee: Math.round(avgFeeResult.avg_fee || 0),
          total_revenue_current_month: Math.round(currentRevenue.revenue),
          outstanding_invoices: outstandingInvoices.count,
          overdue_fees: overdueFees.count,
          open_cases: openCases.count,
        };
      })();

      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Check if subdomain is available
   */
  isSubdomainAvailable(subdomain: string, excludeId?: string): boolean {
    try {
      let query =
        'SELECT COUNT(*) as count FROM cooperatives WHERE subdomain = ? AND deleted_at IS NULL';
      const params: any[] = [subdomain];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };

      return result.count === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if organization number is available
   */
  isOrgNumberAvailable(orgNumber: string, excludeId?: string): boolean {
    try {
      let query =
        'SELECT COUNT(*) as count FROM cooperatives WHERE org_number = ? AND deleted_at IS NULL';
      const params: any[] = [orgNumber];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };

      return result.count === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update subscription status
   */
  updateSubscription(
    cooperativeId: string,
    subscriptionTier: string,
    subscriptionStatus: string,
    trialEndsAt?: string
  ): DatabaseResult<Cooperative> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE cooperatives 
        SET subscription_tier = ?, subscription_status = ?, trial_ends_at = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `);

      const result = stmt.run(
        subscriptionTier,
        subscriptionStatus,
        trialEndsAt || null,
        now,
        cooperativeId
      );

      if (result.changes > 0) {
        const cooperative = this.findById(cooperativeId);
        return {
          success: true,
          data: cooperative.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Cooperative not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private generateId(): string {
    const { randomBytes } = require('crypto');
    return randomBytes(16).toString('hex');
  }
}
