# Advanced Authentication System Documentation

This document describes the advanced session management and authentication system implemented for the BRF Portal.

## Overview

The BRF Portal uses a sophisticated authentication system that combines:

- **JWT Access/Refresh Tokens** - Stateless authentication with automatic refresh
- **Database Token Storage** - Secure token tracking and revocation
- **Client-Side Session Management** - Automatic token renewal and activity tracking
- **Session Monitoring** - Real-time session expiry warnings
- **Role-Based Access Control** - Swedish BRF hierarchy with permissions
- **Enhanced Security** - Token rotation, blacklisting, and audit logging

## Architecture Components

### 1. Server-Side Components

#### `/lib/auth/tokens.ts` - Enhanced Token Management
- **`createEnhancedTokenPair()`** - Creates access/refresh tokens with database storage
- **`refreshAccessToken()`** - Handles token refresh with rotation
- **`revokeRefreshToken()`** - Revokes specific tokens
- **`revokeAllUserTokens()`** - Logout from all devices
- **`validateSession()`** - Session validation with activity tracking
- **`cleanupExpiredTokens()`** - Background cleanup job

#### API Routes
- **`/api/auth/refresh`** - Token refresh endpoint with rate limiting
- **`/api/auth/me`** - Current user information and session validation
- **`/api/auth/login`** - Enhanced login with token storage
- **`/api/auth/logout`** - Enhanced logout with token revocation

#### Database Schema
The system creates additional tables for token management:
- `refresh_tokens` - Stores refresh token metadata
- `session_tokens` - Client-side session tracking

### 2. Client-Side Components

#### `/lib/auth/client.ts` - Client Authentication Utilities
- **`TokenManager`** - Handles token storage and refresh
- **`AuthenticatedHttpClient`** - Auto-refreshing HTTP client
- **`authUtils`** - Authentication helpers (login, logout, etc.)

#### `/hooks/useAuth.ts` - Enhanced Authentication Hook
- Automatic token refresh
- Session monitoring and warnings
- Activity tracking
- Permission/role utilities

#### `/lib/auth/context.tsx` - React Context Provider
- Application-wide authentication state
- Permission-based component rendering
- Session warning components

## Usage Examples

### Basic Authentication

```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, isLoggedIn, login, logout } = useAuth();

  const handleLogin = async () => {
    const result = await login({
      email: 'user@example.com',
      password: 'password',
      rememberMe: true
    });
    
    if (result.success) {
      console.log('Logged in:', result.user);
    }
  };

  return (
    <div>
      {isLoggedIn ? (
        <div>
          <h1>Welcome {user?.firstName}!</h1>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
    </div>
  );
}
```

### Using Authentication Context

```typescript
import { AuthProvider, usePermissions, ConditionalRender } from '@/lib/auth/context';

function App() {
  return (
    <AuthProvider requireAuth={true} allowedRoles={['board', 'chairman', 'admin']}>
      <Dashboard />
    </AuthProvider>
  );
}

function Dashboard() {
  const { canViewInvoices, canApproveInvoices, isChairman } = usePermissions();

  return (
    <div>
      <ConditionalRender permission="canViewDocuments">
        <DocumentsList />
      </ConditionalRender>
      
      <ConditionalRender anyRole={['chairman', 'admin']}>
        <AdminPanel />
      </ConditionalRender>
      
      {canViewInvoices() && <InvoicesList />}
      {canApproveInvoices() && <InvoiceApproval />}
    </div>
  );
}
```

### Session Management

```typescript
import { useSessionMonitor } from '@/lib/auth/context';

function SessionWarningComponent() {
  const {
    showWarning,
    timeUntilExpiryFormatted,
    extendSession,
    dismissWarning
  } = useSessionMonitor();

  if (!showWarning) return null;

  return (
    <div className="session-warning">
      <p>Session expires in {timeUntilExpiryFormatted}</p>
      <button onClick={extendSession}>Extend Session</button>
      <button onClick={dismissWarning}>Dismiss</button>
    </div>
  );
}
```

### Authenticated HTTP Requests

```typescript
import { httpClient } from '@/lib/auth/client';

async function fetchInvoices() {
  // Automatically handles token refresh if needed
  const response = await httpClient.fetch('/api/invoices');
  
  if (response.ok) {
    return response.json();
  }
  
  throw new Error('Failed to fetch invoices');
}
```

### Advanced Session Management

```typescript
import { useMultiSession, useIdleTimeout } from '@/hooks/useSessionManager';

function SecuritySettings() {
  const { activeSessions, revokeSession, logoutAllSessions } = useMultiSession();
  const { isIdle, timeLeft, formatTimeLeft, extendSession } = useIdleTimeout(30);

  return (
    <div>
      <h2>Active Sessions</h2>
      {activeSessions.map(session => (
        <div key={session.sessionId}>
          <p>{session.userAgent}</p>
          <p>Last active: {session.lastActivity}</p>
          <button onClick={() => revokeSession(session.sessionId)}>
            Revoke Session
          </button>
        </div>
      ))}
      
      <button onClick={logoutAllSessions}>Logout All Devices</button>
      
      {isIdle && (
        <div>
          Session timeout in: {formatTimeLeft()}
          <button onClick={extendSession}>Stay Logged In</button>
        </div>
      )}
    </div>
  );
}
```

## Security Features

### 1. Token Rotation
- Refresh tokens are automatically rotated when close to expiry
- Old tokens are immediately revoked when rotated
- Prevents token hijacking from long-lived tokens

### 2. Token Blacklisting
- Revoked tokens are stored in a blacklist
- Real-time validation against blacklisted tokens
- Automatic cleanup of expired blacklisted tokens

### 3. Session Monitoring
- Real-time activity tracking
- Idle timeout with configurable thresholds
- Session expiry warnings with extension options

### 4. Rate Limiting
- Login attempt rate limiting per IP/email
- Token refresh rate limiting
- Configurable thresholds and lockout periods

### 5. Audit Logging
- All authentication events are logged
- Includes IP addresses, user agents, and timestamps
- Failed login attempt tracking

### 6. Device Security
- Device fingerprinting for trusted device management
- Multiple session management
- Logout from all devices functionality

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secure-secret-key-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Session Configuration
SESSION_SECRET=your-super-secure-session-secret-32chars-min
SESSION_COOKIE_NAME=brf-portal-session
SESSION_MAX_AGE=86400

# Database
DATABASE_PATH=./database/brf.db

# Security
NODE_ENV=production  # Enables secure cookies
```

### Token Storage Initialization

The token storage is automatically initialized on first login, but you can manually initialize it:

```typescript
import { initializeTokenStorage } from '@/lib/auth/tokens';

// Initialize token storage tables
initializeTokenStorage();
```

### Background Cleanup

Set up a background job to clean expired tokens:

```typescript
import { cleanupExpiredTokens } from '@/lib/auth/tokens';

// Run cleanup every hour
setInterval(async () => {
  const result = await cleanupExpiredTokens();
  console.log('Cleaned up:', result);
}, 60 * 60 * 1000);
```

## BRF-Specific Features

### Role Hierarchy
- **member** - Basic cooperative member
- **board** - Board member (styrelsemedlem)
- **chairman** - Board chairman (ordförande)
- **treasurer** - Treasurer (kassör)
- **admin** - System administrator

### Permissions System
Comprehensive permission system covering:
- Document management
- Invoice and financial management
- Member management
- Case management
- Board meeting management
- Booking management
- Financial reports
- Administrative functions

### Swedish Compliance
- Audit logging for regulatory compliance
- GDPR-compliant session management
- Secure handling of personal data
- Board meeting protocol security

## Migration Guide

### From Basic Auth to Advanced Auth

1. **Update Components**:
   ```typescript
   // Old
   import { useAuth } from '@/hooks/useAuth';
   
   // New - Enhanced features
   import { useAuth } from '@/hooks/useAuth';
   // Now includes: sessionWarning, timeUntilExpiry, extendSession, etc.
   ```

2. **Add Context Provider**:
   ```typescript
   // Wrap your app
   function App() {
     return (
       <AuthProvider requireAuth={true}>
         <YourApp />
       </AuthProvider>
     );
   }
   ```

3. **Update HTTP Requests**:
   ```typescript
   // Old
   const response = await fetch('/api/endpoint', {
     headers: { Authorization: `Bearer ${token}` }
   });
   
   // New - Auto-refreshing
   import { httpClient } from '@/lib/auth/client';
   const response = await httpClient.fetch('/api/endpoint');
   ```

4. **Add Session Warnings**:
   ```typescript
   import { SessionWarning } from '@/lib/auth/context';
   
   function Layout() {
     return (
       <div>
         <SessionWarning />
         <YourContent />
       </div>
     );
   }
   ```

## Troubleshooting

### Common Issues

1. **Token Storage Initialization**:
   - Ensure database is writable
   - Check DATABASE_PATH environment variable
   - Verify foreign key constraints are enabled

2. **Session Warnings Not Showing**:
   - Verify SessionWarning component is rendered
   - Check session monitoring is started
   - Ensure AuthProvider wraps components

3. **Automatic Refresh Not Working**:
   - Check refresh token expiry
   - Verify token storage is properly initialized
   - Check browser console for errors

4. **Permission Checks Failing**:
   - Verify user role and permissions in database
   - Check DEFAULT_PERMISSIONS in types.ts
   - Ensure user is properly authenticated

### Performance Optimization

1. **Token Cleanup**:
   - Run background cleanup jobs regularly
   - Monitor database size
   - Set appropriate token expiry times

2. **Client Storage**:
   - Consider using sessionStorage for sensitive data
   - Implement storage quota monitoring
   - Clear storage on logout

3. **Network Requests**:
   - Batch permission checks
   - Cache user data appropriately
   - Use HTTP client for consistent headers

## Security Best Practices

1. **Token Management**:
   - Use long, random secrets
   - Rotate secrets regularly
   - Monitor for token abuse

2. **Session Security**:
   - Set appropriate timeout values
   - Monitor for suspicious activity
   - Implement device restrictions

3. **Data Protection**:
   - Use HTTPS in production
   - Encrypt sensitive data
   - Follow GDPR guidelines

4. **Error Handling**:
   - Don't expose sensitive errors
   - Log security events
   - Monitor failed attempts

## API Reference

See the individual component files for detailed API documentation:
- `/lib/auth/tokens.ts` - Token management functions
- `/lib/auth/client.ts` - Client-side utilities
- `/hooks/useAuth.ts` - Authentication hook
- `/lib/auth/context.tsx` - React context and components