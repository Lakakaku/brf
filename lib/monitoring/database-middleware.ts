import Database from 'better-sqlite3';
import { performanceCollector, createQueryHash, PerformanceTimer } from './collector';

/**
 * Database performance monitoring middleware for Better SQLite3
 * Tracks query execution times, row counts, and identifies slow queries
 */

export interface QueryContext {
  cooperativeId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  endpoint?: string;
  operation?: string;
}

export interface DatabaseStats {
  totalQueries: number;
  slowQueries: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  queriesByType: Record<string, number>;
  slowestQueries: Array<{
    hash: string;
    executionTime: number;
    query: string;
  }>;
}

/**
 * Enhanced database wrapper with performance monitoring
 */
export class MonitoredDatabase {
  private db: Database.Database;
  private enabled: boolean = true;
  private slowQueryThreshold: number = 1000; // 1 second
  private context: QueryContext = {};
  private stats: DatabaseStats = {
    totalQueries: 0,
    slowQueries: 0,
    totalExecutionTime: 0,
    averageExecutionTime: 0,
    queriesByType: {},
    slowestQueries: [],
  };

  constructor(database: Database.Database) {
    this.db = database;
    this.instrumentDatabase();
  }

  /**
   * Set query context for subsequent operations
   */
  public setContext(context: QueryContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear query context
   */
  public clearContext(): void {
    this.context = {};
  }

  /**
   * Enable or disable monitoring
   */
  public setMonitoringEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set slow query threshold in milliseconds
   */
  public setSlowQueryThreshold(ms: number): void {
    this.slowQueryThreshold = ms;
  }

  /**
   * Get database statistics
   */
  public getStats(): DatabaseStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      queriesByType: {},
      slowestQueries: [],
    };
  }

  /**
   * Get the underlying database instance
   */
  public getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * Execute a monitored query
   */
  public monitoredExec(query: string): Database.RunResult {
    if (!this.enabled) {
      return this.db.exec(query);
    }

    const timer = new PerformanceTimer();
    let result: Database.RunResult;
    let error: Error | undefined;

    try {
      result = this.db.exec(query);
      return result;
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const executionTime = timer.stop();
      this.recordQuery({
        query,
        queryType: this.getQueryType(query),
        executionTime,
        result: result!,
        error,
      });
    }
  }

  /**
   * Create a monitored prepared statement
   */
  public monitoredPrepare<T extends any[] = any[]>(
    query: string
  ): MonitoredStatement<T> {
    const stmt = this.db.prepare(query);
    return new MonitoredStatement(stmt, query, this);
  }

  /**
   * Instrument the database with monitoring
   */
  private instrumentDatabase(): void {
    // Override exec method
    const originalExec = this.db.exec.bind(this.db);
    this.db.exec = (query: string) => {
      return this.monitoredExec(query);
    };

    // Override prepare method
    const originalPrepare = this.db.prepare.bind(this.db);
    this.db.prepare = <T extends any[] = any[]>(query: string) => {
      const stmt = originalPrepare(query);
      return new MonitoredStatement(stmt, query, this) as any;
    };
  }

  /**
   * Record query performance
   */
  public recordQuery({
    query,
    queryType,
    executionTime,
    result,
    error,
    tableName,
    operation,
  }: {
    query: string;
    queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION';
    executionTime: number;
    result?: Database.RunResult;
    error?: Error;
    tableName?: string;
    operation?: string;
  }): void {
    if (!this.enabled) return;

    const queryHash = createQueryHash(query);
    const isSlow = executionTime > this.slowQueryThreshold;

    // Update statistics
    this.stats.totalQueries++;
    this.stats.totalExecutionTime += executionTime;
    this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.totalQueries;
    
    this.stats.queriesByType[queryType] = (this.stats.queriesByType[queryType] || 0) + 1;
    
    if (isSlow) {
      this.stats.slowQueries++;
      this.stats.slowestQueries.push({
        hash: queryHash,
        executionTime,
        query: this.sanitizeQuery(query),
      });
      
      // Keep only top 10 slowest queries
      this.stats.slowestQueries.sort((a, b) => b.executionTime - a.executionTime);
      if (this.stats.slowestQueries.length > 10) {
        this.stats.slowestQueries = this.stats.slowestQueries.slice(0, 10);
      }
    }

    // Record to performance collector
    performanceCollector.recordQuery({
      queryHash,
      queryType,
      tableName: tableName || this.extractTableName(query),
      operation: operation || this.context.operation,
      executionTimeMs: executionTime,
      rowsAffected: result?.changes || 0,
      cooperativeId: this.context.cooperativeId,
      endpoint: this.context.endpoint,
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      requestId: this.context.requestId,
      errorOccurred: !!error,
      errorMessage: error?.message,
      parameters: {}, // Parameters are handled in MonitoredStatement
    });
  }

  /**
   * Get query type from SQL string
   */
  private getQueryType(query: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION' {
    const trimmed = query.trim().toUpperCase();
    
    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    if (trimmed.startsWith('BEGIN') || trimmed.startsWith('COMMIT') || trimmed.startsWith('ROLLBACK')) {
      return 'TRANSACTION';
    }
    
    return 'SELECT'; // Default
  }

  /**
   * Extract table name from query
   */
  private extractTableName(query: string): string | undefined {
    const trimmed = query.trim().toUpperCase();
    
    // Simple regex patterns for common operations
    const patterns = [
      /(?:SELECT.*?FROM|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
    ];
    
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
    
    return undefined;
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/password['"]\s*[:=]\s*['"][^'"]*['"]/gi, 'password="***"')
      .replace(/token['"]\s*[:=]\s*['"][^'"]*['"]/gi, 'token="***"')
      .replace(/'[^']*password[^']*'/gi, "'***'")
      .substring(0, 500); // Limit length
  }
}

/**
 * Monitored prepared statement wrapper
 */
export class MonitoredStatement<T extends any[] = any[]> {
  private stmt: Database.Statement<T>;
  private query: string;
  private database: MonitoredDatabase;

  constructor(
    statement: Database.Statement<T>,
    query: string,
    database: MonitoredDatabase
  ) {
    this.stmt = statement;
    this.query = query;
    this.database = database;
  }

  /**
   * Execute the statement with monitoring
   */
  public run(...params: T): Database.RunResult {
    const timer = new PerformanceTimer();
    let result: Database.RunResult;
    let error: Error | undefined;

    try {
      result = this.stmt.run(...params);
      return result;
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const executionTime = timer.stop();
      this.database.recordQuery({
        query: this.query,
        queryType: this.database['getQueryType'](this.query),
        executionTime,
        result: result!,
        error,
      });
    }
  }

  /**
   * Get single row with monitoring
   */
  public get(...params: T): any {
    const timer = new PerformanceTimer();
    let result: any;
    let error: Error | undefined;

    try {
      result = this.stmt.get(...params);
      return result;
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const executionTime = timer.stop();
      this.database.recordQuery({
        query: this.query,
        queryType: 'SELECT',
        executionTime,
        result: { changes: 0, lastInsertRowid: 0 },
        error,
      });
    }
  }

  /**
   * Get all rows with monitoring
   */
  public all(...params: T): any[] {
    const timer = new PerformanceTimer();
    let result: any[];
    let error: Error | undefined;

    try {
      result = this.stmt.all(...params);
      return result;
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const executionTime = timer.stop();
      this.database.recordQuery({
        query: this.query,
        queryType: 'SELECT',
        executionTime,
        result: { changes: 0, lastInsertRowid: 0 },
        error,
      });
    }
  }

  /**
   * Iterate rows with monitoring
   */
  public *iterate(...params: T): IterableIterator<any> {
    const timer = new PerformanceTimer();
    let error: Error | undefined;
    let rowCount = 0;

    try {
      for (const row of this.stmt.iterate(...params)) {
        rowCount++;
        yield row;
      }
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const executionTime = timer.stop();
      this.database.recordQuery({
        query: this.query,
        queryType: 'SELECT',
        executionTime,
        result: { changes: rowCount, lastInsertRowid: 0 },
        error,
      });
    }
  }

  /**
   * Create pluck iterator
   */
  public pluck(column?: string): Database.Statement<T> {
    return this.stmt.pluck(column);
  }

  /**
   * Expand nested objects
   */
  public expand(expand?: boolean): Database.Statement<T> {
    return this.stmt.expand(expand);
  }

  /**
   * Bind parameters
   */
  public bind(...params: T): Database.Statement<T> {
    return this.stmt.bind(...params);
  }

  /**
   * Get statement info
   */
  public reader(): boolean {
    return this.stmt.reader;
  }
}

/**
 * Create a monitored database instance
 */
export function createMonitoredDatabase(database: Database.Database): MonitoredDatabase {
  return new MonitoredDatabase(database);
}

/**
 * Middleware for Next.js API routes to track database performance
 */
export function withDatabasePerformanceMonitoring(
  handler: (req: any, res: any) => Promise<any>,
  operation?: string
) {
  return async (req: any, res: any) => {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
    
    // Set database context
    const monitoredDb = createMonitoredDatabase(req.db || global.db);
    monitoredDb.setContext({
      cooperativeId: req.cooperative?.id,
      userId: req.user?.id,
      sessionId: req.sessionId,
      requestId,
      endpoint: `${req.method} ${req.url}`,
      operation,
    });

    // Attach monitored database to request
    req.monitoredDb = monitoredDb;

    try {
      const result = await handler(req, res);
      return result;
    } finally {
      // Clear context after request
      monitoredDb.clearContext();
    }
  };
}