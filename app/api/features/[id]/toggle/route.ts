/**
 * Feature Flag Toggle API Route
 * Handle feature flag enable/disable operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlagService } from '@/lib/features/service';

// POST /api/features/[id]/toggle - Toggle a feature flag on/off
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { enabled } = await request.json();
    
    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled parameter must be a boolean' },
        { status: 400 }
      );
    }
    
    // TODO: Add authentication and authorization checks
    // TODO: Get current user ID for audit trail
    const userId = undefined; // await getCurrentUserId(request);
    
    const service = getFeatureFlagService();
    const success = await service.toggleFlag(params.id, enabled, userId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Feature flag not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to toggle feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to toggle feature flag' },
      { status: 500 }
    );
  }
}