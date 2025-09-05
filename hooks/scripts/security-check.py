#!/usr/bin/env python3
"""
Security Check Hook for BRF Portal
Prevents committing sensitive data and ensures security compliance
"""

import json
import sys
import os
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

def check_secrets(content):
    """Check for common secrets and API keys"""
    secret_patterns = [
        (r'sk_test_[a-zA-Z0-9]{24}', 'Stripe test key'),
        (r'sk_live_[a-zA-Z0-9]{24}', 'Stripe live key'),
        (r'pk_test_[a-zA-Z0-9]{24}', 'Stripe publishable test key'),
        (r'pk_live_[a-zA-Z0-9]{24}', 'Stripe publishable live key'),
        (r'[A-Za-z0-9]{32}', 'Potential API key (32 chars)'),
        (r'password\s*[:=]\s*["\'][^"\']{8,}["\']', 'Hardcoded password'),
        (r'secret\s*[:=]\s*["\'][^"\']{8,}["\']', 'Hardcoded secret'),
        (r'token\s*[:=]\s*["\'][^"\']{20,}["\']', 'Hardcoded token'),
        (r'key\s*[:=]\s*["\'][^"\']{20,}["\']', 'Hardcoded key'),
        # Supabase patterns
        (r'eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*', 'JWT token'),
        (r'sbp_[a-f0-9]{40}', 'Supabase project API key'),
        # Swedish BankID test keys (should not be in prod)
        (r'test.*bank.*id.*key', 'BankID test key'),
    ]
    
    detected = []
    for i, line in enumerate(content.split('\n'), 1):
        for pattern, description in secret_patterns:
            matches = re.finditer(pattern, line, re.IGNORECASE)
            for match in matches:
                # Skip if it's clearly an environment variable reference
                if 'process.env' in line or 'env.' in line or '${' in line:
                    continue
                detected.append((i, description, match.group()[:20] + '...'))
    
    return detected

def check_sensitive_data(content):
    """Check for Swedish sensitive data patterns"""
    sensitive_patterns = [
        (r'\d{6}[-\s]?\d{4}', 'Swedish personal ID number (personnummer)'),
        (r'\d{8}[-\s]?\d{4}', 'Swedish organization number'),
        (r'bankgiro\s*[:=]\s*\d+', 'Bankgiro number'),
        (r'plusgiro\s*[:=]\s*\d+', 'Plusgiro number'),
        (r'iban\s*[:=]\s*[A-Z]{2}\d{2}[A-Z0-9]{4}\d{16}', 'IBAN number'),
        (r'bic\s*[:=]\s*[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?', 'BIC/SWIFT code'),
    ]
    
    detected = []
    for i, line in enumerate(content.split('\n'), 1):
        for pattern, description in sensitive_patterns:
            matches = re.finditer(pattern, line, re.IGNORECASE)
            for match in matches:
                # Skip if it's clearly a test value or comment
                if any(test_indicator in line.lower() for test_indicator in ['test', 'mock', 'example', '//', '/*', '#']):
                    continue
                detected.append((i, description, match.group()[:10] + '...'))
    
    return detected

def check_database_credentials(content):
    """Check for database connection strings"""
    db_patterns = [
        (r'postgresql://[^/\s]+:[^@\s]+@[^/\s]+', 'PostgreSQL connection string with credentials'),
        (r'postgres://[^/\s]+:[^@\s]+@[^/\s]+', 'PostgreSQL connection string with credentials'),
        (r'mysql://[^/\s]+:[^@\s]+@[^/\s]+', 'MySQL connection string with credentials'),
        (r'mongodb://[^/\s]+:[^@\s]+@[^/\s]+', 'MongoDB connection string with credentials'),
    ]
    
    detected = []
    for i, line in enumerate(content.split('\n'), 1):
        for pattern, description in db_patterns:
            if re.search(pattern, line):
                # Skip environment variables
                if 'process.env' not in line and 'env.' not in line:
                    detected.append((i, description, 'Connection string found'))
    
    return detected

def main():
    hook_data = get_hook_input()
    
    # Get the tool arguments
    tool_args = hook_data.get("toolInput", {}).get("arguments", {})
    file_path = tool_args.get("file_path", "")
    content = tool_args.get("content", "")
    
    if not content and file_path and os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except:
            content = ""
    
    if not content:
        # No content to check, continue
        result = {"continue": True}
        print(json.dumps(result))
        return
    
    # Run security checks
    secrets = check_secrets(content)
    sensitive_data = check_sensitive_data(content)
    db_credentials = check_database_credentials(content)
    
    all_issues = secrets + sensitive_data + db_credentials
    
    if all_issues:
        # Block the operation and provide detailed feedback
        issue_details = []
        for line_num, description, sample in all_issues:
            issue_details.append(f"  Line {line_num}: {description} ({sample})")
        
        reason = f"""
🚫 SECURITY VIOLATION DETECTED

The following security issues were found:
{chr(10).join(issue_details)}

🔒 BRF Portal Security Policy:
- Never commit API keys, passwords, or tokens
- Use environment variables for sensitive data
- Swedish personal data (personnummer) must be hashed
- Database credentials must use environment variables

💡 To fix:
- Move sensitive values to .env files
- Use process.env.VARIABLE_NAME in code
- Hash or tokenize Swedish personal identifiers
- Review code before committing

Operation blocked to protect BRF Portal security.
        """
        
        result = {
            "decision": "block",
            "reason": reason.strip()
        }
    else:
        result = {"continue": True}
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()