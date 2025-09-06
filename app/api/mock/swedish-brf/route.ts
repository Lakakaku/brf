import { NextRequest, NextResponse } from 'next/server';
import { getSwedishBRFMocks } from '@/lib/mocks/swedish-brf-features';
import { getCurrentTime } from '@/lib/utils/time-travel';

/**
 * Mock API for Swedish BRF Features
 * 
 * Provides realistic mock data for Swedish BRF (Bostadsrättförening) features
 * that respect the current time travel state for testing.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperative_id') || 'default_coop';
    const feature = searchParams.get('feature');

    const currentTime = getCurrentTime();
    const mocks = getSwedishBRFMocks(cooperativeId);

    // Calculate summary statistics
    const monthlyFees = mocks.monthlyFees;
    const invoices = mocks.supplierInvoices;
    const meetings = mocks.boardMeetings;
    const renewals = mocks.contractRenewals;
    const reports = mocks.energyReports;

    const totalOutstandingPayments = [
      ...monthlyFees.filter(f => f.paymentStatus !== 'paid'),
      ...invoices.filter(i => i.paymentStatus !== 'paid'),
    ].reduce((sum, payment) => sum + payment.totalAmount, 0);

    const overduePaymentCount = [
      ...monthlyFees.filter(f => f.paymentStatus === 'overdue'),
      ...invoices.filter(i => i.paymentStatus === 'overdue'),
    ].length;

    const upcomingMeetings = meetings.filter(m => 
      new Date(m.scheduledDate) > currentTime &&
      new Date(m.scheduledDate) <= new Date(currentTime.getTime() + 30 * 24 * 60 * 60 * 1000)
    ).length;

    const contractsNeedingRenewal = renewals.filter(r => 
      r.renewalStatus === 'renewal_due' || r.renewalStatus === 'overdue'
    ).length;

    const overdueReports = reports.filter(r => r.isReportingOverdue).length;

    mocks.summary = {
      totalOutstandingPayments,
      overduePaymentCount,
      upcomingMeetings,
      contractsNeedingRenewal,
      overdueReports,
    };

    // Return specific feature data if requested
    if (feature) {
      switch (feature) {
        case 'monthly-fees':
          return NextResponse.json({
            success: true,
            data: mocks.monthlyFees,
            meta: {
              totalCount: mocks.monthlyFees.length,
              overdueCount: mocks.monthlyFees.filter(f => f.paymentStatus === 'overdue').length,
              totalOutstanding: mocks.monthlyFees.filter(f => f.paymentStatus !== 'paid').reduce((sum, f) => sum + f.totalAmount, 0),
            }
          });

        case 'invoices':
          return NextResponse.json({
            success: true,
            data: mocks.supplierInvoices,
            meta: {
              totalCount: mocks.supplierInvoices.length,
              overdueCount: mocks.supplierInvoices.filter(i => i.paymentStatus === 'overdue').length,
              totalOutstanding: mocks.supplierInvoices.filter(i => i.paymentStatus !== 'paid').reduce((sum, i) => sum + i.totalAmount, 0),
            }
          });

        case 'board-meetings':
          return NextResponse.json({
            success: true,
            data: mocks.boardMeetings,
            meta: {
              totalCount: mocks.boardMeetings.length,
              upcomingCount: mocks.boardMeetings.filter(m => new Date(m.scheduledDate) > currentTime).length,
              noticeRequiredCount: mocks.boardMeetings.filter(m => !m.isNoticeValid && new Date(m.scheduledDate) > currentTime).length,
            }
          });

        case 'energy-reports':
          return NextResponse.json({
            success: true,
            data: mocks.energyReports,
            meta: {
              totalCount: mocks.energyReports.length,
              overdueCount: mocks.energyReports.filter(r => r.isReportingOverdue).length,
              complianceRate: mocks.energyReports.filter(r => r.complianceStatus === 'compliant').length / mocks.energyReports.length,
            }
          });

        case 'contract-renewals':
          return NextResponse.json({
            success: true,
            data: mocks.contractRenewals,
            meta: {
              totalCount: mocks.contractRenewals.length,
              renewalsDueCount: mocks.contractRenewals.filter(r => r.renewalStatus === 'renewal_due').length,
              overdueCount: mocks.contractRenewals.filter(r => r.renewalStatus === 'overdue').length,
            }
          });

        case 'dashboard-summary':
          return NextResponse.json({
            success: true,
            data: {
              currentTime: mocks.currentTime,
              brfContext: mocks.brfContext,
              summary: mocks.summary,
              criticalAlerts: generateCriticalAlerts(mocks),
              upcomingDeadlines: generateUpcomingDeadlines(mocks),
            }
          });

        default:
          return NextResponse.json(
            { success: false, error: 'Unknown feature requested' },
            { status: 400 }
          );
      }
    }

    // Return all data
    return NextResponse.json({
      success: true,
      data: mocks,
    });

  } catch (error) {
    console.error('Swedish BRF Mock API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate mock data' },
      { status: 500 }
    );
  }
}

/**
 * Generate critical alerts based on current mock data
 */
function generateCriticalAlerts(mocks: ReturnType<typeof getSwedishBRFMocks>) {
  const alerts = [];

  // Overdue payments alert
  const overduePayments = [
    ...mocks.monthlyFees.filter(f => f.paymentStatus === 'overdue'),
    ...mocks.supplierInvoices.filter(i => i.paymentStatus === 'overdue'),
  ];

  if (overduePayments.length > 0) {
    const totalOverdue = overduePayments.reduce((sum, p) => sum + p.totalAmount, 0);
    alerts.push({
      type: 'overdue_payments',
      severity: 'high',
      title: `${overduePayments.length} förfallna betalningar`,
      description: `Totalt ${Math.round(totalOverdue).toLocaleString('sv-SE')} SEK förfallna betalningar kräver åtgärd`,
      actionRequired: 'Skicka påminnelser och inkassokrav',
      dueDate: new Date().toISOString(),
    });
  }

  // Board meeting notice alerts
  const upcomingMeetings = mocks.boardMeetings.filter(m => 
    new Date(m.scheduledDate) > new Date() && !m.isNoticeValid
  );

  upcomingMeetings.forEach(meeting => {
    alerts.push({
      type: 'meeting_notice_required',
      severity: 'medium',
      title: `Kallelse krävs för ${meeting.title}`,
      description: `Kallelse måste skickas senast ${new Date(meeting.noticeRequiredByDate).toLocaleDateString('sv-SE')}`,
      actionRequired: 'Skicka möteskallelse till alla medlemmar',
      dueDate: meeting.noticeRequiredByDate,
    });
  });

  // Contract renewal alerts
  const contractsNeedingRenewal = mocks.contractRenewals.filter(r => 
    r.renewalStatus === 'renewal_due' || r.renewalStatus === 'overdue'
  );

  contractsNeedingRenewal.forEach(contract => {
    alerts.push({
      type: 'contract_renewal',
      severity: contract.renewalStatus === 'overdue' ? 'high' : 'medium',
      title: `${contract.contractType} behöver förnyas`,
      description: `Kontrakt med ${contract.supplierName} ${contract.renewalStatus === 'overdue' ? 'är försenat' : 'behöver förnyas'}`,
      actionRequired: contract.renewalStatus === 'overdue' ? 'Akut förnyelse krävs' : 'Kontakta leverantör för förnyelse',
      dueDate: contract.renewalDeadline,
    });
  });

  // Energy reporting alerts
  const overdueReports = mocks.energyReports.filter(r => r.isReportingOverdue);
  
  if (overdueReports.length > 0) {
    alerts.push({
      type: 'energy_reporting_overdue',
      severity: 'high',
      title: 'Energirapportering försenad',
      description: `${overdueReports.length} månaders energirapporter är försenade`,
      actionRequired: 'Lämna in miljörapporter till myndigheter',
      dueDate: overdueReports[0].reportingDeadline,
    });
  }

  return alerts.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder];
  });
}

/**
 * Generate upcoming deadlines
 */
function generateUpcomingDeadlines(mocks: ReturnType<typeof getSwedishBRFMocks>) {
  const currentTime = new Date();
  const deadlines = [];

  // Payment deadlines (next 30 days)
  const upcomingPayments = [
    ...mocks.monthlyFees.filter(f => {
      const dueDate = new Date(f.dueDate);
      return dueDate > currentTime && dueDate <= new Date(currentTime.getTime() + 30 * 24 * 60 * 60 * 1000);
    }),
    ...mocks.supplierInvoices.filter(i => {
      const dueDate = new Date(i.dueDate);
      return dueDate > currentTime && dueDate <= new Date(currentTime.getTime() + 30 * 24 * 60 * 60 * 1000);
    }),
  ];

  upcomingPayments.forEach(payment => {
    deadlines.push({
      type: 'payment_due',
      title: `Betalning förfaller`,
      description: 'totalAmount' in payment ? 
        `Månadsavgift lägenhet ${payment.apartmentNumber}: ${payment.totalAmount.toLocaleString('sv-SE')} SEK` :
        `Faktura ${payment.invoiceNumber}: ${payment.totalAmount.toLocaleString('sv-SE')} SEK`,
      dueDate: payment.dueDate,
      daysUntilDue: Math.floor((new Date(payment.dueDate).getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)),
    });
  });

  // Board meeting deadlines
  const upcomingMeetings = mocks.boardMeetings.filter(m => {
    const meetingDate = new Date(m.scheduledDate);
    return meetingDate > currentTime && meetingDate <= new Date(currentTime.getTime() + 60 * 24 * 60 * 60 * 1000);
  });

  upcomingMeetings.forEach(meeting => {
    deadlines.push({
      type: 'board_meeting',
      title: meeting.title,
      description: `${meeting.location} kl ${meeting.scheduledTime}`,
      dueDate: meeting.scheduledDate,
      daysUntilDue: Math.floor((new Date(meeting.scheduledDate).getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)),
    });
  });

  // Fiscal year end deadline
  const fiscalYearEnd = new Date(mocks.brfContext.fiscalYear.fiscalYearEnd);
  if (fiscalYearEnd > currentTime && fiscalYearEnd <= new Date(currentTime.getTime() + 90 * 24 * 60 * 60 * 1000)) {
    deadlines.push({
      type: 'fiscal_year_end',
      title: 'Verksamhetsårets slut',
      description: 'Förbered årsbokslut och revisioner',
      dueDate: fiscalYearEnd.toISOString(),
      daysUntilDue: Math.floor((fiscalYearEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)),
    });
  }

  return deadlines
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 10); // Top 10 upcoming deadlines
}