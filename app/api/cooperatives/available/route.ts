/**
 * API Route: Get Available Cooperatives
 * Returns cooperatives that the authenticated user can access
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { cooperativeService } from '@/lib/services/cooperative-service';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getSession(request);
    
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';
    const includeTestData = url.searchParams.get('includeTestData') === 'true' || 
                           process.env.NODE_ENV === 'development';

    // Get available cooperatives for the user
    const cooperatives = await cooperativeService.getAvailableCooperatives(
      session.user.id,
      includeInactive,
      includeTestData
    );

    return NextResponse.json({
      success: true,
      data: cooperatives,
      meta: {
        total: cooperatives.length,
        includeInactive,
        includeTestData,
        userId: session.user.id,
      },
    });

  } catch (error) {
    console.error('Failed to get available cooperatives:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load cooperatives',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}