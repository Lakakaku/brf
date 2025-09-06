/**
 * Base Data Generator
 * 
 * Core infrastructure for generating test data with configurable options,
 * validation, and performance optimization for bulk operations.
 * 
 * Provides foundation for all entity-specific data generators in the
 * Swedish BRF portal testing system.
 */

import { randomBytes } from 'crypto';
import Database from 'better-sqlite3';

export interface GenerationOptions {
  count: number;
  seed?: string;
  batchSize?: number;
  validateData?: boolean;
  skipDuplicates?: boolean;
  parallel?: boolean;
  progressCallback?: (progress: GenerationProgress) => void;
}

export interface GenerationProgress {
  phase: string;
  current: number;
  total: number;
  percentage: number;
  startTime: number;
  estimatedTimeRemaining?: number;
  errorsCount: number;
  successCount: number;
}

export interface GenerationResult<T> {
  success: boolean;
  data: T[];
  errors: GenerationError[];
  statistics: GenerationStatistics;
  metadata: GenerationMetadata;
}

export interface GenerationError {
  type: 'validation' | 'constraint' | 'database' | 'generation' | 'unknown';
  message: string;
  data?: any;
  timestamp: Date;
  phase: string;
}

export interface GenerationStatistics {
  totalRequested: number;
  totalGenerated: number;
  totalInserted: number;
  totalErrors: number;
  executionTimeMs: number;
  averageGenerationTimeMs: number;
  averageInsertionTimeMs: number;
  memoryUsageMB?: number;
}

export interface GenerationMetadata {
  seed: string;
  generator: string;
  version: string;
  timestamp: Date;
  options: GenerationOptions;
  environment: {
    nodeVersion: string;
    databaseType: string;
    platform: string;
  };
}

export interface EntityValidator<T> {
  validate(data: T): ValidationResult;
  sanitize(data: T): T;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DataConstraints {
  unique?: string[]; // Fields that must be unique
  required?: string[]; // Fields that must not be null/undefined
  patterns?: { [field: string]: RegExp }; // Regex patterns for fields
  ranges?: { [field: string]: { min?: number; max?: number } }; // Numeric ranges
  dependencies?: { [field: string]: string[] }; // Fields that depend on others
}

/**
 * Abstract base class for all data generators
 */
export abstract class BaseDataGenerator<T> {
  protected seed: string;
  protected random: () => number;
  protected constraints: DataConstraints;
  protected validator?: EntityValidator<T>;
  protected generatedData: Set<string> = new Set(); // For duplicate detection
  
  constructor(
    seed?: string,
    constraints: DataConstraints = {},
    validator?: EntityValidator<T>
  ) {
    this.seed = seed || this.generateSeed();
    this.random = this.createSeededRandom(this.seed);
    this.constraints = constraints;
    this.validator = validator;
  }

  /**
   * Generate a single entity
   */
  abstract generateSingle(context?: any): T;

  /**
   * Generate multiple entities with full error handling and progress tracking
   */
  async generate(options: GenerationOptions): Promise<GenerationResult<T>> {
    const startTime = Date.now();
    const errors: GenerationError[] = [];
    const data: T[] = [];
    
    const progress: GenerationProgress = {
      phase: 'initialization',
      current: 0,
      total: options.count,
      percentage: 0,
      startTime,
      errorsCount: 0,
      successCount: 0
    };

    try {
      // Initialize
      this.updateProgress(progress, 'Initializing generator...', options.progressCallback);
      await this.initialize(options);

      // Reset random if seed is provided
      if (options.seed) {
        this.seed = options.seed;
        this.random = this.createSeededRandom(this.seed);
      }

      // Generate data
      progress.phase = 'generation';
      this.updateProgress(progress, 'Generating data...', options.progressCallback);

      const batchSize = options.batchSize || Math.min(options.count, 1000);
      const batches = Math.ceil(options.count / batchSize);

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, options.count);
        const batchCount = batchEnd - batchStart;

        try {
          const batchData = await this.generateBatch(batchCount, {
            batchIndex,
            totalBatches: batches,
            globalIndex: batchStart,
            options
          });

          for (const item of batchData) {
            try {
              // Validate if requested
              if (options.validateData && this.validator) {
                const validation = this.validator.validate(item);
                if (!validation.isValid) {
                  errors.push({
                    type: 'validation',
                    message: `Validation failed: ${validation.errors.join(', ')}`,
                    data: item,
                    timestamp: new Date(),
                    phase: 'validation'
                  });
                  progress.errorsCount++;
                  continue;
                }
              }

              // Check for duplicates if requested
              if (options.skipDuplicates && this.isDuplicate(item)) {
                errors.push({
                  type: 'constraint',
                  message: 'Duplicate data detected and skipped',
                  data: item,
                  timestamp: new Date(),
                  phase: 'duplicate_check'
                });
                progress.errorsCount++;
                continue;
              }

              data.push(item);
              progress.successCount++;
              this.markAsGenerated(item);

            } catch (error: any) {
              errors.push({
                type: 'generation',
                message: error.message || 'Unknown generation error',
                data: item,
                timestamp: new Date(),
                phase: 'item_processing'
              });
              progress.errorsCount++;
            }
          }

          // Update progress
          progress.current = Math.min(batchEnd, options.count);
          progress.percentage = (progress.current / options.count) * 100;
          progress.estimatedTimeRemaining = this.calculateETA(startTime, progress.current, options.count);
          
          this.updateProgress(
            progress, 
            `Generated batch ${batchIndex + 1}/${batches} (${progress.successCount} items, ${progress.errorsCount} errors)`,
            options.progressCallback
          );

        } catch (error: any) {
          errors.push({
            type: 'generation',
            message: `Batch ${batchIndex} failed: ${error.message}`,
            data: { batchIndex, batchStart, batchEnd },
            timestamp: new Date(),
            phase: 'batch_generation'
          });
          progress.errorsCount += batchCount;
        }
      }

      // Finalization
      progress.phase = 'finalization';
      this.updateProgress(progress, 'Finalizing generation...', options.progressCallback);
      
      await this.finalize(data, options);

      const executionTime = Date.now() - startTime;
      
      // Calculate statistics
      const statistics: GenerationStatistics = {
        totalRequested: options.count,
        totalGenerated: data.length,
        totalInserted: data.length, // Will be updated by database insertion
        totalErrors: errors.length,
        executionTimeMs: executionTime,
        averageGenerationTimeMs: executionTime / Math.max(data.length, 1),
        averageInsertionTimeMs: 0, // Will be updated by database insertion
        memoryUsageMB: this.getMemoryUsage()
      };

      // Create metadata
      const metadata: GenerationMetadata = {
        seed: this.seed,
        generator: this.constructor.name,
        version: '1.0.0',
        timestamp: new Date(),
        options,
        environment: {
          nodeVersion: process.version,
          databaseType: 'sqlite',
          platform: process.platform
        }
      };

      progress.phase = 'complete';
      progress.percentage = 100;
      this.updateProgress(progress, `Generation complete: ${data.length} items generated`, options.progressCallback);

      return {
        success: errors.length === 0 || data.length > 0,
        data,
        errors,
        statistics,
        metadata
      };

    } catch (error: any) {
      errors.push({
        type: 'unknown',
        message: `Fatal error during generation: ${error.message}`,
        timestamp: new Date(),
        phase: progress.phase
      });

      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        data,
        errors,
        statistics: {
          totalRequested: options.count,
          totalGenerated: data.length,
          totalInserted: 0,
          totalErrors: errors.length,
          executionTimeMs: executionTime,
          averageGenerationTimeMs: executionTime / Math.max(data.length, 1),
          averageInsertionTimeMs: 0
        },
        metadata: {
          seed: this.seed,
          generator: this.constructor.name,
          version: '1.0.0',
          timestamp: new Date(),
          options,
          environment: {
            nodeVersion: process.version,
            databaseType: 'sqlite',
            platform: process.platform
          }
        }
      };
    }
  }

  /**
   * Generate a batch of entities
   */
  protected async generateBatch(count: number, context: any): Promise<T[]> {
    const batch: T[] = [];
    
    for (let i = 0; i < count; i++) {
      const item = this.generateSingle({
        ...context,
        itemIndex: context.globalIndex + i,
        batchItemIndex: i
      });
      batch.push(item);
    }
    
    return batch;
  }

  /**
   * Initialize generator before generation starts
   */
  protected async initialize(options: GenerationOptions): Promise<void> {
    // Override in subclasses if needed
    this.generatedData.clear();
  }

  /**
   * Finalize after generation completes
   */
  protected async finalize(data: T[], options: GenerationOptions): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Create seeded random number generator for reproducible results
   */
  protected createSeededRandom(seed: string): () => number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    let x = Math.sin(hash) * 10000;
    return () => {
      x = Math.sin(x) * 10000;
      return x - Math.floor(x);
    };
  }

  /**
   * Generate a unique seed
   */
  protected generateSeed(): string {
    return `${Date.now()}-${randomBytes(8).toString('hex')}`;
  }

  /**
   * Check if item is a duplicate
   */
  protected isDuplicate(item: T): boolean {
    if (!this.constraints.unique) return false;
    
    const uniqueKey = this.getUniqueKey(item);
    return this.generatedData.has(uniqueKey);
  }

  /**
   * Mark item as generated for duplicate detection
   */
  protected markAsGenerated(item: T): void {
    if (!this.constraints.unique) return;
    
    const uniqueKey = this.getUniqueKey(item);
    this.generatedData.add(uniqueKey);
  }

  /**
   * Get unique key for duplicate detection
   */
  protected getUniqueKey(item: T): string {
    if (!this.constraints.unique) return '';
    
    const keyParts: string[] = [];
    for (const field of this.constraints.unique) {
      const value = (item as any)[field];
      keyParts.push(String(value || ''));
    }
    return keyParts.join('|');
  }

  /**
   * Generate random integer within range
   */
  protected randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random float within range
   */
  protected randomFloat(min: number, max: number, precision: number = 2): number {
    const value = this.random() * (max - min) + min;
    return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
  }

  /**
   * Pick random element from array
   */
  protected randomChoice<U>(array: U[]): U {
    return array[Math.floor(this.random() * array.length)];
  }

  /**
   * Generate random boolean with specified probability
   */
  protected randomBoolean(probability: number = 0.5): boolean {
    return this.random() < probability;
  }

  /**
   * Generate random date within range
   */
  protected randomDate(start: Date, end: Date): Date {
    const startTime = start.getTime();
    const endTime = end.getTime();
    const randomTime = startTime + this.random() * (endTime - startTime);
    return new Date(randomTime);
  }

  /**
   * Generate UUID-like identifier
   */
  protected generateId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Update progress and call callback
   */
  protected updateProgress(
    progress: GenerationProgress, 
    message: string, 
    callback?: (progress: GenerationProgress) => void
  ): void {
    if (callback) {
      callback({ ...progress });
    }
  }

  /**
   * Calculate estimated time of arrival
   */
  protected calculateETA(startTime: number, current: number, total: number): number {
    if (current === 0) return 0;
    
    const elapsed = Date.now() - startTime;
    const rate = current / elapsed; // items per ms
    const remaining = total - current;
    return remaining / rate;
  }

  /**
   * Get current memory usage
   */
  protected getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100; // MB with 2 decimal places
  }

  /**
   * Validate constraints on generated data
   */
  protected validateConstraints(data: T): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (this.constraints.required) {
      for (const field of this.constraints.required) {
        const value = (data as any)[field];
        if (value === null || value === undefined || value === '') {
          errors.push(`Required field '${field}' is missing or empty`);
        }
      }
    }

    // Check patterns
    if (this.constraints.patterns) {
      for (const [field, pattern] of Object.entries(this.constraints.patterns)) {
        const value = (data as any)[field];
        if (value && !pattern.test(String(value))) {
          errors.push(`Field '${field}' does not match required pattern`);
        }
      }
    }

    // Check ranges
    if (this.constraints.ranges) {
      for (const [field, range] of Object.entries(this.constraints.ranges)) {
        const value = (data as any)[field];
        if (typeof value === 'number') {
          if (range.min !== undefined && value < range.min) {
            errors.push(`Field '${field}' is below minimum value ${range.min}`);
          }
          if (range.max !== undefined && value > range.max) {
            errors.push(`Field '${field}' is above maximum value ${range.max}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Database integration utilities for bulk operations
 */
export class DatabaseBulkInserter<T> {
  constructor(
    private db: Database.Database,
    private tableName: string,
    private fieldMapping?: { [key: string]: string }
  ) {}

  /**
   * Insert data in bulk with transaction support and error handling
   */
  async insertBulk(
    data: T[], 
    options: {
      batchSize?: number;
      progressCallback?: (progress: GenerationProgress) => void;
      onConflict?: 'ignore' | 'replace' | 'fail';
    } = {}
  ): Promise<{
    inserted: number;
    errors: GenerationError[];
    executionTimeMs: number;
  }> {
    const startTime = Date.now();
    const errors: GenerationError[] = [];
    let inserted = 0;
    
    const batchSize = options.batchSize || 1000;
    const batches = Math.ceil(data.length / batchSize);

    // Prepare insert statement
    if (data.length === 0) {
      return { inserted: 0, errors: [], executionTimeMs: 0 };
    }

    const sampleItem = data[0] as any;
    const fields = Object.keys(sampleItem);
    const mappedFields = fields.map(f => this.fieldMapping?.[f] || f);
    
    const placeholders = fields.map(() => '?').join(', ');
    const fieldsList = mappedFields.join(', ');
    
    let conflictClause = '';
    switch (options.onConflict) {
      case 'ignore':
        conflictClause = ' OR IGNORE';
        break;
      case 'replace':
        conflictClause = ' OR REPLACE';
        break;
      case 'fail':
      default:
        conflictClause = '';
        break;
    }
    
    const sql = `INSERT${conflictClause} INTO ${this.tableName} (${fieldsList}) VALUES (${placeholders})`;
    const stmt = this.db.prepare(sql);

    // Process in batches with transactions
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, data.length);
      const batch = data.slice(batchStart, batchEnd);

      const transaction = this.db.transaction(() => {
        for (const item of batch) {
          try {
            const values = fields.map(f => (item as any)[f]);
            stmt.run(...values);
            inserted++;
          } catch (error: any) {
            errors.push({
              type: 'database',
              message: `Database insert failed: ${error.message}`,
              data: item,
              timestamp: new Date(),
              phase: 'insertion'
            });
          }
        }
      });

      try {
        transaction();
        
        // Update progress
        if (options.progressCallback) {
          const progress: GenerationProgress = {
            phase: 'insertion',
            current: batchEnd,
            total: data.length,
            percentage: (batchEnd / data.length) * 100,
            startTime,
            errorsCount: errors.length,
            successCount: inserted
          };
          options.progressCallback(progress);
        }
      } catch (error: any) {
        errors.push({
          type: 'database',
          message: `Transaction failed for batch ${batchIndex}: ${error.message}`,
          data: { batchIndex, batchStart, batchEnd },
          timestamp: new Date(),
          phase: 'transaction'
        });
      }
    }

    return {
      inserted,
      errors,
      executionTimeMs: Date.now() - startTime
    };
  }
}