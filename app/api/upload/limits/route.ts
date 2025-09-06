/**
 * File Size Limits Configuration API
 * Manages configurable file size limits for the BRF Portal upload system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { requireAuth } from '@/lib/auth/middleware';
import { logEvent } from '@/lib/monitoring/events';
import { z } from 'zod';

// Swedish error messages
const SwedishMessages = {
  errors: {
    AUTHENTICATION_REQUIRED: 'Autentisering krävs',
    INSUFFICIENT_PERMISSIONS: 'Otillräckliga behörigheter',
    VALIDATION_FAILED: 'Valideringsfel',
    COOPERATIVE_NOT_FOUND: 'Kooperativ hittades inte',
    CONFIG_NOT_FOUND: 'Konfiguration hittades inte',
    SYSTEM_ERROR: 'Systemfel uppstod'
  },
  success: {
    CONFIG_RETRIEVED: 'Konfiguration hämtad framgångsrikt',
    CONFIG_UPDATED: 'Konfiguration uppdaterad framgångsrikt',
    CONFIG_CREATED: 'Konfiguration skapad framgångsrikt'
  }
};

// Validation schemas
const FileSizeLimitConfigSchema = z.object({
  config_type: z.enum(['global', 'document_type', 'user_override', 'user_specific']),
  config_name: z.string().min(1).max(100),
  max_file_size_bytes: z.number().min(1024).max(10737418240), // 1KB to 10GB
  max_batch_size_bytes: z.number().min(1024).max(53687091200).optional(), // Up to 50GB for batches
  max_daily_size_bytes: z.number().min(1024).optional(),
  max_monthly_size_bytes: z.number().min(1024).optional(),
  
  document_type: z.enum([
    'invoice', 'protocol', 'contract', 'financial_report', 'technical_report',
    'insurance', 'legal', 'maintenance', 'energy', 'tenant_related',
    'board_materials', 'general', 'unknown', 'image', 'video', 'audio'
  ]).optional(),
  document_category: z.string().max(100).optional(),
  user_id: z.string().optional(),
  role_based: z.enum(['board', 'member', 'admin', 'external']).optional(),
  
  allowed_mime_types: z.array(z.string()).optional(),
  blocked_mime_types: z.array(z.string()).optional(),
  allowed_extensions: z.array(z.string()).optional(),
  blocked_extensions: z.array(z.string()).optional(),
  
  auto_compress_enabled: z.boolean().optional(),
  compression_threshold_bytes: z.number().min(1024).optional(),
  compression_quality: z.number().min(1).max(100).optional(),
  suggest_compression_at_bytes: z.number().min(1024).optional(),
  
  priority: z.number().min(1).max(1000).optional(),
  inherits_from: z.string().optional(),
  validation_mode: z.enum(['strict', 'warning', 'log_only']).optional(),
  
  display_name_sv: z.string().max(200).optional(),
  description_sv: z.string().max(500).optional(),
  error_message_sv: z.string().max(300).optional(),
  
  effective_from: z.string().optional(),
  effective_until: z.string().optional()
});

/**
 * GET /api/upload/limits - Get file size limit configurations for cooperative
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
    const url = new URL(request.url);
    
    // Query parameters
    const configType = url.searchParams.get('config_type');
    const documentType = url.searchParams.get('document_type');
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    const userId = url.searchParams.get('user_id');

    // Build query conditions
    let whereClause = 'WHERE cooperative_id = ?';
    const params: any[] = [user.cooperativeId];

    if (configType) {
      whereClause += ' AND config_type = ?';
      params.push(configType);
    }

    if (documentType) {
      whereClause += ' AND document_type = ?';
      params.push(documentType);
    }

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(userId);
    }

    if (!includeInactive) {
      whereClause += ' AND is_active = 1';
      whereClause += ' AND (effective_from IS NULL OR effective_from <= datetime("now"))';
      whereClause += ' AND (effective_until IS NULL OR effective_until > datetime("now"))';
    }

    // Get configurations
    const configs = db.prepare(`
      SELECT 
        id, config_type, config_name, max_file_size_bytes, max_batch_size_bytes,
        max_daily_size_bytes, max_monthly_size_bytes, document_type, document_category,
        user_id, role_based, allowed_mime_types, blocked_mime_types, 
        allowed_extensions, blocked_extensions, auto_compress_enabled,
        compression_threshold_bytes, compression_quality, suggest_compression_at_bytes,
        priority, inherits_from, is_active, validation_mode, display_name_sv,
        description_sv, error_message_sv, created_by, updated_by, approved_by,
        created_at, updated_at, effective_from, effective_until
      FROM file_size_limit_configs 
      ${whereClause}
      ORDER BY priority ASC, created_at DESC
    `).all(...params) as any[];

    // Parse JSON fields
    const parsedConfigs = configs.map(config => ({
      ...config,
      allowed_mime_types: JSON.parse(config.allowed_mime_types || '[]'),
      blocked_mime_types: JSON.parse(config.blocked_mime_types || '[]'),
      allowed_extensions: JSON.parse(config.allowed_extensions || '[]'),
      blocked_extensions: JSON.parse(config.blocked_extensions || '[]'),
      max_file_size_mb: Math.round(config.max_file_size_bytes / 1024 / 1024 * 100) / 100,
      max_batch_size_mb: config.max_batch_size_bytes ? Math.round(config.max_batch_size_bytes / 1024 / 1024 * 100) / 100 : null,
      max_daily_size_mb: config.max_daily_size_bytes ? Math.round(config.max_daily_size_bytes / 1024 / 1024 * 100) / 100 : null,
      max_monthly_size_mb: config.max_monthly_size_bytes ? Math.round(config.max_monthly_size_bytes / 1024 / 1024 * 100) / 100 : null
    }));

    // Get summary statistics
    const stats = getFileSizeLimitStats(db, user.cooperativeId);
    
    // Get available document types and their default limits
    const documentTypes = getDocumentTypeDefaults();

    return NextResponse.json({
      success: true,
      data: {
        cooperative_id: user.cooperativeId,
        configurations: parsedConfigs,
        total_configurations: parsedConfigs.length,
        statistics: stats,
        document_types: documentTypes,
        available_config_types: ['global', 'document_type', 'user_override', 'user_specific'],
        available_validation_modes: ['strict', 'warning', 'log_only']
      },
      message: SwedishMessages.success.CONFIG_RETRIEVED
    });

  } catch (error) {
    console.error('Get file size limits error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'GET_FILE_SIZE_LIMITS_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload/limits - Create new file size limit configuration
 */
export async function POST(request: NextRequest) {
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
    const validationResult = FileSizeLimitConfigSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        {
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: errors,
          code: 'CONFIG_VALIDATION_FAILED'
        },
        { status: 400 }
      );
    }

    const configData = validationResult.data;
    const db = getDatabase();

    // Check for existing configuration with same scope
    const existingConfig = db.prepare(`
      SELECT id FROM file_size_limit_configs 
      WHERE cooperative_id = ? AND config_type = ? AND config_name = ?
      AND (document_type IS NULL OR document_type = ?)
      AND (user_id IS NULL OR user_id = ?)
    `).get(
      user.cooperativeId,
      configData.config_type,
      configData.config_name,
      configData.document_type || null,
      configData.user_id || null
    ) as any;

    if (existingConfig) {
      return NextResponse.json(
        {
          error: 'En konfiguration med samma omfattning finns redan',
          code: 'CONFIG_ALREADY_EXISTS'
        },
        { status: 409 }
      );
    }

    // Insert new configuration
    const configId = `fslc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    db.prepare(`
      INSERT INTO file_size_limit_configs (
        id, cooperative_id, config_type, config_name, max_file_size_bytes,
        max_batch_size_bytes, max_daily_size_bytes, max_monthly_size_bytes,
        document_type, document_category, user_id, role_based,
        allowed_mime_types, blocked_mime_types, allowed_extensions, blocked_extensions,
        auto_compress_enabled, compression_threshold_bytes, compression_quality,
        suggest_compression_at_bytes, priority, inherits_from, validation_mode,
        display_name_sv, description_sv, error_message_sv, created_by,
        effective_from, effective_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      configId, user.cooperativeId, configData.config_type, configData.config_name,
      configData.max_file_size_bytes, configData.max_batch_size_bytes,
      configData.max_daily_size_bytes, configData.max_monthly_size_bytes,
      configData.document_type, configData.document_category, configData.user_id,
      configData.role_based, JSON.stringify(configData.allowed_mime_types || []),
      JSON.stringify(configData.blocked_mime_types || []),
      JSON.stringify(configData.allowed_extensions || []),
      JSON.stringify(configData.blocked_extensions || []),
      configData.auto_compress_enabled ? 1 : 0, configData.compression_threshold_bytes,
      configData.compression_quality, configData.suggest_compression_at_bytes,
      configData.priority || 100, configData.inherits_from,
      configData.validation_mode || 'strict', configData.display_name_sv,
      configData.description_sv, configData.error_message_sv, user.id,
      configData.effective_from, configData.effective_until
    );

    // Log configuration creation
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'file_size_limit_config_created',
      event_level: 'info',
      event_source: 'file_size_limits_api',
      event_message: `File size limit configuration created: ${configData.config_name}`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        config_id: configId,
        config_type: configData.config_type,
        config_name: configData.config_name,
        max_file_size_mb: Math.round(configData.max_file_size_bytes / 1024 / 1024 * 100) / 100,
        document_type: configData.document_type,
        user_id: configData.user_id
      }
    });

    // Get the created configuration
    const createdConfig = db.prepare(`
      SELECT * FROM file_size_limit_configs WHERE id = ?
    `).get(configId) as any;

    return NextResponse.json({
      success: true,
      data: {
        ...createdConfig,
        allowed_mime_types: JSON.parse(createdConfig.allowed_mime_types || '[]'),
        blocked_mime_types: JSON.parse(createdConfig.blocked_mime_types || '[]'),
        allowed_extensions: JSON.parse(createdConfig.allowed_extensions || '[]'),
        blocked_extensions: JSON.parse(createdConfig.blocked_extensions || '[]'),
        max_file_size_mb: Math.round(createdConfig.max_file_size_bytes / 1024 / 1024 * 100) / 100
      },
      message: SwedishMessages.success.CONFIG_CREATED
    });

  } catch (error) {
    console.error('Create file size limit config error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'CREATE_FILE_SIZE_LIMIT_CONFIG_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * Helper functions
 */
function getFileSizeLimitStats(db: any, cooperativeId: string): any {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_configs,
        COUNT(CASE WHEN config_type = 'global' THEN 1 END) as global_configs,
        COUNT(CASE WHEN config_type = 'document_type' THEN 1 END) as document_type_configs,
        COUNT(CASE WHEN config_type = 'user_specific' THEN 1 END) as user_specific_configs,
        COUNT(CASE WHEN config_type = 'user_override' THEN 1 END) as user_override_configs,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_configs,
        COUNT(CASE WHEN auto_compress_enabled = 1 THEN 1 END) as compression_enabled_configs,
        AVG(max_file_size_bytes) as avg_max_file_size_bytes,
        MAX(max_file_size_bytes) as largest_file_size_limit_bytes,
        MIN(max_file_size_bytes) as smallest_file_size_limit_bytes
      FROM file_size_limit_configs 
      WHERE cooperative_id = ?
    `).get(cooperativeId) as any;

    return {
      ...stats,
      avg_max_file_size_mb: stats.avg_max_file_size_bytes ? Math.round(stats.avg_max_file_size_bytes / 1024 / 1024 * 100) / 100 : 0,
      largest_file_size_limit_mb: stats.largest_file_size_limit_bytes ? Math.round(stats.largest_file_size_limit_bytes / 1024 / 1024 * 100) / 100 : 0,
      smallest_file_size_limit_mb: stats.smallest_file_size_limit_bytes ? Math.round(stats.smallest_file_size_limit_bytes / 1024 / 1024 * 100) / 100 : 0
    };
  } catch (error) {
    console.error('Error getting file size limit stats:', error);
    return {};
  }
}

function getDocumentTypeDefaults(): Array<{
  type: string;
  display_name_sv: string;
  description_sv: string;
  default_size_mb: number;
  default_size_bytes: number;
  typical_extensions: string[];
}> {
  return [
    {
      type: 'invoice',
      display_name_sv: 'Fakturor',
      description_sv: 'Leverantörsfakturor och räkningar',
      default_size_mb: 50,
      default_size_bytes: 52428800,
      typical_extensions: ['pdf', 'jpg', 'jpeg', 'png']
    },
    {
      type: 'protocol',
      display_name_sv: 'Protokoll',
      description_sv: 'Styrelsemöten och föreningsstämmor',
      default_size_mb: 100,
      default_size_bytes: 104857600,
      typical_extensions: ['pdf', 'doc', 'docx']
    },
    {
      type: 'contract',
      display_name_sv: 'Avtal',
      description_sv: 'Avtal och överenskommelser',
      default_size_mb: 100,
      default_size_bytes: 104857600,
      typical_extensions: ['pdf', 'doc', 'docx']
    },
    {
      type: 'financial_report',
      display_name_sv: 'Ekonomiska rapporter',
      description_sv: 'Årsredovisningar, budgetar och bokslut',
      default_size_mb: 200,
      default_size_bytes: 209715200,
      typical_extensions: ['pdf', 'xls', 'xlsx', 'csv']
    },
    {
      type: 'technical_report',
      display_name_sv: 'Tekniska rapporter',
      description_sv: 'Besiktningar och tekniska utredningar',
      default_size_mb: 300,
      default_size_bytes: 314572800,
      typical_extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
    },
    {
      type: 'image',
      display_name_sv: 'Bilder',
      description_sv: 'Foton och bildmaterial',
      default_size_mb: 100,
      default_size_bytes: 104857600,
      typical_extensions: ['jpg', 'jpeg', 'png', 'tiff', 'bmp', 'webp']
    },
    {
      type: 'video',
      display_name_sv: 'Video',
      description_sv: 'Videofilmer och inspelningar',
      default_size_mb: 1000,
      default_size_bytes: 1073741824,
      typical_extensions: ['mp4', 'avi', 'mov', 'wmv', 'mkv']
    },
    {
      type: 'audio',
      display_name_sv: 'Ljud',
      description_sv: 'Ljudfiler och inspelningar',
      default_size_mb: 200,
      default_size_bytes: 209715200,
      typical_extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg']
    }
  ];
}