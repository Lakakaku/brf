/**
 * Role-Based Access Control (RBAC) system for Swedish BRF Portal
 * Implements Swedish housing cooperative governance hierarchy and permissions
 */

import { MemberRole, BRFPermissions } from './types';

/**
 * Swedish BRF roles with hierarchy and descriptions
 * Based on Swedish cooperative law (bostadsrättslagen)
 */
export const BRF_ROLES: Record<MemberRole, {
  name: string;
  description: string;
  hierarchy: number; // Lower number = higher authority
  swedishTerm: string;
}> = {
  admin: {
    name: 'System Administrator',
    description: 'Full system access and cooperative management',
    hierarchy: 0,
    swedishTerm: 'Systemadministratör',
  },
  chairman: {
    name: 'Board Chairman',
    description: 'Chairman of the cooperative board with highest authority',
    hierarchy: 1,
    swedishTerm: 'Styrelseordförande',
  },
  treasurer: {
    name: 'Board Treasurer',
    description: 'Board member responsible for financial management',
    hierarchy: 2,
    swedishTerm: 'Kassör/Ekonomiansvarig',
  },
  board: {
    name: 'Board Member',
    description: 'Member of the cooperative board',
    hierarchy: 3,
    swedishTerm: 'Styrelseledamot',
  },
  member: {
    name: 'Cooperative Member',
    description: 'Regular member of the housing cooperative',
    hierarchy: 4,
    swedishTerm: 'Bostadsrättsinnehavare',
  },
};

/**
 * BRF permission categories with Swedish context
 */
export const PERMISSION_CATEGORIES = {
  DOCUMENTS: 'documents',
  FINANCIAL: 'financial',
  MEMBERS: 'members',
  CASES: 'cases',
  MEETINGS: 'meetings',
  BOOKINGS: 'bookings',
  ADMIN: 'admin',
  AUDIT: 'audit',
} as const;

/**
 * Comprehensive BRF permissions with Swedish legal compliance
 */
export const BRF_PERMISSIONS: Record<string, {
  key: keyof BRFPermissions;
  name: string;
  description: string;
  category: string;
  swedishTerm: string;
  legalBasis?: string; // Reference to Swedish law if applicable
  gdprSensitive: boolean;
}> = {
  // Document Management Permissions
  VIEW_DOCUMENTS: {
    key: 'canViewDocuments',
    name: 'View Documents',
    description: 'Access to view cooperative documents',
    category: PERMISSION_CATEGORIES.DOCUMENTS,
    swedishTerm: 'Visa dokument',
    gdprSensitive: false,
  },
  UPLOAD_DOCUMENTS: {
    key: 'canUploadDocuments',
    name: 'Upload Documents',
    description: 'Upload documents to the cooperative system',
    category: PERMISSION_CATEGORIES.DOCUMENTS,
    swedishTerm: 'Ladda upp dokument',
    gdprSensitive: false,
  },
  APPROVE_DOCUMENTS: {
    key: 'canApproveDocuments',
    name: 'Approve Documents',
    description: 'Approve and validate cooperative documents',
    category: PERMISSION_CATEGORIES.DOCUMENTS,
    swedishTerm: 'Godkänna dokument',
    legalBasis: 'Bostadsrättslagen 7 kap.',
    gdprSensitive: false,
  },

  // Financial Management Permissions
  VIEW_INVOICES: {
    key: 'canViewInvoices',
    name: 'View Invoices',
    description: 'Access to view cooperative invoices and payments',
    category: PERMISSION_CATEGORIES.FINANCIAL,
    swedishTerm: 'Visa fakturor',
    gdprSensitive: false,
  },
  APPROVE_INVOICES: {
    key: 'canApproveInvoices',
    name: 'Approve Invoices',
    description: 'Approve invoices for payment',
    category: PERMISSION_CATEGORIES.FINANCIAL,
    swedishTerm: 'Godkänna fakturor',
    legalBasis: 'Bostadsrättslagen 7 kap. 3 §',
    gdprSensitive: false,
  },
  CREATE_INVOICES: {
    key: 'canCreateInvoices',
    name: 'Create Invoices',
    description: 'Create and manage invoices',
    category: PERMISSION_CATEGORIES.FINANCIAL,
    swedishTerm: 'Skapa fakturor',
    gdprSensitive: false,
  },
  VIEW_FINANCIAL_REPORTS: {
    key: 'canViewFinancialReports',
    name: 'View Financial Reports',
    description: 'Access to financial reports and analytics',
    category: PERMISSION_CATEGORIES.FINANCIAL,
    swedishTerm: 'Visa ekonomiska rapporter',
    legalBasis: 'Bostadsrättslagen 7 kap. 4 §',
    gdprSensitive: false,
  },
  EXPORT_FINANCIAL_DATA: {
    key: 'canExportFinancialData',
    name: 'Export Financial Data',
    description: 'Export financial data for external use',
    category: PERMISSION_CATEGORIES.FINANCIAL,
    swedishTerm: 'Exportera ekonomiska data',
    gdprSensitive: true,
  },

  // Member Management Permissions
  VIEW_MEMBERS: {
    key: 'canViewMembers',
    name: 'View Members',
    description: 'Access to member information and directory',
    category: PERMISSION_CATEGORIES.MEMBERS,
    swedishTerm: 'Visa medlemmar',
    legalBasis: 'GDPR Art. 6.1(f) - Legitimate interest',
    gdprSensitive: true,
  },
  MANAGE_MEMBERS: {
    key: 'canManageMembers',
    name: 'Manage Members',
    description: 'Add, edit, and manage member accounts',
    category: PERMISSION_CATEGORIES.MEMBERS,
    swedishTerm: 'Hantera medlemmar',
    legalBasis: 'GDPR Art. 6.1(b) - Contract performance',
    gdprSensitive: true,
  },

  // Case Management Permissions
  CREATE_CASES: {
    key: 'canCreateCases',
    name: 'Create Cases',
    description: 'Create maintenance and support cases',
    category: PERMISSION_CATEGORIES.CASES,
    swedishTerm: 'Skapa ärenden',
    gdprSensitive: false,
  },
  ASSIGN_CASES: {
    key: 'canAssignCases',
    name: 'Assign Cases',
    description: 'Assign cases to board members or contractors',
    category: PERMISSION_CATEGORIES.CASES,
    swedishTerm: 'Tilldela ärenden',
    gdprSensitive: false,
  },
  CLOSE_CASES: {
    key: 'canCloseCases',
    name: 'Close Cases',
    description: 'Mark cases as resolved and close them',
    category: PERMISSION_CATEGORIES.CASES,
    swedishTerm: 'Stänga ärenden',
    gdprSensitive: false,
  },

  // Meeting Management Permissions
  SCHEDULE_MEETINGS: {
    key: 'canScheduleMeetings',
    name: 'Schedule Meetings',
    description: 'Schedule board and member meetings',
    category: PERMISSION_CATEGORIES.MEETINGS,
    swedishTerm: 'Boka möten',
    legalBasis: 'Bostadsrättslagen 9 kap.',
    gdprSensitive: false,
  },
  EDIT_PROTOCOLS: {
    key: 'canEditProtocols',
    name: 'Edit Meeting Protocols',
    description: 'Edit and manage meeting minutes and protocols',
    category: PERMISSION_CATEGORIES.MEETINGS,
    swedishTerm: 'Redigera protokoll',
    legalBasis: 'Bostadsrättslagen 9 kap. 8 §',
    gdprSensitive: true,
  },
  APPROVE_MEETING_MINUTES: {
    key: 'canApproveMeetingMinutes',
    name: 'Approve Meeting Minutes',
    description: 'Approve and finalize meeting minutes',
    category: PERMISSION_CATEGORIES.MEETINGS,
    swedishTerm: 'Godkänna mötesprotokoll',
    legalBasis: 'Bostadsrättslagen 9 kap. 8 §',
    gdprSensitive: true,
  },

  // Booking Management Permissions
  MAKE_BOOKINGS: {
    key: 'canMakeBookings',
    name: 'Make Bookings',
    description: 'Book common facilities and resources',
    category: PERMISSION_CATEGORIES.BOOKINGS,
    swedishTerm: 'Göra bokningar',
    gdprSensitive: false,
  },
  MANAGE_BOOKINGS: {
    key: 'canManageBookings',
    name: 'Manage Bookings',
    description: 'Manage and oversee facility bookings',
    category: PERMISSION_CATEGORIES.BOOKINGS,
    swedishTerm: 'Hantera bokningar',
    gdprSensitive: false,
  },
  MANAGE_RESOURCES: {
    key: 'canManageResources',
    name: 'Manage Resources',
    description: 'Manage bookable facilities and resources',
    category: PERMISSION_CATEGORIES.BOOKINGS,
    swedishTerm: 'Hantera resurser',
    gdprSensitive: false,
  },

  // Administrative Permissions
  MANAGE_COOPERATIVE: {
    key: 'canManageCooperative',
    name: 'Manage Cooperative',
    description: 'Manage cooperative settings and configuration',
    category: PERMISSION_CATEGORIES.ADMIN,
    swedishTerm: 'Hantera bostadsrättsförening',
    gdprSensitive: true,
  },
  MANAGE_SYSTEM_SETTINGS: {
    key: 'canManageSystemSettings',
    name: 'Manage System Settings',
    description: 'Configure system-wide settings and features',
    category: PERMISSION_CATEGORIES.ADMIN,
    swedishTerm: 'Hantera systeminställningar',
    gdprSensitive: false,
  },

  // Audit and Compliance Permissions
  ACCESS_AUDIT_LOG: {
    key: 'canAccessAuditLog',
    name: 'Access Audit Log',
    description: 'View system audit logs and security events',
    category: PERMISSION_CATEGORIES.AUDIT,
    swedishTerm: 'Visa revisionslogg',
    legalBasis: 'GDPR Art. 5.2 - Accountability',
    gdprSensitive: true,
  },
};

/**
 * Role-based permission matrix for Swedish BRF governance
 * Follows principle of least privilege and Swedish cooperative law
 */
export const ROLE_PERMISSIONS: Record<MemberRole, (keyof BRFPermissions)[]> = {
  member: [
    'canViewDocuments',
    'canCreateCases',
    'canMakeBookings',
  ],
  
  board: [
    'canViewDocuments',
    'canUploadDocuments',
    'canApproveDocuments',
    'canViewInvoices',
    'canApproveInvoices',
    'canViewMembers',
    'canCreateCases',
    'canAssignCases',
    'canScheduleMeetings',
    'canMakeBookings',
    'canManageBookings',
    'canViewFinancialReports',
  ],
  
  treasurer: [
    'canViewDocuments',
    'canUploadDocuments',
    'canApproveDocuments',
    'canViewInvoices',
    'canApproveInvoices',
    'canCreateInvoices',
    'canViewMembers',
    'canCreateCases',
    'canAssignCases',
    'canScheduleMeetings',
    'canEditProtocols',
    'canMakeBookings',
    'canManageBookings',
    'canViewFinancialReports',
    'canExportFinancialData',
  ],
  
  chairman: [
    'canViewDocuments',
    'canUploadDocuments',
    'canApproveDocuments',
    'canViewInvoices',
    'canApproveInvoices',
    'canCreateInvoices',
    'canViewMembers',
    'canManageMembers',
    'canCreateCases',
    'canAssignCases',
    'canCloseCases',
    'canScheduleMeetings',
    'canEditProtocols',
    'canApproveMeetingMinutes',
    'canMakeBookings',
    'canManageBookings',
    'canManageResources',
    'canViewFinancialReports',
    'canExportFinancialData',
  ],
  
  admin: [
    'canViewDocuments',
    'canUploadDocuments',
    'canApproveDocuments',
    'canViewInvoices',
    'canApproveInvoices',
    'canCreateInvoices',
    'canViewMembers',
    'canManageMembers',
    'canCreateCases',
    'canAssignCases',
    'canCloseCases',
    'canScheduleMeetings',
    'canEditProtocols',
    'canApproveMeetingMinutes',
    'canMakeBookings',
    'canManageBookings',
    'canManageResources',
    'canViewFinancialReports',
    'canExportFinancialData',
    'canManageCooperative',
    'canAccessAuditLog',
    'canManageSystemSettings',
  ],
};

/**
 * Permission inheritance based on role hierarchy
 * Higher roles inherit all permissions from lower roles
 */
export function getInheritedPermissions(role: MemberRole): (keyof BRFPermissions)[] {
  const currentRoleHierarchy = BRF_ROLES[role].hierarchy;
  const inheritedPermissions = new Set<keyof BRFPermissions>();

  // Add permissions from current role and all lower hierarchy roles
  Object.entries(BRF_ROLES).forEach(([roleKey, roleData]) => {
    if (roleData.hierarchy >= currentRoleHierarchy) {
      const rolePermissions = ROLE_PERMISSIONS[roleKey as MemberRole];
      rolePermissions.forEach(permission => inheritedPermissions.add(permission));
    }
  });

  return Array.from(inheritedPermissions);
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  userRole: MemberRole,
  permission: keyof BRFPermissions,
  customPermissions?: Partial<BRFPermissions>
): boolean {
  // Check custom permissions first (user-specific overrides)
  if (customPermissions && permission in customPermissions) {
    return customPermissions[permission] === true;
  }

  // Check inherited role permissions
  const inheritedPermissions = getInheritedPermissions(userRole);
  return inheritedPermissions.includes(permission);
}

/**
 * Check if a role can perform multiple permissions (AND logic)
 */
export function hasAllPermissions(
  userRole: MemberRole,
  permissions: (keyof BRFPermissions)[],
  customPermissions?: Partial<BRFPermissions>
): boolean {
  return permissions.every(permission => 
    hasPermission(userRole, permission, customPermissions)
  );
}

/**
 * Check if a role can perform any of the permissions (OR logic)
 */
export function hasAnyPermission(
  userRole: MemberRole,
  permissions: (keyof BRFPermissions)[],
  customPermissions?: Partial<BRFPermissions>
): boolean {
  return permissions.some(permission => 
    hasPermission(userRole, permission, customPermissions)
  );
}

/**
 * Check role hierarchy - if userRole can manage targetRole
 */
export function canManageRole(userRole: MemberRole, targetRole: MemberRole): boolean {
  return BRF_ROLES[userRole].hierarchy < BRF_ROLES[targetRole].hierarchy;
}

/**
 * Get all permissions for a specific role
 */
export function getRolePermissions(
  role: MemberRole,
  includeInherited: boolean = true
): BRFPermissions {
  const permissions = {} as BRFPermissions;

  // Initialize all permissions as false
  Object.values(BRF_PERMISSIONS).forEach(permissionData => {
    permissions[permissionData.key] = false;
  });

  // Set permissions based on role
  const rolePermissions = includeInherited 
    ? getInheritedPermissions(role)
    : ROLE_PERMISSIONS[role];

  rolePermissions.forEach(permission => {
    permissions[permission] = true;
  });

  return permissions;
}

/**
 * Get permissions by category for UI organization
 */
export function getPermissionsByCategory(category: string) {
  return Object.entries(BRF_PERMISSIONS)
    .filter(([, permissionData]) => permissionData.category === category)
    .reduce((acc, [key, permissionData]) => {
      acc[key] = permissionData;
      return acc;
    }, {} as typeof BRF_PERMISSIONS);
}

/**
 * Get GDPR sensitive permissions
 */
export function getGDPRSensitivePermissions() {
  return Object.entries(BRF_PERMISSIONS)
    .filter(([, permissionData]) => permissionData.gdprSensitive)
    .map(([key]) => key);
}

/**
 * Validate if a permission key is valid
 */
export function isValidPermission(permission: string): permission is keyof BRFPermissions {
  return Object.values(BRF_PERMISSIONS).some(p => p.key === permission);
}

/**
 * Swedish BRF role validation
 */
export function isValidBRFRole(role: string): role is MemberRole {
  return Object.keys(BRF_ROLES).includes(role);
}

/**
 * Get role display name in Swedish
 */
export function getRoleDisplayName(role: MemberRole, language: 'sv' | 'en' = 'sv'): string {
  const roleData = BRF_ROLES[role];
  return language === 'sv' ? roleData.swedishTerm : roleData.name;
}

/**
 * Permission requirement types for API endpoints
 */
export type PermissionRequirement = 
  | { type: 'single'; permission: keyof BRFPermissions }
  | { type: 'all'; permissions: (keyof BRFPermissions)[] }
  | { type: 'any'; permissions: (keyof BRFPermissions)[] }
  | { type: 'role'; role: MemberRole }
  | { type: 'hierarchy'; minRole: MemberRole };

/**
 * Check if user meets permission requirement
 */
export function meetsPermissionRequirement(
  userRole: MemberRole,
  requirement: PermissionRequirement,
  customPermissions?: Partial<BRFPermissions>
): boolean {
  switch (requirement.type) {
    case 'single':
      return hasPermission(userRole, requirement.permission, customPermissions);
    
    case 'all':
      return hasAllPermissions(userRole, requirement.permissions, customPermissions);
    
    case 'any':
      return hasAnyPermission(userRole, requirement.permissions, customPermissions);
    
    case 'role':
      return userRole === requirement.role;
    
    case 'hierarchy':
      return BRF_ROLES[userRole].hierarchy <= BRF_ROLES[requirement.minRole].hierarchy;
    
    default:
      return false;
  }
}

/**
 * Rate limiting configuration for permission checks
 * Prevents brute force attacks on authorization
 */
export const RBAC_RATE_LIMITS = {
  PERMISSION_CHECK: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 100, // 100 permission checks per minute per user
  },
  ROLE_CHANGE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 5, // 5 role change attempts per hour
  },
  AUDIT_ACCESS: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 10, // 10 audit log accesses per minute
  },
} as const;

/**
 * Export all RBAC utilities and types
 */
export type {
  MemberRole,
  BRFPermissions,
  PermissionRequirement,
};

export {
  BRF_ROLES,
  PERMISSION_CATEGORIES,
  BRF_PERMISSIONS,
  ROLE_PERMISSIONS,
  RBAC_RATE_LIMITS,
};