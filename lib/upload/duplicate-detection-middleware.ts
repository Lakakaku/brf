/**
 * Duplicate Detection Middleware
 * Automatically detects duplicates during file uploads
 */

import Database from 'better-sqlite3';
import { DuplicateDetector, DetectionResult } from './duplicate-detector';
import { BatchManager, BatchFile } from './batch-manager';
import { logEvent } from '../monitoring/events';
import { SwedishMessages } from './messages';

export interface DuplicateDetectionConfig {
  enabled: boolean;
  auto_resolve_exact_matches: boolean;
  auto_resolve_high_confidence: boolean;
  algorithms: ('md5' | 'sha256' | 'perceptual' | 'content' | 'metadata' | 'fuzzy')[];
  similarity_thresholds: {
    md5: number;
    sha256: number;
    perceptual: number;
    content: number;
    metadata: number;
    fuzzy: number;
  };
  skip_document_types?: string[];
  max_file_size_mb?: number;
  notify_on_duplicates: boolean;
}

export interface DuplicateDetectionResult {
  duplicates_found: DetectionResult[];
  files_skipped: string[];
  auto_resolved: DetectionResult[];
  manual_review_required: DetectionResult[];
  processing_time_ms: number;
  total_storage_savings_bytes: number;
}

export class DuplicateDetectionMiddleware {
  private db: Database.Database;
  private duplicateDetector: DuplicateDetector;
  private batchManager: BatchManager;

  constructor(
    database: Database.Database,
    batchManager: BatchManager
  ) {
    this.db = database;
    this.duplicateDetector = new DuplicateDetector(database);
    this.batchManager = batchManager;
  }

  /**
   * Process duplicate detection for a batch during upload
   */
  async processBatchDuplicateDetection(
    batchId: string,
    cooperativeId: string,
    config?: DuplicateDetectionConfig
  ): Promise<DuplicateDetectionResult> {
    const startTime = Date.now();
    
    // Get default config if not provided
    const detectionConfig = config || await this.getDefaultConfig(cooperativeId);
    
    if (!detectionConfig.enabled) {
      return {
        duplicates_found: [],
        files_skipped: [],
        auto_resolved: [],
        manual_review_required: [],
        processing_time_ms: 0,
        total_storage_savings_bytes: 0,
      };
    }

    try {
      // Start detection session for this batch
      const session = await this.duplicateDetector.startDetectionSession({
        cooperative_id: cooperativeId,
        batch_id: batchId,
        session_type: 'batch',
        algorithms: detectionConfig.algorithms,
      });

      // Run duplicate detection
      const duplicates = await this.duplicateDetector.detectDuplicates(session.id);

      // Process results
      const result = await this.processDuplicateResults(
        duplicates,
        detectionConfig,
        cooperativeId,
        batchId
      );

      const processingTime = Date.now() - startTime;
      result.processing_time_ms = processingTime;

      await logEvent({
        cooperative_id: cooperativeId,
        event_type: 'batch_duplicate_detection_completed',
        event_level: 'info',
        event_source: 'duplicate_detection_middleware',
        event_message: `Batch duplicate detection completed: ${duplicates.length} duplicates found`,
        batch_id: batchId,
        event_data: {
          session_id: session.id,
          duplicates_found: duplicates.length,
          auto_resolved: result.auto_resolved.length,
          manual_review_required: result.manual_review_required.length,
          processing_time_ms: processingTime,
        },
      });

      return result;

    } catch (error) {
      await logEvent({
        cooperative_id: cooperativeId,
        event_type: 'batch_duplicate_detection_failed',
        event_level: 'error',
        event_source: 'duplicate_detection_middleware',
        event_message: `Batch duplicate detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        batch_id: batchId,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Process individual file duplicate detection during upload
   */
  async processFileDuplicateDetection(
    fileId: string,
    cooperativeId: string,
    config?: DuplicateDetectionConfig
  ): Promise<{
    is_duplicate: boolean;
    duplicate_of?: string;
    similarity_score?: number;
    algorithm?: string;
    auto_resolved?: boolean;
    action_taken?: string;
  }> {
    const detectionConfig = config || await this.getDefaultConfig(cooperativeId);
    
    if (!detectionConfig.enabled) {
      return { is_duplicate: false };
    }

    try {
      // Create a single-file session
      const session = await this.duplicateDetector.startDetectionSession({
        cooperative_id: cooperativeId,
        session_type: 'realtime',
        file_ids: [fileId],
        algorithms: ['md5', 'sha256'], // Quick algorithms for real-time detection
      });

      const duplicates = await this.duplicateDetector.detectDuplicates(session.id);
      
      if (duplicates.length === 0) {
        return { is_duplicate: false };
      }

      // Get the highest confidence duplicate
      const bestMatch = duplicates.reduce((best, current) => 
        current.similarity_score > best.similarity_score ? current : best
      );

      // Auto-resolve if configured and conditions are met
      if (this.shouldAutoResolve(bestMatch, detectionConfig)) {
        const action = this.determineAutoResolutionAction(bestMatch, detectionConfig);
        
        await this.duplicateDetector.resolveDuplicate(
          bestMatch.duplicate_id,
          action,
          'system', // System user for auto-resolution
          'Auto-resolved based on detection rules'
        );

        return {
          is_duplicate: true,
          duplicate_of: bestMatch.original_file.id,
          similarity_score: bestMatch.similarity_score,
          algorithm: bestMatch.algorithm,
          auto_resolved: true,
          action_taken: action,
        };
      }

      return {
        is_duplicate: true,
        duplicate_of: bestMatch.original_file.id,
        similarity_score: bestMatch.similarity_score,
        algorithm: bestMatch.algorithm,
        auto_resolved: false,
      };

    } catch (error) {
      console.error(`File duplicate detection failed for file ${fileId}:`, error);
      
      await logEvent({
        cooperative_id: cooperativeId,
        event_type: 'file_duplicate_detection_failed',
        event_level: 'error',
        event_source: 'duplicate_detection_middleware',
        event_message: `File duplicate detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        file_id: fileId,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      return { is_duplicate: false };
    }
  }

  /**
   * Hook to be called during batch file processing
   */
  async onBatchFileProcessed(
    file: BatchFile,
    cooperativeId: string
  ): Promise<void> {
    // Skip duplicate detection for certain file types or if disabled
    const config = await this.getDefaultConfig(cooperativeId);
    if (!config.enabled || this.shouldSkipFile(file, config)) {
      return;
    }

    try {
      const duplicateResult = await this.processFileDuplicateDetection(
        file.id,
        cooperativeId,
        config
      );

      if (duplicateResult.is_duplicate) {
        // Update the file with duplicate information
        await this.updateFileWithDuplicateInfo(file.id, duplicateResult);

        // Handle based on auto-resolution
        if (duplicateResult.auto_resolved) {
          this.batchManager.updateFileStatus(file.id, 'processing_status', 'skipped');
          
          await logEvent({
            cooperative_id: cooperativeId,
            event_type: 'file_auto_resolved_duplicate',
            event_level: 'info',
            event_source: 'duplicate_detection_middleware',
            event_message: `File automatically resolved as duplicate: ${file.original_filename}`,
            file_id: file.id,
            event_data: {
              duplicate_of: duplicateResult.duplicate_of,
              similarity_score: duplicateResult.similarity_score,
              action_taken: duplicateResult.action_taken,
            },
          });
        } else {
          // Mark for manual review
          this.markFileForManualReview(file.id, 'Potential duplicate detected');
          
          await logEvent({
            cooperative_id: cooperativeId,
            event_type: 'file_duplicate_manual_review',
            event_level: 'warning',
            event_source: 'duplicate_detection_middleware',
            event_message: `File marked for manual review - potential duplicate: ${file.original_filename}`,
            file_id: file.id,
            event_data: {
              duplicate_of: duplicateResult.duplicate_of,
              similarity_score: duplicateResult.similarity_score,
            },
          });
        }
      }

    } catch (error) {
      console.error(`Error processing duplicate detection for file ${file.id}:`, error);
    }
  }

  /**
   * Create default duplicate detection rules for a cooperative
   */
  async createDefaultDetectionRules(cooperativeId: string): Promise<void> {
    // BRF Invoice duplicate rules
    await this.duplicateDetector.saveDetectionRules({
      cooperative_id: cooperativeId,
      rule_name: 'BRF Invoice Duplicates',
      is_active: true,
      priority: 90,
      algorithms: ['md5', 'sha256', 'content'],
      similarity_threshold: 0.95,
      confidence_threshold: 'high',
      file_types: ['pdf', 'jpg', 'jpeg', 'png'],
      document_types: ['invoice'],
      min_file_size_bytes: 1024, // 1KB
      max_file_size_bytes: 50 * 1024 * 1024, // 50MB
      brf_specific_checks: {
        check_invoice_numbers: true,
        check_meeting_dates: false,
        check_contractor_names: true,
        check_apartment_references: true,
      },
      auto_resolve: true,
      auto_resolution_action: 'keep_original',
    });

    // BRF Meeting Protocol duplicates
    await this.duplicateDetector.saveDetectionRules({
      cooperative_id: cooperativeId,
      rule_name: 'BRF Meeting Protocol Duplicates',
      is_active: true,
      priority: 85,
      algorithms: ['md5', 'sha256', 'content'],
      similarity_threshold: 0.98,
      confidence_threshold: 'high',
      file_types: ['pdf', 'docx', 'doc'],
      document_types: ['protocol'],
      min_file_size_bytes: 5120, // 5KB
      max_file_size_bytes: 100 * 1024 * 1024, // 100MB
      brf_specific_checks: {
        check_invoice_numbers: false,
        check_meeting_dates: true,
        check_contractor_names: false,
        check_apartment_references: false,
      },
      auto_resolve: false, // Manual review for protocols
      auto_resolution_action: 'keep_original',
    });

    // General document duplicates
    await this.duplicateDetector.saveDetectionRules({
      cooperative_id: cooperativeId,
      rule_name: 'General Document Duplicates',
      is_active: true,
      priority: 50,
      algorithms: ['md5', 'sha256'],
      similarity_threshold: 1.0, // Exact matches only
      confidence_threshold: 'high',
      file_types: [], // All file types
      document_types: [],
      min_file_size_bytes: 0,
      max_file_size_bytes: 0,
      brf_specific_checks: {
        check_invoice_numbers: false,
        check_meeting_dates: false,
        check_contractor_names: false,
        check_apartment_references: false,
      },
      auto_resolve: true,
      auto_resolution_action: 'keep_original',
    });

    await logEvent({
      cooperative_id: cooperativeId,
      event_type: 'default_duplicate_rules_created',
      event_level: 'info',
      event_source: 'duplicate_detection_middleware',
      event_message: 'Default duplicate detection rules created for cooperative',
    });
  }

  /**
   * Process duplicate detection results
   */
  private async processDuplicateResults(
    duplicates: DetectionResult[],
    config: DuplicateDetectionConfig,
    cooperativeId: string,
    batchId: string
  ): Promise<DuplicateDetectionResult> {
    const autoResolved: DetectionResult[] = [];
    const manualReviewRequired: DetectionResult[] = [];
    let totalStorageSavings = 0;

    for (const duplicate of duplicates) {
      if (this.shouldAutoResolve(duplicate, config)) {
        const action = this.determineAutoResolutionAction(duplicate, config);
        
        try {
          await this.duplicateDetector.resolveDuplicate(
            duplicate.duplicate_id,
            action,
            'system',
            'Auto-resolved during batch processing'
          );

          autoResolved.push(duplicate);
          
          // Calculate storage savings
          if (action.includes('delete')) {
            totalStorageSavings += action === 'delete_original' 
              ? duplicate.original_file.size_bytes
              : duplicate.duplicate_file.size_bytes;
          }

        } catch (error) {
          console.error(`Failed to auto-resolve duplicate ${duplicate.duplicate_id}:`, error);
          manualReviewRequired.push(duplicate);
        }
      } else {
        manualReviewRequired.push(duplicate);
      }
    }

    return {
      duplicates_found: duplicates,
      files_skipped: [], // Will be populated by file processing
      auto_resolved: autoResolved,
      manual_review_required: manualReviewRequired,
      processing_time_ms: 0, // Will be set by caller
      total_storage_savings_bytes: totalStorageSavings,
    };
  }

  /**
   * Get default duplicate detection config for a cooperative
   */
  private async getDefaultConfig(cooperativeId: string): Promise<DuplicateDetectionConfig> {
    // Check if cooperative has custom settings
    const stmt = this.db.prepare(`
      SELECT * FROM bulk_upload_settings 
      WHERE cooperative_id = ?
    `);
    
    const settings = stmt.get(cooperativeId);
    
    return {
      enabled: settings?.enable_duplicate_detection !== 0,
      auto_resolve_exact_matches: true,
      auto_resolve_high_confidence: false,
      algorithms: ['md5', 'sha256', 'content'],
      similarity_thresholds: {
        md5: 1.0,
        sha256: 1.0,
        perceptual: 0.95,
        content: 0.90,
        metadata: 0.85,
        fuzzy: 0.80,
      },
      skip_document_types: [], // No document types skipped by default
      max_file_size_mb: 500,
      notify_on_duplicates: true,
    };
  }

  /**
   * Determine if a duplicate should be auto-resolved
   */
  private shouldAutoResolve(
    duplicate: DetectionResult,
    config: DuplicateDetectionConfig
  ): boolean {
    // Exact hash matches can be auto-resolved
    if ((duplicate.algorithm === 'md5' || duplicate.algorithm === 'sha256') && 
        duplicate.similarity_score === 1.0 && 
        config.auto_resolve_exact_matches) {
      return true;
    }

    // High confidence duplicates if configured
    if (duplicate.confidence_level === 'high' && 
        duplicate.similarity_score >= 0.95 && 
        config.auto_resolve_high_confidence) {
      return true;
    }

    return false;
  }

  /**
   * Determine the auto-resolution action
   */
  private determineAutoResolutionAction(
    duplicate: DetectionResult,
    config: DuplicateDetectionConfig
  ): 'keep_original' | 'keep_duplicate' | 'keep_both' | 'merge' | 'delete_original' | 'delete_duplicate' {
    // For exact matches, prefer the original (usually uploaded first)
    if (duplicate.similarity_score === 1.0) {
      return 'keep_original';
    }

    // For high similarity content matches, prefer newer/larger files
    const originalSize = duplicate.original_file.size_bytes;
    const duplicateSize = duplicate.duplicate_file.size_bytes;
    
    if (duplicateSize > originalSize * 1.1) { // 10% larger
      return 'keep_duplicate';
    }

    return 'keep_original';
  }

  /**
   * Check if file should be skipped for duplicate detection
   */
  private shouldSkipFile(file: BatchFile, config: DuplicateDetectionConfig): boolean {
    // Skip if file type is in skip list
    if (config.skip_document_types?.includes(file.document_type || '')) {
      return true;
    }

    // Skip if file is too large
    if (config.max_file_size_mb && 
        file.file_size_bytes > config.max_file_size_mb * 1024 * 1024) {
      return true;
    }

    // Skip temporary or system files
    if (file.original_filename.startsWith('.') || 
        file.original_filename.toLowerCase().includes('temp')) {
      return true;
    }

    return false;
  }

  /**
   * Update file with duplicate information
   */
  private async updateFileWithDuplicateInfo(
    fileId: string,
    duplicateResult: any
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_files 
      SET is_duplicate = 1, 
          duplicate_of_file_id = ?,
          validation_warnings = json_set(
            COALESCE(validation_warnings, '[]'),
            '$[#]',
            ?
          ),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    const warningMessage = duplicateResult.auto_resolved
      ? `Automatiskt löst duplikat (likhet: ${Math.round(duplicateResult.similarity_score * 100)}%)`
      : `Möjligt duplikat upptäckt (likhet: ${Math.round(duplicateResult.similarity_score * 100)}%)`;

    stmt.run(duplicateResult.duplicate_of, warningMessage, fileId);
  }

  /**
   * Mark file for manual review
   */
  private markFileForManualReview(fileId: string, reason: string): void {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_files 
      SET requires_manual_review = 1,
          approval_status = 'needs_revision',
          validation_warnings = json_set(
            COALESCE(validation_warnings, '[]'),
            '$[#]',
            ?
          ),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(reason, fileId);
  }
}

export default DuplicateDetectionMiddleware;