# BRF Portal Authentication System

A complete authentication system for the Swedish Housing Cooperative (BRF) Portal, built with Next.js 14, TypeScript, and modern security practices.

## Features

- **Dual Authentication Strategy**: Support for both session-based and JWT-based authentication
- **Password Security**: Secure password hashing with bcrypt and strength validation
- **Role-Based Access Control**: Swedish BRF-specific roles (member, board, chairman, treasurer, admin)
- **Permission System**: Fine-grained permissions for different BRF operations
- **Rate Limiting**: Built-in protection against brute force attacks
- **CSRF Protection**: Session-based CSRF token validation
- **Audit Logging**: Comprehensive logging of authentication events
- **Swedish Context**: Localized error messages and BRF-specific validation

## Architecture

```
lib/auth/
├── types.ts           # TypeScript definitions and interfaces
├── crypto.ts          # Password hashing and security utilities
├── jwt.ts             # JWT token generation and validation
├── session.ts         # Session management with iron-session
├── middleware.ts      # Authentication middleware for API routes
├── index.ts           # Main entry point with convenience exports
└── README.md          # This documentation
```

## Quick Start

### 1. Environment Configuration

Create the following environment variables:

```bash
# Required
SESSION_SECRET="your-32-character-minimum-secret-key-here"
JWT_SECRET="your-jwt-secret-key-here"
DATABASE_PATH="./database/brf.db"

# Optional
JWT_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="7d"
SESSION_COOKIE_NAME="brf-portal-session"
SESSION_MAX_AGE="86400"
ENABLE_REGISTRATION="true"
NODE_ENV="development"
```

### 2. Basic Usage

```typescript
import { authenticate, requireBoard, AuthPatterns } from '@/lib/auth';

// Protect API route (any authenticated user)
export const GET = authenticate()(async (req, res) => {
  // req.user is available here
  return NextResponse.json({ user: req.user });
});

// Require board member or higher
export const POST = requireBoard(async (req, res) => {
  // Only board members, chairmen, treasurers, or admins can access
  return NextResponse.json({ success: true });
});

// Use predefined patterns
export const PUT = AuthPatterns.financial()(async (req, res) => {
  // Only users with financial permissions can access
  return NextResponse.json({ success: true });
});
```

### 3. Client Authentication

```typescript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@brf.se',
    password: 'securepassword',
    rememberMe: true
  })
});

// Logout
await fetch('/api/auth/logout', { method: 'POST' });

// Register (if enabled)
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'newuser@brf.se',
    password: 'securepassword',
    confirmPassword: 'securepassword',
    firstName: 'Anna',
    lastName: 'Andersson',
    cooperativeId: 'coop-123',
    phone: '+46701234567'
  })
});
```

## Authentication Strategies

### Session-Based Authentication
- Uses encrypted cookies via iron-session
- Server-side session storage
- Automatic CSRF protection
- Best for web applications

### JWT-Based Authentication
- Stateless token authentication
- Suitable for APIs and mobile apps
- Token blacklisting for security
- Configurable expiration times

### Hybrid Approach
- Supports both strategies simultaneously
- Automatic fallback mechanisms
- Flexible deployment options

## Role System

The system implements Swedish BRF-specific roles:

- **Member** (`member`): Basic cooperative member
- **Board Member** (`board`): Board member with extended permissions
- **Chairman** (`chairman`): Board chairman with leadership permissions
- **Treasurer** (`treasurer`): Financial management permissions
- **Administrator** (`admin`): Full system access

## Permission System

Fine-grained permissions for BRF operations:

```typescript
interface BRFPermissions {
  // Document management
  canViewDocuments: boolean;
  canUploadDocuments: boolean;
  canApproveDocuments: boolean;
  
  // Financial management
  canViewInvoices: boolean;
  canApproveInvoices: boolean;
  canCreateInvoices: boolean;
  
  // Member management
  canViewMembers: boolean;
  canManageMembers: boolean;
  
  // And more...
}
```

## Security Features

### Password Security
- Minimum 8 characters with complexity requirements
- Bcrypt hashing with salt rounds (default: 12)
- Password strength validation
- Protection against common weak passwords

### Rate Limiting
- Automatic rate limiting for login attempts
- IP and email-based tracking
- Configurable lockout periods
- Protection against brute force attacks

### Token Security
- JWT with configurable expiration
- Token blacklisting for logout
- Secure token generation and validation
- Protection against token reuse

### Session Security
- Encrypted session cookies
- CSRF token protection
- Secure cookie configuration
- Session timeout management

## API Routes

### POST /api/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@brf.se",
  "password": "securepassword",
  "rememberMe": false,
  "cooperativeId": "optional-coop-id"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "email": "user@brf.se",
    "firstName": "Anna",
    "lastName": "Andersson",
    "role": "member",
    "cooperativeId": "coop-123",
    "isActive": true,
    "permissions": {...},
    "lastLoginAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Login successful"
}
```

### POST /api/auth/logout
Logout current user.

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### GET /api/auth/logout
Check current session status.

**Response:**
```json
{
  "isLoggedIn": true,
  "user": {...},
  "loginTimestamp": 1640995200000,
  "csrfToken": "csrf-token-here"
}
```

### POST /api/auth/register
Register new user (if enabled).

**Request:**
```json
{
  "email": "newuser@brf.se",
  "password": "securepassword",
  "confirmPassword": "securepassword",
  "firstName": "Anna",
  "lastName": "Andersson",
  "cooperativeId": "coop-123",
  "phone": "+46701234567"
}
```

## Middleware Patterns

### Basic Authentication
```typescript
import { authenticate } from '@/lib/auth';

export const GET = authenticate()(handler);
```

### Role-Based Access
```typescript
import { requireBoard, requireAdmin } from '@/lib/auth';

export const POST = requireBoard(handler);
export const DELETE = requireAdmin(handler);
```

### Permission-Based Access
```typescript
import { requirePermissions } from '@/lib/auth';

export const PUT = requirePermissions('canApproveInvoices')(handler);
```

### Custom Authentication
```typescript
import { authenticate } from '@/lib/auth';

export const PATCH = authenticate({
  roles: ['chairman', 'admin'],
  permissions: ['canManageMembers'],
  requireCSRF: true,
  strategy: 'session'
})(handler);
```

### Cooperative Isolation
```typescript
import { requireCooperativeAccess } from '@/lib/auth';

export const GET = requireCooperativeAccess(handler);
```

## Error Handling

The system provides comprehensive error handling with Swedish localization:

```typescript
import { AuthError, AuthErrorType, AuthErrorHandlers } from '@/lib/auth';

try {
  // Authentication operation
} catch (error) {
  if (AuthErrorHandlers.isAuthError(error)) {
    const friendlyMessage = AuthErrorHandlers.getUserFriendlyMessage(error);
    // Display friendly message to user
  }
}
```

### Common Error Codes

- `INVALID_CREDENTIALS`: Wrong email or password
- `USER_NOT_FOUND`: User doesn't exist
- `USER_INACTIVE`: Account is deactivated
- `TOKEN_EXPIRED`: JWT token has expired
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `RATE_LIMITED`: Too many login attempts

## Testing

The system includes comprehensive testing utilities:

```typescript
import { AuthTestUtils } from '@/lib/auth';

// Create mock user
const mockUser = AuthTestUtils.createMockUser({
  role: 'chairman',
  cooperativeId: 'test-coop'
});

// Create mock authenticated request
const mockRequest = AuthTestUtils.createMockAuthRequest(mockUser);

// Bypass authentication for testing
const testHandler = AuthTestUtils.createBypassMiddleware()(originalHandler);
```

## Production Considerations

### Environment Variables
- Use strong, unique secrets (minimum 32 characters)
- Enable secure cookies in production
- Configure appropriate session timeouts
- Disable registration in production (use invitation system)

### Database Security
- Ensure database connection is encrypted
- Use connection pooling for performance
- Implement proper backup strategies
- Monitor for suspicious activities

### Monitoring and Logging
- Enable audit logging for all authentication events
- Monitor failed login attempts
- Set up alerts for security events
- Regularly review access patterns

### Performance Optimization
- Use Redis for session storage in production
- Implement proper token caching
- Optimize database queries
- Consider CDN for static assets

## Development

### Adding New Roles
1. Update `MemberRole` type in `types.ts`
2. Add default permissions in `DEFAULT_PERMISSIONS`
3. Update middleware role checks
4. Test with new role scenarios

### Adding New Permissions
1. Update `BRFPermissions` interface
2. Add to appropriate default role permissions
3. Create convenience middleware functions
4. Update documentation

### Extending Authentication
1. Follow existing patterns in middleware
2. Add comprehensive error handling
3. Include audit logging
4. Write tests for new functionality

## Troubleshooting

### Common Issues

**Session not persisting:**
- Check `SESSION_SECRET` is set and long enough
- Verify cookie settings for your environment
- Ensure HTTPS in production

**JWT token issues:**
- Verify `JWT_SECRET` is configured
- Check token expiration settings
- Ensure proper token extraction from headers

**Permission denied errors:**
- Verify user has correct role
- Check permission assignments
- Review cooperative isolation settings

**Database connection errors:**
- Verify `DATABASE_PATH` is correct
- Ensure database file has proper permissions
- Check database schema is up to date

### Debug Mode
Set `NODE_ENV=development` for additional debugging information and relaxed security settings.

## Contributing

When contributing to the authentication system:

1. Follow existing code patterns and conventions
2. Add comprehensive TypeScript types
3. Include error handling and logging
4. Write tests for new functionality
5. Update documentation
6. Consider Swedish BRF context and localization

## License

This authentication system is part of the BRF Portal project and follows the project's licensing terms.