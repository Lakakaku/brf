import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Time Travel Middleware
 * 
 * Middleware to inject time travel state into API requests and responses,
 * ensuring all time-dependent operations respect the current time travel configuration.
 */

export interface TimeTravelContext {
  currentTime: Date;
  realTime: Date;
  timeTravelActive: boolean;
  frozen: boolean;
  brfContext?: any;
}

/**
 * Extract time travel context from request
 */
export async function getTimeTravelContext(): Promise<TimeTravelContext> {
  try {
    const cookieStore = await cookies();
    const timeStateJson = cookieStore.get('time-travel-state')?.value;
    
    if (!timeStateJson) {
      // No time travel active
      const now = new Date();
      return {
        currentTime: now,
        realTime: now,
        timeTravelActive: false,
        frozen: false,
      };
    }

    const timeState = JSON.parse(timeStateJson);
    let currentTime = new Date(timeState.currentTime);
    
    // If not frozen, calculate current time based on elapsed real time
    if (!timeState.frozen) {
      const realTimeElapsed = Date.now() - new Date(timeState.realTime).getTime();
      currentTime = new Date(new Date(timeState.currentTime).getTime() + realTimeElapsed);
    }

    return {
      currentTime,
      realTime: new Date(),
      timeTravelActive: true,
      frozen: timeState.frozen,
      brfContext: calculateBRFContext(currentTime),
    };
  } catch (error) {
    console.error('Failed to extract time travel context:', error);
    const now = new Date();
    return {
      currentTime: now,
      realTime: now,
      timeTravelActive: false,
      frozen: false,
    };
  }
}

/**
 * Calculate Swedish BRF context for a given date
 */
function calculateBRFContext(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  // Fiscal year (July 1 - June 30)
  const fiscalYear = month > 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const fiscalYearStart = month > 6 ? new Date(year, 6, 1) : new Date(year - 1, 6, 1);
  const fiscalYearEnd = month > 6 ? new Date(year + 1, 5, 30) : new Date(year, 5, 30);
  
  // Payment period (last day of month)
  const lastDayOfMonth = new Date(year, month, 0);
  
  // Heating season (October - April)
  const isHeatingPeriod = month >= 10 || month <= 4;
  
  // Maintenance season (May - September)
  const isMaintenanceSeason = month >= 5 && month <= 9;
  
  return {
    fiscalYear: {
      fiscalYear,
      fiscalYearStart: fiscalYearStart.toISOString(),
      fiscalYearEnd: fiscalYearEnd.toISOString(),
      daysUntilFiscalYearEnd: Math.ceil((fiscalYearEnd.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)),
    },
    paymentPeriod: {
      currentMonth: `${year}-${String(month).padStart(2, '0')}`,
      paymentDueDate: lastDayOfMonth.toISOString(),
      daysUntilDue: Math.ceil((lastDayOfMonth.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)),
      isOverdue: date > lastDayOfMonth,
    },
    heatingPeriod: {
      isHeatingPeriod,
      season: isHeatingPeriod ? 'heating' : 'non-heating',
    },
    maintenancePeriod: {
      isMaintenanceSeason,
      optimalWindow: month >= 6 && month <= 8, // June-August
    },
    businessContext: {
      isWorkingHours: date.getDay() >= 1 && date.getDay() <= 5 && date.getHours() >= 8 && date.getHours() < 17,
      isSwedenOfficeHours: date.getDay() >= 1 && date.getDay() <= 5 && date.getHours() >= 9 && date.getHours() < 16,
      isPaymentProcessingTime: date.getDay() >= 1 && date.getDay() <= 5 && date.getHours() >= 6 && date.getHours() < 20,
    }
  };
}

/**
 * Middleware for time travel-aware API responses
 */
export function withTimeTravelContext<T = any>(
  handler: (request: NextRequest, context: TimeTravelContext) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    try {
      const timeTravelContext = await getTimeTravelContext();
      
      // Add time travel headers to response
      const response = await handler(request, timeTravelContext);
      
      // Add time travel information to response headers
      response.headers.set('X-Time-Travel-Active', timeTravelContext.timeTravelActive.toString());
      response.headers.set('X-Current-Time', timeTravelContext.currentTime.toISOString());
      
      if (timeTravelContext.timeTravelActive) {
        response.headers.set('X-Real-Time', timeTravelContext.realTime.toISOString());
        response.headers.set('X-Time-Frozen', timeTravelContext.frozen.toString());
      }
      
      return response;
    } catch (error) {
      console.error('Time travel middleware error:', error);
      
      // Fallback to normal processing if time travel context fails
      const now = new Date();
      const fallbackContext: TimeTravelContext = {
        currentTime: now,
        realTime: now,
        timeTravelActive: false,
        frozen: false,
      };
      
      return handler(request, fallbackContext);
    }
  };
}

/**
 * Higher-order function to create time travel-aware API handlers
 */
export function createTimeTravelHandler<T = any>(
  handler: (request: NextRequest, context: TimeTravelContext) => Promise<NextResponse<T>>
) {
  return withTimeTravelContext(handler);
}

/**
 * Utility to check if request is from a time travel session
 */
export function isTimeTravelRequest(request: NextRequest): boolean {
  const timeState = request.cookies.get('time-travel-state');
  return timeState !== undefined;
}

/**
 * Utility to get current time from request context (respects time travel)
 */
export async function getCurrentTimeFromRequest(): Promise<Date> {
  const context = await getTimeTravelContext();
  return context.currentTime;
}

/**
 * Response formatter that includes time travel context
 */
export function createTimeTravelResponse<T = any>(
  data: T, 
  context: TimeTravelContext, 
  options: { 
    status?: number;
    includeBRFContext?: boolean;
    includeTimestamp?: boolean;
  } = {}
): NextResponse {
  const responseData: any = {
    success: true,
    data,
  };

  if (options.includeTimestamp !== false) {
    responseData.timestamp = context.currentTime.toISOString();
  }

  if (context.timeTravelActive) {
    responseData.timeTravel = {
      active: true,
      currentTime: context.currentTime.toISOString(),
      realTime: context.realTime.toISOString(),
      frozen: context.frozen,
    };
  }

  if (options.includeBRFContext && context.brfContext) {
    responseData.brfContext = context.brfContext;
  }

  const response = NextResponse.json(responseData, { 
    status: options.status || 200 
  });

  // Add time travel headers
  response.headers.set('X-Time-Travel-Active', context.timeTravelActive.toString());
  response.headers.set('X-Current-Time', context.currentTime.toISOString());
  
  if (context.timeTravelActive) {
    response.headers.set('X-Real-Time', context.realTime.toISOString());
    response.headers.set('X-Time-Frozen', context.frozen.toString());
  }

  return response;
}

/**
 * Error response formatter with time travel context
 */
export function createTimeTravelErrorResponse(
  error: string,
  context: TimeTravelContext,
  details?: any,
  status: number = 400
): NextResponse {
  const responseData: any = {
    success: false,
    error,
    timestamp: context.currentTime.toISOString(),
  };

  if (details) {
    responseData.details = details;
  }

  if (context.timeTravelActive) {
    responseData.timeTravel = {
      active: true,
      currentTime: context.currentTime.toISOString(),
      realTime: context.realTime.toISOString(),
      frozen: context.frozen,
    };
  }

  const response = NextResponse.json(responseData, { status });

  // Add time travel headers
  response.headers.set('X-Time-Travel-Active', context.timeTravelActive.toString());
  response.headers.set('X-Current-Time', context.currentTime.toISOString());
  
  if (context.timeTravelActive) {
    response.headers.set('X-Real-Time', context.realTime.toISOString());
    response.headers.set('X-Time-Frozen', context.frozen.toString());
  }

  return response;
}

/**
 * Validation middleware for time travel requests
 */
export function validateTimeTravelRequest(request: NextRequest): { isValid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  // Check for required headers in development
  if (process.env.NODE_ENV === 'development') {
    const userAgent = request.headers.get('user-agent');
    if (!userAgent?.includes('development') && request.url.includes('/time-travel')) {
      errors.push('Time travel API should only be used in development environment');
    }
  }
  
  // Validate time travel state format if present
  const timeState = request.cookies.get('time-travel-state');
  if (timeState) {
    try {
      const parsed = JSON.parse(timeState.value);
      if (!parsed.currentTime || !parsed.realTime) {
        errors.push('Invalid time travel state format');
      }
    } catch {
      errors.push('Invalid time travel state JSON');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Rate limiting for time travel operations
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkTimeTravelRateLimit(
  identifier: string, 
  maxRequests: number = 60, 
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Clean up old entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < now) {
      rateLimitMap.delete(key);
    }
  }
  
  const current = rateLimitMap.get(identifier);
  
  if (!current || current.resetTime < now) {
    // New window or expired
    const resetTime = now + windowMs;
    rateLimitMap.set(identifier, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime,
    };
  }
  
  if (current.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
    };
  }
  
  current.count++;
  return {
    allowed: true,
    remaining: maxRequests - current.count,
    resetTime: current.resetTime,
  };
}