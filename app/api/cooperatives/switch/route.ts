/**
 * API Route: Switch Cooperative Context
 * Handles switching the user's current cooperative context
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/auth/session';
import { cooperativeService } from '@/lib/services/cooperative-service';
import { z } from 'zod';

const switchCooperativeSchema = z.object({
  cooperativeId: z.string().min(1, 'Cooperative ID is required'),
  reason: z.enum(['user_request', 'admin_force', 'system_migration']).optional().default('user_request'),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getSession(request);
    
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = switchCooperativeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { cooperativeId, reason, metadata } = validationResult.data;

    // Check if user can switch to this cooperative
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
    const targetCooperative = await cooperativeService.getCooperativeWithStats(
      cooperativeId,
      {
        user_id: session.user.id,
        user_role: session.user.role,
        cooperative_id: cooperativeId,
      }
    );

    if (!targetCooperative) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cooperative not found',
        },
        { status: 404 }
      );
    }

    // Log the cooperative switch for audit purposes
    await cooperativeService.logCooperativeSwitch({
      userId: session.user.id,
      fromCooperativeId: session.user.cooperativeId,
      toCooperativeId: cooperativeId,
      sessionId: session.csrfToken, // Use CSRF token as session identifier
      switchReason: reason,
      metadata,
    });

    // Update the user's session with new cooperative context
    const response = NextResponse.json({
      success: true,
      data: {
        cooperative: targetCooperative,
        user: {
          ...session.user,
          cooperativeId: cooperativeId,
        },
      },
      meta: {
        switchedAt: new Date().toISOString(),
        switchReason: reason,
        previousCooperativeId: session.user.cooperativeId,
      },
    });

    // Update session with new cooperative context
    await updateSession(request, response, {
      user: {
        ...session.user,
        cooperativeId: cooperativeId,
      },
    });

    return response;

  } catch (error) {
    console.error('Failed to switch cooperative:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to switch cooperative',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}