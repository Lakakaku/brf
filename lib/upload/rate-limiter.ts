/**
 * Rate Limiting System for Bulk Uploads
 * Implements sliding window rate limiting for the BRF Portal
 */

import Database from 'better-sqlite3';

export interface RateLimitRule {
  operation: string;
  window_minutes: number;
  max_requests: number;
  burst_limit?: number;
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  retry_after_seconds?: number;
}

export interface RateLimitUsage {
  operation: string;
  count: number;
  timestamp?: Date;
}

export class RateLimiter {
  private db: Database.Database;
  private defaultRules: Map<string, RateLimitRule> = new Map();

  constructor(database: Database.Database) {
    this.db = database;
    this.initializeDefaultRules();
    this.cleanupOldRecords();
  }

  /**
   * Initialize default rate limiting rules
   */
  private initializeDefaultRules(): void {
    this.defaultRules.set('create_batch', {
      operation: 'create_batch',
      window_minutes: 60,
      max_requests: 10,
      burst_limit: 3,
    });

    this.defaultRules.set('upload_file', {
      operation: 'upload_file',
      window_minutes: 60,
      max_requests: 1000,
      burst_limit: 50,
    });

    this.defaultRules.set('api_request', {
      operation: 'api_request',
      window_minutes: 1,
      max_requests: 100,
      burst_limit: 10,
    });

    this.defaultRules.set('webhook_call', {
      operation: 'webhook_call',
      window_minutes: 1,
      max_requests: 60,
      burst_limit: 5,
    });

    this.defaultRules.set('worker_heartbeat', {
      operation: 'worker_heartbeat',
      window_minutes: 1,
      max_requests: 120, // Allow 2 heartbeats per second
    });
  }

  /**
   * Check if an operation is allowed under rate limits
   */
  async checkRateLimit(
    cooperative_id: string, 
    usage: RateLimitUsage,
    customRule?: RateLimitRule
  ): Promise<RateLimitCheck> {
    const rule = customRule || this.getRule(cooperative_id, usage.operation);
    const now = new Date();
    const windowStart = new Date(now.getTime() - (rule.window_minutes * 60 * 1000));

    // Get current usage count in the window
    const currentUsage = this.getCurrentUsage(cooperative_id, usage.operation, windowStart, now);
    
    // Check burst limit first (last minute)
    if (rule.burst_limit) {
      const burstWindowStart = new Date(now.getTime() - 60000); // 1 minute
      const burstUsage = this.getCurrentUsage(cooperative_id, usage.operation, burstWindowStart, now);
      
      if (burstUsage >= rule.burst_limit) {
        return {
          allowed: false,
          remaining: 0,
          reset_at: new Date(now.getTime() + 60000).toISOString(),
          retry_after_seconds: 60,
        };
      }
    }

    // Check main window limit
    const newTotal = currentUsage + usage.count;
    const allowed = newTotal <= rule.max_requests;
    
    if (!allowed) {
      const resetAt = new Date(now.getTime() + (rule.window_minutes * 60 * 1000));
      return {
        allowed: false,
        remaining: 0,
        reset_at: resetAt.toISOString(),
        retry_after_seconds: rule.window_minutes * 60,
      };
    }

    return {
      allowed: true,
      remaining: rule.max_requests - newTotal,
      reset_at: new Date(now.getTime() + (rule.window_minutes * 60 * 1000)).toISOString(),
    };
  }

  /**
   * Record usage for rate limiting
   */
  async recordUsage(cooperative_id: string, usage: RateLimitUsage): Promise<void> {
    const timestamp = usage.timestamp || new Date();
    
    // Store usage record for rate limiting
    const stmt = this.db.prepare(`
      INSERT INTO bulk_upload_events (
        cooperative_id, event_type, event_level, event_source,
        event_message, event_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      cooperative_id,
      'rate_limit_usage',
      'debug',
      'rate_limiter',
      `Rate limit usage recorded for ${usage.operation}`,
      JSON.stringify({
        operation: usage.operation,
        count: usage.count,
      }),
      timestamp.toISOString()
    );

    // Also update or insert into a dedicated rate limiting table if needed
    this.updateRateLimitCounters(cooperative_id, usage.operation, usage.count, timestamp);
  }

  /**
   * Get rate limiting rule for a cooperative and operation
   */
  private getRule(cooperative_id: string, operation: string): RateLimitRule {
    // First try to get cooperative-specific rule
    const customRule = this.getCustomRule(cooperative_id, operation);
    if (customRule) {
      return customRule;
    }

    // Fall back to default rule
    const defaultRule = this.defaultRules.get(operation);
    if (defaultRule) {
      return defaultRule;
    }

    // Ultimate fallback - generic rule
    return {
      operation,
      window_minutes: 60,
      max_requests: 100,
    };
  }

  /**
   * Get custom rate limiting rule for a cooperative
   */
  private getCustomRule(cooperative_id: string, operation: string): RateLimitRule | null {
    const stmt = this.db.prepare(`
      SELECT * FROM bulk_upload_settings 
      WHERE cooperative_id = ?
    `);

    const settings = stmt.get(cooperative_id);
    if (!settings) return null;

    // Check if custom rate limits are defined in settings
    const customSettings = JSON.parse(settings.custom_settings || '{}');
    const rateLimits = customSettings.rate_limits || {};
    const rule = rateLimits[operation];
    
    if (rule) {
      return {
        operation,
        window_minutes: rule.window_minutes || 60,
        max_requests: rule.max_requests || 100,
        burst_limit: rule.burst_limit,
      };
    }

    return null;
  }

  /**
   * Get current usage count within a time window
   */
  private getCurrentUsage(
    cooperative_id: string, 
    operation: string, 
    windowStart: Date, 
    windowEnd: Date
  ): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(SUM(
        CAST(JSON_EXTRACT(event_data, '$.count') AS INTEGER)
      ), 0) as total_usage
      FROM bulk_upload_events
      WHERE cooperative_id = ?
        AND event_type = 'rate_limit_usage'
        AND JSON_EXTRACT(event_data, '$.operation') = ?
        AND created_at >= ?
        AND created_at < ?
    `);

    const result = stmt.get(
      cooperative_id,
      operation,
      windowStart.toISOString(),
      windowEnd.toISOString()
    );

    return result?.total_usage || 0;
  }

  /**
   * Update rate limit counters (for faster lookups)
   */
  private updateRateLimitCounters(
    cooperative_id: string, 
    operation: string, 
    count: number, 
    timestamp: Date
  ): void {
    // Create or update counter for the current minute window
    const minuteWindow = new Date(timestamp);
    minuteWindow.setSeconds(0, 0); // Round down to minute boundary

    const stmt = this.db.prepare(`
      INSERT INTO bulk_upload_events (
        cooperative_id, event_type, event_level, event_source,
        event_message, event_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `);

    stmt.run(
      cooperative_id,
      'rate_limit_counter',
      'debug',
      'rate_limiter',
      `Rate limit counter for ${operation}`,
      JSON.stringify({
        operation,
        count,
        window: minuteWindow.toISOString(),
      }),
      timestamp.toISOString()
    );
  }

  /**
   * Get rate limit status for a cooperative
   */
  getRateLimitStatus(cooperative_id: string): {
    operations: Record<string, {
      current_usage: number;
      limit: number;
      remaining: number;
      window_minutes: number;
      reset_at: string;
    }>;
  } {
    const now = new Date();
    const operations: Record<string, any> = {};

    // Check all known operations
    const operationTypes = Array.from(this.defaultRules.keys());
    
    for (const operation of operationTypes) {
      const rule = this.getRule(cooperative_id, operation);
      const windowStart = new Date(now.getTime() - (rule.window_minutes * 60 * 1000));
      const currentUsage = this.getCurrentUsage(cooperative_id, operation, windowStart, now);
      
      operations[operation] = {
        current_usage: currentUsage,
        limit: rule.max_requests,
        remaining: Math.max(0, rule.max_requests - currentUsage),
        window_minutes: rule.window_minutes,
        reset_at: new Date(now.getTime() + (rule.window_minutes * 60 * 1000)).toISOString(),
      };
    }

    return { operations };
  }

  /**
   * Update rate limiting rules for a cooperative
   */
  updateRateLimitRules(
    cooperative_id: string, 
    rules: Record<string, Partial<RateLimitRule>>
  ): void {
    // Get current settings
    let stmt = this.db.prepare(`
      SELECT custom_settings FROM bulk_upload_settings 
      WHERE cooperative_id = ?
    `);

    let currentSettings = {};
    const result = stmt.get(cooperative_id);
    if (result?.custom_settings) {
      currentSettings = JSON.parse(result.custom_settings);
    }

    // Update rate limit rules
    const updatedSettings = {
      ...currentSettings,
      rate_limits: {
        ...(currentSettings as any).rate_limits || {},
        ...rules,
      },
    };

    // Save back to database
    stmt = this.db.prepare(`
      UPDATE bulk_upload_settings 
      SET custom_settings = ?, updated_at = datetime('now')
      WHERE cooperative_id = ?
    `);

    const updateResult = stmt.run(JSON.stringify(updatedSettings), cooperative_id);
    
    // If no settings exist, create them
    if (updateResult.changes === 0) {
      stmt = this.db.prepare(`
        INSERT INTO bulk_upload_settings (
          id, cooperative_id, custom_settings, created_at, updated_at
        ) VALUES (hex(randomblob(16)), ?, ?, datetime('now'), datetime('now'))
      `);

      stmt.run(cooperative_id, JSON.stringify(updatedSettings));
    }
  }

  /**
   * Check if IP address is rate limited
   */
  async checkIPRateLimit(
    ip_address: string, 
    operation: string = 'api_request',
    count: number = 1
  ): Promise<RateLimitCheck> {
    const rule = this.defaultRules.get(operation) || {
      operation,
      window_minutes: 60,
      max_requests: 1000,
      burst_limit: 100,
    };

    const now = new Date();
    const windowStart = new Date(now.getTime() - (rule.window_minutes * 60 * 1000));

    // Get current usage by IP
    const currentUsage = this.getIPUsage(ip_address, operation, windowStart, now);
    
    // Check burst limit
    if (rule.burst_limit) {
      const burstWindowStart = new Date(now.getTime() - 60000); // 1 minute
      const burstUsage = this.getIPUsage(ip_address, operation, burstWindowStart, now);
      
      if (burstUsage >= rule.burst_limit) {
        return {
          allowed: false,
          remaining: 0,
          reset_at: new Date(now.getTime() + 60000).toISOString(),
          retry_after_seconds: 60,
        };
      }
    }

    const newTotal = currentUsage + count;
    const allowed = newTotal <= rule.max_requests;
    
    if (!allowed) {
      const resetAt = new Date(now.getTime() + (rule.window_minutes * 60 * 1000));
      return {
        allowed: false,
        remaining: 0,
        reset_at: resetAt.toISOString(),
        retry_after_seconds: rule.window_minutes * 60,
      };
    }

    return {
      allowed: true,
      remaining: rule.max_requests - newTotal,
      reset_at: new Date(now.getTime() + (rule.window_minutes * 60 * 1000)).toISOString(),
    };
  }

  /**
   * Record IP usage for rate limiting
   */
  async recordIPUsage(ip_address: string, operation: string, count: number = 1): Promise<void> {
    const timestamp = new Date();
    
    const stmt = this.db.prepare(`
      INSERT INTO bulk_upload_events (
        cooperative_id, event_type, event_level, event_source,
        event_message, request_ip, event_data, created_at
      ) VALUES ('system', ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      'ip_rate_limit_usage',
      'debug',
      'rate_limiter',
      `IP rate limit usage recorded for ${operation}`,
      ip_address,
      JSON.stringify({
        operation,
        count,
      }),
      timestamp.toISOString()
    );
  }

  /**
   * Get IP usage within time window
   */
  private getIPUsage(
    ip_address: string, 
    operation: string, 
    windowStart: Date, 
    windowEnd: Date
  ): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(SUM(
        CAST(JSON_EXTRACT(event_data, '$.count') AS INTEGER)
      ), 0) as total_usage
      FROM bulk_upload_events
      WHERE event_type = 'ip_rate_limit_usage'
        AND request_ip = ?
        AND JSON_EXTRACT(event_data, '$.operation') = ?
        AND created_at >= ?
        AND created_at < ?
    `);

    const result = stmt.get(
      ip_address,
      operation,
      windowStart.toISOString(),
      windowEnd.toISOString()
    );

    return result?.total_usage || 0;
  }

  /**
   * Clean up old rate limiting records
   */
  private cleanupOldRecords(): void {
    // Clean up records older than 24 hours
    const cutoffDate = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
    const stmt = this.db.prepare(`
      DELETE FROM bulk_upload_events
      WHERE event_type IN ('rate_limit_usage', 'rate_limit_counter', 'ip_rate_limit_usage')
        AND created_at < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} old rate limit records`);
    }
  }

  /**
   * Get blocked IPs and cooperatives
   */
  getBlockedEntities(): {
    blocked_ips: Array<{
      ip_address: string;
      operations: string[];
      blocked_until: string;
    }>;
    rate_limited_cooperatives: Array<{
      cooperative_id: string;
      operations: string[];
      current_usage: Record<string, number>;
    }>;
  } {
    const now = new Date();
    
    // This would require more sophisticated tracking
    // For now, return empty arrays as placeholder
    return {
      blocked_ips: [],
      rate_limited_cooperatives: [],
    };
  }

  /**
   * Reset rate limits for a cooperative (admin function)
   */
  resetRateLimits(cooperative_id: string, operation?: string): void {
    let whereClause = `
      WHERE cooperative_id = ? 
      AND event_type IN ('rate_limit_usage', 'rate_limit_counter')
    `;
    const params = [cooperative_id];
    
    if (operation) {
      whereClause += ` AND JSON_EXTRACT(event_data, '$.operation') = ?`;
      params.push(operation);
    }

    const stmt = this.db.prepare(`
      DELETE FROM bulk_upload_events ${whereClause}
    `);

    const result = stmt.run(...params);
    console.log(`Reset rate limits for cooperative ${cooperative_id}: ${result.changes} records removed`);
  }
}