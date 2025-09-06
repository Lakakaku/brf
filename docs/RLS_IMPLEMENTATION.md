# Row-Level Security (RLS) Implementation Guide

## Overview

This document describes the mock Row-Level Security (RLS) implementation for the BRF Portal SQLite database. Since SQLite doesn't have native RLS like PostgreSQL, we've implemented a comprehensive security layer that ensures strict data isolation between cooperatives.

## Architecture

### Core Components

1. **RLS Database Wrapper** (`/lib/database/rls.ts`)
   - Automatic cooperative_id filtering
   - Query validation and sanitization
   - CRUD operations with built-in security

2. **Security Middleware** (`/lib/database/security.ts`)
   - Authentication and authorization
   - Rate limiting and suspicious activity detection
   - Comprehensive audit logging

3. **Filtered Database Views** (`/lib/database/views.ts`)
   - Pre-built views with cooperative filtering
   - Performance-optimized queries
   - Business logic encapsulation

4. **Secure Repositories** (`/lib/database/utils.ts`)
   - High-level database operations
   - Role-based access control
   - Input sanitization and validation

## Security Features

### 1. Automatic Data Isolation

Every database operation is automatically filtered by `cooperative_id`:

```typescript
// Bad: Direct database access (bypasses RLS)
const members = db.prepare('SELECT * FROM members').all();

// Good: RLS-aware database access
const rlsDb = createRLSDatabase(db, { cooperative_id: 'coop-123', user_id: 'user-456' });
const members = rlsDb.select('members'); // Automatically filtered by cooperative_id
```

### 2. Query Validation

All queries are validated to prevent:
- SQL injection attempts
- RLS bypass attempts
- Mass delete/update operations
- Unauthorized schema modifications

```typescript
// These queries will be blocked:
"SELECT * FROM members WHERE cooperative_id != 'other-coop'"  // RLS bypass attempt
"DROP TABLE members"                                           // Schema modification
"DELETE FROM members WHERE 1=1"                              // Mass delete
```

### 3. Role-Based Access Control

Different user roles have different permissions:

```typescript
const permissions = {
  member: ['SELECT'],
  board: ['SELECT', 'INSERT', 'UPDATE'],
  treasurer: ['SELECT', 'INSERT', 'UPDATE'],
  chairman: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  admin: ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
};
```

### 4. Audit Logging

All database operations are logged for security monitoring:

```typescript
auditSecurityAccess({
  cooperative_id: 'coop-123',
  user_id: 'user-456',
  action: 'SELECT',
  table: 'invoices',
  success: true,
  timestamp: '2024-01-15T10:30:00Z'
});
```

## Implementation Details

### Database Schema Requirements

All tables (except system tables) must have a `cooperative_id` field:

```sql
CREATE TABLE example_table (
  id TEXT PRIMARY KEY,
  cooperative_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
  -- other fields...
);
```

### RLS Context

Every database operation requires a security context:

```typescript
interface RLSContext {
  cooperative_id: string;    // Required: Tenant identifier
  user_id?: string;         // Optional: User identifier
  user_role?: string;       // Optional: User role for RBAC
  ip_address?: string;      // Optional: For audit logging
  user_agent?: string;      // Optional: For audit logging
}
```

### Usage Patterns

#### 1. Basic CRUD Operations

```typescript
// Create RLS-aware database instance
const context: RLSContext = {
  cooperative_id: 'coop-123',
  user_id: 'user-456',
  user_role: 'treasurer'
};
const rlsDb = createRLSDatabase(db, context);

// SELECT: Automatically filtered by cooperative_id
const members = rlsDb.select('members', {
  where: { is_active: 1 },
  orderBy: 'last_name',
  limit: 10
});

// INSERT: Automatically adds cooperative_id
const newMember = rlsDb.insert('members', {
  email: 'new@example.com',
  first_name: 'John',
  last_name: 'Doe',
  role: 'member'
  // cooperative_id is automatically injected
});

// UPDATE: Only affects records with matching cooperative_id
const updated = rlsDb.update('members', 
  { phone: '+46701234567' },
  { id: 'member-123' }
);

// DELETE: Only affects records with matching cooperative_id
const deleted = rlsDb.delete('members', { id: 'member-123' });
```

#### 2. Repository Pattern

```typescript
// Use secure repositories for common operations
const membersRepo = new MembersRepository(context);

// Find active members (automatically filtered)
const activeMembers = membersRepo.findActiveMembers();

// Role-based operations
const boardMembers = membersRepo.findByRole('board');

// Permission-controlled operations
membersRepo.updateRole('member-123', 'treasurer'); // Requires admin/chairman role
```

#### 3. Transaction Support

```typescript
// Execute multiple operations in a transaction
const result = withSecureTransaction(context, (rlsDb) => {
  const member = rlsDb.insert('members', memberData);
  const apartment = rlsDb.update('apartments', { owner_id: member.id }, { id: apartmentId });
  return { member, apartment };
});
```

#### 4. View-Based Queries

```typescript
// Use pre-built views for complex queries
const activeCases = rlsDb.executeQuery(`
  SELECT * FROM v_active_cases 
  WHERE cooperative_id = ? 
  ORDER BY priority, reported_at
`, [context.cooperative_id]);

const financialSummary = rlsDb.executeQuery(`
  SELECT * FROM v_financial_summary 
  WHERE cooperative_id = ?
`, [context.cooperative_id]);
```

## Security Considerations

### 1. Input Validation

Always sanitize user input:

```typescript
import { sanitizeInput } from './utils';

const sanitizedData = sanitizeInput(userInput);
const result = rlsDb.insert('members', sanitizedData);
```

### 2. Authentication

Validate user tokens before database operations:

```typescript
const middleware = new SecurityMiddleware(db);
const authContext = await middleware.authenticate(token, cooperativeId);
if (!authContext) {
  throw new Error('Authentication failed');
}
```

### 3. Rate Limiting

Prevent abuse with built-in rate limiting:

```typescript
const { middleware } = createSecureContext(db, cooperativeId, context);
if (!middleware.checkRateLimit(context)) {
  throw new Error('Rate limit exceeded');
}
```

### 4. Query Analysis

Suspicious queries are automatically detected and blocked:

```typescript
// These patterns trigger security alerts:
- SQL injection attempts (UNION SELECT, OR 1=1)
- RLS bypass attempts (cooperative_id != ?)
- Mass operations (DELETE/UPDATE with 1=1)
```

## Database Views

### Available Views

1. **v_active_members** - Active cooperative members
2. **v_apartments_with_owners** - Apartments with owner information
3. **v_outstanding_monthly_fees** - Unpaid monthly fees
4. **v_outstanding_invoices** - Unpaid invoices with overdue status
5. **v_active_cases** - Open cases with priority and assignment info
6. **v_upcoming_board_meetings** - Scheduled board meetings
7. **v_energy_consumption_analysis** - Energy usage with efficiency metrics
8. **v_booking_availability** - Resource availability for bookings
9. **v_contractor_performance** - Contractor ratings and statistics
10. **v_queue_statistics** - Apartment queue statistics
11. **v_financial_summary** - Comprehensive financial overview

### Using Views

```typescript
// Views automatically include cooperative filtering
const summary = rlsDb.executeQuery(`
  SELECT * FROM v_financial_summary 
  WHERE cooperative_id = ?
`, [context.cooperative_id]);

const outstandingFees = rlsDb.executeQuery(`
  SELECT * FROM v_outstanding_monthly_fees 
  WHERE cooperative_id = ?
`, [context.cooperative_id]);
```

## Error Handling

### Common Error Types

```typescript
// RLS Violations
"RLS_VIOLATION: Attempt to insert data for different cooperative"
"RLS_VIOLATION: Query contains potentially dangerous operations"

// Authorization Errors
"AUTHORIZATION_ERROR: Insufficient permissions to change user roles"
"AUTHORIZATION_ERROR: Insufficient permissions to assign cases"

// Security Errors
"SECURITY_ERROR: Rate limit exceeded"
"SECURITY_ERROR: Suspicious activity detected"

// Validation Errors
"RLS_ERROR: cooperative_id is required for all database operations"
"RLS_ERROR: Table 'invalid_table' is not allowed"
```

### Error Handling Best Practices

```typescript
try {
  const result = rlsDb.select('members');
} catch (error) {
  if (error.message.startsWith('RLS_')) {
    // Handle RLS-specific errors
    console.error('Security violation:', error.message);
    // Log security incident
    // Return appropriate error response
  } else {
    // Handle other database errors
    console.error('Database error:', error.message);
  }
}
```

## Performance Considerations

### 1. Indexing

Ensure proper indexing on `cooperative_id`:

```sql
CREATE INDEX idx_table_cooperative ON table_name(cooperative_id);
```

### 2. Query Optimization

- Use views for complex queries
- Limit result sets with LIMIT/OFFSET
- Use prepared statements for repeated queries

### 3. Connection Management

```typescript
// Reuse database connections
const db = getDatabase(); // Singleton pattern

// Close connections when done
process.on('exit', () => {
  closeDatabase();
});
```

## Testing

### Unit Tests

```typescript
describe('RLS Implementation', () => {
  it('should filter by cooperative_id', () => {
    const context = { cooperative_id: 'coop-1', user_id: 'user-1' };
    const rlsDb = createRLSDatabase(db, context);
    
    const members = rlsDb.select('members');
    
    // All members should belong to coop-1
    members.forEach(member => {
      expect(member.cooperative_id).toBe('coop-1');
    });
  });

  it('should prevent cross-cooperative access', () => {
    const context = { cooperative_id: 'coop-1', user_id: 'user-1' };
    const rlsDb = createRLSDatabase(db, context);
    
    expect(() => {
      rlsDb.insert('members', { cooperative_id: 'coop-2', email: 'test@example.com' });
    }).toThrow('RLS_VIOLATION');
  });
});
```

### Integration Tests

Test with actual database operations:

```typescript
describe('Security Integration', () => {
  it('should enforce role-based permissions', async () => {
    const memberContext = { cooperative_id: 'coop-1', user_role: 'member' };
    const repo = new InvoicesRepository(memberContext);
    
    expect(() => {
      repo.markPaid('invoice-123');
    }).toThrow('AUTHORIZATION_ERROR');
  });
});
```

## Deployment

### Environment Variables

```bash
# Database configuration
DATABASE_URL=./database/brf.db
NODE_ENV=production

# Security settings
ENABLE_AUDIT_LOGGING=true
ENABLE_RATE_LIMITING=true
MAX_REQUESTS_PER_MINUTE=100
```

### Production Checklist

- [ ] Enable audit logging
- [ ] Configure rate limiting
- [ ] Set up monitoring for security events
- [ ] Regular backup of audit logs
- [ ] Monitor for suspicious activity
- [ ] Review and rotate authentication tokens

## Monitoring

### Security Metrics

Monitor these metrics in production:

1. **Authentication failures**
2. **Authorization violations**
3. **Rate limit exceedances**
4. **Suspicious query patterns**
5. **Cross-cooperative access attempts**

### Alerting

Set up alerts for:

- High number of security violations
- Multiple failed authentication attempts
- Suspicious query patterns
- Unusual data access patterns

## Maintenance

### Regular Tasks

1. **Clean up expired security records**
2. **Review audit logs for security incidents**
3. **Update security rules based on new threats**
4. **Performance optimization of indexes**
5. **Backup and archive audit logs**

### Updates

When updating the RLS implementation:

1. **Test thoroughly in development**
2. **Review security implications**
3. **Update documentation**
4. **Monitor for performance impact**
5. **Train team on new features**

## Conclusion

This RLS implementation provides comprehensive security for multi-tenant BRF data while maintaining performance and usability. The automatic filtering, role-based access control, and audit logging ensure that each cooperative's data remains isolated and secure.

For questions or security concerns, contact the development team or security officer.