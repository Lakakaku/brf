import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * Alert toggle API endpoint
 * Handles enabling/disabling alerts
 */

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive must be a boolean' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    const result = db.prepare(`
      UPDATE performance_alerts SET
        is_active = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(isActive ? 1 : 0, id);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, isActive });

  } catch (error) {
    console.error('Alert toggle API error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle alert' },
      { status: 500 }
    );
  }
}