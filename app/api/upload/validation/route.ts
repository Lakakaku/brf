/**
 * File Validation Configuration API
 * Manages validation rules and settings for cooperatives
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { requireAuth } from '@/lib/auth/middleware';
import { BRFValidationRules, BRFDocumentCategory } from '@/lib/upload/brf-file-validator';
import { SwedishMessages } from '@/lib/upload/messages';
import { logEvent } from '@/lib/monitoring/events';
import { z } from 'zod';

// Validation schemas
const ValidationConfigSchema = z.object({
  // Base validation settings
  max_file_size_mb: z.number().min(1).max(1000).optional(),
  allowed_extensions: z.array(z.string()).optional(),
  allowed_mime_types: z.array(z.string()).optional(),
  blocked_extensions: z.array(z.string()).optional(),
  blocked_mime_types: z.array(z.string()).optional(),
  max_filename_length: z.number().min(50).max(500).optional(),
  require_virus_scan: z.boolean().optional(),
  allow_executable_files: z.boolean().optional(),
  allow_archive_files: z.boolean().optional(),
  max_archive_depth: z.number().min(1).max(10).optional(),
  require_content_validation: z.boolean().optional(),

  // BRF-specific settings
  enable_ocr_classification: z.boolean().optional(),
  enable_content_analysis: z.boolean().optional(),
  require_swedish_content: z.boolean().optional(),
  enable_pii_detection: z.boolean().optional(),
  scan_for_macros: z.boolean().optional(),
  scan_for_embedded_files: z.boolean().optional(),
  check_password_protection: z.boolean().optional(),
  max_embedded_depth: z.number().min(1).max(5).optional(),

  // Category-specific rules
  category_rules: z.record(
    z.enum(['invoice', 'protocol', 'contract', 'financial_report', 'technical_report', 
            'insurance', 'legal', 'maintenance', 'energy', 'tenant_related', 
            'board_materials', 'general', 'unknown']),
    z.object({
      allowed_extensions: z.array(z.string()),
      max_file_size_mb: z.number().min(1).max(1000),
      require_manual_review: z.boolean(),
      auto_archive_after_days: z.number().min(30).max(7300),
      enable_full_text_search: z.boolean()
    })
  ).optional()
});

/**
 * GET /api/upload/validation - Get validation configuration for cooperative
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request, {
      permissions: ['canViewSettings'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.AUTHENTICATION_REQUIRED,
          code: 'AUTHENTICATION_REQUIRED'
        },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const db = getDatabase();

    // Get validation configuration from cooperative settings
    const cooperative = db.prepare(`
      SELECT 
        id,
        name,
        settings,
        features
      FROM cooperatives 
      WHERE id = ?
    `).get(user.cooperativeId) as any;

    if (!cooperative) {
      return NextResponse.json(
        {
          error: 'Kooperativ hittades inte',
          code: 'COOPERATIVE_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Parse settings
    const settings = JSON.parse(cooperative.settings || '{}');
    const features = JSON.parse(cooperative.features || '{}');
    
    // Get validation rules from settings
    const validationRules = settings.validation_rules || getDefaultValidationRules();
    
    // Get validation statistics
    const stats = getValidationStats(db, user.cooperativeId);

    return NextResponse.json({
      success: true,
      data: {
        cooperative_id: cooperative.id,
        cooperative_name: cooperative.name,
        validation_rules: validationRules,
        features: features,
        statistics: stats,
        default_categories: getDefaultCategories(),
        supported_extensions: getSupportedExtensions(),
        supported_mime_types: getSupportedMimeTypes()
      }
    });

  } catch (error) {
    console.error('Get validation configuration error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'GET_VALIDATION_CONFIG_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/upload/validation - Update validation configuration
 */
export async function PUT(request: NextRequest) {
  try {
    // Authentication (requires admin permissions)
    const authResult = await requireAuth(request, {
      permissions: ['canManageSettings'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.INSUFFICIENT_PERMISSIONS,
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    const { user } = authResult;
    const body = await request.json();
    
    // Validate request body
    const validationResult = ValidationConfigSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        {
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: errors,
          code: 'VALIDATION_CONFIG_INVALID'
        },
        { status: 400 }
      );
    }

    const newRules = validationResult.data;
    const db = getDatabase();

    // Get current settings
    const cooperative = db.prepare(`
      SELECT settings, features FROM cooperatives WHERE id = ?
    `).get(user.cooperativeId) as any;

    if (!cooperative) {
      return NextResponse.json(
        {
          error: 'Kooperativ hittades inte',
          code: 'COOPERATIVE_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const currentSettings = JSON.parse(cooperative.settings || '{}');
    const updatedSettings = {
      ...currentSettings,
      validation_rules: {
        ...getDefaultValidationRules(),
        ...currentSettings.validation_rules,
        ...newRules,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      }
    };

    // Update cooperative settings
    db.prepare(`
      UPDATE cooperatives 
      SET 
        settings = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(updatedSettings), user.cooperativeId);

    // Log configuration change
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'validation_config_updated',
      event_level: 'info',
      event_source: 'validation_api',
      event_message: 'Validation configuration updated',
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        updated_fields: Object.keys(newRules),
        previous_version: currentSettings.validation_rules?.updated_at || 'initial'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Valideringskonfiguration uppdaterad framgångsrikt',
      data: {
        validation_rules: updatedSettings.validation_rules,
        updated_at: updatedSettings.validation_rules.updated_at
      }
    });

  } catch (error) {
    console.error('Update validation configuration error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'validation_config_update_error',
        event_level: 'error',
        event_source: 'validation_api',
        event_message: 'Failed to update validation configuration',
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'UPDATE_VALIDATION_CONFIG_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload/validation/test - Test validation rules
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request, {
      permissions: ['canUploadDocuments'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.AUTHENTICATION_REQUIRED,
          code: 'AUTHENTICATION_REQUIRED'
        },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const body = await request.json();

    // Validate test file data
    const testFileSchema = z.object({
      filename: z.string().min(1),
      size: z.number().positive(),
      mimeType: z.string().optional(),
      test_rules: ValidationConfigSchema.optional()
    });

    const validationResult = testFileSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: validationResult.error.errors.map(e => e.message),
          code: 'TEST_DATA_INVALID'
        },
        { status: 400 }
      );
    }

    const { filename, size, mimeType, test_rules } = validationResult.data;

    // Import validator dynamically to test
    const { BRFFileValidator } = await import('@/lib/upload/brf-file-validator');
    const validator = new BRFFileValidator(test_rules);

    // Perform validation test
    const testResult = await validator.validateBRFFile(
      { filename, size, mimeType },
      user.cooperativeId,
      test_rules
    );

    // Log test
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'validation_rule_test',
      event_level: 'info',
      event_source: 'validation_api',
      event_message: `Validation rule test for ${filename}`,
      user_id: user.id,
      event_data: {
        filename,
        size,
        mimeType,
        valid: testResult.valid,
        category: testResult.category,
        confidence: testResult.confidence,
        errors: testResult.errors.length,
        warnings: testResult.warnings.length
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        test_file: { filename, size, mimeType },
        validation_result: testResult,
        summary: {
          valid: testResult.valid,
          category: testResult.category,
          confidence: testResult.confidence,
          total_errors: testResult.errors.length,
          total_warnings: testResult.warnings.length
        }
      }
    });

  } catch (error) {
    console.error('Validation rule test error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'VALIDATION_TEST_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * Helper functions
 */
function getDefaultValidationRules(): Partial<BRFValidationRules> {
  return {
    max_file_size_mb: 500,
    allowed_extensions: [
      'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt',
      'xls', 'xlsx', 'ods', 'csv',
      'jpg', 'jpeg', 'png', 'tiff', 'bmp', 'webp',
      'zip', 'rar', '7z'
    ],
    require_virus_scan: true,
    allow_executable_files: false,
    allow_archive_files: true,
    max_archive_depth: 2,
    require_content_validation: true,
    enable_ocr_classification: true,
    enable_content_analysis: true,
    require_swedish_content: false,
    enable_pii_detection: true,
    scan_for_macros: true,
    scan_for_embedded_files: true,
    check_password_protection: true,
    max_embedded_depth: 3
  };
}

function getValidationStats(db: any, cooperativeId: string): any {
  try {
    // This would typically come from a validation logs table
    // For now, return mock stats
    return {
      total_validations_last_30_days: 0,
      successful_validations: 0,
      failed_validations: 0,
      most_common_category: 'general',
      most_common_errors: [],
      average_file_size_mb: 0,
      file_type_distribution: {}
    };
  } catch (error) {
    console.error('Error getting validation stats:', error);
    return null;
  }
}

function getDefaultCategories(): Array<{
  category: BRFDocumentCategory;
  display_name: string;
  description: string;
  typical_extensions: string[];
}> {
  return [
    {
      category: 'invoice',
      display_name: 'Fakturor',
      description: 'Leverantörsfakturor och räkningar',
      typical_extensions: ['pdf', 'jpg', 'jpeg', 'png']
    },
    {
      category: 'protocol',
      display_name: 'Protokoll',
      description: 'Styrelsemöten och föreningsstämmor',
      typical_extensions: ['pdf', 'doc', 'docx']
    },
    {
      category: 'contract',
      display_name: 'Avtal',
      description: 'Avtal och överenskommelser',
      typical_extensions: ['pdf', 'doc', 'docx']
    },
    {
      category: 'financial_report',
      display_name: 'Ekonomiska rapporter',
      description: 'Årsredovisningar, budgetar och bokslut',
      typical_extensions: ['pdf', 'xls', 'xlsx', 'csv']
    },
    {
      category: 'technical_report',
      display_name: 'Tekniska rapporter',
      description: 'Besiktningar och tekniska utredningar',
      typical_extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
    },
    {
      category: 'insurance',
      display_name: 'Försäkring',
      description: 'Försäkringsbrev och skadeanmälningar',
      typical_extensions: ['pdf', 'doc', 'docx']
    },
    {
      category: 'legal',
      display_name: 'Juridiska dokument',
      description: 'Domar, beslut och juridiska utredningar',
      typical_extensions: ['pdf', 'doc', 'docx']
    },
    {
      category: 'maintenance',
      display_name: 'Underhåll',
      description: 'Underhållsrapporter och serviceprotokoll',
      typical_extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
    },
    {
      category: 'energy',
      display_name: 'Energi',
      description: 'Energideklarationer och certifikat',
      typical_extensions: ['pdf', 'doc', 'docx']
    },
    {
      category: 'tenant_related',
      display_name: 'Hyresgästrelaterat',
      description: 'Hyreskontrakt och boenderelaterade dokument',
      typical_extensions: ['pdf', 'doc', 'docx']
    },
    {
      category: 'board_materials',
      display_name: 'Styrelsematerial',
      description: 'Kallelser, dagordningar och underlag',
      typical_extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
    },
    {
      category: 'general',
      display_name: 'Allmänt',
      description: 'Övriga dokument',
      typical_extensions: ['pdf', 'doc', 'docx', 'txt']
    }
  ];
}

function getSupportedExtensions(): string[] {
  return [
    'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt',
    'xls', 'xlsx', 'ods', 'csv',
    'ppt', 'pptx', 'odp',
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp',
    'zip', 'rar', '7z', 'tar', 'gz'
  ];
}

function getSupportedMimeTypes(): string[] {
  return [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/webp',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip'
  ];
}