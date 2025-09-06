# Supabase MCP Server Setup for BRF Portal

## Prerequisites
1. Create a Supabase project at https://supabase.com
2. Get your project reference ID from the project URL
3. Create a Personal Access Token (PAT)

## Installation Steps

### 1. Create Personal Access Token
- Go to Supabase Dashboard > Settings > Access tokens
- Create a new token named "BRF Portal MCP Server"
- Copy the token (you won't see it again)

### 2. Get Project Reference
- From your Supabase project URL: `https://supabase.com/dashboard/project/[PROJECT_REF]`
- Copy the PROJECT_REF part

### 3. Configure MCP Server
Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "supabase-brf": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref=YOUR_PROJECT_REF_HERE"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "YOUR_PERSONAL_ACCESS_TOKEN_HERE"
      }
    }
  }
}
```

### 4. Test Installation
Run this command to test:
```bash
npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=YOUR_PROJECT_REF
```

## Features for BRF Portal
- Database schema management
- SQL query execution via natural language
- Table creation and migrations
- Data querying and reporting
- Type generation for TypeScript
- Log monitoring

## Security Notes
- Uses read-only mode by default to prevent accidental changes
- Project-scoped access only
- Recommended for development environments