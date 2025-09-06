/**
 * API Route: Get Cooperative Details
 * Returns detailed information about a specific cooperative
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { cooperativeService } from '@/lib/services/cooperative-service';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const cooperativeId = params.id;

    // Get authenticated session
    const session = await getSession(request);
    
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user can access this cooperative
    const permissionCheck = await cooperativeService.canUserSwitchToCooperative(
      session.user.id,
      cooperativeId
    );

    if (!permissionCheck.canSwitch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied',
          reason: permissionCheck.reason,
        },
        { status: 403 }
      );
    }

    // Get detailed cooperative information
    const cooperative = await cooperativeService.getCooperativeWithStats(
      cooperativeId,
      {
        user_id: session.user.id,
        user_role: session.user.role,
        cooperative_id: cooperativeId,
      }
    );

    if (!cooperative) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cooperative not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: cooperative,
      meta: {
        requestedBy: session.user.id,
        requestedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Failed to get cooperative details:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load cooperative details',
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