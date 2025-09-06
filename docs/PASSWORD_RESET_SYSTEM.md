# Password Reset System - BRF Portal

## Overview

The BRF Portal password reset system provides a secure, user-friendly way for members to reset their passwords with comprehensive security measures and Swedish localization. This system follows security best practices and includes rate limiting, comprehensive audit logging, and email notifications.

## Architecture

### Components

1. **API Endpoints**
   - `POST /api/auth/forgot-password` - Initiate password reset
   - `POST /api/auth/reset-password` - Complete password reset
   - `GET|POST /api/auth/verify-reset-token` - Verify reset token

2. **Frontend Components**
   - `ForgotPasswordForm` - Request password reset
   - `ResetPasswordForm` - Complete password reset
   - Responsive pages with Swedish localization

3. **Backend Services**
   - Token management with secure hashing
   - Email service with Swedish templates
   - Rate limiting and security logging
   - Database integration with SQLite

4. **Security Features**
   - Cryptographically secure tokens (32 bytes)
   - SHA-256 token hashing for storage
   - Rate limiting (3 requests per hour per email, 10 per IP)
   - Comprehensive audit logging
   - Single-use tokens with 1-hour expiry

## Database Schema

### Password Reset Tokens Table

```sql
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  cooperative_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  is_used INTEGER DEFAULT 0,
  used_at TEXT,
  request_ip TEXT,
  request_user_agent TEXT,
  reset_ip TEXT,
  reset_user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Password Reset Attempts Table

```sql
CREATE TABLE password_reset_attempts (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  cooperative_id TEXT NOT NULL,
  email TEXT NOT NULL,
  request_ip TEXT NOT NULL,
  user_agent TEXT,
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  blocked_until TEXT,
  status TEXT DEFAULT 'pending',
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## API Endpoints

### POST /api/auth/forgot-password

**Purpose**: Initiate password reset process

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Reset email sent if account exists"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Too many requests",
  "rateLimitExceeded": true,
  "retryAfter": 3600
}
```

**Rate Limits**:
- 3 requests per hour per email
- 10 requests per hour per IP address
- Automatic blocking for excessive failed attempts

### POST /api/auth/reset-password

**Purpose**: Complete password reset using token

**Request Body**:
```json
{
  "token": "reset_token_here",
  "newPassword": "new_secure_password",
  "confirmPassword": "new_secure_password"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password reset successful",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    // ... other user fields
  }
}
```

### GET|POST /api/auth/verify-reset-token

**Purpose**: Verify reset token validity

**Request**:
```json
{
  "token": "reset_token_here"
}
```

**Response**:
```json
{
  "success": true,
  "valid": true,
  "email": "user@example.com"
}
```

## Security Features

### Token Security

- **Generation**: Uses `crypto.randomBytes(32)` for cryptographically secure tokens
- **Storage**: Tokens are hashed with SHA-256 before database storage
- **Expiry**: All tokens expire after 1 hour
- **Single-use**: Tokens are invalidated after successful use
- **Cleanup**: Expired tokens are automatically cleaned up

### Rate Limiting

- **Per Email**: Maximum 3 requests per hour per email address
- **Per IP**: Maximum 10 requests per hour per IP address
- **Progressive Blocking**: Failed attempts result in increasing block durations
- **Automatic Unblocking**: Blocks automatically expire

### Audit Logging

All password reset activities are logged with:
- User identification (email, user ID)
- Request context (IP address, user agent)
- Action details (request, verification, completion, failures)
- Security events with severity levels
- Comprehensive audit trail for compliance

## Email System

### Swedish Email Templates

#### Password Reset Request Email
- **Subject**: "Återställ ditt lösenord - [BRF Name]"
- **Content**: Swedish instructions with security warnings
- **Format**: Responsive HTML with plain text fallback
- **Features**: BRF branding, clear CTA, security instructions

#### Password Reset Confirmation Email
- **Subject**: "Lösenord återställt - [BRF Name]"
- **Content**: Confirmation with security details
- **Format**: Responsive HTML with plain text fallback
- **Features**: Success confirmation, security timeline

### Email Features

- **Mock Service**: Development email service with logging
- **Production Ready**: Structured for integration with real email providers
- **Responsive Design**: Mobile-friendly email templates
- **Security Context**: IP address and timestamp tracking
- **Failure Handling**: Graceful degradation if email fails

## Frontend Components

### ForgotPasswordForm

- **Purpose**: Collect user email for password reset
- **Features**: 
  - Email validation with Swedish error messages
  - Success state with instructions
  - Rate limit handling with retry information
  - Support contact information
  - Responsive design

### ResetPasswordForm

- **Purpose**: Complete password reset with new password
- **Features**:
  - Token verification on load
  - Real-time password strength validation
  - Password visibility toggle
  - Success/error state handling
  - Security information display

## Pages

### /forgot-password

- **Layout**: Split-screen design with branding
- **Content**: Step-by-step process explanation
- **Features**: Security information, responsive design
- **Accessibility**: ARIA labels, keyboard navigation

### /reset-password/[token]

- **Layout**: Split-screen with security focus
- **Content**: Password requirements and security info
- **Features**: Token validation, error handling
- **Accessibility**: Form validation, screen reader support

## Security Best Practices

### Token Management

1. **Secure Generation**: Cryptographically random tokens
2. **Secure Storage**: Hashed tokens in database
3. **Limited Lifetime**: 1-hour expiry
4. **Single Use**: Tokens invalidated after use
5. **Cleanup**: Automatic expired token removal

### Rate Limiting

1. **Multiple Levels**: Per email and per IP limits
2. **Progressive Delays**: Increasing block durations
3. **Automatic Recovery**: Blocks expire automatically
4. **Logging**: All rate limit events logged

### Session Security

1. **Session Invalidation**: All sessions terminated on password reset
2. **Immediate Effect**: New password required for access
3. **Security Logging**: Password change events tracked
4. **User Notification**: Confirmation emails sent

## Error Handling

### User-Friendly Messages

All error messages are provided in Swedish with clear instructions:

- **Rate Limiting**: Clear retry time information
- **Invalid Tokens**: Helpful guidance for expired/used tokens
- **Password Validation**: Specific requirements and feedback
- **Network Errors**: Retry instructions and support contacts

### Error Categories

1. **Validation Errors**: Input format and requirements
2. **Security Errors**: Rate limits and token issues
3. **System Errors**: Network and server issues
4. **User Errors**: Account status and permissions

## Monitoring and Analytics

### Security Events

- **Event Types**: Request, verify, reset, failed attempts
- **Severity Levels**: Low, medium, high, critical
- **Data Points**: IP, user agent, success/failure, timing
- **Retention**: 90 days for regular events, 1 year for critical

### Statistics Tracking

- **Active Tokens**: Currently valid reset tokens
- **Usage Patterns**: Daily/weekly reset statistics
- **Security Metrics**: Failed attempts, blocked IPs
- **Success Rates**: Completion rates and timing

## Integration Points

### Existing Systems

- **Authentication**: Integrates with JWT token system
- **User Management**: Uses existing member database
- **Audit System**: Leverages existing audit logging
- **Email System**: Extensible for production email services

### External Services

- **Email Providers**: Ready for SendGrid, Mailgun, AWS SES
- **Monitoring**: Structured for Sentry, DataDog integration
- **Analytics**: Event tracking for usage analysis

## Configuration

### Environment Variables

```bash
# Database
DATABASE_PATH=./database/brf.db

# JWT
JWT_SECRET=your_jwt_secret_here

# Email
EMAIL_FROM_ADDRESS=noreply@brfportal.se
EMAIL_FROM_NAME=BRF Portal
SUPPORT_EMAIL=support@brfportal.se

# Application
NEXTAUTH_URL=https://your-domain.com
BRF_NAME=Din BRF
```

### Security Settings

- **Token Expiry**: 1 hour (configurable in code)
- **Rate Limits**: 3/hour per email, 10/hour per IP
- **Password Requirements**: 8+ chars, letters + numbers
- **Session Management**: All sessions revoked on reset

## Deployment Considerations

### Database

- **Indexes**: Optimized for token lookups and rate limiting
- **Cleanup Jobs**: Automatic expired token removal
- **Backup**: Include reset tokens in backup strategy
- **Migration**: Schema updates handled automatically

### Monitoring

- **Log Monitoring**: Track security events and failures
- **Performance**: Monitor API response times
- **Usage Patterns**: Track reset request patterns
- **Security Alerts**: Monitor for suspicious activity

### Scaling

- **Rate Limiting**: Consider Redis for distributed rate limiting
- **Email Queue**: Implement queue for high-volume environments
- **Database**: Monitor token table growth
- **Cleanup**: Ensure regular cleanup job execution

## Maintenance

### Regular Tasks

1. **Token Cleanup**: Remove expired tokens (automated)
2. **Log Rotation**: Archive old security logs
3. **Monitoring Review**: Check security metrics weekly
4. **Rate Limit Review**: Adjust limits based on usage

### Security Reviews

1. **Monthly**: Review security logs for patterns
2. **Quarterly**: Update password requirements if needed
3. **Annually**: Security audit of entire flow
4. **As Needed**: Respond to security incidents

## Support and Troubleshooting

### Common Issues

1. **Email Not Received**: Check spam folders, verify email address
2. **Token Expired**: Request new reset, check email timing
3. **Rate Limited**: Wait for retry period, contact support if needed
4. **Password Rejected**: Review requirements, try different password

### Support Procedures

1. **Verify User Identity**: Confirm member status
2. **Check Audit Logs**: Review reset attempts
3. **Manual Reset**: Admin override if necessary
4. **Security Investigation**: Check for suspicious activity

This password reset system provides comprehensive security while maintaining user-friendliness, with full Swedish localization for the BRF context.