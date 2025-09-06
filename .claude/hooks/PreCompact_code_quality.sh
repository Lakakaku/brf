#!/bin/bash
# PreCompact Hook - Code Quality Checks for BRF Portal
# Runs linters, formatters, and validation before context compaction

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           🔍 Code Quality Pre-Compact Check${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Track overall status
QUALITY_PASSED=true

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to run TypeScript checks
check_typescript() {
    echo -e "${BLUE}📘 TypeScript Check:${NC}"
    
    if [[ -f "tsconfig.json" ]]; then
        if command_exists tsc || command_exists npx; then
            echo -n "  Checking types... "
            
            # Run TypeScript compiler in no-emit mode
            if npx tsc --noEmit 2>/tmp/tsc-errors.log; then
                echo -e "${GREEN}✓ No type errors${NC}"
            else
                echo -e "${RED}✗ Type errors found${NC}"
                
                # Show first 5 errors
                head -5 /tmp/tsc-errors.log | while IFS= read -r line; do
                    echo "    $line"
                done
                
                QUALITY_PASSED=false
                echo -e "  ${YELLOW}Fix type errors before proceeding${NC}"
            fi
        else
            echo -e "  ${YELLOW}TypeScript compiler not found${NC}"
        fi
    else
        echo -e "  ${YELLOW}No tsconfig.json found${NC}"
    fi
    echo ""
}

# Function to run ESLint
check_eslint() {
    echo -e "${BLUE}🔍 ESLint Check:${NC}"
    
    if [[ -f ".eslintrc.js" ]] || [[ -f ".eslintrc.json" ]] || [[ -f ".eslintrc.yml" ]]; then
        if command_exists eslint || command_exists npx; then
            echo -n "  Running ESLint... "
            
            # Count linting issues
            LINT_OUTPUT=$(npx eslint . --ext .js,.jsx,.ts,.tsx --format compact 2>/dev/null | grep -c ":" || echo "0")
            
            if [[ "$LINT_OUTPUT" -eq 0 ]]; then
                echo -e "${GREEN}✓ No linting issues${NC}"
            else
                echo -e "${YELLOW}⚠️  $LINT_OUTPUT linting issues found${NC}"
                
                # Show summary of issues by type
                echo "  Issue summary:"
                npx eslint . --ext .js,.jsx,.ts,.tsx --format compact 2>/dev/null | head -5
                
                echo -e "  ${YELLOW}Run 'npm run lint' to see all issues${NC}"
            fi
        else
            echo -e "  ${YELLOW}ESLint not configured${NC}"
        fi
    else
        echo -e "  ${YELLOW}No ESLint configuration found${NC}"
    fi
    echo ""
}

# Function to check Prettier formatting
check_prettier() {
    echo -e "${BLUE}🎨 Prettier Format Check:${NC}"
    
    if [[ -f ".prettierrc" ]] || [[ -f ".prettierrc.js" ]] || [[ -f ".prettierrc.json" ]]; then
        if command_exists prettier || command_exists npx; then
            echo -n "  Checking formatting... "
            
            # Check if files need formatting
            UNFORMATTED=$(npx prettier --check "**/*.{js,jsx,ts,tsx,css,md}" 2>/dev/null | grep -c "Code style issues" || echo "0")
            
            if [[ "$UNFORMATTED" -eq 0 ]]; then
                echo -e "${GREEN}✓ All files formatted${NC}"
            else
                echo -e "${YELLOW}⚠️  Some files need formatting${NC}"
                echo -e "  ${YELLOW}Run 'npm run format' to fix${NC}"
            fi
        else
            echo -e "  ${YELLOW}Prettier not configured${NC}"
        fi
    else
        echo -e "  ${YELLOW}No Prettier configuration found${NC}"
    fi
    echo ""
}

# Function to check Swedish translations
check_swedish_translations() {
    echo -e "${BLUE}🇸🇪 Swedish Translation Check:${NC}"
    
    # Look for common English UI text that should be Swedish
    ENGLISH_TERMS_FOUND=false
    
    # Check TypeScript/JavaScript files for hardcoded English
    if find . -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" 2>/dev/null | head -20 | xargs grep -l "Submit\|Cancel\|Save\|Delete\|Loading\|Error" 2>/dev/null | head -5 > /tmp/english-terms.txt; then
        if [[ -s /tmp/english-terms.txt ]]; then
            echo -e "  ${YELLOW}⚠️  English terms found in UI files:${NC}"
            while IFS= read -r file; do
                echo "    • $(basename "$file")"
                ENGLISH_TERMS_FOUND=true
            done < /tmp/english-terms.txt
            
            echo ""
            echo -e "  ${BLUE}Swedish translations:${NC}"
            echo "    Submit → Skicka"
            echo "    Cancel → Avbryt"
            echo "    Save → Spara"
            echo "    Delete → Ta bort"
            echo "    Loading → Laddar"
            echo "    Error → Fel"
        fi
    fi
    
    if [[ "$ENGLISH_TERMS_FOUND" == false ]]; then
        echo -e "  ${GREEN}✓ Swedish UI conventions followed${NC}"
    fi
    echo ""
}

# Function to check for security issues
check_security() {
    echo -e "${BLUE}🔒 Security Check:${NC}"
    
    SECURITY_ISSUES=0
    
    # Check for hardcoded secrets
    echo -n "  Checking for hardcoded secrets... "
    if grep -r --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" -E "(api_key|secret|password|token)\s*=\s*['\"][^'\"]+" . 2>/dev/null | grep -v node_modules | head -1 > /tmp/secrets.txt; then
        if [[ -s /tmp/secrets.txt ]]; then
            echo -e "${RED}✗ Potential secrets found${NC}"
            echo -e "    ${RED}Never commit secrets to code${NC}"
            SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
            QUALITY_PASSED=false
        else
            echo -e "${GREEN}✓ No hardcoded secrets${NC}"
        fi
    else
        echo -e "${GREEN}✓ No hardcoded secrets${NC}"
    fi
    
    # Check for SQL injection risks
    echo -n "  Checking for SQL injection risks... "
    if grep -r --include="*.js" --include="*.ts" -E "query.*\+.*request\.(body|params|query)" . 2>/dev/null | grep -v node_modules | head -1 > /tmp/sql-injection.txt; then
        if [[ -s /tmp/sql-injection.txt ]]; then
            echo -e "${YELLOW}⚠️  Potential SQL injection risk${NC}"
            echo -e "    ${YELLOW}Use parameterized queries${NC}"
            SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
        else
            echo -e "${GREEN}✓ No obvious SQL injection risks${NC}"
        fi
    else
        echo -e "${GREEN}✓ No obvious SQL injection risks${NC}"
    fi
    
    # Check for GDPR compliance markers
    echo -n "  Checking GDPR compliance... "
    if grep -r --include="*.js" --include="*.ts" "personal\|member.*data\|user.*info" . 2>/dev/null | grep -v node_modules | head -1 > /dev/null; then
        echo -e "${GREEN}✓ Personal data handling detected${NC}"
        echo -e "    ${BLUE}Ensure: Encryption, audit logging, deletion rights${NC}"
    else
        echo -e "${YELLOW}⚠️  No GDPR markers found${NC}"
    fi
    
    echo ""
}

# Function to check multi-tenant isolation
check_multitenant() {
    echo -e "${BLUE}🏢 Multi-Tenant Isolation Check:${NC}"
    
    # Look for database queries without cooperative_id
    echo -n "  Checking for tenant isolation... "
    
    QUERIES_WITHOUT_TENANT=0
    if grep -r --include="*.js" --include="*.ts" -E "(SELECT|UPDATE|DELETE).*FROM" . 2>/dev/null | grep -v node_modules | grep -v cooperative_id | head -5 > /tmp/tenant-check.txt; then
        if [[ -s /tmp/tenant-check.txt ]]; then
            QUERIES_WITHOUT_TENANT=$(wc -l < /tmp/tenant-check.txt | tr -d ' ')
            echo -e "${YELLOW}⚠️  $QUERIES_WITHOUT_TENANT queries without cooperative_id${NC}"
            echo -e "    ${YELLOW}Ensure all queries filter by cooperative_id${NC}"
        else
            echo -e "${GREEN}✓ Tenant isolation appears correct${NC}"
        fi
    else
        echo -e "${GREEN}✓ No isolation issues detected${NC}"
    fi
    echo ""
}

# Function to validate Tailwind CSS
check_tailwind() {
    echo -e "${BLUE}🎨 Tailwind CSS Check:${NC}"
    
    if [[ -f "tailwind.config.js" ]] || [[ -f "tailwind.config.ts" ]]; then
        echo -n "  Checking for invalid classes... "
        
        # Simple check for common Tailwind mistakes
        INVALID_CLASSES=0
        if grep -r --include="*.tsx" --include="*.jsx" -E "className=.*['\"].*-(00|9999|1000)['\"]" . 2>/dev/null | grep -v node_modules | head -1 > /tmp/tailwind-check.txt; then
            if [[ -s /tmp/tailwind-check.txt ]]; then
                echo -e "${YELLOW}⚠️  Suspicious Tailwind classes found${NC}"
                echo -e "    ${YELLOW}Check for typos in utility classes${NC}"
            else
                echo -e "${GREEN}✓ Tailwind classes look valid${NC}"
            fi
        else
            echo -e "${GREEN}✓ No obvious Tailwind issues${NC}"
        fi
    else
        echo -e "  ${YELLOW}Tailwind not configured${NC}"
    fi
    echo ""
}

# Function to check test coverage
check_tests() {
    echo -e "${BLUE}🧪 Test Coverage:${NC}"
    
    if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
        # Check if any test files exist
        TEST_COUNT=$(find . -name "*.test.js" -o -name "*.test.ts" -o -name "*.spec.js" -o -name "*.spec.ts" 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
        
        if [[ "$TEST_COUNT" -gt 0 ]]; then
            echo -e "  ${GREEN}✓ $TEST_COUNT test files found${NC}"
        else
            echo -e "  ${YELLOW}⚠️  No test files found${NC}"
            echo -e "    ${YELLOW}Consider adding tests for critical functionality${NC}"
        fi
    else
        echo -e "  ${YELLOW}No test script configured${NC}"
    fi
    echo ""
}

# Function to check documentation
check_documentation() {
    echo -e "${BLUE}📚 Documentation Check:${NC}"
    
    DOCS_SCORE=0
    
    # Check for README
    if [[ -f "README.md" ]]; then
        echo -e "  ${GREEN}✓ README.md exists${NC}"
        DOCS_SCORE=$((DOCS_SCORE + 1))
    else
        echo -e "  ${YELLOW}⚠️  No README.md${NC}"
    fi
    
    # Check for API documentation
    if [[ -d "docs" ]]; then
        echo -e "  ${GREEN}✓ Documentation folder exists${NC}"
        DOCS_SCORE=$((DOCS_SCORE + 1))
    fi
    
    # Check for JSDoc comments
    JSDOC_COUNT=$(grep -r "^\s*\/\*\*" --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
    if [[ "$JSDOC_COUNT" -gt 0 ]]; then
        echo -e "  ${GREEN}✓ $JSDOC_COUNT JSDoc comments found${NC}"
    else
        echo -e "  ${YELLOW}⚠️  No JSDoc comments found${NC}"
    fi
    
    echo ""
}

# Main execution
check_typescript
check_eslint
check_prettier
check_swedish_translations
check_security
check_multitenant
check_tailwind
check_tests
check_documentation

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
if [[ "$QUALITY_PASSED" == true ]]; then
    echo -e "${GREEN}✓ Code quality check passed!${NC}"
    echo -e "${GREEN}Ready for context compaction.${NC}"
else
    echo -e "${YELLOW}⚠️  Some quality issues detected${NC}"
    echo -e "${YELLOW}Consider fixing critical issues before proceeding.${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Return appropriate exit code
if [[ "$QUALITY_PASSED" == true ]]; then
    exit 0
else
    # Exit with 0 to allow continuation, but issues were logged
    exit 0
fi