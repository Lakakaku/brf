#!/usr/bin/env node
/**
 * BRF Portal REF-MCP Server
 * Manages complex codebase relationships across Next.js, Python AI services, and database schemas
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
import { glob } from 'glob';

class RefMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'brf-ref-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'analyze_component_relationships',
          description: 'Analyze relationships between React components and database schemas',
          inputSchema: {
            type: 'object',
            properties: {
              component_path: {
                type: 'string',
                description: 'Path to React component to analyze'
              }
            },
            required: ['component_path']
          }
        },
        {
          name: 'find_api_usage',
          description: 'Find all usages of API endpoints across frontend and backend',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: {
                type: 'string',
                description: 'API endpoint to search for (e.g., /api/members)'
              }
            },
            required: ['endpoint']
          }
        },
        {
          name: 'trace_data_flow',
          description: 'Trace data flow from database to frontend components',
          inputSchema: {
            type: 'object',
            properties: {
              table_name: {
                type: 'string',
                description: 'Database table name to trace'
              }
            },
            required: ['table_name']
          }
        },
        {
          name: 'find_dependencies',
          description: 'Find all dependencies and imports for a given file',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'File path to analyze dependencies'
              }
            },
            required: ['file_path']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'analyze_component_relationships':
            return await this.analyzeComponentRelationships(args.component_path);
          
          case 'find_api_usage':
            return await this.findApiUsage(args.endpoint);
          
          case 'trace_data_flow':
            return await this.traceDataFlow(args.table_name);
          
          case 'find_dependencies':
            return await this.findDependencies(args.file_path);
          
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

  async analyzeComponentRelationships(componentPath) {
    try {
      const fullPath = path.resolve(componentPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Simple analysis - look for imports, database queries, API calls
      const imports = content.match(/import.*from.*['"](.*)['"];/g) || [];
      const apiCalls = content.match(/(?:fetch|axios)\\(['"\`]([^'"\`]*)/g) || [];
      const dbQueries = content.match(/(?:supabase|db)\\.[a-zA-Z]+\\(['"]([^'"]*)/g) || [];
      
      const analysis = {
        file: componentPath,
        imports: imports.map(imp => imp.match(/from.*['"](.*)['"];/)?.[1]).filter(Boolean),
        api_calls: apiCalls.map(call => call.match(/['"\`]([^'"\`]*)/)?.[1]).filter(Boolean),
        database_queries: dbQueries.map(query => query.match(/['"]([^'"]*)/)?.[1]).filter(Boolean),
        relationships: []
      };

      // Find related components
      const srcDir = path.join(process.cwd(), 'src');
      if (fs.existsSync(srcDir)) {
        const allFiles = await glob('**/*.{tsx,ts,js,jsx}', { cwd: srcDir });
        
        for (const file of allFiles) {
          const filePath = path.join(srcDir, file);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          
          // Check if this file imports our component
          const componentName = path.basename(componentPath, path.extname(componentPath));
          if (fileContent.includes(componentName) && filePath !== fullPath) {
            analysis.relationships.push({
              type: 'imported_by',
              file: file,
              relationship: 'component_usage'
            });
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(analysis, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(\`Failed to analyze component relationships: \${error.message}\`);
    }
  }

  async findApiUsage(endpoint) {
    try {
      const results = [];
      const searchDirs = ['src', 'pages', 'app', 'lib'];
      
      for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
          const files = await glob('**/*.{tsx,ts,js,jsx}', { cwd: dir });
          
          for (const file of files) {
            const filePath = path.join(dir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            
            if (content.includes(endpoint)) {
              // Find the specific lines
              const lines = content.split('\\n');
              const matchingLines = lines
                .map((line, index) => ({ line: line.trim(), number: index + 1 }))
                .filter(({ line }) => line.includes(endpoint));
              
              results.push({
                file: filePath,
                matches: matchingLines
              });
            }
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              endpoint,
              usage_count: results.length,
              files: results
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(\`Failed to find API usage: \${error.message}\`);
    }
  }

  async traceDataFlow(tableName) {
    try {
      const dataFlow = {
        table: tableName,
        database_operations: [],
        api_endpoints: [],
        components: [],
        flow_chain: []
      };

      // Search for database operations
      const searchDirs = ['src', 'lib', 'pages', 'app'];
      
      for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
          const files = await glob('**/*.{tsx,ts,js,jsx}', { cwd: dir });
          
          for (const file of files) {
            const filePath = path.join(dir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            
            // Look for table references
            const tableRefs = [
              \`from('\${tableName}')\`,
              \`table('\${tableName}')\`,
              \`"\${tableName}"\`,
              \`'\${tableName}'\`
            ];
            
            for (const ref of tableRefs) {
              if (content.includes(ref)) {
                const fileType = file.includes('/api/') ? 'api' : 
                              file.includes('/components/') ? 'component' : 'other';
                
                dataFlow[fileType === 'api' ? 'api_endpoints' : 
                       fileType === 'component' ? 'components' : 'database_operations'].push({
                  file: filePath,
                  type: fileType
                });
                break;
              }
            }
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(dataFlow, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(\`Failed to trace data flow: \${error.message}\`);
    }
  }

  async findDependencies(filePath) {
    try {
      const fullPath = path.resolve(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Extract imports and dependencies
      const imports = [];
      const requireStatements = [];
      const dynamicImports = [];
      
      // ES6 imports
      const importMatches = content.match(/import.*from.*['"]([^'"]+)['"];?/g) || [];
      for (const match of importMatches) {
        const moduleName = match.match(/from.*['"]([^'"]+)['"];?/)?.[1];
        if (moduleName) {
          imports.push({
            type: 'es6_import',
            module: moduleName,
            statement: match.trim()
          });
        }
      }

      // CommonJS requires
      const requireMatches = content.match(/require\\(['"]([^'"]+)['"]\\)/g) || [];
      for (const match of requireMatches) {
        const moduleName = match.match(/require\\(['"]([^'"]+)['"]\\)/)?.[1];
        if (moduleName) {
          requireStatements.push({
            type: 'commonjs_require',
            module: moduleName,
            statement: match
          });
        }
      }

      // Dynamic imports
      const dynamicMatches = content.match(/import\\(['"]([^'"]+)['"]\\)/g) || [];
      for (const match of dynamicMatches) {
        const moduleName = match.match(/import\\(['"]([^'"]+)['"]\\)/)?.[1];
        if (moduleName) {
          dynamicImports.push({
            type: 'dynamic_import',
            module: moduleName,
            statement: match
          });
        }
      }

      const dependencies = {
        file: filePath,
        total_dependencies: imports.length + requireStatements.length + dynamicImports.length,
        es6_imports: imports,
        commonjs_requires: requireStatements,
        dynamic_imports: dynamicImports,
        external_modules: [],
        local_modules: []
      };

      // Categorize dependencies
      const allModules = [...imports, ...requireStatements, ...dynamicImports];
      for (const dep of allModules) {
        if (dep.module.startsWith('.') || dep.module.startsWith('/')) {
          dependencies.local_modules.push(dep.module);
        } else {
          dependencies.external_modules.push(dep.module);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(dependencies, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(\`Failed to find dependencies: \${error.message}\`);
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('BRF Portal REF-MCP Server running on stdio');
  }
}

const server = new RefMCPServer();
server.start().catch(console.error);