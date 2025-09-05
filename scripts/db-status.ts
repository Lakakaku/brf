#!/usr/bin/env tsx

/**
 * Database status script for BRF Portal
 */

import { checkDatabase, getDatabaseStats } from '../lib/database/init';
import { MigrationManager } from '../lib/database/migrations';

async function main() {
  console.log('🔍 BRF Portal Database Status');
  console.log('=============================\n');

  try {
    // Basic health check
    checkDatabase();

    // Migration status
    console.log('\n📋 Migration Status:');
    const manager = new MigrationManager();
    manager.getStatus();

    // Detailed statistics
    console.log('\n📊 Detailed Statistics:');
    const stats = getDatabaseStats();

    console.log(`   Database file: ${stats.dbPath}`);
    console.log(`   File size: ${(stats.dbSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Total records: ${stats.totalRecords.toLocaleString()}`);

    console.log('\n   Records per table:');
    stats.tables.forEach(table => {
      console.log(`     ${table.name}: ${table.count.toLocaleString()}`);
    });

    console.log('\n✅ Status check completed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Status check failed:', error);
    process.exit(1);
  }
}

main();
