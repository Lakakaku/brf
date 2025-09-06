/**
 * Bulk Upload Batch Management API
 * Handles batch creation, management, and status endpoints for the BRF Portal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { requireAuth } from '@/lib/auth/middleware';
import { BulkUploadSystem } from '@/lib/upload';
import { SwedishMessages, MessageFormatter } from '@/lib/upload/messages';
import { validateBatchFiles } from '@/lib/upload/validation-middleware';
import { logEvent } from '@/lib/monitoring/events';
import { z } from 'zod';

// Initialize bulk upload system
let bulkUploadSystem: BulkUploadSystem;

function getBulkUploadSystem() {
  if (!bulkUploadSystem) {
    const db = getDatabase();
    bulkUploadSystem = new BulkUploadSystem({ database: db });
  }
  return bulkUploadSystem;
}

// Validation schemas
const CreateBatchSchema = z.object({
  batch_name: z.string().min(1).max(100).optional(),
  batch_description: z.string().max(500).optional(),
  files: z.array(z.object({
    filename: z.string().min(1).max(255),
    size: z.number().positive().max(100 * 1024 * 1024), // 100MB max per file
    mimeType: z.string().optional(),
    contentType: z.string().optional(),
    tempPath: z.string().optional(),
  })).min(1).max(500), // 1-500 files per batch
  options: z.object({
    processing_mode: z.enum(['parallel', 'sequential']).optional(),
    duplicate_handling: z.enum(['skip', 'overwrite', 'rename', 'fail']).optional(),
    virus_scan_enabled: z.boolean().optional(),
    auto_start: z.boolean().optional(),
    priority: z.number().min(1).max(10).optional(),
    webhook_url: z.string().url().optional(),
  }).optional(),
});

/**
 * POST /api/upload/batch - Create a new bulk upload batch
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication and authorization
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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateBatchSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: errors,
          code: 'VALIDATION_FAILED' 
        },
        { status: 400 }
      );
    }

    const { batch_name, batch_description, files, options } = validationResult.data;

    // Get cooperative validation settings
    const db = getDatabase();
    const cooperative = db.prepare(`
      SELECT settings FROM cooperatives WHERE id = ?
    `).get(user.cooperativeId) as any;
    
    const cooperativeSettings = JSON.parse(cooperative?.settings || '{}');
    const validationRules = cooperativeSettings.validation_rules;

    // Validate files using BRF validation system
    const fileValidationResult = await validateBatchFiles(files, {
      cooperativeId: user.cooperativeId,
      userId: user.id,
      customRules: validationRules,
      logValidation: true
    });

    if (!fileValidationResult.success || !fileValidationResult.data) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: fileValidationResult.error || 'Filvalidering misslyckades',
          code: 'FILE_VALIDATION_FAILED'
        },
        { status: 400 }
      );
    }

    // Check for invalid files
    if (fileValidationResult.data.invalidFiles.length > 0) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: 'En eller flera filer misslyckades med validering',
          code: 'SOME_FILES_INVALID',
          data: {
            valid_files: fileValidationResult.data.validFiles.length,
            invalid_files: fileValidationResult.data.invalidFiles,
            validation_summary: fileValidationResult.data.summary
          }
        },
        { status: 400 }
      );
    }

    // All files are valid, proceed with batch creation
    const validatedFiles = fileValidationResult.data.validFiles.map(vf => ({
      filename: vf.filename,
      size: vf.size,
      mimeType: vf.mimeType,
      contentType: vf.contentType,
      tempPath: vf.tempPath,
      // Add validation metadata
      category: vf.validation.category,
      confidence: vf.validation.confidence,
      requires_manual_review: vf.validation.metadata.requires_manual_review,
      estimated_processing_time: vf.validation.metadata.estimated_processing_time_seconds
    }));

    // Get bulk upload system
    const system = getBulkUploadSystem();

    // Create batch with validated files
    const result = await system.createBatch({
      cooperative_id: user.cooperativeId,
      batch_name,
      batch_description,
      uploaded_by: user.id,
      files: validatedFiles,
      options,
      validation_summary: fileValidationResult.data.summary
    });

    // Log successful batch creation
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'api_request_success',
      event_level: 'info',
      event_source: 'bulk_upload_api',
      event_message: `Bulk upload batch created via API`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        batch_id: result.batch_id,
        batch_number: result.batch_number,
        total_files: result.total_files,
        endpoint: '/api/upload/batch',
        method: 'POST',
      },
    });

    // Format response with Swedish messages
    return NextResponse.json({
      success: true,
      message: SwedishMessages.success.BATCH_CREATED,
      data: {
        batch_id: result.batch_id,
        batch_number: result.batch_number,
        total_files: result.total_files,
        total_size: MessageFormatter.formatFileSize(files.reduce((sum, f) => sum + f.size, 0)),
        estimated_completion_time: result.estimated_completion_time,
        status: SwedishMessages.status.PENDING,
      },
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    }, { status: 201 });

  } catch (error) {
    console.error('Bulk upload batch creation error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'api_request_error',
        event_level: 'error',
        event_source: 'bulk_upload_api',
        event_message: `Bulk upload batch creation failed via API`,
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          endpoint: '/api/upload/batch',
          method: 'POST',
          error: error instanceof Error ? error.stack : error,
        },
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'BATCH_CREATION_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload/batch - List batches for the authenticated user's cooperative
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
          error: SwedishMessages.errors.AUTHENTICATION_REQUIRED,
          code: 'AUTHENTICATION_REQUIRED' 
        },
        { status: 401 }
      );
    }

    const { user } = authResult;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    // Get bulk upload system
    const system = getBulkUploadSystem();

    // List batches
    const batches = system.listBatches(user.cooperativeId, {
      status,
      limit,
      offset,
    });

    // Get system stats
    const stats = system.getSystemStats(user.cooperativeId);

    // Format batches with Swedish messages
    const formattedBatches = batches.map(batch => ({
      batch_id: batch.id,
      batch_number: batch.batch_number,
      batch_name: batch.batch_name,
      status: SwedishMessages.status[batch.status.toUpperCase() as keyof typeof SwedishMessages.status] || batch.status,
      progress_percentage: batch.progress_percentage,
      total_files: batch.total_files,
      files_completed: batch.files_completed,
      files_failed: batch.files_failed,
      total_size: MessageFormatter.formatFileSize(batch.total_size_bytes),
      summary: MessageFormatter.formatBatchSummary({
        total_files: batch.total_files,
        files_completed: batch.files_completed,
        files_failed: batch.files_failed,
        total_size_bytes: batch.total_size_bytes,
      }),
      created_at: batch.created_at,
      started_at: batch.started_at,
      completed_at: batch.completed_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        batches: formattedBatches,
        pagination: {
          limit,
          offset,
          total: stats.total_batches,
          has_more: (offset + limit) < stats.total_batches,
        },
        stats: {
          total_batches: stats.total_batches,
          active_batches: stats.active_batches,
          completed_batches: stats.completed_batches,
          failed_batches: stats.failed_batches,
          total_files: stats.total_files,
          active_workers: stats.active_workers,
          queue_depth: stats.queue_depth,
        },
      },
    });

  } catch (error) {
    console.error('Batch list error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'BATCH_LIST_FAILED'
      },
      { status: 500 }
    );
  }
}