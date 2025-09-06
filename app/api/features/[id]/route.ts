/**
 * Individual Feature Flag API Routes
 * Handle specific feature flag operations by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlagService } from '@/lib/features/service';

// PUT /api/features/[id] - Update a feature flag
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json();
    
    // TODO: Add authentication and authorization checks
    
    const service = getFeatureFlagService();
    const flag = await service.updateFlag(params.id, updates);
    
    if (!flag) {
      return NextResponse.json(
        { error: 'Feature flag not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(flag);
  } catch (error) {
    console.error('Failed to update feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}

// DELETE /api/features/[id] - Delete a feature flag
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Add authentication and authorization checks
    
    const service = getFeatureFlagService();
    const success = await service.deleteFlag(params.id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Feature flag not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to delete feature flag' },
      { status: 500 }
    );
  }
}