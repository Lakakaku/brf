/**
 * Individual Scan Job Management API
 * Handles specific scan job status, control, and file management for BRF Portal
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { mockScannerService } from '@/lib/scanner/mock-service';
import { ScannerMessages } from '@/lib/scanner/types';
import { logEvent } from '@/lib/monitoring/events';

/**
 * GET /api/upload/scanner/scan/[jobId] - Get scan job status and details
 */
export async function GET(
  request: NextRequest, 
  { params }: { params: { jobId: string } }
) {
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
    const { jobId } = params;

    // Get scan job details
    const scanJob = await mockScannerService.getScanJob(jobId);
    if (!scanJob) {
      return NextResponse.json(
        { 
          error: 'Skanningsjobb hittades inte',
          code: 'SCAN_JOB_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    // Check if user has access to this job's cooperative
    if (scanJob.cooperative_id !== user.cooperativeId) {
      return NextResponse.json(
        { 
          error: ScannerMessages.errors.PERMISSION_DENIED,
          code: 'PERMISSION_DENIED' 
        },
        { status: 403 }
      );
    }

    // Get scanner details
    const scanner = await mockScannerService.getScanner(scanJob.scanner_id);

    // Format response with detailed information
    const response = {
      success: true,
      data: {
        scan_job: {
          id: scanJob.id,
          status: scanJob.status,
          status_text: ScannerMessages.jobStatus[scanJob.status.toUpperCase() as keyof typeof ScannerMessages.jobStatus],
          scanner: scanner ? {
            id: scanner.id,
            name: scanner.name,
            model: scanner.model,
            brand: scanner.brand,
            location: scanner.location,
          } : null,
          settings: {
            ...scanJob.settings,
            document_type_text: scanJob.settings.document_type 
              ? ScannerMessages.documentTypes[scanJob.settings.document_type as keyof typeof ScannerMessages.documentTypes]
              : undefined,
          },
          progress: {
            pages_scanned: scanJob.pages_scanned,
            pages_total: scanJob.pages_total,
            percentage: scanJob.progress_percentage,
            current_status: scanJob.status === 'scanning' 
              ? ScannerMessages.info.SCAN_PROGRESS.replace('{current}', scanJob.pages_scanned.toString()).replace('{total}', (scanJob.pages_total || 0).toString())
              : ScannerMessages.jobStatus[scanJob.status.toUpperCase() as keyof typeof ScannerMessages.jobStatus]
          },
          files: scanJob.files_created.map(file => ({
            id: file.id,
            filename: file.filename,
            file_size: file.file_size,
            file_size_formatted: formatFileSize(file.file_size),
            mime_type: file.mime_type,
            page_count: file.page_count,
            resolution: file.resolution,
            color_mode: file.color_mode,
            has_thumbnail: !!file.thumbnail_path,
            has_ocr: !!file.ocr_text,
            ocr_confidence: file.ocr_confidence,
            document_category: file.document_category,
            document_category_text: file.document_category 
              ? ScannerMessages.documentTypes[file.document_category as keyof typeof ScannerMessages.documentTypes]
              : undefined,
            category_confidence: file.category_confidence,
            upload_status: file.upload_status,
            upload_batch_id: file.upload_batch_id,
            created_at: file.created_at,
          })),
          batch_id: scanJob.batch_id,
          user_id: scanJob.user_id,
          created_at: scanJob.created_at,
          started_at: scanJob.started_at,
          completed_at: scanJob.completed_at,
          estimated_completion: scanJob.estimated_completion,
          error_message: scanJob.error_message,
        },
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Scan job status error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : ScannerMessages.errors.NETWORK_ERROR,
        code: 'SCAN_JOB_STATUS_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload/scanner/scan/[jobId] - Control scan job (cancel, retry, etc.)
 */
export async function POST(
  request: NextRequest, 
  { params }: { params: { jobId: string } }
) {
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
    const { jobId } = params;

    // Parse action from request body or query parameter
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const action = body.action || searchParams.get('action') || 'status';

    // Get scan job details
    const scanJob = await mockScannerService.getScanJob(jobId);
    if (!scanJob) {
      return NextResponse.json(
        { 
          error: 'Skanningsjobb hittades inte',
          code: 'SCAN_JOB_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    // Check if user has access to this job's cooperative
    if (scanJob.cooperative_id !== user.cooperativeId) {
      return NextResponse.json(
        { 
          error: ScannerMessages.errors.PERMISSION_DENIED,
          code: 'PERMISSION_DENIED' 
        },
        { status: 403 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'cancel':
        const cancelled = await mockScannerService.cancelScan(jobId);
        
        if (cancelled) {
          // Log scan job cancellation
          await logEvent({
            cooperative_id: user.cooperativeId,
            event_type: 'scan_job_cancelled',
            event_level: 'info',
            event_source: 'scanner_api',
            event_message: `Scanning job cancelled by user`,
            user_id: user.id,
            request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown',
            event_data: {
              scan_job_id: jobId,
              scanner_id: scanJob.scanner_id,
              pages_scanned: scanJob.pages_scanned,
              pages_total: scanJob.pages_total,
              endpoint: `/api/upload/scanner/scan/${jobId}`,
              method: 'POST',
              action: 'cancel',
            },
          });

          return NextResponse.json({
            success: true,
            message: ScannerMessages.success.SCAN_CANCELLED,
            data: {
              scan_job_id: jobId,
              status: 'cancelled',
              status_text: ScannerMessages.jobStatus.CANCELLED,
              cancelled_at: new Date().toISOString(),
            },
          });
        } else {
          return NextResponse.json(
            { 
              error: 'Kunde inte avbryta skanningsjobbet',
              code: 'CANCEL_FAILED',
              details: 'Jobbet kan inte avbrytas i nuvarande tillstånd'
            },
            { status: 409 }
          );
        }

      case 'upload':
        // Trigger upload of scanned files to bulk upload system
        if (scanJob.status !== 'completed') {
          return NextResponse.json(
            { 
              error: 'Kan bara ladda upp filer från slutförda skanningsjobb',
              code: 'UPLOAD_NOT_READY'
            },
            { status: 409 }
          );
        }

        // In a real implementation, this would integrate with the bulk upload system
        // For now, simulate the upload process
        const uploadResults = scanJob.files_created.map(file => ({
          file_id: file.id,
          filename: file.filename,
          upload_status: 'pending',
          upload_started_at: new Date().toISOString(),
        }));

        // Log upload initiation
        await logEvent({
          cooperative_id: user.cooperativeId,
          event_type: 'scan_files_upload_started',
          event_level: 'info',
          event_source: 'scanner_api',
          event_message: `Upload initiated for scanned files`,
          user_id: user.id,
          request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          event_data: {
            scan_job_id: jobId,
            files_count: scanJob.files_created.length,
            total_size_bytes: scanJob.files_created.reduce((sum, f) => sum + f.file_size, 0),
            endpoint: `/api/upload/scanner/scan/${jobId}`,
            method: 'POST',
            action: 'upload',
          },
        });

        return NextResponse.json({
          success: true,
          message: ScannerMessages.success.FILES_UPLOADED,
          data: {
            scan_job_id: jobId,
            upload_results: uploadResults,
            total_files: uploadResults.length,
          },
        });

      default:
        return NextResponse.json(
          { 
            error: `Okänd åtgärd: ${action}`,
            code: 'UNKNOWN_ACTION'
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Scan job control error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'scan_job_control_error',
        event_level: 'error',
        event_source: 'scanner_api',
        event_message: `Scan job control action failed`,
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          scan_job_id: params.jobId,
          endpoint: `/api/upload/scanner/scan/${params.jobId}`,
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
        code: 'SCAN_JOB_CONTROL_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload/scanner/scan/[jobId] - Delete scan job and files
 */
export async function DELETE(
  request: NextRequest, 
  { params }: { params: { jobId: string } }
) {
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
    const { jobId } = params;

    // Get scan job details
    const scanJob = await mockScannerService.getScanJob(jobId);
    if (!scanJob) {
      return NextResponse.json(
        { 
          error: 'Skanningsjobb hittades inte',
          code: 'SCAN_JOB_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    // Check if user has access to this job's cooperative
    if (scanJob.cooperative_id !== user.cooperativeId) {
      return NextResponse.json(
        { 
          error: ScannerMessages.errors.PERMISSION_DENIED,
          code: 'PERMISSION_DENIED' 
        },
        { status: 403 }
      );
    }

    // Check if job can be deleted (only completed, failed, or cancelled jobs)
    if (!['completed', 'failed', 'cancelled'].includes(scanJob.status)) {
      return NextResponse.json(
        { 
          error: 'Kan inte ta bort aktivt skanningsjobb',
          code: 'CANNOT_DELETE_ACTIVE_JOB',
          details: 'Avbryt först skanningsjobbet innan borttagning'
        },
        { status: 409 }
      );
    }

    // In a real implementation, this would delete the scan job and associated files
    // For mock service, we'll just log the deletion
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'scan_job_deleted',
      event_level: 'info',
      event_source: 'scanner_api',
      event_message: `Scan job deleted by user`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        scan_job_id: jobId,
        scanner_id: scanJob.scanner_id,
        files_deleted: scanJob.files_created.length,
        final_status: scanJob.status,
        endpoint: `/api/upload/scanner/scan/${jobId}`,
        method: 'DELETE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Skanningsjobb och associerade filer har tagits bort',
      data: {
        scan_job_id: jobId,
        files_deleted: scanJob.files_created.length,
        deleted_at: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Scan job deletion error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : ScannerMessages.errors.NETWORK_ERROR,
        code: 'SCAN_JOB_DELETION_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}