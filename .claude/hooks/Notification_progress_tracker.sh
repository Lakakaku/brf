#!/bin/bash
# Notification Hook - Progress Tracking for BRF Portal
# Updates TASKS.md and tracks development progress

# Get notification type and content
NOTIFICATION_TYPE="${1:-}"
NOTIFICATION_CONTENT="${2:-}"

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Path to TASKS.md
TASKS_FILE="docs/TASKS.md"

# Function to update task status in TASKS.md
update_task_status() {
    local task_description="$1"
    local new_status="$2"  # "completed" or "in_progress"
    
    if [[ -f "$TASKS_FILE" ]]; then
        # Update checkbox based on status
        if [[ "$new_status" == "completed" ]]; then
            # Change [ ] to [x]
            sed -i.bak "/$task_description/s/\[ \]/[x]/" "$TASKS_FILE" 2>/dev/null || \
            sed -i "" "/$task_description/s/\[ \]/[x]/" "$TASKS_FILE" 2>/dev/null
            
            echo -e "${GREEN}✓ Task marked complete: $task_description${NC}"
        elif [[ "$new_status" == "in_progress" ]]; then
            # Add a marker for in-progress (could use [~] or leave as [ ])
            echo -e "${YELLOW}⏳ Task in progress: $task_description${NC}"
        fi
    fi
}

# Function to count progress
count_progress() {
    if [[ -f "$TASKS_FILE" ]]; then
        local completed=$(grep -c "\[x\]" "$TASKS_FILE" 2>/dev/null || echo 0)
        local pending=$(grep -c "\[ \]" "$TASKS_FILE" 2>/dev/null || echo 0)
        local total=$((completed + pending))
        
        if [[ $total -gt 0 ]]; then
            local percentage=$((completed * 100 / total))
            echo -e "${BLUE}📊 Overall Progress: ${GREEN}$completed/$total${NC} tasks (${percentage}%)"
            
            # Create progress bar
            local bar_length=20
            local filled=$((percentage * bar_length / 100))
            local empty=$((bar_length - filled))
            
            echo -n "   ["
            for ((i=0; i<filled; i++)); do echo -n "█"; done
            for ((i=0; i<empty; i++)); do echo -n "░"; done
            echo "] ${percentage}%"
        fi
    fi
}

# Function to identify current phase
get_current_phase() {
    if [[ -f "$TASKS_FILE" ]]; then
        # Find the first phase with uncompleted tasks
        local current_phase=""
        local phase_num=1
        
        while grep -q "^## PHASE $phase_num" "$TASKS_FILE"; do
            # Check if this phase has uncompleted tasks
            local phase_section=$(sed -n "/^## PHASE $phase_num/,/^## PHASE $((phase_num + 1))/p" "$TASKS_FILE")
            
            if echo "$phase_section" | grep -q "\[ \]"; then
                current_phase="PHASE $phase_num"
                break
            fi
            phase_num=$((phase_num + 1))
        done
        
        if [[ -n "$current_phase" ]]; then
            local phase_name=$(grep "^## $current_phase" "$TASKS_FILE" | head -1)
            echo -e "${CYAN}📍 Current Phase: $phase_name${NC}"
            
            # Count tasks in current phase
            local phase_section=$(sed -n "/^## $current_phase/,/^## PHASE/p" "$TASKS_FILE")
            local phase_completed=$(echo "$phase_section" | grep -c "\[x\]" || echo 0)
            local phase_pending=$(echo "$phase_section" | grep -c "\[ \]" || echo 0)
            
            echo -e "   Phase Progress: ${GREEN}$phase_completed${NC} done, ${YELLOW}$phase_pending${NC} remaining"
        fi
    fi
}

# Function to detect milestones
check_milestones() {
    if [[ -f "$TASKS_FILE" ]]; then
        # Check for phase completions
        local phase_num=1
        while grep -q "^## PHASE $phase_num" "$TASKS_FILE"; do
            local phase_section=$(sed -n "/^## PHASE $phase_num/,/^## PHASE $((phase_num + 1))/p" "$TASKS_FILE")
            local pending=$(echo "$phase_section" | grep -c "\[ \]" || echo 0)
            
            if [[ $pending -eq 0 ]] && [[ -n "$phase_section" ]]; then
                local phase_name=$(echo "$phase_section" | grep "^## PHASE" | head -1 | cut -d: -f2)
                echo -e "${GREEN}🎉 MILESTONE: Phase $phase_num$phase_name completed!${NC}"
            fi
            
            phase_num=$((phase_num + 1))
        done
    fi
}

# Function to suggest next tasks
suggest_next_tasks() {
    if [[ -f "$TASKS_FILE" ]]; then
        echo -e "${MAGENTA}📋 Next Tasks to Work On:${NC}"
        
        # Find tasks marked as FIRST, SECOND, etc that aren't completed
        local priority_tasks=$(grep -E "^\[[ ]\].*\*\*(FIRST|SECOND|THIRD)\*\*" "$TASKS_FILE" | head -3)
        
        if [[ -n "$priority_tasks" ]]; then
            echo "$priority_tasks" | while IFS= read -r task; do
                # Extract task description and priority
                local priority=$(echo "$task" | grep -oE "\*\*(FIRST|SECOND|THIRD)\*\*" | tr -d '*')
                local description=$(echo "$task" | sed 's/.*\] //' | cut -d'*' -f3- | sed 's/^ *//')
                echo -e "   ${YELLOW}[$priority]${NC} $description"
            done
        else
            # If no priority tasks, show next 3 uncompleted tasks
            grep "^\[ \]" "$TASKS_FILE" | head -3 | while IFS= read -r task; do
                local description=$(echo "$task" | sed 's/\[ \] //')
                echo -e "   • $description"
            done
        fi
    fi
}

# Function to track parallel work groups
track_parallel_work() {
    if [[ -f "$TASKS_FILE" ]]; then
        # Find active parallel groups
        local parallel_groups=$(grep -oE "\[PARALLEL-GROUP-[A-Z]\]" "$TASKS_FILE" | sort -u)
        
        if [[ -n "$parallel_groups" ]]; then
            echo -e "${BLUE}🔀 Parallel Work Groups:${NC}"
            
            echo "$parallel_groups" | while IFS= read -r group; do
                local group_name=$(echo "$group" | tr -d '[]')
                local total=$(grep -c "$group" "$TASKS_FILE")
                local completed=$(grep "$group" "$TASKS_FILE" | grep -c "\[x\]")
                local pending=$((total - completed))
                
                if [[ $pending -gt 0 ]]; then
                    echo -e "   $group_name: ${GREEN}$completed/$total${NC} complete"
                fi
            done
        fi
    fi
}

# Function to log activity
log_activity() {
    local activity="$1"
    local log_file=".claude/activity.log"
    
    mkdir -p .claude
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $activity" >> "$log_file"
}

# Main notification handling
case "$NOTIFICATION_TYPE" in
    "task_completed")
        echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}                    ✓ Task Completed${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
        
        update_task_status "$NOTIFICATION_CONTENT" "completed"
        log_activity "Task completed: $NOTIFICATION_CONTENT"
        
        echo ""
        count_progress
        echo ""
        get_current_phase
        echo ""
        check_milestones
        echo ""
        suggest_next_tasks
        echo ""
        track_parallel_work
        ;;
        
    "task_started")
        echo -e "${YELLOW}⏳ Task Started: $NOTIFICATION_CONTENT${NC}"
        update_task_status "$NOTIFICATION_CONTENT" "in_progress"
        log_activity "Task started: $NOTIFICATION_CONTENT"
        ;;
        
    "phase_completed")
        echo -e "${GREEN}🎊 PHASE COMPLETED! $NOTIFICATION_CONTENT${NC}"
        log_activity "Phase completed: $NOTIFICATION_CONTENT"
        
        # Show overall progress
        count_progress
        
        # Suggest next phase
        echo ""
        echo -e "${CYAN}Ready to start next phase!${NC}"
        suggest_next_tasks
        ;;
        
    "milestone")
        echo -e "${MAGENTA}🏆 MILESTONE REACHED: $NOTIFICATION_CONTENT${NC}"
        log_activity "Milestone: $NOTIFICATION_CONTENT"
        ;;
        
    "agent_work")
        echo -e "${CYAN}🤖 Agent Working: $NOTIFICATION_CONTENT${NC}"
        log_activity "Agent: $NOTIFICATION_CONTENT"
        ;;
        
    "test_result")
        if [[ "$NOTIFICATION_CONTENT" == *"passed"* ]]; then
            echo -e "${GREEN}✓ Tests Passed${NC}"
        else
            echo -e "${RED}✗ Tests Failed${NC}"
        fi
        log_activity "Test result: $NOTIFICATION_CONTENT"
        ;;
        
    "deployment")
        echo -e "${BLUE}🚀 Deployment: $NOTIFICATION_CONTENT${NC}"
        log_activity "Deployment: $NOTIFICATION_CONTENT"
        ;;
        
    *)
        # Default progress check
        echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${BLUE}                  📊 Progress Update${NC}"
        echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
        echo ""
        
        count_progress
        echo ""
        get_current_phase
        echo ""
        suggest_next_tasks
        echo ""
        track_parallel_work
        
        # Show Swedish compliance reminder periodically
        if [[ $(date +%M) -eq 0 ]] || [[ $(date +%M) -eq 30 ]]; then
            echo ""
            echo -e "${YELLOW}🇸🇪 Remember Swedish Compliance:${NC}"
            echo "   • Bostadsrättslagen for governance"
            echo "   • K2/K3 accounting standards"
            echo "   • GDPR for personal data"
            echo "   • 25% VAT (moms) for invoices"
        fi
        ;;
esac

# Generate activity report if requested
if [[ "$NOTIFICATION_TYPE" == "report" ]]; then
    echo -e "${CYAN}📈 Activity Report:${NC}"
    
    if [[ -f ".claude/activity.log" ]]; then
        echo "Recent activities:"
        tail -10 .claude/activity.log | while IFS= read -r line; do
            echo "  $line"
        done
    fi
    
    echo ""
    echo -e "${BLUE}Task Summary:${NC}"
    count_progress
    
    echo ""
    echo -e "${BLUE}Phase Status:${NC}"
    get_current_phase
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

exit 0