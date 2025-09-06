/**
 * Next.js Middleware for BRF Portal
 * Handles authentication, route protection, and admin access control
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, isValidSession } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Admin routes protection
  if (pathname.startsWith('/admin')) {
    try {
      // Get session
      const session = await getSession(request);
      
      // Check if user is authenticated and has admin access
      if (!isValidSession(session) || !session.user || session.user.role !== 'admin' || !session.user.isActive) {
        // Redirect to login page with return URL
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('returnUrl', pathname);
        loginUrl.searchParams.set('error', 'admin_access_required');
        
        return NextResponse.redirect(loginUrl);
      }
      
      // User has admin access, continue
      return NextResponse.next();
      
    } catch (error) {
      console.error('Admin middleware error:', error);
      
      // Redirect to login on error
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('error', 'authentication_error');
      
      return NextResponse.redirect(loginUrl);
    }
  }

  // Auth routes - redirect if already logged in
  if (pathname.startsWith('/auth/')) {
    try {
      const session = await getSession(request);
      
      if (isValidSession(session) && session.user && session.user.isActive) {
        // Check for return URL
        const returnUrl = request.nextUrl.searchParams.get('returnUrl');
        
        if (returnUrl && returnUrl.startsWith('/')) {
          return NextResponse.redirect(new URL(returnUrl, request.url));
        }
        
        // Default redirect based on role
        const redirectUrl = session.user.role === 'admin' ? '/admin' : '/dashboard';
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    } catch (error) {
      console.error('Auth redirect middleware error:', error);
      // Continue to auth pages on error
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/auth/:path*',
  ],
};