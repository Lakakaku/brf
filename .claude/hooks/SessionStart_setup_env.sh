#!/bin/bash
# SessionStart Hook - Environment Setup for BRF Portal
# Automatically sets up development environment and loads project context

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}       🏢 BRF Portal Development Environment Setup${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to display project status
show_project_status() {
    echo -e "${BLUE}📊 Project Status:${NC}"
    
    # Check current git branch
    if [[ -d ".git" ]]; then
        BRANCH=$(git branch --show-current 2>/dev/null)
        echo -e "  • Git Branch: ${GREEN}$BRANCH${NC}"
        
        # Check for uncommitted changes
        if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
            echo -e "  • ${YELLOW}⚠️  Uncommitted changes detected${NC}"
        fi
    fi
    
    # Check development phase from TASKS.md
    if [[ -f "docs/TASKS.md" ]]; then
        PHASE=$(grep -m1 "^## PHASE" docs/TASKS.md | grep -oE "PHASE [0-9]+.*" || echo "Unknown")
        echo -e "  • Development Phase: ${GREEN}$PHASE${NC}"
        
        # Count tasks
        COMPLETED=$(grep -c "\[x\]" docs/TASKS.md 2>/dev/null || echo 0)
        PENDING=$(grep -c "\[ \]" docs/TASKS.md 2>/dev/null || echo 0)
        echo -e "  • Tasks: ${GREEN}$COMPLETED completed${NC}, ${YELLOW}$PENDING pending${NC}"
    fi
    echo ""
}

# Function to check Node.js environment
check_node_env() {
    echo -e "${BLUE}🟢 Node.js Environment:${NC}"
    
    if command_exists node; then
        NODE_VERSION=$(node --version)
        echo -e "  • Node.js: ${GREEN}$NODE_VERSION${NC}"
    else
        echo -e "  • Node.js: ${RED}Not installed${NC}"
        echo -e "    ${YELLOW}Install Node.js 18+ for development${NC}"
    fi
    
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        echo -e "  • npm: ${GREEN}$NPM_VERSION${NC}"
    fi
    
    # Check for package.json and dependencies
    if [[ -f "package.json" ]]; then
        if [[ -d "node_modules" ]]; then
            echo -e "  • Dependencies: ${GREEN}Installed${NC}"
        else
            echo -e "  • Dependencies: ${YELLOW}Not installed${NC}"
            echo -e "    ${YELLOW}Run: npm install${NC}"
        fi
    else
        echo -e "  • ${YELLOW}No package.json found - run from a Next.js project directory${NC}"
    fi
    echo ""
}

# Function to check Docker environment
check_docker_env() {
    echo -e "${BLUE}🐳 Docker Environment:${NC}"
    
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
        echo -e "  • Docker: ${GREEN}$DOCKER_VERSION${NC}"
        
        # Check if Docker daemon is running
        if docker ps >/dev/null 2>&1; then
            echo -e "  • Docker Daemon: ${GREEN}Running${NC}"
            
            # Check for running containers
            CONTAINERS=$(docker ps -q | wc -l | tr -d ' ')
            if [[ "$CONTAINERS" -gt 0 ]]; then
                echo -e "  • Active Containers: ${GREEN}$CONTAINERS${NC}"
            fi
        else
            echo -e "  • Docker Daemon: ${YELLOW}Not running${NC}"
            echo -e "    ${YELLOW}Start Docker Desktop or run: sudo systemctl start docker${NC}"
        fi
        
        # Check for docker-compose
        if [[ -f "docker-compose.yml" ]] || [[ -f "docker-compose.yaml" ]]; then
            echo -e "  • Docker Compose: ${GREEN}Configuration found${NC}"
        fi
    else
        echo -e "  • Docker: ${YELLOW}Not installed${NC}"
        echo -e "    ${YELLOW}Install Docker for containerized development${NC}"
    fi
    echo ""
}

# Function to check database setup
check_database() {
    echo -e "${BLUE}🗄️ Database Setup:${NC}"
    
    # Check for SQLite (zero-cost development)
    if command_exists sqlite3; then
        SQLITE_VERSION=$(sqlite3 --version | cut -d' ' -f1)
        echo -e "  • SQLite: ${GREEN}$SQLITE_VERSION${NC} (Zero-cost development)"
        
        # Check for database file
        if [[ -f "dev.db" ]] || [[ -f "database.db" ]] || [[ -f "brf.db" ]]; then
            echo -e "  • Database File: ${GREEN}Found${NC}"
        else
            echo -e "  • Database File: ${YELLOW}Not created yet${NC}"
        fi
    else
        echo -e "  • SQLite: ${YELLOW}Not installed${NC}"
        echo -e "    ${YELLOW}Run: brew install sqlite3 (macOS) or apt install sqlite3 (Linux)${NC}"
    fi
    
    # Check for PostgreSQL (future production)
    if command_exists psql; then
        PSQL_VERSION=$(psql --version | cut -d' ' -f3)
        echo -e "  • PostgreSQL: ${GREEN}$PSQL_VERSION${NC} (Ready for production)"
    else
        echo -e "  • PostgreSQL: ${YELLOW}Not installed${NC} (Not required for development)"
    fi
    echo ""
}

# Function to set up environment variables
setup_env_vars() {
    echo -e "${BLUE}🔐 Environment Variables:${NC}"
    
    if [[ -f ".env.local" ]]; then
        echo -e "  • .env.local: ${GREEN}Found${NC}"
    elif [[ -f ".env" ]]; then
        echo -e "  • .env: ${GREEN}Found${NC}"
    else
        echo -e "  • Environment file: ${YELLOW}Not found${NC}"
        
        if [[ -f ".env.example" ]]; then
            echo -e "    ${YELLOW}Copy .env.example to .env.local and configure${NC}"
        else
            echo -e "    ${YELLOW}Creating .env.local template...${NC}"
            cat > .env.local <<EOF
# Database
DATABASE_URL="file:./dev.db"

# Authentication (Mock for development)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="development-secret-change-in-production"

# Swedish Services (Mock initially)
BANKID_TEST=true
FORTNOX_API_KEY="mock"
KIVRA_API_KEY="mock"

# Multi-tenant
DEFAULT_COOPERATIVE_ID="demo-brf"

# Development
NODE_ENV="development"
EOF
            echo -e "    ${GREEN}✓ Created .env.local with defaults${NC}"
        fi
    fi
    echo ""
}

# Function to display available commands
show_commands() {
    echo -e "${BLUE}📚 Quick Commands:${NC}"
    echo -e "  ${GREEN}npm run dev${NC}        - Start development server"
    echo -e "  ${GREEN}npm run build${NC}      - Build for production"
    echo -e "  ${GREEN}npm test${NC}           - Run tests"
    echo -e "  ${GREEN}npm run lint${NC}       - Check code quality"
    echo -e "  ${GREEN}npm run db:migrate${NC} - Run database migrations"
    echo -e "  ${GREEN}npm run db:seed${NC}    - Seed test data"
    echo ""
}

# Function to show specialist agents
show_agents() {
    echo -e "${BLUE}🤖 Available Specialist Agents:${NC}"
    echo -e "  • ${CYAN}database-architect${NC} - Database schema & migrations"
    echo -e "  • ${CYAN}nextjs-developer${NC} - Frontend & UI components"
    echo -e "  • ${CYAN}swedish-law-expert${NC} - BRF legal compliance"
    echo -e "  • ${CYAN}api-developer${NC} - Backend & integrations"
    echo -e "  • ${CYAN}qa-engineer${NC} - Testing & quality"
    echo -e "  • ${CYAN}security-engineer${NC} - Auth & GDPR"
    echo ""
    echo -e "  Use: ${GREEN}Task tool with agent name${NC} for specialized help"
    echo ""
}

# Function to show Swedish terminology reminder
show_swedish_terms() {
    echo -e "${BLUE}🇸🇪 Key Swedish Terms:${NC}"
    echo -e "  • ${CYAN}Bostadsrättsförening${NC} = Housing cooperative (BRF)"
    echo -e "  • ${CYAN}Årsstämma${NC} = Annual meeting"
    echo -e "  • ${CYAN}Styrelse${NC} = Board of directors"
    echo -e "  • ${CYAN}Avgift${NC} = Monthly fee"
    echo -e "  • ${CYAN}Underhållsplan${NC} = Maintenance plan"
    echo -e "  • ${CYAN}Andrahandsuthyrning${NC} = Subletting"
    echo -e "  • ${CYAN}Ekonomisk plan${NC} = Economic plan"
    echo ""
}

# Function to check MCP servers
check_mcp_servers() {
    echo -e "${BLUE}🔌 MCP Servers Status:${NC}"
    
    # Check for Exa MCP
    if [[ -d "exa-mcp-server" ]]; then
        echo -e "  • Exa Search: ${GREEN}Available${NC} - Web search & research"
    fi
    
    # Check for Playwright MCP
    if [[ -d "playwright-mcp" ]]; then
        echo -e "  • Playwright: ${GREEN}Available${NC} - Browser automation"
    fi
    
    # Check for Semgrep MCP
    if [[ -d "semgrep-mcp" ]]; then
        echo -e "  • Semgrep: ${GREEN}Available${NC} - Code analysis"
    fi
    echo ""
}

# Main execution
echo -e "${GREEN}🚀 Initializing BRF Portal Development Environment...${NC}"
echo ""

# Run all checks
show_project_status
check_node_env
check_docker_env
check_database
setup_env_vars
check_mcp_servers
show_commands
show_agents
show_swedish_terms

# Final message
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Environment check complete!${NC}"
echo -e ""
echo -e "${YELLOW}💡 Pro Tips:${NC}"
echo -e "  1. Start with ${CYAN}PHASE 1${NC} tasks in docs/TASKS.md"
echo -e "  2. Use ${CYAN}SQLite${NC} for zero-cost development initially"
echo -e "  3. Mock all paid services (BankID, Fortnox) first"
echo -e "  4. Test multi-tenant isolation thoroughly"
echo -e "  5. Follow Swedish legal requirements strictly"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

exit 0