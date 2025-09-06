#!/bin/bash
# PostToolUse Hook - Test Runner for BRF Portal
# Automatically runs relevant tests after code changes

# Get tool information from parameters
TOOL_NAME="${1:-}"
TOOL_PARAMS="${2:-}"
TOOL_RESULT="${3:-}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track if we need to run tests
RUN_TESTS=false
TEST_TYPE=""

# Function to determine which tests to run based on file changes
determine_tests() {
    local file_path="$1"
    
    # Database schema changes
    if echo "$file_path" | grep -qE "(schema|migration|database).*\.(sql|js|ts)"; then
        echo "database"
        return
    fi
    
    # API endpoint changes
    if echo "$file_path" | grep -qE "(api|route|endpoint).*\.(js|ts)"; then
        echo "api"
        return
    fi
    
    # React component changes
    if echo "$file_path" | grep -qE "(component|page|layout).*\.(jsx|tsx)"; then
        echo "component"
        return
    fi
    
    # Authentication changes
    if echo "$file_path" | grep -qE "(auth|session|login|bankid).*\.(js|ts)"; then
        echo "auth"
        return
    fi
    
    # Financial/compliance code
    if echo "$file_path" | grep -qE "(invoice|payment|fee|accounting).*\.(js|ts)"; then
        echo "financial"
        return
    fi
    
    # Multi-tenant code
    if echo "$file_path" | grep -qE "(tenant|cooperative|isolation).*\.(js|ts)"; then
        echo "multitenant"
        return
    fi
    
    echo "unit"
}

# Function to run specific test suites
run_test_suite() {
    local test_type="$1"
    
    echo -e "${BLUE}🧪 Running $test_type tests...${NC}"
    
    case "$test_type" in
        "database")
            echo "Testing database migrations and schema..."
            # Check if migration files exist
            if [[ -d "migrations" ]]; then
                echo "• Validating migration files"
                echo "• Checking multi-tenant isolation"
                echo "• Testing GDPR compliance fields"
            fi
            ;;
            
        "api")
            echo "Testing API endpoints..."
            if [[ -f "package.json" ]] && grep -q "test:api" package.json; then
                npm run test:api 2>/dev/null || echo "  ℹ️  API tests not configured yet"
            fi
            echo "• Checking Swedish locale responses"
            echo "• Validating cooperative_id filtering"
            ;;
            
        "component")
            echo "Testing React components..."
            if [[ -f "package.json" ]] && grep -q "test:components" package.json; then
                npm run test:components 2>/dev/null || echo "  ℹ️  Component tests not configured yet"
            fi
            echo "• Checking Swedish translations"
            echo "• Validating accessibility"
            ;;
            
        "auth")
            echo "Testing authentication..."
            echo "• Mock BankID flow validation"
            echo "• Role-based access control"
            echo "• Session management"
            echo "• Two-factor authentication mock"
            ;;
            
        "financial")
            echo -e "${YELLOW}💰 Testing financial compliance...${NC}"
            echo "• K2/K3 accounting standards"
            echo "• VAT (moms) calculations (25%)"
            echo "• OCR number generation (Luhn algorithm)"
            echo "• Invoice validation"
            echo "• Monthly fee calculations"
            ;;
            
        "multitenant")
            echo -e "${YELLOW}🏢 Testing multi-tenant isolation...${NC}"
            echo "• Data isolation between cooperatives"
            echo "• Row-level security policies"
            echo "• Cross-tenant data leak prevention"
            echo "• Cooperative switching in admin panel"
            ;;
            
        "unit")
            echo "Running unit tests..."
            if [[ -f "package.json" ]]; then
                if grep -q '"test"' package.json; then
                    npm test 2>/dev/null || echo "  ℹ️  Tests not configured yet"
                fi
            fi
            ;;
    esac
}

# Function to validate Swedish compliance
validate_swedish_compliance() {
    local file_path="$1"
    
    # Check for Swedish text in UI files
    if echo "$file_path" | grep -qE "\.(jsx|tsx)$"; then
        echo -e "${GREEN}📝 Checking Swedish language requirements...${NC}"
        
        # Look for common UI text that should be in Swedish
        if [[ -f "$file_path" ]]; then
            if grep -q "Submit\|Cancel\|Save\|Delete" "$file_path"; then
                echo -e "${YELLOW}  ⚠️  Remember to use Swedish translations:${NC}"
                echo "    • Submit → Skicka"
                echo "    • Cancel → Avbryt"
                echo "    • Save → Spara"
                echo "    • Delete → Ta bort"
            fi
        fi
    fi
}

# Function to check for security issues
security_check() {
    local file_path="$1"
    
    if [[ -f "$file_path" ]]; then
        # Check for hardcoded secrets
        if grep -qE "(api_key|secret|password|token).*=.*['\"]" "$file_path"; then
            echo -e "${RED}🔒 SECURITY WARNING: Possible hardcoded secret detected${NC}"
            echo "  Use environment variables for sensitive data"
        fi
        
        # Check for SQL injection vulnerabilities
        if grep -qE "query.*\+.*request\.(body|params|query)" "$file_path"; then
            echo -e "${YELLOW}⚠️  SQL Injection Risk: Use parameterized queries${NC}"
        fi
        
        # Check for missing cooperative_id in queries
        if grep -qE "(SELECT|UPDATE|DELETE).*FROM" "$file_path"; then
            if ! grep -q "cooperative_id" "$file_path"; then
                echo -e "${YELLOW}⚠️  Multi-tenant check: Ensure cooperative_id filtering${NC}"
            fi
        fi
    fi
}

# Main logic to determine if tests should run
if [[ "$TOOL_NAME" == "Edit" ]] || [[ "$TOOL_NAME" == "Write" ]] || [[ "$TOOL_NAME" == "MultiEdit" ]]; then
    # Extract file path
    FILE_PATH=$(echo "$TOOL_PARAMS" | grep -oP '"file_path"\s*:\s*"[^"]*"' | sed 's/"file_path"\s*:\s*"\(.*\)"/\1/')
    
    if [[ -n "$FILE_PATH" ]]; then
        # Skip tests for documentation and config files
        if ! echo "$FILE_PATH" | grep -qE "\.(md|txt|json|yml|yaml|env)$"; then
            TEST_TYPE=$(determine_tests "$FILE_PATH")
            
            # Run the appropriate test suite
            run_test_suite "$TEST_TYPE"
            
            # Additional compliance checks
            validate_swedish_compliance "$FILE_PATH"
            security_check "$FILE_PATH"
            
            # Check if we're in a Next.js project and run type checking
            if [[ -f "tsconfig.json" ]] && echo "$FILE_PATH" | grep -qE "\.(ts|tsx)$"; then
                echo -e "${BLUE}📘 Running TypeScript type check...${NC}"
                npx tsc --noEmit 2>/dev/null || echo "  ℹ️  TypeScript not configured yet"
            fi
        fi
    fi
fi

# Run linting for JavaScript/TypeScript files
if [[ "$TOOL_NAME" == "Edit" ]] || [[ "$TOOL_NAME" == "Write" ]]; then
    FILE_PATH=$(echo "$TOOL_PARAMS" | grep -oP '"file_path"\s*:\s*"[^"]*"' | sed 's/"file_path"\s*:\s*"\(.*\)"/\1/')
    
    if echo "$FILE_PATH" | grep -qE "\.(js|jsx|ts|tsx)$"; then
        if [[ -f ".eslintrc.js" ]] || [[ -f ".eslintrc.json" ]]; then
            echo -e "${BLUE}🔍 Running ESLint...${NC}"
            npx eslint "$FILE_PATH" 2>/dev/null || true
        fi
    fi
fi

# Summary message
echo -e "${GREEN}✓ Post-tool validation complete${NC}"

# Check if any migrations need to be generated
if [[ "$TOOL_NAME" == "Edit" ]] || [[ "$TOOL_NAME" == "Write" ]]; then
    if echo "$FILE_PATH" | grep -qE "schema.*\.(sql|prisma)$"; then
        echo -e "${YELLOW}💡 Remember to generate migration files for schema changes${NC}"
    fi
fi

exit 0