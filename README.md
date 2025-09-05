# BRF Portal 🏢

Modern management platform for Swedish housing cooperatives (Bostadsrättsförening), built with Next.js 14, TypeScript, and Tailwind CSS.

## ✨ Features

- **Member Management** - Complete resident and board member administration
- **Financial Oversight** - Fees, budgets, and financial reporting
- **Document Management** - Protocols, decisions, and file organization
- **Maintenance Tracking** - Work orders, inspections, and vendor management
- **Meeting Management** - Annual meetings, board meetings, and voting
- **Communication Hub** - Announcements, newsletters, and resident messaging

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm (comes with Node.js)
- Docker & Docker Compose (optional)

### Development Setup

```bash
# Clone and install dependencies
git clone <repository-url>
cd brf-portal
npm install

# Setup environment variables
cp .env.example .env.local
npm run env:setup:dev

# Initialize database
npm run db:init

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server

# Code Quality
npm run lint            # Run ESLint
npm run format          # Format with Prettier
npm run format:check    # Check formatting

# Testing
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage

# Database
npm run db:init         # Initialize database
npm run db:status       # Check database status
npm run db:migrate      # Run migrations
npm run db:seed         # Seed test data
npm run db:reset        # Reset database

# Environment
npm run env:validate    # Validate environment variables
npm run env:setup       # Setup environment files
```

### Code Quality Standards

- **TypeScript Strict Mode** - Full type safety
- **ESLint + Prettier** - Consistent code formatting
- **Jest + React Testing Library** - Comprehensive testing
- **Conventional Commits** - Standardized commit messages

### Architecture

- **Frontend**: Next.js 14 with App Router
- **UI Components**: Radix UI + Tailwind CSS
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: NextAuth.js with BankID integration
- **State Management**: React Server Components + useState/useReducer
- **Styling**: Tailwind CSS with custom design system

## 📁 Project Structure

```
brf-portal/
├── app/                    # Next.js app directory
├── components/             # React components
├── lib/                   # Utilities and configurations
├── database/              # Database files and migrations
├── docs/                  # Documentation
│   ├── api/              # API documentation
│   ├── development/      # Development guides
│   └── guides/           # User and deployment guides
├── hooks/                 # Custom React hooks
├── scripts/              # Database and utility scripts
├── __tests__/            # Test files
└── .github/workflows/    # CI/CD pipelines
```

## 🔧 Configuration

### Environment Variables

Key variables for development:

```env
NODE_ENV=development
DATABASE_URL=file:./database/brf_portal.db
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key
```

See `.env.example` for complete configuration options.

### Swedish Integrations

- **BankID** - Secure authentication system
- **Swish** - Mobile payment integration
- **Fortnox/Visma** - Accounting system integration
- **46elks** - SMS services
- **SMHI** - Weather data for energy optimization

## 🧪 Testing

```bash
# Run all tests
npm run test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

Tests are written using Jest and React Testing Library with focus on:

- Component behavior
- API route functionality
- Database operations
- Business logic validation

## 🚀 Deployment

### Docker Production

```bash
# Build and deploy
docker-compose -f docker-compose.yml up -d

# With PostgreSQL
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Environment-Specific Deployment

```bash
# Staging
npm run env:setup:staging
npm run build

# Production
npm run env:setup:prod
npm run build
npm run start
```

## 🔒 Security

- **Data Protection** - GDPR compliant with Swedish data residency
- **Authentication** - BankID integration for resident verification
- **Authorization** - Role-based access control (resident, board, admin)
- **Encryption** - All sensitive data encrypted at rest and in transit
- **Audit Trail** - Complete logging of financial and administrative actions

## 📖 Documentation

- [Architecture Guide](./docs/development/ARCHITECTURE.md)
- [API Documentation](./docs/api/API_SPEC.md)
- [Database Schema](./docs/development/DATABASE_SCHEMA.md)
- [Deployment Guide](./docs/guides/DEPLOYMENT.md)
- [Contributing Guide](./docs/development/CONTRIBUTING.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

See [CONTRIBUTING.md](./docs/development/CONTRIBUTING.md) for detailed guidelines.

## 📊 Project Status

✅ **Core Setup Complete**

- Next.js 14 with TypeScript
- Tailwind CSS + Radix UI components
- SQLite database with migration system
- Testing framework (Jest + RTL)
- Docker development environment
- CI/CD pipeline with GitHub Actions

🚧 **In Development**

- Authentication system
- Core BRF management features
- Swedish integration APIs
- Member portal interface

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🇸🇪 Swedish Housing Cooperative Context

This platform is specifically designed for Swedish Bostadsrättsförening (BRF) requirements including:

- **Legal Compliance** - Swedish housing cooperative law adherence
- **Financial Standards** - Swedish accounting and reporting standards
- **Integration Ready** - Built for Swedish banking, payment, and ID systems
- **Localization** - Swedish language support and cultural considerations
- **Scalability** - Designed to handle cooperatives from 10 to 1000+ units

---

Built with ❤️ for Swedish housing cooperatives
