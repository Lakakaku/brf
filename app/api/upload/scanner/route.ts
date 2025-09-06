/**
 * Scanner Discovery and Management API
 * Handles scanner discovery, status monitoring, and basic management for BRF Portal
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { mockScannerService } from '@/lib/scanner/mock-service';
import { ScannerMessages } from '@/lib/scanner/types';
import { logEvent } from '@/lib/monitoring/events';
import { z } from 'zod';

// Validation schemas
const ScannerTestSchema = z.object({
  scanner_id: z.string().min(1),
});

const ScannerFilterSchema = z.object({
  status: z.enum(['online', 'offline', 'scanning', 'error', 'maintenance', 'disabled']).optional(),
  brand: z.enum(['Canon', 'Brother', 'HP', 'Epson', 'Xerox', 'Konica Minolta', 'Sharp', 'Ricoh']).optional(),
  location: z.string().optional(),
});

/**
 * GET /api/upload/scanner - Discover and list available scanners
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request, {
      permissions: ['canUploadDocuments'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        { 
          error: ScannerMessages.errors.AUTHENTICATION_FAILED,
          code: 'AUTHENTICATION_REQUIRED' 
        },
        { status: 401 }
      );
    }

    const { user } = authResult;

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const filterParams = {
      status: searchParams.get('status'),
      brand: searchParams.get('brand'),
      location: searchParams.get('location'),
    };

    const filterResult = ScannerFilterSchema.safeParse(filterParams);
    if (!filterResult.success) {
      return NextResponse.json(
        { 
          error: 'Ogiltiga filterparametrar',
          details: filterResult.error.errors,
          code: 'INVALID_FILTER_PARAMS' 
        },
        { status: 400 }
      );
    }

    // Discover scanners for the cooperative
    const scanners = await mockScannerService.discoverScanners(user.cooperativeId);

    // Apply filters
    let filteredScanners = scanners;
    const filters = filterResult.data;

    if (filters.status) {
      filteredScanners = filteredScanners.filter(scanner => scanner.status === filters.status);
    }
    if (filters.brand) {
      filteredScanners = filteredScanners.filter(scanner => scanner.brand === filters.brand);
    }
    if (filters.location) {
      filteredScanners = filteredScanners.filter(scanner => 
        scanner.location?.toLowerCase().includes(filters.location!.toLowerCase())
      );
    }

    // Format response with Swedish status messages
    const formattedScanners = filteredScanners.map(scanner => ({
      id: scanner.id,
      name: scanner.name,
      model: scanner.model,
      brand: scanner.brand,
      ip_address: scanner.ip_address,
      status: scanner.status,
      status_text: ScannerMessages.status[scanner.status.toUpperCase() as keyof typeof ScannerMessages.status],
      location: scanner.location,
      capabilities: scanner.capabilities,
      last_seen: scanner.last_seen,
      is_available: scanner.status === 'online',
    }));

    // Group scanners by status for summary
    const statusSummary = filteredScanners.reduce((acc, scanner) => {
      acc[scanner.status] = (acc[scanner.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Log successful scanner discovery
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'scanner_discovery',
      event_level: 'info',
      event_source: 'scanner_api',
      event_message: `Scanner discovery completed`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        scanners_found: filteredScanners.length,
        status_summary: statusSummary,
        filters_applied: filters,
        endpoint: '/api/upload/scanner',
        method: 'GET',
      },
    });

    return NextResponse.json({
      success: true,
      message: ScannerMessages.info.DISCOVERING_SCANNERS,
      data: {
        scanners: formattedScanners,
        summary: {
          total_scanners: filteredScanners.length,
          online_scanners: statusSummary.online || 0,
          offline_scanners: statusSummary.offline || 0,
          scanning_scanners: statusSummary.scanning || 0,
          error_scanners: statusSummary.error || 0,
          last_discovery: new Date().toISOString(),
        },
        filters_applied: filters,
      },
    });

  } catch (error) {
    console.error('Scanner discovery error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'scanner_discovery_error',
        event_level: 'error',
        event_source: 'scanner_api',
        event_message: `Scanner discovery failed`,
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          endpoint: '/api/upload/scanner',
          method: 'GET',
          error: error instanceof Error ? error.stack : error,
        },
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : ScannerMessages.errors.NETWORK_ERROR,
        code: 'SCANNER_DISCOVERY_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload/scanner - Test scanner connection or perform scanner actions
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request, {
      permissions: ['canUploadDocuments'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        { 
          error: ScannerMessages.errors.AUTHENTICATION_FAILED,
          code: 'AUTHENTICATION_REQUIRED' 
        },
        { status: 401 }
      );
    }

    const { user } = authResult;

    // Parse and validate request body
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'test';

    if (action === 'test') {
      // Test scanner connection
      const validationResult = ScannerTestSchema.safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          { 
            error: 'Ogiltiga parametrar för skannertest',
            details: validationResult.error.errors,
            code: 'VALIDATION_FAILED' 
          },
          { status: 400 }
        );
      }

      const { scanner_id } = validationResult.data;

      // Get scanner details first
      const scanner = await mockScannerService.getScanner(scanner_id);
      if (!scanner) {
        return NextResponse.json(
          { 
            error: ScannerMessages.errors.SCANNER_NOT_FOUND,
            code: 'SCANNER_NOT_FOUND' 
          },
          { status: 404 }
        );
      }

      // Check if user has access to this scanner's cooperative
      if (scanner.cooperative_id !== user.cooperativeId && !scanner.cooperative_id.startsWith('mock-coop')) {
        return NextResponse.json(
          { 
            error: ScannerMessages.errors.PERMISSION_DENIED,
            code: 'PERMISSION_DENIED' 
          },
          { status: 403 }
        );
      }

      // Test connection
      const connectionTest = await mockScannerService.testConnection(scanner_id);

      // Log connection test
      await logEvent({
        cooperative_id: user.cooperativeId,
        event_type: 'scanner_connection_test',
        event_level: connectionTest ? 'info' : 'warning',
        event_source: 'scanner_api',
        event_message: `Scanner connection test ${connectionTest ? 'successful' : 'failed'}`,
        user_id: user.id,
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          scanner_id: scanner_id,
          scanner_name: scanner.name,
          scanner_brand: scanner.brand,
          test_result: connectionTest,
          endpoint: '/api/upload/scanner',
          method: 'POST',
          action: 'test',
        },
      });

      if (connectionTest) {
        return NextResponse.json({
          success: true,
          message: ScannerMessages.success.SCANNER_CONNECTED,
          data: {
            scanner: {
              id: scanner.id,
              name: scanner.name,
              status: scanner.status,
              status_text: ScannerMessages.status[scanner.status.toUpperCase() as keyof typeof ScannerMessages.status],
              last_seen: scanner.last_seen,
              capabilities: scanner.capabilities,
            },
            connection_test: {
              success: true,
              tested_at: new Date().toISOString(),
              response_time: Math.round(Math.random() * 500 + 100) + 'ms', // Simulated response time
            },
          },
        });
      } else {
        return NextResponse.json(
          {
            error: scanner.status === 'offline' ? ScannerMessages.errors.SCANNER_OFFLINE : ScannerMessages.errors.NETWORK_ERROR,
            code: 'CONNECTION_TEST_FAILED',
            data: {
              scanner: {
                id: scanner.id,
                name: scanner.name,
                status: scanner.status,
                status_text: ScannerMessages.status[scanner.status.toUpperCase() as keyof typeof ScannerMessages.status],
              },
              connection_test: {
                success: false,
                tested_at: new Date().toISOString(),
                error_details: scanner.status === 'offline' ? 'Skannern svarar inte' : 'Nätverksfel vid anslutning',
              },
            },
          },
          { status: 503 }
        );
      }
    }

    // Unknown action
    return NextResponse.json(
      { 
        error: `Okänd åtgärd: ${action}`,
        code: 'UNKNOWN_ACTION' 
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('Scanner action error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'scanner_action_error',
        event_level: 'error',
        event_source: 'scanner_api',
        event_message: `Scanner action failed`,
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          endpoint: '/api/upload/scanner',
          method: 'POST',
          error: error instanceof Error ? error.stack : error,
        },
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : ScannerMessages.errors.NETWORK_ERROR,
        code: 'SCANNER_ACTION_FAILED'
      },
      { status: 500 }
    );
  }
}