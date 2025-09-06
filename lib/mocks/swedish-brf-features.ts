/**
 * Mock implementations for Swedish BRF time-dependent features
 * 
 * These mocks simulate Swedish BRF (Bostadsrättförening) operations that depend on time,
 * allowing for comprehensive testing of time-sensitive business logic.
 */

import {
  getCurrentTime,
  getSwedishBRFTimeContext,
  calculateSwedishLateInterest,
  calculateSwedishReminderFees,
  generateSwedishOCR,
  formatSwedishCurrency,
  formatSwedishDate,
  getNextSwedishBusinessDay,
  isSwedishHolidayPeriod,
} from '@/lib/utils/time-travel';

export interface MonthlyFee {
  id: string;
  apartmentId: string;
  apartmentNumber: string;
  year: number;
  month: number;
  baseFee: number;
  parkingFee: number;
  storageFee: number;
  otherFees: Record<string, number>;
  totalAmount: number;
  dueDate: string;
  paymentStatus: 'pending' | 'paid' | 'overdue' | 'cancelled';
  ocrNumber: string;
  generatedAt: string;
  paidAt?: string;
  overdueDays: number;
  lateInterest: number;
  reminderLevel: 0 | 1 | 2 | 3;
  reminderFees: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  supplierOrgNumber?: string;
  totalAmount: number;
  currency: string;
  invoiceDate: string;
  dueDate: string;
  paymentDate?: string;
  paymentStatus: 'pending' | 'paid' | 'overdue' | 'cancelled';
  ocrNumber?: string;
  overdueDays: number;
  lateInterest: number;
  category: string;
}

export interface BoardMeeting {
  id: string;
  meetingNumber: number;
  title: string;
  meetingType: 'regular' | 'extraordinary' | 'annual' | 'constituting';
  scheduledDate: string;
  scheduledTime: string;
  location: string;
  noticeSentDate?: string;
  noticeRequiredByDate: string;
  isNoticeValid: boolean;
  status: 'planned' | 'notice_sent' | 'in_progress' | 'completed' | 'cancelled';
  attendees: string[];
  quorumMet: boolean;
  protocolApproved: boolean;
}

export interface EnergyReport {
  id: string;
  year: number;
  month: number;
  electricityKwh: number;
  heatingKwh: number;
  hotWaterKwh: number;
  totalCost: number;
  costPerSqm: number;
  outdoorTempAvg: number;
  heatingDegreeDays: number;
  reportingDeadline: string;
  isReportingOverdue: boolean;
  reportSubmitted: boolean;
  complianceStatus: 'compliant' | 'pending' | 'overdue' | 'non_compliant';
}

export interface ContractRenewal {
  id: string;
  contractType: string;
  supplierName: string;
  contractStart: string;
  contractEnd: string;
  renewalDeadline: string;
  daysUntilRenewal: number;
  autoRenewal: boolean;
  renewalStatus: 'active' | 'renewal_due' | 'overdue' | 'renewed' | 'terminated';
  renewalNotificationSent: boolean;
  remindersSent: number;
}

/**
 * Generate monthly fees for all apartments
 */
export function generateMonthlyFees(cooperativeId: string, apartmentCount: number = 50): MonthlyFee[] {
  const currentTime = getCurrentTime();
  const brfContext = getSwedishBRFTimeContext(currentTime);
  const currentMonth = currentTime.getMonth() + 1;
  const currentYear = currentTime.getFullYear();

  const monthlyFees: MonthlyFee[] = [];

  for (let i = 1; i <= apartmentCount; i++) {
    const apartmentNumber = i.toString().padStart(4, '0');
    const baseFee = 3500 + (Math.random() * 2000); // 3,500-5,500 SEK
    const parkingFee = Math.random() > 0.6 ? 450 : 0; // 60% have parking
    const storageFee = Math.random() > 0.8 ? 150 : 0; // 20% have storage

    // Create fees for current month and previous months
    for (let monthOffset = -2; monthOffset <= 0; monthOffset++) {
      const feeDate = new Date(currentYear, currentMonth - 1 + monthOffset, 1);
      const feeYear = feeDate.getFullYear();
      const feeMonth = feeDate.getMonth() + 1;
      
      // Due date is last day of the month
      const dueDate = new Date(feeYear, feeMonth, 0);
      const overdueDays = Math.max(0, Math.floor((currentTime.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Determine payment status based on due date and randomness
      let paymentStatus: MonthlyFee['paymentStatus'] = 'pending';
      let paidAt: string | undefined;
      
      if (monthOffset < 0) {
        // Historical months - most should be paid
        if (Math.random() > 0.1) { // 90% paid for old months
          paymentStatus = 'paid';
          const paymentDate = new Date(dueDate.getTime() - Math.random() * 5 * 24 * 60 * 60 * 1000);
          paidAt = paymentDate.toISOString();
        } else if (overdueDays > 0) {
          paymentStatus = 'overdue';
        }
      } else {
        // Current month
        if (overdueDays > 0) {
          paymentStatus = Math.random() > 0.8 ? 'overdue' : 'pending'; // 20% overdue
        }
      }

      const totalAmount = baseFee + parkingFee + storageFee;
      const lateInterest = paymentStatus === 'overdue' ? 
        calculateSwedishLateInterest(totalAmount, overdueDays) : 0;
      
      // Reminder level based on overdue days
      let reminderLevel: MonthlyFee['reminderLevel'] = 0;
      if (overdueDays > 30) reminderLevel = 3;
      else if (overdueDays > 14) reminderLevel = 2;
      else if (overdueDays > 7) reminderLevel = 1;
      
      const reminderFees = reminderLevel > 0 ? calculateSwedishReminderFees(reminderLevel) : 0;

      monthlyFees.push({
        id: `fee_${apartmentNumber}_${feeYear}_${feeMonth}`,
        apartmentId: `apt_${apartmentNumber}`,
        apartmentNumber,
        year: feeYear,
        month: feeMonth,
        baseFee: Math.round(baseFee),
        parkingFee,
        storageFee,
        otherFees: {},
        totalAmount: Math.round(totalAmount),
        dueDate: dueDate.toISOString(),
        paymentStatus,
        ocrNumber: generateSwedishOCR(apartmentNumber, feeYear, feeMonth),
        generatedAt: new Date(feeYear, feeMonth - 1, 1).toISOString(),
        paidAt,
        overdueDays,
        lateInterest: Math.round(lateInterest),
        reminderLevel,
        reminderFees,
      });
    }
  }

  return monthlyFees;
}

/**
 * Generate supplier invoices with Swedish payment terms
 */
export function generateSupplierInvoices(): Invoice[] {
  const currentTime = getCurrentTime();
  const invoices: Invoice[] = [];

  const suppliers = [
    { name: 'Skanska AB', orgNumber: '556000-4615', category: 'Byggunderhåll' },
    { name: 'Fortum Värme AB', orgNumber: '556109-7767', category: 'Fjärrvärme' },
    { name: 'Vattenfall AB', orgNumber: '556036-2138', category: 'El' },
    { name: 'ISS Facility Services AB', orgNumber: '556067-7520', category: 'Städning' },
    { name: 'Stockholms Renhållning AB', orgNumber: '556979-8996', category: 'Avfall' },
    { name: 'Bravida Sverige AB', orgNumber: '556713-6705', category: 'VVS' },
    { name: 'Elektroskandia AB', orgNumber: '556078-4725', category: 'Elektriker' },
  ];

  // Generate invoices for the past 6 months
  for (let monthOffset = -5; monthOffset <= 0; monthOffset++) {
    const invoiceDate = new Date(currentTime.getFullYear(), currentTime.getMonth() + monthOffset, Math.floor(Math.random() * 28) + 1);
    
    suppliers.forEach(supplier => {
      // Not all suppliers invoice every month
      if (Math.random() > 0.3) return;

      const amount = 5000 + Math.random() * 50000; // 5,000-55,000 SEK
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30-day payment terms

      const overdueDays = Math.max(0, Math.floor((currentTime.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Determine payment status
      let paymentStatus: Invoice['paymentStatus'] = 'pending';
      let paymentDate: string | undefined;

      if (monthOffset < -1) {
        // Older invoices - most should be paid
        if (Math.random() > 0.15) { // 85% paid
          paymentStatus = 'paid';
          paymentDate = new Date(dueDate.getTime() - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString();
        } else if (overdueDays > 0) {
          paymentStatus = 'overdue';
        }
      } else if (overdueDays > 0) {
        paymentStatus = Math.random() > 0.9 ? 'overdue' : 'pending'; // 10% overdue for recent
      }

      const lateInterest = paymentStatus === 'overdue' ? 
        calculateSwedishLateInterest(amount, overdueDays, 8.0) : 0;

      invoices.push({
        id: `inv_${supplier.orgNumber}_${invoiceDate.getTime()}`,
        invoiceNumber: `${supplier.name.substring(0, 3).toUpperCase()}${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`,
        supplierName: supplier.name,
        supplierOrgNumber: supplier.orgNumber,
        totalAmount: Math.round(amount),
        currency: 'SEK',
        invoiceDate: invoiceDate.toISOString(),
        dueDate: dueDate.toISOString(),
        paymentDate,
        paymentStatus,
        ocrNumber: Math.random() > 0.5 ? generateSwedishOCR(supplier.orgNumber.substring(-4), dueDate.getFullYear(), dueDate.getMonth() + 1) : undefined,
        overdueDays,
        lateInterest: Math.round(lateInterest),
        category: supplier.category,
      });
    });
  }

  return invoices;
}

/**
 * Generate board meeting schedule with Swedish legal requirements
 */
export function generateBoardMeetings(): BoardMeeting[] {
  const currentTime = getCurrentTime();
  const meetings: BoardMeeting[] = [];
  const currentYear = currentTime.getFullYear();

  // Annual meeting (typically September-November)
  const annualMeetingDate = new Date(currentYear, 9, 15, 19, 0); // October 15, 7 PM
  const annualNoticeDeadline = new Date(annualMeetingDate);
  annualNoticeDeadline.setDate(annualNoticeDeadline.getDate() - 21); // 21 days notice required

  meetings.push({
    id: 'meeting_annual_2024',
    meetingNumber: 1,
    title: 'Årsstämma 2024',
    meetingType: 'annual',
    scheduledDate: annualMeetingDate.toISOString(),
    scheduledTime: '19:00',
    location: 'Föreningens lokal',
    noticeRequiredByDate: annualNoticeDeadline.toISOString(),
    isNoticeValid: currentTime >= annualNoticeDeadline,
    noticeSentDate: currentTime >= annualNoticeDeadline ? annualNoticeDeadline.toISOString() : undefined,
    status: currentTime >= annualMeetingDate ? 'completed' : 
            currentTime >= annualNoticeDeadline ? 'notice_sent' : 'planned',
    attendees: ['member_001', 'member_002', 'member_003', 'member_004', 'member_005'],
    quorumMet: true,
    protocolApproved: currentTime >= annualMeetingDate,
  });

  // Regular board meetings (monthly)
  for (let month = 0; month < 12; month++) {
    if (month === 6 || month === 7) continue; // Summer break

    const meetingDate = new Date(currentYear, month, 15, 18, 30); // 15th of each month at 6:30 PM
    const noticeDeadline = new Date(meetingDate);
    noticeDeadline.setDate(noticeDeadline.getDate() - 7); // 7 days notice for regular meetings

    meetings.push({
      id: `meeting_regular_${currentYear}_${month + 1}`,
      meetingNumber: month + 2,
      title: `Styrelsemöte ${new Date(currentYear, month, 1).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}`,
      meetingType: 'regular',
      scheduledDate: meetingDate.toISOString(),
      scheduledTime: '18:30',
      location: 'Styrelsens mötesrum',
      noticeRequiredByDate: noticeDeadline.toISOString(),
      isNoticeValid: currentTime >= noticeDeadline,
      noticeSentDate: currentTime >= noticeDeadline ? noticeDeadline.toISOString() : undefined,
      status: currentTime >= meetingDate ? 'completed' : 
              currentTime >= noticeDeadline ? 'notice_sent' : 'planned',
      attendees: ['board_001', 'board_002', 'board_003'],
      quorumMet: currentTime >= meetingDate ? Math.random() > 0.1 : false, // 90% quorum success
      protocolApproved: currentTime >= meetingDate,
    });
  }

  return meetings.filter(meeting => new Date(meeting.scheduledDate) >= new Date(currentYear, 0, 1));
}

/**
 * Generate energy consumption reports for Swedish environmental compliance
 */
export function generateEnergyReports(): EnergyReport[] {
  const currentTime = getCurrentTime();
  const reports: EnergyReport[] = [];
  const currentYear = currentTime.getFullYear();

  // Generate monthly reports for the current year
  for (let month = 1; month <= 12; month++) {
    const reportDate = new Date(currentYear, month - 1, 1);
    if (reportDate > currentTime) break; // Don't generate future reports

    // Seasonal variations in energy consumption
    const isHeatingMonth = month >= 10 || month <= 4;
    const baseElectricity = 15000 + (Math.random() * 5000); // kWh
    const heatingMultiplier = isHeatingMonth ? 2.5 + (Math.random() * 1.5) : 0.3 + (Math.random() * 0.2);
    
    const electricityKwh = Math.round(baseElectricity);
    const heatingKwh = Math.round(baseElectricity * heatingMultiplier);
    const hotWaterKwh = Math.round(8000 + (Math.random() * 2000));
    
    const totalKwh = electricityKwh + heatingKwh + hotWaterKwh;
    const costPerKwh = 1.20 + (Math.random() * 0.30); // SEK per kWh
    const totalCost = Math.round(totalKwh * costPerKwh);
    
    // Building area for cost per sqm calculation (typical BRF)
    const totalAreaSqm = 3500;
    const costPerSqm = Math.round(totalCost / totalAreaSqm);

    // Weather data simulation
    const outdoorTempAvg = isHeatingMonth ? -5 + (Math.random() * 15) : 10 + (Math.random() * 15);
    const heatingDegreeDays = Math.max(0, (18 - outdoorTempAvg) * 30); // Simplified calculation

    // Reporting deadline (typically end of February for previous year)
    const reportingDeadline = new Date(currentYear + 1, 1, 28); // February 28 next year
    const isReportingOverdue = currentTime > reportingDeadline && month === 12;

    reports.push({
      id: `energy_${currentYear}_${String(month).padStart(2, '0')}`,
      year: currentYear,
      month,
      electricityKwh,
      heatingKwh,
      hotWaterKwh,
      totalCost,
      costPerSqm,
      outdoorTempAvg: Math.round(outdoorTempAvg * 10) / 10,
      heatingDegreeDays: Math.round(heatingDegreeDays),
      reportingDeadline: reportingDeadline.toISOString(),
      isReportingOverdue,
      reportSubmitted: !isReportingOverdue && Math.random() > 0.2, // 80% submitted on time
      complianceStatus: isReportingOverdue ? 'overdue' : 
                       Math.random() > 0.9 ? 'non_compliant' : 'compliant',
    });
  }

  return reports;
}

/**
 * Generate contract renewals with Swedish business timing
 */
export function generateContractRenewals(): ContractRenewal[] {
  const currentTime = getCurrentTime();
  const renewals: ContractRenewal[] = [];

  const contractTypes = [
    { type: 'Fjärrvärmeavtal', supplier: 'Fortum Värme AB', duration: 24, renewalNotice: 90 },
    { type: 'Elavtal', supplier: 'Vattenfall AB', duration: 12, renewalNotice: 60 },
    { type: 'Städavtal', supplier: 'ISS Facility Services AB', duration: 36, renewalNotice: 180 },
    { type: 'Avfallshantering', supplier: 'Stockholms Renhållning AB', duration: 24, renewalNotice: 120 },
    { type: 'Hissunderhåll', supplier: 'KONE AB', duration: 60, renewalNotice: 365 },
    { type: 'Ventilationsservice', supplier: 'Bravida Sverige AB', duration: 24, renewalNotice: 90 },
    { type: 'Fastighetsskötsel', supplier: 'Coor Service Management AB', duration: 12, renewalNotice: 90 },
  ];

  contractTypes.forEach(contract => {
    // Contract started some time in the past
    const contractStart = new Date(currentTime);
    contractStart.setMonth(contractStart.getMonth() - Math.random() * contract.duration);
    
    const contractEnd = new Date(contractStart);
    contractEnd.setMonth(contractEnd.getMonth() + contract.duration);
    
    const renewalDeadline = new Date(contractEnd);
    renewalDeadline.setDate(renewalDeadline.getDate() - contract.renewalNotice);
    
    const daysUntilRenewal = Math.floor((renewalDeadline.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));
    
    let renewalStatus: ContractRenewal['renewalStatus'] = 'active';
    let renewalNotificationSent = false;
    let remindersSent = 0;
    
    if (currentTime >= contractEnd) {
      renewalStatus = Math.random() > 0.3 ? 'renewed' : 'terminated';
    } else if (daysUntilRenewal <= 0) {
      renewalStatus = 'overdue';
      renewalNotificationSent = true;
      remindersSent = Math.floor(Math.random() * 3) + 1;
    } else if (daysUntilRenewal <= 30) {
      renewalStatus = 'renewal_due';
      renewalNotificationSent = Math.random() > 0.2; // 80% sent
      remindersSent = renewalNotificationSent ? Math.floor(Math.random() * 2) : 0;
    }

    renewals.push({
      id: `contract_${contract.type.toLowerCase().replace(/[^a-z]/g, '_')}`,
      contractType: contract.type,
      supplierName: contract.supplier,
      contractStart: contractStart.toISOString(),
      contractEnd: contractEnd.toISOString(),
      renewalDeadline: renewalDeadline.toISOString(),
      daysUntilRenewal,
      autoRenewal: Math.random() > 0.4, // 60% have auto-renewal
      renewalStatus,
      renewalNotificationSent,
      remindersSent,
    });
  });

  return renewals;
}

/**
 * Get comprehensive Swedish BRF feature mocks
 */
export function getSwedishBRFMocks(cooperativeId: string) {
  const currentTime = getCurrentTime();
  const brfContext = getSwedishBRFTimeContext(currentTime);
  
  return {
    currentTime: currentTime.toISOString(),
    brfContext,
    monthlyFees: generateMonthlyFees(cooperativeId),
    supplierInvoices: generateSupplierInvoices(),
    boardMeetings: generateBoardMeetings(),
    energyReports: generateEnergyReports(),
    contractRenewals: generateContractRenewals(),
    summary: {
      totalOutstandingPayments: 0, // Will be calculated
      overduePaymentCount: 0,
      upcomingMeetings: 0,
      contractsNeedingRenewal: 0,
      overdueReports: 0,
    }
  };
}

/**
 * Mock API endpoints for testing
 */
export const mockAPIEndpoints = {
  '/api/monthly-fees': (cooperativeId: string) => generateMonthlyFees(cooperativeId),
  '/api/invoices': () => generateSupplierInvoices(),
  '/api/board-meetings': () => generateBoardMeetings(),
  '/api/energy-reports': () => generateEnergyReports(),
  '/api/contract-renewals': () => generateContractRenewals(),
  '/api/brf-dashboard': (cooperativeId: string) => getSwedishBRFMocks(cooperativeId),
};