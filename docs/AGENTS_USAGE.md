# BRF Portal Agents - Usage Guide

The BRF Portal project now has **fully functional specialized agents** that can be invoked through Claude Code's Task tool.

## ✅ Agent System Status

**WORKING**: All 16 specialized agents are now functional and ready to use!

## Quick Start

### Method 1: Using the Helper Script
```bash
# List all available agents
./scripts/use-agent.sh

# Invoke a specific agent
./scripts/use-agent.sh database-architect "Review current schema"
./scripts/use-agent.sh nextjs-developer "Build user dashboard components" 
./scripts/use-agent.sh swedish-law-expert "Ensure GDPR compliance for member data"
```

### Method 2: Using the CLI Tool Directly
```bash
# List agents
npx tsx lib/agents/agent-cli.ts list

# Get agent info
npx tsx lib/agents/agent-cli.ts info database-architect

# Show categories
npx tsx lib/agents/agent-cli.ts categories

# Generate Task tool invocation
npx tsx lib/agents/agent-cli.ts invoke project-coordinator "Plan Phase 2 implementation"
```

### Method 3: Direct Task Tool Invocation
Copy the prompt from the CLI and use with Claude Code's Task tool:
```
subagent_type: general-purpose
description: [Agent Name]: [Task Description]
prompt: [Generated specialized prompt]
```

## Available Agents (16 Total)

### 🏗️ Infrastructure & DevOps
- **infrastructure-architect** - Docker, CI/CD, deployment strategies
- **database-architect** - Multi-tenant schema, GDPR, Swedish compliance

### ⚖️ Swedish Domain Experts
- **swedish-law-expert** - Bostadsrättslagen, GDPR, legal compliance
- **brf-operations-expert** - Monthly fees, queues, maintenance planning
- **swedish-financial-expert** - K2/K3 accounting, VAT, Skatteverket

### 🎨 Frontend Development
- **nextjs-developer** - Next.js 14, React, TypeScript, Tailwind CSS
- **mobile-developer** - React Native, iOS/Android, BankID mobile

### 🔌 Backend & Integrations
- **api-developer** - REST APIs, webhooks, Swedish service integrations
- **fortnox-integration-specialist** - Fortnox/Visma, SIE files, accounting sync

### 🤖 AI & Advanced Features
- **ai-document-processor** - OCR, document classification, Swedish NLP
- **energy-optimization-expert** - Energy tracking, district heating, optimization
- **procurement-specialist** - RFQ processes, contractor management

### 🔒 Quality & Security
- **qa-engineer** - Testing strategies, E2E tests, multi-tenant testing
- **security-engineer** - Authentication, GDPR, audit logging

### 📋 Support
- **project-coordinator** - Task management, dependency coordination
- **technical-writer** - Documentation, API docs, Swedish user guides

## Usage Examples

### Start Development Task
```bash
# Coordinate project priorities
./scripts/use-agent.sh project-coordinator "Review Phase 1 completion and plan Phase 2 document management"

# Set up development environment  
./scripts/use-agent.sh infrastructure-architect "Set up Docker Compose with SQLite for local development"

# Design database improvements
./scripts/use-agent.sh database-architect "Implement Row-Level Security policies for multi-tenant isolation"
```

### Build Features
```bash
# Create frontend components
./scripts/use-agent.sh nextjs-developer "Build member authentication pages with Swedish language support"

# Implement BRF workflows
./scripts/use-agent.sh brf-operations-expert "Create apartment queue management system"

# Add document processing
./scripts/use-agent.sh ai-document-processor "Build invoice OCR with Swedish supplier data extraction"
```

### Ensure Compliance
```bash
# Legal compliance review
./scripts/use-agent.sh swedish-law-expert "Validate annual meeting module against Bostadsrättslagen"

# Financial compliance
./scripts/use-agent.sh swedish-financial-expert "Implement K2-compliant bookkeeping with Swedish VAT"

# Security review
./scripts/use-agent.sh security-engineer "Audit authentication system for GDPR compliance"
```

## Agent Architecture

```
┌─────────────────────────────────────────────┐
│ Claude Code Task Tool                       │
│ (Built-in agent execution system)          │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│ BRF Agent Runtime System                    │
│ (/lib/agents/agent-runtime.ts)             │
│ - Loads agents-config.yaml                 │
│ - Generates specialized prompts             │
│ - Manages agent lifecycle                  │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│ Agent Configuration                         │
│ (agents-config.yaml)                       │
│ - 16 specialized agents                    │
│ - Swedish BRF domain expertise             │
│ - Tools and prompt definitions             │
└─────────────────────────────────────────────┘
```

## Agent Capabilities

Each agent has:
- **Specialized Domain Knowledge** - Deep expertise in their specific area
- **Swedish Context** - Understanding of BRF regulations and terminology
- **Tool Access** - Appropriate tools for their domain (Bash, Edit, Write, Read, etc.)
- **Zero-Cost Philosophy** - Focus on free development, paid services when profitable

## Parallel Agent Usage

You can run multiple agents simultaneously for independent tasks:

**Foundation Group** (can run in parallel):
- infrastructure-architect (Docker setup)
- database-architect (Schema design) 
- security-engineer (Auth system)

**Feature Group** (can run in parallel):
- nextjs-developer (UI components)
- api-developer (Backend APIs)
- mobile-developer (Mobile apps)

**Swedish Compliance Group** (can run in parallel):
- swedish-law-expert (Legal review)
- brf-operations-expert (BRF workflows)
- swedish-financial-expert (Accounting)

## Troubleshooting

### Agent Not Found
```bash
# Check available agents
npx tsx lib/agents/agent-cli.ts list

# Validate configuration
npx tsx lib/agents/agent-cli.ts validate
```

### Configuration Issues
The agents-config.yaml file defines all agents. If there are issues:
```bash
npx tsx lib/agents/agent-cli.ts validate
```

## Integration with Claude Code

The agents integrate seamlessly with Claude Code through:
1. **Task Tool** - Uses Claude's built-in agent execution
2. **Specialized Prompts** - Each agent has domain-specific instructions
3. **Tool Access** - Agents can use appropriate Claude Code tools
4. **Context Awareness** - Agents understand the BRF Portal project context

## Next Steps

The agent system is now fully functional. You can:
1. ✅ Invoke any of the 16 specialized agents
2. ✅ Use them for parallel development tasks
3. ✅ Leverage their Swedish BRF domain expertise
4. ✅ Coordinate complex multi-agent workflows

**The BRF Portal specialized agents are ready to accelerate your development!** 🚀