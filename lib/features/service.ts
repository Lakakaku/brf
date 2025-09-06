/**
 * Feature Flag Service
 * Core service for managing and evaluating feature flags in the BRF Portal
 */

import { Database } from 'better-sqlite3';
import { getDatabase } from '../database';
import {
  FeatureFlag,
  FeatureFlagContext,
  FeatureFlagEvaluation,
  FeatureFlagUsage,
  FeatureFlagVariant,
  FeatureTargetConfig,
  BRFFeatureFlags,
} from './types';

export class FeatureFlagService {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Evaluate a feature flag for the given context
   */
  async evaluate(
    flagKey: string,
    context: FeatureFlagContext = {}
  ): Promise<FeatureFlagEvaluation> {
    const startTime = Date.now();
    
    try {
      // Get the feature flag
      const flag = await this.getFeatureFlag(flagKey, context.cooperative_id);
      
      if (!flag) {
        const result = {
          flag_key: flagKey,
          is_enabled: false,
          reason: 'flag_not_found',
          evaluation_time_ms: Date.now() - startTime,
        };
        await this.logUsage(flagKey, context, result);
        return result;
      }

      // Check if flag is active and not expired
      if (flag.status !== 'active' || !flag.is_enabled) {
        const result = {
          flag_key: flagKey,
          is_enabled: false,
          reason: flag.status !== 'active' ? 'flag_inactive' : 'flag_disabled',
          evaluation_time_ms: Date.now() - startTime,
        };
        await this.logUsage(flagKey, context, result, flag.id);
        return result;
      }

      // Check expiration
      if (flag.expires_at && new Date(flag.expires_at) < new Date()) {
        const result = {
          flag_key: flagKey,
          is_enabled: false,
          reason: 'flag_expired',
          evaluation_time_ms: Date.now() - startTime,
        };
        await this.logUsage(flagKey, context, result, flag.id);
        return result;
      }

      // Evaluate targeting rules
      const targetingResult = this.evaluateTargeting(flag, context);
      const result = {
        flag_key: flagKey,
        is_enabled: targetingResult.is_enabled,
        variant: targetingResult.variant,
        variant_config: targetingResult.variant_config,
        reason: targetingResult.reason,
        evaluation_time_ms: Date.now() - startTime,
      };

      await this.logUsage(flagKey, context, result, flag.id);
      return result;
    } catch (error) {
      const result = {
        flag_key: flagKey,
        is_enabled: false,
        reason: 'evaluation_error',
        evaluation_time_ms: Date.now() - startTime,
      };
      console.error('Feature flag evaluation error:', error);
      await this.logUsage(flagKey, context, result);
      return result;
    }
  }

  /**
   * Check if a feature flag is enabled (simple boolean check)
   */
  async isEnabled(
    flagKey: keyof BRFFeatureFlags,
    context: FeatureFlagContext = {}
  ): Promise<boolean> {
    const evaluation = await this.evaluate(flagKey, context);
    return evaluation.is_enabled;
  }

  /**
   * Get all feature flags for a cooperative
   */
  async getAllFlags(cooperativeId?: string): Promise<FeatureFlag[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM feature_flags 
      WHERE (cooperative_id = ? OR cooperative_id IS NULL)
      AND deleted_at IS NULL
      ORDER BY category, name
    `);
    
    const flags = stmt.all(cooperativeId || null) as FeatureFlag[];
    return flags.map(flag => ({
      ...flag,
      is_enabled: Boolean(flag.is_enabled),
      tags: JSON.parse(flag.tags as string || '[]'),
      dependencies: JSON.parse(flag.dependencies as string || '[]'),
      conflicts: JSON.parse(flag.conflicts as string || '[]'),
      target_config: JSON.parse(flag.target_config as string || '{}'),
      validation_rules: JSON.parse(flag.validation_rules as string || '{}'),
    }));
  }

  /**
   * Create a new feature flag
   */
  async createFlag(
    flag: Omit<FeatureFlag, 'id' | 'created_at' | 'updated_at'>
  ): Promise<FeatureFlag> {
    const stmt = this.db.prepare(`
      INSERT INTO feature_flags (
        cooperative_id, key, name, description, is_enabled, environment,
        target_type, target_config, category, tags, status, rollout_percentage,
        dependencies, conflicts, testing_notes, validation_rules,
        created_by, updated_by, enabled_at, disabled_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const result = stmt.get(
      flag.cooperative_id,
      flag.key,
      flag.name,
      flag.description,
      flag.is_enabled ? 1 : 0,
      flag.environment,
      flag.target_type,
      JSON.stringify(flag.target_config),
      flag.category,
      JSON.stringify(flag.tags),
      flag.status,
      flag.rollout_percentage,
      JSON.stringify(flag.dependencies),
      JSON.stringify(flag.conflicts),
      flag.testing_notes,
      JSON.stringify(flag.validation_rules),
      flag.created_by,
      flag.updated_by,
      flag.enabled_at,
      flag.disabled_at,
      flag.expires_at
    ) as FeatureFlag;

    return {
      ...result,
      is_enabled: Boolean(result.is_enabled),
      tags: JSON.parse(result.tags as string || '[]'),
      dependencies: JSON.parse(result.dependencies as string || '[]'),
      conflicts: JSON.parse(result.conflicts as string || '[]'),
      target_config: JSON.parse(result.target_config as string || '{}'),
      validation_rules: JSON.parse(result.validation_rules as string || '{}'),
    };
  }

  /**
   * Update a feature flag
   */
  async updateFlag(
    id: string,
    updates: Partial<FeatureFlag>
  ): Promise<FeatureFlag | null> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id' || key === 'created_at') return;
      
      if (key === 'is_enabled') {
        updateFields.push(`${key} = ?`);
        updateValues.push(value ? 1 : 0);
      } else if (typeof value === 'object' && value !== null) {
        updateFields.push(`${key} = ?`);
        updateValues.push(JSON.stringify(value));
      } else {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) return null;

    updateFields.push('updated_at = datetime(\'now\')');
    updateValues.push(id);

    const stmt = this.db.prepare(`
      UPDATE feature_flags 
      SET ${updateFields.join(', ')}
      WHERE id = ?
      RETURNING *
    `);

    const result = stmt.get(...updateValues) as FeatureFlag;
    if (!result) return null;

    return {
      ...result,
      is_enabled: Boolean(result.is_enabled),
      tags: JSON.parse(result.tags as string || '[]'),
      dependencies: JSON.parse(result.dependencies as string || '[]'),
      conflicts: JSON.parse(result.conflicts as string || '[]'),
      target_config: JSON.parse(result.target_config as string || '{}'),
      validation_rules: JSON.parse(result.validation_rules as string || '{}'),
    };
  }

  /**
   * Toggle a feature flag on/off
   */
  async toggleFlag(id: string, enabled: boolean, userId?: string): Promise<boolean> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE feature_flags 
      SET 
        is_enabled = ?,
        updated_by = ?,
        ${enabled ? 'enabled_at' : 'disabled_at'} = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(enabled ? 1 : 0, userId, now, id);
    return result.changes > 0;
  }

  /**
   * Delete a feature flag (soft delete)
   */
  async deleteFlag(id: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE feature_flags 
      SET deleted_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Get feature flag usage statistics
   */
  async getUsageStats(
    flagKey: string,
    cooperativeId?: string,
    days: number = 7
  ): Promise<{
    total_evaluations: number;
    enabled_evaluations: number;
    disabled_evaluations: number;
    unique_users: number;
    evaluations_by_day: { date: string; total: number; enabled: number }[];
  }> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // Total counts
    const totalStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_evaluations,
        SUM(is_enabled) as enabled_evaluations,
        SUM(CASE WHEN is_enabled = 0 THEN 1 ELSE 0 END) as disabled_evaluations,
        COUNT(DISTINCT user_id) as unique_users
      FROM feature_flag_usage 
      WHERE feature_key = ? 
        AND (cooperative_id = ? OR ? IS NULL)
        AND created_at >= ?
    `);

    const totals = totalStmt.get(
      flagKey,
      cooperativeId,
      cooperativeId,
      dateFrom.toISOString()
    ) as any;

    // Daily breakdown
    const dailyStmt = this.db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(is_enabled) as enabled
      FROM feature_flag_usage 
      WHERE feature_key = ? 
        AND (cooperative_id = ? OR ? IS NULL)
        AND created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    const daily = dailyStmt.all(
      flagKey,
      cooperativeId,
      cooperativeId,
      dateFrom.toISOString()
    ) as any[];

    return {
      total_evaluations: totals.total_evaluations || 0,
      enabled_evaluations: totals.enabled_evaluations || 0,
      disabled_evaluations: totals.disabled_evaluations || 0,
      unique_users: totals.unique_users || 0,
      evaluations_by_day: daily,
    };
  }

  // Private methods

  private async getFeatureFlag(
    key: string,
    cooperativeId?: string
  ): Promise<FeatureFlag | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM feature_flags 
      WHERE key = ? AND (cooperative_id = ? OR cooperative_id IS NULL)
      AND deleted_at IS NULL
      ORDER BY cooperative_id DESC NULLS LAST
      LIMIT 1
    `);

    const flag = stmt.get(key, cooperativeId || null) as FeatureFlag;
    if (!flag) return null;

    return {
      ...flag,
      is_enabled: Boolean(flag.is_enabled),
      tags: JSON.parse(flag.tags as string || '[]'),
      dependencies: JSON.parse(flag.dependencies as string || '[]'),
      conflicts: JSON.parse(flag.conflicts as string || '[]'),
      target_config: JSON.parse(flag.target_config as string || '{}'),
      validation_rules: JSON.parse(flag.validation_rules as string || '{}'),
    };
  }

  private evaluateTargeting(
    flag: FeatureFlag,
    context: FeatureFlagContext
  ): { is_enabled: boolean; variant?: string; variant_config?: any; reason: string } {
    const targetConfig = flag.target_config as FeatureTargetConfig;

    switch (flag.target_type) {
      case 'all':
        return { is_enabled: true, reason: 'target_all' };

      case 'percentage':
        const percentage = targetConfig.percentage || flag.rollout_percentage;
        const hash = this.hashString(`${flag.key}:${context.user_id || context.session_id || 'anonymous'}`);
        const userPercentage = hash % 100;
        return {
          is_enabled: userPercentage < percentage,
          reason: `target_percentage_${userPercentage < percentage ? 'included' : 'excluded'}`,
        };

      case 'users':
        if (!context.user_id || !targetConfig.users) {
          return { is_enabled: false, reason: 'target_users_no_match' };
        }
        const isUserMatch = targetConfig.users.includes(context.user_id);
        return {
          is_enabled: isUserMatch,
          reason: `target_users_${isUserMatch ? 'match' : 'no_match'}`,
        };

      case 'roles':
        if (!context.user?.role || !targetConfig.roles) {
          return { is_enabled: false, reason: 'target_roles_no_match' };
        }
        const isRoleMatch = targetConfig.roles.includes(context.user.role);
        return {
          is_enabled: isRoleMatch,
          reason: `target_roles_${isRoleMatch ? 'match' : 'no_match'}`,
        };

      case 'apartments':
        if (!context.apartment?.id || !targetConfig.apartments) {
          return { is_enabled: false, reason: 'target_apartments_no_match' };
        }
        const isApartmentMatch = targetConfig.apartments.includes(context.apartment.id);
        return {
          is_enabled: isApartmentMatch,
          reason: `target_apartments_${isApartmentMatch ? 'match' : 'no_match'}`,
        };

      default:
        return { is_enabled: false, reason: 'target_type_unknown' };
    }
  }

  private async logUsage(
    flagKey: string,
    context: FeatureFlagContext,
    evaluation: FeatureFlagEvaluation,
    flagId?: string
  ): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO feature_flag_usage (
          cooperative_id, feature_flag_id, feature_key, user_id, session_id,
          ip_address, user_agent, is_enabled, evaluation_reason,
          context_data, evaluation_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        context.cooperative_id || null,
        flagId || null,
        flagKey,
        context.user_id || null,
        context.session_id || null,
        context.ip_address || null,
        context.user_agent || null,
        evaluation.is_enabled ? 1 : 0,
        evaluation.reason,
        JSON.stringify({
          user: context.user,
          apartment: context.apartment,
          custom_attributes: context.custom_attributes,
        }),
        evaluation.evaluation_time_ms
      );
    } catch (error) {
      // Log usage tracking errors but don't fail the evaluation
      console.error('Failed to log feature flag usage:', error);
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// Singleton instance
let featureFlagService: FeatureFlagService | null = null;

export function getFeatureFlagService(): FeatureFlagService {
  if (!featureFlagService) {
    featureFlagService = new FeatureFlagService();
  }
  return featureFlagService;
}