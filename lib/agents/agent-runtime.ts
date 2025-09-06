/**
 * BRF Portal Agent Runtime System
 * 
 * This system enables the specialized agents defined in agents-config.yaml
 * to be invoked through Claude Code's Task tool.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface AgentConfig {
  name: string;
  description: string;
  expertise: string[];
  prompt: string;
  tools: string[];
}

export interface AgentsConfig {
  agents: Record<string, AgentConfig>;
  usage: {
    description: string;
    workflow: string;
  };
}

export class BRFAgentRuntime {
  private agentsConfig: AgentsConfig | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'agents-config.yaml');
  }

  /**
   * Load and parse the agents configuration
   */
  loadAgentsConfig(): AgentsConfig {
    try {
      if (this.agentsConfig) {
        return this.agentsConfig;
      }

      const configFile = fs.readFileSync(this.configPath, 'utf8');
      this.agentsConfig = yaml.load(configFile) as AgentsConfig;
      
      if (!this.agentsConfig || !this.agentsConfig.agents) {
        throw new Error('Invalid agents configuration: missing agents section');
      }

      return this.agentsConfig;
    } catch (error) {
      throw new Error(`Failed to load agents configuration: ${error}`);
    }
  }

  /**
   * Get all available agent names
   */
  getAvailableAgents(): string[] {
    const config = this.loadAgentsConfig();
    return Object.keys(config.agents);
  }

  /**
   * Get specific agent configuration
   */
  getAgent(agentName: string): AgentConfig | null {
    const config = this.loadAgentsConfig();
    return config.agents[agentName] || null;
  }

  /**
   * Validate if an agent exists
   */
  hasAgent(agentName: string): boolean {
    return this.getAgent(agentName) !== null;
  }

  /**
   * Generate the complete prompt for an agent invocation
   */
  generateAgentPrompt(agentName: string, userTask: string): string {
    const agent = this.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent '${agentName}' not found`);
    }

    return `${agent.prompt}

CURRENT TASK: ${userTask}

You are the ${agent.name} agent with the following expertise:
${agent.expertise.map(exp => `- ${exp}`).join('\n')}

Available tools for this task: ${agent.tools.join(', ')}

Please complete the specified task using your expertise and available tools. Focus on the Swedish BRF context and follow the zero-cost development philosophy where applicable.`;
  }

  /**
   * Get agent description for Task tool integration
   */
  getAgentDescription(agentName: string): string {
    const agent = this.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent '${agentName}' not found`);
    }
    return agent.description;
  }

  /**
   * List all agents with their descriptions
   */
  listAgents(): Array<{ name: string; description: string; expertise: string[] }> {
    const config = this.loadAgentsConfig();
    return Object.entries(config.agents).map(([name, agent]) => ({
      name,
      description: agent.description,
      expertise: agent.expertise
    }));
  }

  /**
   * Validate agent configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const config = this.loadAgentsConfig();
      
      // Check if agents section exists
      if (!config.agents || Object.keys(config.agents).length === 0) {
        errors.push('No agents defined in configuration');
      }

      // Validate each agent
      Object.entries(config.agents).forEach(([name, agent]) => {
        if (!agent.name || agent.name.trim() === '') {
          errors.push(`Agent '${name}' missing name`);
        }
        if (!agent.description || agent.description.trim() === '') {
          errors.push(`Agent '${name}' missing description`);
        }
        if (!agent.prompt || agent.prompt.trim() === '') {
          errors.push(`Agent '${name}' missing prompt`);
        }
        if (!Array.isArray(agent.expertise) || agent.expertise.length === 0) {
          errors.push(`Agent '${name}' missing or invalid expertise array`);
        }
        if (!Array.isArray(agent.tools) || agent.tools.length === 0) {
          errors.push(`Agent '${name}' missing or invalid tools array`);
        }
      });

    } catch (error) {
      errors.push(`Configuration parsing error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get agent categories for organization
   */
  getAgentCategories(): Record<string, string[]> {
    const categories: Record<string, string[]> = {
      'Infrastructure & DevOps': ['infrastructure-architect', 'database-architect'],
      'Swedish Domain Experts': ['swedish-law-expert', 'brf-operations-expert', 'swedish-financial-expert'],
      'AI & Document Processing': ['ai-document-processor'],
      'Frontend Specialists': ['nextjs-developer', 'mobile-developer'],
      'Backend & Integration': ['api-developer', 'fortnox-integration-specialist'],
      'Testing & Quality': ['qa-engineer', 'security-engineer'],
      'Specialized Features': ['energy-optimization-expert', 'procurement-specialist'],
      'Project Management': ['project-coordinator'],
      'Documentation': ['technical-writer']
    };

    // Filter categories to only include agents that actually exist
    const availableAgents = this.getAvailableAgents();
    const filteredCategories: Record<string, string[]> = {};

    Object.entries(categories).forEach(([category, agents]) => {
      const existingAgents = agents.filter(agent => availableAgents.includes(agent));
      if (existingAgents.length > 0) {
        filteredCategories[category] = existingAgents;
      }
    });

    return filteredCategories;
  }
}

// Export singleton instance
export const brfAgentRuntime = new BRFAgentRuntime();

// Export types for use in other modules
export type { AgentConfig, AgentsConfig };