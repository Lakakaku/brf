/**
 * Duplicate Groups API Routes
 * GET /api/upload/duplicates/groups - List duplicate groups
 * POST /api/upload/duplicates/groups/[groupId]/resolve - Resolve a group
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/database';
import { requireAuthentication } from '@/lib/auth/server';
import { DuplicateDetector } from '@/lib/upload/duplicate-detector';
import { logEvent } from '@/lib/monitoring/events';
import { SwedishMessages } from '@/lib/upload/messages';

// Request validation schemas
const ListGroupsSchema = z.object({
  resolution_status: z.enum(['pending', 'in_progress', 'resolved', 'ignored']).optional(),
  group_type: z.enum(['exact', 'similar', 'related', 'fuzzy']).optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/upload/duplicates/groups
 * List duplicate groups for the authenticated user's cooperative
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
    
    const validation = ListGroupsSchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.INVALID_REQUEST_FORMAT,
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { resolution_status, group_type, limit, offset } = validation.data;

    // Initialize duplicate detector
    const db = getDatabase();
    const duplicateDetector = new DuplicateDetector(db);

    // Get duplicate groups for the cooperative
    const groups = duplicateDetector.getDuplicateGroups(
      user.cooperative_id,
      {
        resolution_status,
        group_type,
        limit,
        offset,
      }
    );

    // Calculate summary statistics
    const summary = {
      total_groups: groups.length,
      pending_groups: groups.filter(g => g.resolution_strategy === 'manual' || !g.auto_resolvable).length,
      auto_resolvable_groups: groups.filter(g => g.auto_resolvable).length,
      total_duplicates: groups.reduce((sum, g) => sum + g.total_files - 1, 0), // Subtract 1 for master
      potential_storage_savings: groups.reduce((sum, g) => {
        // Estimate storage savings by keeping only the master file
        const avgFileSize = g.total_size_bytes / g.total_files;
        return sum + (avgFileSize * (g.total_files - 1));
      }, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        groups,
        summary,
        pagination: {
          limit,
          offset,
          total: groups.length,
        },
      },
      message: 'Duplicate groups retrieved successfully',
    });

  } catch (error) {
    console.error('Duplicate groups listing error:', error);
    
    await logEvent({
      event_type: 'api_error',
      event_level: 'error',
      event_source: 'duplicate_groups_api',
      event_message: `Error listing duplicate groups: ${error instanceof Error ? error.message : 'Unknown error'}`,
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