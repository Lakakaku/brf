/**
 * Chunked Upload Session Management API
 * GET /api/upload/chunks/[sessionId] - Get session progress
 * POST /api/upload/chunks/[sessionId] - Resume session
 * DELETE /api/upload/chunks/[sessionId] - Cancel session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { requireAuth } from '@/lib/auth/middleware';
import { ChunkedUploadManager } from '@/lib/upload/chunked-upload-manager';
import { initializeChunkedUploadTables } from '@/lib/upload/chunked-upload-schema';
import { SwedishMessages, MessageFormatter } from '@/lib/upload/messages';
import { logEvent } from '@/lib/monitoring/events';

// Initialize chunked upload manager
let chunkedUploadManager: ChunkedUploadManager;

function getChunkedUploadManager() {
  if (!chunkedUploadManager) {
    const db = getDatabase();
    initializeChunkedUploadTables(db);
    
    chunkedUploadManager = new ChunkedUploadManager({
      database: db,
      defaultChunkSize: 2 * 1024 * 1024, // 2MB chunks
      maxFileSize: 500 * 1024 * 1024, // 500MB max
      maxConcurrentChunks: 3,
      sessionExpirationHours: 24,
      storageBasePath: process.env.CHUNKED_UPLOAD_STORAGE || '/uploads/chunked',
      tempStoragePath: process.env.CHUNKED_UPLOAD_TEMP || '/tmp/chunked-uploads',
      enableIntegrityVerification: true,
      enableVirusScanning: true,
      autoCleanupEnabled: true,
    });
  }
  return chunkedUploadManager;
}

interface RouteParams {
  params: {
    sessionId: string;
  };
}

/**
 * GET /api/upload/chunks/[sessionId] - Get upload progress
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
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
    const { sessionId } = params;

    // Check session and cooperative access
    const db = getDatabase();
    const sessionRecord = db.prepare(`
      SELECT * FROM chunked_upload_sessions WHERE id = ? OR upload_id = ?
    `).get(sessionId, sessionId) as any;

    if (!sessionRecord || sessionRecord.cooperative_id !== user.cooperativeId) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.BATCH_NOT_FOUND,
          code: 'SESSION_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    // Get progress from manager
    const manager = getChunkedUploadManager();
    const progress = manager.getProgress(sessionRecord.id);

    if (!progress) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.BATCH_NOT_FOUND,
          code: 'SESSION_PROGRESS_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    // Format progress with Swedish messages
    const formattedProgress = {
      sessionId: progress.sessionId,
      uploadId: progress.uploadId,
      filename: progress.filename,
      status: SwedishMessages.status[progress.status.toUpperCase() as keyof typeof SwedishMessages.status] || progress.status,
      progressPercentage: Math.round(progress.progressPercentage * 100) / 100,
      chunksUploaded: progress.chunksUploaded,
      totalChunks: progress.totalChunks,
      fileSize: MessageFormatter.formatFileSize(progress.fileSize),
      uploadedSize: MessageFormatter.formatFileSize(progress.uploadedSize),
      remainingSize: MessageFormatter.formatFileSize(progress.remainingSize),
      estimatedCompletionTime: progress.estimatedCompletionTime,
      uploadSpeed: progress.uploadSpeed ? MessageFormatter.formatFileSize(progress.uploadSpeed) + '/s' : null,
      currentChunks: progress.currentChunks.map(chunk => ({
        chunkNumber: chunk.chunkNumber,
        status: SwedishMessages.status[chunk.status.toUpperCase() as keyof typeof SwedishMessages.status] || chunk.status,
        uploadProgress: chunk.uploadProgress || 0,
      })),
      errors: progress.errors,
      warnings: progress.warnings,
      progressSummary: MessageFormatter.formatProgress(
        progress.chunksUploaded,
        progress.totalChunks,
        progress.currentChunks.length > 0 ? `Chunk ${progress.currentChunks[0].chunkNumber}` : undefined
      ),
      sessionInfo: {
        expiresAt: sessionRecord.expires_at,
        resumable: sessionRecord.resumable === 1,
        maxRetriesPerChunk: sessionRecord.max_retries_per_chunk,
        concurrentChunksAllowed: sessionRecord.concurrent_chunks_allowed,
        virusScanEnabled: sessionRecord.virus_scan_enabled === 1,
        autoCleanupEnabled: sessionRecord.auto_cleanup_enabled === 1,
      }
    };

    return NextResponse.json({
      success: true,
      data: formattedProgress
    });

  } catch (error) {
    console.error('Get progress error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'GET_PROGRESS_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload/chunks/[sessionId] - Resume upload session
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
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
    const { sessionId } = params;

    // Check session and cooperative access
    const db = getDatabase();
    const sessionRecord = db.prepare(`
      SELECT * FROM chunked_upload_sessions WHERE id = ? OR upload_id = ?
    `).get(sessionId, sessionId) as any;

    if (!sessionRecord || sessionRecord.cooperative_id !== user.cooperativeId) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.ACCESS_DENIED,
          code: 'SESSION_ACCESS_DENIED' 
        },
        { status: 403 }
      );
    }

    // Resume session
    const manager = getChunkedUploadManager();
    const resumeResult = await manager.resumeSession(sessionRecord.id);

    // Log session resume
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'api_request_success',
      event_level: 'info',
      event_source: 'chunked_upload_api',
      event_message: resumeResult.canResume 
        ? `Chunked upload session resumed via API`
        : `Chunked upload session resume attempted (already complete)`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        session_id: sessionRecord.id,
        upload_id: sessionRecord.upload_id,
        can_resume: resumeResult.canResume,
        missing_chunks: resumeResult.missingChunks.length,
        completed_chunks: resumeResult.completedChunks.length,
        endpoint: `/api/upload/chunks/${sessionId}`,
        method: 'POST',
      },
    });

    // Get current progress for response
    const progress = manager.getProgress(sessionRecord.id);

    return NextResponse.json({
      success: true,
      message: resumeResult.canResume 
        ? SwedishMessages.success.BATCH_STARTED
        : SwedishMessages.success.BATCH_COMPLETED,
      data: {
        canResume: resumeResult.canResume,
        missingChunks: resumeResult.missingChunks,
        completedChunks: resumeResult.completedChunks,
        nextChunksToUpload: resumeResult.missingChunks.slice(0, sessionRecord.concurrent_chunks_allowed),
        progress: progress ? {
          progressPercentage: Math.round(progress.progressPercentage * 100) / 100,
          chunksUploaded: progress.chunksUploaded,
          totalChunks: progress.totalChunks,
          status: SwedishMessages.status[progress.status.toUpperCase() as keyof typeof SwedishMessages.status] || progress.status,
        } : null,
        resumeInstructions: resumeResult.canResume ? {
          message: `${resumeResult.missingChunks.length} chunks återstår att ladda upp`,
          concurrentChunks: sessionRecord.concurrent_chunks_allowed,
          nextAction: resumeResult.missingChunks.length > 0 ? 'upload_missing_chunks' : 'wait_for_assembly'
        } : null
      }
    });

  } catch (error) {
    console.error('Resume session error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'api_request_error',
        event_level: 'error',
        event_source: 'chunked_upload_api',
        event_message: `Session resume failed via API`,
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          session_id: params.sessionId,
          endpoint: `/api/upload/chunks/${params.sessionId}`,
          method: 'POST',
          error: error instanceof Error ? error.stack : error,
        },
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    // Return appropriate error
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { 
            error: SwedishMessages.errors.BATCH_NOT_FOUND,
            code: 'SESSION_NOT_FOUND'
          },
          { status: 404 }
        );
      }
      
      if (error.message.includes('expired')) {
        return NextResponse.json(
          { 
            error: SwedishMessages.errors.BATCH_CANCELLED,
            details: 'Sessionen har löpt ut',
            code: 'SESSION_EXPIRED'
          },
          { status: 410 }
        );
      }

      if (error.message.includes('not resumable')) {
        return NextResponse.json(
          { 
            error: 'Sessionen kan inte återupptas',
            code: 'SESSION_NOT_RESUMABLE'
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'SESSION_RESUME_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload/chunks/[sessionId] - Cancel upload session
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
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
    const { sessionId } = params;

    // Check session and cooperative access
    const db = getDatabase();
    const sessionRecord = db.prepare(`
      SELECT * FROM chunked_upload_sessions WHERE id = ? OR upload_id = ?
    `).get(sessionId, sessionId) as any;

    if (!sessionRecord || sessionRecord.cooperative_id !== user.cooperativeId) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.ACCESS_DENIED,
          code: 'SESSION_ACCESS_DENIED' 
        },
        { status: 403 }
      );
    }

    // Cancel session
    const manager = getChunkedUploadManager();
    const cancelled = await manager.cancelSession(sessionRecord.id);

    if (!cancelled) {
      return NextResponse.json(
        { 
          error: 'Sessionen kan inte avbrytas (kanske redan slutförd)',
          code: 'SESSION_CANNOT_BE_CANCELLED' 
        },
        { status: 400 }
      );
    }

    // Log session cancellation
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'api_request_success',
      event_level: 'info',
      event_source: 'chunked_upload_api',
      event_message: `Chunked upload session cancelled via API`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        session_id: sessionRecord.id,
        upload_id: sessionRecord.upload_id,
        filename: sessionRecord.original_filename,
        file_size: sessionRecord.file_size,
        chunks_uploaded: sessionRecord.chunks_uploaded,
        total_chunks: sessionRecord.total_chunks,
        endpoint: `/api/upload/chunks/${sessionId}`,
        method: 'DELETE',
      },
    });

    return NextResponse.json({
      success: true,
      message: SwedishMessages.success.BATCH_CANCELLED || 'Uppladdning avbruten framgångsrikt',
      data: {
        sessionId: sessionRecord.id,
        uploadId: sessionRecord.upload_id,
        filename: sessionRecord.original_filename,
        status: 'cancelled',
        chunksUploaded: sessionRecord.chunks_uploaded,
        totalChunks: sessionRecord.total_chunks,
        cleanupScheduled: sessionRecord.auto_cleanup_enabled === 1,
      }
    });

  } catch (error) {
    console.error('Cancel session error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'SESSION_CANCELLATION_FAILED'
      },
      { status: 500 }
    );
  }
}