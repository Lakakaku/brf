/**
 * Scanner Upload Integration for BRF Portal
 * Connects scanned files with the existing bulk upload system
 */

import { ScanFile, ScanJob } from './types';
import { BulkUploadSystem } from '@/lib/upload';
import { getDatabase } from '@/lib/database';
import { validateBatchFiles } from '@/lib/upload/validation-middleware';

export interface ScanToUploadOptions {
  cooperativeId: string;
  userId: string;
  scanJobId: string;
  createNewBatch?: boolean;
  existingBatchId?: string;
  uploadSettings?: {
    duplicate_handling?: 'skip' | 'overwrite' | 'rename' | 'fail';
    auto_start?: boolean;
    priority?: number;
    webhook_url?: string;
  };
}

export interface ScanUploadResult {
  success: boolean;
  batch_id?: string;
  batch_number?: string;
  uploaded_files: ScanUploadFileResult[];
  failed_files: ScanUploadFileResult[];
  warnings: string[];
  error?: string;
}

export interface ScanUploadFileResult {
  scan_file_id: string;
  filename: string;
  status: 'uploaded' | 'failed' | 'skipped';
  upload_file_id?: string;
  error_message?: string;
  validation_result?: {
    category: string;
    confidence: number;
    requires_manual_review: boolean;
  };
}

export class ScannerUploadIntegration {
  private bulkUploadSystem: BulkUploadSystem;

  constructor() {
    const db = getDatabase();
    this.bulkUploadSystem = new BulkUploadSystem({ database: db });
  }

  /**
   * Upload scanned files to the bulk upload system
   */
  async uploadScanFiles(
    scanJob: ScanJob,
    options: ScanToUploadOptions
  ): Promise<ScanUploadResult> {
    try {
      // Prepare files for upload validation
      const filesToUpload = scanJob.files_created.map(scanFile => ({
        filename: scanFile.filename,
        size: scanFile.file_size,
        mimeType: scanFile.mime_type,
        contentType: scanFile.mime_type,
        tempPath: scanFile.file_path,
        // Include scanner metadata
        scanner_metadata: {
          scan_job_id: scanJob.id,
          scanner_id: scanJob.scanner_id,
          scan_file_id: scanFile.id,
          resolution: scanFile.resolution,
          color_mode: scanFile.color_mode,
          page_count: scanFile.page_count,
          ocr_available: !!scanFile.ocr_text,
          ocr_confidence: scanFile.ocr_confidence,
          document_category: scanFile.document_category,
          category_confidence: scanFile.category_confidence,
        },
      }));

      // Validate files using existing validation system
      const validationResult = await validateBatchFiles(filesToUpload, {
        cooperativeId: options.cooperativeId,
        userId: options.userId,
        logValidation: true,
        // Enhanced validation for scanned documents
        scannerEnhanced: true,
        scanJobId: options.scanJobId,
      });

      if (!validationResult.success || !validationResult.data) {
        return {
          success: false,
          uploaded_files: [],
          failed_files: scanJob.files_created.map(file => ({
            scan_file_id: file.id,
            filename: file.filename,
            status: 'failed' as const,
            error_message: 'Filvalidering misslyckades',
          })),
          warnings: [],
          error: validationResult.error || 'Filvalidering misslyckades',
        };
      }

      const { validFiles, invalidFiles, summary } = validationResult.data;

      // Create or use existing batch
      let batchId = options.existingBatchId;
      let batchNumber: string | undefined;

      if (options.createNewBatch || !batchId) {
        // Create new batch with scanner context
        const batchName = `Scanner Upload - ${new Date().toLocaleDateString('sv-SE')}`;
        const batchDescription = `Automatisk uppladdning från skanner: ${scanJob.scanner_id}\nSkanningsjobb: ${scanJob.id}\nAntal sidor: ${scanJob.pages_scanned}`;

        const batchResult = await this.bulkUploadSystem.createBatch({
          cooperative_id: options.cooperativeId,
          batch_name: batchName,
          batch_description: batchDescription,
          uploaded_by: options.userId,
          files: validFiles,
          options: {
            processing_mode: 'parallel',
            duplicate_handling: options.uploadSettings?.duplicate_handling || 'rename',
            auto_start: options.uploadSettings?.auto_start ?? true,
            priority: options.uploadSettings?.priority || 5,
            webhook_url: options.uploadSettings?.webhook_url,
          },
          validation_summary: summary,
          // Scanner-specific metadata
          source_type: 'scanner',
          source_metadata: {
            scan_job_id: scanJob.id,
            scanner_id: scanJob.scanner_id,
            scan_settings: scanJob.settings,
          },
        });

        batchId = batchResult.batch_id;
        batchNumber = batchResult.batch_number;
      } else {
        // Add files to existing batch
        // Note: This would require extending the BulkUploadSystem to support adding files to existing batches
        // For now, we'll create a new batch
        throw new Error('Adding files to existing batch not yet implemented');
      }

      // Map results back to scan files
      const uploadedFiles: ScanUploadFileResult[] = validFiles.map(validFile => {
        const originalScanFile = scanJob.files_created.find(sf => sf.filename === validFile.filename);
        return {
          scan_file_id: originalScanFile?.id || '',
          filename: validFile.filename,
          status: 'uploaded',
          upload_file_id: validFile.id || `upload-${Date.now()}`,
          validation_result: {
            category: validFile.validation.category,
            confidence: validFile.validation.confidence,
            requires_manual_review: validFile.validation.metadata.requires_manual_review,
          },
        };
      });

      const failedFiles: ScanUploadFileResult[] = invalidFiles.map(invalidFile => {
        const originalScanFile = scanJob.files_created.find(sf => sf.filename === invalidFile.filename);
        return {
          scan_file_id: originalScanFile?.id || '',
          filename: invalidFile.filename,
          status: 'failed',
          error_message: invalidFile.error_message,
        };
      });

      // Update scan files with upload status
      await this.updateScanFileUploadStatus(uploadedFiles, batchId!);

      return {
        success: true,
        batch_id: batchId,
        batch_number: batchNumber,
        uploaded_files: uploadedFiles,
        failed_files: failedFiles,
        warnings: this.generateUploadWarnings(scanJob, uploadedFiles, failedFiles),
      };

    } catch (error) {
      console.error('Scanner upload integration error:', error);

      return {
        success: false,
        uploaded_files: [],
        failed_files: scanJob.files_created.map(file => ({
          scan_file_id: file.id,
          filename: file.filename,
          status: 'failed' as const,
          error_message: error instanceof Error ? error.message : 'Okänt fel vid uppladdning',
        })),
        warnings: [],
        error: error instanceof Error ? error.message : 'Okänt fel vid uppladdning',
      };
    }
  }

  /**
   * Get upload status for scan files
   */
  async getScanFileUploadStatus(scanFileIds: string[]): Promise<Record<string, {
    upload_status: string;
    batch_id?: string;
    upload_progress?: number;
    error_message?: string;
  }>> {
    // In a real implementation, this would query the database for upload status
    // For mock service, return simulated status
    const status: Record<string, any> = {};
    
    scanFileIds.forEach(fileId => {
      // Simulate various upload states
      const random = Math.random();
      if (random > 0.8) {
        status[fileId] = {
          upload_status: 'completed',
          batch_id: `batch-${Date.now()}`,
          upload_progress: 100,
        };
      } else if (random > 0.6) {
        status[fileId] = {
          upload_status: 'uploading',
          batch_id: `batch-${Date.now()}`,
          upload_progress: Math.floor(Math.random() * 80) + 10,
        };
      } else if (random > 0.9) {
        status[fileId] = {
          upload_status: 'failed',
          error_message: 'Filuppladdning misslyckades',
        };
      } else {
        status[fileId] = {
          upload_status: 'pending',
        };
      }
    });

    return status;
  }

  /**
   * Prepare scanned document for enhanced validation
   */
  private async prepareScanForValidation(scanFile: ScanFile, scanJob: ScanJob) {
    return {
      // Basic file info
      filename: scanFile.filename,
      size: scanFile.file_size,
      mimeType: scanFile.mime_type,
      tempPath: scanFile.file_path,

      // Scanner-specific metadata for validation
      scanner_context: {
        scanner_id: scanJob.scanner_id,
        scan_settings: scanJob.settings,
        resolution: scanFile.resolution,
        color_mode: scanFile.color_mode,
        page_count: scanFile.page_count,
      },

      // OCR and categorization data
      ocr_data: scanFile.ocr_text ? {
        text: scanFile.ocr_text,
        confidence: scanFile.ocr_confidence,
        document_category: scanFile.document_category,
        category_confidence: scanFile.category_confidence,
      } : undefined,

      // Pre-categorization hint for validation system
      suggested_category: scanFile.document_category,
      category_confidence: scanFile.category_confidence,
    };
  }

  /**
   * Update scan files with upload status
   */
  private async updateScanFileUploadStatus(
    uploadedFiles: ScanUploadFileResult[],
    batchId: string
  ): Promise<void> {
    // In a real implementation, this would update the database
    // For mock service, we'll just log the update
    console.log('Updated scan file upload status:', {
      batch_id: batchId,
      uploaded_files: uploadedFiles.length,
      file_ids: uploadedFiles.map(f => f.scan_file_id),
    });
  }

  /**
   * Generate helpful warnings for the upload process
   */
  private generateUploadWarnings(
    scanJob: ScanJob,
    uploadedFiles: ScanUploadFileResult[],
    failedFiles: ScanUploadFileResult[]
  ): string[] {
    const warnings: string[] = [];

    // Check for quality concerns
    const lowResFiles = scanJob.files_created.filter(f => f.resolution < 300);
    if (lowResFiles.length > 0) {
      warnings.push(`${lowResFiles.length} filer har låg upplösning (< 300 DPI) och kan ha dålig kvalitet`);
    }

    // Check for OCR confidence
    const lowOcrFiles = scanJob.files_created.filter(f => f.ocr_confidence && f.ocr_confidence < 0.8);
    if (lowOcrFiles.length > 0) {
      warnings.push(`${lowOcrFiles.length} filer har låg textigenkänningskvalitet och kan behöva manuell granskning`);
    }

    // Check for failed uploads
    if (failedFiles.length > 0) {
      warnings.push(`${failedFiles.length} filer kunde inte laddas upp och behöver åtgärdas`);
    }

    // Check for manual review requirements
    const reviewFiles = uploadedFiles.filter(f => f.validation_result?.requires_manual_review);
    if (reviewFiles.length > 0) {
      warnings.push(`${reviewFiles.length} filer kräver manuell granskning baserat på innehåll`);
    }

    return warnings;
  }
}

// Singleton instance for the application
export const scannerUploadIntegration = new ScannerUploadIntegration();