/**
 * Request utility functions for extracting client information
 * Used for security logging and rate limiting in the BRF Portal
 */

import { NextRequest } from 'next/server';

/**
 * Extract client IP address from various headers
 * Handles proxy configurations and load balancers
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers in order of preference
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, use the first one
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  const remoteAddr = request.headers.get('x-forwarded');
  if (remoteAddr) {
    return remoteAddr.trim();
  }

  // Fallback to connection remote address (may not be available in all environments)
  return request.ip || 'unknown';
}

/**
 * Extract user agent string from request headers
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

/**
 * Extract and parse Accept-Language header
 * Returns preferred languages in order of preference
 */
export function getAcceptedLanguages(request: NextRequest): string[] {
  const acceptLanguage = request.headers.get('accept-language');
  
  if (!acceptLanguage) {
    return ['sv']; // Default to Swedish for BRF Portal
  }

  // Parse Accept-Language header format: "sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7"
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [language, qValue] = lang.trim().split(';');
      const quality = qValue ? parseFloat(qValue.split('=')[1]) : 1.0;
      return { language: language.toLowerCase(), quality };
    })
    .sort((a, b) => b.quality - a.quality)
    .map(item => item.language);

  return languages.length > 0 ? languages : ['sv'];
}

/**
 * Get the primary language preference (first in Accept-Language)
 */
export function getPrimaryLanguage(request: NextRequest): string {
  const languages = getAcceptedLanguages(request);
  const primary = languages[0];
  
  // Extract main language code (e.g., 'sv' from 'sv-SE')
  return primary.split('-')[0];
}

/**
 * Check if the client prefers Swedish language
 */
export function prefersSwedish(request: NextRequest): boolean {
  const primary = getPrimaryLanguage(request);
  return primary === 'sv';
}

/**
 * Extract referrer URL from request headers
 */
export function getReferrer(request: NextRequest): string | null {
  return request.headers.get('referer') || request.headers.get('referrer');
}

/**
 * Check if request is from a mobile device based on User-Agent
 */
export function isMobileDevice(request: NextRequest): boolean {
  const userAgent = getUserAgent(request).toLowerCase();
  
  const mobilePatterns = [
    /android/i,
    /iphone/i,
    /ipad/i,
    /ipod/i,
    /blackberry/i,
    /windows phone/i,
    /mobile/i
  ];

  return mobilePatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Detect browser from User-Agent string
 */
export function getBrowserInfo(request: NextRequest): {
  browser: string;
  version?: string;
  mobile: boolean;
} {
  const userAgent = getUserAgent(request);
  const mobile = isMobileDevice(request);
  
  // Browser detection patterns
  const browsers = [
    { name: 'Chrome', pattern: /Chrome\/(\d+\.\d+)/ },
    { name: 'Firefox', pattern: /Firefox\/(\d+\.\d+)/ },
    { name: 'Safari', pattern: /Version\/(\d+\.\d+).*Safari/ },
    { name: 'Edge', pattern: /Edg\/(\d+\.\d+)/ },
    { name: 'Opera', pattern: /Opera.*Version\/(\d+\.\d+)/ },
    { name: 'Internet Explorer', pattern: /MSIE (\d+\.\d+)/ }
  ];

  for (const browser of browsers) {
    const match = userAgent.match(browser.pattern);
    if (match) {
      return {
        browser: browser.name,
        version: match[1],
        mobile
      };
    }
  }

  return {
    browser: 'Unknown',
    mobile
  };
}

/**
 * Extract device information from User-Agent
 */
export function getDeviceInfo(request: NextRequest): {
  type: 'desktop' | 'mobile' | 'tablet';
  os?: string;
} {
  const userAgent = getUserAgent(request);
  
  // Operating system detection
  let os = 'Unknown';
  if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/Mac OS X/i.test(userAgent)) os = 'macOS';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(userAgent)) os = 'iOS';
  else if (/Linux/i.test(userAgent)) os = 'Linux';

  // Device type detection
  let type: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/iPad/i.test(userAgent)) type = 'tablet';
  else if (isMobileDevice(request)) type = 'mobile';

  return { type, os };
}

/**
 * Check if request is likely from a bot/crawler
 */
export function isBot(request: NextRequest): boolean {
  const userAgent = getUserAgent(request).toLowerCase();
  
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /telegram/i
  ];

  return botPatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Get request timestamp in ISO format
 */
export function getRequestTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Create a request fingerprint for security tracking
 * Combines IP, User-Agent hash, and other identifying factors
 */
export function createRequestFingerprint(request: NextRequest): string {
  const ip = getClientIP(request);
  const userAgent = getUserAgent(request);
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  
  // Create a simple hash of identifying information
  const combined = `${ip}|${userAgent}|${acceptLanguage}|${acceptEncoding}`;
  
  // Simple hash function (in production, consider using crypto.createHash)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

/**
 * Extract security-relevant headers for audit logging
 */
export function getSecurityHeaders(request: NextRequest): Record<string, string> {
  const securityHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-forwarded-proto',
    'x-forwarded-host',
    'cf-connecting-ip',
    'cf-ray',
    'cf-visitor',
    'user-agent',
    'referer',
    'origin',
    'host'
  ];

  const headers: Record<string, string> = {};
  
  securityHeaders.forEach(headerName => {
    const value = request.headers.get(headerName);
    if (value) {
      headers[headerName] = value;
    }
  });

  return headers;
}