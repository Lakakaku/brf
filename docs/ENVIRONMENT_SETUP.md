# BRF Portal - Environment Variables Setup Guide

This guide provides comprehensive instructions for setting up environment variables for the BRF Portal, a Swedish housing cooperative management platform.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Files Overview](#environment-files-overview)
3. [Security Best Practices](#security-best-practices)
4. [Development Setup](#development-setup)
5. [Production Setup](#production-setup)
6. [Swedish Integration Setup](#swedish-integration-setup)
7. [Troubleshooting](#troubleshooting)
8. [Environment Variable Reference](#environment-variable-reference)

## Quick Start

### 1. Development Setup (Zero Cost)

For immediate local development:

```bash
# Copy the development environment file
cp .env.development .env.local

# Install dependencies
npm install

# Initialize the database
npm run db:init

# Start development server
npm run dev
```

The development environment is configured with:

- SQLite database (no setup required)
- Mock services for all external APIs
- Local file storage
- Relaxed security settings for development

### 2. Production-Ready Setup

```bash
# Copy and configure production environment
cp .env.production.example .env.production

# Edit the file and replace all FROM_SECRETS_MANAGER values
# with your actual production secrets
nano .env.production

# Deploy with your production environment
```

## Environment Files Overview

| File                      | Purpose                               | Commit to Git? |
| ------------------------- | ------------------------------------- | -------------- |
| `.env.example`            | Complete reference with all variables | ✅ Yes         |
| `.env.development`        | Safe development defaults             | ✅ Yes         |
| `.env.staging`            | Staging environment template          | ✅ Yes         |
| `.env.production.example` | Production template                   | ✅ Yes         |
| `.env.local`              | Your local overrides                  | ❌ No          |
| `.env.production`         | Actual production values              | ❌ No          |

## Security Best Practices

### 🔒 Critical Security Rules

1. **Never Commit Secrets**: Add `.env.local` and `.env.production` to `.gitignore`
2. **Use Secrets Management**: In production, use AWS Secrets Manager, Azure Key Vault, etc.
3. **Rotate Regularly**: Change all secrets quarterly minimum
4. **Strong Secrets**: Minimum 32 characters for encryption keys
5. **Environment Isolation**: Different secrets for dev/staging/production

### 🛡️ Secret Generation

Generate secure secrets:

```bash
# Generate 32-character secret
openssl rand -base64 32

# Generate UUID
uuidgen

# Generate hex key
openssl rand -hex 32
```

### 🔐 Production Secrets Management

**AWS Secrets Manager Example:**

```bash
# Store secret
aws secretsmanager create-secret \
  --name "brf-portal/nextauth-secret" \
  --description "NextAuth.js secret for BRF Portal" \
  --secret-string "your-generated-secret"

# Retrieve in application
aws secretsmanager get-secret-value \
  --secret-id "brf-portal/nextauth-secret" \
  --query SecretString --output text
```

## Development Setup

### Phase 0: Zero-Cost Development

Perfect for building the entire application without spending money:

```bash
# 1. Copy development environment
cp .env.development .env.local

# 2. Start development
npm run dev
```

**What works without any external services:**

- ✅ Complete UI and UX development
- ✅ All business logic implementation
- ✅ Database with SQLite (local file)
- ✅ Document upload and storage (local files)
- ✅ Mock authentication (no BankID needed)
- ✅ Mock AI processing (rule-based responses)
- ✅ Mock email/SMS services
- ✅ Mock payment processing

**What you can't test without API keys:**

- ❌ Real BankID authentication
- ❌ Real AI document processing
- ❌ Real email/SMS sending
- ❌ Real payment processing
- ❌ Real Swedish integrations (Fortnox, Kivra, etc.)

### Adding Real Services to Development

When you want to test specific integrations:

```bash
# Edit your .env.local file
nano .env.local
```

Add the API keys you want to test:

```bash
# Enable real AI processing
OPENAI_API_KEY=sk-your-development-key
FEATURE_AI_PROCESSING=true
MOCK_EXTERNAL_APIS=false

# Enable real email for testing
SENDGRID_API_KEY=your-sendgrid-key
MOCK_EMAIL=false
```

## Production Setup

### Prerequisites

Before setting up production:

1. **Domain and SSL**: Secure your domain (brfportal.se)
2. **Database**: PostgreSQL instance with SSL
3. **File Storage**: AWS S3 bucket in eu-north-1 (Stockholm)
4. **Secrets Manager**: AWS Secrets Manager or equivalent
5. **Monitoring**: Sentry account for error tracking
6. **Email Service**: SendGrid or Mailgun account
7. **BankID**: Production certificate from BankID

### Step-by-Step Production Setup

#### 1. Database Setup

```sql
-- Create production database
CREATE DATABASE brf_portal_prod;
CREATE USER brf_portal_prod WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE brf_portal_prod TO brf_portal_prod;

-- Enable required extensions
\c brf_portal_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

#### 2. AWS S3 Setup

```bash
# Create S3 bucket in Stockholm region
aws s3 mb s3://brf-portal-documents-prod --region eu-north-1

# Set appropriate permissions (restrict to your application)
aws s3api put-bucket-policy \
  --bucket brf-portal-documents-prod \
  --policy file://s3-bucket-policy.json
```

#### 3. Secrets Management

Store all production secrets securely:

```bash
# Store NextAuth secret
aws secretsmanager create-secret \
  --name "brf-portal/prod/nextauth-secret" \
  --secret-string "$(openssl rand -base64 32)"

# Store database password
aws secretsmanager create-secret \
  --name "brf-portal/prod/database-password" \
  --secret-string "your-secure-db-password"

# Store encryption key
aws secretsmanager create-secret \
  --name "brf-portal/prod/encryption-key" \
  --secret-string "$(openssl rand -base64 32)"
```

#### 4. Environment Configuration

```bash
# Copy production template
cp .env.production.example .env.production

# Edit with your values (use secrets manager references)
# Never put real secrets directly in the file!
```

## Swedish Integration Setup

### BankID Integration

**Development (Free):**

```bash
# Use BankID test environment
BANKID_ENABLED=false  # Keep disabled until you have certificates
BANKID_ENVIRONMENT=test
MOCK_BANKID=true
```

**Production (€49/month + per use):**

1. Apply for BankID integration at bankid.com
2. Receive test and production certificates
3. Configure certificate paths:

```bash
BANKID_ENABLED=true
BANKID_ENVIRONMENT=production
BANKID_CLIENT_CERT_PATH=/secure/certs/bankid-prod.p12
BANKID_CLIENT_CERT_PASSWORD=FROM_SECRETS_MANAGER
```

### Fortnox Integration

**Setup Steps:**

1. Create Fortnox developer account
2. Register your application
3. Obtain client credentials
4. Configure OAuth flow

```bash
FORTNOX_API_URL=https://api.fortnox.se/3
FORTNOX_CLIENT_SECRET=FROM_SECRETS_MANAGER
FORTNOX_ACCESS_TOKEN=FROM_SECRETS_MANAGER
```

### Kivra Digital Mailbox

```bash
KIVRA_API_URL=https://api.kivra.com/v1
KIVRA_API_KEY=FROM_SECRETS_MANAGER
KIVRA_SENDER_ID=your-registered-sender-id
```

### Swedish Payment Systems

**Swish:**

```bash
SWISH_API_URL=https://mss.cpc.getswish.net
SWISH_MERCHANT_ID=your-swish-merchant-id
SWISH_CLIENT_CERT_PATH=/secure/certs/swish-prod.p12
```

**Bankgirot:**

```bash
BANKGIROT_API_URL=https://api.bankgirot.se
BANKGIROT_CUSTOMER_ID=your-customer-id
BANKGIROT_API_KEY=FROM_SECRETS_MANAGER
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check database URL format
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# Test connection
psql "postgresql://user:pass@host:5432/dbname?sslmode=require"
```

#### 2. BankID Certificate Issues

```bash
# Verify certificate format
openssl pkcs12 -info -in bankid-cert.p12 -noout

# Check certificate expiry
openssl pkcs12 -in bankid-cert.p12 -noout -dates
```

#### 3. Environment Variable Not Loading

```bash
# Check .env files are in correct location
ls -la .env*

# Verify NODE_ENV matches environment file
echo $NODE_ENV

# Check for syntax errors in .env file
```

#### 4. API Key Validation Errors

```bash
# Test API key format
if [[ $OPENAI_API_KEY == sk-* ]]; then
  echo "OpenAI key format OK"
else
  echo "Invalid OpenAI key format"
fi
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=true
LOG_LEVEL=debug
DATABASE_LOG_QUERIES=true
PERFORMANCE_MONITORING_ENABLED=true
```

## Environment Variable Reference

### Categories

1. **Core Configuration**: NODE_ENV, APP_URL, DEBUG
2. **Database**: DATABASE_URL, connection pooling
3. **Authentication**: NextAuth, BankID, security keys
4. **External APIs**: OpenAI, Swedish services
5. **File Storage**: AWS S3, local storage
6. **Communication**: Email, SMS, push notifications
7. **Monitoring**: Sentry, logging, performance
8. **Security**: Encryption, CSRF, CORS
9. **Feature Flags**: Enable/disable features
10. **Swedish Integrations**: BankID, Fortnox, Kivra, etc.

### Validation

The system includes comprehensive validation:

```typescript
import { env, EnvUtils } from '@/lib/env';

// Type-safe access
console.log(env.NODE_ENV); // Fully typed

// Utility functions
if (EnvUtils.isProduction()) {
  // Production-only logic
}

if (EnvUtils.isBankIdEnabled()) {
  // Real BankID integration
}
```

### Feature Flags

Control feature rollout:

```bash
# Core features
FEATURE_BANKID_AUTH=true
FEATURE_AI_PROCESSING=true
FEATURE_PAYMENT_PROCESSING=true

# Premium features
FEATURE_ENERGY_OPTIMIZATION=false
FEATURE_ADVANCED_ANALYTICS=false
```

## Cost Management

### Development Phase (Months 1-6): $0/month

- SQLite database
- Local file storage
- Mock services
- No external API calls

### MVP Phase (Months 7-12): ~$50/month

- Supabase PostgreSQL (Free tier)
- Vercel hosting (Free tier)
- Basic email service
- Limited AI usage

### Production Phase: ~$200-500/month

- PostgreSQL hosting: $50-100
- AWS S3 + CloudFront: $20-50
- Email service: $20-50
- BankID: €49 (~500 SEK)
- AI processing: $50-200 (usage-based)
- Monitoring: $20-50

### Scale Phase: Variable

Costs scale with usage:

- Database: Scales with data
- AI: Scales with document processing
- BankID: Per authentication
- SMS: Per message
- Storage: Per GB

## Deployment Checklist

### Pre-Production Checklist

- [ ] All secrets stored in secrets manager
- [ ] SSL certificates configured
- [ ] Database backups enabled
- [ ] Monitoring and alerts configured
- [ ] Error tracking (Sentry) setup
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] GDPR compliance validated
- [ ] Swedish law compliance verified

### Production Deployment

- [ ] Environment variables validated
- [ ] Database migrations tested
- [ ] SSL/TLS configured
- [ ] CDN configured for static assets
- [ ] Backup and recovery tested
- [ ] Monitoring dashboards created
- [ ] Alert thresholds configured
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

## Support

### Getting Help

1. **Documentation**: Check this guide and code comments
2. **Validation Errors**: Run `npm run dev` and check console
3. **API Issues**: Check service status pages
4. **Swedish Integrations**: Contact service providers
5. **BankID Issues**: Check BankID developer documentation

### Useful Commands

```bash
# Validate environment
npm run env:validate

# Check database connection
npm run db:status

# Test email configuration
npm run test:email

# Verify API keys
npm run test:apis

# Health check
curl http://localhost:3000/api/health
```

---

**Security Reminder**: Always use secrets management in production and never commit sensitive values to version control. This setup prioritizes Swedish market requirements while maintaining flexibility for the zero-cost development phase.

For questions about Swedish BRF regulations or technical implementation, refer to the project documentation in the `/docs` folder.
