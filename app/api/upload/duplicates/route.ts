/**
 * Duplicate Detection API Routes
 * GET /api/upload/duplicates - List duplicates for a cooperative
 * POST /api/upload/duplicates - Start duplicate detection session
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/database';
import { requireAuthentication } from '@/lib/auth/server';
import { DuplicateDetector, type DetectionAlgorithm, type ConfidenceLevel } from '@/lib/upload/duplicate-detector';
import { logEvent } from '@/lib/monitoring/events';
import { SwedishMessages } from '@/lib/upload/messages';

// Request validation schemas
const DetectionRequestSchema = z.object({
  batch_id: z.string().optional(),
  session_type: z.enum(['batch', 'scheduled', 'manual', 'realtime']).optional(),
  file_ids: z.array(z.string()).optional(),
  algorithms: z.array(z.enum(['md5', 'sha256', 'perceptual', 'content', 'metadata', 'fuzzy'])).optional(),
});

const ListDuplicatesSchema = z.object({
  status: z.enum(['detected', 'reviewed', 'resolved', 'ignored', 'false_positive']).optional(),
  algorithm: z.enum(['md5', 'sha256', 'perceptual', 'content', 'metadata', 'fuzzy']).optional(),
  confidence_level: z.enum(['low', 'medium', 'high']).optional(),
  limit: z.coerce.number().min(1).max(500).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/upload/duplicates
 * List duplicates for the authenticated user's cooperative
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthentication();
    if (!user?.cooperative_id) {
      return NextResponse.json(
        { error: SwedishMessages.errors.AUTHENTICATION_REQUIRED },
        { status: 401 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    
    const validation = ListDuplicatesSchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.INVALID_REQUEST_FORMAT,
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { status, algorithm, confidence_level, limit, offset } = validation.data;

    // Initialize duplicate detector
    const db = getDatabase();
    const duplicateDetector = new DuplicateDetector(db);

    // Get duplicates for the cooperative
    const duplicates = duplicateDetector.getDuplicatesForCooperative(
      user.cooperative_id,
      {
        status,
        algorithm: algorithm as DetectionAlgorithm,
        confidence_level: confidence_level as ConfidenceLevel,
        limit,
        offset,
      }
    );

    // Get duplicate groups
    const groups = duplicateDetector.getDuplicateGroups(user.cooperative_id, { limit: 20 });

    // Get detection statistics
    const stats = duplicateDetector.getDetectionStats(user.cooperative_id);

    return NextResponse.json({
      success: true,
      data: {
        duplicates,
        groups,
        stats,
        pagination: {
          limit,
          offset,
          total: duplicates.length,
        },
      },
      message: 'Duplicate data retrieved successfully',
    });

  } catch (error) {
    console.error('Duplicate listing error:', error);
    
    await logEvent({
      event_type: 'api_error',
      event_level: 'error',
      event_source: 'duplicates_api',
      event_message: `Error listing duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      cooperative_id: '',
    });

    return NextResponse.json(
      { 
        error: SwedishMessages.errors.SYSTEM_ERROR,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload/duplicates
 * Start a new duplicate detection session
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthentication();
    if (!user?.cooperative_id) {
      return NextResponse.json(
        { error: SwedishMessages.errors.AUTHENTICATION_REQUIRED },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = DetectionRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.INVALID_REQUEST_FORMAT,
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { batch_id, session_type, file_ids, algorithms } = validation.data;

    // Initialize duplicate detector
    const db = getDatabase();
    const duplicateDetector = new DuplicateDetector(db);

    // Start detection session
    const session = await duplicateDetector.startDetectionSession({
      cooperative_id: user.cooperative_id,
      batch_id,
      session_type: session_type || 'manual',
      file_ids,
      algorithms: algorithms as DetectionAlgorithm[],
      started_by: user.id,
    });

    // Start detection process (async)
    duplicateDetector.detectDuplicates(session.id).catch(error => {
      console.error('Background duplicate detection failed:', error);
    });

    await logEvent({
      cooperative_id: user.cooperative_id,
      event_type: 'duplicate_detection_requested',
      event_level: 'info',
      event_source: 'duplicates_api',
      event_message: `Duplicate detection session started`,
      user_id: user.id,
      event_data: { 
        session_id: session.id, 
        session_type: session.session_type,
        file_count: file_ids?.length || 0,
        algorithms: algorithms || [],
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        session_id: session.id,
        status: session.session_status,
        algorithms_used: session.algorithms_used,
        started_at: session.started_at,
      },
      message: 'Duplicate detection session started successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Duplicate detection start error:', error);
    
    await logEvent({
      event_type: 'api_error',
      event_level: 'error',
      event_source: 'duplicates_api',
      event_message: `Error starting duplicate detection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      cooperative_id: '',
    });

    return NextResponse.json(
      { 
        error: SwedishMessages.errors.SYSTEM_ERROR,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}