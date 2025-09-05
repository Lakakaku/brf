#!/usr/bin/env tsx

/**
 * Database reset script for BRF Portal
 */

import { resetDatabase } from '../lib/database/init';

async function main() {
  const args = process.argv.slice(2);
  const noSeed = args.includes('--no-seed');

  console.log('🔄 BRF Portal Database Reset');
  console.log('===========================\n');

  if (noSeed) {
    console.log('⚠️  Will reset database without seeding data');
  } else {
    console.log('🌱 Will reset database and seed with development data');
  }

  // Confirm reset in production-like environments
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot reset database in production environment');
    process.exit(1);
  }

  try {
    await resetDatabase(!noSeed);

    console.log('\n✅ Database reset completed successfully');
    console.log('\nNext steps:');
    console.log('  - Start the development server: npm run dev');
    console.log('  - Check database status: npm run db:status');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Reset failed:', error);
    process.exit(1);
  }
}

main();
