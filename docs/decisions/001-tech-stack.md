# ADR-001: Technology Stack Selection

**Date**: January 2025  
**Status**: Accepted  
**Deciders**: Solo Developer/Founder  
**Tags**: #architecture #foundation #critical

## Context

Building a SaaS platform for Swedish housing cooperatives requires balancing several critical factors:

- Solo developer constraints (learning curve, maintenance burden)
- Swedish market requirements (BankID, Fortnox, regulatory compliance)
- Multi-tenant architecture needs
- AI/ML integration requirements
- Budget constraints during bootstrapping phase
- Need for rapid MVP development while maintaining production quality

The platform must handle:

- 10,000+ cooperatives at scale
- Financial data with audit requirements
- Document processing with AI
- Real-time features for member communication
- Mobile apps for iOS/Android

## Decision

We will adopt the following technology stack:

### Frontend

- **Next.js 14** with App Router for web application
- **React Native** with Expo for mobile apps
- **TypeScript** for type safety across the stack
- **Tailwind CSS** for styling
- **tRPC** for type-safe API communication

### Backend

- **Supabase** as primary backend platform (PostgreSQL + Auth + Storage + Edge Functions)
- **Python FastAPI** for AI/ML microservices (via Supabase Edge Functions)
- **PostgreSQL 15+** as primary database (via Supabase)
- **Redis** for caching and queues (external service when needed)

### Infrastructure

- **Vercel** for frontend hosting
- **Supabase** for backend services (database, auth, storage, edge functions)
- **AWS Textract** for OCR processing
- **OpenAI API** for language processing

## Rationale

### Why Node.js over Python for main backend?

**Pros of Node.js**:

- Single language across frontend/backend reduces context switching
- Excellent for high-concurrency, I/O-heavy operations
- Perfect match with Next.js and tRPC for full-stack TypeScript
- Huge ecosystem for SaaS requirements (Stripe, SendGrid, etc.)
- Better real-time capabilities with WebSockets/SSE

**Cons considered**:

- Python has better AI/ML libraries (mitigated by microservices)
- Less mature financial libraries (solved with decimal.js)

### Why Supabase over self-hosted PostgreSQL?

**Pros of Supabase**:

- **Complete backend solution**: Database + Auth + Storage + Edge Functions in one
- **Row-level security (RLS)**: Built-in multi-tenancy for BRF data isolation
- **BankID integration**: Custom auth providers supported
- **Real-time subscriptions**: Perfect for member communication features
- **Generous free tier**: 500MB database + 1GB storage during development
- **TypeScript-first**: Auto-generated types from database schema
- **Edge Functions**: Python/Deno serverless for AI processing
- **Instant APIs**: Auto-generated REST and GraphQL APIs
- **Swedish data residency**: EU hosting available

**PostgreSQL benefits retained**:

- ACID compliance critical for financial data
- Complex relationships between members, apartments, finances
- JSONB gives document flexibility when needed
- Superior query capabilities for reporting

**Cons considered**:

- Vendor lock-in risk (mitigated by standard PostgreSQL underneath)
- Less control than self-hosted (acceptable for rapid development)

### Why Next.js over separate React SPA?

**Pros of Next.js**:

- SEO benefits for marketing pages
- Server-side rendering improves initial load
- Built-in API routes reduce complexity
- Excellent developer experience
- Vercel deployment incredibly simple
- App Router provides modern patterns

**Cons considered**:

- Vendor lock-in risk (mitigated by self-hosting option)
- Learning curve for App Router (worth the investment)

### Why tRPC over REST or GraphQL?

**Pros of tRPC**:

- End-to-end type safety without code generation
- No schema duplication
- Simpler than GraphQL for solo developer
- Perfect integration with Next.js
- Smaller bundle size than GraphQL clients

**Cons considered**:

- Less ecosystem than REST (acceptable for internal API)
- TypeScript-only (we're already committed to TS)

### Why React Native over Flutter or native?

**Pros of React Native**:

- Reuse React knowledge and components
- Single codebase for iOS/Android
- Expo simplifies deployment and OTA updates
- Large ecosystem of packages
- Good performance for our use case

**Cons considered**:

- Flutter has better performance (not critical for our app)
- Native would be more performant (too much overhead for solo dev)

## Consequences

### Positive

- **Rapid development**: Full-stack TypeScript with shared types
- **Maintainability**: Single language reduces cognitive load
- **Scalability**: PostgreSQL and Node.js scale to millions of users
- **Swedish market fit**: Easy integration with BankID, Fortnox
- **Cost-effective**: Most tools have generous free tiers
- **Hiring**: JavaScript/TypeScript developers abundant

### Negative

- **Learning curve**: App Router, tRPC, and Supabase Edge Functions are relatively new
- **Vendor dependencies**: Reliance on Vercel, Supabase, OpenAI
- **Python split**: Maintaining two languages for AI services (mitigated by Edge Functions)
- **Mobile limitations**: React Native constraints for complex features

### Risks

- **OpenAI dependency**: Need fallback LLM options
- **Supabase lock-in**: Mitigated by standard PostgreSQL underneath + data export
- **Vercel lock-in**: Mitigated by Next.js self-hosting capability
- **Supabase scaling**: Plan for Pro tier upgrade and read replicas
- **TypeScript complexity**: Can over-engineer types

## Alternatives Considered

### Alternative 1: Python/Django Full Stack

- Pros: Better AI integration, mature framework
- Cons: Worse real-time, separate frontend needed
- Rejected: Node.js better for our real-time needs

### Alternative 2: Ruby on Rails

- Pros: Rapid development, convention over configuration
- Cons: Declining ecosystem, poor AI support
- Rejected: Not suitable for AI-heavy application

### Alternative 3: Go Microservices

- Pros: Excellent performance, simple deployment
- Cons: Verbose, longer development time
- Rejected: Too complex for solo developer

### Alternative 4: Self-Hosted PostgreSQL + Custom Backend

- Pros: Full control, no vendor lock-in
- Cons: Complex setup, maintenance burden, slower development
- Rejected: Too much infrastructure overhead for solo developer

### Alternative 5: Low-Code Platform

- Pros: Very rapid MVP
- Cons: Limited customization, severe vendor lock-in
- Rejected: Cannot meet our specific BRF requirements

## Implementation Plan

1. **Week 1**: Set up Supabase project and schema
2. **Week 2**: Configure RLS policies and auth
3. **Week 3**: Integrate Supabase with Next.js
4. **Week 4**: Document upload to Supabase Storage
5. **Month 2**: Edge Functions for AI processing
6. **Month 3**: React Native app with Supabase client

## Review Schedule

- **3 months**: Evaluate development velocity
- **6 months**: Assess performance at scale
- **12 months**: Consider optimizations or changes

---

_Decision made by: Solo Developer_  
_Review date: April 2025_
