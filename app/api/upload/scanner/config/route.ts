/**
 * Scanner Configuration Management API
 * Handles scanner configuration presets and settings for BRF Portal
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { ScannerMessages, DEFAULT_SCAN_SETTINGS, BRFDocumentType } from '@/lib/scanner/types';
import { logEvent } from '@/lib/monitoring/events';
import { z } from 'zod';

// Mock configuration storage (in real implementation, this would be in database)
const scannerConfigurations = new Map<string, any>();

// Validation schemas
const CreateConfigSchema = z.object({
  name: z.string().min(1).max(100),
  scanner_id: z.string().min(1),
  is_default: z.boolean().optional(),
  settings: z.object({
    resolution: z.number().min(150).max(1200).optional(),
    color_mode: z.enum(['color', 'grayscale', 'monochrome']).optional(),
    format: z.enum(['pdf', 'jpg', 'png', 'tiff']).optional(),
    duplex: z.boolean().optional(),
    auto_crop: z.boolean().optional(),
    blank_page_removal: z.boolean().optional(),
    document_separation: z.boolean().optional(),
    multi_page_pdf: z.boolean().optional(),
    compression_level: z.number().min(1).max(100).optional(),
    document_type: z.enum(['faktura', 'protokoll', 'avtal', 'underhall', 'ekonomi', 'forsaking', 'juridisk', 'styrelse', 'medlemmar', 'leverantor', 'ovrigt']).optional(),
    custom_filename: z.string().max(100).optional(),
  }),
  permissions: z.object({
    allowed_users: z.array(z.string()).optional(),
    allowed_roles: z.array(z.string()).optional(),
    restricted_hours: z.array(z.object({
      start_time: z.string().regex(/^\d{2}:\d{2}$/),
      end_time: z.string().regex(/^\d{2}:\d{2}$/),
      days_of_week: z.array(z.number().min(0).max(6)),
    })).optional(),
    max_daily_scans: z.number().min(1).optional(),
    max_scan_pages: z.number().min(1).optional(),
    document_types: z.array(z.enum(['faktura', 'protokoll', 'avtal', 'underhall', 'ekonomi', 'forsaking', 'juridisk', 'styrelse', 'medlemmar', 'leverantor', 'ovrigt'])).optional(),
  }).optional(),
});

const UpdateConfigSchema = CreateConfigSchema.partial().omit(['scanner_id']);

/**
 * GET /api/upload/scanner/config - List scanner configurations
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request, {
      permissions: ['canViewDocuments'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        { 
          error: ScannerMessages.errors.AUTHENTICATION_FAILED,
          code: 'AUTHENTICATION_REQUIRED' 
        },
        { status: 401 }
      );
    }

    const { user } = authResult;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const scannerId = searchParams.get('scanner_id');
    const includeDefaults = searchParams.get('include_defaults') === 'true';

    // Get configurations for the cooperative
    const configs = Array.from(scannerConfigurations.values())
      .filter(config => config.cooperative_id === user.cooperativeId)
      .filter(config => !scannerId || config.scanner_id === scannerId);

    // Add default configurations if requested
    let defaultConfigs: any[] = [];
    if (includeDefaults) {
      defaultConfigs = generateDefaultConfigurations();
    }

    // Format configurations with Swedish labels
    const formattedConfigs = [...configs, ...defaultConfigs].map(config => ({
      id: config.id,
      name: config.name,
      scanner_id: config.scanner_id,
      is_default: config.is_default,
      is_system_default: config.is_system_default || false,
      settings: {
        ...config.settings,
        document_type_text: config.settings.document_type 
          ? ScannerMessages.documentTypes[config.settings.document_type as keyof typeof ScannerMessages.documentTypes]
          : undefined,
      },
      permissions: config.permissions,
      created_by: config.created_by,
      created_at: config.created_at,
      updated_at: config.updated_at,
    }));

    // Group by scanner for easier management
    const groupedConfigs = formattedConfigs.reduce((acc, config) => {
      if (!acc[config.scanner_id]) {
        acc[config.scanner_id] = [];
      }
      acc[config.scanner_id].push(config);
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      success: true,
      data: {
        configurations: formattedConfigs,
        grouped_by_scanner: groupedConfigs,
        summary: {
          total_configurations: formattedConfigs.length,
          custom_configurations: configs.length,
          default_configurations: defaultConfigs.length,
          scanners_with_configs: Object.keys(groupedConfigs).length,
        },
      },
    });

  } catch (error) {
    console.error('Scanner config list error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : ScannerMessages.errors.NETWORK_ERROR,
        code: 'CONFIG_LIST_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload/scanner/config - Create scanner configuration
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
          error: ScannerMessages.errors.AUTHENTICATION_FAILED,
          code: 'AUTHENTICATION_REQUIRED' 
        },
        { status: 401 }
      );
    }

    const { user } = authResult;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateConfigSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: ScannerMessages.errors.INVALID_SETTINGS,
          details: validationResult.error.errors,
          code: 'VALIDATION_FAILED' 
        },
        { status: 400 }
      );
    }

    const { name, scanner_id, is_default, settings, permissions } = validationResult.data;

    // Create configuration
    const configId = `config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const configuration = {
      id: configId,
      cooperative_id: user.cooperativeId,
      scanner_id,
      name,
      is_default: is_default || false,
      settings: {
        ...DEFAULT_SCAN_SETTINGS,
        ...settings,
      },
      permissions: permissions || {
        allowed_roles: ['medlem', 'styrelse', 'ekonomi'],
        max_daily_scans: 50,
        max_scan_pages: 100,
      },
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If this is set as default, unset other defaults for the same scanner
    if (configuration.is_default) {
      Array.from(scannerConfigurations.values())
        .filter(c => c.cooperative_id === user.cooperativeId && c.scanner_id === scanner_id && c.is_default)
        .forEach(c => { c.is_default = false; });
    }

    scannerConfigurations.set(configId, configuration);

    // Log configuration creation
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'scanner_config_created',
      event_level: 'info',
      event_source: 'scanner_api',
      event_message: `Scanner configuration created`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        config_id: configId,
        config_name: name,
        scanner_id: scanner_id,
        is_default: is_default,
        settings: settings,
        endpoint: '/api/upload/scanner/config',
        method: 'POST',
      },
    });

    return NextResponse.json({
      success: true,
      message: ScannerMessages.success.SCANNER_CONFIGURED,
      data: {
        configuration: {
          id: configuration.id,
          name: configuration.name,
          scanner_id: configuration.scanner_id,
          is_default: configuration.is_default,
          settings: {
            ...configuration.settings,
            document_type_text: configuration.settings.document_type 
              ? ScannerMessages.documentTypes[configuration.settings.document_type as keyof typeof ScannerMessages.documentTypes]
              : undefined,
          },
          permissions: configuration.permissions,
          created_at: configuration.created_at,
        },
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Scanner config creation error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'scanner_config_creation_error',
        event_level: 'error',
        event_source: 'scanner_api',
        event_message: `Scanner configuration creation failed`,
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          endpoint: '/api/upload/scanner/config',
          method: 'POST',
          error: error instanceof Error ? error.stack : error,
        },
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : ScannerMessages.errors.NETWORK_ERROR,
        code: 'CONFIG_CREATION_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate default scanner configurations for common BRF use cases
 */
function generateDefaultConfigurations() {
  return [
    {
      id: 'default-invoice-scanning',
      name: 'Standard Fakturaскanning',
      scanner_id: 'any',
      is_default: false,
      is_system_default: true,
      settings: {
        resolution: 300,
        color_mode: 'color',
        format: 'pdf',
        duplex: true,
        auto_crop: true,
        blank_page_removal: true,
        document_separation: false,
        multi_page_pdf: true,
        compression_level: 80,
        document_type: 'faktura' as BRFDocumentType,
      },
      permissions: {
        allowed_roles: ['ekonomi', 'styrelse'],
        max_daily_scans: 100,
        max_scan_pages: 200,
        document_types: ['faktura'] as BRFDocumentType[],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'default-protocol-scanning',
      name: 'Standard Protokollskanning',
      scanner_id: 'any',
      is_default: false,
      is_system_default: true,
      settings: {
        resolution: 300,
        color_mode: 'grayscale',
        format: 'pdf',
        duplex: true,
        auto_crop: true,
        blank_page_removal: true,
        document_separation: true,
        multi_page_pdf: true,
        compression_level: 70,
        document_type: 'protokoll' as BRFDocumentType,
      },
      permissions: {
        allowed_roles: ['styrelse', 'sekreterare'],
        max_daily_scans: 20,
        max_scan_pages: 50,
        document_types: ['protokoll'] as BRFDocumentType[],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'default-contract-scanning',
      name: 'Standard Avtalsскanning',
      scanner_id: 'any',
      is_default: false,
      is_system_default: true,
      settings: {
        resolution: 400,
        color_mode: 'color',
        format: 'pdf',
        duplex: true,
        auto_crop: true,
        blank_page_removal: false,
        document_separation: false,
        multi_page_pdf: true,
        compression_level: 90,
        document_type: 'avtal' as BRFDocumentType,
      },
      permissions: {
        allowed_roles: ['styrelse', 'forvaltare'],
        max_daily_scans: 10,
        max_scan_pages: 30,
        document_types: ['avtal', 'juridisk'] as BRFDocumentType[],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'default-maintenance-scanning',
      name: 'Standard Underhållsskanning',
      scanner_id: 'any',
      is_default: false,
      is_system_default: true,
      settings: {
        resolution: 300,
        color_mode: 'color',
        format: 'jpg',
        duplex: false,
        auto_crop: true,
        blank_page_removal: true,
        document_separation: true,
        multi_page_pdf: false,
        compression_level: 85,
        document_type: 'underhall' as BRFDocumentType,
      },
      permissions: {
        allowed_roles: ['medlem', 'styrelse', 'fastighetsskotare'],
        max_daily_scans: 50,
        max_scan_pages: 100,
        document_types: ['underhall'] as BRFDocumentType[],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}