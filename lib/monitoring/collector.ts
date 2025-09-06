import { getDatabase } from '../database';
import { performance } from 'perf_hooks';

export interface PerformanceMetric {
  name: string;
  category: 'system' | 'database' | 'api' | 'user_session' | 'brf_operations';
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  value: number;
  unit: string;
  cooperativeId?: string;
  endpoint?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

export interface QueryPerformance {
  queryHash: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION';
  tableName?: string;
  operation?: string;
  executionTimeMs: number;
  rowsAffected?: number;
  rowsExamined?: number;
  cooperativeId?: string;
  endpoint?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  queryPlan?: string;
  parameters?: Record<string, any>;
  errorOccurred?: boolean;
  errorMessage?: string;
}

export interface ApiPerformance {
  requestId: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  routePattern?: string;
  responseTimeMs: number;
  statusCode: number;
  responseSizeBytes?: number;
  requestSizeBytes?: number;
  cooperativeId?: string;
  userId?: string;
  userRole?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  databaseQueriesCount?: number;
  databaseTimeMs?: number;
  cacheHits?: number;
  cacheMisses?: number;
  errorOccurred?: boolean;
  errorType?: string;
  errorMessage?: string;
  apartmentId?: string;
  caseId?: string;
  startedAt: string;
}

/**
 * Performance monitoring collector for BRF Portal
 * Provides zero-cost collection with minimal overhead
 */
export class PerformanceCollector {
  private static instance: PerformanceCollector;
  private enabled: boolean = true;
  private batchSize: number = 100;
  private flushInterval: number = 30000; // 30 seconds
  private metricsBuffer: PerformanceMetric[] = [];
  private queryBuffer: QueryPerformance[] = [];
  private apiBuffer: ApiPerformance[] = [];
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.startFlushTimer();
  }

  public static getInstance(): PerformanceCollector {
    if (!PerformanceCollector.instance) {
      PerformanceCollector.instance = new PerformanceCollector();
    }
    return PerformanceCollector.instance;
  }

  /**
   * Enable or disable performance collection
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Record a performance metric
   */
  public recordMetric(metric: PerformanceMetric): void {
    if (!this.enabled) return;

    this.metricsBuffer.push({
      ...metric,
      metadata: metric.metadata || {},
      tags: metric.tags || {},
    });

    if (this.metricsBuffer.length >= this.batchSize) {
      this.flushMetrics();
    }
  }

  /**
   * Record database query performance
   */
  public recordQuery(query: QueryPerformance): void {
    if (!this.enabled) return;

    this.queryBuffer.push({
      ...query,
      parameters: query.parameters || {},
    });

    if (this.queryBuffer.length >= this.batchSize) {
      this.flushQueries();
    }
  }

  /**
   * Record API endpoint performance
   */
  public recordApi(api: ApiPerformance): void {
    if (!this.enabled) return;

    this.apiBuffer.push(api);

    if (this.apiBuffer.length >= this.batchSize) {
      this.flushApi();
    }
  }

  /**
   * Create a performance timer
   */
  public createTimer(): PerformanceTimer {
    return new PerformanceTimer();
  }

  /**
   * Record system metrics (CPU, memory, etc.)
   */
  public async recordSystemMetrics(cooperativeId?: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();

      this.recordMetric({
        name: 'memory_usage',
        category: 'system',
        type: 'gauge',
        value: memUsage.rss,
        unit: 'bytes',
        cooperativeId,
        tags: { type: 'rss' },
      });

      this.recordMetric({
        name: 'memory_usage',
        category: 'system',
        type: 'gauge',
        value: memUsage.heapUsed,
        unit: 'bytes',
        cooperativeId,
        tags: { type: 'heap_used' },
      });

      this.recordMetric({
        name: 'memory_usage',
        category: 'system',
        type: 'gauge',
        value: memUsage.heapTotal,
        unit: 'bytes',
        cooperativeId,
        tags: { type: 'heap_total' },
      });

      this.recordMetric({
        name: 'uptime',
        category: 'system',
        type: 'gauge',
        value: uptime,
        unit: 'seconds',
        cooperativeId,
      });

      // Record Node.js event loop lag
      const startTime = performance.now();
      setImmediate(() => {
        const lag = performance.now() - startTime;
        this.recordMetric({
          name: 'event_loop_lag',
          category: 'system',
          type: 'gauge',
          value: lag,
          unit: 'ms',
          cooperativeId,
        });
      });
    } catch (error) {
      console.error('Failed to record system metrics:', error);
    }
  }

  /**
   * Record BRF-specific business metrics
   */
  public async recordBrfMetrics(
    cooperativeId: string,
    periodType: 'hourly' | 'daily' | 'weekly' | 'monthly',
    periodStart: string,
    periodEnd: string
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const db = getDatabase();
      
      // Calculate financial metrics
      const invoiceStats = db.prepare(`
        SELECT 
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_invoices,
          SUM(total_amount) as total_amount,
          COUNT(CASE WHEN payment_status = 'overdue' THEN 1 END) as overdue_count,
          SUM(CASE WHEN payment_status = 'overdue' THEN total_amount ELSE 0 END) as overdue_amount
        FROM invoices 
        WHERE cooperative_id = ? 
          AND created_at BETWEEN ? AND ?
      `).get(cooperativeId, periodStart, periodEnd) as any;

      // Calculate member activity
      const memberStats = db.prepare(`
        SELECT COUNT(*) as active_members
        FROM members 
        WHERE cooperative_id = ? 
          AND is_active = 1 
          AND deleted_at IS NULL
      `).get(cooperativeId) as any;

      // Calculate case metrics
      const caseStats = db.prepare(`
        SELECT 
          COUNT(CASE WHEN status = 'open' THEN 1 END) as cases_opened,
          COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as cases_resolved,
          AVG(CASE 
            WHEN resolved_at IS NOT NULL 
            THEN julianday(resolved_at) - julianday(reported_at)
            ELSE NULL 
          END) as avg_resolution_days
        FROM cases 
        WHERE cooperative_id = ? 
          AND reported_at BETWEEN ? AND ?
      `).get(cooperativeId, periodStart, periodEnd) as any;

      // Calculate energy efficiency
      const energyStats = db.prepare(`
        SELECT 
          AVG(kwh_per_sqm) as avg_kwh_per_sqm,
          AVG(cost_per_sqm) as avg_cost_per_sqm
        FROM energy_consumption 
        WHERE cooperative_id = ? 
          AND period_start BETWEEN ? AND ?
      `).get(cooperativeId, periodStart, periodEnd) as any;

      // Insert BRF business metrics
      db.prepare(`
        INSERT OR REPLACE INTO brf_business_metrics (
          cooperative_id, period_type, period_start, period_end,
          invoices_processed, invoices_approved, total_invoice_amount,
          payment_collection_rate, overdue_payments_count, overdue_amount,
          active_members_count, maintenance_cases_opened, maintenance_cases_resolved,
          case_resolution_time_avg_days, energy_cost_per_sqm
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cooperativeId, periodType, periodStart, periodEnd,
        invoiceStats?.total_invoices || 0,
        invoiceStats?.paid_invoices || 0,
        invoiceStats?.total_amount || 0,
        invoiceStats?.total_invoices > 0 ? ((invoiceStats?.paid_invoices || 0) / invoiceStats.total_invoices) * 100 : 0,
        invoiceStats?.overdue_count || 0,
        invoiceStats?.overdue_amount || 0,
        memberStats?.active_members || 0,
        caseStats?.cases_opened || 0,
        caseStats?.cases_resolved || 0,
        caseStats?.avg_resolution_days || 0,
        energyStats?.avg_cost_per_sqm || 0
      );
    } catch (error) {
      console.error('Failed to record BRF metrics:', error);
    }
  }

  /**
   * Flush all buffered metrics to database
   */
  public async flushAll(): Promise<void> {
    await Promise.all([
      this.flushMetrics(),
      this.flushQueries(),
      this.flushApi(),
    ]);
  }

  /**
   * Flush performance metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO performance_metrics (
          cooperative_id, metric_name, metric_category, metric_type,
          value, unit, endpoint, user_id, session_id, request_id,
          metadata, tags, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction(() => {
        for (const metric of this.metricsBuffer) {
          stmt.run(
            metric.cooperativeId || null,
            metric.name,
            metric.category,
            metric.type,
            metric.value,
            metric.unit,
            metric.endpoint || null,
            metric.userId || null,
            metric.sessionId || null,
            metric.requestId || null,
            JSON.stringify(metric.metadata),
            JSON.stringify(metric.tags),
            new Date().toISOString()
          );
        }
      });

      transaction();
      this.metricsBuffer = [];
    } catch (error) {
      console.error('Failed to flush performance metrics:', error);
    }
  }

  /**
   * Flush query performance to database
   */
  private async flushQueries(): Promise<void> {
    if (this.queryBuffer.length === 0) return;

    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO query_performance (
          cooperative_id, query_hash, query_type, table_name, operation,
          execution_time_ms, rows_affected, rows_examined, endpoint,
          user_id, session_id, request_id, query_plan, parameters,
          error_occurred, error_message, executed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction(() => {
        for (const query of this.queryBuffer) {
          stmt.run(
            query.cooperativeId || null,
            query.queryHash,
            query.queryType,
            query.tableName || null,
            query.operation || null,
            query.executionTimeMs,
            query.rowsAffected || 0,
            query.rowsExamined || 0,
            query.endpoint || null,
            query.userId || null,
            query.sessionId || null,
            query.requestId || null,
            query.queryPlan || null,
            JSON.stringify(query.parameters),
            query.errorOccurred ? 1 : 0,
            query.errorMessage || null,
            new Date().toISOString()
          );
        }
      });

      transaction();
      this.queryBuffer = [];
    } catch (error) {
      console.error('Failed to flush query performance:', error);
    }
  }

  /**
   * Flush API performance to database
   */
  private async flushApi(): Promise<void> {
    if (this.apiBuffer.length === 0) return;

    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO api_performance (
          cooperative_id, request_id, method, endpoint, route_pattern,
          response_time_ms, status_code, response_size_bytes, request_size_bytes,
          user_id, user_role, session_id, ip_address, user_agent,
          database_queries_count, database_time_ms, cache_hits, cache_misses,
          error_occurred, error_type, error_message, apartment_id, case_id,
          started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction(() => {
        for (const api of this.apiBuffer) {
          stmt.run(
            api.cooperativeId || null,
            api.requestId,
            api.method,
            api.endpoint,
            api.routePattern || null,
            api.responseTimeMs,
            api.statusCode,
            api.responseSizeBytes || 0,
            api.requestSizeBytes || 0,
            api.userId || null,
            api.userRole || null,
            api.sessionId || null,
            api.ipAddress || null,
            api.userAgent || null,
            api.databaseQueriesCount || 0,
            api.databaseTimeMs || 0,
            api.cacheHits || 0,
            api.cacheMisses || 0,
            api.errorOccurred ? 1 : 0,
            api.errorType || null,
            api.errorMessage || null,
            api.apartmentId || null,
            api.caseId || null,
            api.startedAt,
            new Date().toISOString()
          );
        }
      });

      transaction();
      this.apiBuffer = [];
    } catch (error) {
      console.error('Failed to flush API performance:', error);
    }
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushAll();
    }, this.flushInterval);
  }

  /**
   * Stop the collector and flush remaining data
   */
  public async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushAll();
  }
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Stop the timer and return elapsed time
   */
  public stop(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  /**
   * Get elapsed time without stopping the timer
   */
  public elapsed(): number {
    return performance.now() - this.startTime;
  }

  /**
   * Reset the timer
   */
  public reset(): void {
    this.startTime = performance.now();
    this.endTime = undefined;
  }
}

/**
 * Utility functions for performance monitoring
 */
export const createRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createQueryHash = (query: string): string => {
  // Simple hash function for query normalization
  let hash = 0;
  const normalizedQuery = query.replace(/\s+/g, ' ').trim().toLowerCase();
  
  for (let i = 0; i < normalizedQuery.length; i++) {
    const char = normalizedQuery.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
};

// Export singleton instance
export const performanceCollector = PerformanceCollector.getInstance();