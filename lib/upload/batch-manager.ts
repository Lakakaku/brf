/**
 * Bulk Upload Batch Management System
 * Handles batch operations, file tracking, and progress reporting for the BRF Portal
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { logEvent } from '../monitoring/events';
import { BulkUploadQueue } from './queue';

export interface BatchFile {
  id: string;
  batch_id: string;
  cooperative_id: string;
  original_filename: string;
  sanitized_filename?: string;
  file_extension?: string;
  mime_type?: string;
  content_type?: string;
  file_size_bytes: number;
  file_hash_md5?: string;
  file_hash_sha256?: string;
  is_duplicate: boolean;
  duplicate_of_file_id?: string;
  processing_order?: number;
  priority: number;
  upload_status: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'cancelled' | 'skipped';
  upload_progress_percentage: number;
  processing_status: 'pending' | 'processing' | 'processed' | 'failed' | 'skipped';
  validation_status: 'pending' | 'valid' | 'invalid' | 'warning';
  validation_errors: string[];
  validation_warnings: string[];
  virus_scan_status: 'pending' | 'scanning' | 'clean' | 'infected' | 'failed' | 'skipped';
  temp_file_path?: string;
  final_file_path?: string;
  storage_backend: 'local' | 's3' | 'azure' | 'gcs';
  document_id?: string;
  error_count: number;
  retry_count: number;
  max_retries: number;
  requires_manual_review: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  created_at: string;
  updated_at: string;
}

export interface BatchInfo {
  id: string;
  cooperative_id: string;
  batch_name?: string;
  batch_description?: string;
  batch_number: number;
  status: 'pending' | 'validating' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'partially_completed';
  progress_percentage: number;
  total_files: number;
  files_uploaded: number;
  files_processed: number;
  files_completed: number;
  files_failed: number;
  files_skipped: number;
  total_size_bytes: number;
  uploaded_size_bytes: number;
  processed_size_bytes: number;
  uploaded_by?: string;
  upload_source: 'web' | 'api' | 'ftp' | 'email';
  processing_mode: 'parallel' | 'sequential';
  concurrent_uploads: number;
  max_files: number;
  max_total_size_mb: number;
  allowed_file_types: string[];
  duplicate_handling: 'skip' | 'overwrite' | 'rename' | 'fail';
  virus_scan_enabled: boolean;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BatchSettings {
  max_batch_size: number;
  max_file_size_mb: number;
  max_total_batch_size_gb: number;
  allowed_file_types: string[];
  default_processing_mode: 'parallel' | 'sequential';
  max_concurrent_uploads: number;
  max_concurrent_processing: number;
  enable_virus_scanning: boolean;
  enable_duplicate_detection: boolean;
  enable_ocr: boolean;
  enable_auto_classification: boolean;
  quality_threshold: number;
}

export class BatchManager {
  private db: Database.Database;
  private queue: BulkUploadQueue;

  constructor(database: Database.Database, queue: BulkUploadQueue) {
    this.db = database;
    this.queue = queue;
  }

  /**
   * Create a new batch
   */
  async createBatch(params: {
    cooperative_id: string;
    batch_name?: string;
    batch_description?: string;
    uploaded_by?: string;
    upload_source?: 'web' | 'api' | 'ftp' | 'email';
    processing_mode?: 'parallel' | 'sequential';
    max_files?: number;
    max_total_size_mb?: number;
    allowed_file_types?: string[];
    duplicate_handling?: 'skip' | 'overwrite' | 'rename' | 'fail';
    virus_scan_enabled?: boolean;
    concurrent_uploads?: number;
    webhook_url?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Get next batch number for this cooperative
    const batchNumber = this.getNextBatchNumber(params.cooperative_id);
    
    // Get default settings for the cooperative
    const settings = this.getBatchSettings(params.cooperative_id);

    const stmt = this.db.prepare(`
      INSERT INTO bulk_upload_batches (
        id, cooperative_id, batch_name, batch_description, batch_number,
        uploaded_by, upload_source, processing_mode, max_files, max_total_size_mb,
        allowed_file_types, duplicate_handling, virus_scan_enabled, 
        concurrent_uploads, webhook_url, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.cooperative_id,
      params.batch_name || `Bulk Upload ${batchNumber}`,
      params.batch_description || '',
      batchNumber,
      params.uploaded_by,
      params.upload_source || 'web',
      params.processing_mode || settings.default_processing_mode,
      params.max_files || settings.max_batch_size,
      params.max_total_size_mb || (settings.max_total_batch_size_gb * 1024),
      JSON.stringify(params.allowed_file_types || settings.allowed_file_types),
      params.duplicate_handling || 'skip',
      params.virus_scan_enabled !== undefined ? (params.virus_scan_enabled ? 1 : 0) : (settings.enable_virus_scanning ? 1 : 0),
      params.concurrent_uploads || settings.max_concurrent_uploads,
      params.webhook_url,
      JSON.stringify(params.metadata || {}),
      now,
      now
    );

    // Log batch creation
    await logEvent({
      cooperative_id: params.cooperative_id,
      event_type: 'batch_created',
      event_level: 'info',
      event_source: 'batch_manager',
      event_message: `Bulk upload batch ${batchNumber} created`,
      batch_id: id,
      user_id: params.uploaded_by,
      event_data: {
        batch_name: params.batch_name,
        max_files: params.max_files || settings.max_batch_size,
        processing_mode: params.processing_mode || settings.default_processing_mode,
      },
    });

    return id;
  }

  /**
   * Add files to a batch
   */
  async addFilesToBatch(batchId: string, files: {
    filename: string;
    size: number;
    mimeType?: string;
    contentType?: string;
    tempPath?: string;
    priority?: number;
  }[]): Promise<string[]> {
    const batch = this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.status !== 'pending') {
      throw new Error(`Cannot add files to batch in status: ${batch.status}`);
    }

    const fileIds: string[] = [];
    const now = new Date().toISOString();

    // Validate batch capacity
    if (batch.total_files + files.length > batch.max_files) {
      throw new Error(`Adding ${files.length} files would exceed batch limit of ${batch.max_files}`);
    }

    // Calculate total size
    const newTotalSize = files.reduce((sum, file) => sum + file.size, 0);
    if ((batch.total_size_bytes + newTotalSize) > (batch.max_total_size_mb * 1024 * 1024)) {
      throw new Error(`Adding files would exceed batch size limit of ${batch.max_total_size_mb}MB`);
    }

    const stmt = this.db.prepare(`
      INSERT INTO bulk_upload_files (
        id, cooperative_id, batch_id, original_filename, file_extension,
        mime_type, content_type, file_size_bytes, processing_order, priority,
        temp_file_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = uuidv4();
      const fileExtension = this.getFileExtension(file.filename);
      const processingOrder = batch.total_files + i + 1;

      // Validate file type
      if (!this.isAllowedFileType(fileExtension, batch.allowed_file_types)) {
        throw new Error(`File type .${fileExtension} is not allowed for this batch`);
      }

      stmt.run(
        fileId,
        batch.cooperative_id,
        batchId,
        file.filename,
        fileExtension,
        file.mimeType,
        file.contentType,
        file.size,
        processingOrder,
        file.priority || 5,
        file.tempPath,
        now,
        now
      );

      fileIds.push(fileId);
    }

    // Update batch totals
    this.updateBatchTotals(batchId);

    // Log file addition
    await logEvent({
      cooperative_id: batch.cooperative_id,
      event_type: 'files_added_to_batch',
      event_level: 'info',
      event_source: 'batch_manager',
      event_message: `${files.length} files added to batch ${batch.batch_number}`,
      batch_id: batchId,
      event_data: {
        file_count: files.length,
        total_size_mb: (newTotalSize / (1024 * 1024)).toFixed(2),
      },
    });

    return fileIds;
  }

  /**
   * Start batch processing
   */
  async startBatch(batchId: string, priority: number = 5): Promise<boolean> {
    const batch = this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.status !== 'pending') {
      throw new Error(`Cannot start batch in status: ${batch.status}`);
    }

    if (batch.total_files === 0) {
      throw new Error('Cannot start batch with no files');
    }

    // Update batch status
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_batches 
      SET status = 'validating', started_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(batchId);

    // Add batch to queue
    await this.queue.addToQueue({
      cooperative_id: batch.cooperative_id,
      batch_id: batchId,
      queue_type: 'upload',
      priority,
      worker_type: batch.processing_mode === 'parallel' ? 'default' : 'sequential',
      required_memory_mb: Math.max(512, Math.ceil(batch.total_size_bytes / (1024 * 1024) * 0.1)), // Estimate memory needs
      required_cpu_cores: batch.processing_mode === 'parallel' ? 2 : 1,
      required_disk_space_mb: Math.ceil(batch.total_size_bytes / (1024 * 1024) * 2), // Double for temp space
    });

    // Log batch start
    await logEvent({
      cooperative_id: batch.cooperative_id,
      event_type: 'batch_started',
      event_level: 'info',
      event_source: 'batch_manager',
      event_message: `Bulk upload batch ${batch.batch_number} started with ${batch.total_files} files`,
      batch_id: batchId,
      event_data: {
        total_files: batch.total_files,
        total_size_mb: (batch.total_size_bytes / (1024 * 1024)).toFixed(2),
        processing_mode: batch.processing_mode,
        priority,
      },
    });

    return true;
  }

  /**
   * Update file upload progress
   */
  updateFileUploadProgress(fileId: string, progressPercentage: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_files 
      SET upload_progress_percentage = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(progressPercentage, fileId);
    
    if (result.changes > 0 && progressPercentage === 100) {
      // Mark as uploaded when complete
      this.updateFileStatus(fileId, 'upload_status', 'uploaded');
    }
    
    return result.changes > 0;
  }

  /**
   * Update file status
   */
  updateFileStatus(
    fileId: string, 
    statusField: 'upload_status' | 'processing_status' | 'validation_status' | 'virus_scan_status',
    status: string
  ): boolean {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_files 
      SET ${statusField} = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(status, fileId);
    
    if (result.changes > 0) {
      // Update batch progress after status change
      const file = this.getFileById(fileId);
      if (file) {
        this.updateBatchProgress(file.batch_id);
      }
    }
    
    return result.changes > 0;
  }

  /**
   * Mark file as failed
   */
  async failFile(fileId: string, errorMessage: string, errorDetails?: Record<string, any>): Promise<boolean> {
    const file = this.getFileById(fileId);
    if (!file) return false;

    const stmt = this.db.prepare(`
      UPDATE bulk_upload_files 
      SET upload_status = 'failed', processing_status = 'failed',
          error_count = error_count + 1, last_error_message = ?,
          last_error_details = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(errorMessage, JSON.stringify(errorDetails || {}), fileId);
    
    if (result.changes > 0) {
      this.updateBatchProgress(file.batch_id);
      
      await logEvent({
        cooperative_id: file.cooperative_id,
        event_type: 'file_failed',
        event_level: 'error',
        event_source: 'batch_manager',
        event_message: `File ${file.original_filename} failed processing: ${errorMessage}`,
        batch_id: file.batch_id,
        file_id: fileId,
        error_message: errorMessage,
        event_data: { error_details: errorDetails },
      });
    }
    
    return result.changes > 0;
  }

  /**
   * Complete file processing
   */
  async completeFile(fileId: string, documentId?: string): Promise<boolean> {
    const file = this.getFileById(fileId);
    if (!file) return false;

    const stmt = this.db.prepare(`
      UPDATE bulk_upload_files 
      SET upload_status = 'uploaded', processing_status = 'processed',
          validation_status = 'valid', document_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(documentId || null, fileId);
    
    if (result.changes > 0) {
      this.updateBatchProgress(file.batch_id);
      
      await logEvent({
        cooperative_id: file.cooperative_id,
        event_type: 'file_processed',
        event_level: 'info',
        event_source: 'batch_manager',
        event_message: `File ${file.original_filename} processed successfully`,
        batch_id: file.batch_id,
        file_id: fileId,
        event_data: { document_id: documentId },
      });
    }
    
    return result.changes > 0;
  }

  /**
   * Check for duplicate files
   */
  async checkForDuplicates(batchId: string): Promise<void> {
    const files = this.getBatchFiles(batchId);
    const batch = this.getBatchById(batchId);
    if (!batch) return;

    for (const file of files) {
      if (!file.file_hash_md5) {
        // Generate hash if not present
        if (file.temp_file_path) {
          const hash = await this.generateFileHash(file.temp_file_path);
          this.updateFileHash(file.id, hash);
          file.file_hash_md5 = hash;
        }
      }

      if (file.file_hash_md5) {
        // Check for duplicates in the same batch
        const duplicates = this.findDuplicateFiles(batchId, file.file_hash_md5, file.id);
        
        if (duplicates.length > 0) {
          this.markAsDuplicate(file.id, duplicates[0].id);
          
          await logEvent({
            cooperative_id: batch.cooperative_id,
            event_type: 'duplicate_file_detected',
            event_level: 'warning',
            event_source: 'batch_manager',
            event_message: `Duplicate file detected: ${file.original_filename}`,
            batch_id: batchId,
            file_id: file.id,
            event_data: { duplicate_of: duplicates[0].id },
          });
        }
      }
    }
  }

  /**
   * Get batch by ID
   */
  getBatchById(batchId: string): BatchInfo | null {
    const stmt = this.db.prepare('SELECT * FROM bulk_upload_batches WHERE id = ?');
    const result = stmt.get(batchId);
    
    if (result) {
      return {
        ...result,
        allowed_file_types: JSON.parse(result.allowed_file_types || '[]'),
        virus_scan_enabled: result.virus_scan_enabled === 1,
      };
    }
    
    return null;
  }

  /**
   * Get batch files
   */
  getBatchFiles(batchId: string): BatchFile[] {
    const stmt = this.db.prepare(`
      SELECT * FROM bulk_upload_files 
      WHERE batch_id = ? 
      ORDER BY processing_order ASC
    `);
    
    const results = stmt.all(batchId);
    
    return results.map(row => ({
      ...row,
      is_duplicate: row.is_duplicate === 1,
      requires_manual_review: row.requires_manual_review === 1,
      validation_errors: JSON.parse(row.validation_errors || '[]'),
      validation_warnings: JSON.parse(row.validation_warnings || '[]'),
    }));
  }

  /**
   * Get batches for a cooperative
   */
  getBatches(
    cooperative_id: string, 
    status?: string, 
    limit: number = 50, 
    offset: number = 0
  ): BatchInfo[] {
    let whereClause = 'WHERE cooperative_id = ? AND deleted_at IS NULL';
    const params: any[] = [cooperative_id];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM bulk_upload_batches 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    params.push(limit, offset);
    const results = stmt.all(...params);
    
    return results.map(row => ({
      ...row,
      allowed_file_types: JSON.parse(row.allowed_file_types || '[]'),
      virus_scan_enabled: row.virus_scan_enabled === 1,
    }));
  }

  /**
   * Private helper methods
   */
  private getNextBatchNumber(cooperativeId: string): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(MAX(batch_number), 0) + 1 as next_number
      FROM bulk_upload_batches 
      WHERE cooperative_id = ?
    `);

    const result = stmt.get(cooperativeId);
    return result?.next_number || 1;
  }

  private getBatchSettings(cooperativeId: string): BatchSettings {
    const stmt = this.db.prepare('SELECT * FROM bulk_upload_settings WHERE cooperative_id = ?');
    const result = stmt.get(cooperativeId);
    
    if (result) {
      return {
        max_batch_size: result.max_batch_size,
        max_file_size_mb: result.max_file_size_mb,
        max_total_batch_size_gb: result.max_total_batch_size_gb,
        allowed_file_types: JSON.parse(result.allowed_file_types || '[]'),
        default_processing_mode: result.default_processing_mode,
        max_concurrent_uploads: result.max_concurrent_uploads,
        max_concurrent_processing: result.max_concurrent_processing,
        enable_virus_scanning: result.enable_virus_scanning === 1,
        enable_duplicate_detection: result.enable_duplicate_detection === 1,
        enable_ocr: result.enable_ocr === 1,
        enable_auto_classification: result.enable_auto_classification === 1,
        quality_threshold: result.quality_threshold,
      };
    }
    
    // Return defaults if no settings found
    return {
      max_batch_size: 500,
      max_file_size_mb: 100,
      max_total_batch_size_gb: 5.0,
      allowed_file_types: ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'png', 'txt', 'csv'],
      default_processing_mode: 'parallel',
      max_concurrent_uploads: 10,
      max_concurrent_processing: 5,
      enable_virus_scanning: true,
      enable_duplicate_detection: true,
      enable_ocr: true,
      enable_auto_classification: true,
      quality_threshold: 75.0,
    };
  }

  private updateBatchTotals(batchId: string): void {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_batches 
      SET 
        total_files = (SELECT COUNT(*) FROM bulk_upload_files WHERE batch_id = ?),
        total_size_bytes = (SELECT COALESCE(SUM(file_size_bytes), 0) FROM bulk_upload_files WHERE batch_id = ?),
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(batchId, batchId, batchId);
  }

  private updateBatchProgress(batchId: string): void {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_batches 
      SET 
        files_uploaded = (SELECT COUNT(*) FROM bulk_upload_files WHERE batch_id = ? AND upload_status = 'uploaded'),
        files_processed = (SELECT COUNT(*) FROM bulk_upload_files WHERE batch_id = ? AND processing_status = 'processed'),
        files_completed = (SELECT COUNT(*) FROM bulk_upload_files WHERE batch_id = ? AND upload_status = 'uploaded' AND processing_status = 'processed'),
        files_failed = (SELECT COUNT(*) FROM bulk_upload_files WHERE batch_id = ? AND (upload_status = 'failed' OR processing_status = 'failed')),
        files_skipped = (SELECT COUNT(*) FROM bulk_upload_files WHERE batch_id = ? AND (upload_status = 'skipped' OR processing_status = 'skipped')),
        uploaded_size_bytes = (SELECT COALESCE(SUM(file_size_bytes), 0) FROM bulk_upload_files WHERE batch_id = ? AND upload_status = 'uploaded'),
        processed_size_bytes = (SELECT COALESCE(SUM(file_size_bytes), 0) FROM bulk_upload_files WHERE batch_id = ? AND processing_status = 'processed'),
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(batchId, batchId, batchId, batchId, batchId, batchId, batchId, batchId);

    // Calculate and update progress percentage
    this.calculateBatchProgress(batchId);
  }

  private calculateBatchProgress(batchId: string): void {
    const batch = this.getBatchById(batchId);
    if (!batch || batch.total_files === 0) return;

    const completionWeight = {
      uploaded: 0.5,    // 50% for upload complete
      processed: 0.5,   // 50% for processing complete
    };

    const uploadProgress = (batch.files_uploaded / batch.total_files) * completionWeight.uploaded;
    const processProgress = (batch.files_processed / batch.total_files) * completionWeight.processed;
    const totalProgress = Math.min(100, (uploadProgress + processProgress) * 100);

    const stmt = this.db.prepare(`
      UPDATE bulk_upload_batches 
      SET progress_percentage = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(totalProgress, batchId);

    // Update batch status based on progress
    this.updateBatchStatus(batchId, batch);
  }

  private updateBatchStatus(batchId: string, batch: BatchInfo): void {
    let newStatus = batch.status;

    if (batch.files_completed === batch.total_files) {
      newStatus = 'completed';
    } else if (batch.files_failed > 0 && (batch.files_completed + batch.files_failed) === batch.total_files) {
      newStatus = 'partially_completed';
    } else if (batch.files_failed === batch.total_files) {
      newStatus = 'failed';
    } else if (batch.files_uploaded > 0 || batch.files_processed > 0) {
      newStatus = 'processing';
    } else if (batch.status === 'validating' && batch.files_uploaded === 0) {
      newStatus = 'uploading';
    }

    if (newStatus !== batch.status) {
      const stmt = this.db.prepare(`
        UPDATE bulk_upload_batches 
        SET status = ?, completed_at = CASE WHEN ? IN ('completed', 'partially_completed', 'failed') THEN datetime('now') ELSE completed_at END,
            updated_at = datetime('now')
        WHERE id = ?
      `);

      stmt.run(newStatus, newStatus, batchId);
    }
  }

  private getFileExtension(filename: string): string {
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private isAllowedFileType(extension: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(extension.toLowerCase());
  }

  private getFileById(fileId: string): BatchFile | null {
    const stmt = this.db.prepare('SELECT * FROM bulk_upload_files WHERE id = ?');
    const result = stmt.get(fileId);
    
    if (result) {
      return {
        ...result,
        is_duplicate: result.is_duplicate === 1,
        requires_manual_review: result.requires_manual_review === 1,
        validation_errors: JSON.parse(result.validation_errors || '[]'),
        validation_warnings: JSON.parse(result.validation_warnings || '[]'),
      };
    }
    
    return null;
  }

  private async generateFileHash(filePath: string): Promise<string> {
    // This is a placeholder - in real implementation, you'd read the file and hash it
    const hash = createHash('md5');
    hash.update(filePath + Date.now().toString());
    return hash.digest('hex');
  }

  private updateFileHash(fileId: string, hash: string): void {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_files 
      SET file_hash_md5 = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(hash, fileId);
  }

  private findDuplicateFiles(batchId: string, hash: string, excludeFileId: string): BatchFile[] {
    const stmt = this.db.prepare(`
      SELECT * FROM bulk_upload_files 
      WHERE batch_id = ? AND file_hash_md5 = ? AND id != ?
      ORDER BY created_at ASC
    `);

    const results = stmt.all(batchId, hash, excludeFileId);
    
    return results.map(row => ({
      ...row,
      is_duplicate: row.is_duplicate === 1,
      requires_manual_review: row.requires_manual_review === 1,
      validation_errors: JSON.parse(row.validation_errors || '[]'),
      validation_warnings: JSON.parse(row.validation_warnings || '[]'),
    }));
  }

  private markAsDuplicate(fileId: string, duplicateOfFileId: string): void {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_files 
      SET is_duplicate = 1, duplicate_of_file_id = ?, upload_status = 'skipped',
          processing_status = 'skipped', updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(duplicateOfFileId, fileId);
  }
}