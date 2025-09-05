import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { getDatabase } from './config';
import { createSchema, createIndexes, createTriggers } from './schema';

export interface Migration {
  id: number;
  name: string;
  executed_at: string;
}

export interface MigrationFile {
  name: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

export class MigrationManager {
  private db: Database.Database;
  private migrationsDir: string;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
    this.migrationsDir = path.join(
      process.cwd(),
      'lib',
      'database',
      'migrations'
    );
    this.ensureMigrationsTable();
  }

  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  public async runMigrations(): Promise<void> {
    console.log('🔄 Running database migrations...');

    const migrations = this.loadMigrationFiles();
    const executedMigrations = this.getExecutedMigrations();

    const pendingMigrations = migrations.filter(
      migration =>
        !executedMigrations.some(executed => executed.name === migration.name)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📦 Found ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      console.log(`⚡ Running migration: ${migration.name}`);

      try {
        const transaction = this.db.transaction(() => {
          migration.up(this.db);
          this.recordMigration(migration.name);
        });

        transaction();
        console.log(`✅ Completed migration: ${migration.name}`);
      } catch (error) {
        console.error(`❌ Failed migration: ${migration.name}`, error);
        throw error;
      }
    }

    console.log('✅ All migrations completed successfully');
  }

  public async rollbackMigration(migrationName?: string): Promise<void> {
    console.log('🔄 Rolling back migration...');

    const executedMigrations = this.getExecutedMigrations();
    const targetMigration = migrationName
      ? executedMigrations.find(m => m.name === migrationName)
      : executedMigrations[executedMigrations.length - 1]; // Latest migration

    if (!targetMigration) {
      console.log('❌ No migration to rollback');
      return;
    }

    const migrations = this.loadMigrationFiles();
    const migrationFile = migrations.find(m => m.name === targetMigration.name);

    if (!migrationFile || !migrationFile.down) {
      console.log(
        `❌ Rollback not available for migration: ${targetMigration.name}`
      );
      return;
    }

    try {
      const transaction = this.db.transaction(() => {
        migrationFile.down!(this.db);
        this.removeMigrationRecord(targetMigration.name);
      });

      transaction();
      console.log(`✅ Rolled back migration: ${targetMigration.name}`);
    } catch (error) {
      console.error(
        `❌ Failed to rollback migration: ${targetMigration.name}`,
        error
      );
      throw error;
    }
  }

  public getExecutedMigrations(): Migration[] {
    const stmt = this.db.prepare('SELECT * FROM migrations ORDER BY id');
    return stmt.all() as Migration[];
  }

  public getPendingMigrations(): string[] {
    const allMigrations = this.loadMigrationFiles().map(m => m.name);
    const executedMigrations = this.getExecutedMigrations().map(m => m.name);

    return allMigrations.filter(name => !executedMigrations.includes(name));
  }

  private loadMigrationFiles(): MigrationFile[] {
    const migrations: MigrationFile[] = [];

    // Add initial migration
    migrations.push({
      name: '001_initial_schema',
      up: (db: Database.Database) => {
        createSchema(db);
        createIndexes(db);
        createTriggers(db);
      },
      down: (db: Database.Database) => {
        const tables = [
          'audit_log',
          'notifications',
          'cases',
          'monthly_fees',
          'invoices',
          'documents',
          'apartments',
          'members',
          'cooperatives',
        ];
        tables.forEach(table => {
          db.exec(`DROP TABLE IF EXISTS ${table};`);
        });
      },
    });

    // Load additional migration files from disk
    if (fs.existsSync(this.migrationsDir)) {
      const files = fs
        .readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        .sort();

      for (const file of files) {
        const filePath = path.join(this.migrationsDir, file);
        try {
          const migration = require(filePath);
          if (migration.default) {
            migrations.push(migration.default);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to load migration file: ${file}`, error);
        }
      }
    }

    return migrations.sort((a, b) => a.name.localeCompare(b.name));
  }

  private recordMigration(name: string): void {
    const stmt = this.db.prepare('INSERT INTO migrations (name) VALUES (?)');
    stmt.run(name);
  }

  private removeMigrationRecord(name: string): void {
    const stmt = this.db.prepare('DELETE FROM migrations WHERE name = ?');
    stmt.run(name);
  }

  public createMigrationFile(name: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 14);
    const filename = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.ts`;
    const filepath = path.join(this.migrationsDir, filename);

    const template = `import Database from 'better-sqlite3';
import { MigrationFile } from '../migrations';

const migration: MigrationFile = {
  name: '${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}',
  
  up: (db: Database.Database): void => {
    // Add your migration logic here
    console.log('Running migration: ${name}');
    
    // Example:
    // db.exec(\`
    //   ALTER TABLE example_table ADD COLUMN new_column TEXT;
    // \`);
  },
  
  down: (db: Database.Database): void => {
    // Add your rollback logic here
    console.log('Rolling back migration: ${name}');
    
    // Example:
    // db.exec(\`
    //   ALTER TABLE example_table DROP COLUMN new_column;
    // \`);
  }
};

export default migration;
`;

    // Ensure migrations directory exists
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }

    fs.writeFileSync(filepath, template);
    console.log(`✅ Created migration file: ${filepath}`);

    return filepath;
  }

  public getStatus(): void {
    const executed = this.getExecutedMigrations();
    const pending = this.getPendingMigrations();

    console.log('\n📊 Migration Status:');
    console.log(`✅ Executed migrations: ${executed.length}`);
    console.log(`⏳ Pending migrations: ${pending.length}`);

    if (executed.length > 0) {
      console.log('\nExecuted migrations:');
      executed.forEach(migration => {
        console.log(`  ✅ ${migration.name} (${migration.executed_at})`);
      });
    }

    if (pending.length > 0) {
      console.log('\nPending migrations:');
      pending.forEach(name => {
        console.log(`  ⏳ ${name}`);
      });
    }
  }

  public async reset(): Promise<void> {
    console.log('🔄 Resetting database...');

    // Drop all tables
    const tables = [
      'audit_log',
      'notifications',
      'cases',
      'monthly_fees',
      'invoices',
      'documents',
      'apartments',
      'members',
      'cooperatives',
      'migrations',
    ];

    for (const table of tables) {
      this.db.exec(`DROP TABLE IF EXISTS ${table};`);
    }

    // Recreate migrations table and run all migrations
    this.ensureMigrationsTable();
    await this.runMigrations();

    console.log('✅ Database reset completed');
  }

  public backup(backupPath?: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .slice(0, 15);
    const defaultPath = path.join(
      process.cwd(),
      'database',
      `backup_${timestamp}.db`
    );
    const targetPath = backupPath || defaultPath;

    // Ensure backup directory exists
    const backupDir = path.dirname(targetPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // SQLite backup
    this.db.backup(targetPath);
    console.log(`✅ Database backed up to: ${targetPath}`);

    return targetPath;
  }

  public restore(backupPath: string): void {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    console.log(`🔄 Restoring database from: ${backupPath}`);

    // Close current connection
    this.db.close();

    // Copy backup file to current database location
    const currentDbPath = path.join(process.cwd(), 'database', 'brf.db');
    fs.copyFileSync(backupPath, currentDbPath);

    // Reopen connection
    this.db = getDatabase();

    console.log('✅ Database restored successfully');
  }
}

// Utility functions
export async function runMigrations(): Promise<void> {
  const manager = new MigrationManager();
  await manager.runMigrations();
}

export async function rollbackMigration(migrationName?: string): Promise<void> {
  const manager = new MigrationManager();
  await manager.rollbackMigration(migrationName);
}

export function getMigrationStatus(): void {
  const manager = new MigrationManager();
  manager.getStatus();
}

export function createMigration(name: string): string {
  const manager = new MigrationManager();
  return manager.createMigrationFile(name);
}

export async function resetDatabase(): Promise<void> {
  const manager = new MigrationManager();
  await manager.reset();
}

export function backupDatabase(backupPath?: string): string {
  const manager = new MigrationManager();
  return manager.backup(backupPath);
}

export function restoreDatabase(backupPath: string): void {
  const manager = new MigrationManager();
  manager.restore(backupPath);
}
