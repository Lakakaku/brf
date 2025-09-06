#!/bin/bash
# PreToolUse Hook - Command Validation for BRF Portal
# Validates dangerous commands and ensures safe database operations

# Get the tool and parameters from environment/stdin
TOOL_NAME="${1:-}"
TOOL_PARAMS="${2:-}"

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to check if command contains dangerous operations
check_dangerous_command() {
    local cmd="$1"
    
    # Block dangerous file operations without confirmation
    if [[ "$cmd" =~ rm[[:space:]]+-rf[[:space:]]+/ ]] || [[ "$cmd" =~ rm[[:space:]]+-rf[[:space:]]+\* ]]; then
        echo -e "${RED}⚠️  BLOCKED: Dangerous recursive deletion detected${NC}"
        echo "Use 'rm -rf' only with specific paths, not root or wildcards"
        exit 1
    fi
    
    # Warn about direct database modifications
    if [[ "$cmd" =~ (DROP|TRUNCATE|DELETE)[[:space:]]+(TABLE|DATABASE|SCHEMA) ]]; then
        echo -e "${YELLOW}⚠️  WARNING: Direct database modification detected${NC}"
        echo "Consider using migration files instead for database changes"
        # Allow but warn (exit 0 with warning)
    fi
    
    # Check for production environment variables
    if [[ "$cmd" =~ (PROD|PRODUCTION).*=(.*) ]] || [[ "$cmd" =~ export.*PROD ]]; then
        echo -e "${RED}⚠️  BLOCKED: Production environment variable modification${NC}"
        echo "Production configs should not be modified in development"
        exit 1
    fi
    
    # Validate Docker commands
    if [[ "$cmd" =~ docker.*system.*prune.*-a ]] || [[ "$cmd" =~ docker.*volume.*prune.*-a ]]; then
        echo -e "${YELLOW}⚠️  WARNING: Docker prune will remove all unused resources${NC}"
        echo "This may affect other projects on your system"
    fi
    
    # Check for Swedish compliance in financial operations
    if [[ "$cmd" =~ (invoice|payment|fee|avgift|moms|vat) ]]; then
        echo -e "${GREEN}✓ Swedish financial operation detected - ensure compliance with:${NC}"
        echo "  • Bokföringslagen (Accounting Act)"
        echo "  • K2/K3 accounting standards"
        echo "  • 25% VAT (moms) requirements"
    fi
}

# Function to validate database migrations
check_migration_safety() {
    local cmd="$1"
    
    # Check if running migrations without backup
    if [[ "$cmd" =~ (migrate|migration).*run ]] || [[ "$cmd" =~ npm.*run.*migrate ]]; then
        echo -e "${YELLOW}📦 Database migration detected${NC}"
        echo "Ensure you have:"
        echo "  • Backed up the current database"
        echo "  • Tested migration in development first"
        echo "  • Prepared rollback strategy"
    fi
    
    # Multi-tenant safety check
    if [[ "$cmd" =~ UPDATE.*WHERE ]] || [[ "$cmd" =~ DELETE.*FROM ]]; then
        if ! [[ "$cmd" =~ cooperative_id ]]; then
            echo -e "${YELLOW}⚠️  WARNING: SQL operation without cooperative_id filter${NC}"
            echo "Ensure multi-tenant isolation with cooperative_id in WHERE clause"
        fi
    fi
}

# Function to validate Swedish BRF operations
check_brf_compliance() {
    local cmd="$1"
    
    # Check for annual meeting operations
    if [[ "$cmd" =~ (årsstämma|annual.*meeting|stämma) ]]; then
        echo -e "${GREEN}📋 Annual meeting operation - ensure compliance with:${NC}"
        echo "  • Bostadsrättslagen chapter 7"
        echo "  • 14-day notice requirement"
        echo "  • Protocol requirements"
    fi
    
    # Check for member data operations
    if [[ "$cmd" =~ (member|medlem|personal|gdpr) ]]; then
        echo -e "${GREEN}🔒 Personal data operation - GDPR requirements:${NC}"
        echo "  • Encryption for sensitive data"
        echo "  • Audit logging enabled"
        echo "  • Right to deletion implemented"
    fi
}

# Main validation logic
if [[ "$TOOL_NAME" == "Bash" ]] || [[ "$TOOL_NAME" == "bash" ]]; then
    # Extract the actual command from parameters
    COMMAND=$(echo "$TOOL_PARAMS" | grep -oP '"command"\s*:\s*"[^"]*"' | sed 's/"command"\s*:\s*"\(.*\)"/\1/')
    
    if [[ -n "$COMMAND" ]]; then
        check_dangerous_command "$COMMAND"
        check_migration_safety "$COMMAND"
        check_brf_compliance "$COMMAND"
    fi
fi

# Check for file operations that might affect critical files
if [[ "$TOOL_NAME" == "Write" ]] || [[ "$TOOL_NAME" == "Edit" ]]; then
    # Extract file path from parameters
    FILE_PATH=$(echo "$TOOL_PARAMS" | grep -oP '"file_path"\s*:\s*"[^"]*"' | sed 's/"file_path"\s*:\s*"\(.*\)"/\1/')
    
    # Protect critical configuration files
    if [[ "$FILE_PATH" =~ \.env$ ]] || [[ "$FILE_PATH" =~ production\.env ]]; then
        echo -e "${YELLOW}⚠️  Modifying environment configuration${NC}"
        echo "Remember: Never commit sensitive credentials to git"
    fi
    
    # Check for database schema modifications
    if [[ "$FILE_PATH" =~ (schema|migration|database).*\.(sql|js|ts) ]]; then
        echo -e "${GREEN}📊 Database schema modification detected${NC}"
        echo "Ensure backward compatibility and migration testing"
    fi
    
    # Swedish documentation files
    if [[ "$FILE_PATH" =~ \.(md|txt)$ ]] && [[ "$FILE_PATH" =~ (swedish|svensk|brf) ]]; then
        echo -e "${GREEN}📝 Swedish documentation - check for:${NC}"
        echo "  • Correct Swedish terminology"
        echo "  • Legal term accuracy"
        echo "  • BRF-specific conventions"
    fi
fi

# All checks passed
exit 0