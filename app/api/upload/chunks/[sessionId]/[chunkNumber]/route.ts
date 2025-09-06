/**
 * Chunked Upload Chunk API
 * PUT /api/upload/chunks/[sessionId]/[chunkNumber] - Upload a specific chunk
 * GET /api/upload/chunks/[sessionId]/[chunkNumber] - Get chunk status
 * DELETE /api/upload/chunks/[sessionId]/[chunkNumber] - Cancel/delete a chunk
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { requireAuth } from '@/lib/auth/middleware';
import { ChunkedUploadManager } from '@/lib/upload/chunked-upload-manager';
import { initializeChunkedUploadTables } from '@/lib/upload/chunked-upload-schema';
import { SwedishMessages, MessageFormatter } from '@/lib/upload/messages';
import { logEvent } from '@/lib/monitoring/events';
import crypto from 'crypto';

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
    chunkNumber: string;
  };
}

/**
 * PUT /api/upload/chunks/[sessionId]/[chunkNumber] - Upload chunk
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const { sessionId, chunkNumber } = params;
    const chunkNum = parseInt(chunkNumber, 10);

    if (isNaN(chunkNum) || chunkNum < 0) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.INVALID_REQUEST,
          details: 'Ogiltigt chunknummer',
          code: 'INVALID_CHUNK_NUMBER' 
        },
        { status: 400 }
      );
    }

    // Get content headers
    const contentLength = request.headers.get('content-length');
    const contentType = request.headers.get('content-type');
    const chunkHashHeader = request.headers.get('x-chunk-hash');
    const isLastChunk = request.headers.get('x-is-last-chunk') === 'true';

    if (!contentLength || parseInt(contentLength) === 0) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.FILE_EMPTY,
          code: 'EMPTY_CHUNK' 
        },
        { status: 400 }
      );
    }

    // Read chunk data
    const chunkData = Buffer.from(await request.arrayBuffer());
    
    if (chunkData.length === 0) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.FILE_EMPTY,
          code: 'EMPTY_CHUNK_DATA' 
        },
        { status: 400 }
      );
    }

    // Verify chunk size matches content-length
    if (chunkData.length !== parseInt(contentLength)) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.UPLOAD_SIZE_MISMATCH,
          details: `Förväntad storlek: ${contentLength}, faktisk: ${chunkData.length}`,
          code: 'CHUNK_SIZE_MISMATCH' 
        },
        { status: 400 }
      );
    }

    // Get manager and verify session ownership
    const manager = getChunkedUploadManager();
    const session = manager.getSessionByUploadId(sessionId) || 
                   manager.getProgress(sessionId);

    if (!session) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.BATCH_NOT_FOUND,
          code: 'SESSION_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    // Check cooperative access
    const db = getDatabase();
    const sessionRecord = db.prepare(`
      SELECT cooperative_id FROM chunked_upload_sessions WHERE id = ? OR upload_id = ?
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

    // Upload chunk
    const result = await manager.uploadChunk({
      sessionId: sessionRecord ? sessionId : session.sessionId,
      chunkNumber: chunkNum,
      chunkData,
      chunkHash: chunkHashHeader || undefined,
      isLastChunk,
    });

    // Get updated progress
    const progress = manager.getProgress(sessionRecord ? sessionId : session.sessionId);

    // Log successful chunk upload
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'api_request_success',
      event_level: 'info',
      event_source: 'chunked_upload_api',
      event_message: `Chunk ${chunkNum} uploaded successfully via API`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        session_id: sessionRecord ? sessionId : session.sessionId,
        chunk_number: chunkNum,
        chunk_size: chunkData.length,
        chunk_hash: result.chunkHash,
        upload_speed: result.uploadSpeed,
        is_last_chunk: isLastChunk,
        endpoint: `/api/upload/chunks/${sessionId}/${chunkNumber}`,
        method: 'PUT',
      },
    });

    // Prepare response
    const response = {
      success: true,
      message: `Chunk ${chunkNum} laddades upp framgångsrikt`,
      data: {
        chunkId: result.chunkId,
        chunkNumber: chunkNum,
        chunkHash: result.chunkHash,
        chunkSize: MessageFormatter.formatFileSize(chunkData.length),
        uploadSpeed: MessageFormatter.formatFileSize(result.uploadSpeed) + '/s',
        nextChunkNumber: result.nextChunkNumber,
        progress: progress ? {
          progressPercentage: Math.round(progress.progressPercentage * 100) / 100,
          chunksUploaded: progress.chunksUploaded,
          totalChunks: progress.totalChunks,
          uploadedSize: MessageFormatter.formatFileSize(progress.uploadedSize),
          remainingSize: MessageFormatter.formatFileSize(progress.remainingSize),
          status: SwedishMessages.status[progress.status.toUpperCase() as keyof typeof SwedishMessages.status] || progress.status,
        } : null,
      }
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Chunk upload error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'api_request_error',
        event_level: 'error',
        event_source: 'chunked_upload_api',
        event_message: `Chunk upload failed via API`,
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          session_id: params.sessionId,
          chunk_number: params.chunkNumber,
          endpoint: `/api/upload/chunks/${params.sessionId}/${params.chunkNumber}`,
          method: 'PUT',
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
            code: 'SESSION_OR_CHUNK_NOT_FOUND'
          },
          { status: 404 }
        );
      }
      
      if (error.message.includes('expired') || error.message.includes('cancelled')) {
        return NextResponse.json(
          { 
            error: SwedishMessages.errors.BATCH_CANCELLED,
            code: 'SESSION_EXPIRED_OR_CANCELLED'
          },
          { status: 410 }
        );
      }

      if (error.message.includes('size mismatch') || error.message.includes('hash')) {
        return NextResponse.json(
          { 
            error: SwedishMessages.errors.UPLOAD_SIZE_MISMATCH,
            details: error.message,
            code: 'CHUNK_VERIFICATION_FAILED'
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.UPLOAD_FAILED,
        code: 'CHUNK_UPLOAD_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload/chunks/[sessionId]/[chunkNumber] - Get chunk status
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
    const { sessionId, chunkNumber } = params;
    const chunkNum = parseInt(chunkNumber, 10);

    if (isNaN(chunkNum) || chunkNum < 0) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.INVALID_REQUEST,
          details: 'Ogiltigt chunknummer',
          code: 'INVALID_CHUNK_NUMBER' 
        },
        { status: 400 }
      );
    }

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

    // Get chunk information
    const chunk = db.prepare(`
      SELECT * FROM chunked_upload_chunks 
      WHERE session_id = ? AND chunk_number = ?
    `).get(sessionRecord.id, chunkNum) as any;

    if (!chunk) {
      return NextResponse.json(
        { 
          error: 'Chunk hittades inte',
          code: 'CHUNK_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    // Format chunk information
    const chunkInfo = {
      chunkNumber: chunk.chunk_number,
      chunkSize: MessageFormatter.formatFileSize(chunk.chunk_size),
      status: SwedishMessages.status[chunk.status.toUpperCase() as keyof typeof SwedishMessages.status] || chunk.status,
      uploadAttempts: chunk.upload_attempts,
      retryCount: chunk.retry_count,
      uploadSpeed: chunk.upload_speed_bps ? MessageFormatter.formatFileSize(chunk.upload_speed_bps) + '/s' : null,
      uploadDuration: chunk.upload_duration_ms ? MessageFormatter.formatProcessingTime(chunk.upload_duration_ms / 1000) : null,
      chunkHash: chunk.chunk_hash,
      errorMessage: chunk.error_message,
      canRetry: chunk.status === 'failed' && chunk.retry_count < sessionRecord.max_retries_per_chunk,
      retriesLeft: Math.max(0, sessionRecord.max_retries_per_chunk - chunk.retry_count),
      uploadStartedAt: chunk.upload_started_at,
      uploadCompletedAt: chunk.upload_completed_at,
      lastRetryAt: chunk.last_retry_at,
    };

    return NextResponse.json({
      success: true,
      data: chunkInfo
    });

  } catch (error) {
    console.error('Get chunk status error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'GET_CHUNK_STATUS_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload/chunks/[sessionId]/[chunkNumber] - Cancel/retry chunk
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
    const { sessionId, chunkNumber } = params;
    const chunkNum = parseInt(chunkNumber, 10);

    if (isNaN(chunkNum) || chunkNum < 0) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.INVALID_REQUEST,
          details: 'Ogiltigt chunknummer',
          code: 'INVALID_CHUNK_NUMBER' 
        },
        { status: 400 }
      );
    }

    // Check session access
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

    // Get manager and retry chunk
    const manager = getChunkedUploadManager();
    const result = await manager.retryChunk(sessionRecord.id, chunkNum);

    // Log chunk retry preparation
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: result.canRetry ? 'api_request_success' : 'api_request_warning',
      event_level: result.canRetry ? 'info' : 'warning',
      event_source: 'chunked_upload_api',
      event_message: result.canRetry 
        ? `Chunk ${chunkNum} prepared for retry`
        : `Chunk ${chunkNum} retry limit exceeded`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        session_id: sessionRecord.id,
        chunk_number: chunkNum,
        can_retry: result.canRetry,
        retries_left: result.retriesLeft,
        endpoint: `/api/upload/chunks/${sessionId}/${chunkNumber}`,
        method: 'DELETE',
      },
    });

    return NextResponse.json({
      success: true,
      message: result.canRetry 
        ? `Chunk ${chunkNum} förberedd för nytt försök`
        : `Chunk ${chunkNum} har nått maximalt antal försök`,
      data: {
        chunkId: result.chunkId,
        chunkNumber: chunkNum,
        canRetry: result.canRetry,
        retriesLeft: result.retriesLeft,
        retryStatus: result.canRetry ? 'ready_for_retry' : 'max_retries_exceeded'
      }
    });

  } catch (error) {
    console.error('Chunk retry error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'CHUNK_RETRY_FAILED'
      },
      { status: 500 }
    );
  }
}