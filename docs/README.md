# BRF Portal

## 🏢 Intelligent Digital Platform for Swedish Housing Cooperatives

BRF Portal is an AI-driven SaaS platform revolutionizing how Swedish housing cooperatives (bostadsrättsföreningar) manage their operations. Built for the 30,750+ BRFs in Sweden, we deliver enterprise-grade functionality at a fraction of traditional costs.

## 💡 Core Value Proposition

**"80% of the value at 20% of the cost"** - Compared to traditional property managers (SBC/HSB), we offer comprehensive digital management starting at 999 SEK/month.

## 🚀 Key Features

### STANDARD Features - Document Collection (500-1500 kr/month)

- **"Bomb Us With Everything"**: Upload 5000+ documents, AI organizes
- **"NEW" Button**: Create procurement needs, collect quotes
- **Invoice Collection**: Store all invoices, AI categorizes
- **Document Export**: Send everything to your accountant
- **Member Portal**: Full digital services for members
- **Case Management**: Track all property issues
- **Booking System**: Laundry, common areas
- **BRF Social**: Community feed
- **Mobile Apps**: iOS/Android
- ❌ **NO Bookkeeping** (keep your existing accountant)

### PREMIUM Features - Complete Financial Management (1500-3000 kr/month)

Everything in STANDARD PLUS:

- **Complete Bookkeeping**: K2/K3 compliant
- **Payment Processing**: Invoice to payment automation
- **Fee Invoicing**: OCR, direct debit, e-invoices
- **Bank Reconciliation**: Automatic matching
- **VAT Management**: Quarterly reports
- **Annual Reports**: Bolagsverket compliant
- **Tax Declarations**: Skatteverket integration
- **Fortnox/Visma Sync**: Two-way integration
- **Collection Process**: Automated reminders
- **Audit Trail**: Legal compliance (Bokföringslagen)
- ✅ **Replaces HSB/SBC** completely

### Who Should Choose What?

**Choose STANDARD if you**:

- Have HSB/SBC/external accountant
- Want better document organization
- Need procurement management
- Keep existing financial management

**Choose PREMIUM if you**:

- Want to replace HSB/SBC
- Need complete financial management
- Want to save 3000+ kr/month
- Need legal compliance built-in

## 🛠 Technical Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js API + Python microservices for AI
- **Database**: PostgreSQL with row-level security
- **AI/ML**: OpenAI GPT-4, AWS Textract, Custom TensorFlow models
- **Infrastructure**: Vercel/Railway, AWS Lambda, Redis
- **Integrations**: BankID, Fortnox, Kivra, Swedish banks

## 📦 Packages

### BRF STANDARD (999-1999 SEK/month)

- AI document management
- Member portal & mobile apps
- Smart booking system
- Board collaboration tools
- Digital AGM support

### BRF PREMIUM (1999-3999 SEK/month)

- Everything in Standard PLUS:
- Complete financial management
- Automatic invoice processing
- Bank integrations
- Collection management
- Dedicated success manager

## 🏗 Project Structure

```
brf-portal/
├── src/
│   ├── app/              # Next.js app router
│   ├── components/       # Reusable React components
│   ├── lib/              # Shared utilities
│   │   └── supabase.ts   # Supabase client
│   └── features/         # Feature modules
├── supabase/
│   ├── migrations/       # Database migrations
│   ├── functions/        # Edge Functions (Python AI services)
│   └── seed.sql         # Seed data
├── docs/                 # Project documentation
└── tests/                # Test suites
```

## 🚦 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Python 3.11+ (for AI services)
- Docker & Docker Compose

### Local Development

```bash
# Clone repository
git clone https://github.com/yourusername/brf-portal.git
cd brf-portal

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Start PostgreSQL and Redis with Docker
docker-compose up -d

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Visit http://localhost:3000 to see the application.

## 🔐 Security & Compliance

- **GDPR Compliant**: Full data protection from day one
- **Swedish Data Residency**: All data stored within Sweden
- **BankID Authentication**: Industry-standard Swedish eID
- **End-to-End Encryption**: All sensitive data encrypted
- **Regular Security Audits**: Quarterly penetration testing

## 📈 Market Opportunity

- **Target Market**: 30,750 active BRFs in Sweden
- **Initial Focus**: 20-60 apartment cooperatives
- **Market Potential**: 4 billion SEK annually
- **Current Traction**: Pilot programs with 5 BRFs

## 🗺 Development Roadmap

### Phase 1: MVP (Months 1-2) ✅

- Core document management
- Basic member portal
- BankID authentication
- Pilot with first BRF

### Phase 2: Core Features (Months 3-4) 🚧

- Fortnox integration
- AI document classification
- Mobile apps (React Native)
- Scale to 10 BRFs

### Phase 3: Advanced Features (Months 5-6) 📋

- Complete financial management
- Predictive maintenance AI
- White-label partnerships
- Scale to 50+ BRFs

## 🤝 Contributing

While this is primarily a commercial product, we welcome contributions to our open-source components. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Proprietary software. All rights reserved. See [LICENSE](LICENSE) for details.

## 🔗 Links

- [Product Website](https://brfportal.se)
- [API Documentation](https://api.brfportal.se/docs)
- [Support Portal](https://support.brfportal.se)

## 💰 Documented Savings

### Energy Optimization Results from Pilot BRFs:

- **BRF Eken (45 apts)**: Saved 31,000 kr/year on electricity (28% reduction)
- **BRF Björken (62 apts)**: Saved 24,500 kr/year on electricity (22% reduction)
- **BRF Strandvägen**: Saved 67,000 kr/year on heating (11% reduction)
- **BRF Parkgatan**: Saved 45,000 kr/year on heating (8% reduction)

**Average savings: 8-30% on total energy costs**
