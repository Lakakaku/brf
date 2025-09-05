#!/usr/bin/env tsx

/**
 * Database seeding script for BRF Portal
 */

import { getDatabase } from '../lib/database/config';
import {
  seedDevelopmentData,
  clearAllData,
  seedSpecificData,
} from '../lib/database/seeds/development';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const dataType = args[1];

  console.log('🌱 BRF Portal Database Seeding');
  console.log('==============================\n');

  try {
    const db = getDatabase();

    switch (command) {
      case 'clear':
        console.log('🧹 Clearing all data...');
        clearAllData(db);
        console.log('✅ All data cleared');
        break;

      case 'specific':
        if (!dataType) {
          console.error('❌ Data type is required');
          console.log(
            'Available types: cooperatives, members, apartments, documents, invoices, monthly_fees, cases'
          );
          process.exit(1);
        }
        await seedSpecificData(db, dataType);
        break;

      case 'all':
      case undefined:
        await seedDevelopmentData(db);
        break;

      default:
        console.log('Usage:');
        console.log(
          '  npm run db:seed              - Seed all development data'
        );
        console.log(
          '  npm run db:seed all          - Seed all development data'
        );
        console.log('  npm run db:seed clear        - Clear all existing data');
        console.log(
          '  npm run db:seed specific <type> - Seed specific data type'
        );
        console.log('\nAvailable data types:');
        console.log(
          '  cooperatives, members, apartments, documents, invoices, monthly_fees, cases'
        );
        process.exit(1);
    }

    console.log('\n✅ Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
