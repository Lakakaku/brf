/**
 * File Size Validation Integration Helper
 * Demonstrates integration with existing BRF Portal upload system
 */

import { FileSizeValidator } from './file-size-validator';
import { BRFFileValidator } from './brf-file-validator';
import { SwedishMessages } from './messages';
import { getDatabase } from '@/lib/database';
import { logEvent } from '@/lib/monitoring/events';

export interface IntegratedValidationResult {
  valid: boolean;
  fileSizeResult: any;
  fileTypeResult: any;
  combinedViolations: any[];
  combinedWarnings: any[];
  uploadRecommendations: UploadRecommendation[];
}

export interface UploadRecommendation {
  type: 'compress' | 'split' | 'convert' | 'resize' | 'optimize';
  priority: 'high' | 'medium' | 'low';
  message: string;
  messageSwedish: string;
  actionUrl?: string;
  estimatedImprovementPercent?: number;
}

/**
 * Integrated validator that combines file size and type validation
 */
export class IntegratedUploadValidator {
  private fileSizeValidator: FileSizeValidator;
  private fileTypeValidator: BRFFileValidator;
  private cooperativeId: string;
  private userId: string;

  constructor(cooperativeId: string, userId: string) {
    this.cooperativeId = cooperativeId;
    this.userId = userId;
    this.fileSizeValidator = new FileSizeValidator(cooperativeId, userId);
    this.fileTypeValidator = new BRFFileValidator();
  }

  /**
   * Comprehensive validation of files before upload
   */
  async validateUpload(
    files: Array<{
      filename: string;
      size: number;
      mimeType?: string;
      documentType?: string;
      file?: File | Buffer;
    }>,
    options?: {
      batchId?: string;
      uploadSessionId?: string;
      skipQuotaCheck?: boolean;
      enableCompressionSuggestions?: boolean;
    }
  ): Promise<IntegratedValidationResult> {
    const results = {
      valid: true,
      fileSizeResult: null,
      fileTypeResult: null,
      combinedViolations: [] as any[],
      combinedWarnings: [] as any[],
      uploadRecommendations: [] as UploadRecommendation[]
    };

    try {
      // Run file size validation
      results.fileSizeResult = await this.fileSizeValidator.validateFiles(files, {
        batchId: options?.batchId,
        uploadSessionId: options?.uploadSessionId,
        skipQuotaCheck: options?.skipQuotaCheck
      });

      // Run file type validation for each file
      const fileTypeResults = [];
      for (const file of files) {
        if (file.file) {
          const typeResult = await this.fileTypeValidator.validateBRFFile(
            file.file,
            this.cooperativeId,
            {
              expectedDocumentType: file.documentType,
              strictMode: true,
              enableContentAnalysis: true
            }
          );
          fileTypeResults.push(typeResult);
        }
      }

      results.fileTypeResult = {
        results: fileTypeResults,
        allValid: fileTypeResults.every(r => r.valid)
      };

      // Combine violations and warnings
      this.combineValidationResults(results);

      // Generate upload recommendations
      results.uploadRecommendations = await this.generateUploadRecommendations(
        files, 
        results.fileSizeResult, 
        fileTypeResults,
        options?.enableCompressionSuggestions
      );

      // Determine overall validity
      results.valid = results.fileSizeResult.valid && results.fileTypeResult.allValid;

      // Log integrated validation
      await this.logIntegratedValidation(files, results, options);

      return results;

    } catch (error) {
      console.error('Integrated validation error:', error);
      
      results.valid = false;
      results.combinedViolations.push({
        type: 'validation_error',
        severity: 'error',
        message: 'Validation system error occurred',
        messageSwedish: 'Ett fel uppstod i valideringssystemet',
        source: 'integrated_validator'
      });

      return results;
    }
  }

  /**
   * Pre-upload size check (lightweight validation)
   */
  async quickSizeCheck(
    filename: string, 
    size: number, 
    documentType?: string
  ): Promise<{
    canUpload: boolean;
    maxSize: number;
    warningThreshold: number;
    compressionSuggested: boolean;
    message?: string;
    messageSwedish?: string;
  }> {
    try {
      const limits = await this.fileSizeValidator.getEffectiveLimits(documentType);
      const canUpload = size <= limits.maxFileSize;
      const warningThreshold = limits.maxFileSize * 0.8; // 80% warning
      const compressionSuggested = limits.compressionThreshold ? size > limits.compressionThreshold : false;

      let message = '';
      let messageSwedish = '';

      if (!canUpload) {
        message = `File size ${this.formatBytes(size)} exceeds limit ${this.formatBytes(limits.maxFileSize)}`;
        messageSwedish = `Filstorlek ${this.formatBytes(size)} överskrider gränsen ${this.formatBytes(limits.maxFileSize)}`;
      } else if (size > warningThreshold) {
        message = `File size approaching limit (${Math.round((size / limits.maxFileSize) * 100)}%)`;
        messageSwedish = `Filstorlek närmar sig gränsen (${Math.round((size / limits.maxFileSize) * 100)}%)`;
      }

      return {
        canUpload,
        maxSize: limits.maxFileSize,
        warningThreshold,
        compressionSuggested,
        message,
        messageSwedish
      };

    } catch (error) {
      console.error('Quick size check error:', error);
      return {
        canUpload: false,
        maxSize: 524288000, // 500MB default
        warningThreshold: 419430400, // 400MB default
        compressionSuggested: false,
        message: 'Unable to check file size limits',
        messageSwedish: 'Kunde inte kontrollera filstorleksgränser'
      };
    }
  }

  /**
   * Get size limits for client-side validation
   */
  async getClientLimits(): Promise<{
    maxFileSize: number;
    maxBatchSize: number;
    maxDailySize?: number;
    compressionThreshold?: number;
    documentTypeLimits: Record<string, number>;
  }> {
    const globalLimits = await this.fileSizeValidator.getEffectiveLimits();
    
    // Get document type specific limits
    const documentTypes = ['invoice', 'protocol', 'contract', 'financial_report', 
                          'technical_report', 'image', 'video', 'audio'];
    
    const documentTypeLimits: Record<string, number> = {};
    
    for (const docType of documentTypes) {
      const limits = await this.fileSizeValidator.getEffectiveLimits(docType);
      documentTypeLimits[docType] = limits.maxFileSize;
    }

    return {
      maxFileSize: globalLimits.maxFileSize,
      maxBatchSize: globalLimits.maxBatchSize,
      maxDailySize: globalLimits.maxDailySize,
      compressionThreshold: globalLimits.compressionThreshold,
      documentTypeLimits
    };
  }

  /**
   * Update quota usage after successful upload
   */
  async recordUploadQuotaUsage(
    files: Array<{ filename: string; size: number; documentType?: string }>,
    uploadId: string
  ): Promise<void> {
    const db = getDatabase();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    try {
      // Update daily usage
      db.prepare(`
        INSERT OR REPLACE INTO storage_quota_usage (
          id, cooperative_id, usage_scope, scope_identifier, current_usage_bytes,
          total_files_count, total_uploads_count, period_type, period_start, period_end,
          last_calculated
        ) VALUES (
          COALESCE((SELECT id FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'daily' AND scope_identifier = ?), 
                   'sq_daily_' || ? || '_' || ?),
          ?, 'daily', ?, 
          COALESCE((SELECT current_usage_bytes FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'daily' AND scope_identifier = ?), 0) + ?,
          COALESCE((SELECT total_files_count FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'daily' AND scope_identifier = ?), 0) + ?,
          COALESCE((SELECT total_uploads_count FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'daily' AND scope_identifier = ?), 0) + 1,
          'day', ?, ?, datetime('now')
        )
      `).run(
        this.cooperativeId, today, this.cooperativeId, today,
        this.cooperativeId, today, this.cooperativeId, today, totalSize,
        this.cooperativeId, today, files.length, this.cooperativeId, today,
        today, today
      );

      // Update monthly usage
      db.prepare(`
        INSERT OR REPLACE INTO storage_quota_usage (
          id, cooperative_id, usage_scope, scope_identifier, current_usage_bytes,
          total_files_count, total_uploads_count, period_type, period_start, period_end,
          last_calculated
        ) VALUES (
          COALESCE((SELECT id FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'monthly' AND scope_identifier = ?), 
                   'sq_monthly_' || ? || '_' || ?),
          ?, 'monthly', ?, 
          COALESCE((SELECT current_usage_bytes FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'monthly' AND scope_identifier = ?), 0) + ?,
          COALESCE((SELECT total_files_count FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'monthly' AND scope_identifier = ?), 0) + ?,
          COALESCE((SELECT total_uploads_count FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'monthly' AND scope_identifier = ?), 0) + 1,
          'month', ?, ?, datetime('now')
        )
      `).run(
        this.cooperativeId, thisMonth, this.cooperativeId, thisMonth,
        this.cooperativeId, thisMonth, this.cooperativeId, thisMonth, totalSize,
        this.cooperativeId, thisMonth, files.length, this.cooperativeId, thisMonth,
        thisMonth + '-01', thisMonth + '-31'
      );

      // Update cooperative total
      db.prepare(`
        INSERT OR REPLACE INTO storage_quota_usage (
          id, cooperative_id, usage_scope, current_usage_bytes,
          total_files_count, total_uploads_count, last_calculated
        ) VALUES (
          COALESCE((SELECT id FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'cooperative'), 
                   'sq_coop_' || ?),
          ?, 'cooperative',
          COALESCE((SELECT current_usage_bytes FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'cooperative'), 0) + ?,
          COALESCE((SELECT total_files_count FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'cooperative'), 0) + ?,
          COALESCE((SELECT total_uploads_count FROM storage_quota_usage WHERE cooperative_id = ? AND usage_scope = 'cooperative'), 0) + 1,
          datetime('now')
        )
      `).run(
        this.cooperativeId, this.cooperativeId, this.cooperativeId,
        this.cooperativeId, totalSize, this.cooperativeId, files.length,
        this.cooperativeId
      );

      // Log quota update
      await logEvent({
        cooperative_id: this.cooperativeId,
        event_type: 'quota_usage_updated',
        event_level: 'info',
        event_source: 'integrated_validator',
        event_message: `Quota usage updated after upload: ${uploadId}`,
        user_id: this.userId,
        event_data: {
          upload_id: uploadId,
          files_count: files.length,
          total_size_bytes: totalSize,
          total_size_mb: Math.round(totalSize / 1024 / 1024 * 100) / 100
        }
      });

    } catch (error) {
      console.error('Error recording quota usage:', error);
      // Don't throw error as upload was successful
    }
  }

  /**
   * Private helper methods
   */
  private combineValidationResults(results: IntegratedValidationResult): void {
    // Add file size violations
    if (results.fileSizeResult.violations) {
      results.combinedViolations.push(...results.fileSizeResult.violations.map((v: any) => ({
        ...v,
        source: 'file_size'
      })));
    }

    // Add file size warnings
    if (results.fileSizeResult.warnings) {
      results.combinedWarnings.push(...results.fileSizeResult.warnings.map((w: any) => ({
        ...w,
        source: 'file_size'
      })));
    }

    // Add file type violations
    if (results.fileTypeResult.results) {
      for (const typeResult of results.fileTypeResult.results) {
        if (typeResult.errors) {
          results.combinedViolations.push(...typeResult.errors.map((e: any) => ({
            type: 'file_type_violation',
            severity: 'error',
            message: e.message,
            messageSwedish: e.messageSwedish || e.message,
            source: 'file_type',
            filename: typeResult.filename
          })));
        }

        if (typeResult.warnings) {
          results.combinedWarnings.push(...typeResult.warnings.map((w: any) => ({
            type: 'file_type_warning',
            message: w.message,
            messageSwedish: w.messageSwedish || w.message,
            source: 'file_type',
            filename: typeResult.filename
          })));
        }
      }
    }
  }

  private async generateUploadRecommendations(
    files: any[],
    fileSizeResult: any,
    fileTypeResults: any[],
    enableCompressionSuggestions?: boolean
  ): Promise<UploadRecommendation[]> {
    const recommendations: UploadRecommendation[] = [];

    // Compression recommendations from file size validator
    if (enableCompressionSuggestions && fileSizeResult.suggestions) {
      for (const suggestion of fileSizeResult.suggestions) {
        recommendations.push({
          type: 'compress',
          priority: 'medium',
          message: suggestion.message,
          messageSwedish: suggestion.messageSwedish,
          actionUrl: `/upload/compress?file=${encodeURIComponent(suggestion.filename)}`,
          estimatedImprovementPercent: Math.round((1 - suggestion.compressionRatio) * 100)
        });
      }
    }

    // Large file splitting recommendations
    const totalBatchSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxBatchSize = fileSizeResult.maxBatchSize || 1073741824; // 1GB default

    if (totalBatchSize > maxBatchSize) {
      recommendations.push({
        type: 'split',
        priority: 'high',
        message: `Batch size ${this.formatBytes(totalBatchSize)} exceeds limit. Consider splitting into smaller batches.`,
        messageSwedish: `Batchstorlek ${this.formatBytes(totalBatchSize)} överskrider gränsen. Överväg att dela upp i mindre batchar.`,
        estimatedImprovementPercent: Math.round(((totalBatchSize - maxBatchSize) / totalBatchSize) * 100)
      });
    }

    // File format conversion recommendations
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const typeResult = fileTypeResults[i];
      
      if (typeResult && !typeResult.valid) {
        const extension = file.filename.split('.').pop()?.toLowerCase();
        
        if (['bmp', 'tiff'].includes(extension)) {
          recommendations.push({
            type: 'convert',
            priority: 'medium',
            message: `Convert ${extension.toUpperCase()} to JPEG for better compatibility and smaller size`,
            messageSwedish: `Konvertera ${extension.toUpperCase()} till JPEG för bättre kompatibilitet och mindre storlek`,
            actionUrl: `/upload/convert?file=${encodeURIComponent(file.filename)}&target=jpeg`,
            estimatedImprovementPercent: 60
          });
        }
      }
    }

    return recommendations;
  }

  private async logIntegratedValidation(
    files: any[],
    results: IntegratedValidationResult,
    options?: any
  ): Promise<void> {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    await logEvent({
      cooperative_id: this.cooperativeId,
      event_type: 'integrated_upload_validation',
      event_level: results.valid ? 'info' : 'warning',
      event_source: 'integrated_validator',
      event_message: `Integrated validation completed for ${files.length} files`,
      user_id: this.userId,
      event_data: {
        batch_id: options?.batchId,
        upload_session_id: options?.uploadSessionId,
        total_files: files.length,
        total_size_bytes: totalSize,
        total_size_mb: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        validation_passed: results.valid,
        size_violations: results.fileSizeResult?.violations?.length || 0,
        type_violations: results.fileTypeResult?.results?.filter((r: any) => !r.valid).length || 0,
        total_violations: results.combinedViolations.length,
        total_warnings: results.combinedWarnings.length,
        recommendations_count: results.uploadRecommendations.length
      }
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Usage example in an upload API endpoint:
 * 
 * import { IntegratedUploadValidator } from '@/lib/upload/file-size-integration';
 * 
 * export async function POST(request: NextRequest) {
 *   const { user } = await requireAuth(request, { permissions: ['canUploadDocuments'] });
 *   const validator = new IntegratedUploadValidator(user.cooperativeId, user.id);
 *   
 *   // Get files from request...
 *   const files = [...];
 *   
 *   // Validate before processing
 *   const validationResult = await validator.validateUpload(files, {
 *     batchId: 'batch_123',
 *     enableCompressionSuggestions: true
 *   });
 *   
 *   if (!validationResult.valid) {
 *     return NextResponse.json({
 *       error: 'Validation failed',
 *       violations: validationResult.combinedViolations,
 *       recommendations: validationResult.uploadRecommendations
 *     }, { status: 400 });
 *   }
 *   
 *   // Proceed with upload...
 *   const uploadResult = await processUpload(files);
 *   
 *   // Record quota usage
 *   await validator.recordUploadQuotaUsage(files, uploadResult.uploadId);
 *   
 *   return NextResponse.json({ success: true });
 * }
 */