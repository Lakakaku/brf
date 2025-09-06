/**
 * Financial Reports API endpoint with RBAC authorization
 * Demonstrates Swedish BRF financial data access with audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthorization, AuthContext } from '@/lib/auth/authorize';
import { authorizeFinancialAccess, createSecurityHeaders } from '@/lib/auth/authorize';
import { logFinancialAccess } from '@/lib/auth/audit';
import { hasPermission } from '@/lib/auth/rbac';

/**
 * GET /api/financial/reports - Get financial reports
 * Requires: canViewFinancialReports permission
 * Swedish BRF context: Monthly fees, invoices, budgets, etc.
 */
export const GET = withAuthorization([
  { type: 'single', permission: 'canViewFinancialReports' }
])(async (req: NextRequest, context: AuthContext): Promise<NextResponse> => {
  try {
    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('type') || 'summary';
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')) : null;
    const format = searchParams.get('format') || 'json'; // json, csv, pdf

    // Validate report type
    const validReportTypes = ['summary', 'monthly_fees', 'invoices', 'budget', 'cash_flow', 'energy'];
    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid report type',
        validTypes: validReportTypes,
        timestamp: new Date().toISOString(),
      }, { 
        status: 400,
        headers: createSecurityHeaders(),
      });
    }

    // Check export permissions for non-JSON formats
    if (format !== 'json' && !hasPermission(context.user.role, 'canExportFinancialData')) {
      return NextResponse.json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Export permission required for non-JSON formats',
        timestamp: new Date().toISOString(),
      }, { 
        status: 403,
        headers: createSecurityHeaders(),
      });
    }

    // Generate mock financial data based on Swedish BRF context
    const generateReportData = (type: string) => {
      switch (type) {
        case 'summary':
          return {
            period: { year, month },
            cooperative: {
              name: 'BRF Eksempel',
              orgNumber: '556123-4567',
              totalApartments: 45,
            },
            income: {
              monthlyFees: 287500, // SEK
              parkingFees: 15750,
              otherIncome: 4200,
              total: 307450,
            },
            expenses: {
              maintenance: 89500,
              utilities: 156200,
              administration: 24000,
              insurance: 18500,
              loans: 125000,
              total: 413200,
            },
            netResult: -105750, // SEK
            cashFlow: {
              operatingActivities: -105750,
              investmentActivities: -25000,
              financingActivities: 130750,
              netChange: 0,
            },
          };

        case 'monthly_fees':
          return {
            period: { year, month },
            totalUnits: 45,
            feeStructure: {
              baseFeePerSqm: 45.50, // SEK per sqm
              parkingFee: 350, // SEK per month
              storageFee: 150, // SEK per month
            },
            collections: {
              totalBilled: 287500,
              totalCollected: 279200,
              outstanding: 8300,
              collectionRate: 97.1, // %
            },
            overdue: [
              { apartmentNumber: '1204', amount: 6400, daysPastDue: 15 },
              { apartmentNumber: '3001', amount: 1900, daysPastDue: 8 },
            ],
          };

        case 'energy':
          return {
            period: { year, month },
            consumption: {
              electricity: { kwh: 12450, cost: 18675, costPerKwh: 1.50 },
              heating: { kwh: 45200, cost: 67800, costPerKwh: 1.50 },
              hotWater: { kwh: 8900, cost: 13350, costPerKwh: 1.50 },
              total: { kwh: 66550, cost: 99825 },
            },
            efficiency: {
              kwhPerSqm: 42.1,
              costPerSqm: 63.15,
              comparedToPreviousYear: -5.2, // % improvement
            },
            targets: {
              energyCertificateClass: 'C',
              targetReduction: 10, // % by next year
              estimatedSavings: 15000, // SEK annually
            },
          };

        default:
          return { message: 'Report data not implemented for this type' };
      }
    };

    const reportData = generateReportData(reportType);

    // Log financial data access
    await logFinancialAccess(
      {
        userId: context.user.id,
        userRole: context.user.role,
        cooperativeId: context.cooperativeId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      },
      `view_${reportType}_report`,
      'financial_report',
      `${reportType}_${year}_${month}`,
      format !== 'json' // Mark as exported if not JSON
    );

    // Handle different export formats
    if (format === 'csv') {
      // TODO: Convert to CSV format
      return new NextResponse('CSV export not implemented', {
        status: 501,
        headers: {
          'Content-Type': 'text/plain',
          ...createSecurityHeaders(),
        },
      });
    }

    if (format === 'pdf') {
      // TODO: Generate PDF report
      return new NextResponse('PDF export not implemented', {
        status: 501,
        headers: {
          'Content-Type': 'text/plain',
          ...createSecurityHeaders(),
        },
      });
    }

    // Return JSON data
    return NextResponse.json({
      data: reportData,
      meta: {
        reportType,
        period: { year, month },
        generatedAt: new Date().toISOString(),
        generatedBy: {
          userId: context.user.id,
          role: context.user.role,
        },
        cooperative: context.cooperativeId,
      },
      permissions: {
        canExport: hasPermission(context.user.role, 'canExportFinancialData'),
        canApprove: hasPermission(context.user.role, 'canApproveInvoices'),
        canCreateInvoices: hasPermission(context.user.role, 'canCreateInvoices'),
      },
    }, {
      status: 200,
      headers: createSecurityHeaders(),
    });

  } catch (error) {
    console.error('Error generating financial report:', error);
    
    return NextResponse.json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to generate financial report',
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
      headers: createSecurityHeaders(),
    });
  }
});

/**
 * POST /api/financial/reports - Generate custom financial report
 * Requires: canViewFinancialReports + treasurer/chairman/admin role
 */
export const POST = withAuthorization([
  { type: 'single', permission: 'canViewFinancialReports' },
  { type: 'hierarchy', minRole: 'treasurer' }
])(async (req: NextRequest, context: AuthContext): Promise<NextResponse> => {
  try {
    const body = await req.json();
    const { 
      reportName,
      dateRange,
      includeCategories,
      groupBy,
      compareWith,
      format = 'json'
    } = body;

    // Validate custom report parameters
    if (!reportName || !dateRange || !dateRange.startDate || !dateRange.endDate) {
      return NextResponse.json({
        error: 'VALIDATION_ERROR',
        message: 'Report name and date range required',
        timestamp: new Date().toISOString(),
      }, { 
        status: 400,
        headers: createSecurityHeaders(),
      });
    }

    // Check export permissions
    if (format !== 'json' && !hasPermission(context.user.role, 'canExportFinancialData')) {
      return NextResponse.json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Export permission required for non-JSON formats',
        timestamp: new Date().toISOString(),
      }, { 
        status: 403,
        headers: createSecurityHeaders(),
      });
    }

    // Generate custom report (mock implementation)
    const customReport = {
      reportName,
      parameters: {
        dateRange,
        includeCategories: includeCategories || ['all'],
        groupBy: groupBy || 'month',
        compareWith: compareWith || null,
      },
      data: {
        summary: {
          totalIncome: 1234567,
          totalExpenses: 987654,
          netResult: 246913,
          periods: 12,
        },
        details: [
          // Mock detailed data
        ],
        comparison: compareWith ? {
          previousPeriod: {
            totalIncome: 1200000,
            totalExpenses: 950000,
            netResult: 250000,
          },
          variance: {
            income: 2.9, // % change
            expenses: 4.0,
            netResult: -1.2,
          },
        } : null,
      },
      charts: {
        incomeByMonth: [], // Chart data
        expensesByCategory: [],
        cashFlowTrend: [],
      },
    };

    // Log custom report generation
    await logFinancialAccess(
      {
        userId: context.user.id,
        userRole: context.user.role,
        cooperativeId: context.cooperativeId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      },
      'generate_custom_report',
      'custom_financial_report',
      crypto.randomUUID(),
      format !== 'json'
    );

    return NextResponse.json({
      data: customReport,
      meta: {
        generatedAt: new Date().toISOString(),
        generatedBy: {
          userId: context.user.id,
          role: context.user.role,
        },
        cooperative: context.cooperativeId,
        format,
      },
    }, {
      status: 201,
      headers: createSecurityHeaders(),
    });

  } catch (error) {
    console.error('Error generating custom financial report:', error);
    
    return NextResponse.json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to generate custom report',
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
      headers: createSecurityHeaders(),
    });
  }
});