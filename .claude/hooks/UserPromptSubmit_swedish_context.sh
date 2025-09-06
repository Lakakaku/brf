#!/bin/bash
# UserPromptSubmit Hook - Swedish Context Injection for BRF Portal
# Automatically adds relevant Swedish regulatory and project context

# Read the user's prompt from stdin
USER_PROMPT=$(cat)

# Color codes for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to detect context needs based on keywords
detect_context_needs() {
    local prompt="$1"
    local context=""
    
    # Financial/Accounting context
    if echo "$prompt" | grep -qiE "(invoice|payment|accounting|bokföring|faktura|avgift|fee|financial|ekonomi)"; then
        context="${context}
📊 SWEDISH FINANCIAL CONTEXT:
• K2/K3 Accounting Standards: All bookkeeping must follow Swedish K2 (simplified) or K3 (full) standards
• VAT (Moms): Standard rate is 25%, reduced 12% for food/hotels, 6% for culture/books
• OCR Numbers: Use Luhn algorithm for payment references
• Bokföringslagen: 7-year document retention requirement
• SIE Format: Use SIE4 for accounting exports to Fortnox/Visma
• Payment Terms: Standard 30 days, reminder after 8 days, collection (inkasso) after 30 days overdue
"
    fi
    
    # BRF Legal/Governance context
    if echo "$prompt" | grep -qiE "(board|meeting|årsstämma|stämma|protokoll|styrelse|member|voting)"; then
        context="${context}
⚖️ SWEDISH BRF LAW CONTEXT:
• Bostadsrättslagen: Main law governing housing cooperatives (2018:672)
• Annual Meeting (Årsstämma): Must be held within 6 months after fiscal year end
• Notice Period: 14 days minimum for annual meetings, 7 days for extra meetings
• Board Composition: Minimum 3 members, majority must be members of the cooperative
• Protocols: Must be signed by chairman and approved by two members
• Voting Rights: One vote per apartment, proxy allowed with written authorization
• Economic Plan: Required for new cooperatives, must be registered with Bolagsverket
"
    fi
    
    # GDPR/Privacy context
    if echo "$prompt" | grep -qiE "(gdpr|privacy|personal|data|member.*info|personuppgift|integritet)"; then
        context="${context}
🔒 GDPR & SWEDISH PRIVACY CONTEXT:
• Legal Basis: Legitimate interest for member administration, contract for services
• Data Minimization: Only collect necessary data for BRF operations
• Retention: 7 years for financial data, 2 years after membership ends for personal data
• Rights: Access (registerutdrag), rectification, deletion (after legal retention)
• Security: Encryption for sensitive data, audit logging required
• DPA: Consider Dataskyddsförordningen additional Swedish requirements
• Children: Special protection for minors living in apartments
"
    fi
    
    # Energy/Maintenance context
    if echo "$prompt" | grep -qiE "(energy|heating|fjärrvärme|maintenance|underhåll|el|electricity|water)"; then
        context="${context}
🔧 SWEDISH BUILDING & ENERGY CONTEXT:
• District Heating (Fjärrvärme): Most common heating, measured in MWh
• Electricity: Typically 3-phase 400V, measured in kWh
• Energy Declaration: Required every 10 years (Energideklaration)
• Maintenance Plan (Underhållsplan): Legally required, 30-50 year horizon
• Water: Include hot/cold water in monthly fees or individual metering (IMD)
• Ventilation: OVK inspection required every 3-6 years
• Radon: Measurement required, max 200 Bq/m³
"
    fi
    
    # Queue/Membership context
    if echo "$prompt" | grep -qiE "(queue|kö|waiting|apartment.*transfer|överlåtelse|andrahand|subletting)"; then
        context="${context}
🏠 SWEDISH APARTMENT TRANSFER CONTEXT:
• Internal Queue (Intern kö): Members can queue for other apartments
• Transfer Fee: Max 2.5% of price base amount (prisbasbelopp 2024: 57,300 SEK)
• Subletting (Andrahandsuthyrning): Board approval required, max 1-2 years typically
• Membership Approval: Board has 6 weeks to approve/deny new members
• Grounds for Denial: Only economic reasons or disruption risk
• Price Control: No legal price control, market decides
• Pant: Apartment can be used as collateral (pantsättning)
"
    fi
    
    # Integration context
    if echo "$prompt" | grep -qiE "(bankid|fortnox|visma|kivra|integration|api|webhook)"; then
        context="${context}
🔌 SWEDISH SERVICE INTEGRATION CONTEXT:
• BankID: Production requires agreement with bank, use test environment initially
• Fortnox: REST API, OAuth2, SIE4 import/export support
• Visma: Similar to Fortnox, different API structure
• Kivra: Digital mailbox, requires company agreement
• Swish: Payment service, requires company account and certificate
• Swedish Banks: Swedbank, SEB, Nordea, Handelsbanken - different APIs
• OCR/BG/PG: Bankgirot and Plusgirot for payment processing
"
    fi
    
    # Add project philosophy reminder
    if echo "$prompt" | grep -qiE "(implement|build|create|develop|setup|configure)"; then
        context="${context}
💡 PROJECT PHILOSOPHY REMINDER:
• Zero-Cost First: Use SQLite, mock services, free tiers initially
• Mock Then Real: Build mock integrations, add real when customers arrive
• Test Everything: Admin panel to test all features before going live
• Swedish First: All user-facing text in Swedish, English for docs/code
• Multi-Tenant: Always filter by cooperative_id, strict isolation
• Parallel Work: Check TASKS.md for parallel group assignments
"
    fi
    
    echo "$context"
}

# Function to check current phase from TASKS.md
check_current_phase() {
    if [[ -f "docs/TASKS.md" ]]; then
        local phase=$(grep -m1 "^## PHASE" docs/TASKS.md | grep -oE "PHASE [0-9]+" || echo "PHASE 1")
        echo -e "${BLUE}📋 Current Development: $phase${NC}"
        
        # Count completed vs total tasks
        local completed=$(grep -c "\[x\]" docs/TASKS.md 2>/dev/null || echo 0)
        local total=$(grep -c "\[ \]" docs/TASKS.md 2>/dev/null || echo 0)
        echo -e "${GREEN}Progress: $completed completed, $total remaining${NC}"
    fi
}

# Function to suggest relevant agents
suggest_agents() {
    local prompt="$1"
    local agents=""
    
    if echo "$prompt" | grep -qiE "(database|schema|migration|sql)"; then
        agents="${agents} database-architect"
    fi
    
    if echo "$prompt" | grep -qiE "(frontend|react|next|ui|component)"; then
        agents="${agents} nextjs-developer"
    fi
    
    if echo "$prompt" | grep -qiE "(swedish|law|legal|compliance|bostadsrätt)"; then
        agents="${agents} swedish-law-expert"
    fi
    
    if echo "$prompt" | grep -qiE "(api|backend|webhook|integration)"; then
        agents="${agents} api-developer"
    fi
    
    if echo "$prompt" | grep -qiE "(test|qa|quality|e2e|unit)"; then
        agents="${agents} qa-engineer"
    fi
    
    if echo "$prompt" | grep -qiE "(security|auth|gdpr|encryption)"; then
        agents="${agents} security-engineer"
    fi
    
    if echo "$prompt" | grep -qiE "(energy|heating|maintenance|consumption)"; then
        agents="${agents} energy-optimization-expert"
    fi
    
    if [[ -n "$agents" ]]; then
        echo -e "${YELLOW}🤖 Consider using these specialist agents:${agents}${NC}"
        echo "Use: Task tool with agent name for specialized expertise"
    fi
}

# Main execution
CONTEXT=$(detect_context_needs "$USER_PROMPT")

# Output JSON format for advanced hook features
cat <<EOF
{
  "decision": "continue",
  "context": "$CONTEXT",
  "toolUseAllowed": true
}
EOF

# Also output helpful information to stderr (visible in terminal)
if [[ -n "$CONTEXT" ]]; then
    echo -e "${GREEN}✓ Swedish context injected based on your request${NC}" >&2
fi

check_current_phase >&2
suggest_agents "$USER_PROMPT" >&2

exit 0