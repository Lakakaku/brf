#!/usr/bin/env node
/**
 * BRF Portal PIECES-MCP Server
 * Manages code snippets across TypeScript/Python multi-language stack
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import path from 'path';

class PiecesMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'brf-pieces-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.dataDir = path.join(process.cwd(), 'mcp-servers', 'pieces-mcp', 'data');
    this.snippetsFile = path.join(this.dataDir, 'snippets.json');
    this.patternsFile = path.join(this.dataDir, 'patterns.json');
    
    this.initStorage();
    this.setupHandlers();
  }

  async initStorage() {
    await fs.ensureDir(this.dataDir);
    
    // Initialize snippets file if it doesn't exist
    if (!await fs.pathExists(this.snippetsFile)) {
      await fs.writeJson(this.snippetsFile, this.getInitialSnippets());
    }
    
    // Initialize patterns file if it doesn't exist
    if (!await fs.pathExists(this.patternsFile)) {
      await fs.writeJson(this.patternsFile, []);
    }
  }

  getInitialSnippets() {
    return [
      {
        id: 1,
        title: 'Swedish Personal ID Validation',
        description: 'Validates Swedish personnummer (YYYYMMDD-XXXX) with Luhn algorithm',
        language: 'typescript',
        category: 'validation',
        tags: ['swedish', 'personnummer', 'validation'],
        code: \`function validateSwedishPersonalId(id: string): boolean {
  // Remove any non-digits
  const cleaned = id.replace(/\\D/g, '');
  
  if (cleaned.length !== 10 && cleaned.length !== 12) {
    return false;
  }
  
  // Use last 10 digits for validation
  const digits = cleaned.slice(-10);
  
  // Luhn algorithm
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let num = parseInt(digits[i]);
    if (i % 2 === 0) {
      num *= 2;
      if (num > 9) num = Math.floor(num / 10) + (num % 10);
    }
    sum += num;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(digits[9]);
}\`,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Swedish Organization Number Validation',
        description: 'Validates Swedish organizational number (XXXXXX-XXXX)',
        language: 'typescript',
        category: 'validation',
        tags: ['swedish', 'orgnummer', 'validation'],
        code: \`function validateSwedishOrgNumber(orgNumber: string): boolean {
  // Remove any non-digits
  const cleaned = orgNumber.replace(/\\D/g, '');
  
  if (cleaned.length !== 10) {
    return false;
  }
  
  // Third digit should be >= 2 for organizations
  if (parseInt(cleaned[2]) < 2) {
    return false;
  }
  
  // Luhn algorithm on last 9 digits
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let num = parseInt(cleaned[i]);
    if (i % 2 === 0) {
      num *= 2;
      if (num > 9) num = Math.floor(num / 10) + (num % 10);
    }
    sum += num;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleaned[9]);
}\`,
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        title: 'Supabase Row Level Security Policy',
        description: 'Multi-tenant RLS policy for BRF cooperative isolation',
        language: 'sql',
        category: 'database',
        tags: ['supabase', 'rls', 'multi-tenant'],
        code: \`-- Enable RLS
ALTER TABLE cooperatives ENABLE ROW LEVEL SECURITY;

-- Policy for cooperative isolation
CREATE POLICY cooperative_isolation ON cooperatives
  USING (id = current_setting('app.current_cooperative')::uuid);

-- Policy for members can only see their cooperative
CREATE POLICY member_cooperative_access ON members
  USING (cooperative_id = current_setting('app.current_cooperative')::uuid);

-- Set current cooperative in session
SELECT set_config('app.current_cooperative', 'your-coop-id-here', true);\`,
        created_at: new Date().toISOString()
      },
      {
        id: 4,
        title: 'BankID Authentication Hook',
        description: 'Next.js API route for BankID authentication',
        language: 'typescript',
        category: 'auth',
        tags: ['bankid', 'nextjs', 'authentication'],
        code: \`import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { personalNumber } = await request.json();
    
    // BankID initiate authentication
    const response = await fetch('https://appapi2.test.bankid.com/rp/v6.0/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalNumber,
        requirement: {
          allowFingerprint: true
        }
      }),
      // Add client certificate for BankID
    });
    
    const data = await response.json();
    
    return NextResponse.json({
      orderRef: data.orderRef,
      autoStartToken: data.autoStartToken
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'BankID authentication failed' },
      { status: 500 }
    );
  }
}\`,
        created_at: new Date().toISOString()
      },
      {
        id: 5,
        title: 'Fortnox API Integration',
        description: 'Python utility for Fortnox API calls with authentication',
        language: 'python',
        category: 'integration',
        tags: ['fortnox', 'api', 'accounting'],
        code: \`import requests
from typing import Dict, Any

class FortnoxAPI:
    def __init__(self, access_token: str, client_secret: str):
        self.access_token = access_token
        self.client_secret = client_secret
        self.base_url = "https://api.fortnox.se/3"
        
    def _headers(self) -> Dict[str, str]:
        return {
            'Access-Token': self.access_token,
            'Client-Secret': self.client_secret,
            'Content-Type': 'application/json'
        }
    
    def get_invoices(self, filters: Dict[str, Any] = None) -> Dict:
        """Fetch invoices from Fortnox"""
        url = f"{self.base_url}/invoices"
        
        response = requests.get(url, headers=self._headers(), params=filters)
        response.raise_for_status()
        
        return response.json()
    
    def create_invoice(self, invoice_data: Dict) -> Dict:
        """Create new invoice in Fortnox"""
        url = f"{self.base_url}/invoices"
        
        response = requests.post(url, headers=self._headers(), json=invoice_data)
        response.raise_for_status()
        
        return response.json()\`,
        created_at: new Date().toISOString()
      }
    ];
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'save_snippet',
          description: 'Save a code snippet with title, description, language, and tags',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Snippet title' },
              description: { type: 'string', description: 'Snippet description' },
              language: { type: 'string', description: 'Programming language' },
              category: { type: 'string', description: 'Snippet category' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Array of tags' },
              code: { type: 'string', description: 'Code content' }
            },
            required: ['title', 'language', 'category', 'code']
          }
        },
        {
          name: 'search_snippets',
          description: 'Search snippets by title, tags, or language',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              language: { type: 'string', description: 'Filter by language' },
              category: { type: 'string', description: 'Filter by category' }
            }
          }
        },
        {
          name: 'get_snippet',
          description: 'Get a specific snippet by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Snippet ID' }
            },
            required: ['id']
          }
        },
        {
          name: 'list_categories',
          description: 'List all available snippet categories',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'get_swedish_patterns',
          description: 'Get Swedish-specific validation and integration patterns',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'list_all_snippets',
          description: 'List all snippets with basic info',
          inputSchema: { type: 'object', properties: {} }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'save_snippet':
            return await this.saveSnippet(args);
          
          case 'search_snippets':
            return await this.searchSnippets(args);
          
          case 'get_snippet':
            return await this.getSnippet(args.id);
          
          case 'list_categories':
            return await this.listCategories();
          
          case 'get_swedish_patterns':
            return await this.getSwedishPatterns();
            
          case 'list_all_snippets':
            return await this.listAllSnippets();
          
          default:
            throw new Error(\`Unknown tool: \${name}\`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: \`Error: \${error.message}\`
            }
          ],
          isError: true
        };
      }
    });
  }

  async saveSnippet(args) {
    const { title, description, language, category, tags, code } = args;
    
    const snippets = await fs.readJson(this.snippetsFile);
    const newId = Math.max(...snippets.map(s => s.id), 0) + 1;
    
    const newSnippet = {
      id: newId,
      title,
      description: description || '',
      language,
      category,
      tags: tags || [],
      code,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    snippets.push(newSnippet);
    await fs.writeJson(this.snippetsFile, snippets, { spaces: 2 });
    
    return {
      content: [
        {
          type: 'text',
          text: \`Snippet saved successfully with ID: \${newId}\`
        }
      ]
    };
  }

  async searchSnippets(args) {
    const { query, language, category } = args;
    const snippets = await fs.readJson(this.snippetsFile);
    
    let results = snippets;
    
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(snippet =>
        snippet.title.toLowerCase().includes(queryLower) ||
        snippet.description.toLowerCase().includes(queryLower) ||
        snippet.tags.some(tag => tag.toLowerCase().includes(queryLower))
      );
    }
    
    if (language) {
      results = results.filter(snippet => snippet.language === language);
    }
    
    if (category) {
      results = results.filter(snippet => snippet.category === category);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results.slice(0, 20), null, 2)
        }
      ]
    };
  }

  async getSnippet(id) {
    const snippets = await fs.readJson(this.snippetsFile);
    const result = snippets.find(snippet => snippet.id === id);
    
    if (!result) {
      throw new Error(\`Snippet with ID \${id} not found\`);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async listCategories() {
    const snippets = await fs.readJson(this.snippetsFile);
    const categories = [...new Set(snippets.map(s => s.category))].sort();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(categories, null, 2)
        }
      ]
    };
  }

  async getSwedishPatterns() {
    const snippets = await fs.readJson(this.snippetsFile);
    
    const swedishPatterns = snippets.filter(snippet => 
      snippet.tags.includes('swedish') || 
      ['validation', 'integration', 'auth', 'database'].includes(snippet.category)
    );
    
    const categorized = {
      validation_patterns: swedishPatterns.filter(p => p.category === 'validation'),
      integration_patterns: swedishPatterns.filter(p => p.category === 'integration'),
      auth_patterns: swedishPatterns.filter(p => p.category === 'auth'),
      database_patterns: swedishPatterns.filter(p => p.category === 'database')
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(categorized, null, 2)
        }
      ]
    };
  }

  async listAllSnippets() {
    const snippets = await fs.readJson(this.snippetsFile);
    
    const summary = snippets.map(snippet => ({
      id: snippet.id,
      title: snippet.title,
      language: snippet.language,
      category: snippet.category,
      tags: snippet.tags,
      created_at: snippet.created_at
    }));
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2)
        }
      ]
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('BRF Portal PIECES-MCP Server running on stdio');
  }
}

const server = new PiecesMCPServer();
server.start().catch(console.error);