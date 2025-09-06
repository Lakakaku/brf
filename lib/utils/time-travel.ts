/**
 * Time Travel Utilities for Swedish BRF Testing
 * 
 * This module provides utilities for time manipulation in testing environments.
 * It allows developers to simulate different dates/times for testing time-dependent
 * features specific to Swedish BRF (Bostadsrättföreningar) management.
 */

import { cookies } from 'next/headers';

export interface TimeState {
  currentTime: string; // ISO string
  realTime: string; // Original real time when manipulation started
  frozen: boolean;
  manipulationHistory: Array<{
    timestamp: string;
    action: string;
    fromTime: string;
    toTime: string;
    description: string;
  }>;
}

export interface SwedishBRFTimeContext {
  fiscalYear: {
    fiscalYear: string; // e.g., "2024/2025"
    fiscalYearStart: string;
    fiscalYearEnd: string;
    daysUntilFiscalYearEnd: number;
  };
  paymentPeriod: {
    currentMonth: string; // e.g., "2024-03"
    paymentDueDate: string;
    daysUntilDue: number;
    isOverdue: boolean;
  };
  reportingPeriod: {
    currentPeriod: string;
    nextEnergyReporting: string;
    annualReportDeadline: string;
    daysUntilAnnualReport: number;
  };
  heatingPeriod: {
    isHeatingPeriod: boolean;
    heatingSeasonStart: string;
    heatingSeasonEnd: string;
    daysInHeatingPeriod: number;
  };
  maintenancePeriod: {
    isMaintenanceSeason: boolean;
    maintenanceSeasonStart: string;
    maintenanceSeasonEnd: string;
    optimalMaintenanceWindow: boolean;
  };
}

/**
 * Get the current time considering time travel state
 */
export function getCurrentTime(): Date {
  if (typeof window !== 'undefined') {
    // Client-side: Check localStorage for time travel state
    const timeStateJson = localStorage.getItem('time-travel-state');
    if (timeStateJson) {
      try {
        const timeState: TimeState = JSON.parse(timeStateJson);
        
        if (timeState.frozen) {
          return new Date(timeState.currentTime);
        }
        
        // Calculate elapsed time since manipulation
        const realTimeElapsed = Date.now() - new Date(timeState.realTime).getTime();
        return new Date(new Date(timeState.currentTime).getTime() + realTimeElapsed);
      } catch (error) {
        console.warn('Invalid time travel state in localStorage:', error);
      }
    }
  } else {
    // Server-side: Check cookies for time travel state
    try {
      const cookieStore = cookies();
      const timeStateJson = cookieStore.get('time-travel-state')?.value;
      
      if (timeStateJson) {
        const timeState: TimeState = JSON.parse(timeStateJson);
        
        if (timeState.frozen) {
          return new Date(timeState.currentTime);
        }
        
        // Calculate elapsed time since manipulation
        const realTimeElapsed = Date.now() - new Date(timeState.realTime).getTime();
        return new Date(new Date(timeState.currentTime).getTime() + realTimeElapsed);
      }
    } catch (error) {
      console.warn('Failed to read time travel state from cookies:', error);
    }
  }
  
  // Default to real time
  return new Date();
}

/**
 * Check if time travel is currently active
 */
export function isTimeTravelActive(): boolean {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('time-travel-state') !== null;
  } else {
    try {
      const cookieStore = cookies();
      return cookieStore.get('time-travel-state') !== undefined;
    } catch {
      return false;
    }
  }
}

/**
 * Get comprehensive Swedish BRF time context
 */
export function getSwedishBRFTimeContext(date?: Date): SwedishBRFTimeContext {
  const currentTime = date || getCurrentTime();
  
  return {
    fiscalYear: getFiscalYearInfo(currentTime),
    paymentPeriod: getPaymentPeriodInfo(currentTime),
    reportingPeriod: getReportingPeriodInfo(currentTime),
    heatingPeriod: getHeatingPeriodInfo(currentTime),
    maintenancePeriod: getMaintenancePeriodInfo(currentTime),
  };
}

/**
 * Swedish fiscal year information (typically July 1 - June 30)
 */
export function getFiscalYearInfo(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  const fiscalYear = month > 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const fiscalYearStart = month > 6 ? new Date(year, 6, 1) : new Date(year - 1, 6, 1);
  const fiscalYearEnd = month > 6 ? new Date(year + 1, 5, 30) : new Date(year, 5, 30);
  
  return {
    fiscalYear,
    fiscalYearStart: fiscalYearStart.toISOString(),
    fiscalYearEnd: fiscalYearEnd.toISOString(),
    daysUntilFiscalYearEnd: Math.ceil((fiscalYearEnd.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)),
  };
}

/**
 * Monthly payment period information
 */
export function getPaymentPeriodInfo(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  return {
    currentMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
    paymentDueDate: lastDayOfMonth.toISOString(),
    daysUntilDue: Math.ceil((lastDayOfMonth.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)),
    isOverdue: date > lastDayOfMonth,
  };
}

/**
 * Reporting period information for Swedish regulations
 */
export function getReportingPeriodInfo(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  // Energy reporting deadline (February 1st for previous year)
  const nextEnergyReporting = month <= 1 ? 
    new Date(year, 1, 1) : 
    new Date(year + 1, 1, 1);
  
  // Annual report deadline (December 31st)
  const annualReportDeadline = new Date(year, 11, 31);
  
  return {
    currentPeriod: `${year}-${String(month).padStart(2, '0')}`,
    nextEnergyReporting: nextEnergyReporting.toISOString(),
    annualReportDeadline: annualReportDeadline.toISOString(),
    daysUntilAnnualReport: Math.ceil((annualReportDeadline.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)),
  };
}

/**
 * Heating period information (October 1 - April 30)
 */
export function getHeatingPeriodInfo(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  // Heating season typically runs October 1 to April 30
  const currentYearStart = new Date(year, 9, 1); // October 1
  const currentYearEnd = new Date(year + 1, 3, 30); // April 30 next year
  const previousYearStart = new Date(year - 1, 9, 1);
  const currentSeasonEnd = new Date(year, 3, 30); // April 30 this year
  
  let isHeatingPeriod: boolean;
  let heatingSeasonStart: Date;
  let heatingSeasonEnd: Date;
  
  if (month >= 10) {
    // October-December: current heating season
    isHeatingPeriod = true;
    heatingSeasonStart = currentYearStart;
    heatingSeasonEnd = currentYearEnd;
  } else if (month <= 4) {
    // January-April: continuing heating season from previous year
    isHeatingPeriod = true;
    heatingSeasonStart = previousYearStart;
    heatingSeasonEnd = currentSeasonEnd;
  } else {
    // May-September: not heating season
    isHeatingPeriod = false;
    heatingSeasonStart = currentYearStart;
    heatingSeasonEnd = currentYearEnd;
  }
  
  const daysInHeatingPeriod = isHeatingPeriod ? 
    Math.ceil((date.getTime() - heatingSeasonStart.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  return {
    isHeatingPeriod,
    heatingSeasonStart: heatingSeasonStart.toISOString(),
    heatingSeasonEnd: heatingSeasonEnd.toISOString(),
    daysInHeatingPeriod,
  };
}

/**
 * Maintenance period information (May-September optimal)
 */
export function getMaintenancePeriodInfo(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  // Maintenance season typically May 1 - September 30
  const maintenanceSeasonStart = new Date(year, 4, 1); // May 1
  const maintenanceSeasonEnd = new Date(year, 8, 30); // September 30
  
  const isMaintenanceSeason = month >= 5 && month <= 9;
  
  // Optimal maintenance window: June-August (best weather)
  const optimalMaintenanceWindow = month >= 6 && month <= 8;
  
  return {
    isMaintenanceSeason,
    maintenanceSeasonStart: maintenanceSeasonStart.toISOString(),
    maintenanceSeasonEnd: maintenanceSeasonEnd.toISOString(),
    optimalMaintenanceWindow,
  };
}

/**
 * Calculate Swedish interest for late payments
 * Uses Swedish National Debt Office reference rate + margin
 */
export function calculateSwedishLateInterest(
  principal: number, 
  daysOverdue: number, 
  baseRate: number = 8.0
): number {
  // Swedish late payment interest: reference rate + 8% per annum
  // Calculated daily: (principal * rate) / 365 * days
  const annualRate = baseRate / 100;
  const dailyRate = annualRate / 365;
  return principal * dailyRate * daysOverdue;
}

/**
 * Calculate Swedish payment reminder fees
 */
export function calculateSwedishReminderFees(reminderLevel: 1 | 2 | 3): number {
  // Standard Swedish reminder fees (as of 2024)
  const fees = {
    1: 60,    // First reminder
    2: 130,   // Second reminder  
    3: 220,   // Final notice before debt collection
  };
  
  return fees[reminderLevel];
}

/**
 * Check if date falls within Swedish holiday periods (affects payment processing)
 */
export function isSwedishHolidayPeriod(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Major Swedish holiday periods affecting business operations
  return (
    // Christmas/New Year period
    (month === 12 && day >= 20) || (month === 1 && day <= 6) ||
    // Midsummer period (late June)
    (month === 6 && day >= 20) ||
    // Easter period (varies by year, simplified check for March/April)
    (month === 3 && day >= 25) || (month === 4 && day <= 5) ||
    // Swedish National Day
    (month === 6 && day === 6)
  );
}

/**
 * Get next business day considering Swedish holidays
 */
export function getNextSwedishBusinessDay(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  // Skip weekends
  while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  // Skip holiday periods (simplified)
  while (isSwedishHolidayPeriod(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
    // Skip weekends again after advancing
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
  }
  
  return nextDay;
}

/**
 * Format Swedish currency
 */
export function formatSwedishCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date in Swedish format
 */
export function formatSwedishDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE').format(date);
}

/**
 * Generate Swedish OCR number for payments
 */
export function generateSwedishOCR(apartmentNumber: string, year: number, month: number): string {
  // Format: apartment number + year + month + check digit
  const base = `${apartmentNumber.padStart(3, '0')}${year}${String(month).padStart(2, '0')}`;
  const checkDigit = calculateLuhnCheckDigit(base);
  return `${base}${checkDigit}`;
}

/**
 * Calculate Luhn check digit for OCR numbers
 */
function calculateLuhnCheckDigit(number: string): number {
  const digits = number.split('').map(Number);
  let sum = 0;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    if ((digits.length - i) % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }
    sum += digit;
  }
  
  return (10 - (sum % 10)) % 10;
}