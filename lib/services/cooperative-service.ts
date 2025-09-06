/**
 * Cooperative Database Service
 * Handles database operations for cooperative management and switching
 */

import { getDatabase, withTransaction, handleDatabaseError } from '@/lib/database/config';
import { createRLSDatabase, type RLSContext } from '@/lib/database/rls';
import { createSecureContext, type SecurityContext } from '@/lib/database/security';
import type { Cooperative } from '@/components/cooperative-selector';

export interface CooperativeWithStats extends Cooperative {
  totalMembers: number;
  activeMembers: number;
  totalCases: number;
  activeCases: number;
  totalInvoices: number;
  outstandingInvoices: number;
  lastActivity: string | null;
}

export interface CooperativeSwitchContext {
  userId: string;
  fromCooperativeId: string | null;
  toCooperativeId: string;
  sessionId?: string;
  switchReason: 'user_request' | 'admin_force' | 'system_migration';
  metadata?: Record<string, any>;
}

export class CooperativeService {
  private db = getDatabase();

  /**
   * Get all cooperatives available to a user
   */
  async getAvailableCooperatives(
    userId: string, 
    includeInactive: boolean = false,
    includeTestData: boolean = false
  ): Promise<Cooperative[]> {
    try {
      const query = `
        SELECT DISTINCT
          c.id,
          c.name,
          c.org_number as orgNumber,
          c.subdomain,
          c.city,
          c.total_apartments as totalApartments,
          c.subscription_tier as subscriptionTier,
          c.subscription_status as subscriptionStatus,
          CASE 
            WHEN c.name LIKE '%Test%' OR c.name LIKE '%Demo%' OR c.subdomain LIKE '%test%'
            THEN 1 
            ELSE 0 
          END as isTestData,
          c.created_at,
          c.updated_at
        FROM cooperatives c
        LEFT JOIN members m ON c.id = m.cooperative_id
        WHERE 
          (
            -- User is a member of this cooperative
            (m.user_id = ? AND m.is_active = 1 AND m.deleted_at IS NULL)
            OR
            -- User is an admin who can access all cooperatives
            EXISTS (
              SELECT 1 FROM members admin_m 
              WHERE admin_m.user_id = ? 
              AND admin_m.role IN ('admin', 'chairman') 
              AND admin_m.is_active = 1 
              AND admin_m.deleted_at IS NULL
            )
            OR
            -- Development/testing mode - show test cooperatives
            (? = 1 AND (c.name LIKE '%Test%' OR c.name LIKE '%Demo%' OR c.subdomain LIKE '%test%'))
          )
          AND c.deleted_at IS NULL
          ${!includeInactive ? "AND c.subscription_status IN ('active', 'trial')" : ""}
        ORDER BY 
          c.subscription_status DESC,
          c.name ASC
      `;

      const params = [userId, userId, includeTestData ? 1 : 0];
      const result = this.db.prepare(query).all(...params);

      return result.map(row => ({
        id: row.id,
        name: row.name,
        orgNumber: row.orgNumber,
        subdomain: row.subdomain,
        city: row.city,
        totalApartments: row.totalApartments,
        subscriptionTier: row.subscriptionTier as 'standard' | 'premium' | 'enterprise',
        subscriptionStatus: row.subscriptionStatus as 'active' | 'trial' | 'inactive',
        isTestData: Boolean(row.isTestData),
      }));
    } catch (error) {
      throw handleDatabaseError(error, 'Failed to get available cooperatives');
    }
  }

  /**
   * Get detailed cooperative information with statistics
   */
  async getCooperativeWithStats(
    cooperativeId: string,
    securityContext: SecurityContext
  ): Promise<CooperativeWithStats | null> {
    try {
      // Create secure database context
      const rlsDb = createRLSDatabase(this.db, {
        cooperative_id: cooperativeId,
        user_id: securityContext.user_id,
        user_role: securityContext.user_role,
      });

      const cooperativeQuery = `
        SELECT 
          c.id,
          c.name,
          c.org_number as orgNumber,
          c.subdomain,
          c.city,
          c.total_apartments as totalApartments,
          c.subscription_tier as subscriptionTier,
          c.subscription_status as subscriptionStatus,
          CASE 
            WHEN c.name LIKE '%Test%' OR c.name LIKE '%Demo%' OR c.subdomain LIKE '%test%'
            THEN 1 
            ELSE 0 
          END as isTestData,
          -- Member statistics
          (SELECT COUNT(*) FROM members WHERE cooperative_id = c.id AND deleted_at IS NULL) as totalMembers,
          (SELECT COUNT(*) FROM members WHERE cooperative_id = c.id AND is_active = 1 AND deleted_at IS NULL) as activeMembers,
          -- Case statistics
          (SELECT COUNT(*) FROM cases WHERE cooperative_id = c.id) as totalCases,
          (SELECT COUNT(*) FROM cases WHERE cooperative_id = c.id AND status IN ('open', 'in_progress')) as activeCases,
          -- Invoice statistics
          (SELECT COUNT(*) FROM invoices WHERE cooperative_id = c.id) as totalInvoices,
          (SELECT COUNT(*) FROM invoices WHERE cooperative_id = c.id AND payment_status != 'paid') as outstandingInvoices,
          -- Last activity
          (SELECT MAX(created_at) FROM (
            SELECT created_at FROM cases WHERE cooperative_id = c.id
            UNION ALL
            SELECT created_at FROM invoices WHERE cooperative_id = c.id
            UNION ALL
            SELECT created_at FROM documents WHERE cooperative_id = c.id
            UNION ALL
            SELECT created_at FROM board_meetings WHERE cooperative_id = c.id
          )) as lastActivity
        FROM cooperatives c
        WHERE c.id = ? AND c.deleted_at IS NULL
      `;

      const result = this.db.prepare(cooperativeQuery).get(cooperativeId);

      if (!result) {
        return null;
      }

      return {
        id: result.id,
        name: result.name,
        orgNumber: result.orgNumber,
        subdomain: result.subdomain,
        city: result.city,
        totalApartments: result.totalApartments,
        subscriptionTier: result.subscriptionTier as 'standard' | 'premium' | 'enterprise',
        subscriptionStatus: result.subscriptionStatus as 'active' | 'trial' | 'inactive',
        isTestData: Boolean(result.isTestData),
        totalMembers: result.totalMembers,
        activeMembers: result.activeMembers,
        totalCases: result.totalCases,
        activeCases: result.activeCases,
        totalInvoices: result.totalInvoices,
        outstandingInvoices: result.outstandingInvoices,
        lastActivity: result.lastActivity,
      };
    } catch (error) {
      throw handleDatabaseError(error, 'Failed to get cooperative with stats');
    }
  }

  /**
   * Validate cooperative switch permissions
   */
  async canUserSwitchToCooperative(
    userId: string,
    cooperativeId: string
  ): Promise<{ canSwitch: boolean; reason?: string }> {
    try {
      // Check if user is a member of the target cooperative
      const memberQuery = `
        SELECT 
          m.role,
          m.is_active,
          c.subscription_status,
          c.deleted_at as cooperative_deleted
        FROM members m
        JOIN cooperatives c ON m.cooperative_id = c.id
        WHERE m.user_id = ? 
          AND m.cooperative_id = ? 
          AND m.deleted_at IS NULL
      `;

      const memberResult = this.db.prepare(memberQuery).get(userId, cooperativeId);

      if (!memberResult) {
        // Check if user is an admin who can access all cooperatives
        const adminQuery = `
          SELECT COUNT(*) as admin_count
          FROM members 
          WHERE user_id = ? 
            AND role IN ('admin', 'chairman')
            AND is_active = 1 
            AND deleted_at IS NULL
        `;

        const adminResult = this.db.prepare(adminQuery).get(userId);

        if (adminResult.admin_count > 0) {
          return { canSwitch: true };
        }

        return { 
          canSwitch: false, 
          reason: 'User is not a member of this cooperative' 
        };
      }

      // Check if cooperative exists and is not deleted
      if (memberResult.cooperative_deleted) {
        return { 
          canSwitch: false, 
          reason: 'Cooperative has been deleted' 
        };
      }

      // Check if member is active
      if (!memberResult.is_active) {
        return { 
          canSwitch: false, 
          reason: 'User membership is inactive' 
        };
      }

      // Check cooperative subscription status
      if (memberResult.subscription_status === 'inactive') {
        return { 
          canSwitch: false, 
          reason: 'Cooperative subscription is inactive' 
        };
      }

      return { canSwitch: true };
    } catch (error) {
      throw handleDatabaseError(error, 'Failed to validate cooperative switch permissions');
    }
  }

  /**
   * Log cooperative switch for audit purposes
   */
  async logCooperativeSwitch(switchContext: CooperativeSwitchContext): Promise<void> {
    try {
      return withTransaction(() => {
        const auditQuery = `
          INSERT INTO audit_log (
            cooperative_id,
            user_id,
            action,
            entity_type,
            entity_id,
            old_values,
            new_values,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `;

        const auditData = {
          old_values: switchContext.fromCooperativeId ? 
            JSON.stringify({ cooperative_id: switchContext.fromCooperativeId }) : null,
          new_values: JSON.stringify({ 
            cooperative_id: switchContext.toCooperativeId,
            switch_reason: switchContext.switchReason,
            session_id: switchContext.sessionId,
            metadata: switchContext.metadata || {}
          }),
        };

        this.db.prepare(auditQuery).run(
          switchContext.toCooperativeId, // Log to target cooperative
          switchContext.userId,
          'cooperative_switch',
          'cooperative_context',
          switchContext.toCooperativeId,
          auditData.old_values,
          auditData.new_values
        );
      });
    } catch (error) {
      throw handleDatabaseError(error, 'Failed to log cooperative switch');
    }
  }

  /**
   * Get cooperative switch history for a user
   */
  async getCooperativeSwitchHistory(
    userId: string,
    limit: number = 50
  ): Promise<Array<{
    timestamp: string;
    fromCooperative: string | null;
    toCooperative: string;
    cooperativeName: string;
    switchReason: string;
    sessionId?: string;
  }>> {
    try {
      const query = `
        SELECT 
          al.created_at as timestamp,
          JSON_EXTRACT(al.old_values, '$.cooperative_id') as fromCooperative,
          al.entity_id as toCooperative,
          c.name as cooperativeName,
          JSON_EXTRACT(al.new_values, '$.switch_reason') as switchReason,
          JSON_EXTRACT(al.new_values, '$.session_id') as sessionId
        FROM audit_log al
        JOIN cooperatives c ON al.entity_id = c.id
        WHERE al.user_id = ?
          AND al.action = 'cooperative_switch'
          AND al.entity_type = 'cooperative_context'
        ORDER BY al.created_at DESC
        LIMIT ?
      `;

      const result = this.db.prepare(query).all(userId, limit);

      return result.map(row => ({
        timestamp: row.timestamp,
        fromCooperative: row.fromCooperative,
        toCooperative: row.toCooperative,
        cooperativeName: row.cooperativeName,
        switchReason: row.switchReason || 'user_request',
        sessionId: row.sessionId,
      }));
    } catch (error) {
      throw handleDatabaseError(error, 'Failed to get cooperative switch history');
    }
  }

  /**
   * Create test cooperatives for development
   */
  async createTestCooperatives(): Promise<Cooperative[]> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test cooperatives can only be created in development');
    }

    try {
      return withTransaction(() => {
        const testCooperatives = [
          {
            id: 'test-coop-1',
            name: 'Testförening Södermalm',
            orgNumber: '769900-1001',
            subdomain: 'test-sodermalm',
            city: 'Stockholm',
            totalApartments: 45,
            subscriptionTier: 'premium',
            subscriptionStatus: 'active',
          },
          {
            id: 'test-coop-2',
            name: 'Demo BRF Göteborg',
            orgNumber: '769900-1002',
            subdomain: 'demo-goteborg',
            city: 'Göteborg',
            totalApartments: 30,
            subscriptionTier: 'standard',
            subscriptionStatus: 'trial',
          },
          {
            id: 'test-coop-3',
            name: 'Test HSB Malmö',
            orgNumber: '769900-1003',
            subdomain: 'test-malmo',
            city: 'Malmö',
            totalApartments: 60,
            subscriptionTier: 'enterprise',
            subscriptionStatus: 'active',
          },
        ];

        const insertQuery = `
          INSERT OR REPLACE INTO cooperatives (
            id, name, org_number, subdomain, city, total_apartments,
            subscription_tier, subscription_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;

        const preparedStatement = this.db.prepare(insertQuery);

        return testCooperatives.map(coop => {
          preparedStatement.run(
            coop.id,
            coop.name,
            coop.orgNumber,
            coop.subdomain,
            coop.city,
            coop.totalApartments,
            coop.subscriptionTier,
            coop.subscriptionStatus
          );

          return {
            ...coop,
            isTestData: true,
          } as Cooperative;
        });
      });
    } catch (error) {
      throw handleDatabaseError(error, 'Failed to create test cooperatives');
    }
  }

  /**
   * Clean up test data (for development)
   */
  async cleanupTestCooperatives(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test cleanup can only be run in development');
    }

    try {
      return withTransaction(() => {
        // Delete test cooperatives and related data
        const cleanupQueries = [
          "DELETE FROM audit_log WHERE entity_type = 'cooperative_context' AND entity_id LIKE 'test-%'",
          "DELETE FROM members WHERE cooperative_id LIKE 'test-%'",
          "DELETE FROM apartments WHERE cooperative_id LIKE 'test-%'",
          "DELETE FROM cases WHERE cooperative_id LIKE 'test-%'",
          "DELETE FROM invoices WHERE cooperative_id LIKE 'test-%'",
          "DELETE FROM documents WHERE cooperative_id LIKE 'test-%'",
          "DELETE FROM cooperatives WHERE id LIKE 'test-%' OR name LIKE '%Test%' OR name LIKE '%Demo%'",
        ];

        cleanupQueries.forEach(query => {
          this.db.prepare(query).run();
        });
      });
    } catch (error) {
      throw handleDatabaseError(error, 'Failed to cleanup test cooperatives');
    }
  }

  /**
   * Get cooperative isolation test results
   */
  async validateDataIsolation(
    cooperativeId: string,
    securityContext: SecurityContext
  ): Promise<{
    isIsolated: boolean;
    violations: Array<{
      table: string;
      violationType: 'cross_cooperative_access' | 'missing_rls' | 'data_leakage';
      details: string;
    }>;
  }> {
    try {
      const violations: Array<{
        table: string;
        violationType: 'cross_cooperative_access' | 'missing_rls' | 'data_leakage';
        details: string;
      }> = [];

      // Test tables that should be isolated by cooperative_id
      const isolatedTables = [
        'members', 'apartments', 'cases', 'invoices', 'documents', 
        'monthly_fees', 'board_meetings', 'energy_consumption',
        'contractor_ratings', 'bookings', 'queue_positions', 'loans'
      ];

      for (const table of isolatedTables) {
        // Check for cross-cooperative data access
        const crossAccessQuery = `
          SELECT COUNT(*) as violation_count
          FROM ${table}
          WHERE cooperative_id != ?
        `;

        try {
          const rlsDb = createRLSDatabase(this.db, {
            cooperative_id: cooperativeId,
            user_id: securityContext.user_id,
            user_role: securityContext.user_role,
          });

          const result = this.db.prepare(crossAccessQuery).get(cooperativeId);
          
          if (result.violation_count > 0) {
            violations.push({
              table,
              violationType: 'cross_cooperative_access',
              details: `Found ${result.violation_count} records from other cooperatives`,
            });
          }
        } catch (error) {
          violations.push({
            table,
            violationType: 'missing_rls',
            details: `RLS query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }

      return {
        isIsolated: violations.length === 0,
        violations,
      };
    } catch (error) {
      throw handleDatabaseError(error, 'Failed to validate data isolation');
    }
  }
}

// Singleton instance
export const cooperativeService = new CooperativeService();
export default cooperativeService;