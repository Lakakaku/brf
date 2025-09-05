import fs from 'fs';
import path from 'path';
import {
  getDatabase,
  ensureDatabaseDirectory,
  getDatabasePath,
} from './config';
import { runMigrations, MigrationManager } from './migrations';
import { seedDevelopmentData } from './seeds/development';

export interface InitOptions {
  force?: boolean; // Force re-initialization even if database exists
  seedData?: boolean; // Whether to seed development data
  backup?: boolean; // Whether to backup existing database before re-init
}

/**
 * Initialize the SQLite database for development
 */
export async function initDatabase(options: InitOptions = {}): Promise<void> {
  console.log('🔄 Initializing BRF Portal SQLite database...');

  try {
    // Ensure database directory exists
    ensureDatabaseDirectory();

    const dbPath = getDatabasePath();
    const dbExists = fs.existsSync(dbPath);

    // Handle existing database
    if (dbExists && !options.force) {
      console.log('📊 Database already exists. Use --force to reinitialize.');

      // Just run any pending migrations
      await runMigrations();

      if (options.seedData) {
        console.log('🌱 Adding seed data to existing database...');
        const db = getDatabase();
        await seedDevelopmentData(db);
      }

      console.log('✅ Database initialization completed');
      return;
    }

    // Backup existing database if requested
    if (dbExists && options.backup) {
      console.log('💾 Creating backup of existing database...');
      const manager = new MigrationManager();
      const backupPath = manager.backup();
      console.log(`✅ Backup created: ${backupPath}`);
    }

    // Remove existing database if force is true
    if (dbExists && options.force) {
      console.log('🗑️  Removing existing database...');
      fs.unlinkSync(dbPath);
    }

    // Initialize new database
    console.log('🏗️  Creating new database...');
    const db = getDatabase();

    // Run migrations to create schema
    console.log('📋 Running database migrations...');
    await runMigrations();

    // Seed development data if requested
    if (options.seedData) {
      console.log('🌱 Seeding development data...');
      await seedDevelopmentData(db);
    }

    console.log('✅ Database initialization completed successfully!');

    // Print database info
    printDatabaseInfo();
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Reset database (drop all data and recreate)
 */
export async function resetDatabase(seedData: boolean = true): Promise<void> {
  console.log('🔄 Resetting BRF Portal database...');

  try {
    const manager = new MigrationManager();
    await manager.reset();

    if (seedData) {
      console.log('🌱 Seeding development data...');
      const db = getDatabase();
      await seedDevelopmentData(db);
    }

    console.log('✅ Database reset completed successfully!');
    printDatabaseInfo();
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  }
}

/**
 * Check database health and print status
 */
export function checkDatabase(): void {
  console.log('🔍 Checking database health...');

  try {
    const dbPath = getDatabasePath();
    const dbExists = fs.existsSync(dbPath);

    if (!dbExists) {
      console.log('❌ Database file does not exist');
      console.log(`   Expected location: ${dbPath}`);
      console.log('   Run: npm run db:init to create the database');
      return;
    }

    const db = getDatabase();

    // Test connection
    const result = db.prepare('SELECT 1 as test').get() as { test: number };
    if (result.test !== 1) {
      throw new Error('Database connection test failed');
    }

    // Check tables exist
    const tables = db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `
      )
      .all() as { name: string }[];

    console.log('✅ Database connection: OK');
    console.log(`📍 Database location: ${dbPath}`);
    console.log(
      `📊 Database size: ${(fs.statSync(dbPath).size / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`🗂️  Tables found: ${tables.length}`);

    if (tables.length > 0) {
      console.log('   Tables:', tables.map(t => t.name).join(', '));
    }

    // Check migration status
    const manager = new MigrationManager();
    const executed = manager.getExecutedMigrations();
    const pending = manager.getPendingMigrations();

    console.log(`✅ Migrations executed: ${executed.length}`);
    console.log(`⏳ Migrations pending: ${pending.length}`);

    if (pending.length > 0) {
      console.log('⚠️  Run: npm run db:migrate to apply pending migrations');
    }

    // Basic data counts
    if (tables.some(t => t.name === 'cooperatives')) {
      const counts = {
        cooperatives: db
          .prepare(
            'SELECT COUNT(*) as count FROM cooperatives WHERE deleted_at IS NULL'
          )
          .get() as { count: number },
        members: db
          .prepare(
            'SELECT COUNT(*) as count FROM members WHERE deleted_at IS NULL'
          )
          .get() as { count: number },
        apartments: db
          .prepare('SELECT COUNT(*) as count FROM apartments')
          .get() as { count: number },
        invoices: db
          .prepare('SELECT COUNT(*) as count FROM invoices')
          .get() as { count: number },
        cases: db.prepare('SELECT COUNT(*) as count FROM cases').get() as {
          count: number;
        },
      };

      console.log('\n📈 Data Summary:');
      console.log(`   Cooperatives: ${counts.cooperatives.count}`);
      console.log(`   Members: ${counts.members.count}`);
      console.log(`   Apartments: ${counts.apartments.count}`);
      console.log(`   Invoices: ${counts.invoices.count}`);
      console.log(`   Cases: ${counts.cases.count}`);
    }
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    throw error;
  }
}

/**
 * Print database information
 */
function printDatabaseInfo(): void {
  const dbPath = getDatabasePath();
  const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

  console.log('\n📊 Database Information:');
  console.log(`   Location: ${dbPath}`);
  console.log(`   Size: ${(dbSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

  if (process.env.NODE_ENV === 'development') {
    console.log('\n🛠️  Development Tools:');
    console.log('   npm run db:status    - Check database status');
    console.log('   npm run db:migrate   - Run migrations');
    console.log('   npm run db:seed      - Add sample data');
    console.log('   npm run db:reset     - Reset database');
    console.log('   npm run db:backup    - Create backup');
  }
}

/**
 * Validate database schema integrity
 */
export function validateSchema(): boolean {
  console.log('🔍 Validating database schema...');

  try {
    const db = getDatabase();

    // Expected tables
    const expectedTables = [
      'cooperatives',
      'members',
      'apartments',
      'documents',
      'invoices',
      'monthly_fees',
      'cases',
      'notifications',
      'audit_log',
      'migrations',
    ];

    // Check all expected tables exist
    const existingTables = db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `
      )
      .all() as { name: string }[];

    const missingTables = expectedTables.filter(
      table => !existingTables.some(existing => existing.name === table)
    );

    if (missingTables.length > 0) {
      console.log('❌ Missing tables:', missingTables.join(', '));
      return false;
    }

    // Validate foreign key constraints are enabled
    const foreignKeysResult = db.pragma('foreign_keys') as number;
    if (!foreignKeysResult) {
      console.log('❌ Foreign key constraints are not enabled');
      return false;
    }

    // Test basic operations on each table
    for (const table of expectedTables) {
      try {
        db.prepare(`SELECT COUNT(*) FROM ${table}`).get();
      } catch (error) {
        console.log(`❌ Error accessing table ${table}:`, error);
        return false;
      }
    }

    console.log('✅ Schema validation passed');
    return true;
  } catch (error) {
    console.error('❌ Schema validation failed:', error);
    return false;
  }
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
  tables: { name: string; count: number }[];
  totalRecords: number;
  dbSize: number;
  dbPath: string;
} {
  const db = getDatabase();
  const dbPath = getDatabasePath();

  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `
    )
    .all() as { name: string }[];

  const tableStats = tables.map(table => {
    const result = db
      .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
      .get() as { count: number };
    return {
      name: table.name,
      count: result.count,
    };
  });

  const totalRecords = tableStats.reduce((sum, table) => sum + table.count, 0);
  const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

  return {
    tables: tableStats,
    totalRecords,
    dbSize,
    dbPath,
  };
}
