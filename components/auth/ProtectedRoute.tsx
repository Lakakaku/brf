/**
 * Client-side route protection component for BRF Portal
 * Implements role-based access control for React components
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { 
  hasPermission, 
  hasAllPermissions, 
  hasAnyPermission,
  meetsPermissionRequirement,
  PermissionRequirement,
  BRF_ROLES,
  getRoleDisplayName
} from '@/lib/auth/rbac';
import { MemberRole, BRFPermissions } from '@/lib/auth/types';

/**
 * Props for ProtectedRoute component
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  requirements?: PermissionRequirement | PermissionRequirement[];
  fallback?: React.ReactNode;
  redirectTo?: string;
  showAccessDenied?: boolean;
  loadingComponent?: React.ReactNode;
}

/**
 * Props for permission-based component rendering
 */
interface PermissionGateProps {
  children: React.ReactNode;
  permission?: keyof BRFPermissions;
  permissions?: (keyof BRFPermissions)[];
  requireAll?: boolean; // true = AND logic, false = OR logic
  role?: MemberRole;
  minRole?: MemberRole;
  fallback?: React.ReactNode;
  inverse?: boolean; // Show content when permission is NOT granted
}

/**
 * Loading component for authentication checks
 */
const AuthLoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-gray-600">Verifierar behörighet...</p>
    </div>
  </div>
);

/**
 * Access denied component with Swedish BRF context
 */
const AccessDeniedMessage: React.FC<{ 
  userRole?: MemberRole;
  requiredPermissions?: string[];
}> = ({ userRole, requiredPermissions }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          Åtkomst nekad
        </h3>
        
        <p className="mt-2 text-sm text-gray-600">
          Du har inte behörighet att komma åt denna sida.
        </p>
        
        {userRole && (
          <p className="mt-2 text-xs text-gray-500">
            Din roll: {getRoleDisplayName(userRole, 'sv')}
          </p>
        )}
        
        {requiredPermissions && requiredPermissions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500">
              Krävda behörigheter:
            </p>
            <ul className="mt-1 text-xs text-gray-400">
              {requiredPermissions.map((permission, index) => (
                <li key={index}>• {permission}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="mt-6">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Gå tillbaka
          </button>
        </div>
        
        <p className="mt-4 text-xs text-gray-400">
          Kontakta styrelsen om du behöver ytterligare behörigheter.
        </p>
      </div>
    </div>
  </div>
);

/**
 * Main protected route component
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requirements = [],
  fallback,
  redirectTo,
  showAccessDenied = true,
  loadingComponent = <AuthLoadingSpinner />
}) => {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  useEffect(() => {
    if (loading) {
      return; // Still loading authentication state
    }

    if (!isAuthenticated || !user) {
      // Redirect to login if not authenticated
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    // Check authorization requirements
    const requirementArray = Array.isArray(requirements) ? requirements : [requirements];
    let authorized = true;

    for (const requirement of requirementArray) {
      if (!meetsPermissionRequirement(user.role, requirement, user.permissions)) {
        authorized = false;
        break;
      }
    }

    setIsAuthorized(authorized);
    setAuthChecked(true);

    // Handle redirect if not authorized
    if (!authorized && redirectTo) {
      router.push(redirectTo);
    }
  }, [user, isAuthenticated, loading, requirements, router, redirectTo]);

  // Show loading while checking authentication
  if (loading || !authChecked) {
    return <>{loadingComponent}</>;
  }

  // Show access denied if not authorized
  if (!isAuthorized) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showAccessDenied) {
      return (
        <AccessDeniedMessage 
          userRole={user?.role}
          requiredPermissions={[]} // TODO: Extract permission names from requirements
        />
      );
    }

    return null;
  }

  return <>{children}</>;
};

/**
 * Permission gate for conditional component rendering
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  permission,
  permissions = [],
  requireAll = true,
  role,
  minRole,
  fallback = null,
  inverse = false
}) => {
  const { user } = useAuth();
  
  if (!user) {
    return inverse ? <>{children}</> : <>{fallback}</>;
  }

  let hasAccess = false;

  // Check single permission
  if (permission) {
    hasAccess = hasPermission(user.role, permission, user.permissions);
  }
  // Check multiple permissions
  else if (permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(user.role, permissions, user.permissions)
      : hasAnyPermission(user.role, permissions, user.permissions);
  }
  // Check specific role
  else if (role) {
    hasAccess = user.role === role;
  }
  // Check minimum role (hierarchy)
  else if (minRole) {
    hasAccess = BRF_ROLES[user.role].hierarchy <= BRF_ROLES[minRole].hierarchy;
  }
  else {
    // No requirements means always show (authenticated users only)
    hasAccess = true;
  }

  // Apply inverse logic if specified
  const shouldShow = inverse ? !hasAccess : hasAccess;

  return shouldShow ? <>{children}</> : <>{fallback}</>;
};

/**
 * Hook for permission checking in components
 */
export const usePermissions = () => {
  const { user } = useAuth();

  const checkPermission = (permission: keyof BRFPermissions): boolean => {
    if (!user) return false;
    return hasPermission(user.role, permission, user.permissions);
  };

  const checkAllPermissions = (permissions: (keyof BRFPermissions)[]): boolean => {
    if (!user) return false;
    return hasAllPermissions(user.role, permissions, user.permissions);
  };

  const checkAnyPermission = (permissions: (keyof BRFPermissions)[]): boolean => {
    if (!user) return false;
    return hasAnyPermission(user.role, permissions, user.permissions);
  };

  const checkRole = (role: MemberRole): boolean => {
    if (!user) return false;
    return user.role === role;
  };

  const checkMinRole = (minRole: MemberRole): boolean => {
    if (!user) return false;
    return BRF_ROLES[user.role].hierarchy <= BRF_ROLES[minRole].hierarchy;
  };

  const canAccessFinancial = (operation: 'view' | 'create' | 'approve' | 'export' = 'view'): boolean => {
    if (!user) return false;
    
    switch (operation) {
      case 'view':
        return hasPermission(user.role, 'canViewFinancialReports', user.permissions);
      case 'create':
        return hasPermission(user.role, 'canCreateInvoices', user.permissions);
      case 'approve':
        return hasPermission(user.role, 'canApproveInvoices', user.permissions);
      case 'export':
        return hasPermission(user.role, 'canExportFinancialData', user.permissions);
      default:
        return false;
    }
  };

  const canManageUser = (targetRole: MemberRole): boolean => {
    if (!user) return false;
    return BRF_ROLES[user.role].hierarchy < BRF_ROLES[targetRole].hierarchy;
  };

  return {
    user,
    checkPermission,
    checkAllPermissions,
    checkAnyPermission,
    checkRole,
    checkMinRole,
    canAccessFinancial,
    canManageUser,
    isAdmin: user?.role === 'admin',
    isChairman: user?.role === 'chairman',
    isTreasurer: user?.role === 'treasurer',
    isBoardMember: user?.role === 'board' || user?.role === 'chairman' || user?.role === 'treasurer',
    userRole: user?.role,
    roleDisplayName: user ? getRoleDisplayName(user.role, 'sv') : '',
  };
};

/**
 * Component for role-based navigation items
 */
interface RoleBasedNavItemProps {
  children: React.ReactNode;
  permission?: keyof BRFPermissions;
  permissions?: (keyof BRFPermissions)[];
  requireAll?: boolean;
  role?: MemberRole;
  minRole?: MemberRole;
  className?: string;
}

export const RoleBasedNavItem: React.FC<RoleBasedNavItemProps> = ({
  children,
  permission,
  permissions,
  requireAll = true,
  role,
  minRole,
  className = ''
}) => (
  <PermissionGate
    permission={permission}
    permissions={permissions}
    requireAll={requireAll}
    role={role}
    minRole={minRole}
  >
    <div className={className}>
      {children}
    </div>
  </PermissionGate>
);

/**
 * Higher-order component for protecting pages
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  requirements?: PermissionRequirement | PermissionRequirement[]
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute requirements={requirements}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

/**
 * Component for displaying user role badge
 */
export const UserRoleBadge: React.FC<{ 
  role?: MemberRole; 
  className?: string;
  showSwedish?: boolean;
}> = ({ 
  role, 
  className = '',
  showSwedish = true 
}) => {
  if (!role) return null;

  const roleData = BRF_ROLES[role];
  const displayName = showSwedish ? roleData.swedishTerm : roleData.name;
  
  // Color scheme based on hierarchy
  const colorClasses = {
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    chairman: 'bg-blue-100 text-blue-800 border-blue-200',
    treasurer: 'bg-green-100 text-green-800 border-green-200',
    board: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    member: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[role]} ${className}`}>
      {displayName}
    </span>
  );
};

/**
 * Export all components and hooks
 */
export {
  ProtectedRoute,
  PermissionGate,
  usePermissions,
  RoleBasedNavItem,
  withProtectedRoute,
  UserRoleBadge,
  AuthLoadingSpinner,
  AccessDeniedMessage,
};

export type {
  ProtectedRouteProps,
  PermissionGateProps,
  RoleBasedNavItemProps,
};