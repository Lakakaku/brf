# BRF Portal Development Hooks

## Overview

This directory contains Claude Code hooks specifically designed for Swedish BRF Portal development. These hooks automatically enhance your development workflow with Swedish context, code quality checks, and security validation.

## Available Hooks

### 1. Swedish Context Hook (`swedish-context.py`)

**Event:** `UserPromptSubmit`
**Purpose:** Automatically injects Swedish BRF terminology and compliance context

**Features:**

- Adds Swedish BRF terminology dictionary
- Injects compliance requirements (GDPR, Bokföringslagen)
- Provides integration context (BankID, Fortnox, etc.)
- Detects feature-specific context based on prompt content

### 2. Code Quality Hook (`code-quality.py`)

**Event:** `PostToolUse` (after Write, Edit, MultiEdit)
**Purpose:** Ensures code quality and Swedish compliance

**Features:**

- Detects Swedish strings that need internationalization
- Checks TypeScript compliance for BRF data structures
- Validates UUID usage for cooperative_id and member_id
- Runs ESLint and TypeScript checks when available

### 3. Security Check Hook (`security-check.py`)

**Event:** `PreToolUse` (before Write operations)
**Purpose:** Prevents committing sensitive data

**Features:**

- Detects API keys and secrets (Stripe, Supabase, etc.)
- Identifies Swedish sensitive data (personnummer, bankgiro)
- Blocks hardcoded database credentials
- Provides detailed security violation feedback

## Installation

### Method 1: Project-Specific Hooks

```bash
# Copy the hooks configuration to your Claude settings
cp /Users/lucasjenner/brf/hooks/claude-hooks-config.json ~/.claude/hooks.json
```

### Method 2: Global Installation

```bash
# Install hooks globally for all projects
cat /Users/lucasjenner/brf/hooks/claude-hooks-config.json >> ~/.claude/config.json
```

### Method 3: Via Claude Code CLI

```bash
claude hooks add-config /Users/lucasjenner/brf/hooks/claude-hooks-config.json
```

## Configuration Details

### Current Hook Configuration:

```json
{
  "UserPromptSubmit": "Swedish context injection",
  "PostToolUse": "Code quality validation after file operations",
  "PreToolUse": "Security validation before file writes"
}
```

### Customization Options:

#### Timeout Settings

- Swedish Context: 5 seconds
- Code Quality: 15 seconds
- Security Check: 10 seconds

#### File Pattern Matching

Security checks apply to: `**/*.{ts,tsx,js,jsx,py,json,env,yaml,yml}`

## Usage Examples

### Swedish Context Injection

When you ask: "Create a member authentication system"

Hook automatically adds:

- BankID integration context
- Swedish compliance requirements
- BRF-specific terminology
- Technical stack reminders

### Code Quality Validation

After writing TypeScript code, hook checks:

```typescript
// ❌ Will trigger warning
const member: any = {...}
const cooperative_id: string = "123"

// ✅ Correct BRF Portal format
const member: Member = {...}
const cooperative_id: UUID = "550e8400-e29b-41d4-a716-446655440000"
```

### Security Prevention

Blocks commits containing:

```typescript
// ❌ Blocked by security hook
const apiKey = 'sk_live_51HYbF2eZvKYlo2C9...';
const personnummer = '19850615-1234';

// ✅ Allowed format
const apiKey = process.env.STRIPE_SECRET_KEY;
const personnummerHash = hashPersonnummer(personnummer);
```

## BRF-Specific Features

### Swedish Terminology Detection

Hook recognizes and provides context for:

- **avgift** → Monthly fee management
- **årsstämma** → AGM digital voting requirements
- **styrelse** → Board collaboration workflows
- **underhållsplan** → 50-year maintenance planning
- **kösystem** → Apartment queue management

### Compliance Enforcement

- **GDPR**: Ensures personal data handling compliance
- **Bokföringslagen**: Validates accounting code structure
- **Bostadsrättslagen**: Provides housing cooperative law context

### Integration Context

- **Supabase**: Database operations and RLS policies
- **BankID**: Authentication via Criipto integration
- **Fortnox/Visma**: Swedish accounting system integration
- **Swedish Banks**: Payment processing standards

## Troubleshooting

### Hook Not Executing

```bash
# Check hook permissions
ls -la /Users/lucasjenner/brf/hooks/scripts/

# Make executable if needed
chmod +x /Users/lucasjenner/brf/hooks/scripts/*.py
```

### Python Dependencies

```bash
# Install required packages if needed
pip3 install json sys os subprocess re
```

### Testing Hooks

```bash
# Test Swedish context hook
echo '{"prompt": "Create BRF member system"}' | python3 swedish-context.py

# Test security hook
echo '{"toolInput": {"arguments": {"content": "const key = \"sk_test_123\""}}}' | python3 security-check.py
```

## Development Workflow

With these hooks active, your BRF Portal development workflow becomes:

1. **Prompt Submission** → Swedish context automatically added
2. **Code Writing** → Security validation before writing
3. **File Saved** → Code quality checks after writing
4. **Continuous Protection** → All operations monitored for BRF compliance

This ensures every piece of code follows Swedish BRF standards and security best practices without manual intervention.

## Hook Output Examples

### Swedish Context Added:

```
## Swedish BRF Context
Working on a Swedish housing cooperative management platform...

### Key Swedish Terms:
- BRF: Bostadsrättsförening (Housing Cooperative)
- Avgift: Monthly fee paid by members
...

### Relevant Feature Context:
- Swedish invoice processing with OCR support for common suppliers...
```

### Code Quality Issues:

```
🔍 Code Quality Issues in member.ts:
  ⚠️  Line 15: Swedish text 'Välkommen' should be internationalized
  ⚠️  Line 23: BRF Compliance: Ensure cooperative_id is typed as UUID
  ⚠️  Use of 'any' type found - consider specific typing for BRF data structures
```

### Security Violation:

```
🚫 SECURITY VIOLATION DETECTED

The following security issues were found:
  Line 12: Hardcoded secret (sk_live_51HYbF2eZvKY...)

🔒 BRF Portal Security Policy:
- Never commit API keys, passwords, or tokens
- Use environment variables for sensitive data

Operation blocked to protect BRF Portal security.
```
