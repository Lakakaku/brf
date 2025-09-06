/**
 * RBAC Usage Examples for BRF Portal
 * Demonstrates common authorization patterns and Swedish BRF scenarios
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthorization, AuthContext } from '@/lib/auth/authorize';
import { 
  hasPermission, 
  getRolePermissions,
  meetsPermissionRequirement 
} from '@/lib/auth/rbac';
import { 
  logFinancialAccess, 
  logMemberDataAccess,
  AuditEventType 
} from '@/lib/auth/audit';

// =============================================================================
// API ENDPOINT EXAMPLES
// =============================================================================

/**
 * Example 1: Basic permission check for viewing invoices
 * Swedish context: Only board members and above can view all invoices
 */
export const getInvoicesExample = withAuthorization([
  { type: 'single', permission: 'canViewInvoices' }
])(async (req: NextRequest, context: AuthContext) => {
  
  // User is guaranteed to have canViewInvoices permission
  const invoices = await fetchInvoicesForCooperative(context.cooperativeId);
  
  return NextResponse.json({ 
    data: invoices,
    userRole: context.user.role 
  });
});

/**
 * Example 2: Multiple permission requirements (AND logic)
 * Swedish context: Creating invoices requires both viewing and creation permissions
 */
export const createInvoiceExample = withAuthorization([
  { type: 'all', permissions: ['canViewInvoices', 'canCreateInvoices'] }
])(async (req: NextRequest, context: AuthContext) => {
  
  const invoiceData = await req.json();
  
  // Additional business logic check
  if (invoiceData.amount > 50000 && context.user.role !== 'chairman') {
    return NextResponse.json(
      { error: 'Large invoices require chairman approval' },
      { status: 403 }
    );
  }
  
  const invoice = await createInvoice(invoiceData, context.cooperativeId);
  
  // Log financial action
  await logFinancialAccess(
    {
      userId: context.user.id,
      userRole: context.user.role,
      cooperativeId: context.cooperativeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    },
    'create_invoice',
    'invoice',
    invoice.id
  );
  
  return NextResponse.json({ data: invoice }, { status: 201 });
});

/**
 * Example 3: Role hierarchy check
 * Swedish context: Only chairman and admin can manage board members
 */
export const manageBoardMemberExample = withAuthorization([
  { type: 'hierarchy', minRole: 'chairman' }
])(async (req: NextRequest, context: AuthContext) => {
  
  const { targetUserId, newRole } = await req.json();
  
  // Additional check: can't demote yourself
  if (targetUserId === context.user.id) {
    return NextResponse.json(
      { error: 'Cannot modify your own role' },
      { status: 400 }
    );
  }
  
  // Check if user can assign the target role
  const canAssignRole = context.user.role === 'admin' || 
    (newRole !== 'admin' && newRole !== 'chairman');
  
  if (!canAssignRole) {
    return NextResponse.json(
      { error: 'Insufficient permissions to assign this role' },
      { status: 403 }
    );
  }
  
  await updateUserRole(targetUserId, newRole, context.cooperativeId);
  
  return NextResponse.json({ message: 'Role updated successfully' });
});

/**
 * Example 4: Conditional permissions based on user role
 * Swedish context: Different access levels for member directory
 */
export const getMemberDirectoryExample = withAuthorization([
  { type: 'single', permission: 'canViewMembers' }
])(async (req: NextRequest, context: AuthContext) => {
  
  const members = await fetchMembers(context.cooperativeId);
  
  // Filter member data based on permissions
  const filteredMembers = members.map(member => {
    const basicInfo = {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      apartmentNumber: member.apartmentNumber,
    };
    
    // Board members and above can see contact information
    if (hasPermission(context.user.role, 'canManageMembers')) {
      return {
        ...basicInfo,
        email: member.email,
        phone: member.phone,
        role: member.role,
        lastLoginAt: member.lastLoginAt,
      };
    }
    
    return basicInfo;
  });
  
  // Log member data access for GDPR compliance
  const memberIds = filteredMembers.map(m => m.id);
  await logMemberDataAccess(
    {
      userId: context.user.id,
      userRole: context.user.role,
      cooperativeId: context.cooperativeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    },
    'view_member_directory',
    memberIds
  );
  
  return NextResponse.json({
    data: filteredMembers,
    permissions: {
      canSeeContactInfo: hasPermission(context.user.role, 'canManageMembers'),
      canEditMembers: hasPermission(context.user.role, 'canManageMembers'),
    }
  });
});

/**
 * Example 5: Swedish BRF specific - Annual meeting protocols
 * Only chairman can approve annual meeting minutes
 */
export const approveAnnualMeetingExample = withAuthorization([
  { type: 'single', permission: 'canApproveMeetingMinutes' },
  { type: 'role', role: 'chairman' } // Swedish law: Only chairman can approve
])(async (req: NextRequest, context: AuthContext) => {
  
  const { meetingId } = await req.json();
  
  const meeting = await getMeeting(meetingId, context.cooperativeId);
  
  if (!meeting) {
    return NextResponse.json(
      { error: 'Meeting not found' },
      { status: 404 }
    );
  }
  
  // Swedish BRF rule: Annual meeting must have quorum
  if (meeting.type === 'annual' && !meeting.quorumMet) {
    return NextResponse.json(
      { error: 'Cannot approve: Annual meeting did not meet quorum requirements' },
      { status: 400 }
    );
  }
  
  await approveMeetingMinutes(meetingId, context.user.id);
  
  return NextResponse.json({ 
    message: 'Annual meeting minutes approved',
    approvedBy: context.user.id,
    approvedAt: new Date().toISOString()
  });
});

// =============================================================================
// REACT COMPONENT EXAMPLES
// =============================================================================

/**
 * Example 6: Protected React component with multiple permission checks
 */
import React from 'react';
import { ProtectedRoute, PermissionGate, usePermissions } from '@/components/auth/ProtectedRoute';

export const FinancialDashboard: React.FC = () => {
  return (
    <ProtectedRoute 
      requirements={[
        { type: 'single', permission: 'canViewFinancialReports' },
        { type: 'hierarchy', minRole: 'treasurer' }
      ]}
      showAccessDenied={true}
    >
      <div className="financial-dashboard">
        <h1>Ekonomisk översikt</h1>
        
        <PermissionGate permission="canViewInvoices">
          <InvoicesSummary />
        </PermissionGate>
        
        <PermissionGate permission="canExportFinancialData">
          <ExportButtons />
        </PermissionGate>
        
        <PermissionGate 
          permissions={['canCreateInvoices', 'canApproveInvoices']}
          requireAll={false} // OR logic
        >
          <InvoiceManagement />
        </PermissionGate>
        
        <PermissionGate role="admin">
          <AdminFinancialTools />
        </PermissionGate>
      </div>
    </ProtectedRoute>
  );
};

/**
 * Example 7: Using permissions hook for complex logic
 */
export const MemberManagement: React.FC = () => {
  const { 
    user, 
    checkPermission, 
    checkRole,
    canManageUser,
    roleDisplayName 
  } = usePermissions();
  
  const canViewMembers = checkPermission('canViewMembers');
  const canManageMembers = checkPermission('canManageMembers');
  const isChairmanOrAdmin = checkRole('chairman') || checkRole('admin');
  
  if (!canViewMembers) {
    return <div>Du har inte behörighet att visa medlemmar.</div>;
  }
  
  return (
    <div>
      <h1>Medlemshantering</h1>
      <p>Inloggad som: {roleDisplayName}</p>
      
      {canManageMembers && (
        <button className="btn-primary">
          Lägg till medlem
        </button>
      )}
      
      <MemberList 
        canEdit={canManageMembers}
        canViewContactInfo={canManageMembers}
      />
      
      {isChairmanOrAdmin && (
        <div className="admin-section">
          <h2>Administratörsverktyg</h2>
          <button onClick={() => exportMemberData()}>
            Exportera medlemsdata
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Example 8: Conditional navigation based on permissions
 */
export const NavigationMenu: React.FC = () => {
  const { checkPermission, checkRole } = usePermissions();
  
  return (
    <nav>
      <ul>
        <li><a href="/dashboard">Hem</a></li>
        
        <PermissionGate permission="canViewDocuments">
          <li><a href="/documents">Dokument</a></li>
        </PermissionGate>
        
        <PermissionGate permission="canViewMembers">
          <li><a href="/members">Medlemmar</a></li>
        </PermissionGate>
        
        <PermissionGate permission="canViewFinancialReports">
          <li><a href="/finances">Ekonomi</a></li>
        </PermissionGate>
        
        <PermissionGate 
          permissions={['canScheduleMeetings', 'canEditProtocols']}
          requireAll={false}
        >
          <li><a href="/meetings">Möten</a></li>
        </PermissionGate>
        
        <PermissionGate role="admin">
          <li><a href="/admin">Administration</a></li>
        </PermissionGate>
      </ul>
    </nav>
  );
};

// =============================================================================
// UTILITY FUNCTION EXAMPLES
// =============================================================================

/**
 * Example 9: Custom permission checking utility
 */
export function checkBRFSpecificPermissions(user: any) {
  const permissions = getRolePermissions(user.role, true);
  
  return {
    // Financial permissions
    canHandleMonthlyFees: permissions.canViewInvoices && permissions.canApproveInvoices,
    canManageAnnualBudget: permissions.canViewFinancialReports && user.role !== 'member',
    canExportTaxDocuments: permissions.canExportFinancialData && user.role !== 'board',
    
    // Member permissions
    canAccessMemberPersonalData: permissions.canManageMembers,
    canModifyMemberRoles: user.role === 'chairman' || user.role === 'admin',
    
    // Meeting permissions
    canCallEmergencyMeeting: user.role === 'chairman' || user.role === 'admin',
    canApproveAnnualReport: user.role === 'chairman',
    
    // Maintenance permissions
    canApproveMaintenanceCosts: permissions.canApproveInvoices,
    canHireContractors: user.role !== 'member',
    
    // Legal compliance
    canAccessAuditTrail: permissions.canAccessAuditLog,
    canHandleGDPRRequests: user.role === 'admin',
  };
}

/**
 * Example 10: Permission-based data filtering
 */
export function filterDataByPermissions(data: any[], user: any, dataType: string) {
  const userPermissions = getRolePermissions(user.role, true);
  
  switch (dataType) {
    case 'invoices':
      return data.filter(invoice => {
        // Members can only see their own invoices
        if (user.role === 'member') {
          return invoice.apartmentId === user.apartmentId;
        }
        // Board and above can see all invoices
        return userPermissions.canViewInvoices;
      });
      
    case 'members':
      return data.map(member => {
        const filteredMember = {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          apartmentNumber: member.apartmentNumber,
        };
        
        // Add sensitive data only if permitted
        if (userPermissions.canManageMembers) {
          return {
            ...filteredMember,
            email: member.email,
            phone: member.phone,
            personalNumber: member.personalNumber,
          };
        }
        
        return filteredMember;
      });
      
    case 'meetings':
      return data.filter(meeting => {
        // Board meetings are restricted to board members
        if (meeting.type === 'board' && user.role === 'member') {
          return false;
        }
        return true;
      });
      
    default:
      return data;
  }
}

/**
 * Example 11: Swedish BRF compliance checker
 */
export function checkBRFComplianceRequirements(action: string, user: any, data: any) {
  const issues: string[] = [];
  
  switch (action) {
    case 'approve_annual_meeting':
      if (user.role !== 'chairman') {
        issues.push('Endast styrelseordförande kan godkänna årsmötesprotokoll');
      }
      if (!data.quorumMet) {
        issues.push('Årsmöte måste ha beslutförhet för godkännande');
      }
      break;
      
    case 'approve_large_expense':
      if (data.amount > 100000 && user.role === 'board') {
        issues.push('Stora utgifter kräver ordförandegodkännande');
      }
      break;
      
    case 'access_member_personal_data':
      if (!hasPermission(user.role, 'canManageMembers')) {
        issues.push('GDPR: Ingen behörighet för personuppgifter');
      }
      break;
      
    case 'export_financial_data':
      if (!hasPermission(user.role, 'canExportFinancialData')) {
        issues.push('Ingen behörighet för dataexport');
      }
      break;
  }
  
  return {
    isCompliant: issues.length === 0,
    issues,
    legalBasis: getBRFLegalBasis(action),
  };
}

function getBRFLegalBasis(action: string): string {
  const legalBases: Record<string, string> = {
    'approve_annual_meeting': 'Bostadsrättslagen 9 kap. 8 §',
    'approve_large_expense': 'Bostadsrättslagen 7 kap. 3 §',
    'access_member_personal_data': 'GDPR Art. 6.1(f) - Berättigat intresse',
    'export_financial_data': 'Bokföringslagen 7 kap.',
  };
  
  return legalBases[action] || 'Ej specificerad laggrund';
}

// Mock functions (would be implemented with real database calls)
async function fetchInvoicesForCooperative(cooperativeId: string) { return []; }
async function createInvoice(data: any, cooperativeId: string) { return { id: '1' }; }
async function updateUserRole(userId: string, role: string, cooperativeId: string) { return true; }
async function fetchMembers(cooperativeId: string) { return []; }
async function getMeeting(meetingId: string, cooperativeId: string) { return null; }
async function approveMeetingMinutes(meetingId: string, userId: string) { return true; }

// Mock React components
const InvoicesSummary = () => <div>Invoices Summary</div>;
const ExportButtons = () => <div>Export Buttons</div>;
const InvoiceManagement = () => <div>Invoice Management</div>;
const AdminFinancialTools = () => <div>Admin Tools</div>;
const MemberList = (props: any) => <div>Member List</div>;

function exportMemberData() {
  console.log('Exporting member data...');
}