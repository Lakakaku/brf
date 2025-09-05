# BRF Portal - Environment Variables Quick Start

🇸🇪 **Swedish Housing Cooperative Management Platform**

## 🚀 Quick Start (Zero Cost Development)

Get up and running in under 2 minutes with zero external costs:

```bash
# 1. Set up development environment (automatic)
npm run env:setup:dev

# 2. Initialize database
npm run db:init

# 3. Start development server
npm run dev

# 4. Visit http://localhost:3000
```

**That's it!** You now have a fully functional development environment with:

- ✅ SQLite database (no setup required)
- ✅ All external services mocked (zero API costs)
- ✅ Complete UI and business logic testable
- ✅ Swedish BRF-specific features ready

## 📁 Environment Files Structure

```
├── .env.example              # Complete reference (commit to git)
├── .env.development          # Development defaults (commit to git)
├── .env.staging             # Staging defaults (commit to git)
├── .env.production.example  # Production template (commit to git)
├── .env.local              # Your local overrides (DO NOT commit)
└── .env.production         # Production secrets (DO NOT commit)
```

## 🔧 Environment Setup Commands

```bash
# Interactive development setup
npm run env:setup

# Quick development setup (non-interactive)
npm run env:setup:dev

# Staging environment setup
npm run env:setup:staging

# Production template creation
npm run env:setup:prod

# Validate current environment
npm run env:validate
```

## 💰 Cost-Optimized Development

### Phase 0: Development (0 SEK/month)

**Perfect for building the entire application:**

```bash
# All services mocked - zero external costs
MOCK_BANKID=true          # No BankID costs
MOCK_EMAIL=true           # No email service costs
MOCK_SMS=true             # No SMS costs
MOCK_PAYMENT=true         # No payment processing costs
MOCK_EXTERNAL_APIS=true   # No AI/API costs
```

**What works without spending money:**

- ✅ Complete UI development
- ✅ All business logic
- ✅ Document management system
- ✅ Member portal functionality
- ✅ Case management
- ✅ Financial calculations
- ✅ Booking system
- ✅ AI chatbot (rule-based responses)

### Phase 1: Selective Testing (when needed)

Add real API keys only for specific features you want to test:

```bash
# Test real AI features (pay per use)
OPENAI_API_KEY=sk-your-key
MOCK_EXTERNAL_APIS=false

# Test real email sending
SENDGRID_API_KEY=your-key
MOCK_EMAIL=false
```

## 🇸🇪 Swedish Integrations

### BankID Authentication

```bash
# Development (free testing)
BANKID_ENVIRONMENT=test
BANKID_ENABLED=true

# Production (€49/month + per use)
BANKID_ENVIRONMENT=production
BANKID_CLIENT_CERT_PATH=/path/to/cert.p12
```

### Accounting Systems

```bash
# Fortnox integration
FORTNOX_API_URL=https://api.fortnox.se/3
FORTNOX_CLIENT_SECRET=your-secret

# Visma eEkonomi integration
VISMA_API_URL=https://eaccountingapi.vismaonline.com/v2
VISMA_CLIENT_ID=your-client-id
```

### Digital Services

```bash
# Kivra digital mailbox
KIVRA_API_URL=https://api.kivra.com/v1
KIVRA_API_KEY=your-api-key

# Swedish payment systems
SWISH_API_URL=https://mss.cpc.getswish.net
BANKGIROT_API_URL=https://api.bankgirot.se
```

## 🔒 Security Best Practices

### Development

- ✅ Pre-generated safe secrets
- ✅ Local-only configuration
- ✅ No sensitive data committed

### Production

```bash
# Use secrets management
NEXTAUTH_SECRET=FROM_SECRETS_MANAGER
ENCRYPTION_KEY=FROM_SECRETS_MANAGER
JWT_SIGNING_KEY=FROM_SECRETS_MANAGER

# Strong password requirements
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_SYMBOLS=true
```

### Validation

```bash
# Check environment configuration
npm run env:validate

# Validates:
# ✅ Required secrets present
# ✅ Swedish integration setup
# ✅ Security configuration
# ✅ Cost optimization
# ✅ Service dependencies
```

## 🚨 Common Issues & Solutions

### Issue: "Environment validation failed"

```bash
# Run validation to see specific issues
npm run env:validate

# Common fixes:
# 1. Missing required secrets in production
# 2. Invalid API key format
# 3. Conflicting mock/real service settings
```

### Issue: "BankID certificate error"

```bash
# Verify certificate format
openssl pkcs12 -info -in your-cert.p12 -noout

# Check certificate expiry
openssl pkcs12 -in your-cert.p12 -noout -dates
```

### Issue: "Database connection failed"

```bash
# Check database URL format
# SQLite: file:./database/brf_portal.db
# PostgreSQL: postgresql://user:pass@host:5432/db

# Initialize database
npm run db:init
```

## 🎯 Feature Flags

Control which features are enabled:

```bash
# Core features
FEATURE_BANKID_AUTH=false      # Swedish BankID login
FEATURE_AI_PROCESSING=false    # Document AI analysis
FEATURE_PAYMENT_PROCESSING=false # Real payment processing
FEATURE_EMAIL_NOTIFICATIONS=true # Email sending
FEATURE_SMS_NOTIFICATIONS=false  # SMS sending

# Premium features
FEATURE_ENERGY_OPTIMIZATION=false # Energy cost analysis
FEATURE_ADVANCED_ANALYTICS=false  # Advanced reporting
FEATURE_API_ACCESS=false          # External API access
```

## 📊 Environment Examples

### Development (.env.local)

```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=file:./database/brf_portal_dev.db
MOCK_BANKID=true
MOCK_EMAIL=true
DEBUG=true
```

### Staging (.env.staging)

```bash
NODE_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.brfportal.se
DATABASE_URL=postgresql://staging:pass@db:5432/brf_staging
BANKID_ENVIRONMENT=test
MOCK_PAYMENT=true
```

### Production (.env.production)

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://brfportal.se
DATABASE_URL=postgresql://prod:FROM_SECRETS_MANAGER@db:5432/brf_prod
BANKID_ENVIRONMENT=production
BANKID_ENABLED=true
MOCK_BANKID=false
```

## 📚 Additional Resources

- **Complete Setup Guide**: [docs/ENVIRONMENT_SETUP.md](./docs/ENVIRONMENT_SETUP.md)
- **Architecture Overview**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Swedish Integrations**: [docs/SPEC.md](./docs/SPEC.md)
- **API Reference**: [docs/API_SPEC.md](./docs/API_SPEC.md)

## 🆘 Getting Help

1. **Validation Issues**: Run `npm run env:validate` for detailed diagnostics
2. **Setup Problems**: Use `npm run env:setup` for interactive guidance
3. **Swedish Integrations**: Check service provider documentation
4. **BankID Issues**: Verify certificate configuration and environment

---

**Built for Swedish Housing Cooperatives** 🏠🇸🇪

_Zero-cost development phase enables complete application building before spending money on external services._
