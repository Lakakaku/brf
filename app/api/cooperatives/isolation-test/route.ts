/**
 * API Route: Cooperative Data Isolation Testing
 * Provides endpoints for running isolation tests in development/testing environments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { cooperativeService } from '@/lib/services/cooperative-service';
import { CooperativeIsolationTester, isolationTestUtils } from '@/lib/testing/cooperative-isolation-test';
import { z } from 'zod';

const isolationTestSchema = z.object({
  cooperativeIds: z.array(z.string()).min(1, 'At least one cooperative ID is required'),
  testOptions: z.object({
    includePerformanceTests: z.boolean().optional().default(true),
    includeDataIntegrityTests: z.boolean().optional().default(true),
    includeCrossCooperativeTests: z.boolean().optional().default(true),
    testDepth: z.enum(['basic', 'comprehensive', 'exhaustive']).optional().default('comprehensive'),
  }).optional().default({}),
  generateReport: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  // Only allow in development and testing environments
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ISOLATION_TESTS !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Isolation tests are not available in production' },
      { status: 403 }
    );
  }

  try {
    // Get authenticated session
    const session = await getSession(request);
    
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only allow admin users to run isolation tests
    if (!['admin', 'chairman'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Admin privileges required for isolation testing' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = isolationTestSchema.safeParse(body);

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

    const { cooperativeIds, testOptions, generateReport } = validationResult.data;

    // Get cooperative details for testing
    const cooperatives = await Promise.all(
      cooperativeIds.map(async (id) => {
        const coop = await cooperativeService.getCooperativeWithStats(id, {
          user_id: session.user!.id,
          user_role: session.user!.role,
          cooperative_id: id,
          request_ip: request.headers.get('x-forwarded-for') || '127.0.0.1',
          user_agent: request.headers.get('user-agent') || 'Unknown',
          session_id: session.csrfToken || 'unknown',
        });
        
        if (!coop) {
          throw new Error(`Cooperative not found: ${id}`);
        }
        
        return {
          id: coop.id,
          name: coop.name,
          orgNumber: coop.orgNumber,
          subdomain: coop.subdomain,
          city: coop.city,
          totalApartments: coop.totalApartments,
          subscriptionTier: coop.subscriptionTier,
          subscriptionStatus: coop.subscriptionStatus,
          isTestData: coop.isTestData,
        };
      })
    );

    // Create test context
    const testContext = isolationTestUtils.createTestContext(
      cooperatives[0].id, // Use first cooperative as primary context
      session.user.id,
      session.user.role
    );

    // Initialize tester
    const tester = new CooperativeIsolationTester(testContext);

    // Run isolation tests
    const testSuite = await tester.runFullIsolationTestSuite(cooperatives, testOptions);

    // Generate report if requested
    let report: string | undefined;
    if (generateReport) {
      report = isolationTestUtils.generateTestReport(testSuite);
    }

    return NextResponse.json({
      success: true,
      data: {
        testSuite,
        report,
      },
      meta: {
        executedBy: session.user.id,
        executedAt: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      },
    });

  } catch (error) {
    console.error('Failed to run isolation tests:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run isolation tests',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Get test status and history
export async function GET(request: NextRequest) {
  // Only allow in development and testing environments
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ISOLATION_TESTS !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Isolation tests are not available in production' },
      { status: 403 }
    );
  }

  try {
    // Get authenticated session
    const session = await getSession(request);
    
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get available cooperatives for testing
    const availableCooperatives = await cooperativeService.getAvailableCooperatives(
      session.user.id,
      false, // includeInactive
      true   // includeTestData
    );

    return NextResponse.json({
      success: true,
      data: {
        availableCooperatives,
        testingEnabled: true,
        environment: process.env.NODE_ENV,
        userRole: session.user.role,
        canRunTests: ['admin', 'chairman'].includes(session.user.role),
      },
      meta: {
        requestedBy: session.user.id,
        requestedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Failed to get isolation test status:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get test status',
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}