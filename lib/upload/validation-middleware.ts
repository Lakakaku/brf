/**
 * File Validation Middleware for BRF Portal
 * Provides middleware functions for validating files in upload endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { BRFFileValidator, BRFValidationRules, BRFValidationResult } from './brf-file-validator';
import { SwedishMessages } from './messages';
import { logEvent } from '@/lib/monitoring/events';

export interface ValidationMiddlewareOptions {
  cooperativeId: string;
  userId?: string;
  customRules?: Partial<BRFValidationRules>;
  skipCategories?: boolean;
  logValidation?: boolean;
}

export interface ValidatedFile {
  filename: string;
  size: number;
  mimeType?: string;
  contentType?: string;
  tempPath?: string;
  validation: BRFValidationResult;
}

/**
 * Middleware for validating single files
 */
export async function validateSingleFile(
  file: {
    filename: string;
    size: number;
    mimeType?: string;
    contentType?: string;
    tempPath?: string;
  },
  options: ValidationMiddlewareOptions
): Promise<{
  success: boolean;
  data?: ValidatedFile;
  error?: string;
  warnings?: string[];
}> {
  try {
    const validator = new BRFFileValidator(options.customRules);
    
    const validationResult = await validator.validateBRFFile(
      file,
      options.cooperativeId,
      options.customRules
    );

    const validatedFile: ValidatedFile = {
      ...file,
      validation: validationResult
    };

    // Log validation if enabled
    if (options.logValidation !== false) {
      await logValidationEvent(options.cooperativeId, options.userId, {
        filename: file.filename,
        valid: validationResult.valid,
        category: validationResult.category,
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length
      });
    }

    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.errors.join('; '),
        warnings: validationResult.warnings
      };
    }

    return {
      success: true,
      data: validatedFile,
      warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Okänt valideringsfel';
    
    if (options.logValidation !== false) {
      await logValidationEvent(options.cooperativeId, options.userId, {
        filename: file.filename,
        valid: false,
        error: errorMessage
      });
    }

    return {
      success: false,
      error: `Valideringsfel: ${errorMessage}`
    };
  }
}

/**
 * Middleware for validating multiple files in batch
 */
export async function validateBatchFiles(
  files: Array<{
    filename: string;
    size: number;
    mimeType?: string;
    contentType?: string;
    tempPath?: string;
  }>,
  options: ValidationMiddlewareOptions
): Promise<{
  success: boolean;
  data?: {
    validFiles: ValidatedFile[];
    invalidFiles: Array<{
      filename: string;
      errors: string[];
      warnings: string[];
    }>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      totalSize: number;
      categories: Record<string, number>;
    };
  };
  error?: string;
}> {
  try {
    const validator = new BRFFileValidator(options.customRules);
    const validFiles: ValidatedFile[] = [];
    const invalidFiles: Array<{
      filename: string;
      errors: string[];
      warnings: string[];
    }> = [];
    const categories: Record<string, number> = {};
    let totalSize = 0;

    // Validate each file
    for (const file of files) {
      try {
        const validationResult = await validator.validateBRFFile(
          file,
          options.cooperativeId,
          options.customRules
        );

        totalSize += file.size;

        if (validationResult.valid) {
          validFiles.push({
            ...file,
            validation: validationResult
          });
          
          // Count categories
          const category = validationResult.category;
          categories[category] = (categories[category] || 0) + 1;
        } else {
          invalidFiles.push({
            filename: file.filename,
            errors: validationResult.errors,
            warnings: validationResult.warnings
          });
        }

        // Log individual file validation
        if (options.logValidation !== false) {
          await logValidationEvent(options.cooperativeId, options.userId, {
            filename: file.filename,
            valid: validationResult.valid,
            category: validationResult.category,
            errors: validationResult.errors.length,
            warnings: validationResult.warnings.length
          });
        }

      } catch (fileError) {
        invalidFiles.push({
          filename: file.filename,
          errors: [`Valideringsfel: ${fileError instanceof Error ? fileError.message : 'Okänt fel'}`],
          warnings: []
        });
      }
    }

    // Log batch summary
    if (options.logValidation !== false) {
      await logEvent({
        cooperative_id: options.cooperativeId,
        event_type: 'batch_file_validation',
        event_level: 'info',
        event_source: 'validation_middleware',
        event_message: `Batch validation completed: ${validFiles.length} valid, ${invalidFiles.length} invalid`,
        user_id: options.userId,
        event_data: {
          total_files: files.length,
          valid_files: validFiles.length,
          invalid_files: invalidFiles.length,
          total_size: totalSize,
          categories
        }
      });
    }

    return {
      success: true,
      data: {
        validFiles,
        invalidFiles,
        summary: {
          total: files.length,
          valid: validFiles.length,
          invalid: invalidFiles.length,
          totalSize,
          categories
        }
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Okänt batchvalideringsfel';
    
    if (options.logValidation !== false) {
      await logEvent({
        cooperative_id: options.cooperativeId,
        event_type: 'batch_validation_error',
        event_level: 'error',
        event_source: 'validation_middleware',
        event_message: `Batch validation failed: ${errorMessage}`,
        user_id: options.userId,
        error_message: errorMessage
      });
    }

    return {
      success: false,
      error: `Batchvalideringsfel: ${errorMessage}`
    };
  }
}

/**
 * Express/Next.js middleware wrapper
 */
export function createValidationMiddleware(defaultOptions: Partial<ValidationMiddlewareOptions> = {}) {
  return async function validationMiddleware(
    request: NextRequest,
    files: Array<{
      filename: string;
      size: number;
      mimeType?: string;
      contentType?: string;
      tempPath?: string;
    }>,
    options: Partial<ValidationMiddlewareOptions> = {}
  ): Promise<NextResponse | null> {
    const mergedOptions = { ...defaultOptions, ...options };
    
    if (!mergedOptions.cooperativeId) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.INVALID_REQUEST,
          details: 'Kooperativ-ID krävs för filvalidering',
          code: 'COOPERATIVE_ID_REQUIRED'
        },
        { status: 400 }
      );
    }

    // Validate files
    const result = await validateBatchFiles(files, mergedOptions as ValidationMiddlewareOptions);
    
    if (!result.success) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: result.error,
          code: 'VALIDATION_FAILED'
        },
        { status: 400 }
      );
    }

    // If any files are invalid, return error with details
    if (result.data && result.data.invalidFiles.length > 0) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: 'En eller flera filer misslyckades med validering',
          code: 'SOME_FILES_INVALID',
          data: {
            valid_files: result.data.validFiles.length,
            invalid_files: result.data.invalidFiles.map(f => ({
              filename: f.filename,
              errors: f.errors,
              warnings: f.warnings
            })),
            summary: result.data.summary
          }
        },
        { status: 400 }
      );
    }

    // All files valid, continue with request processing
    return null;
  };
}

/**
 * Validation rule builder for different BRF contexts
 */
export class ValidationRuleBuilder {
  private rules: Partial<BRFValidationRules> = {};

  static forInvoices(): ValidationRuleBuilder {
    return new ValidationRuleBuilder().category('invoice');
  }

  static forProtocols(): ValidationRuleBuilder {
    return new ValidationRuleBuilder().category('protocol');
  }

  static forContracts(): ValidationRuleBuilder {
    return new ValidationRuleBuilder().category('contract');
  }

  static forFinancialReports(): ValidationRuleBuilder {
    return new ValidationRuleBuilder().category('financial_report');
  }

  category(category: keyof BRFValidationRules['category_rules']): ValidationRuleBuilder {
    // Set rules based on category
    switch (category) {
      case 'invoice':
        this.rules.allowed_extensions = ['pdf', 'jpg', 'jpeg', 'png', 'tiff'];
        this.rules.max_file_size_mb = 50;
        break;
      case 'protocol':
        this.rules.allowed_extensions = ['pdf', 'doc', 'docx'];
        this.rules.max_file_size_mb = 100;
        this.rules.require_content_validation = true;
        break;
      case 'contract':
        this.rules.allowed_extensions = ['pdf', 'doc', 'docx'];
        this.rules.max_file_size_mb = 200;
        this.rules.require_content_validation = true;
        break;
      case 'financial_report':
        this.rules.allowed_extensions = ['pdf', 'xls', 'xlsx', 'csv'];
        this.rules.max_file_size_mb = 100;
        break;
    }
    return this;
  }

  maxSize(sizeMB: number): ValidationRuleBuilder {
    this.rules.max_file_size_mb = sizeMB;
    return this;
  }

  allowExtensions(extensions: string[]): ValidationRuleBuilder {
    this.rules.allowed_extensions = extensions;
    return this;
  }

  requireVirusScan(required = true): ValidationRuleBuilder {
    this.rules.require_virus_scan = required;
    return this;
  }

  requireContentValidation(required = true): ValidationRuleBuilder {
    this.rules.require_content_validation = required;
    return this;
  }

  enablePIIDetection(enabled = true): ValidationRuleBuilder {
    this.rules.enable_pii_detection = enabled;
    return this;
  }

  requireSwedishContent(required = true): ValidationRuleBuilder {
    this.rules.require_swedish_content = required;
    return this;
  }

  build(): Partial<BRFValidationRules> {
    return { ...this.rules };
  }
}

/**
 * Helper functions
 */
async function logValidationEvent(
  cooperativeId: string,
  userId: string | undefined,
  data: Record<string, any>
): Promise<void> {
  try {
    await logEvent({
      cooperative_id: cooperativeId,
      event_type: 'file_validation',
      event_level: data.valid ? 'info' : 'warning',
      event_source: 'validation_middleware',
      event_message: `File validation: ${data.filename}`,
      user_id: userId,
      event_data: data
    });
  } catch (error) {
    console.error('Failed to log validation event:', error);
  }
}

/**
 * Pre-configured validators for common BRF scenarios
 */
export const BRFValidators = {
  // Strict validator for sensitive documents
  strict: () => new ValidationRuleBuilder()
    .maxSize(100)
    .requireVirusScan(true)
    .requireContentValidation(true)
    .enablePIIDetection(true)
    .build(),

  // Lenient validator for general documents
  lenient: () => new ValidationRuleBuilder()
    .maxSize(500)
    .requireVirusScan(true)
    .requireContentValidation(false)
    .build(),

  // Invoice-specific validator
  invoices: () => ValidationRuleBuilder
    .forInvoices()
    .requireVirusScan(true)
    .enablePIIDetection(false)
    .build(),

  // Protocol-specific validator
  protocols: () => ValidationRuleBuilder
    .forProtocols()
    .requireSwedishContent(true)
    .enablePIIDetection(true)
    .build(),

  // Contract validator with enhanced security
  contracts: () => ValidationRuleBuilder
    .forContracts()
    .requireSwedishContent(true)
    .enablePIIDetection(true)
    .requireContentValidation(true)
    .build()
};

export default {
  validateSingleFile,
  validateBatchFiles,
  createValidationMiddleware,
  ValidationRuleBuilder,
  BRFValidators
};