#!/usr/bin/env tsx

/**
 * Database migration script for BRF Portal
 */

import {
  runMigrations,
  rollbackMigration,
  MigrationManager,
} from '../lib/database/migrations';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('📋 BRF Portal Database Migrations');
  console.log('=================================\n');

  try {
    const manager = new MigrationManager();

    switch (command) {
      case 'status':
        manager.getStatus();
        break;

      case 'up':
      case undefined:
        await runMigrations();
        break;

      case 'down':
        const migrationName = args[1];
        await rollbackMigration(migrationName);
        break;

      case 'create':
        const name = args[1];
        if (!name) {
          console.error('❌ Migration name is required');
          console.log('Usage: npm run db:migrate create "migration_name"');
          process.exit(1);
        }
        const filepath = manager.createMigrationFile(name);
        console.log(`✅ Migration file created: ${filepath}`);
        console.log('Edit the file to add your migration logic');
        break;

      default:
        console.log('Usage:');
        console.log('  npm run db:migrate         - Run pending migrations');
        console.log('  npm run db:migrate status  - Show migration status');
        console.log('  npm run db:migrate down    - Rollback last migration');
        console.log(
          '  npm run db:migrate create "name" - Create new migration'
        );
        process.exit(1);
    }

    console.log('\n✅ Migration command completed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
