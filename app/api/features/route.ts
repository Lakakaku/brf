/**
 * Feature Flags API Routes
 * RESTful API endpoints for managing feature flags
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlagService } from '@/lib/features/service';
import { FeatureFlag } from '@/lib/features/types';
import { headers } from 'next/headers';

// GET /api/features - Get all feature flags
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperative_id');
    
    const service = getFeatureFlagService();
    const flags = await service.getAllFlags(cooperativeId || undefined);
    
    return NextResponse.json(flags);
  } catch (error) {
    console.error('Failed to get feature flags:', error);
    return NextResponse.json(
      { error: 'Failed to get feature flags' },
      { status: 500 }
    );
  }
}

// POST /api/features - Create a new feature flag
export async function POST(request: NextRequest) {
  try {
    const flagData: Omit<FeatureFlag, 'id' | 'created_at' | 'updated_at'> = await request.json();
    
    // TODO: Add authentication and authorization checks
    // const currentUser = await getCurrentUser(request);
    // if (!currentUser || !hasPermission(currentUser, 'manage_features')) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    
    const service = getFeatureFlagService();
    const flag = await service.createFlag(flagData);
    
    return NextResponse.json(flag, { status: 201 });
  } catch (error) {
    console.error('Failed to create feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to create feature flag' },
      { status: 500 }
    );
  }
}