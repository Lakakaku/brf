#!/usr/bin/env tsx

/**
 * Database initialization script for BRF Portal
 *
 * Usage:
 *   npm run db:init            - Initialize database with sample data
 *   npm run db:init -- --force - Force reinitialize (destroys existing data)
 *   npm run db:init -- --no-seed - Initialize without sample data
 */

import { initDatabase } from '../lib/database/init';

async function main() {
  const args = process.argv.slice(2);

  const options = {
    force: args.includes('--force'),
    seedData: !args.includes('--no-seed'),
    backup: args.includes('--backup'),
  };

  console.log('🚀 BRF Portal Database Initialization');
  console.log('=====================================\n');

  if (options.force) {
    console.log('⚠️  Force mode: Will overwrite existing database');
  }

  if (options.seedData) {
    console.log('🌱 Will seed with development data');
  }

  if (options.backup) {
    console.log('💾 Will backup existing database');
  }

  try {
    await initDatabase(options);

    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\nNext steps:');
    console.log('  - Start the development server: npm run dev');
    console.log('  - Check database status: npm run db:status');
    console.log('  - View sample data in your application');

    process.exit(0);
  } catch (error) {
    console.error('\n💥 Initialization failed:', error);
    process.exit(1);
  }
}

main();
