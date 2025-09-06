/**
 * Multiple Feature Flag Evaluation API Route
 * Evaluate multiple feature flags at once for better performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlagService } from '@/lib/features/service';
import { FeatureFlagContext, FeatureFlagEvaluation } from '@/lib/features/types';

// POST /api/features/evaluate-multiple - Evaluate multiple feature flags
export async function POST(request: NextRequest) {
  try {
    const { flagKeys, context } = await request.json() as {
      flagKeys: string[];
      context?: FeatureFlagContext;
    };
    
    if (!flagKeys || !Array.isArray(flagKeys) || flagKeys.length === 0) {
      return NextResponse.json(
        { error: 'flagKeys array is required and must not be empty' },
        { status: 400 }
      );
    }
    
    const service = getFeatureFlagService();
    const evaluations: Record<string, FeatureFlagEvaluation> = {};
    
    // Evaluate each flag
    for (const flagKey of flagKeys) {
      evaluations[flagKey] = await service.evaluate(flagKey, context);
    }
    
    return NextResponse.json(evaluations);
  } catch (error) {
    console.error('Failed to evaluate feature flags:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate feature flags' },
      { status: 500 }
    );
  }
}