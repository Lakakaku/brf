# ADR-003: Swedish Market Integration Strategy

**Date**: January 2025  
**Status**: Accepted  
**Deciders**: Solo Developer/Founder  
**Tags**: #integrations #swedish-market #authentication #critical

## Context

The BRF Portal must integrate with Swedish-specific services that are essential for market acceptance. Swedish users have strong expectations about:

- **BankID**: De facto standard for digital authentication (7+ million users)
- **Kivra**: Digital mailbox used by 5+ million Swedes
- **Fortnox/Visma**: Accounting software used by 500,000+ Swedish businesses
- **Swedish banks**: Specific formats and protocols (Bankgirot, Plusgirot, Swish)

Legal requirements:

- GDPR with Swedish interpretation
- Swedish Bookkeeping Act (Bokföringslagen)
- Housing Cooperative Act (Bostadsrättslagen)
- Annual report requirements to Bolagsverket

Market expectations:

- BankID is non-negotiable for trust
- Swedish language as primary
- Local payment methods (Swish, autogiro)
- Integration with existing Swedish services

## Decision

We will **build complete mock integrations first**, then add real services only when paying customers require them:

### Phase 0: Zero-Cost Development (Months 1-6) - Build Everything as Mocks

**Complete mock implementations of all Swedish services**:

```javascript
// Mock BankID that looks and feels real
mockBankID.authenticate(); // Returns test user
mockFortnox.syncInvoice(); // Logs what would sync
mockKivra.sendDocument(); // Shows what would be sent
mockBank.generatePaymentFile(); // Creates valid format file
mockEnergyOptimization.compare(); // Uses hardcoded prices
```

**What you can build for free**:

- ✅ Complete BankID flow UI (mock backend)
- ✅ Full Fortnox data structure and mapping
- ✅ OCR number generation (real algorithm)
- ✅ Payment file generation (correct formats)
- ✅ Invoice parsing logic
- ✅ Swedish address validation
- ✅ Personal number validation
- ✅ Energy comparison with manual price updates

### Phase 1: First Customer Requirements (Month 7+)

**Add only what customer specifically needs**:

- Customer needs BankID? → Add Criipto (€49/month)
- Customer uses Fortnox? → Add API integration (200 SEK/month)
- Customer wants Kivra? → Enable Kivra API
- Basic energy optimization → Manual process (no API cost)

### Phase 2: Scale with Revenue (Month 10+, >50k revenue/month)

**Add premium services when profitable**:

- Sally R/Eliq API → ~1,500 SEK/month
- Direct BankID → When volume justifies setup cost
- Multiple bank integrations → As customers need them
- Grid company APIs → When manual becomes bottleneck

## Implementation Strategy

```javascript
// services/integrations/bankid.js
class BankIDService {
  constructor() {
    this.useReal = process.env.USE_REAL_BANKID === 'true';
  }

  async authenticate(personalNumber) {
    if (this.useReal && this.hasCredentials()) {
      return this.realBankID(personalNumber);
    }
    return this.mockBankID(personalNumber);
  }

  mockBankID(personalNumber) {
    // Complete mock that works locally
    return {
      success: true,
      user: {
        personalNumber,
        name: 'Test Testsson',
        verified: true,
      },
    };
  }
}
```

## Cost Analysis - Maximizing Zero-Cost Development

### What costs 0 kr to build:

- Complete application UI/UX
- All business logic and calculations
- Mock integrations that look real
- Database with full schema
- Document management (local)
- Test suite with full coverage

### What costs money (only when needed):

- BankID verification: €49/month + €0.10/auth
- Fortnox API: 200 SEK/month
- Kivra delivery: ~0.50 SEK/document
- SMS notifications: ~0.25 SEK/SMS

**Key Insight**: You can demo the complete platform and onboard your first customers using only mocks, then add real integrations one by one as customers pay.

## Rationale

### Why Criipto for BankID initially?

**Pros of Criipto**:

- **Fast setup**: Days vs months for direct integration
- **Proven solution**: Used by 1000+ companies
- **Multi-country**: Also supports Norwegian/Danish BankID
- **Support**: English documentation and support
- **Compliance**: Handles regulatory requirements

**Cons considered**:

- **Cost**: €0.10 per authentication (acceptable for MVP)
- **Dependency**: Third-party service (mitigated by SLA)
- **Branding**: Less control over login flow (acceptable)

**Direct BankID** requires:

- Bank relationship
- Security audit (50,000+ SEK)
- 2-3 month approval process
- Swedish company registration
- Complex certificate management

### Why Fortnox over Visma initially?

**Pros of Fortnox**:

- **Modern API**: RESTful with good documentation
- **Market share**: 30% of Swedish SMBs
- **Developer friendly**: Sandbox environment
- **Pricing**: Affordable API access
- **Integration time**: 1-2 weeks

**Visma considerations**:

- Older API structure
- More complex authentication
- Better for enterprises (not our initial market)
- Will add in Phase 3

### Why Kivra for digital documents?

**Pros of Kivra**:

- **Reach**: 5.5 million users
- **Official**: Used by government agencies
- **Cost effective**: Pay per document sent
- **API quality**: Modern REST API
- **User trust**: Established brand

**Alternatives considered**:

- Email: Less professional, delivery issues
- Min Myndighetspost: Government only
- Physical mail: Too expensive

## Implementation Details

### BankID Integration (via Criipto)

```javascript
// Configuration
const bankIdConfig = {
  provider: 'criipto',
  clientId: process.env.CRIIPTO_CLIENT_ID,
  clientSecret: process.env.CRIIPTO_CLIENT_SECRET,
  redirectUri: 'https://app.brfportal.se/auth/callback',
  scope: ['openid', 'ssn', 'name', 'email']
};

// Authentication flow
1. User clicks "Logga in med BankID"
2. Redirect to Criipto
3. User authenticates with mobile BankID
4. Callback with user data
5. Create/update user in database
6. Issue JWT token
```

### Fortnox Integration

```javascript
// Key endpoints we'll use
const fortnoxEndpoints = {
  vouchers: '/3/vouchers',        // Bokföringsverifikationer
  invoices: '/3/invoices',        // Leverantörsfakturor
  accounts: '/3/accounts',        // Kontoplan
  sie: '/3/sie/4',               // SIE4 export
  financialYear: '/3/financialyears'
};

// Sync strategy
- Daily: Pull new invoices
- Real-time: Push approved invoices
- Monthly: Full reconciliation
- Yearly: SIE4 export for annual report
```

### Kivra Document Delivery

```javascript
// Document sending flow
const sendToKivra = async (document, recipient) => {
  // 1. Check if recipient has Kivra
  const hasKivra = await kivra.checkRecipient(recipient.ssn);

  // 2. Send via Kivra or fallback
  if (hasKivra) {
    return kivra.send({
      ssn: recipient.ssn,
      subject: document.title,
      content: document.pdf,
      sender: 'BRF Portal',
    });
  } else {
    return sendViaEmail(document, recipient);
  }
};
```

### Swedish Bank Integrations

```javascript
// Payment file formats
const paymentFormats = {
  bankgiro: {
    format: 'BGMAX',
    encoding: 'ISO-8859-1',
    structure: 'fixed-width',
  },
  plusgiro: {
    format: 'PGMAX',
    encoding: 'ISO-8859-1',
  },
  iso20022: {
    format: 'XML',
    standard: 'pain.001.001.03',
  },
};

// OCR number generation (Luhn algorithm)
const generateOCR = (coopId, aptNum, year, month) => {
  const base = `${coopId}${aptNum}${year}${month}`;
  const checkDigit = calculateLuhn(base);
  return `${base}${checkDigit}`;
};
```

## Consequences

### Positive

- **Market fit**: Meet Swedish user expectations
- **Trust**: BankID provides immediate credibility
- **Efficiency**: Automated accounting sync saves hours
- **Compliance**: Meet regulatory requirements
- **Network effect**: Integrate with services users already use

### Negative

- **Complexity**: Many integrations to maintain
- **Cost**: Integration fees add up (€200+/month)
- **Dependency**: Reliance on third-party services
- **Swedish-only**: Harder to expand internationally

### Risks

- **Service outage**: BankID/Kivra downtime affects login
  - Mitigation: Fallback authentication method
- **API changes**: Breaking changes in integrations
  - Mitigation: Version pinning, monitoring
- **Regulatory**: BankID requirements change
  - Mitigation: Stay informed, use Criipto's compliance

## Cost Analysis

### Monthly Costs (at 100 BRFs)

```
Criipto: €49 + ~€500 (5000 auths)
Kivra: ~500 SEK (1000 documents)
Fortnox API: 200 SEK
Bank services: 500 SEK
Total: ~€600/month (~7000 SEK)
```

### Cost per BRF

- At 100 BRFs: 70 SEK/month
- At 1000 BRFs: 20 SEK/month
- Acceptable given pricing of 999+ SEK/month

## Alternatives Considered

### Alternative 1: Build Everything In-House

- Pros: Full control, no dependencies
- Cons: Years of development, compliance nightmare
- Rejected: Impossible for solo developer

### Alternative 2: Generic International Solution

- Pros: Easier to build, scales globally
- Cons: No Swedish market fit
- Rejected: Would fail in Swedish market

### Alternative 3: Partner with Existing Provider

- Pros: Instant integrations
- Cons: Lose control, margins
- Rejected: Want to own the platform

## Migration Strategy

### From Mock to Production

1. **Development**: Mock services return test data
2. **Staging**: Connect to sandbox environments
3. **Pilot**: Real integrations with test cooperatives
4. **Production**: Full integrations with monitoring

### Fallback Strategy

Each integration needs fallback:

- **BankID fails**: Email/password login
- **Kivra fails**: Email delivery
- **Fortnox fails**: Manual export/import
- **Bank fails**: Manual payment files

## Compliance Checklist

- [ ] GDPR: Data processing agreements with all providers
- [ ] BankID: Follow security requirements
- [ ] Financial: Maintain audit trail
- [ ] Bookkeeping: SIE4 export capability
- [ ] Annual reports: Bolagsverket format support

## Monitoring

- **Uptime**: Monitor all integration endpoints
- **Performance**: Track API response times
- **Errors**: Alert on integration failures
- **Usage**: Track API calls vs limits
- **Costs**: Monitor per-transaction costs

## Review Schedule

- **Monthly**: Review integration performance
- **Quarterly**: Evaluate new Swedish services
- **Yearly**: Renegotiate contracts

---

_Decision made by: Solo Developer_  
_Review date: March 2025_
