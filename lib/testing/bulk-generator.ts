/**
 * Bulk Data Generation System
 * 
 * Comprehensive system for generating large volumes of test data
 * with configurable scenarios, performance optimization, and
 * realistic Swedish BRF data patterns.
 */

import Database from 'better-sqlite3';
import { 
  BaseDataGenerator, 
  GenerationOptions, 
  GenerationResult, 
  GenerationProgress,
  DatabaseBulkInserter 
} from './generators/base-generator';
import { CooperativeDataGenerator, CooperativeData, CooperativeGenerationOptions } from './generators/cooperative-generator';
import { MemberDataGenerator, MemberData, MemberGenerationOptions } from './generators/member-generator';

export interface BulkGenerationConfig {
  // Target database
  database?: Database.Database;
  databasePath?: string;
  
  // Generation seed for reproducibility
  seed?: string;
  
  // Scenario configuration
  scenario: BulkGenerationScenario;
  
  // Performance settings
  performance: {
    batchSize: number;
    maxConcurrentOperations: number;
    memoryThreshold: number; // MB
    progressReportInterval: number; // ms
  };
  
  // Output options
  output: {
    generateReport: boolean;
    reportPath?: string;
    exportData: boolean;
    exportFormat: 'json' | 'csv' | 'sql';
    exportPath?: string;
  };
  
  // Validation and cleanup
  validation: {
    validateData: boolean;
    skipInvalid: boolean;
    cleanupOnError: boolean;
  };
}

export interface BulkGenerationScenario {
  name: string;
  description: string;
  
  // Entity counts
  entities: {
    cooperatives: number;
    membersPerCooperative: { min: number; max: number };
    apartmentsPerCooperative: { min: number; max: number };
    invoicesPerMonth: { min: number; max: number };
    casesPerMonth: { min: number; max: number };
    boardMeetingsPerYear: number;
  };
  
  // Time range
  timeRange: {
    startDate: string;
    endDate: string;
  };
  
  // Cooperative distribution
  cooperativeConfig: CooperativeGenerationOptions;
  memberConfig: Partial<MemberGenerationOptions>;
  
  // Data realism settings
  realism: {
    geographicDistribution: 'concentrated' | 'distributed' | 'realistic';
    financialRealism: 'high' | 'medium' | 'low';
    activityRealism: 'high' | 'medium' | 'low';
  };
}

export interface BulkGenerationReport {
  scenario: string;
  executionSummary: {
    startTime: Date;
    endTime: Date;
    totalExecutionTime: number; // ms
    success: boolean;
    errorCount: number;
  };
  
  entityResults: {
    [entityType: string]: {
      requested: number;
      generated: number;
      inserted: number;
      errors: number;
      executionTime: number;
    };
  };
  
  performance: {
    peakMemoryUsage: number; // MB
    averageBatchTime: number; // ms
    totalDatabaseOperations: number;
    averageInsertionRate: number; // records/second
  };
  
  validation: {
    totalValidated: number;
    validationErrors: number;
    dataQualityScore: number; // 0-100
  };
  
  statistics: {
    cooperativeDistribution: { [city: string]: number };
    roleDistribution: { [role: string]: number };
    sizeDistribution: { [category: string]: number };
  };
}

/**
 * Pre-defined scenarios for common testing needs
 */
export const PREDEFINED_SCENARIOS: { [name: string]: BulkGenerationScenario } = {
  'small_development': {
    name: 'Small Development Environment',
    description: 'Minimal data set for basic development and testing',
    entities: {
      cooperatives: 3,
      membersPerCooperative: { min: 10, max: 25 },
      apartmentsPerCooperative: { min: 8, max: 20 },
      invoicesPerMonth: { min: 5, max: 15 },
      casesPerMonth: { min: 1, max: 5 },
      boardMeetingsPerYear: 6
    },
    timeRange: {
      startDate: '2023-01-01',
      endDate: '2024-12-31'
    },
    cooperativeConfig: {
      preferredCities: ['Stockholm', 'Göteborg'],
      sizeDistribution: { small: 0.7, medium: 0.3, large: 0, extraLarge: 0 },
      financialRealism: 'medium'
    },
    memberConfig: {
      contactCompleteness: { phone: 0.7, recentLogin: 0.5 }
    },
    realism: {
      geographicDistribution: 'concentrated',
      financialRealism: 'medium',
      activityRealism: 'medium'
    }
  },

  'medium_testing': {
    name: 'Medium Testing Environment',
    description: 'Moderate data set for integration testing and performance validation',
    entities: {
      cooperatives: 15,
      membersPerCooperative: { min: 20, max: 80 },
      apartmentsPerCooperative: { min: 15, max: 60 },
      invoicesPerMonth: { min: 10, max: 50 },
      casesPerMonth: { min: 2, max: 12 },
      boardMeetingsPerYear: 8
    },
    timeRange: {
      startDate: '2022-01-01',
      endDate: '2024-12-31'
    },
    cooperativeConfig: {
      preferredCities: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala'],
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
  },

  'large_production': {
    name: 'Large Production-like Dataset',
    description: 'Large-scale data set for load testing and production simulation',
    entities: {
      cooperatives: 100,
      membersPerCooperative: { min: 30, max: 200 },
      apartmentsPerCooperative: { min: 25, max: 150 },
      invoicesPerMonth: { min: 20, max: 100 },
      casesPerMonth: { min: 5, max: 25 },
      boardMeetingsPerYear: 10
    },
    timeRange: {
      startDate: '2020-01-01',
      endDate: '2024-12-31'
    },
    cooperativeConfig: {
      sizeDistribution: { small: 0.3, medium: 0.4, large: 0.25, extraLarge: 0.05 },
      financialRealism: 'high',
      includeRegulatory: true,
      includeEnergyData: true
    },
    memberConfig: {
      contactCompleteness: { phone: 0.90, recentLogin: 0.75 },
      includeLastLogin: true
    },
    realism: {
      geographicDistribution: 'realistic',
      financialRealism: 'high',
      activityRealism: 'high'
    }
  },

  'stress_test': {
    name: 'Stress Testing Dataset',
    description: 'Extreme data volumes for performance and capacity testing',
    entities: {
      cooperatives: 500,
      membersPerCooperative: { min: 50, max: 300 },
      apartmentsPerCooperative: { min: 40, max: 250 },
      invoicesPerMonth: { min: 30, max: 200 },
      casesPerMonth: { min: 10, max: 50 },
      boardMeetingsPerYear: 12
    },
    timeRange: {
      startDate: '2018-01-01',
      endDate: '2024-12-31'
    },
    cooperativeConfig: {
      sizeDistribution: { small: 0.2, medium: 0.3, large: 0.35, extraLarge: 0.15 },
      financialRealism: 'high'
    },
    memberConfig: {
      contactCompleteness: { phone: 0.95, recentLogin: 0.80 }
    },
    realism: {
      geographicDistribution: 'distributed',
      financialRealism: 'high',
      activityRealism: 'high'
    }
  }
};

export class BulkDataGenerator {
  private config: BulkGenerationConfig;
  private db: Database.Database;
  private progressCallback?: (progress: GenerationProgress) => void;

  constructor(config: BulkGenerationConfig) {
    this.config = config;
    
    if (config.database) {
      this.db = config.database;
    } else if (config.databasePath) {
      this.db = new Database(config.databasePath);
    } else {
      throw new Error('Either database instance or database path is required');
    }
  }

  /**
   * Execute bulk data generation
   */
  async generate(
    progressCallback?: (progress: GenerationProgress) => void
  ): Promise<BulkGenerationReport> {
    const startTime = new Date();
    this.progressCallback = progressCallback;
    
    const report: BulkGenerationReport = {
      scenario: this.config.scenario.name,
      executionSummary: {
        startTime,
        endTime: new Date(),
        totalExecutionTime: 0,
        success: false,
        errorCount: 0
      },
      entityResults: {},
      performance: {
        peakMemoryUsage: 0,
        averageBatchTime: 0,
        totalDatabaseOperations: 0,
        averageInsertionRate: 0
      },
      validation: {
        totalValidated: 0,
        validationErrors: 0,
        dataQualityScore: 0
      },
      statistics: {
        cooperativeDistribution: {},
        roleDistribution: {},
        sizeDistribution: {}
      }
    };

    try {
      // Phase 1: Generate Cooperatives
      this.updateProgress('Generating cooperatives...', 0, 100);
      const cooperativeResult = await this.generateCooperatives();
      report.entityResults['cooperatives'] = this.summarizeResult(cooperativeResult);
      report.executionSummary.errorCount += cooperativeResult.errors.length;

      if (cooperativeResult.data.length === 0) {
        throw new Error('Failed to generate any cooperatives');
      }

      // Phase 2: Generate Members
      this.updateProgress('Generating members...', 20, 100);
      const memberResult = await this.generateMembers(cooperativeResult.data);
      report.entityResults['members'] = this.summarizeResult(memberResult);
      report.executionSummary.errorCount += memberResult.errors.length;

      // TODO: Phase 3-7: Generate other entities (apartments, invoices, etc.)
      // This would continue with apartment generation, invoice generation, etc.
      
      // Finalize report
      const endTime = new Date();
      report.executionSummary.endTime = endTime;
      report.executionSummary.totalExecutionTime = endTime.getTime() - startTime.getTime();
      report.executionSummary.success = report.executionSummary.errorCount === 0;
      
      // Update statistics
      this.updateStatistics(report, cooperativeResult.data, memberResult.data);
      
      // Generate and export report if requested
      if (this.config.output.generateReport) {
        await this.exportReport(report);
      }

      this.updateProgress('Generation complete', 100, 100);
      return report;

    } catch (error: any) {
      const endTime = new Date();
      report.executionSummary.endTime = endTime;
      report.executionSummary.totalExecutionTime = endTime.getTime() - startTime.getTime();
      report.executionSummary.success = false;
      report.executionSummary.errorCount++;

      if (this.config.validation.cleanupOnError) {
        await this.cleanup();
      }

      throw error;
    }
  }

  private async generateCooperatives(): Promise<GenerationResult<CooperativeData>> {
    const generator = new CooperativeDataGenerator(
      this.config.seed,
      this.config.scenario.cooperativeConfig
    );

    const options: GenerationOptions = {
      count: this.config.scenario.entities.cooperatives,
      batchSize: this.config.performance.batchSize,
      validateData: this.config.validation.validateData,
      skipDuplicates: true,
      progressCallback: this.progressCallback
    };

    const result = await generator.generate(options);

    // Insert into database
    if (result.success && result.data.length > 0) {
      const inserter = new DatabaseBulkInserter(this.db, 'cooperatives');
      const insertResult = await inserter.insertBulk(result.data, {
        batchSize: this.config.performance.batchSize,
        progressCallback: this.progressCallback,
        onConflict: 'ignore'
      });

      result.statistics.totalInserted = insertResult.inserted;
      result.errors.push(...insertResult.errors);
    }

    return result;
  }

  private async generateMembers(cooperatives: CooperativeData[]): Promise<GenerationResult<MemberData>> {
    const cooperativeIds = cooperatives.map(c => c.id);
    
    // Calculate total members needed
    const totalMembers = cooperatives.reduce((total, coop) => {
      const min = this.config.scenario.entities.membersPerCooperative.min;
      const max = this.config.scenario.entities.membersPerCooperative.max;
      const membersForCoop = Math.floor(Math.random() * (max - min + 1)) + min;
      return total + membersForCoop;
    }, 0);

    const generator = new MemberDataGenerator(
      cooperativeIds,
      this.config.seed,
      this.config.scenario.memberConfig
    );

    const options: GenerationOptions = {
      count: totalMembers,
      batchSize: this.config.performance.batchSize,
      validateData: this.config.validation.validateData,
      skipDuplicates: true,
      progressCallback: this.progressCallback
    };

    const result = await generator.generate(options);

    // Insert into database
    if (result.success && result.data.length > 0) {
      const inserter = new DatabaseBulkInserter(this.db, 'members');
      const insertResult = await inserter.insertBulk(result.data, {
        batchSize: this.config.performance.batchSize,
        progressCallback: this.progressCallback,
        onConflict: 'ignore'
      });

      result.statistics.totalInserted = insertResult.inserted;
      result.errors.push(...insertResult.errors);
    }

    return result;
  }

  private summarizeResult<T>(result: GenerationResult<T>): {
    requested: number;
    generated: number;
    inserted: number;
    errors: number;
    executionTime: number;
  } {
    return {
      requested: result.statistics.totalRequested,
      generated: result.statistics.totalGenerated,
      inserted: result.statistics.totalInserted,
      errors: result.statistics.totalErrors,
      executionTime: result.statistics.executionTimeMs
    };
  }

  private updateStatistics(
    report: BulkGenerationReport,
    cooperatives: CooperativeData[],
    members: MemberData[]
  ): void {
    // Cooperative distribution by city
    for (const coop of cooperatives) {
      const city = coop.city;
      report.statistics.cooperativeDistribution[city] = 
        (report.statistics.cooperativeDistribution[city] || 0) + 1;
    }

    // Member role distribution
    for (const member of members) {
      const role = member.role;
      report.statistics.roleDistribution[role] = 
        (report.statistics.roleDistribution[role] || 0) + 1;
    }

    // Size distribution
    for (const coop of cooperatives) {
      const apartments = coop.total_apartments;
      let category: string;
      
      if (apartments <= 20) category = 'small';
      else if (apartments <= 50) category = 'medium';
      else if (apartments <= 100) category = 'large';
      else category = 'extraLarge';
      
      report.statistics.sizeDistribution[category] = 
        (report.statistics.sizeDistribution[category] || 0) + 1;
    }
  }

  private async exportReport(report: BulkGenerationReport): Promise<void> {
    const reportPath = this.config.output.reportPath || 
      `bulk_generation_report_${Date.now()}.json`;
    
    const fs = await import('fs').then(m => m.promises);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  }

  private async cleanup(): Promise<void> {
    // Remove any partially inserted data
    try {
      const tables = ['members', 'cooperatives'];
      for (const table of tables) {
        this.db.prepare(`DELETE FROM ${table} WHERE created_at > datetime('now', '-1 hour')`).run();
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }

  private updateProgress(message: string, current: number, total: number): void {
    if (this.progressCallback) {
      this.progressCallback({
        phase: message,
        current,
        total,
        percentage: (current / total) * 100,
        startTime: Date.now(),
        errorsCount: 0,
        successCount: current
      });
    }
  }

  /**
   * Estimate generation time and resource usage
   */
  static estimateResources(scenario: BulkGenerationScenario): {
    estimatedTime: number; // minutes
    estimatedMemory: number; // MB
    estimatedDbSize: number; // MB
  } {
    const cooperatives = scenario.entities.cooperatives;
    const avgMembers = (scenario.entities.membersPerCooperative.min + 
                       scenario.entities.membersPerCooperative.max) / 2;
    const totalMembers = cooperatives * avgMembers;
    
    // Rough estimates based on entity complexity
    const estimatedTime = Math.ceil(
      (cooperatives * 0.01 + totalMembers * 0.001) * 60 // Convert to minutes
    );
    
    const estimatedMemory = Math.ceil(
      (cooperatives * 0.1 + totalMembers * 0.05) + 50 // Base memory + data
    );
    
    const estimatedDbSize = Math.ceil(
      (cooperatives * 2 + totalMembers * 1) / 1024 // Convert to MB
    );
    
    return {
      estimatedTime: Math.max(1, estimatedTime),
      estimatedMemory: Math.max(100, estimatedMemory),
      estimatedDbSize: Math.max(1, estimatedDbSize)
    };
  }
}

/**
 * Configuration builder for common scenarios
 */
export class BulkGenerationConfigBuilder {
  private config: Partial<BulkGenerationConfig> = {
    performance: {
      batchSize: 1000,
      maxConcurrentOperations: 4,
      memoryThreshold: 500,
      progressReportInterval: 1000
    },
    output: {
      generateReport: true,
      exportData: false,
      exportFormat: 'json'
    },
    validation: {
      validateData: true,
      skipInvalid: true,
      cleanupOnError: true
    }
  };

  scenario(scenarioName: string): this {
    if (PREDEFINED_SCENARIOS[scenarioName]) {
      this.config.scenario = PREDEFINED_SCENARIOS[scenarioName];
    } else {
      throw new Error(`Unknown scenario: ${scenarioName}`);
    }
    return this;
  }

  customScenario(scenario: BulkGenerationScenario): this {
    this.config.scenario = scenario;
    return this;
  }

  database(db: Database.Database): this {
    this.config.database = db;
    return this;
  }

  databasePath(path: string): this {
    this.config.databasePath = path;
    return this;
  }

  seed(seed: string): this {
    this.config.seed = seed;
    return this;
  }

  batchSize(size: number): this {
    this.config.performance!.batchSize = size;
    return this;
  }

  outputPath(path: string): this {
    this.config.output!.reportPath = path;
    return this;
  }

  build(): BulkGenerationConfig {
    if (!this.config.scenario) {
      throw new Error('Scenario is required');
    }
    if (!this.config.database && !this.config.databasePath) {
      throw new Error('Database or database path is required');
    }
    
    return this.config as BulkGenerationConfig;
  }
}