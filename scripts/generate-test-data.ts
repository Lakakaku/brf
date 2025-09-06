#!/usr/bin/env tsx
/**
 * Test Data Generation CLI Tool
 * 
 * Command-line interface for generating bulk test data for the Swedish BRF portal.
 * Supports multiple scenarios, progress reporting, and detailed configuration options.
 * 
 * Usage:
 *   npm run generate:data -- --scenario small_development
 *   npm run generate:data -- --scenario custom --config ./config.json
 *   npm run generate:data -- --help
 */

import { program } from 'commander';
import { createDatabase } from '@/lib/database/index';
import { createSchema, createIndexes, createTriggers } from '@/lib/database/schema';
import { 
  BulkDataGenerator, 
  BulkGenerationConfigBuilder, 
  PREDEFINED_SCENARIOS,
  BulkGenerationConfig,
  BulkGenerationScenario,
  GenerationProgress
} from '@/lib/testing/bulk-generator';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface CLIOptions {
  scenario?: string;
  config?: string;
  database?: string;
  seed?: string;
  batchSize?: number;
  output?: string;
  verbose?: boolean;
  dryRun?: boolean;
  estimate?: boolean;
  list?: boolean;
}

class ProgressReporter {
  private lastUpdate: number = 0;
  private spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private spinnerIndex = 0;

  report(progress: GenerationProgress, verbose: boolean = false): void {
    const now = Date.now();
    
    // Update at most every 500ms unless it's a significant milestone
    if (now - this.lastUpdate < 500 && progress.percentage < 100) {
      return;
    }
    
    this.lastUpdate = now;
    this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerChars.length;
    
    const spinner = progress.percentage < 100 ? this.spinnerChars[this.spinnerIndex] : '✓';
    const percentage = Math.round(progress.percentage);
    const progressBar = this.createProgressBar(percentage);
    
    const line = `${spinner} ${progress.phase} ${progressBar} ${percentage}%`;
    
    if (verbose) {
      const details = [
        `${progress.successCount} success`,
        `${progress.errorsCount} errors`
      ];
      
      if (progress.estimatedTimeRemaining) {
        const eta = Math.round(progress.estimatedTimeRemaining / 1000);
        details.push(`ETA: ${eta}s`);
      }
      
      console.log(`${line} (${details.join(', ')})`);
    } else {
      process.stdout.write(`\r${line}`);
      if (progress.percentage >= 100) {
        console.log(); // New line after completion
      }
    }
  }

  private createProgressBar(percentage: number, width: number = 30): string {
    const filled = Math.round(width * percentage / 100);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  success(message: string): void {
    console.log(chalk.green(`✓ ${message}`));
  }

  error(message: string): void {
    console.log(chalk.red(`✗ ${message}`));
  }

  warning(message: string): void {
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  info(message: string): void {
    console.log(chalk.blue(`ℹ ${message}`));
  }
}

async function listScenarios(): Promise<void> {
  const reporter = new ProgressReporter();
  
  reporter.info('Available predefined scenarios:');
  console.log();
  
  for (const [name, scenario] of Object.entries(PREDEFINED_SCENARIOS)) {
    console.log(chalk.cyan(`  ${name}`));
    console.log(`    ${scenario.description}`);
    console.log(`    Cooperatives: ${scenario.entities.cooperatives}`);
    console.log(`    Members per cooperative: ${scenario.entities.membersPerCooperative.min}-${scenario.entities.membersPerCooperative.max}`);
    
    const estimates = BulkDataGenerator.estimateResources(scenario);
    console.log(`    Estimated time: ~${estimates.estimatedTime} minutes`);
    console.log(`    Estimated memory: ~${estimates.estimatedMemory} MB`);
    console.log(`    Estimated DB size: ~${estimates.estimatedDbSize} MB`);
    console.log();
  }
}

async function estimateScenario(scenarioName: string): Promise<void> {
  const reporter = new ProgressReporter();
  
  const scenario = PREDEFINED_SCENARIOS[scenarioName];
  if (!scenario) {
    reporter.error(`Unknown scenario: ${scenarioName}`);
    process.exit(1);
  }
  
  const estimates = BulkDataGenerator.estimateResources(scenario);
  
  reporter.info(`Estimates for scenario: ${chalk.cyan(scenarioName)}`);
  console.log();
  console.log(`  ${chalk.bold('Data Volume:')}`);
  console.log(`    Cooperatives: ${scenario.entities.cooperatives.toLocaleString()}`);
  console.log(`    Members: ${(scenario.entities.cooperatives * 
    ((scenario.entities.membersPerCooperative.min + scenario.entities.membersPerCooperative.max) / 2)
  ).toLocaleString()}`);
  console.log();
  console.log(`  ${chalk.bold('Resource Requirements:')}`);
  console.log(`    Estimated time: ${estimates.estimatedTime} minutes`);
  console.log(`    Memory usage: ${estimates.estimatedMemory} MB`);
  console.log(`    Database size: ${estimates.estimatedDbSize} MB`);
  console.log();
  console.log(`  ${chalk.bold('Time Range:')}`);
  console.log(`    From: ${scenario.timeRange.startDate}`);
  console.log(`    To: ${scenario.timeRange.endDate}`);
}

async function loadCustomConfig(configPath: string): Promise<BulkGenerationScenario> {
  try {
    const configContent = await readFile(configPath, 'utf8');
    return JSON.parse(configContent);
  } catch (error: any) {
    throw new Error(`Failed to load custom config: ${error.message}`);
  }
}

async function initializeDatabase(dbPath: string): Promise<import('better-sqlite3').Database> {
  const reporter = new ProgressReporter();
  
  try {
    reporter.info(`Initializing database at: ${dbPath}`);
    
    const db = createDatabase(dbPath);
    
    // Create schema if needed
    createSchema(db);
    createIndexes(db);
    createTriggers(db);
    
    reporter.success('Database initialized successfully');
    return db;
    
  } catch (error: any) {
    throw new Error(`Database initialization failed: ${error.message}`);
  }
}

async function generateData(options: CLIOptions): Promise<void> {
  const reporter = new ProgressReporter();
  
  try {
    // Validate options
    if (!options.scenario && !options.config) {
      reporter.error('Either --scenario or --config must be specified');
      process.exit(1);
    }
    
    // Load scenario
    let scenario: BulkGenerationScenario;
    if (options.config) {
      scenario = await loadCustomConfig(options.config);
      reporter.info(`Loaded custom configuration from: ${options.config}`);
    } else {
      if (!PREDEFINED_SCENARIOS[options.scenario!]) {
        reporter.error(`Unknown scenario: ${options.scenario}`);
        reporter.info('Run with --list to see available scenarios');
        process.exit(1);
      }
      scenario = PREDEFINED_SCENARIOS[options.scenario!];
      reporter.info(`Using predefined scenario: ${chalk.cyan(options.scenario!)}`);
    }
    
    // Setup database
    const dbPath = options.database || join(process.cwd(), 'test_data.db');
    const db = await initializeDatabase(dbPath);
    
    // Build configuration
    const configBuilder = new BulkGenerationConfigBuilder()
      .customScenario(scenario)
      .database(db);
    
    if (options.seed) {
      configBuilder.seed(options.seed);
      reporter.info(`Using seed: ${options.seed}`);
    }
    
    if (options.batchSize) {
      configBuilder.batchSize(options.batchSize);
      reporter.info(`Using batch size: ${options.batchSize}`);
    }
    
    if (options.output) {
      configBuilder.outputPath(options.output);
      reporter.info(`Report will be saved to: ${options.output}`);
    }
    
    const config = configBuilder.build();
    
    // Show estimates
    const estimates = BulkDataGenerator.estimateResources(scenario);
    reporter.info(`Estimated generation time: ~${estimates.estimatedTime} minutes`);
    reporter.info(`Estimated memory usage: ~${estimates.estimatedMemory} MB`);
    
    if (options.dryRun) {
      reporter.info('Dry run completed - no data was generated');
      db.close();
      return;
    }
    
    // Confirm for large datasets
    if (estimates.estimatedTime > 10 && !process.env.CI) {
      reporter.warning(`This will take approximately ${estimates.estimatedTime} minutes to complete.`);
      // In a real implementation, you'd add a confirmation prompt here
    }
    
    // Generate data
    reporter.info('Starting data generation...');
    console.log();
    
    const generator = new BulkDataGenerator(config);
    const startTime = Date.now();
    
    const report = await generator.generate((progress: GenerationProgress) => {
      reporter.report(progress, options.verbose || false);
    });
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log();
    reporter.success(`Data generation completed in ${duration} seconds`);
    
    // Display summary
    console.log();
    console.log(chalk.bold('Generation Summary:'));
    console.log(`  Scenario: ${report.scenario}`);
    console.log(`  Success: ${report.executionSummary.success ? '✓' : '✗'}`);
    console.log(`  Total errors: ${report.executionSummary.errorCount}`);
    console.log();
    
    console.log(chalk.bold('Entity Results:'));
    for (const [entity, result] of Object.entries(report.entityResults)) {
      console.log(`  ${entity}: ${result.generated}/${result.requested} generated, ${result.inserted} inserted`);
      if (result.errors > 0) {
        console.log(`    ${chalk.red(`${result.errors} errors`)}`);
      }
    }
    
    console.log();
    console.log(chalk.bold('Performance:'));
    console.log(`  Peak memory usage: ${report.performance.peakMemoryUsage} MB`);
    console.log(`  Average insertion rate: ${Math.round(report.performance.averageInsertionRate)} records/second`);
    
    if (Object.keys(report.statistics.cooperativeDistribution).length > 0) {
      console.log();
      console.log(chalk.bold('Distribution:'));
      console.log('  Cities:', Object.keys(report.statistics.cooperativeDistribution).join(', '));
    }
    
    if (options.output || config.output.generateReport) {
      const reportPath = options.output || 'generation_report.json';
      await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
      reporter.success(`Detailed report saved to: ${reportPath}`);
    }
    
    db.close();
    
  } catch (error: any) {
    reporter.error(`Generation failed: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function main(): Promise<void> {
  program
    .name('generate-test-data')
    .description('Generate bulk test data for Swedish BRF portal')
    .version('1.0.0');

  program
    .option('-s, --scenario <name>', 'predefined scenario to use')
    .option('-c, --config <path>', 'custom configuration file path')
    .option('-d, --database <path>', 'database file path (default: test_data.db)')
    .option('--seed <seed>', 'random seed for reproducible results')
    .option('-b, --batch-size <size>', 'batch size for bulk operations', parseInt)
    .option('-o, --output <path>', 'output path for generation report')
    .option('-v, --verbose', 'verbose output with detailed progress')
    .option('--dry-run', 'validate configuration without generating data')
    .option('-e, --estimate', 'show resource estimates for scenario')
    .option('-l, --list', 'list available predefined scenarios')
    .action(async (options: CLIOptions) => {
      if (options.list) {
        await listScenarios();
      } else if (options.estimate && options.scenario) {
        await estimateScenario(options.scenario);
      } else {
        await generateData(options);
      }
    });

  program
    .command('scenarios')
    .description('list available predefined scenarios')
    .action(listScenarios);

  program
    .command('estimate <scenario>')
    .description('show resource estimates for a scenario')
    .action(estimateScenario);

  program
    .command('config-template')
    .description('generate a custom configuration template')
    .option('-o, --output <path>', 'output path for template (default: config-template.json)')
    .action(async (options: { output?: string }) => {
      const templatePath = options.output || 'config-template.json';
      const template = {
        name: 'Custom Scenario',
        description: 'Description of your custom test scenario',
        entities: {
          cooperatives: 10,
          membersPerCooperative: { min: 15, max: 50 },
          apartmentsPerCooperative: { min: 12, max: 40 },
          invoicesPerMonth: { min: 5, max: 20 },
          casesPerMonth: { min: 1, max: 8 },
          boardMeetingsPerYear: 8
        },
        timeRange: {
          startDate: '2023-01-01',
          endDate: '2024-12-31'
        },
        cooperativeConfig: {
          preferredCities: ['Stockholm', 'Göteborg', 'Malmö'],
          sizeDistribution: { small: 0.4, medium: 0.4, large: 0.15, extraLarge: 0.05 },
          financialRealism: 'high'
        },
        memberConfig: {
          contactCompleteness: { phone: 0.85, recentLogin: 0.65 }
        },
        realism: {
          geographicDistribution: 'realistic',
          financialRealism: 'high',
          activityRealism: 'high'
        }
      };
      
      await writeFile(templatePath, JSON.stringify(template, null, 2), 'utf8');
      console.log(chalk.green(`✓ Configuration template saved to: ${templatePath}`));
      console.log(chalk.blue('ℹ Edit the template and use it with --config option'));
    });

  await program.parseAsync();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nReceived SIGINT. Gracefully shutting down...'));
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}