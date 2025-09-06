import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { createErrorLogger } from '@/lib/monitoring/error-logger';

/**
 * Error Management API for BRF Portal
 * Provides endpoints for error logging and management
 */

// GET /api/admin/errors - Retrieve error logs with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = request.headers.get('x-cooperative-id') || 'default';
    
    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const level = searchParams.get('level');
    const category = searchParams.get('category');
    const brfContext = searchParams.get('brfContext');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const timeRange = searchParams.get('timeRange');
    const searchQuery = searchParams.get('search');

    const db = getDatabase();
    
    // Build WHERE clause
    const conditions = ['cooperative_id = ?'];
    const params = [cooperativeId];

    if (level && level !== 'all') {
      conditions.push('error_level = ?');
      params.push(level);
    }

    if (category && category !== 'all') {
      conditions.push('error_category = ?');
      params.push(category);
    }

    if (brfContext && brfContext !== 'all') {
      conditions.push('brf_context = ?');
      params.push(brfContext);
    }

    if (status === 'resolved') {
      conditions.push('is_resolved = 1');
    } else if (status === 'unresolved') {
      conditions.push('is_resolved = 0');
    }

    if (priority && priority !== 'all') {
      conditions.push('priority = ?');
      params.push(priority);
    }

    if (timeRange && timeRange !== 'all') {
      const timeMap: Record<string, string> = {
        'last_hour': '-1 hour',
        'last_24h': '-1 day',
        'last_week': '-7 days',
        'last_month': '-1 month',
        'last_3months': '-3 months'
      };
      
      if (timeMap[timeRange]) {
        conditions.push('created_at > datetime(\'now\', ?)');
        params.push(timeMap[timeRange]);
      }
    }

    if (searchQuery) {
      conditions.push('(error_message LIKE ? OR error_message_sv LIKE ? OR error_code LIKE ?)');
      const searchPattern = `%${searchQuery}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Get errors
    const errorsQuery = `
      SELECT 
        id, error_id, error_level, error_category, error_subcategory, brf_context,
        error_message, error_message_sv, error_code, occurrence_count,
        first_occurrence_at, last_occurrence_at, is_resolved, resolved_at,
        resolved_by, resolution_notes, priority, impact_assessment,
        affects_operations, affects_members, user_id, user_role,
        apartment_id, case_id, invoice_id, created_at, updated_at
      FROM error_logs 
      WHERE ${conditions.join(' AND ')}
      ORDER BY last_occurrence_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const errors = db.prepare(errorsQuery).all(...params, limit, offset);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM error_logs 
      WHERE ${conditions.join(' AND ')}
    `;
    
    const countResult = db.prepare(countQuery).get(...params) as { total: number };

    // Get metrics
    const logger = createErrorLogger(cooperativeId);
    const metrics = await logger.getErrorMetrics('24 hours');

    return NextResponse.json({
      errors,
      total: countResult.total,
      metrics,
      pagination: {
        limit,
        offset,
        hasMore: countResult.total > offset + limit
      }
    });

  } catch (error) {
    console.error('Error fetching error logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch error logs' },
      { status: 500 }
    );
  }
}

// POST /api/admin/errors - Log a new error
export async function POST(request: NextRequest) {
  try {
    const cooperativeId = request.headers.get('x-cooperative-id') || 'default';
    const errorData = await request.json();

    const logger = createErrorLogger(cooperativeId);
    const errorId = await logger.logError(errorData);

    return NextResponse.json({ 
      success: true, 
      errorId,
      message: 'Error logged successfully' 
    });

  } catch (error) {
    console.error('Error logging error:', error);
    return NextResponse.json(
      { error: 'Failed to log error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/errors/[id] - Update error (resolve/reopen)
export async function PUT(request: NextRequest) {
  try {
    const cooperativeId = request.headers.get('x-cooperative-id') || 'default';
    const { searchParams } = new URL(request.url);
    const errorId = searchParams.get('id');
    const updateData = await request.json();

    if (!errorId) {
      return NextResponse.json(
        { error: 'Error ID is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Handle resolution
    if (updateData.action === 'resolve') {
      const { resolutionNotes, resolutionType, resolvedBy } = updateData;
      
      const updateStmt = db.prepare(`
        UPDATE error_logs 
        SET 
          is_resolved = 1,
          resolved_at = datetime('now'),
          resolved_by = ?,
          resolution_notes = ?,
          resolution_type = ?,
          updated_at = datetime('now')
        WHERE error_id = ? AND cooperative_id = ?
      `);

      const result = updateStmt.run(
        resolvedBy,
        resolutionNotes,
        resolutionType,
        errorId,
        cooperativeId
      );

      if (result.changes === 0) {
        return NextResponse.json(
          { error: 'Error not found or already resolved' },
          { status: 404 }
        );
      }
    }
    
    // Handle reopening
    else if (updateData.action === 'reopen') {
      const updateStmt = db.prepare(`
        UPDATE error_logs 
        SET 
          is_resolved = 0,
          resolved_at = NULL,
          resolved_by = NULL,
          resolution_notes = NULL,
          resolution_type = NULL,
          updated_at = datetime('now')
        WHERE error_id = ? AND cooperative_id = ?
      `);

      const result = updateStmt.run(errorId, cooperativeId);

      if (result.changes === 0) {
        return NextResponse.json(
          { error: 'Error not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Error ${updateData.action}d successfully` 
    });

  } catch (error) {
    console.error('Error updating error:', error);
    return NextResponse.json(
      { error: 'Failed to update error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/errors - Bulk operations
export async function DELETE(request: NextRequest) {
  try {
    const cooperativeId = request.headers.get('x-cooperative-id') || 'default';
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const db = getDatabase();

    if (action === 'clear-resolved') {
      // Delete all resolved errors older than 30 days
      const deleteStmt = db.prepare(`
        DELETE FROM error_logs 
        WHERE cooperative_id = ? 
          AND is_resolved = 1 
          AND resolved_at < datetime('now', '-30 days')
      `);

      const result = deleteStmt.run(cooperativeId);

      return NextResponse.json({ 
        success: true,
        deleted: result.changes,
        message: `Deleted ${result.changes} resolved errors` 
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error deleting errors:', error);
    return NextResponse.json(
      { error: 'Failed to delete errors' },
      { status: 500 }
    );
  }
}