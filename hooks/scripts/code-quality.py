#!/usr/bin/env python3
"""
Code Quality Hook for BRF Portal
Runs after file writes to ensure code quality and Swedish compliance
"""

import json
import sys
import os
import subprocess
import re

def get_hook_input():
    """Read hook input from stdin"""
    try:
        input_data = sys.stdin.read().strip()
        if input_data:
            return json.loads(input_data)
        return {}
    except:
        return {}

def check_swedish_strings(file_path):
    """Check if Swedish strings are properly internationalized"""
    if not os.path.exists(file_path):
        return []
    
    issues = []
    swedish_patterns = [
        r'"[^"]*(?:å|ä|ö|Å|Ä|Ö)[^"]*"',  # Strings with Swedish characters
        r"'[^']*(?:å|ä|ö|Å|Ä|Ö)[^']*'",   # Single quoted strings
        r'(?:avgift|medlem|styrelse|årsstämma|underhåll)',  # Common Swedish BRF terms
    ]
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for i, line in enumerate(content.split('\n'), 1):
            for pattern in swedish_patterns:
                matches = re.finditer(pattern, line, re.IGNORECASE)
                for match in matches:
                    # Skip if it's already in an i18n function
                    if 't(' not in line[:match.start()] and 'translate(' not in line[:match.start()]:
                        issues.append(f"Line {i}: Swedish text '{match.group()}' should be internationalized")
    except:
        pass
        
    return issues

def check_security_issues(file_path):
    """Check for common security issues"""
    if not os.path.exists(file_path):
        return []
    
    issues = []
    security_patterns = [
        (r'(password|secret|key)\s*[:=]\s*["\'](?!.*process\.env)', 'Hardcoded secret detected'),
        (r'console\.log\([^)]*(?:password|secret|token|key)', 'Logging sensitive information'),
        (r'eval\s*\(', 'Use of eval() function is dangerous'),
        (r'innerHTML\s*=.*\+', 'Potential XSS vulnerability'),
    ]
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for i, line in enumerate(content.split('\n'), 1):
            for pattern, message in security_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    issues.append(f"Line {i}: {message}")
    except:
        pass
        
    return issues

def check_typescript_compliance(file_path):
    """Check TypeScript compliance for BRF Portal"""
    if not file_path.endswith(('.ts', '.tsx')):
        return []
    
    issues = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Check for any usage
        if re.search(r':\s*any\b', content):
            issues.append("Use of 'any' type found - consider specific typing for BRF data structures")
            
        # Check for BRF-specific type compliance
        brf_patterns = [
            (r'cooperative_id', 'Ensure cooperative_id is typed as UUID'),
            (r'member_id', 'Ensure member_id is typed as UUID'),
            (r'apartment_number', 'Ensure apartment_number follows Swedish format'),
        ]
        
        for pattern, suggestion in brf_patterns:
            if re.search(pattern, content) and not re.search(f'{pattern}.*UUID', content):
                issues.append(f"BRF Compliance: {suggestion}")
                
    except:
        pass
        
    return issues

def run_linting(file_path):
    """Run linting if available"""
    issues = []
    
    # Check if we're in a Node.js project
    project_root = os.getcwd()
    package_json = os.path.join(project_root, 'package.json')
    
    if os.path.exists(package_json) and file_path.endswith(('.ts', '.tsx', '.js', '.jsx')):
        try:
            # Try to run ESLint
            result = subprocess.run(['npx', 'eslint', file_path], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode != 0 and result.stdout:
                issues.append(f"ESLint issues:\n{result.stdout}")
        except:
            pass
            
        try:
            # Try to run TypeScript check
            if file_path.endswith(('.ts', '.tsx')):
                result = subprocess.run(['npx', 'tsc', '--noEmit', '--skipLibCheck'], 
                                      capture_output=True, text=True, timeout=15)
                if result.returncode != 0 and result.stderr:
                    issues.append(f"TypeScript issues:\n{result.stderr}")
        except:
            pass
    
    return issues

def main():
    hook_data = get_hook_input()
    
    # Get the file path from the tool arguments
    tool_args = hook_data.get("toolResult", {}).get("arguments", {})
    file_path = tool_args.get("file_path", "")
    
    if not file_path or not os.path.exists(file_path):
        # No file to check, continue
        result = {"continue": True}
        print(json.dumps(result))
        return
    
    all_issues = []
    
    # Run all quality checks
    all_issues.extend(check_swedish_strings(file_path))
    all_issues.extend(check_security_issues(file_path))
    all_issues.extend(check_typescript_compliance(file_path))
    all_issues.extend(run_linting(file_path))
    
    if all_issues:
        # Format issues for display
        formatted_issues = f"\n🔍 Code Quality Issues in {os.path.basename(file_path)}:\n"
        formatted_issues += "\n".join(f"  ⚠️  {issue}" for issue in all_issues)
        formatted_issues += "\n\n💡 Please review and fix these issues for BRF Portal compliance.\n"
        
        result = {
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse", 
                "additionalContext": formatted_issues
            }
        }
    else:
        result = {"continue": True}
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()