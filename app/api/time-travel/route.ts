import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';

/**
 * Time Travel API for Testing Swedish BRF Features
 * 
 * This API allows developers and testers to manipulate the system's perception of time
 * for testing time-sensitive features like:
 * - Monthly fee generation and deadlines
 * - Invoice due dates and overdue calculations
 * - Board meeting schedules and deadlines
 * - Energy reporting periods
 * - Contract renewals and expiration dates
 * - Payment reminder schedules
 * - Swedish regulatory reporting deadlines
 */

const timeManipulationSchema = z.object({
  action: z.enum(['set', 'advance', 'reset', 'freeze', 'unfreeze']),
  date: z.string().optional(), // ISO 8601 format for 'set' action
  amount: z.object({
    years: z.number().optional(),
    months: z.number().optional(),
    days: z.number().optional(),
    hours: z.number().optional(),
    minutes: z.number().optional(),
  }).optional(), // For 'advance' action
  timezone: z.string().default('Europe/Stockholm'), // Swedish timezone by default
});

// Time travel session state
interface TimeState {
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

/**
 * GET /api/time-travel
 * Returns current time travel state
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const timeStateJson = cookieStore.get('time-travel-state')?.value;
    
    if (!timeStateJson) {
      // No time travel active - return real time
      return NextResponse.json({
        success: true,
        data: {
          currentTime: new Date().toISOString(),
          realTime: new Date().toISOString(),
          frozen: false,
          timeTravelActive: false,
          timezone: 'Europe/Stockholm',
          manipulationHistory: [],
        }
      });
    }

    const timeState: TimeState = JSON.parse(timeStateJson);
    
    // If not frozen, calculate current time based on elapsed real time
    let currentTime = timeState.currentTime;
    if (!timeState.frozen) {
      const realTimeElapsed = Date.now() - new Date(timeState.realTime).getTime();
      currentTime = new Date(new Date(timeState.currentTime).getTime() + realTimeElapsed).toISOString();
    }

    return NextResponse.json({
      success: true,
      data: {
        currentTime,
        realTime: new Date().toISOString(),
        frozen: timeState.frozen,
        timeTravelActive: true,
        timezone: 'Europe/Stockholm',
        manipulationHistory: timeState.manipulationHistory,
        brfContext: {
          fiscalYear: getFiscalYearInfo(new Date(currentTime)),
          paymentPeriod: getPaymentPeriodInfo(new Date(currentTime)),
          reportingPeriod: getReportingPeriodInfo(new Date(currentTime)),
        }
      }
    });
  } catch (error) {
    console.error('Time travel GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get time travel state' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/time-travel
 * Manipulates system time based on action
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = timeManipulationSchema.parse(body);
    const cookieStore = await cookies();
    
    const timeStateJson = cookieStore.get('time-travel-state')?.value;
    let timeState: TimeState = timeStateJson 
      ? JSON.parse(timeStateJson)
      : {
          currentTime: new Date().toISOString(),
          realTime: new Date().toISOString(),
          frozen: false,
          manipulationHistory: [],
        };

    const previousTime = timeState.currentTime;
    let newTime: string;
    let description: string;

    switch (validatedData.action) {
      case 'set':
        if (!validatedData.date) {
          return NextResponse.json(
            { success: false, error: 'Date is required for set action' },
            { status: 400 }
          );
        }
        newTime = new Date(validatedData.date).toISOString();
        description = `Set time to ${newTime}`;
        break;

      case 'advance':
        if (!validatedData.amount) {
          return NextResponse.json(
            { success: false, error: 'Amount is required for advance action' },
            { status: 400 }
          );
        }
        
        const currentDate = new Date(timeState.currentTime);
        const { years = 0, months = 0, days = 0, hours = 0, minutes = 0 } = validatedData.amount;
        
        currentDate.setFullYear(currentDate.getFullYear() + years);
        currentDate.setMonth(currentDate.getMonth() + months);
        currentDate.setDate(currentDate.getDate() + days);
        currentDate.setHours(currentDate.getHours() + hours);
        currentDate.setMinutes(currentDate.getMinutes() + minutes);
        
        newTime = currentDate.toISOString();
        description = `Advanced time by ${formatTimeDuration(validatedData.amount)}`;
        break;

      case 'freeze':
        timeState.frozen = true;
        newTime = timeState.currentTime;
        description = 'Froze time';
        break;

      case 'unfreeze':
        timeState.frozen = false;
        timeState.realTime = new Date().toISOString(); // Reset real time reference
        newTime = timeState.currentTime;
        description = 'Unfroze time';
        break;

      case 'reset':
        timeState = {
          currentTime: new Date().toISOString(),
          realTime: new Date().toISOString(),
          frozen: false,
          manipulationHistory: [...timeState.manipulationHistory, {
            timestamp: new Date().toISOString(),
            action: 'reset',
            fromTime: timeState.currentTime,
            toTime: new Date().toISOString(),
            description: 'Reset to real time'
          }],
        };
        
        // Clear the cookie
        const response = NextResponse.json({
          success: true,
          data: {
            currentTime: timeState.currentTime,
            realTime: timeState.realTime,
            frozen: false,
            timeTravelActive: false,
            description: 'Reset to real time',
            brfContext: {
              fiscalYear: getFiscalYearInfo(new Date()),
              paymentPeriod: getPaymentPeriodInfo(new Date()),
              reportingPeriod: getReportingPeriodInfo(new Date()),
            }
          }
        });
        
        response.cookies.delete('time-travel-state');
        return response;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update time state
    timeState.currentTime = newTime;
    timeState.realTime = new Date().toISOString();
    
    // Add to history
    timeState.manipulationHistory.push({
      timestamp: new Date().toISOString(),
      action: validatedData.action,
      fromTime: previousTime,
      toTime: newTime,
      description,
    });

    // Keep only last 50 entries in history
    if (timeState.manipulationHistory.length > 50) {
      timeState.manipulationHistory = timeState.manipulationHistory.slice(-50);
    }

    const response = NextResponse.json({
      success: true,
      data: {
        currentTime: newTime,
        realTime: new Date().toISOString(),
        frozen: timeState.frozen,
        timeTravelActive: true,
        description,
        brfContext: {
          fiscalYear: getFiscalYearInfo(new Date(newTime)),
          paymentPeriod: getPaymentPeriodInfo(new Date(newTime)),
          reportingPeriod: getReportingPeriodInfo(new Date(newTime)),
        }
      }
    });

    // Set the time travel state cookie (expires in 24 hours)
    response.cookies.set('time-travel-state', JSON.stringify(timeState), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Time travel POST error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to manipulate time' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/time-travel
 * Resets time travel to real time and clears state
 */
export async function DELETE() {
  try {
    const response = NextResponse.json({
      success: true,
      data: {
        currentTime: new Date().toISOString(),
        timeTravelActive: false,
        description: 'Time travel reset to real time'
      }
    });
    
    response.cookies.delete('time-travel-state');
    return response;
  } catch (error) {
    console.error('Time travel DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset time travel' },
      { status: 500 }
    );
  }
}

// Helper functions for Swedish BRF context
function getFiscalYearInfo(date: Date) {
  // Swedish BRFs typically have fiscal year ending June 30
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

function getPaymentPeriodInfo(date: Date) {
  // Swedish monthly fees are typically due on the last day of the month
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

function getReportingPeriodInfo(date: Date) {
  // Swedish energy reporting periods and other regulatory deadlines
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  // Energy certificate renewal (typically every 10 years)
  const nextEnergyReporting = new Date(year + 1, 1, 1); // February 1st next year
  
  // Annual report filing deadline (typically 6 months after fiscal year end)
  const annualReportDeadline = new Date(year, 11, 31); // December 31st
  
  return {
    currentPeriod: `${year}-${String(month).padStart(2, '0')}`,
    nextEnergyReporting: nextEnergyReporting.toISOString(),
    annualReportDeadline: annualReportDeadline.toISOString(),
    daysUntilAnnualReport: Math.ceil((annualReportDeadline.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)),
  };
}

function formatTimeDuration(amount: { years?: number; months?: number; days?: number; hours?: number; minutes?: number }) {
  const parts = [];
  if (amount.years) parts.push(`${amount.years} year${amount.years !== 1 ? 's' : ''}`);
  if (amount.months) parts.push(`${amount.months} month${amount.months !== 1 ? 's' : ''}`);
  if (amount.days) parts.push(`${amount.days} day${amount.days !== 1 ? 's' : ''}`);
  if (amount.hours) parts.push(`${amount.hours} hour${amount.hours !== 1 ? 's' : ''}`);
  if (amount.minutes) parts.push(`${amount.minutes} minute${amount.minutes !== 1 ? 's' : ''}`);
  return parts.join(', ');
}