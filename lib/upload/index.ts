/**
 * Bulk Upload System Entry Point
 * Main coordination system for bulk file uploads in the BRF Portal
 */

import Database from 'better-sqlite3';
import { BulkUploadQueue, WorkerManager } from './queue';
import { BatchManager } from './batch-manager';
import { RateLimiter } from './rate-limiter';
import { FileValidator } from './validator';
import { SwedishMessages } from './messages';

// Re-export all types and classes for easy importing
export * from './queue';
export * from './batch-manager';
export * from './rate-limiter';
export * from './validator';
export * from './messages';

// Export enhanced BRF validation system
export { 
  BRFFileValidator, 
  createBRFValidator,
  type BRFValidationRules,
  type BRFValidationResult,
  type BRFDocumentCategory 
} from './brf-file-validator';

// Export validation middleware
export { 
  validateSingleFile, 
  validateBatchFiles, 
  createValidationMiddleware,
  ValidationRuleBuilder,
  BRFValidators,
  type ValidationMiddlewareOptions,
  type ValidatedFile 
} from './validation-middleware';

// Export security scanning
export { 
  SecurityScanner,
  createSecurityScanner,
  createProductionScanner,
  createDevelopmentScanner,
  type SecurityScanResult,
  type SecurityConfig 
} from './security-scanner';

// Export chunked upload system
export { 
  ChunkedUploadManager,
  type ChunkedUploadConfig,
  type CreateSessionOptions,
  type UploadChunkOptions,
  type ChunkedUploadProgress,
  type ChunkedUploadSession,
  type ChunkedUploadChunk,
  type ChunkedUploadEvent
} from './chunked-upload-manager';

export {
  initializeChunkedUploadTables,
  createChunkedUploadRLSPolicies,
  createChunkedUploadCleanupFunction,
  CHUNKED_UPLOAD_TABLES,
  CHUNKED_UPLOAD_VIEWS
} from './chunked-upload-schema';

// Export client-side chunked upload
export {
  ChunkedUploadClient,
  type ChunkedUploadConfig as ChunkedUploadClientConfig,
  type ChunkedUploadProgress as ClientChunkedUploadProgress,
  type ChunkUploadResult,
  type UploadCompleteResult
} from './chunked-upload-client';

// Export chunked upload validation middleware
export {
  ChunkedValidationMiddleware,
  getChunkedValidationMiddleware,
  type ChunkedValidationConfig,
  type ValidationResult as ChunkedValidationResult
} from './chunked-validation-middleware';

// Export duplicate detection system
export {
  DuplicateDetector,
  type DetectionAlgorithm,
  type ConfidenceLevel,
  type ResolutionAction,
  type RecommendedAction,
  type FileReference,
  type DetectionResult,
  type BRFMetadataComparison,
  type DuplicateGroup,
  type DetectionRules,
  type DetectionSession
} from './duplicate-detector';

// Export duplicate detection middleware
export {
  DuplicateDetectionMiddleware,
  type DuplicateDetectionConfig,
  type DuplicateDetectionResult
} from './duplicate-detection-middleware';

export interface BulkUploadConfig {
  database: Database.Database;
  maxConcurrentUploads?: number;
  maxConcurrentProcessing?: number;
  defaultWorkerType?: 'default' | 'heavy' | 'fast' | 'specialized';
  enableRateLimiting?: boolean;
  enableVirusScanning?: boolean;
  enableAutoClassification?: boolean;
  enableDuplicateDetection?: boolean;
  storageBasePath?: string;
  tempStoragePath?: string;
  webhookTimeoutSeconds?: number;
}

export interface BulkUploadStats {
  total_batches: number;
  active_batches: number;
  completed_batches: number;
  failed_batches: number;
  total_files: number;
  processed_files: number;
  failed_files: number;
  active_workers: number;
  queue_depth: number;
}

export interface ProgressUpdate {
  batch_id: string;
  batch_number: number;
  status: string;
  progress_percentage: number;
  files_completed: number;
  files_total: number;
  estimated_completion_time?: string;
  current_file?: string;
  errors: string[];
  warnings: string[];
}

/**
 * Main Bulk Upload System Class
 * Coordinates all bulk upload operations
 */
export class BulkUploadSystem {
  private db: Database.Database;
  private queue: BulkUploadQueue;
  private workerManager: WorkerManager;
  private batchManager: BatchManager;
  private rateLimiter: RateLimiter;
  private validator: FileValidator;
  private config: Required<BulkUploadConfig>;
  private progressCallbacks: Map<string, (progress: ProgressUpdate) => void> = new Map();
  private isInitialized = false;

  constructor(config: BulkUploadConfig) {
    this.db = config.database;
    this.config = {
      ...config,
      maxConcurrentUploads: config.maxConcurrentUploads || 10,
      maxConcurrentProcessing: config.maxConcurrentProcessing || 5,
      defaultWorkerType: config.defaultWorkerType || 'default',
      enableRateLimiting: config.enableRateLimiting !== false,
      enableVirusScanning: config.enableVirusScanning !== false,
      enableAutoClassification: config.enableAutoClassification !== false,
      enableDuplicateDetection: config.enableDuplicateDetection !== false,
      storageBasePath: config.storageBasePath || '/uploads/bulk',
      tempStoragePath: config.tempStoragePath || '/tmp/uploads',
      webhookTimeoutSeconds: config.webhookTimeoutSeconds || 30,
    };

    this.initializeComponents();
  }

  /**
   * Initialize all system components
   */
  private initializeComponents(): void {
    this.queue = new BulkUploadQueue(this.db);
    this.workerManager = new WorkerManager(this.db);
    this.batchManager = new BatchManager(this.db, this.queue);
    this.rateLimiter = new RateLimiter(this.db);
    this.validator = new FileValidator();
    
    this.isInitialized = true;
    console.log('✅ Bulk Upload System initialized');
  }

  /**
   * Create a new upload batch
   */
  async createBatch(params: {
    cooperative_id: string;
    batch_name?: string;
    batch_description?: string;
    uploaded_by?: string;
    files: {
      filename: string;
      size: number;
      mimeType?: string;
      contentType?: string;
      tempPath?: string;
    }[];
    options?: {
      processing_mode?: 'parallel' | 'sequential';
      duplicate_handling?: 'skip' | 'overwrite' | 'rename' | 'fail';
      virus_scan_enabled?: boolean;
      auto_start?: boolean;
      priority?: number;
      webhook_url?: string;
    };
  }): Promise<{
    batch_id: string;
    batch_number: number;
    total_files: number;
    estimated_completion_time?: string;
    warnings: string[];
    errors: string[];
  }> {
    this.ensureInitialized();

    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate rate limits
    if (this.config.enableRateLimiting) {
      const rateCheck = await this.rateLimiter.checkRateLimit(params.cooperative_id, {
        operation: 'create_batch',
        count: 1,
      });

      if (!rateCheck.allowed) {
        throw new Error(SwedishMessages.errors.RATE_LIMIT_EXCEEDED);
      }
    }

    // Validate files
    const validationResults = await Promise.all(
      params.files.map(file => this.validator.validateFile(file))
    );

    // Collect validation issues
    for (const result of validationResults) {
      warnings.push(...result.warnings);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }

    // Stop if there are critical errors
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Create the batch
    const batchId = await this.batchManager.createBatch({
      cooperative_id: params.cooperative_id,
      batch_name: params.batch_name,
      batch_description: params.batch_description,
      uploaded_by: params.uploaded_by,
      upload_source: 'api',
      processing_mode: params.options?.processing_mode,
      duplicate_handling: params.options?.duplicate_handling,
      virus_scan_enabled: params.options?.virus_scan_enabled,
      webhook_url: params.options?.webhook_url,
    });

    // Add files to batch
    const fileIds = await this.batchManager.addFilesToBatch(
      batchId, 
      params.files.map(file => ({
        filename: file.filename,
        size: file.size,
        mimeType: file.mimeType,
        contentType: file.contentType,
        tempPath: file.tempPath,
      }))
    );

    // Get batch info
    const batch = this.batchManager.getBatchById(batchId);
    if (!batch) {
      throw new Error('Failed to create batch');
    }

    // Auto-start if requested
    if (params.options?.auto_start !== false) {
      await this.startBatch(batchId, params.options?.priority);
    }

    // Record rate limit usage
    if (this.config.enableRateLimiting) {
      await this.rateLimiter.recordUsage(params.cooperative_id, {
        operation: 'create_batch',
        count: 1,
      });
    }

    return {
      batch_id: batchId,
      batch_number: batch.batch_number,
      total_files: batch.total_files,
      estimated_completion_time: this.estimateCompletionTime(batch),
      warnings,
      errors,
    };
  }

  /**
   * Start processing a batch
   */
  async startBatch(batchId: string, priority: number = 5): Promise<boolean> {
    this.ensureInitialized();
    return await this.batchManager.startBatch(batchId, priority);
  }

  /**
   * Cancel a batch
   */
  async cancelBatch(batchId: string): Promise<boolean> {
    this.ensureInitialized();
    
    // Find queue item for this batch
    const queueItem = this.queue.getNextQueueItem(undefined, undefined);
    if (queueItem && queueItem.batch_id === batchId) {
      return await this.queue.cancelQueueItem(queueItem.id);
    }
    
    return false;
  }

  /**
   * Get batch status and progress
   */
  getBatchProgress(batchId: string): ProgressUpdate | null {
    this.ensureInitialized();
    
    const batch = this.batchManager.getBatchById(batchId);
    if (!batch) return null;

    const files = this.batchManager.getBatchFiles(batchId);
    const failedFiles = files.filter(f => f.upload_status === 'failed' || f.processing_status === 'failed');
    const currentFile = files.find(f => f.upload_status === 'uploading' || f.processing_status === 'processing');

    return {
      batch_id: batchId,
      batch_number: batch.batch_number,
      status: batch.status,
      progress_percentage: batch.progress_percentage,
      files_completed: batch.files_completed,
      files_total: batch.total_files,
      estimated_completion_time: this.estimateCompletionTime(batch),
      current_file: currentFile?.original_filename,
      errors: failedFiles.map(f => `${f.original_filename}: ${f.last_error_message || 'Unknown error'}`),
      warnings: files.filter(f => f.validation_status === 'warning').map(f => f.original_filename),
    };
  }

  /**
   * Subscribe to progress updates for a batch
   */
  subscribeToProgress(batchId: string, callback: (progress: ProgressUpdate) => void): void {
    this.progressCallbacks.set(batchId, callback);
  }

  /**
   * Unsubscribe from progress updates
   */
  unsubscribeFromProgress(batchId: string): void {
    this.progressCallbacks.delete(batchId);
  }

  /**
   * Get system statistics
   */
  getSystemStats(cooperative_id?: string): BulkUploadStats {
    this.ensureInitialized();
    
    const queueStats = this.queue.getQueueStats(cooperative_id);
    const workers = this.workerManager.getActiveWorkers();

    // Get batch statistics
    const batchStatsQuery = cooperative_id 
      ? 'WHERE cooperative_id = ? AND deleted_at IS NULL'
      : 'WHERE deleted_at IS NULL';
    
    const params = cooperative_id ? [cooperative_id] : [];
    
    const batchStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_batches,
        SUM(CASE WHEN status IN ('uploading', 'processing', 'validating') THEN 1 ELSE 0 END) as active_batches,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_batches,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_batches,
        SUM(total_files) as total_files,
        SUM(files_completed) as processed_files,
        SUM(files_failed) as failed_files
      FROM bulk_upload_batches ${batchStatsQuery}
    `).get(...params);

    return {
      total_batches: batchStats?.total_batches || 0,
      active_batches: batchStats?.active_batches || 0,
      completed_batches: batchStats?.completed_batches || 0,
      failed_batches: batchStats?.failed_batches || 0,
      total_files: batchStats?.total_files || 0,
      processed_files: batchStats?.processed_files || 0,
      failed_files: batchStats?.failed_files || 0,
      active_workers: workers.length,
      queue_depth: queueStats.queued + queueStats.running,
    };
  }

  /**
   * List batches for a cooperative
   */
  listBatches(
    cooperative_id: string, 
    options?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    this.ensureInitialized();
    
    return this.batchManager.getBatches(
      cooperative_id,
      options?.status,
      options?.limit || 50,
      options?.offset || 0
    );
  }

  /**
   * Get detailed batch information
   */
  getBatchDetails(batchId: string) {
    this.ensureInitialized();
    
    const batch = this.batchManager.getBatchById(batchId);
    if (!batch) return null;

    const files = this.batchManager.getBatchFiles(batchId);
    
    return {
      batch,
      files,
      progress: this.getBatchProgress(batchId),
    };
  }

  /**
   * Register a worker
   */
  registerWorker(config: {
    worker_name: string;
    worker_type?: 'default' | 'heavy' | 'fast' | 'specialized';
    capabilities?: {
      max_concurrent_batches?: number;
      max_concurrent_files?: number;
      supported_file_types?: string[];
      max_file_size_mb?: number;
    };
  }): string {
    this.ensureInitialized();
    
    return this.workerManager.registerWorker({
      worker_name: config.worker_name,
      worker_type: config.worker_type,
      hostname: process.env.HOSTNAME || 'localhost',
      process_id: process.pid,
      max_concurrent_batches: config.capabilities?.max_concurrent_batches,
      max_concurrent_files: config.capabilities?.max_concurrent_files,
      supported_file_types: config.capabilities?.supported_file_types,
      max_file_size_mb: config.capabilities?.max_file_size_mb,
    });
  }

  /**
   * Process the queue (call this periodically)
   */
  async processQueue(): Promise<void> {
    this.ensureInitialized();
    
    // Clean up offline workers
    const cleanedWorkers = this.workerManager.cleanupOfflineWorkers();
    if (cleanedWorkers > 0) {
      console.log(`Cleaned up ${cleanedWorkers} offline workers`);
    }

    // Get next queue item
    const queueItem = this.queue.getNextQueueItem(this.config.defaultWorkerType);
    if (!queueItem) return;

    // Find available worker
    const worker = this.workerManager.findBestWorker(queueItem);
    if (!worker) return;

    // Assign work
    const assigned = await this.queue.assignToWorker(queueItem.id, worker.id);
    if (assigned) {
      this.workerManager.markWorkerBusy(worker.id);
      console.log(`Assigned batch ${queueItem.batch_id} to worker ${worker.worker_name}`);
      
      // Start processing (this would typically be handled by the worker)
      await this.processQueueItem(queueItem, worker);
    }
  }

  /**
   * Process a single queue item (simplified version)
   */
  private async processQueueItem(queueItem: any, worker: any): Promise<void> {
    try {
      // Update progress
      this.queue.updateProgress(queueItem.id, { status: 'processing', started_at: new Date().toISOString() });
      
      // Get batch and files
      const batch = this.batchManager.getBatchById(queueItem.batch_id);
      if (!batch) {
        await this.queue.failQueueItem(queueItem.id, 'Batch not found');
        return;
      }

      const files = this.batchManager.getBatchFiles(queueItem.batch_id);
      
      // Process files (simplified)
      for (const file of files) {
        if (file.upload_status === 'pending') {
          // Simulate file processing
          await this.processFile(file);
        }
      }

      // Mark queue item as completed
      await this.queue.completeQueueItem(queueItem.id);
      this.workerManager.markWorkerIdle(worker.id);
      
      // Notify progress subscribers
      this.notifyProgressSubscribers(queueItem.batch_id);
      
    } catch (error) {
      await this.queue.failQueueItem(
        queueItem.id, 
        error instanceof Error ? error.message : 'Unknown error',
        { error: error instanceof Error ? error.stack : error }
      );
      this.workerManager.markWorkerIdle(worker.id);
    }
  }

  /**
   * Process a single file (simplified version)
   */
  private async processFile(file: any): Promise<void> {
    // This would contain the actual file processing logic
    // For now, just simulate the process
    
    // Update status to uploading
    this.batchManager.updateFileStatus(file.id, 'upload_status', 'uploading');
    
    // Simulate upload progress
    for (let progress = 0; progress <= 100; progress += 25) {
      this.batchManager.updateFileUploadProgress(file.id, progress);
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate time
    }
    
    // Mark as uploaded and processed
    await this.batchManager.completeFile(file.id);
  }

  /**
   * Notify progress subscribers
   */
  private notifyProgressSubscribers(batchId: string): void {
    const callback = this.progressCallbacks.get(batchId);
    if (callback) {
      const progress = this.getBatchProgress(batchId);
      if (progress) {
        callback(progress);
      }
    }
  }

  /**
   * Estimate completion time for a batch
   */
  private estimateCompletionTime(batch: any): string | undefined {
    if (batch.status === 'completed') return undefined;
    
    // Simple estimation based on average processing time
    const avgProcessingTimeMs = 5000; // 5 seconds per file
    const remainingFiles = batch.total_files - batch.files_completed;
    const estimatedMs = remainingFiles * avgProcessingTimeMs;
    
    return new Date(Date.now() + estimatedMs).toISOString();
  }

  /**
   * Ensure system is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('BulkUploadSystem not initialized');
    }
  }

  /**
   * Clean up and shut down the system
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Bulk Upload System...');
    
    // Clear all progress callbacks
    this.progressCallbacks.clear();
    
    // Mark all workers as offline
    const activeWorkers = this.workerManager.getActiveWorkers();
    for (const worker of activeWorkers) {
      this.workerManager.markWorkerIdle(worker.id);
    }
    
    this.isInitialized = false;
    console.log('✅ Bulk Upload System shut down complete');
  }
}

// Default export for convenience
export default BulkUploadSystem;