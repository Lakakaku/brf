/**
 * Feature Flag Evaluation API Route
 * Evaluate feature flags for given context
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlagService } from '@/lib/features/service';
import { FeatureFlagContext } from '@/lib/features/types';

// POST /api/features/evaluate - Evaluate a single feature flag
export async function POST(request: NextRequest) {
  try {
    const { flagKey, context } = await request.json() as {
      flagKey: string;
      context?: FeatureFlagContext;
    };
    
    if (!flagKey) {
      return NextResponse.json(
        { error: 'flagKey is required' },
        { status: 400 }
      );
    }
    
    const service = getFeatureFlagService();
    const evaluation = await service.evaluate(flagKey, context);
    
    return NextResponse.json(evaluation);
  } catch (error) {
    console.error('Failed to evaluate feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate feature flag' },
      { status: 500 }
    );
  }
}