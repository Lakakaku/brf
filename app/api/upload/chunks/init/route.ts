/**
 * Chunked Upload Initialization API
 * POST /api/upload/chunks/init - Initialize a new chunked upload session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { requireAuth } from '@/lib/auth/middleware';
import { ChunkedUploadManager } from '@/lib/upload/chunked-upload-manager';
import { initializeChunkedUploadTables } from '@/lib/upload/chunked-upload-schema';
import { SwedishMessages, MessageFormatter } from '@/lib/upload/messages';
import { logEvent } from '@/lib/monitoring/events';
import { z } from 'zod';

// Initialize chunked upload manager
let chunkedUploadManager: ChunkedUploadManager;

function getChunkedUploadManager() {
  if (!chunkedUploadManager) {
    const db = getDatabase();
    
    // Initialize chunked upload tables if they don't exist
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

// Validation schema for initialization request
const InitChunkedUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(500 * 1024 * 1024), // Max 500MB
  chunkSize: z.number().int().positive().min(1024).max(10 * 1024 * 1024).optional(), // 1KB to 10MB
  fileHash: z.string().length(64).optional(), // SHA-256 hash is 64 chars
  mimeType: z.string().optional(),
  contentType: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  batchId: z.string().uuid().optional(),
  maxRetriesPerChunk: z.number().int().min(0).max(10).optional(),
  concurrentChunksAllowed: z.number().int().min(1).max(10).optional(),
  validationRules: z.record(z.any()).optional(),
  virusScanEnabled: z.boolean().optional(),
});

/**
 * POST /api/upload/chunks/init - Initialize chunked upload session
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
    const validationResult = InitChunkedUploadSchema.safeParse(body);

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

    const data = validationResult.data;

    // Check file size limits
    const db = getDatabase();
    const cooperative = db.prepare(`
      SELECT settings FROM cooperatives WHERE id = ?
    `).get(user.cooperativeId) as any;
    
    const cooperativeSettings = JSON.parse(cooperative?.settings || '{}');
    const maxFileSize = cooperativeSettings.max_file_size_mb 
      ? cooperativeSettings.max_file_size_mb * 1024 * 1024 
      : 500 * 1024 * 1024;

    if (data.fileSize > maxFileSize) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.FILE_TOO_LARGE,
          details: `Max filstorlek: ${MessageFormatter.formatFileSize(maxFileSize)}`,
          code: 'FILE_TOO_LARGE'
        },
        { status: 400 }
      );
    }

    // Get chunked upload manager
    const manager = getChunkedUploadManager();

    // Create chunked upload session
    const session = await manager.createSession({
      cooperativeId: user.cooperativeId,
      uploadedBy: user.id,
      filename: data.filename,
      fileSize: data.fileSize,
      chunkSize: data.chunkSize,
      fileHash: data.fileHash,
      mimeType: data.mimeType,
      contentType: data.contentType,
      metadata: data.metadata,
      batchId: data.batchId,
      maxRetriesPerChunk: data.maxRetriesPerChunk || 3,
      concurrentChunksAllowed: data.concurrentChunksAllowed || 3,
      validationRules: data.validationRules,
      virusScanEnabled: data.virusScanEnabled,
    });

    // Log successful session creation
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'api_request_success',
      event_level: 'info',
      event_source: 'chunked_upload_api',
      event_message: `Chunked upload session initialized via API`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        session_id: session.sessionId,
        upload_id: session.uploadId,
        filename: data.filename,
        file_size: data.fileSize,
        total_chunks: session.totalChunks,
        chunk_size: session.chunkSize,
        endpoint: '/api/upload/chunks/init',
        method: 'POST',
      },
    });

    // Format response with Swedish messages
    return NextResponse.json({
      success: true,
      message: SwedishMessages.success.BATCH_CREATED,
      data: {
        sessionId: session.sessionId,
        uploadId: session.uploadId,
        chunkSize: session.chunkSize,
        totalChunks: session.totalChunks,
        expiresAt: session.expiresAt,
        maxConcurrentChunks: data.concurrentChunksAllowed || 3,
        resumable: true,
        supportedOperations: [
          'upload_chunk',
          'get_progress', 
          'resume_session',
          'cancel_session',
          'retry_chunk'
        ],
        uploadDetails: {
          filename: data.filename,
          fileSize: MessageFormatter.formatFileSize(data.fileSize),
          estimatedUploadTime: MessageFormatter.formatProcessingTime(
            Math.ceil(data.fileSize / (1024 * 1024)) * 2 // Rough estimate: 2 seconds per MB
          ),
          integrityVerification: !!data.fileHash,
          virusScanEnabled: data.virusScanEnabled !== false,
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Chunked upload initialization error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'api_request_error',
        event_level: 'error',
        event_source: 'chunked_upload_api',
        event_message: `Chunked upload initialization failed via API`,
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          endpoint: '/api/upload/chunks/init',
          method: 'POST',
          error: error instanceof Error ? error.stack : error,
        },
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    // Return appropriate error based on error type
    if (error instanceof Error) {
      if (error.message.includes('FILE_TOO_LARGE')) {
        return NextResponse.json(
          { 
            error: SwedishMessages.errors.FILE_TOO_LARGE,
            code: 'FILE_TOO_LARGE'
          },
          { status: 400 }
        );
      }
      
      if (error.message.includes('FILE_EMPTY')) {
        return NextResponse.json(
          { 
            error: SwedishMessages.errors.FILE_EMPTY,
            code: 'FILE_EMPTY'
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'SESSION_INITIALIZATION_FAILED'
      },
      { status: 500 }
    );
  }
}