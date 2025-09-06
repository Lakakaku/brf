# BRF Portal RBAC System Documentation

## Översikt (Overview)

BRF Portal implementerar ett omfattande rollbaserat åtkomstkontrollsystem (RBAC) som är skräddarsytt för svenska bostadsrättsföreningar. Systemet följer svenska bostadsrättslagar och GDPR-krav samtidigt som det säkerställer att endast behöriga användare kan komma åt känslig information.

The BRF Portal implements a comprehensive Role-Based Access Control (RBAC) system tailored for Swedish housing cooperatives. The system follows Swedish cooperative law and GDPR requirements while ensuring only authorized users can access sensitive information.

## Svensk BRF-rollhierarki (Swedish BRF Role Hierarchy)

### Roller (Roles)

1. **Bostadsrättsinnehavare (Member)** - `member`
   - Grundläggande medlemsrättigheter
   - Kan visa allmänna dokument och skapa ärenden
   - Kan boka gemensamma utrymmen

2. **Styrelseledamot (Board Member)** - `board`
   - Utökade rättigheter för styrelsearbete
   - Kan godkänna dokument och fakturor
   - Kan hantera bokningar och visa medlemsinfo

3. **Kassör/Ekonomiansvarig (Treasurer)** - `treasurer`
   - Särskilda ekonomiska rättigheter
   - Kan skapa fakturor och exportera ekonomiska data
   - Samma rättigheter som styrelseledamot plus ekonomi

4. **Styrelseordförande (Chairman)** - `chairman`
   - Högsta behörighet inom styrelsen
   - Kan hantera medlemmar och stänga ärenden
   - Kan godkänna mötesprotokoll

5. **Systemadministratör (Admin)** - `admin`
   - Full systemåtkomst
   - Kan hantera föreningsinställningar
   - Kan komma åt revisionsloggen

## Behörigheter (Permissions)

### Dokumenthantering
- `canViewDocuments` - Visa dokument
- `canUploadDocuments` - Ladda upp dokument
- `canApproveDocuments` - Godkänna dokument

### Ekonomi
- `canViewInvoices` - Visa fakturor
- `canApproveInvoices` - Godkänna fakturor
- `canCreateInvoices` - Skapa fakturor
- `canViewFinancialReports` - Visa ekonomiska rapporter
- `canExportFinancialData` - Exportera ekonomiska data

### Medlemshantering
- `canViewMembers` - Visa medlemmar
- `canManageMembers` - Hantera medlemmar

### Ärendehantering
- `canCreateCases` - Skapa ärenden
- `canAssignCases` - Tilldela ärenden
- `canCloseCases` - Stänga ärenden

### Möteshantering
- `canScheduleMeetings` - Boka möten
- `canEditProtocols` - Redigera protokoll
- `canApproveMeetingMinutes` - Godkänna mötesprotokoll

### Bokningar
- `canMakeBookings` - Göra bokningar
- `canManageBookings` - Hantera bokningar
- `canManageResources` - Hantera resurser

### Administration
- `canManageCooperative` - Hantera förening
- `canAccessAuditLog` - Komma åt revisionslogg
- `canManageSystemSettings` - Hantera systeminställningar

## Implementation Guide

### Backend Authorization

#### Using the Authorization Middleware

```typescript
import { withAuthorization } from '@/lib/auth/authorize';

// Single permission requirement
export const GET = withAuthorization([
  { type: 'single', permission: 'canViewMembers' }
])(async (req: NextRequest, context: AuthContext) => {
  // Your handler code here
  // context.user contains the authenticated user
  // context.cooperativeId ensures cooperative isolation
});

// Multiple permission requirements (AND logic)
export const POST = withAuthorization([
  { type: 'all', permissions: ['canManageMembers', 'canViewFinancialReports'] }
])(async (req: NextRequest, context: AuthContext) => {
  // Handler code
});

// Role-based access
export const DELETE = withAuthorization([
  { type: 'role', role: 'admin' }
])(async (req: NextRequest, context: AuthContext) => {
  // Only admins can access
});

// Hierarchy-based access
export const PUT = withAuthorization([
  { type: 'hierarchy', minRole: 'chairman' }
])(async (req: NextRequest, context: AuthContext) => {
  // Chairman, treasurer, and admin can access
});
```

#### Advanced Authorization Patterns

```typescript
import { 
  authorizeCooperativeAccess,
  authorizeUserManagement,
  authorizeFinancialAccess 
} from '@/lib/auth/authorize';

// Cooperative-specific data access
const authResult = await authorizeCooperativeAccess(
  req,
  cooperativeId,
  [{ type: 'single', permission: 'canViewMembers' }]
);

// User management with role hierarchy
const canManageUser = await authorizeUserManagement(
  req,
  targetUserId,
  targetUserRole
);

// Financial data access with operation type
const canAccessFinancial = await authorizeFinancialAccess(
  req,
  'export' // 'view' | 'create' | 'approve' | 'export'
);
```

### Frontend Protection

#### Protected Routes

```typescript
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function AdminPage() {
  return (
    <ProtectedRoute 
      requirements={[{ type: 'role', role: 'admin' }]}
      fallback={<div>Åtkomst nekad</div>}
    >
      <AdminDashboard />
    </ProtectedRoute>
  );
}

// Multiple requirements
function FinancialPage() {
  return (
    <ProtectedRoute 
      requirements={[
        { type: 'single', permission: 'canViewFinancialReports' },
        { type: 'hierarchy', minRole: 'treasurer' }
      ]}
    >
      <FinancialDashboard />
    </ProtectedRoute>
  );
}
```

#### Permission Gates

```typescript
import { PermissionGate } from '@/components/auth/ProtectedRoute';

function MemberList() {
  return (
    <div>
      <h1>Medlemmar</h1>
      
      <PermissionGate permission="canManageMembers">
        <button>Lägg till medlem</button>
      </PermissionGate>
      
      <PermissionGate 
        permissions={['canViewMembers', 'canViewFinancialReports']}
        requireAll={false} // OR logic
      >
        <MemberTable />
      </PermissionGate>
      
      <PermissionGate 
        role="admin"
        fallback={<div>Endast för administratörer</div>}
      >
        <AdminTools />
      </PermissionGate>
    </div>
  );
}
```

#### Using the Permissions Hook

```typescript
import { usePermissions } from '@/components/auth/ProtectedRoute';

function Dashboard() {
  const {
    user,
    checkPermission,
    canAccessFinancial,
    isAdmin,
    isBoardMember,
    roleDisplayName
  } = usePermissions();

  const canManageMembers = checkPermission('canManageMembers');
  const canExportData = canAccessFinancial('export');

  return (
    <div>
      <h1>Välkommen, {user?.firstName}</h1>
      <p>Roll: {roleDisplayName}</p>
      
      {canManageMembers && (
        <button>Hantera medlemmar</button>
      )}
      
      {canExportData && (
        <button>Exportera ekonomiska data</button>
      )}
      
      {isAdmin && (
        <AdminPanel />
      )}
    </div>
  );
}
```

### Audit Logging

#### Automatic Audit Logging

All authorization events are automatically logged:

```typescript
// Authorization events are logged automatically
const authResult = await authorize(req, requirements);
// Logs: ACCESS_GRANTED or ACCESS_DENIED

// RBAC management events
await logRBACEvent(
  AuditEventType.ROLE_ASSIGNED,
  context,
  targetUserId,
  { role: 'member' },
  { role: 'board' }
);
```

#### Manual Audit Logging

```typescript
import { 
  logFinancialAccess,
  logMemberDataAccess,
  logSecurityEvent 
} from '@/lib/auth/audit';

// Financial data access
await logFinancialAccess(
  context,
  'export_monthly_report',
  'financial_report',
  reportId,
  true // exported
);

// Member data access (GDPR sensitive)
await logMemberDataAccess(
  context,
  'view_member_details',
  [memberId],
  false // not exported
);

// Security events
await logSecurityEvent(
  AuditEventType.SUSPICIOUS_ACTIVITY,
  context,
  { reason: 'Multiple failed permission checks' }
);
```

## Security Features

### Multi-Tenant Isolation

All data access is automatically filtered by cooperative ID:

```typescript
// Automatic cooperative isolation
const filters = createPermissionFilter(user, 'members');
// Returns: { cooperative_id: user.cooperativeId, ...additionalFilters }
```

### Rate Limiting

Built-in rate limiting protects against abuse:

```typescript
// Automatic rate limiting for authorization checks
// 100 permission checks per minute per user
// 5 role changes per hour
// 10 audit log accesses per minute
```

### GDPR Compliance

- **Data Minimization**: Users only see data they need
- **Audit Logging**: All personal data access is logged
- **Retention**: Audit logs have configurable retention periods
- **Legal Basis**: Each permission includes legal basis documentation

### Defense in Depth

1. **Authentication**: JWT tokens + session management
2. **Authorization**: Role-based permissions + hierarchy checks
3. **Data Filtering**: Cooperative isolation + permission-based filters
4. **Audit Logging**: Comprehensive event logging
5. **Rate Limiting**: Protection against abuse
6. **Security Headers**: OWASP recommended headers

## Best Practices

### API Development

1. **Always use authorization middleware** for protected routes
2. **Check cooperative isolation** for multi-tenant data
3. **Log sensitive data access** for audit compliance
4. **Use permission-based filtering** for database queries
5. **Return appropriate error messages** without revealing system details

### Frontend Development

1. **Use ProtectedRoute** for page-level protection
2. **Use PermissionGate** for component-level protection
3. **Use usePermissions hook** for conditional logic
4. **Show user-friendly access denied messages**
5. **Display user role and permissions** clearly

### Security Considerations

1. **Principle of Least Privilege**: Users get minimal required permissions
2. **Role Hierarchy**: Higher roles inherit lower role permissions
3. **Cooperative Isolation**: Users can only access their cooperative's data
4. **Audit Everything**: Log all authorization decisions and data access
5. **Regular Permission Reviews**: Audit and review user permissions regularly

## Common Usage Patterns

### BRF-Specific Scenarios

#### Monthly Fee Management
```typescript
// Only treasurer and above can approve fee adjustments
export const PUT = withAuthorization([
  { type: 'hierarchy', minRole: 'treasurer' },
  { type: 'single', permission: 'canApproveInvoices' }
]);
```

#### Board Meeting Minutes
```typescript
// Only chairman can approve meeting minutes
export const POST = withAuthorization([
  { type: 'single', permission: 'canApproveMeetingMinutes' }
]);
```

#### Member Directory Access
```typescript
// Board members can see member details, regular members only names
<PermissionGate permission="canManageMembers">
  <MemberContactInfo member={member} />
</PermissionGate>
```

#### Financial Data Export
```typescript
// Special logging for GDPR compliance
const exported = await exportFinancialData();
await logFinancialAccess(context, 'export_annual_report', 'report', reportId, true);
```

## Error Handling

### Authorization Errors

```typescript
try {
  const result = await authorize(req, requirements);
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.type) {
      case AuthErrorType.INSUFFICIENT_PERMISSIONS:
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      case AuthErrorType.RATE_LIMIT_EXCEEDED:
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      default:
        return NextResponse.json({ error: 'Authorization failed' }, { status: 401 });
    }
  }
}
```

### Frontend Error Handling

```typescript
<ProtectedRoute 
  requirements={[{ type: 'role', role: 'admin' }]}
  showAccessDenied={true}
  fallback={
    <CustomAccessDeniedMessage 
      message="Endast administratörer kan komma åt denna sida"
      contactInfo="Kontakta styrelsen för mer information"
    />
  }
>
  <AdminPage />
</ProtectedRoute>
```

## Testing

### Unit Tests

```typescript
import { hasPermission, canManageRole } from '@/lib/auth/rbac';

describe('RBAC System', () => {
  test('chairman can manage board members', () => {
    expect(canManageRole('chairman', 'board')).toBe(true);
    expect(canManageRole('board', 'chairman')).toBe(false);
  });

  test('treasurer has financial permissions', () => {
    expect(hasPermission('treasurer', 'canViewFinancialReports')).toBe(true);
    expect(hasPermission('member', 'canViewFinancialReports')).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('Authorization Middleware', () => {
  test('allows authorized access', async () => {
    const req = createMockRequest({ role: 'admin' });
    const result = await authorize(req, [{ type: 'role', role: 'admin' }]);
    expect(result.allowed).toBe(true);
  });

  test('denies unauthorized access', async () => {
    const req = createMockRequest({ role: 'member' });
    const result = await authorize(req, [{ type: 'role', role: 'admin' }]);
    expect(result.allowed).toBe(false);
  });
});
```

## Migration and Updates

### Adding New Permissions

1. Add permission to `BRFPermissions` interface in `types.ts`
2. Define permission details in `BRF_PERMISSIONS` in `rbac.ts`
3. Update `ROLE_PERMISSIONS` mapping
4. Add database migration if needed
5. Update frontend components to use new permission

### Role Changes

1. Update role hierarchy in `BRF_ROLES`
2. Adjust permission inheritance
3. Update existing user roles in database
4. Test all affected functionality
5. Update documentation

## Compliance and Legal

### Swedish Cooperative Law (Bostadsrättslagen)

- **Chapter 7**: Board responsibilities and authority
- **Chapter 9**: Meeting requirements and protocols
- **GDPR**: Personal data protection and audit requirements
- **Accounting Standards**: K2/K3 compliance for financial reporting

### Audit Requirements

- **7-year retention** for financial audit logs
- **3-year retention** for GDPR-sensitive personal data logs
- **Real-time alerts** for security violations
- **Annual permission review** recommended

This RBAC system ensures compliance with Swedish housing cooperative governance while providing robust security and user experience.