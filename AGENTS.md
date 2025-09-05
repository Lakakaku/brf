# BRF Portal Specialized Agents

## How to Use These Agents

Use the Task tool with these agent names to complete specific parts of the BRF Portal project. Each agent has deep expertise in their domain and understands Swedish requirements.

## Core Development Agents

### 🏗️ infrastructure-architect

**Use for:** Docker setup, CI/CD pipelines, deployment configuration, zero-cost development strategies
**Example:** "Set up Docker Compose for local development with SQLite"

### 🗄️ database-architect

**Use for:** Database schema design, multi-tenancy, migrations, GDPR compliance
**Example:** "Design the complete database schema for BRF multi-tenant architecture"

### 🎨 nextjs-developer

**Use for:** Frontend development, React components, UI implementation
**Example:** "Create the document upload interface with drag-and-drop"

### 🔌 api-developer

**Use for:** REST API development, backend services, webhook implementations
**Example:** "Build the API endpoints for member authentication"

### 📱 mobile-developer

**Use for:** React Native apps, iOS/Android features, mobile-specific functionality
**Example:** "Create the laundry booking mobile interface"

## Swedish Compliance & Domain Experts

### ⚖️ swedish-law-expert

**Use for:** Legal compliance, Bostadsrättslagen, GDPR, Swedish regulations
**Example:** "Ensure the annual meeting (årsstämma) module complies with Swedish law"

### 🏢 brf-operations-expert

**Use for:** BRF-specific features, monthly fees, maintenance planning, queues
**Example:** "Implement the apartment queue (kösystem) management"

### 💰 swedish-financial-expert

**Use for:** K2/K3 accounting, VAT handling, Skatteverket, Swedish banking
**Example:** "Implement K2-compliant bookkeeping with Swedish VAT handling"

## Integration Specialists

### 📊 fortnox-integration-specialist

**Use for:** Fortnox/Visma integration, SIE files, accounting synchronization
**Example:** "Create mock Fortnox integration with proper data mapping"

### 🤖 ai-document-processor

**Use for:** OCR, document classification, invoice extraction, Swedish NLP
**Example:** "Build invoice data extraction for Swedish suppliers"

### ⚡ energy-optimization-expert

**Use for:** Energy tracking, consumption analysis, predictive maintenance
**Example:** "Implement district heating (fjärrvärme) consumption tracking"

### 🛒 procurement-specialist

**Use for:** RFQ processes, contractor management, procurement workflows
**Example:** "Build the 'NEW button' procurement initiation feature"

## Quality & Security

### 🧪 qa-engineer

**Use for:** Testing strategies, test automation, E2E testing, test data
**Example:** "Write comprehensive tests for multi-tenant data isolation"

### 🔐 security-engineer

**Use for:** Authentication, security features, GDPR implementation, auditing
**Example:** "Implement secure session management with audit logging"

## Support Agents

### 📋 project-coordinator

**Use for:** Task management, dependency coordination, progress tracking
**Example:** "Review TASKS.md and coordinate Phase 1 implementation"

### 📝 technical-writer

**Use for:** Documentation, API docs, user guides, Swedish translations
**Example:** "Create Swedish user guide for board members"

## Quick Agent Selection Guide

| Task Type          | Recommended Agent          |
| ------------------ | -------------------------- |
| Database setup     | database-architect         |
| Frontend UI        | nextjs-developer           |
| Swedish compliance | swedish-law-expert         |
| BRF features       | brf-operations-expert      |
| Accounting         | swedish-financial-expert   |
| Document AI        | ai-document-processor      |
| Testing            | qa-engineer                |
| Security           | security-engineer          |
| Mobile apps        | mobile-developer           |
| API development    | api-developer              |
| Energy features    | energy-optimization-expert |
| Procurement        | procurement-specialist     |

## Parallel Work Strategy

These agent groups can work simultaneously:

**Group A - Foundation**

- infrastructure-architect (Docker, CI/CD)
- database-architect (Schema design)
- security-engineer (Auth system)

**Group B - Core Features**

- nextjs-developer (UI components)
- api-developer (Backend APIs)
- mobile-developer (Mobile apps)

**Group C - Swedish Features**

- swedish-law-expert (Compliance)
- brf-operations-expert (BRF workflows)
- swedish-financial-expert (Accounting)

**Group D - Advanced Features**

- ai-document-processor (Document AI)
- energy-optimization-expert (Energy tracking)
- procurement-specialist (Contractor management)

## Example Commands

```bash
# Start database design
Use Task tool with database-architect: "Design complete multi-tenant database schema following docs/DATABASE_SCHEMA.md"

# Build frontend
Use Task tool with nextjs-developer: "Initialize Next.js 14 project with TypeScript and Tailwind"

# Implement Swedish compliance
Use Task tool with swedish-law-expert: "Review and ensure GDPR compliance for member data handling"

# Create document processing
Use Task tool with ai-document-processor: "Build invoice OCR and data extraction for Swedish invoices"
```

## Important Notes

1. **Zero-Cost First**: All agents follow the "build free, deploy when profitable" philosophy
2. **Swedish Context**: All agents understand Swedish BRF requirements and terminology
3. **Mock First**: Agents create mock implementations before paid integrations
4. **Compliance**: Legal and financial agents ensure Swedish law compliance
5. **Parallel Work**: Use multiple agents simultaneously for independent tasks
