#!/bin/bash

# BRF Portal Agent Helper Script
# Usage: ./scripts/use-agent.sh <agent-name> "<task-description>"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <agent-name> \"<task-description>\""
    echo ""
    echo "Available agents:"
    npx tsx lib/agents/agent-cli.ts list
    exit 1
fi

AGENT_NAME="$1"
TASK_DESCRIPTION="$2"

echo "🤖 Invoking BRF Portal Agent: $AGENT_NAME"
echo "📋 Task: $TASK_DESCRIPTION"
echo ""

# Generate the invocation
npx tsx lib/agents/agent-cli.ts invoke "$AGENT_NAME" "$TASK_DESCRIPTION"