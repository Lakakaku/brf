# BRF Portal - Service Costs & Usage Limits Documentation

## 1. Service Cost Structure

### 1.1 Variable Costs per BRF (Monthly)

#### STANDARD Tier - Per BRF Costs

| Service                     | Monthly Cost           | Usage Basis                             |
| --------------------------- | ---------------------- | --------------------------------------- |
| **AI Services**             |                        |                                         |
| - GPT-4o-mini               | 15 SEK                 | ~2M tokens for chatbot & classification |
| - AWS Textract (OCR)        | 3 SEK                  | ~200 pages/month @ $1.50/1000 pages     |
| **Authentication**          |                        |                                         |
| - BankID (Criipto/Signicat) | 115 SEK                | 100 auth @ 1.15 SEK each                |
| **Communication**           |                        |                                         |
| - SMS (46elks)              | 7 SEK                  | ~20 emergency SMS @ 0.35 SEK each       |
| - Email (SendGrid)          | 2 SEK                  | Basic email sends                       |
| **Infrastructure**          |                        |                                         |
| - Supabase (Database)       | 5 SEK                  | Free tier / shared when scaled          |
| - Storage (Supabase/S3)     | 5 SEK                  | ~10GB document storage                  |
| - Vercel Hosting            | 3 SEK                  | Pro tier distributed                    |
| **TOTAL COST**              | **150 SEK/month**      |                                         |
| **Revenue**                 | **999-1299 SEK/month** |                                         |
| **Gross Margin**            | **85-88%**             |                                         |

#### PREMIUM Tier - Per BRF Costs

| Service                      | Monthly Cost            | Usage Basis                       |
| ---------------------------- | ----------------------- | --------------------------------- |
| **AI Services**              |                         |                                   |
| - GPT-4o + GPT-4o-mini       | 40 SEK                  | Advanced analysis + chatbot       |
| - AWS Textract (OCR)         | 10 SEK                  | ~700 pages/month                  |
| - Google Cloud Doc AI        | 5 SEK                   | Backup OCR when needed            |
| **Authentication & Signing** |                         |                                   |
| - BankID (Criipto/Signicat)  | 115 SEK                 | Unlimited authentications         |
| - Scrive E-signing           | 35 SEK                  | Platform fee + 10 signatures      |
| **Accounting Integrations**  |                         |                                   |
| - Fortnox OR Visma           | 200 SEK                 | Full API integration (one chosen) |
| **Swedish Services**         |                         |                                   |
| - Kivra Digital Mailbox      | 30 SEK                  | ~60 documents @ 0.50 SEK each     |
| - UC Credit Checks           | 90 SEK                  | ~2 checks @ 45 SEK each           |
| **Payment Processing**       |                         |                                   |
| - Bankgirot/Plusgirot        | 15 SEK                  | Distributed base fee              |
| - Swish Business             | 10 SEK                  | Base + transaction fees           |
| **Energy Services**          |                         |                                   |
| - Eliq/Sally R API           | 15 SEK                  | When activated (distributed)      |
| **Communication**            |                         |                                   |
| - SMS (46elks)               | 15 SEK                  | Higher usage volume               |
| - Email (SendGrid)           | 5 SEK                   | Extended email sends              |
| **Infrastructure**           |                         |                                   |
| - Supabase Pro               | 15 SEK                  | Priority database allocation      |
| - Storage (Supabase/S3)      | 15 SEK                  | ~30GB document storage            |
| - Vercel Pro                 | 5 SEK                   | Priority hosting                  |
| **Government APIs**          |                         |                                   |
| - Bolagsverket               | 5 SEK                   | Company/annual report data        |
| - Skatteverket               | 0 SEK                   | Free API for tax filing           |
| **TOTAL COST**               | **620 SEK/month**       |                                   |
| **Revenue**                  | **1999-3999 SEK/month** |                                   |
| **Gross Margin**             | **69-84%**              |                                   |

### 1.2 Fixed Platform Costs (Monthly)

| Service                      | Total Platform Cost | When Activated         |
| ---------------------------- | ------------------- | ---------------------- |
| **Authentication**           |                     |                        |
| Criipto (BankID)             | 560 SEK (€49)       | From day 1             |
| Signicat (alternative)       | 700 SEK             | If Criipto unavailable |
| **Document Signing**         |                     |                        |
| Scrive                       | 2,160 SEK (€189)    | When 10+ PREMIUM BRFs  |
| **Energy Optimization**      |                     |                        |
| Eliq API                     | 1,500 SEK           | When 50+ BRFs          |
| Sally R (alternative)        | 1,500 SEK           | Regional preference    |
| **Payment Infrastructure**   |                     |                        |
| Bankgirot                    | 500 SEK             | For fee collection     |
| Plusgirot                    | 400 SEK             | Alternative/addition   |
| Swish Business               | 100 SEK             | Mobile payments        |
| **Hosting & Infrastructure** |                     |                        |
| Vercel Pro                   | 200 SEK ($20)       | From 10+ BRFs          |
| Supabase Pro                 | 250 SEK ($25)       | From 20+ BRFs          |
| Railway/Render               | 190 SEK ($19)       | Backup/scaling         |

## 2. Usage Limits by Subscription Tier

### 2.1 Document Processing Limits

| Feature                           | STANDARD                | PREMIUM               | Overage Handling         |
| --------------------------------- | ----------------------- | --------------------- | ------------------------ |
| Initial "Bomb Us With Everything" | Unlimited first 30 days | Unlimited always      | Not applicable           |
| After 30 days                     | 500 documents/month     | 2,000 documents/month | Queued for next period   |
| OCR Processing (Textract)         | 200 pages/month         | 1,000 pages/month     | 0.015 SEK/page           |
| AI Classification                 | 100 docs/month          | 500 docs/month        | Falls back to rule-based |
| Document Search                   | 100 searches/month      | Unlimited             | Cached results only      |
| Bulk Export                       | 10 exports/month        | Unlimited             | Wait for next period     |
| SIE File Import                   | Manual only             | Automated daily       | Not applicable           |

### 2.2 AI Assistant Limits

| Feature                    | STANDARD                   | PREMIUM                    | Limit Behavior             |
| -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| Member Chatbot             | 10 queries/apartment/month | 30 queries/apartment/month | Returns cached FAQ answers |
| Board AI Assistant         | 20 queries/month           | 100 queries/month          | Switches to GPT-4o-mini    |
| 50-Year Maintenance Plan   | 1 generation/year          | 4 generations/year         | Manual request required    |
| Energy Analysis            | 4 reports/year             | 12 reports/year            | Uses previous month's data |
| Financial Forecasting      | Not included               | 12 analyses/year           | Shows static projections   |
| Contractor Matching        | View list only             | 50 AI matches/month        | Shows basic directory      |
| Invoice Intelligence       | Not included               | 200 AI reads/month         | Rule-based extraction      |
| "NEW" Button (Procurement) | Basic templates            | 50 AI analyses/month       | Manual process after       |

### 2.3 Communication Limits

| Feature              | STANDARD                 | PREMIUM          | Overage Cost          |
| -------------------- | ------------------------ | ---------------- | --------------------- |
| BankID Logins        | 100/month total          | Unlimited        | 1.15 SEK each after   |
| SMS Notifications    | Emergency only (5/month) | 50/month         | 0.35 SEK per SMS      |
| Email Sends          | 500/month                | 2,000/month      | 0.02 SEK per email    |
| Kivra Documents      | Not included             | 100/month        | 0.50 SEK per document |
| Push Notifications   | Unlimited                | Unlimited        | No charge             |
| In-App Chat Messages | 100/day per user         | 200/day per user | Hard limit            |

### 2.4 Financial Service Limits

| Feature                   | STANDARD           | PREMIUM            | Additional Info     |
| ------------------------- | ------------------ | ------------------ | ------------------- |
| Fortnox/Visma Integration | Not included       | Every 6 hours sync | Real-time available |
| Invoice Processing        | Manual upload only | 200 AI/month       | Then rule-based     |
| Payment Files (Bankgiro)  | Not included       | Unlimited          | Included            |
| Plusgirot Files           | Not included       | Unlimited          | Included            |
| Swish Payments            | Not included       | 50/month           | 0.50 SEK per extra  |
| UC Credit Checks          | Not included       | 5/month            | 45 SEK each after   |
| Bank Reconciliation       | Not included       | Daily automatic    | Core feature        |
| Fee Invoicing with OCR    | Basic (no OCR)     | Full with OCR      | Included            |
| Autogiro (Direct Debit)   | Not included       | Unlimited          | Setup included      |
| Collection Process        | Not included       | Automated          | Included            |

### 2.5 Signing & Legal Limits

| Feature                   | STANDARD                  | PREMIUM            | Overage Handling     |
| ------------------------- | ------------------------- | ------------------ | -------------------- |
| Scrive E-signatures       | Not included              | 10/month           | 12 SEK per signature |
| BankID Signatures         | 5/month                   | 50/month           | 12 SEK per signature |
| AGM Digital Voting        | 1 meeting/year            | 4 meetings/year    | 200 SEK per meeting  |
| Board Meeting Signatures  | Digital verification only | Unlimited BankID   | Included             |
| Document Templates        | 50 templates              | All 200+ templates | Not applicable       |
| Legal Document Generation | Manual only               | 50/month           | Template only after  |

### 2.6 Swedish Authority Integrations

| Feature                 | STANDARD      | PREMIUM                  | Notes               |
| ----------------------- | ------------- | ------------------------ | ------------------- |
| Bolagsverket Data       | Manual lookup | API access               | For verification    |
| Annual Report Filing    | Manual export | Digital submission ready | XBRL format         |
| Tax Declaration (INK2)  | Manual        | SRU file generation      | Skatteverket ready  |
| Control Statements (KU) | Not included  | Automated                | All KU types        |
| Property Tax Filing     | Not included  | Automated                | With calculations   |
| SCB Reporting           | Manual forms  | API submission           | Statistical reports |

### 2.7 Energy & Sustainability

| Feature                 | STANDARD       | PREMIUM         | Implementation     |
| ----------------------- | -------------- | --------------- | ------------------ |
| Eliq/Sally R Comparison | Manual prices  | Auto-updated    | API when available |
| Consumption Analysis    | Upload bills   | Automatic       | Meter integration  |
| Optimization Reports    | Quarterly      | Monthly         | AI-generated       |
| Provider Switching Help | Templates only | Full assistance | Partner referrals  |
| Nord Pool Prices        | Not included   | Daily updates   | Free API           |
| SMHI Weather Data       | Not included   | Degree days     | Free API           |
| CO2 Tracking            | Manual entry   | Automated       | From consumption   |

### 2.8 Booking & Access Management

| Feature                | STANDARD         | PREMIUM          | Notes                |
| ---------------------- | ---------------- | ---------------- | -------------------- |
| Active Bookings        | 10 per apartment | 20 per apartment | Older auto-cancelled |
| Laundry Bookings       | 3 per week       | Unlimited        | Fair use applies     |
| Guest Apartment        | Manual approval  | Instant booking  | Board sets rules     |
| Common Areas           | Basic calendar   | Smart scheduling | AI optimization      |
| Digital Keys (Parakey) | Not included     | When integrated  | Per-key pricing      |

## 3. Integration-Specific Details

### 3.1 Accounting System Choice (PREMIUM only)

Choose ONE primary system:

- **Fortnox**: 200 SEK/month - Modern API, better for smaller BRFs
- **Visma eEkonomi**: 200 SEK/month - More features, enterprise-ready

### 3.2 BankID Provider Choice

Platform selects based on availability:

- **Primary**: Criipto - €0.10 per auth, better docs
- **Backup**: Signicat - Similar pricing, Norwegian company

### 3.3 Payment Processing Stack

Automatically included in PREMIUM:

- **Bankgirot**: For traditional fee collection
- **Plusgirot**: Alternative for some banks
- **Swish Business**: For instant payments
- **Klarna**: For one-time payments (if needed)

## 4. Rate Limiting Rules

### 4.1 API Rate Limits

#### Per BRF Limits

- Requests per second: 100 (burst to 200)
- Requests per minute: 1,000
- Requests per hour: 10,000
- Requests per day: 100,000

#### Per User Limits

- Requests per second: 10
- Requests per minute: 100
- Failed login attempts: 5 (then 15-min lockout)
- Password resets: 3 per day

### 4.2 AI Service Rate Limits

#### Document Processing

- Initial "bomb us": No limits for 30 days
- Concurrent processing: 10 documents
- Per hour after 30 days: 100 documents
- Maximum file size: 50MB per document
- Batch upload: Maximum 500 files at once

## 5. Critical Services Never Limited

The following are NEVER blocked regardless of limits:

### Safety & Security

- Emergency SMS notifications
- Security alerts
- Fire/water damage reporting
- Access system updates for safety

### Legal Compliance

- Annual report generation
- Tax filing preparation
- Authority reporting
- Audit trail access
- GDPR data requests

### Financial Critical

- Fee invoice generation
- Payment processing
- Bank reconciliation
- Accounting sync (Fortnox/Visma)

## 6. Development vs Production Costs

### Development Phase (Months 1-6) - ZERO EXTERNAL COSTS

Using FREE alternatives:

- SQLite instead of Supabase Pro
- Mock BankID instead of Criipto
- Local file storage instead of S3
- Rule-based "AI" instead of GPT-4
- Manual processes instead of APIs

### MVP Phase (Month 7) - MINIMAL COSTS

Only essential services:

- Criipto: €49/month
- Supabase free tier: 0 SEK
- Vercel free tier: 0 SEK
- **Total: ~560 SEK/month**

### Scale Phase (Months 8-12) - GRADUAL ADDITION

Add as customers require:

- Fortnox/Visma: +200 SEK per customer needing it
- Scrive: +2,160 SEK when 10+ customers
- Eliq: +1,500 SEK when 50+ customers

## 7. Fair Use Policy

### 7.1 Acceptable Use

✅ **Encouraged**:

- Upload ALL historical documents in first 30 days
- Use AI chatbot for all member questions
- Generate reports as needed
- Integrate with your existing systems
- Maximum utilization of included features

### 7.2 Abuse Prevention

❌ **Not Allowed**:

- Using one account for multiple BRFs
- Automated bot scraping
- Reselling API access
- Storing non-BRF content
- Circumventing rate limits

## 8. Cost Optimization Strategy

### For Small BRFs (<30 apartments)

- Start with STANDARD tier
- Use manual processes where possible
- Batch operations during off-peak
- Upgrade only when savings justify it

### For Medium BRFs (30-100 apartments)

- PREMIUM pays for itself vs traditional management
- Full automation maximizes value
- Use all included integrations

### For Large BRFs (>100 apartments)

- Custom pricing available
- Dedicated infrastructure possible
- White-label options

---

**Last Updated**: January 2025  
**Version**: 2.0 - Aligned with technical documentation  
**Note**: All prices in SEK unless specified. Platform intelligently selects cheapest/best provider when multiple options exist.
