/**
 * File Size Validation Middleware for BRF Portal
 * Integrates with existing upload validation pipeline
 */

import { getDatabase } from '@/lib/database';
import { logEvent } from '@/lib/monitoring/events';

// Types
export interface FileSizeValidationResult {
  valid: boolean;
  violations: FileSizeViolation[];
  warnings: FileSizeWarning[];
  suggestions: CompressionSuggestion[];
  appliedConfig: FileSizeConfig | null;
  maxAllowedSize: number;
  totalBatchSize?: number;
  maxBatchSize?: number;
}

export interface FileSizeViolation {
  type: 'file_too_large' | 'batch_too_large' | 'daily_quota_exceeded' | 'monthly_quota_exceeded' | 
        'document_type_limit_exceeded' | 'user_limit_exceeded' | 'storage_quota_full' | 
        'mime_type_blocked' | 'extension_blocked';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  messageSwedish: string;
  limit: number;
  actualSize: number;
  configId?: string;
  suggestedAction?: string;
  suggestedActionSwedish?: string;
}

export interface FileSizeWarning {
  type: 'approaching_limit' | 'compression_recommended' | 'quota_warning' | 'large_file_detected';
  message: string;
  messageSwedish: string;
  threshold: number;
  actualSize: number;
  suggestion: string;
  suggestionSwedish: string;
}

export interface CompressionSuggestion {
  filename: string;
  originalSize: number;
  estimatedCompressedSize: number;
  compressionRatio: number;
  method: 'image_quality' | 'pdf_optimization' | 'archive_compression';
  quality: number;
  message: string;
  messageSwedish: string;
}

export interface FileSizeConfig {
  id: string;
  configType: 'global' | 'document_type' | 'user_override' | 'user_specific';
  maxFileSize: number;
  maxBatchSize?: number;
  maxDailySize?: number;
  maxMonthlySize?: number;
  documentType?: string;
  validationMode: 'strict' | 'warning' | 'log_only';
  autoCompressEnabled: boolean;
  compressionThreshold?: number;
  suggestCompressionAt?: number;
  allowedMimeTypes?: string[];
  blockedMimeTypes?: string[];
  allowedExtensions?: string[];
  blockedExtensions?: string[];
  priority: number;
}

// Swedish error messages
const SwedishMessages = {
  violations: {
    file_too_large: (filename: string, size: string, limit: string) => 
      `Filen "${filename}" (${size}) överskrider den tillåtna storleksgränsen på ${limit}`,
    batch_too_large: (totalSize: string, limit: string) => 
      `Total batchstorlek (${totalSize}) överskrider gränsen på ${limit}`,
    daily_quota_exceeded: (used: string, limit: string) => 
      `Daglig kvot överskriden. Använt: ${used}, Gräns: ${limit}`,
    monthly_quota_exceeded: (used: string, limit: string) => 
      `Månadskvot överskriden. Använt: ${used}, Gräns: ${limit}`,
    document_type_limit_exceeded: (type: string, size: string, limit: string) => 
      `Dokumenttyp "${type}" överskrider storleksgräns. Storlek: ${size}, Gräns: ${limit}`,
    user_limit_exceeded: (size: string, limit: string) => 
      `Användargräns överskriden. Storlek: ${size}, Gräns: ${limit}`,
    storage_quota_full: () => 'Lagringsutrymmet är fullt',
    mime_type_blocked: (mimeType: string) => `MIME-typ "${mimeType}" är inte tillåten`,
    extension_blocked: (extension: string) => `Filtillägg ".${extension}" är inte tillåtet`
  },
  suggestions: {
    file_too_large: 'Försök att komprimera filen eller dela upp den i mindre delar',
    batch_too_large: 'Ladda upp färre filer åt gången eller komprimera filerna',
    daily_quota_exceeded: 'Vänta till nästa dag eller begär utökad kvot',
    monthly_quota_exceeded: 'Vänta till nästa månad eller kontakta administratören',
    storage_quota_full: 'Kontakta administratören för mer lagringsutrymme'
  },
  warnings: {
    approaching_limit: (percentage: number) => `Närmar dig storleksgräns (${percentage}% av maxgränsen)`,
    compression_recommended: (savings: string) => `Komprimering rekommenderas. Potentiella besparingar: ${savings}`,
    quota_warning: (remaining: string) => `Återstående kvot: ${remaining}`,
    large_file_detected: (size: string) => `Stor fil upptäckt (${size}). Överväg komprimering`
  },
  compression: {
    image_quality: (quality: number, savings: string) => 
      `Minska bildkvalitet till ${quality}% för att spara ${savings}`,
    pdf_optimization: (savings: string) => 
      `PDF-optimering kan spara ${savings}`,
    archive_compression: (savings: string) => 
      `Arkivkomprimering kan spara ${savings}`
  }
};

export class FileSizeValidator {
  private db: any;
  private cooperativeId: string;
  private userId?: string;

  constructor(cooperativeId: string, userId?: string) {
    this.db = getDatabase();
    this.cooperativeId = cooperativeId;
    this.userId = userId;
  }

  /**
   * Validate file sizes and return comprehensive validation result
   */
  async validateFiles(
    files: Array<{
      filename: string;
      size: number;
      mimeType?: string;
      documentType?: string;
    }>,
    options?: {
      batchId?: string;
      uploadSessionId?: string;
      skipQuotaCheck?: boolean;
    }
  ): Promise<FileSizeValidationResult> {
    const violations: FileSizeViolation[] = [];
    const warnings: FileSizeWarning[] = [];
    const suggestions: CompressionSuggestion[] = [];
    let appliedConfig: FileSizeConfig | null = null;

    try {
      // Get applicable configurations in priority order
      const configs = await this.getApplicableConfigs();
      
      const totalBatchSize = files.reduce((sum, file) => sum + file.size, 0);
      let maxAllowedSize = 524288000; // Default 500MB
      let maxBatchSize = 1073741824; // Default 1GB

      // Validate each file
      for (const file of files) {
        const fileConfig = this.selectBestConfig(configs, file);
        if (fileConfig) {
          appliedConfig = fileConfig;
          maxAllowedSize = Math.max(maxAllowedSize, fileConfig.maxFileSize);
          if (fileConfig.maxBatchSize) {
            maxBatchSize = Math.max(maxBatchSize, fileConfig.maxBatchSize);
          }
        }

        // Individual file size validation
        await this.validateIndividualFile(file, fileConfig, violations, warnings, suggestions);
      }

      // Batch size validation
      if (totalBatchSize > maxBatchSize) {
        violations.push({
          type: 'batch_too_large',
          severity: 'error',
          message: `Batch size ${this.formatBytes(totalBatchSize)} exceeds limit ${this.formatBytes(maxBatchSize)}`,
          messageSwedish: SwedishMessages.violations.batch_too_large(
            this.formatBytes(totalBatchSize), 
            this.formatBytes(maxBatchSize)
          ),
          limit: maxBatchSize,
          actualSize: totalBatchSize,
          suggestedAction: 'Upload fewer files at once or compress files',
          suggestedActionSwedish: SwedishMessages.suggestions.batch_too_large
        });
      }

      // Quota validation (if not skipped)
      if (!options?.skipQuotaCheck) {
        await this.validateQuotas(totalBatchSize, violations, warnings);
      }

      // Log validation results
      await this.logValidationResults(files, violations, warnings, options);

      return {
        valid: violations.filter(v => v.severity === 'error' || v.severity === 'critical').length === 0,
        violations,
        warnings,
        suggestions,
        appliedConfig,
        maxAllowedSize,
        totalBatchSize,
        maxBatchSize
      };

    } catch (error) {
      console.error('File size validation error:', error);
      
      // Return safe defaults on error
      return {
        valid: false,
        violations: [{
          type: 'file_too_large',
          severity: 'error',
          message: 'Validation error occurred',
          messageSwedish: 'Ett valideringsfel uppstod',
          limit: maxAllowedSize,
          actualSize: totalBatchSize,
          suggestedAction: 'Please try again or contact support',
          suggestedActionSwedish: 'Försök igen eller kontakta support'
        }],
        warnings: [],
        suggestions: [],
        appliedConfig,
        maxAllowedSize,
        totalBatchSize
      };
    }
  }

  /**
   * Get applicable file size configurations for the cooperative
   */
  private async getApplicableConfigs(): Promise<FileSizeConfig[]> {
    const query = `
      SELECT 
        id, config_type, config_name, max_file_size_bytes, max_batch_size_bytes,
        max_daily_size_bytes, max_monthly_size_bytes, document_type, 
        validation_mode, auto_compress_enabled, compression_threshold_bytes,
        suggest_compression_at_bytes, allowed_mime_types, blocked_mime_types,
        allowed_extensions, blocked_extensions, priority
      FROM file_size_limit_configs 
      WHERE cooperative_id = ? 
      AND is_active = 1
      AND (effective_from IS NULL OR effective_from <= datetime('now'))
      AND (effective_until IS NULL OR effective_until > datetime('now'))
      AND (user_id IS NULL OR user_id = ?)
      ORDER BY priority ASC, created_at DESC
    `;

    const rows = this.db.prepare(query).all(this.cooperativeId, this.userId || null) as any[];

    return rows.map(row => ({
      id: row.id,
      configType: row.config_type,
      maxFileSize: row.max_file_size_bytes,
      maxBatchSize: row.max_batch_size_bytes,
      maxDailySize: row.max_daily_size_bytes,
      maxMonthlySize: row.max_monthly_size_bytes,
      documentType: row.document_type,
      validationMode: row.validation_mode,
      autoCompressEnabled: Boolean(row.auto_compress_enabled),
      compressionThreshold: row.compression_threshold_bytes,
      suggestCompressionAt: row.suggest_compression_at_bytes,
      allowedMimeTypes: JSON.parse(row.allowed_mime_types || '[]'),
      blockedMimeTypes: JSON.parse(row.blocked_mime_types || '[]'),
      allowedExtensions: JSON.parse(row.allowed_extensions || '[]'),
      blockedExtensions: JSON.parse(row.blocked_extensions || '[]'),
      priority: row.priority
    }));
  }

  /**
   * Select the best configuration for a specific file
   */
  private selectBestConfig(configs: FileSizeConfig[], file: { filename: string; mimeType?: string; documentType?: string }): FileSizeConfig | null {
    // Priority order: user_specific > user_override > document_type > global
    
    // First, try user-specific config
    let userConfig = configs.find(c => c.configType === 'user_specific');
    if (userConfig) return userConfig;

    // Then user override
    let overrideConfig = configs.find(c => c.configType === 'user_override');
    if (overrideConfig) return overrideConfig;

    // Then document type specific
    if (file.documentType) {
      let docTypeConfig = configs.find(c => 
        c.configType === 'document_type' && c.documentType === file.documentType
      );
      if (docTypeConfig) return docTypeConfig;
    }

    // Finally, global config
    return configs.find(c => c.configType === 'global') || null;
  }

  /**
   * Validate individual file against configuration
   */
  private async validateIndividualFile(
    file: { filename: string; size: number; mimeType?: string; documentType?: string },
    config: FileSizeConfig | null,
    violations: FileSizeViolation[],
    warnings: FileSizeWarning[],
    suggestions: CompressionSuggestion[]
  ): Promise<void> {
    const maxSize = config?.maxFileSize || 524288000; // Default 500MB
    const extension = file.filename.split('.').pop()?.toLowerCase();

    // File size validation
    if (file.size > maxSize) {
      const severity = config?.validationMode === 'warning' ? 'warning' : 'error';
      
      violations.push({
        type: 'file_too_large',
        severity: severity as 'warning' | 'error',
        message: `File "${file.filename}" (${this.formatBytes(file.size)}) exceeds size limit ${this.formatBytes(maxSize)}`,
        messageSwedish: SwedishMessages.violations.file_too_large(
          file.filename, 
          this.formatBytes(file.size), 
          this.formatBytes(maxSize)
        ),
        limit: maxSize,
        actualSize: file.size,
        configId: config?.id,
        suggestedAction: 'Compress the file or split into smaller parts',
        suggestedActionSwedish: SwedishMessages.suggestions.file_too_large
      });
    }

    // MIME type validation
    if (file.mimeType && config?.blockedMimeTypes?.includes(file.mimeType)) {
      violations.push({
        type: 'mime_type_blocked',
        severity: 'error',
        message: `MIME type "${file.mimeType}" is not allowed`,
        messageSwedish: SwedishMessages.violations.mime_type_blocked(file.mimeType),
        limit: 0,
        actualSize: file.size,
        configId: config.id
      });
    }

    // Extension validation
    if (extension && config?.blockedExtensions?.includes(extension)) {
      violations.push({
        type: 'extension_blocked',
        severity: 'error',
        message: `File extension ".${extension}" is not allowed`,
        messageSwedish: SwedishMessages.violations.extension_blocked(extension),
        limit: 0,
        actualSize: file.size,
        configId: config.id
      });
    }

    // Compression suggestions
    if (config?.suggestCompressionAt && file.size > config.suggestCompressionAt) {
      const suggestion = await this.generateCompressionSuggestion(file, config);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Size warnings (approaching limit)
    if (file.size > maxSize * 0.8) { // 80% of limit
      const percentage = Math.round((file.size / maxSize) * 100);
      warnings.push({
        type: 'approaching_limit',
        message: `File size is ${percentage}% of the maximum allowed`,
        messageSwedish: SwedishMessages.warnings.approaching_limit(percentage),
        threshold: maxSize * 0.8,
        actualSize: file.size,
        suggestion: 'Consider compressing before uploading',
        suggestionSwedish: 'Överväg att komprimera innan uppladdning'
      });
    }
  }

  /**
   * Validate quotas (daily, monthly, storage)
   */
  private async validateQuotas(
    totalBatchSize: number,
    violations: FileSizeViolation[],
    warnings: FileSizeWarning[]
  ): Promise<void> {
    // Get current usage
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    // Daily quota check
    const dailyUsage = this.db.prepare(`
      SELECT COALESCE(current_usage_bytes, 0) as usage, COALESCE(quota_limit_bytes, 0) as quota
      FROM storage_quota_usage 
      WHERE cooperative_id = ? AND usage_scope = 'daily' AND scope_identifier = ?
    `).get(this.cooperativeId, today) as any;

    if (dailyUsage && dailyUsage.quota > 0) {
      const projectedUsage = (dailyUsage.usage || 0) + totalBatchSize;
      if (projectedUsage > dailyUsage.quota) {
        violations.push({
          type: 'daily_quota_exceeded',
          severity: 'error',
          message: `Daily quota exceeded. Used: ${this.formatBytes(dailyUsage.usage)}, Limit: ${this.formatBytes(dailyUsage.quota)}`,
          messageSwedish: SwedishMessages.violations.daily_quota_exceeded(
            this.formatBytes(dailyUsage.usage),
            this.formatBytes(dailyUsage.quota)
          ),
          limit: dailyUsage.quota,
          actualSize: projectedUsage,
          suggestedAction: 'Wait until next day or request quota increase',
          suggestedActionSwedish: SwedishMessages.suggestions.daily_quota_exceeded
        });
      }
    }

    // Monthly quota check
    const monthlyUsage = this.db.prepare(`
      SELECT COALESCE(current_usage_bytes, 0) as usage, COALESCE(quota_limit_bytes, 0) as quota
      FROM storage_quota_usage 
      WHERE cooperative_id = ? AND usage_scope = 'monthly' AND scope_identifier = ?
    `).get(this.cooperativeId, thisMonth) as any;

    if (monthlyUsage && monthlyUsage.quota > 0) {
      const projectedUsage = (monthlyUsage.usage || 0) + totalBatchSize;
      if (projectedUsage > monthlyUsage.quota) {
        violations.push({
          type: 'monthly_quota_exceeded',
          severity: 'critical',
          message: `Monthly quota exceeded. Used: ${this.formatBytes(monthlyUsage.usage)}, Limit: ${this.formatBytes(monthlyUsage.quota)}`,
          messageSwedish: SwedishMessages.violations.monthly_quota_exceeded(
            this.formatBytes(monthlyUsage.usage),
            this.formatBytes(monthlyUsage.quota)
          ),
          limit: monthlyUsage.quota,
          actualSize: projectedUsage,
          suggestedAction: 'Wait until next month or contact administrator',
          suggestedActionSwedish: SwedishMessages.suggestions.monthly_quota_exceeded
        });
      }
    }
  }

  /**
   * Generate compression suggestion for a file
   */
  private async generateCompressionSuggestion(
    file: { filename: string; size: number; mimeType?: string },
    config: FileSizeConfig
  ): Promise<CompressionSuggestion | null> {
    const extension = file.filename.split('.').pop()?.toLowerCase();
    let method: 'image_quality' | 'pdf_optimization' | 'archive_compression' = 'archive_compression';
    let estimatedRatio = 0.7; // Default 30% compression
    let quality = config.compressionThreshold ? 85 : 75;

    // Determine compression method and ratio based on file type
    if (file.mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'bmp', 'tiff'].includes(extension || '')) {
      method = 'image_quality';
      estimatedRatio = 0.6; // 40% compression for images
      quality = 75;
    } else if (file.mimeType === 'application/pdf' || extension === 'pdf') {
      method = 'pdf_optimization';
      estimatedRatio = 0.8; // 20% compression for PDFs
    }

    const estimatedCompressedSize = Math.floor(file.size * estimatedRatio);
    const savings = file.size - estimatedCompressedSize;

    let message: string;
    let messageSwedish: string;

    switch (method) {
      case 'image_quality':
        message = `Reduce image quality to ${quality}% to save ${this.formatBytes(savings)}`;
        messageSwedish = SwedishMessages.compression.image_quality(quality, this.formatBytes(savings));
        break;
      case 'pdf_optimization':
        message = `PDF optimization can save ${this.formatBytes(savings)}`;
        messageSwedish = SwedishMessages.compression.pdf_optimization(this.formatBytes(savings));
        break;
      default:
        message = `Archive compression can save ${this.formatBytes(savings)}`;
        messageSwedish = SwedishMessages.compression.archive_compression(this.formatBytes(savings));
    }

    return {
      filename: file.filename,
      originalSize: file.size,
      estimatedCompressedSize,
      compressionRatio: estimatedRatio,
      method,
      quality,
      message,
      messageSwedish
    };
  }

  /**
   * Log validation results for audit purposes
   */
  private async logValidationResults(
    files: Array<{ filename: string; size: number; mimeType?: string; documentType?: string }>,
    violations: FileSizeViolation[],
    warnings: FileSizeWarning[],
    options?: { batchId?: string; uploadSessionId?: string }
  ): Promise<void> {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const hasViolations = violations.length > 0;
    const hasWarnings = warnings.length > 0;

    await logEvent({
      cooperative_id: this.cooperativeId,
      event_type: 'file_size_validation',
      event_level: hasViolations ? 'warning' : 'info',
      event_source: 'file_size_validator',
      event_message: `File size validation completed for ${files.length} files`,
      user_id: this.userId,
      event_data: {
        batch_id: options?.batchId,
        upload_session_id: options?.uploadSessionId,
        total_files: files.length,
        total_size_bytes: totalSize,
        total_size_mb: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        violations_count: violations.length,
        warnings_count: warnings.length,
        violation_types: [...new Set(violations.map(v => v.type))],
        largest_file_size: Math.max(...files.map(f => f.size)),
        validation_passed: !hasViolations
      }
    });

    // Log individual violations for audit
    for (const violation of violations) {
      const affectedFile = files.find(f => violation.message.includes(f.filename));
      
      this.db.prepare(`
        INSERT INTO file_size_violation_log (
          cooperative_id, violation_type, severity, original_filename,
          file_size_bytes, mime_type, user_id, violated_config_id,
          configured_limit_bytes, actual_size_bytes, violation_message_sv,
          suggested_action_sv, context_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.cooperativeId,
        violation.type,
        violation.severity,
        affectedFile?.filename,
        affectedFile?.size,
        affectedFile?.mimeType,
        this.userId,
        violation.configId,
        violation.limit,
        violation.actualSize,
        violation.messageSwedish,
        violation.suggestedActionSwedish,
        JSON.stringify({
          batch_id: options?.batchId,
          upload_session_id: options?.uploadSessionId,
          file_count: files.length,
          total_batch_size: totalSize
        })
      );
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if a file can be uploaded based on current limits
   */
  async canUploadFile(filename: string, size: number, mimeType?: string, documentType?: string): Promise<boolean> {
    const result = await this.validateFiles([{ filename, size, mimeType, documentType }]);
    return result.valid;
  }

  /**
   * Get effective size limits for a user/cooperative
   */
  async getEffectiveLimits(documentType?: string): Promise<{
    maxFileSize: number;
    maxBatchSize: number;
    maxDailySize?: number;
    maxMonthlySize?: number;
    compressionThreshold?: number;
  }> {
    const configs = await this.getApplicableConfigs();
    const config = this.selectBestConfig(configs, { filename: 'test', documentType });
    
    return {
      maxFileSize: config?.maxFileSize || 524288000,
      maxBatchSize: config?.maxBatchSize || 1073741824,
      maxDailySize: config?.maxDailySize,
      maxMonthlySize: config?.maxMonthlySize,
      compressionThreshold: config?.compressionThreshold
    };
  }
}