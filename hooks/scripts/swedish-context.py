#!/usr/bin/env python3
"""
Swedish BRF Context Hook for Claude Code
Automatically injects Swedish BRF terminology and context into user prompts
"""

import json
import sys
import os
from datetime import datetime

# Swedish BRF terminology and context
SWEDISH_CONTEXT = """
## Swedish BRF Context
Working on a Swedish housing cooperative (bostadsrättsförening/BRF) management platform.

### Key Swedish Terms:
- **BRF**: Bostadsrättsförening (Housing Cooperative)
- **Avgift**: Monthly fee paid by members
- **Årsstämma**: Annual General Meeting (AGM)
- **Styrelse**: Board of directors
- **Medlemsregister**: Member registry
- **Underhållsplan**: Maintenance plan
- **Kösystem**: Queue system for apartment transfers
- **Bokföringslagen**: Swedish Accounting Act
- **Bostadsrättslagen**: Swedish Housing Cooperative Act

### Compliance Requirements:
- GDPR compliant data handling
- Swedish accounting standards (K2/K3)
- Bokföringslagen compliance
- BankID authentication standard
- Swedish language support

### Integration Requirements:
- Fortnox/Visma accounting integration
- BankID authentication via Criipto
- Swedish bank payment systems
- Kivra digital mailbox
- Skatteverket (Tax Agency) reporting
- Bolagsverket (Companies Registration Office)

### Technical Stack:
- Next.js 14 with App Router
- Supabase (PostgreSQL + Auth + Storage)
- TypeScript strict mode
- Row-Level Security for multi-tenancy
- Swedish data residency requirements

"""

FEATURE_CONTEXT = {
    "invoice": "Swedish invoice processing with OCR support for common suppliers like Vattenfall, E.ON, district heating companies",
    "authentication": "BankID integration via Criipto for secure Swedish identity verification",
    "accounting": "K2/K3 compliant bookkeeping with SIE file export for Swedish accounting systems",
    "payment": "Swedish payment methods: Bankgirot, Plusgirot, Swish, direct debit (autogiro)",
    "legal": "Swedish housing cooperative law compliance (Bostadsrättslagen)",
    "energy": "Swedish energy optimization with district heating (fjärrvärme) and electricity providers",
    "member": "Member management following Swedish cooperative structures and rights",
    "board": "Board protocols and decision tracking per Swedish corporate governance",
    "maintenance": "50-year maintenance planning as required for BRF compliance",
    "queue": "Apartment queue system (kösystem) following Swedish cooperative principles"
}

def get_user_input():
    """Read user prompt from stdin"""
    try:
        input_data = sys.stdin.read().strip()
        if input_data:
            data = json.loads(input_data)
            return data.get("prompt", "")
        return ""
    except:
        return ""

def detect_feature_context(prompt):
    """Detect which BRF features are mentioned in the prompt"""
    prompt_lower = prompt.lower()
    contexts = []
    
    for feature, context in FEATURE_CONTEXT.items():
        if feature in prompt_lower or any(term in prompt_lower for term in context.split()[:3]):
            contexts.append(f"- {context}")
    
    return contexts

def main():
    user_prompt = get_user_input()
    
    # Detect if this is BRF-related work
    brf_indicators = ["brf", "housing", "cooperative", "supabase", "swedish", "invoice", "member"]
    is_brf_related = any(indicator in user_prompt.lower() for indicator in brf_indicators)
    
    if not is_brf_related and len(user_prompt) > 0:
        # Not BRF related, just continue
        result = {"continue": True}
        print(json.dumps(result))
        return
    
    # Build contextual information
    additional_context = SWEDISH_CONTEXT
    
    # Add feature-specific context if detected
    feature_contexts = detect_feature_context(user_prompt)
    if feature_contexts:
        additional_context += "\n### Relevant Feature Context:\n" + "\n".join(feature_contexts) + "\n"
    
    # Add current timestamp for Swedish timezone context
    additional_context += f"\n### Current Context:\n- Working on BRF Portal development\n- Date: {datetime.now().strftime('%Y-%m-%d %H:%M')} (Swedish time)\n"
    
    # Return the hook result
    result = {
        "continue": True,
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": additional_context
        }
    }
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()