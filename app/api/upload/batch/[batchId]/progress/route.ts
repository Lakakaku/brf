/**
 * Batch Progress API - Real-time progress updates
 * Server-Sent Events endpoint for live batch progress monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { requireAuth } from '@/lib/auth/middleware';
import { BulkUploadSystem } from '@/lib/upload';
import { SwedishMessages, MessageFormatter } from '@/lib/upload/messages';

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
 * GET /api/upload/batch/[batchId]/progress - Get current batch progress
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

    const { batch, progress } = batchDetails;

    // Check if this should be a Server-Sent Events connection
    const accept = request.headers.get('accept');
    if (accept?.includes('text/event-stream')) {
      // Server-Sent Events for real-time updates
      return handleSSEConnection(request, batchId, system);
    }

    // Regular JSON response
    const formattedProgress = formatProgressResponse(batch, progress);

    return NextResponse.json({
      success: true,
      data: formattedProgress,
    });

  } catch (error) {
    console.error('Progress fetch error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'PROGRESS_FETCH_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle Server-Sent Events connection for real-time progress
 */
function handleSSEConnection(
  request: NextRequest,
  batchId: string,
  system: BulkUploadSystem
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectionMessage = `data: ${JSON.stringify({
        type: 'connected',
        message: 'Connected to progress stream',
        timestamp: new Date().toISOString(),
      })}\n\n`;
      
      controller.enqueue(encoder.encode(connectionMessage));

      // Set up progress monitoring
      let intervalId: NodeJS.Timeout;

      const sendProgress = () => {
        try {
          const batchDetails = system.getBatchDetails(batchId);
          if (!batchDetails) {
            // Batch not found, close connection
            const errorMessage = `data: ${JSON.stringify({
              type: 'error',
              message: SwedishMessages.errors.BATCH_NOT_FOUND,
              code: 'BATCH_NOT_FOUND',
              timestamp: new Date().toISOString(),
            })}\n\n`;
            
            controller.enqueue(encoder.encode(errorMessage));
            controller.close();
            return;
          }

          const { batch, progress } = batchDetails;
          const formattedProgress = formatProgressResponse(batch, progress);

          const progressMessage = `data: ${JSON.stringify({
            type: 'progress',
            data: formattedProgress,
            timestamp: new Date().toISOString(),
          })}\n\n`;

          controller.enqueue(encoder.encode(progressMessage));

          // Close connection if batch is completed
          if (['completed', 'failed', 'cancelled'].includes(batch.status)) {
            const completionMessage = `data: ${JSON.stringify({
              type: 'completed',
              message: SwedishMessages.status[batch.status.toUpperCase() as keyof typeof SwedishMessages.status] || batch.status,
              final_status: batch.status,
              timestamp: new Date().toISOString(),
            })}\n\n`;
            
            controller.enqueue(encoder.encode(completionMessage));
            
            // Close after a short delay to ensure message is received
            setTimeout(() => {
              controller.close();
            }, 1000);
          }

        } catch (error) {
          console.error('SSE progress error:', error);
          
          const errorMessage = `data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'PROGRESS_ERROR',
            timestamp: new Date().toISOString(),
          })}\n\n`;
          
          controller.enqueue(encoder.encode(errorMessage));
          controller.close();
        }
      };

      // Send initial progress
      sendProgress();

      // Set up periodic updates (every 2 seconds)
      intervalId = setInterval(sendProgress, 2000);

      // Handle client disconnect
      const cleanup = () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
        try {
          controller.close();
        } catch (error) {
          // Ignore errors when closing
        }
      };

      // Clean up on abort
      request.signal.addEventListener('abort', cleanup);
      
      // Clean up after 5 minutes to prevent memory leaks
      setTimeout(cleanup, 5 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}

/**
 * Format progress response with Swedish messages
 */
function formatProgressResponse(batch: any, progress: any) {
  const isCompleted = ['completed', 'failed', 'cancelled'].includes(batch.status);
  const hasErrors = batch.files_failed > 0;
  const hasWarnings = progress?.warnings?.length > 0;

  return {
    batch_id: batch.id,
    batch_number: batch.batch_number,
    batch_name: batch.batch_name,
    status: SwedishMessages.status[batch.status.toUpperCase() as keyof typeof SwedishMessages.status] || batch.status,
    status_message: getStatusMessage(batch.status, hasErrors, isCompleted),
    progress_percentage: batch.progress_percentage,
    
    // File counts
    total_files: batch.total_files,
    files_uploaded: batch.files_uploaded,
    files_processed: batch.files_processed,
    files_completed: batch.files_completed,
    files_failed: batch.files_failed,
    files_skipped: batch.files_skipped,
    
    // Progress text
    progress_text: MessageFormatter.formatProgress(
      batch.files_completed,
      batch.total_files,
      progress?.current_file
    ),
    
    // Summary
    summary: MessageFormatter.formatBatchSummary({
      total_files: batch.total_files,
      files_completed: batch.files_completed,
      files_failed: batch.files_failed,
      total_size_bytes: batch.total_size_bytes,
    }),
    
    // Timing
    estimated_completion_time: progress?.estimated_completion_time,
    estimated_completion_text: progress?.estimated_completion_time ? 
      MessageFormatter.formatEstimatedCompletion(
        Math.max(0, Math.floor((new Date(progress.estimated_completion_time).getTime() - Date.now()) / 1000))
      ) : undefined,
    
    // Current activity
    current_file: progress?.current_file,
    current_activity: getCurrentActivity(batch.status),
    
    // Issues
    errors: progress?.errors || [],
    warnings: progress?.warnings || [],
    has_errors: hasErrors,
    has_warnings: hasWarnings,
    
    // Completion info
    is_completed: isCompleted,
    completed_at: batch.completed_at,
    
    // Performance metrics
    upload_speed: calculateUploadSpeed(batch),
    processing_speed: calculateProcessingSpeed(batch),
    
    // Next steps
    next_steps: getNextSteps(batch.status, hasErrors, hasWarnings),
    
    // Timestamps
    created_at: batch.created_at,
    started_at: batch.started_at,
    last_updated: batch.updated_at,
  };
}

/**
 * Get human-readable status message
 */
function getStatusMessage(status: string, hasErrors: boolean, isCompleted: boolean): string {
  if (isCompleted) {
    if (status === 'completed') {
      return hasErrors ? 
        'Bulk-uppladdning slutförd med fel' : 
        'Bulk-uppladdning slutförd framgångsrikt';
    } else if (status === 'failed') {
      return 'Bulk-uppladdning misslyckades';
    } else if (status === 'cancelled') {
      return 'Bulk-uppladdning avbruten';
    }
  }
  
  return SwedishMessages.progress[status.toUpperCase() as keyof typeof SwedishMessages.progress] || 
         SwedishMessages.status[status.toUpperCase() as keyof typeof SwedishMessages.status] || 
         status;
}

/**
 * Get current activity description
 */
function getCurrentActivity(status: string): string {
  switch (status) {
    case 'pending':
      return SwedishMessages.progress.STARTING;
    case 'validating':
      return SwedishMessages.progress.VALIDATING_FILES;
    case 'uploading':
      return SwedishMessages.progress.UPLOADING_FILES;
    case 'processing':
      return SwedishMessages.progress.PROCESSING_FILES;
    case 'completed':
      return SwedishMessages.progress.COMPLETED;
    default:
      return '';
  }
}

/**
 * Calculate upload speed in MB/s
 */
function calculateUploadSpeed(batch: any): number | undefined {
  if (!batch.started_at || batch.uploaded_size_bytes === 0) {
    return undefined;
  }
  
  const startTime = new Date(batch.started_at).getTime();
  const now = Date.now();
  const durationSeconds = (now - startTime) / 1000;
  
  if (durationSeconds < 1) return undefined;
  
  const uploadedMB = batch.uploaded_size_bytes / (1024 * 1024);
  return parseFloat((uploadedMB / durationSeconds).toFixed(2));
}

/**
 * Calculate processing speed in files/minute
 */
function calculateProcessingSpeed(batch: any): number | undefined {
  if (!batch.started_at || batch.files_processed === 0) {
    return undefined;
  }
  
  const startTime = new Date(batch.started_at).getTime();
  const now = Date.now();
  const durationMinutes = (now - startTime) / (1000 * 60);
  
  if (durationMinutes < 0.1) return undefined;
  
  return parseFloat((batch.files_processed / durationMinutes).toFixed(1));
}

/**
 * Get next steps or recommendations
 */
function getNextSteps(status: string, hasErrors: boolean, hasWarnings: boolean): string[] {
  const steps: string[] = [];
  
  if (status === 'completed') {
    if (hasErrors) {
      steps.push('Granska filer som misslyckades och försök ladda upp dem igen');
    }
    if (hasWarnings) {
      steps.push('Granska varningar och vidta nödvändiga åtgärder');
    }
    if (!hasErrors && !hasWarnings) {
      steps.push('Alla filer bearbetade framgångsrikt - inga ytterligare åtgärder krävs');
    }
  } else if (status === 'failed') {
    steps.push('Kontrollera felmeddelanden och försök igen');
    steps.push('Kontakta support om problemet kvarstår');
  } else if (status === 'partially_completed') {
    steps.push('Granska vilka filer som misslyckades');
    steps.push('Ladda upp misslyckade filer i en ny batch');
  }
  
  return steps;
}