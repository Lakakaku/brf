/**
 * Scanner Scan Job Management API
 * Handles scanning job creation, monitoring, and control for BRF Portal
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { mockScannerService } from '@/lib/scanner/mock-service';
import { ScannerMessages, BRFDocumentType, DEFAULT_SCAN_SETTINGS } from '@/lib/scanner/types';
import { logEvent } from '@/lib/monitoring/events';
import { z } from 'zod';

// Validation schemas
const StartScanSchema = z.object({
  scanner_id: z.string().min(1),
  batch_id: z.string().optional(),
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
  }).optional(),
});

const ScanJobQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
  status: z.enum(['queued', 'scanning', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  scanner_id: z.string().optional(),
});

/**
 * POST /api/upload/scanner/scan - Start a new scanning job
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
    const validationResult = StartScanSchema.safeParse(body);

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

    const { scanner_id, batch_id, settings } = validationResult.data;

    // Get scanner details and verify access
    const scanner = await mockScannerService.getScanner(scanner_id);
    if (!scanner) {
      return NextResponse.json(
        { 
          error: ScannerMessages.errors.SCANNER_NOT_FOUND,
          code: 'SCANNER_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    // Check if user has access to this scanner's cooperative
    if (scanner.cooperative_id !== user.cooperativeId && !scanner.cooperative_id.startsWith('mock-coop')) {
      return NextResponse.json(
        { 
          error: ScannerMessages.errors.PERMISSION_DENIED,
          code: 'PERMISSION_DENIED' 
        },
        { status: 403 }
      );
    }

    // Check scanner status
    if (scanner.status !== 'online') {
      const errorMessage = scanner.status === 'scanning' 
        ? ScannerMessages.errors.SCANNER_BUSY
        : scanner.status === 'offline'
          ? ScannerMessages.errors.SCANNER_OFFLINE
          : ScannerMessages.errors.SCAN_FAILED;

      return NextResponse.json(
        { 
          error: errorMessage,
          code: 'SCANNER_UNAVAILABLE',
          data: {
            scanner_status: scanner.status,
            scanner_name: scanner.name,
          }
        },
        { status: 409 }
      );
    }

    // Merge settings with defaults
    const scanSettings = {
      ...DEFAULT_SCAN_SETTINGS,
      ...settings,
    };

    // Validate settings against scanner capabilities
    const validationErrors = validateScanSettings(scanSettings, scanner.capabilities);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: ScannerMessages.errors.INVALID_SETTINGS,
          details: validationErrors,
          code: 'INCOMPATIBLE_SETTINGS' 
        },
        { status: 400 }
      );
    }

    // Start scanning job
    const scanJob = await mockScannerService.startScan(
      scanner_id,
      user.id,
      user.cooperativeId,
      scanSettings,
      batch_id
    );

    // Log scan job creation
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'scan_job_started',
      event_level: 'info',
      event_source: 'scanner_api',
      event_message: `Scanning job started`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        scan_job_id: scanJob.id,
        scanner_id: scanner_id,
        scanner_name: scanner.name,
        batch_id: batch_id,
        settings: scanSettings,
        estimated_pages: scanJob.pages_total,
        endpoint: '/api/upload/scanner/scan',
        method: 'POST',
      },
    });

    return NextResponse.json({
      success: true,
      message: ScannerMessages.success.SCAN_STARTED,
      data: {
        scan_job: {
          id: scanJob.id,
          status: scanJob.status,
          status_text: ScannerMessages.jobStatus[scanJob.status.toUpperCase() as keyof typeof ScannerMessages.jobStatus],
          scanner: {
            id: scanner.id,
            name: scanner.name,
            model: scanner.model,
          },
          settings: scanJob.settings,
          progress: {
            pages_scanned: scanJob.pages_scanned,
            pages_total: scanJob.pages_total,
            percentage: scanJob.progress_percentage,
          },
          created_at: scanJob.created_at,
          started_at: scanJob.started_at,
          estimated_completion: scanJob.estimated_completion,
        },
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Scan job creation error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'scan_job_creation_error',
        event_level: 'error',
        event_source: 'scanner_api',
        event_message: `Scan job creation failed`,
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          endpoint: '/api/upload/scanner/scan',
          method: 'POST',
          error: error instanceof Error ? error.stack : error,
        },
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : ScannerMessages.errors.SCAN_FAILED,
        code: 'SCAN_JOB_CREATION_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload/scanner/scan - List scan jobs for the cooperative
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

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      status: searchParams.get('status'),
      scanner_id: searchParams.get('scanner_id'),
    };

    const validationResult = ScanJobQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Ogiltiga sökparametrar',
          details: validationResult.error.errors,
          code: 'INVALID_QUERY_PARAMS' 
        },
        { status: 400 }
      );
    }

    const { limit = 10, offset = 0, status, scanner_id } = validationResult.data;

    // Get scan jobs for the cooperative
    let scanJobs = await mockScannerService.getScanJobs(user.cooperativeId, limit + 10, offset);

    // Apply additional filters
    if (status) {
      scanJobs = scanJobs.filter(job => job.status === status);
    }
    if (scanner_id) {
      scanJobs = scanJobs.filter(job => job.scanner_id === scanner_id);
    }

    // Limit results
    scanJobs = scanJobs.slice(0, limit);

    // Get scanner details for each job
    const enrichedJobs = await Promise.all(
      scanJobs.map(async (job) => {
        const scanner = await mockScannerService.getScanner(job.scanner_id);
        return {
          id: job.id,
          status: job.status,
          status_text: ScannerMessages.jobStatus[job.status.toUpperCase() as keyof typeof ScannerMessages.jobStatus],
          scanner: scanner ? {
            id: scanner.id,
            name: scanner.name,
            model: scanner.model,
            brand: scanner.brand,
          } : null,
          settings: {
            resolution: job.settings.resolution,
            color_mode: job.settings.color_mode,
            format: job.settings.format,
            document_type: job.settings.document_type,
            document_type_text: job.settings.document_type 
              ? ScannerMessages.documentTypes[job.settings.document_type as keyof typeof ScannerMessages.documentTypes]
              : undefined,
          },
          progress: {
            pages_scanned: job.pages_scanned,
            pages_total: job.pages_total,
            percentage: job.progress_percentage,
          },
          files_created: job.files_created.length,
          batch_id: job.batch_id,
          created_at: job.created_at,
          started_at: job.started_at,
          completed_at: job.completed_at,
          error_message: job.error_message,
        };
      })
    );

    // Calculate summary statistics
    const statusCounts = scanJobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: {
        scan_jobs: enrichedJobs,
        pagination: {
          limit,
          offset,
          total: enrichedJobs.length,
          has_more: enrichedJobs.length === limit,
        },
        summary: {
          total_jobs: scanJobs.length,
          active_jobs: (statusCounts.queued || 0) + (statusCounts.scanning || 0) + (statusCounts.processing || 0),
          completed_jobs: statusCounts.completed || 0,
          failed_jobs: statusCounts.failed || 0,
          cancelled_jobs: statusCounts.cancelled || 0,
        },
        filters: {
          status,
          scanner_id,
        },
      },
    });

  } catch (error) {
    console.error('Scan jobs list error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : ScannerMessages.errors.NETWORK_ERROR,
        code: 'SCAN_JOBS_LIST_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * Validate scan settings against scanner capabilities
 */
function validateScanSettings(settings: any, capabilities: any): string[] {
  const errors: string[] = [];

  // Check resolution
  if (settings.resolution > capabilities.max_dpi) {
    errors.push(`Upplösning ${settings.resolution} DPI överskrider skannerns max ${capabilities.max_dpi} DPI`);
  }

  // Check color mode
  if (settings.color_mode === 'color' && !capabilities.color) {
    errors.push('Skannern stöder inte färgskanningar');
  }

  // Check format support
  if (!capabilities.supported_formats.includes(settings.format)) {
    errors.push(`Format ${settings.format} stöds inte av skannern`);
  }

  // Check duplex
  if (settings.duplex && !capabilities.duplex) {
    errors.push('Skannern stöder inte dubbelsidig skanning');
  }

  // Check OCR-related features
  if (settings.document_type && !capabilities.ocr_supported) {
    errors.push('Skannern stöder inte automatisk dokumenttypigenkänning');
  }

  return errors;
}