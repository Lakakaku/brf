'use client';

/**
 * AuthGuard component for BRF Portal
 * Protects routes by checking authentication status and redirecting if needed
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import type { MemberRole } from '@/lib/auth/types';

interface AuthGuardProps {
  /**
   * Component to render when authenticated
   */
  children: React.ReactNode;
  /**
   * Required roles to access the content (optional)
   */
  requiredRoles?: MemberRole[];
  /**
   * Required permissions to access the content (optional)
   */
  requiredPermissions?: string[];
  /**
   * Redirect path for unauthenticated users
   */
  redirectTo?: string;
  /**
   * Loading component to show while checking auth
   */
  fallback?: React.ReactNode;
  /**
   * Component to show for insufficient permissions
   */
  accessDenied?: React.ReactNode;
}

/**
 * Default loading component
 */
function DefaultLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="text-gray-600">Kontrollerar inloggningsstatus...</p>
      </div>
    </div>
  );
}

/**
 * Default access denied component
 */
function DefaultAccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 max-w-md">
        <Shield className="h-16 w-16 mx-auto text-red-500" />
        <h1 className="text-2xl font-bold text-gray-900">Åtkomst nekad</h1>
        <p className="text-gray-600">
          Du har inte behörighet att komma åt denna sida. Kontakta styrelsen 
          om du tror att detta är ett misstag.
        </p>
      </div>
    </div>
  );
}

/**
 * AuthGuard component
 */
export function AuthGuard({
  children,
  requiredRoles,
  requiredPermissions,
  redirectTo = '/auth/login',
  fallback,
  accessDenied,
}: AuthGuardProps) {
  const router = useRouter();
  const { 
    user, 
    isLoggedIn, 
    isLoading, 
    hasRole, 
    hasPermission 
  } = useAuth();

  useEffect(() => {
    // If not loading and not logged in, redirect
    if (!isLoading && !isLoggedIn) {
      const currentPath = window.location.pathname + window.location.search;
      const loginUrl = `${redirectTo}?returnUrl=${encodeURIComponent(currentPath)}`;
      router.push(loginUrl);
    }
  }, [isLoading, isLoggedIn, redirectTo, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return fallback || <DefaultLoadingFallback />;
  }

  // Redirect if not logged in (handled by useEffect, but show loading)
  if (!isLoggedIn || !user) {
    return fallback || <DefaultLoadingFallback />;
  }

  // Check role requirements
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => hasRole(role));
    if (!hasRequiredRole) {
      return accessDenied || <DefaultAccessDenied />;
    }
  }

  // Check permission requirements
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission => 
      hasPermission(permission)
    );
    if (!hasAllPermissions) {
      return accessDenied || <DefaultAccessDenied />;
    }
  }

  // All checks passed, render children
  return <>{children}</>;
}

/**
 * Higher-order component version of AuthGuard
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardOptions?: Omit<AuthGuardProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <AuthGuard {...guardOptions}>
      <Component {...props} />
    </AuthGuard>
  );
  
  WrappedComponent.displayName = `withAuthGuard(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}