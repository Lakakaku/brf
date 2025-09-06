/**
 * Authentication context provider for BRF Portal
 * Provides authentication state throughout the application with React Context
 */

'use client';

import React, { 
  createContext, 
  useContext, 
  useCallback, 
  useEffect, 
  useState,
  ReactNode 
} from 'react';
import { 
  AuthUser, 
  TokenPair, 
  ClientSessionState,
  MemberRole,
  BRFPermissions 
} from './types';
import { useAuth } from '@/hooks/useAuth';
import { tokenManager } from './client';

/**
 * Authentication context type
 */
interface AuthContextType {
  // Basic auth state
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Session state
  sessionState: ClientSessionState;
  isRefreshing: boolean;
  sessionWarning: boolean;
  timeUntilExpiry: number | null;
  
  // Actions
  login: (credentials: {
    email: string;
    password: string;
    rememberMe?: boolean;
    cooperativeId?: string;
  }) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  dismissSessionWarning: () => void;
  extendSession: () => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  
  // Permission utilities
  hasPermission: (permission: keyof BRFPermissions) => boolean;
  hasRole: (role: MemberRole) => boolean;
  hasAnyRole: (roles: MemberRole[]) => boolean;
  
  // Session utilities
  getSessionTimeLeft: () => number | null;
  
  // Advanced utilities
  tokenManager: typeof tokenManager;
}

/**
 * Authentication context
 */
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Authentication context provider props
 */
interface AuthProviderProps {
  children: ReactNode;
  requireAuth?: boolean; // If true, redirects to login when not authenticated
  allowedRoles?: MemberRole[]; // If provided, only these roles are allowed
  fallback?: ReactNode; // Fallback component while loading
}

/**
 * Authentication context provider
 */
export function AuthProvider({
  children,
  requireAuth = false,
  allowedRoles,
  fallback
}: AuthProviderProps) {
  const auth = useAuth();
  const [initializationComplete, setInitializationComplete] = useState(false);
  
  // Handle initialization
  useEffect(() => {
    if (!auth.isLoading) {
      setInitializationComplete(true);
    }
  }, [auth.isLoading]);
  
  // Handle role-based access control
  useEffect(() => {
    if (initializationComplete && auth.isLoggedIn && allowedRoles && auth.user) {
      if (!allowedRoles.includes(auth.user.role)) {
        console.warn('User role not allowed:', auth.user.role);
        auth.logout();
      }
    }
  }, [initializationComplete, auth.isLoggedIn, auth.user, allowedRoles, auth]);
  
  // Enhanced permission check with type safety
  const hasPermission = useCallback((permission: keyof BRFPermissions): boolean => {
    return auth.hasPermission(permission);
  }, [auth]);
  
  // Enhanced role checks with type safety
  const hasRole = useCallback((role: MemberRole): boolean => {
    return auth.hasRole(role);
  }, [auth]);
  
  const hasAnyRole = useCallback((roles: MemberRole[]): boolean => {
    return auth.hasAnyRole(roles);
  }, [auth]);
  
  // Show loading fallback during initialization
  if (!initializationComplete && fallback) {
    return <>{fallback}</>;
  }
  
  // Handle required authentication
  if (requireAuth && initializationComplete && !auth.isLoading && !auth.isLoggedIn) {
    // The useAuth hook should handle redirect, but we can also return null or a login prompt
    return null;
  }
  
  const contextValue: AuthContextType = {
    ...auth,
    hasPermission,
    hasRole,
    hasAnyRole,
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context
 */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

/**
 * HOC for components that require authentication
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    requireAuth?: boolean;
    allowedRoles?: MemberRole[];
    fallback?: ReactNode;
  } = {}
) {
  const AuthenticatedComponent = (props: P) => {
    return (
      <AuthProvider
        requireAuth={options.requireAuth ?? true}
        allowedRoles={options.allowedRoles}
        fallback={options.fallback}
      >
        <Component {...props} />
      </AuthProvider>
    );
  };
  
  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;
  return AuthenticatedComponent;
}

/**
 * Hook for permission-based rendering
 */
export function usePermissions() {
  const { hasPermission, hasRole, hasAnyRole, user } = useAuthContext();
  
  return {
    hasPermission,
    hasRole,
    hasAnyRole,
    user,
    
    // Convenience methods
    canViewDocuments: () => hasPermission('canViewDocuments'),
    canUploadDocuments: () => hasPermission('canUploadDocuments'),
    canApproveDocuments: () => hasPermission('canApproveDocuments'),
    canViewInvoices: () => hasPermission('canViewInvoices'),
    canApproveInvoices: () => hasPermission('canApproveInvoices'),
    canCreateInvoices: () => hasPermission('canCreateInvoices'),
    canViewMembers: () => hasPermission('canViewMembers'),
    canManageMembers: () => hasPermission('canManageMembers'),
    canCreateCases: () => hasPermission('canCreateCases'),
    canAssignCases: () => hasPermission('canAssignCases'),
    canCloseCases: () => hasPermission('canCloseCases'),
    canScheduleMeetings: () => hasPermission('canScheduleMeetings'),
    canEditProtocols: () => hasPermission('canEditProtocols'),
    canApproveMeetingMinutes: () => hasPermission('canApproveMeetingMinutes'),
    canMakeBookings: () => hasPermission('canMakeBookings'),
    canManageBookings: () => hasPermission('canManageBookings'),
    canManageResources: () => hasPermission('canManageResources'),
    canViewFinancialReports: () => hasPermission('canViewFinancialReports'),
    canExportFinancialData: () => hasPermission('canExportFinancialData'),
    canManageCooperative: () => hasPermission('canManageCooperative'),
    canAccessAuditLog: () => hasPermission('canAccessAuditLog'),
    canManageSystemSettings: () => hasPermission('canManageSystemSettings'),
    
    // Role checks
    isMember: () => hasRole('member'),
    isBoardMember: () => hasRole('board'),
    isChairman: () => hasRole('chairman'),
    isTreasurer: () => hasRole('treasurer'),
    isAdmin: () => hasRole('admin'),
    
    // Combined checks
    isBoardOrHigher: () => hasAnyRole(['board', 'chairman', 'treasurer', 'admin']),
    isChairmanOrAdmin: () => hasAnyRole(['chairman', 'admin']),
    canManageFinances: () => hasAnyRole(['treasurer', 'chairman', 'admin']),
  };
}

/**
 * Hook for session monitoring and warnings
 */
export function useSessionMonitor() {
  const { 
    sessionWarning, 
    timeUntilExpiry, 
    dismissSessionWarning, 
    extendSession, 
    getSessionTimeLeft,
    sessionState,
    isRefreshing
  } = useAuthContext();
  
  const [localWarningDismissed, setLocalWarningDismissed] = useState(false);
  
  // Reset local dismissal when warning appears
  useEffect(() => {
    if (sessionWarning && !localWarningDismissed) {
      setLocalWarningDismissed(false);
    }
  }, [sessionWarning, localWarningDismissed]);
  
  const handleDismissWarning = useCallback(() => {
    setLocalWarningDismissed(true);
    dismissSessionWarning();
  }, [dismissSessionWarning]);
  
  const handleExtendSession = useCallback(async () => {
    const result = await extendSession();
    if (result.success) {
      setLocalWarningDismissed(false);
    }
    return result;
  }, [extendSession]);
  
  return {
    showWarning: sessionWarning && !localWarningDismissed,
    timeUntilExpiry,
    sessionTimeLeft: getSessionTimeLeft(),
    isRefreshing,
    sessionState,
    dismissWarning: handleDismissWarning,
    extendSession: handleExtendSession,
    
    // Formatted time helpers
    timeUntilExpiryFormatted: timeUntilExpiry 
      ? `${Math.floor(timeUntilExpiry / 60000)} minutes`
      : null,
    sessionTimeLeftFormatted: (() => {
      const minutes = getSessionTimeLeft();
      if (minutes === null) return null;
      if (minutes < 60) return `${minutes} minutes`;
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    })(),
  };
}

/**
 * Component for conditional rendering based on permissions
 */
interface ConditionalRenderProps {
  children: ReactNode;
  permission?: keyof BRFPermissions;
  role?: MemberRole;
  anyRole?: MemberRole[];
  allRoles?: MemberRole[];
  fallback?: ReactNode;
}

export function ConditionalRender({
  children,
  permission,
  role,
  anyRole,
  allRoles,
  fallback = null
}: ConditionalRenderProps) {
  const { hasPermission, hasRole, hasAnyRole } = usePermissions();
  
  let shouldRender = true;
  
  if (permission && !hasPermission(permission)) {
    shouldRender = false;
  }
  
  if (role && !hasRole(role)) {
    shouldRender = false;
  }
  
  if (anyRole && !hasAnyRole(anyRole)) {
    shouldRender = false;
  }
  
  if (allRoles && !allRoles.every(r => hasRole(r))) {
    shouldRender = false;
  }
  
  return shouldRender ? <>{children}</> : <>{fallback}</>;
}

/**
 * Session warning component
 */
interface SessionWarningProps {
  className?: string;
  autoShow?: boolean;
}

export function SessionWarning({ className, autoShow = true }: SessionWarningProps) {
  const {
    showWarning,
    timeUntilExpiryFormatted,
    dismissWarning,
    extendSession,
    isRefreshing
  } = useSessionMonitor();
  
  if (!autoShow || !showWarning) {
    return null;
  }
  
  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-md p-4 ${className || ''}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Session Expiring Soon
          </h3>
          <p className="mt-1 text-sm text-yellow-700">
            Your session will expire in {timeUntilExpiryFormatted}. 
            Would you like to extend your session?
          </p>
        </div>
        <div className="ml-4 flex space-x-2">
          <button
            type="button"
            onClick={extendSession}
            disabled={isRefreshing}
            className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm hover:bg-yellow-200 disabled:opacity-50"
          >
            {isRefreshing ? 'Extending...' : 'Extend Session'}
          </button>
          <button
            type="button"
            onClick={dismissWarning}
            className="text-yellow-800 px-2 py-1 text-sm hover:text-yellow-900"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}