/**
 * Base Data Generator Tests
 * 
 * Tests for the core data generation infrastructure including
 * error handling, validation, performance optimization, and
 * bulk database operations.
 */

import { 
  BaseDataGenerator, 
  DataConstraints, 
  EntityValidator, 
  ValidationResult,
  GenerationOptions,
  DatabaseBulkInserter
} from '@/lib/testing/generators/base-generator';
import Database from 'better-sqlite3';
import { createTestDatabase, initializeTestDatabase } from '@/tests/helpers/database-test-utils';

// Test implementation of BaseDataGenerator
interface TestData {
  id: string;
  name: string;
  value: number;
  email?: string;
  category: string;
}

class TestValidator implements EntityValidator<TestData> {
  validate(data: TestData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.name || data.name.length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    
    if (data.value < 0) {
      errors.push('Value must be non-negative');
    }
    
    if (data.email && !/^[^@]+@[^@]+\.[^@]+$/.test(data.email)) {
      errors.push('Invalid email format');
    }
    
    if (data.name && data.name.length > 50) {
      warnings.push('Name is unusually long');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  sanitize(data: TestData): TestData {
    return {
      ...data,
      name: data.name?.trim(),
      email: data.email?.toLowerCase().trim(),
      value: Math.max(0, data.value || 0)
    };
  }
}

class TestDataGenerator extends BaseDataGenerator<TestData> {
  private counter = 0;
  
  generateSingle(context?: any): TestData {
    this.counter++;
    
    return {
      id: this.generateId(),
      name: `Test Item ${this.counter}`,
      value: this.randomInt(1, 100),
      email: this.randomBoolean(0.7) ? `test${this.counter}@example.com` : undefined,
      category: this.randomChoice(['A', 'B', 'C'])
    };
  }

  getCounter(): number {
    return this.counter;
  }

  resetCounter(): void {
    this.counter = 0;
  }
}

describe('BaseDataGenerator', () => {
  let generator: TestDataGenerator;
  let validator: TestValidator;

  beforeEach(() => {
    validator = new TestValidator();
    const constraints: DataConstraints = {
      unique: ['id'],
      required: ['name', 'value', 'category'],
      patterns: {
        email: /^[^@]+@[^@]+\.[^@]+$/
      },
      ranges: {
        value: { min: 0, max: 1000 }
      }
    };
    
    generator = new TestDataGenerator('test-seed', constraints, validator);
    generator.resetCounter();
  });

  describe('Single Data Generation', () => {
    it('should generate valid single items', () => {
      const item = generator.generateSingle();
      
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('value');
      expect(item).toHaveProperty('category');
      
      expect(typeof item.id).toBe('string');
      expect(typeof item.name).toBe('string');
      expect(typeof item.value).toBe('number');
      expect(['A', 'B', 'C']).toContain(item.category);
      
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.value).toBeGreaterThanOrEqual(1);
      expect(item.value).toBeLessThanOrEqual(100);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      
      for (let i = 0; i < 1000; i++) {
        const item = generator.generateSingle();
        expect(ids.has(item.id)).toBe(false);
        ids.add(item.id);
      }
    });

    it('should use seeded randomization for reproducibility', () => {
      const generator1 = new TestDataGenerator('same-seed');
      const generator2 = new TestDataGenerator('same-seed');
      
      const items1 = Array.from({ length: 10 }, () => generator1.generateSingle());
      const items2 = Array.from({ length: 10 }, () => generator2.generateSingle());
      
      // Should generate same sequence with same seed
      for (let i = 0; i < 10; i++) {
        expect(items1[i].name).toBe(items2[i].name);
        expect(items1[i].value).toBe(items2[i].value);
        expect(items1[i].category).toBe(items2[i].category);
      }
    });
  });

  describe('Bulk Data Generation', () => {
    it('should generate specified number of items', async () => {
      const options: GenerationOptions = {
        count: 100,
        validateData: false
      };
      
      const result = await generator.generate(options);
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(100);
      expect(result.errors.length).toBe(0);
      expect(result.statistics.totalRequested).toBe(100);
      expect(result.statistics.totalGenerated).toBe(100);
    });

    it('should handle batch processing', async () => {
      const options: GenerationOptions = {
        count: 1000,
        batchSize: 100,
        validateData: false
      };
      
      const result = await generator.generate(options);
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1000);
      expect(result.statistics.executionTimeMs).toBeGreaterThan(0);
    });

    it('should provide progress updates', async () => {
      const progressUpdates: any[] = [];
      
      const options: GenerationOptions = {
        count: 500,
        batchSize: 100,
        progressCallback: (progress) => {
          progressUpdates.push({ ...progress });
        }
      };
      
      const result = await generator.generate(options);
      
      expect(result.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Should have initialization, generation, and completion phases
      const phases = progressUpdates.map(p => p.phase);
      expect(phases.some(p => p === 'initialization')).toBe(true);
      expect(phases.some(p => p === 'generation')).toBe(true);
      expect(phases.some(p => p === 'complete')).toBe(true);
      
      // Progress should increase
      const percentages = progressUpdates.map(p => p.percentage);
      expect(percentages[percentages.length - 1]).toBe(100);
    });
  });

  describe('Validation Integration', () => {
    it('should validate generated data when requested', async () => {
      // Create generator that produces invalid data
      class BadDataGenerator extends BaseDataGenerator<TestData> {
        generateSingle(): TestData {
          return {
            id: this.generateId(),
            name: '', // Invalid - too short
            value: -10, // Invalid - negative
            email: 'not-an-email', // Invalid format
            category: 'A'
          };
        }
      }
      
      const badGenerator = new BadDataGenerator('seed', {}, validator);
      
      const options: GenerationOptions = {
        count: 10,
        validateData: true
      };
      
      const result = await badGenerator.generate(options);
      
      expect(result.success).toBe(false);
      expect(result.data.length).toBe(0); // No valid items
      expect(result.errors.length).toBe(10 * 3); // 3 errors per item * 10 items
      
      // Check error types
      const validationErrors = result.errors.filter(e => e.type === 'validation');
      expect(validationErrors.length).toBeGreaterThan(0);
    });

    it('should sanitize data through validator', async () => {
      // Create generator with data that needs sanitization
      class UntidyDataGenerator extends BaseDataGenerator<TestData> {
        generateSingle(): TestData {
          return {
            id: this.generateId(),
            name: '  Test Item  ', // Has whitespace
            value: -5, // Will be sanitized to 0
            email: '  TEST@EXAMPLE.COM  ', // Has whitespace and uppercase
            category: 'A'
          };
        }
      }
      
      // Test sanitization by validator
      const untidyData: TestData = {
        id: 'test',
        name: '  Test Item  ',
        value: -5,
        email: '  TEST@EXAMPLE.COM  ',
        category: 'A'
      };
      
      const sanitized = validator.sanitize(untidyData);
      
      expect(sanitized.name).toBe('Test Item'); // Trimmed
      expect(sanitized.value).toBe(0); // Negative converted to 0
      expect(sanitized.email).toBe('test@example.com'); // Trimmed and lowercased
    });
  });

  describe('Error Handling', () => {
    it('should handle generation errors gracefully', async () => {
      class ErrorProne extends BaseDataGenerator<TestData> {
        private attempts = 0;
        
        generateSingle(): TestData {
          this.attempts++;
          if (this.attempts % 3 === 0) {
            throw new Error('Simulated generation error');
          }
          
          return {
            id: this.generateId(),
            name: `Item ${this.attempts}`,
            value: 10,
            category: 'A'
          };
        }
      }
      
      const errorGenerator = new ErrorProne('seed');
      
      const options: GenerationOptions = {
        count: 10,
        validateData: false
      };
      
      const result = await errorGenerator.generate(options);
      
      // Should continue despite errors
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.statistics.totalErrors).toBe(result.errors.length);
      
      // Check error information
      const generationErrors = result.errors.filter(e => e.type === 'generation');
      expect(generationErrors.length).toBeGreaterThan(0);
    });

    it('should provide detailed error information', async () => {
      class FailingValidator implements EntityValidator<TestData> {
        validate(data: TestData): ValidationResult {
          return {
            isValid: false,
            errors: ['Always fails', 'Another error'],
            warnings: ['Warning message']
          };
        }
        
        sanitize(data: TestData): TestData {
          return data;
        }
      }
      
      const failingValidator = new FailingValidator();
      const testGenerator = new TestDataGenerator('seed', {}, failingValidator);
      
      const options: GenerationOptions = {
        count: 5,
        validateData: true
      };
      
      const result = await testGenerator.generate(options);
      
      expect(result.errors.length).toBeGreaterThan(0);
      
      for (const error of result.errors) {
        expect(error).toHaveProperty('type');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('timestamp');
        expect(error).toHaveProperty('phase');
        expect(error.timestamp instanceof Date).toBe(true);
      }
    });
  });

  describe('Performance and Statistics', () => {
    it('should collect performance statistics', async () => {
      const options: GenerationOptions = {
        count: 1000,
        batchSize: 200
      };
      
      const result = await generator.generate(options);
      
      expect(result.statistics.executionTimeMs).toBeGreaterThan(0);
      expect(result.statistics.averageGenerationTimeMs).toBeGreaterThan(0);
      expect(result.statistics.memoryUsageMB).toBeGreaterThan(0);
      expect(result.statistics.totalRequested).toBe(1000);
      expect(result.statistics.totalGenerated).toBe(1000);
    });

    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      
      const options: GenerationOptions = {
        count: 10000,
        batchSize: 1000,
        validateData: false
      };
      
      const result = await generator.generate(options);
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(10000);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete in under 10 seconds
      expect(result.statistics.averageGenerationTimeMs).toBeLessThan(1); // Less than 1ms per item
    });
  });

  describe('Metadata and Reporting', () => {
    it('should provide complete metadata', async () => {
      const options: GenerationOptions = {
        count: 100,
        seed: 'test-metadata-seed'
      };
      
      const result = await generator.generate(options);
      
      expect(result.metadata).toHaveProperty('seed');
      expect(result.metadata).toHaveProperty('generator');
      expect(result.metadata).toHaveProperty('version');
      expect(result.metadata).toHaveProperty('timestamp');
      expect(result.metadata).toHaveProperty('options');
      expect(result.metadata).toHaveProperty('environment');
      
      expect(result.metadata.generator).toBe('TestDataGenerator');
      expect(result.metadata.timestamp instanceof Date).toBe(true);
      expect(result.metadata.options).toEqual(options);
      expect(result.metadata.environment.nodeVersion).toBe(process.version);
      expect(result.metadata.environment.platform).toBe(process.platform);
    });
  });
});

describe('DatabaseBulkInserter', () => {
  let db: Database.Database;
  let inserter: DatabaseBulkInserter<TestData>;

  beforeEach(async () => {
    db = createTestDatabase();
    
    // Create test table
    db.exec(`
      CREATE TABLE test_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER NOT NULL,
        email TEXT,
        category TEXT NOT NULL
      )
    `);
    
    inserter = new DatabaseBulkInserter(db, 'test_items');
  });

  afterEach(() => {
    db.close();
  });

  describe('Bulk Insertion', () => {
    it('should insert data in bulk', async () => {
      const testData: TestData[] = [
        { id: '1', name: 'Item 1', value: 10, category: 'A' },
        { id: '2', name: 'Item 2', value: 20, category: 'B' },
        { id: '3', name: 'Item 3', value: 30, category: 'C' }
      ];
      
      const result = await inserter.insertBulk(testData);
      
      expect(result.inserted).toBe(3);
      expect(result.errors.length).toBe(0);
      expect(result.executionTimeMs).toBeGreaterThan(0);
      
      // Verify data in database
      const rows = db.prepare('SELECT * FROM test_items ORDER BY id').all();
      expect(rows.length).toBe(3);
      expect(rows[0].name).toBe('Item 1');
    });

    it('should handle batch processing', async () => {
      const testData: TestData[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `id-${i}`,
        name: `Item ${i}`,
        value: i,
        category: 'A'
      }));
      
      const result = await inserter.insertBulk(testData, {
        batchSize: 100
      });
      
      expect(result.inserted).toBe(1000);
      expect(result.errors.length).toBe(0);
      
      // Verify count in database
      const count = db.prepare('SELECT COUNT(*) as count FROM test_items').get() as any;
      expect(count.count).toBe(1000);
    });

    it('should provide progress updates', async () => {
      const testData: TestData[] = Array.from({ length: 500 }, (_, i) => ({
        id: `id-${i}`,
        name: `Item ${i}`,
        value: i,
        category: 'A'
      }));
      
      const progressUpdates: any[] = [];
      
      const result = await inserter.insertBulk(testData, {
        batchSize: 100,
        progressCallback: (progress) => {
          progressUpdates.push({ ...progress });
        }
      });
      
      expect(result.inserted).toBe(500);
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Progress should increase
      const percentages = progressUpdates.map(p => p.percentage);
      expect(percentages[percentages.length - 1]).toBe(100);
    });

    it('should handle conflicts with onConflict option', async () => {
      const testData: TestData[] = [
        { id: '1', name: 'Item 1', value: 10, category: 'A' },
        { id: '1', name: 'Item 1 Duplicate', value: 15, category: 'B' } // Duplicate ID
      ];
      
      // Test ignore conflicts
      const result = await inserter.insertBulk(testData, {
        onConflict: 'ignore'
      });
      
      expect(result.inserted).toBe(1); // Only first item inserted
      expect(result.errors.length).toBe(0); // No errors with ignore
      
      // Verify only first item in database
      const rows = db.prepare('SELECT * FROM test_items WHERE id = ?').all('1');
      expect(rows.length).toBe(1);
      expect(rows[0].name).toBe('Item 1'); // Original name
    });

    it('should handle database errors', async () => {
      // Try to insert invalid data (missing required field)
      const invalidData = [
        { id: '1', name: 'Valid Item', value: 10, category: 'A' },
        { id: '2', value: 20, category: 'B' } as any // Missing name
      ];
      
      const result = await inserter.insertBulk(invalidData);
      
      expect(result.inserted).toBeLessThan(2);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check error details
      const dbErrors = result.errors.filter(e => e.type === 'database');
      expect(dbErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Field Mapping', () => {
    it('should map fields correctly', async () => {
      // Create inserter with field mapping
      const mappedInserter = new DatabaseBulkInserter(
        db, 
        'test_items', 
        { itemName: 'name', itemValue: 'value' }
      );
      
      const testData = [
        { 
          id: '1', 
          itemName: 'Mapped Item', 
          itemValue: 42, 
          category: 'A' 
        } as any
      ];
      
      const result = await mappedInserter.insertBulk(testData);
      
      expect(result.inserted).toBe(1);
      
      // Verify mapped data
      const row = db.prepare('SELECT * FROM test_items WHERE id = ?').get('1') as any;
      expect(row.name).toBe('Mapped Item');
      expect(row.value).toBe(42);
    });
  });
});