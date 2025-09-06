/**
 * Individual Batch Management API
 * Handles operations on specific bulk upload batches
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { requireAuth } from '@/lib/auth/middleware';
import { BulkUploadSystem } from '@/lib/upload';
import { SwedishMessages, MessageFormatter } from '@/lib/upload/messages';
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

interface RouteParams {
  batchId: string;
}

/**
 * GET /api/upload/batch/[batchId] - Get detailed batch information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { batchId } = params;

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

    // Get bulk upload system
    const system = getBulkUploadSystem();

    // Get batch details
    const batchDetails = system.getBatchDetails(batchId);
    
    if (!batchDetails) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.BATCH_NOT_FOUND,
          code: 'BATCH_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    const { batch, files, progress } = batchDetails;

    // Verify user has access to this batch
    if (batch.cooperative_id !== user.cooperativeId) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.ACCESS_DENIED,
          code: 'ACCESS_DENIED' 
        },
        { status: 403 }
      );
    }

    // Format files with Swedish messages
    const formattedFiles = files.map(file => ({
      file_id: file.id,
      filename: file.original_filename,
      file_size: MessageFormatter.formatFileSize(file.file_size_bytes),
      file_type: MessageFormatter.getFileTypeDisplayName(file.file_extension || ''),
      upload_status: SwedishMessages.status[file.upload_status.toUpperCase() as keyof typeof SwedishMessages.status] || file.upload_status,
      processing_status: SwedishMessages.status[file.processing_status.toUpperCase() as keyof typeof SwedishMessages.status] || file.processing_status,
      validation_status: SwedishMessages.status[file.validation_status.toUpperCase() as keyof typeof SwedishMessages.status] || file.validation_status,
      upload_progress_percentage: file.upload_progress_percentage,
      is_duplicate: file.is_duplicate,
      requires_manual_review: file.requires_manual_review,
      approval_status: SwedishMessages.status[file.approval_status.toUpperCase() as keyof typeof SwedishMessages.status] || file.approval_status,
      document_id: file.document_id,
      processing_order: file.processing_order,
      error_message: file.last_error_message,
      created_at: file.created_at,
      updated_at: file.updated_at,
    }));

    // Format batch info
    const formattedBatch = {
      batch_id: batch.id,
      batch_number: batch.batch_number,
      batch_name: batch.batch_name,
      batch_description: batch.batch_description,
      status: SwedishMessages.status[batch.status.toUpperCase() as keyof typeof SwedishMessages.status] || batch.status,
      progress_percentage: batch.progress_percentage,
      total_files: batch.total_files,
      files_uploaded: batch.files_uploaded,
      files_processed: batch.files_processed,
      files_completed: batch.files_completed,
      files_failed: batch.files_failed,
      files_skipped: batch.files_skipped,
      total_size: MessageFormatter.formatFileSize(batch.total_size_bytes),
      uploaded_size: MessageFormatter.formatFileSize(batch.uploaded_size_bytes),
      processed_size: MessageFormatter.formatFileSize(batch.processed_size_bytes),
      processing_mode: batch.processing_mode,
      concurrent_uploads: batch.concurrent_uploads,
      virus_scan_enabled: batch.virus_scan_enabled,
      duplicate_handling: batch.duplicate_handling,
      upload_source: batch.upload_source,
      created_at: batch.created_at,
      started_at: batch.started_at,
      completed_at: batch.completed_at,
      estimated_completion_time: progress?.estimated_completion_time,
    };

    return NextResponse.json({
      success: true,
      data: {
        batch: formattedBatch,
        files: formattedFiles,
        progress: progress ? {
          status_message: SwedishMessages.progress[batch.status.toUpperCase() as keyof typeof SwedishMessages.progress] || batch.status,
          progress_text: MessageFormatter.formatProgress(
            batch.files_completed,
            batch.total_files,
            progress.current_file
          ),
          summary: MessageFormatter.formatBatchSummary({
            total_files: batch.total_files,
            files_completed: batch.files_completed,
            files_failed: batch.files_failed,
            total_size_bytes: batch.total_size_bytes,
          }),
          estimated_completion: progress.estimated_completion_time ? 
            MessageFormatter.formatEstimatedCompletion(
              Math.floor((new Date(progress.estimated_completion_time).getTime() - Date.now()) / 1000)
            ) : undefined,
          errors: progress.errors,
          warnings: progress.warnings,
        } : null,
      },
    });

  } catch (error) {
    console.error('Batch details error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'BATCH_DETAILS_FAILED'
      },
      { status: 500 }
    );
  }
}

const UpdateBatchSchema = z.object({
  action: z.enum(['start', 'cancel', 'pause', 'resume']),
  priority: z.number().min(1).max(10).optional(),
});

/**
 * PATCH /api/upload/batch/[batchId] - Update batch status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { batchId } = params;

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

    // Parse request body
    const body = await request.json();
    const validationResult = UpdateBatchSchema.safeParse(body);

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

    const { action, priority } = validationResult.data;

    // Get bulk upload system
    const system = getBulkUploadSystem();

    // Verify batch exists and user has access
    const batchDetails = system.getBatchDetails(batchId);
    
    if (!batchDetails) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.BATCH_NOT_FOUND,
          code: 'BATCH_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    if (batchDetails.batch.cooperative_id !== user.cooperativeId) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.ACCESS_DENIED,
          code: 'ACCESS_DENIED' 
        },
        { status: 403 }
      );
    }

    let result = false;
    let message = '';

    // Perform the requested action
    switch (action) {
      case 'start':
        if (batchDetails.batch.status !== 'pending') {
          return NextResponse.json(
            { 
              error: SwedishMessages.errors.BATCH_ALREADY_STARTED,
              code: 'BATCH_ALREADY_STARTED' 
            },
            { status: 400 }
          );
        }
        result = await system.startBatch(batchId, priority || 5);
        message = SwedishMessages.success.BATCH_STARTED;
        break;

      case 'cancel':
        if (['completed', 'failed', 'cancelled'].includes(batchDetails.batch.status)) {
          return NextResponse.json(
            { 
              error: 'Batch cannot be cancelled in current status',
              code: 'INVALID_STATUS_FOR_CANCELLATION' 
            },
            { status: 400 }
          );
        }
        result = await system.cancelBatch(batchId);
        message = SwedishMessages.success.BATCH_COMPLETED; // Using generic completion message
        break;

      case 'pause':
      case 'resume':
        // These would be implemented when pause/resume functionality is added
        return NextResponse.json(
          { 
            error: 'Pause/resume functionality not yet implemented',
            code: 'NOT_IMPLEMENTED' 
          },
          { status: 501 }
        );

      default:
        return NextResponse.json(
          { 
            error: 'Invalid action',
            code: 'INVALID_ACTION' 
          },
          { status: 400 }
        );
    }

    if (!result) {
      return NextResponse.json(
        { 
          error: 'Action could not be completed',
          code: 'ACTION_FAILED' 
        },
        { status: 500 }
      );
    }

    // Log the action
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'batch_action',
      event_level: 'info',
      event_source: 'bulk_upload_api',
      event_message: `Batch ${action} action performed via API`,
      user_id: user.id,
      batch_id: batchId,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        action,
        priority,
        endpoint: `/api/upload/batch/${batchId}`,
        method: 'PATCH',
      },
    });

    // Get updated batch details
    const updatedBatch = system.getBatchDetails(batchId);

    return NextResponse.json({
      success: true,
      message,
      data: {
        batch_id: batchId,
        status: SwedishMessages.status[updatedBatch?.batch.status.toUpperCase() as keyof typeof SwedishMessages.status] || updatedBatch?.batch.status,
        progress_percentage: updatedBatch?.batch.progress_percentage || 0,
      },
    });

  } catch (error) {
    console.error('Batch update error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'BATCH_UPDATE_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload/batch/[batchId] - Cancel/delete a batch
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { batchId } = params;

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

    // Get bulk upload system
    const system = getBulkUploadSystem();

    // Verify batch exists and user has access
    const batchDetails = system.getBatchDetails(batchId);
    
    if (!batchDetails) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.BATCH_NOT_FOUND,
          code: 'BATCH_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    if (batchDetails.batch.cooperative_id !== user.cooperativeId) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.ACCESS_DENIED,
          code: 'ACCESS_DENIED' 
        },
        { status: 403 }
      );
    }

    // Cancel the batch
    const result = await system.cancelBatch(batchId);

    if (!result) {
      return NextResponse.json(
        { 
          error: 'Could not cancel batch',
          code: 'CANCELLATION_FAILED' 
        },
        { status: 500 }
      );
    }

    // Log the cancellation
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'batch_cancelled',
      event_level: 'info',
      event_source: 'bulk_upload_api',
      event_message: `Batch cancelled via API`,
      user_id: user.id,
      batch_id: batchId,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        endpoint: `/api/upload/batch/${batchId}`,
        method: 'DELETE',
      },
    });

    return NextResponse.json({
      success: true,
      message: SwedishMessages.success.BATCH_COMPLETED,
      data: {
        batch_id: batchId,
        status: SwedishMessages.status.CANCELLED,
      },
    });

  } catch (error) {
    console.error('Batch deletion error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'BATCH_DELETION_FAILED'
      },
      { status: 500 }
    );
  }
}