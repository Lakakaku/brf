#!/usr/bin/env node

/**
 * BRF Portal Agent CLI
 * 
 * Command-line interface for managing and invoking BRF Portal agents.
 * Integrates with Claude Code's Task tool system.
 */

import { brfAgentRuntime } from './agent-runtime';

interface CLICommand {
  name: string;
  description: string;
  handler: (args: string[]) => void;
}

class BRFAgentCLI {
  private commands: CLICommand[] = [
    {
      name: 'list',
      description: 'List all available agents',
      handler: this.listAgents.bind(this)
    },
    {
      name: 'info',
      description: 'Get information about a specific agent',
      handler: this.getAgentInfo.bind(this)
    },
    {
      name: 'categories', 
      description: 'Show agents organized by category',
      handler: this.showCategories.bind(this)
    },
    {
      name: 'validate',
      description: 'Validate the agents configuration',
      handler: this.validateConfig.bind(this)
    },
    {
      name: 'invoke',
      description: 'Generate Task tool invocation for an agent',
      handler: this.generateInvocation.bind(this)
    },
    {
      name: 'help',
      description: 'Show this help message',
      handler: this.showHelp.bind(this)
    }
  ];

  run(args: string[]): void {
    if (args.length === 0 || args[0] === 'help') {
      this.showHelp();
      return;
    }

    const commandName = args[0];
    const command = this.commands.find(cmd => cmd.name === commandName);

    if (!command) {
      console.error(`Unknown command: ${commandName}`);
      console.error('Use "help" to see available commands.');
      process.exit(1);
    }

    try {
      command.handler(args.slice(1));
    } catch (error) {
      console.error(`Error executing command: ${error}`);
      process.exit(1);
    }
  }

  private showHelp(): void {
    console.log('BRF Portal Agent CLI');
    console.log('===================');
    console.log('');
    console.log('Usage: npx tsx lib/agents/agent-cli.ts <command> [args]');
    console.log('');
    console.log('Commands:');
    this.commands.forEach(cmd => {
      console.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
    });
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx lib/agents/agent-cli.ts list');
    console.log('  npx tsx lib/agents/agent-cli.ts info database-architect');
    console.log('  npx tsx lib/agents/agent-cli.ts invoke project-coordinator "Review current tasks"');
  }

  private listAgents(): void {
    console.log('Available BRF Portal Agents:');
    console.log('============================');
    
    const agents = brfAgentRuntime.listAgents();
    agents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name}`);
      console.log(`   ${agent.description}`);
      console.log('');
    });
  }

  private getAgentInfo(args: string[]): void {
    if (args.length === 0) {
      console.error('Please provide an agent name');
      console.error('Usage: info <agent-name>');
      return;
    }

    const agentName = args[0];
    const agent = brfAgentRuntime.getAgent(agentName);

    if (!agent) {
      console.error(`Agent '${agentName}' not found`);
      console.log('Available agents:');
      brfAgentRuntime.getAvailableAgents().forEach(name => {
        console.log(`  - ${name}`);
      });
      return;
    }

    console.log(`Agent: ${agent.name}`);
    console.log('='.repeat(agent.name.length + 7));
    console.log('');
    console.log(`Description: ${agent.description}`);
    console.log('');
    console.log('Expertise:');
    agent.expertise.forEach(exp => {
      console.log(`  - ${exp}`);
    });
    console.log('');
    console.log(`Available Tools: ${agent.tools.join(', ')}`);
    console.log('');
    console.log('Specialized Prompt:');
    console.log(agent.prompt.trim());
  }

  private showCategories(): void {
    console.log('BRF Portal Agent Categories:');
    console.log('============================');
    console.log('');

    const categories = brfAgentRuntime.getAgentCategories();
    Object.entries(categories).forEach(([category, agents]) => {
      console.log(`📁 ${category}`);
      agents.forEach(agentName => {
        const agent = brfAgentRuntime.getAgent(agentName);
        console.log(`   └── ${agentName} - ${agent?.description || 'No description'}`);
      });
      console.log('');
    });
  }

  private validateConfig(): void {
    console.log('Validating BRF Portal Agents Configuration...');
    console.log('==============================================');
    
    const validation = brfAgentRuntime.validateConfiguration();
    
    if (validation.valid) {
      console.log('✅ Configuration is valid!');
      console.log(`Found ${brfAgentRuntime.getAvailableAgents().length} agents`);
    } else {
      console.log('❌ Configuration has errors:');
      validation.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }
  }

  private generateInvocation(args: string[]): void {
    if (args.length < 2) {
      console.error('Please provide an agent name and task description');
      console.error('Usage: invoke <agent-name> "<task-description>"');
      return;
    }

    const agentName = args[0];
    const taskDescription = args.slice(1).join(' ');

    if (!brfAgentRuntime.hasAgent(agentName)) {
      console.error(`Agent '${agentName}' not found`);
      return;
    }

    const agent = brfAgentRuntime.getAgent(agentName)!;
    const prompt = brfAgentRuntime.generateAgentPrompt(agentName, taskDescription);
    
    console.log('Task Tool Invocation:');
    console.log('====================');
    console.log('');
    console.log('Copy and paste this into Claude Code:');
    console.log('');
    console.log('Task tool with:');
    console.log(`subagent_type: general-purpose`);
    console.log(`description: ${agent.name}: ${taskDescription.substring(0, 50)}${taskDescription.length > 50 ? '...' : ''}`);
    console.log('prompt:');
    console.log('---');
    console.log(prompt);
    console.log('---');
  }
}

// CLI execution
if (require.main === module) {
  const cli = new BRFAgentCLI();
  cli.run(process.argv.slice(2));
}

export { BRFAgentCLI };