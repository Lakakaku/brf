// Main database utilities exports
export * from './cooperatives';
export * from './members';
export * from './apartments';
export * from './financial';

// Re-export types for convenience
export * from '../types';

// Database connection and config
export { getDatabase, closeDatabase, withTransaction } from '../config';

// Migration utilities
export {
  runMigrations,
  rollbackMigration,
  getMigrationStatus,
  createMigration,
  resetDatabase,
  backupDatabase,
  restoreDatabase,
  MigrationManager,
} from '../migrations';

// Seed data utilities
export {
  seedDevelopmentData,
  clearAllData,
  seedSpecificData,
} from '../seeds/development';

// Utility classes for easy access
import { CooperativeUtils } from './cooperatives';
import { MemberUtils } from './members';
import { ApartmentUtils } from './apartments';
import { FinancialUtils } from './financial';

export class DatabaseUtils {
  public cooperatives: CooperativeUtils;
  public members: MemberUtils;
  public apartments: ApartmentUtils;
  public financial: FinancialUtils;

  constructor() {
    this.cooperatives = new CooperativeUtils();
    this.members = new MemberUtils();
    this.apartments = new ApartmentUtils();
    this.financial = new FinancialUtils();
  }
}

// Export singleton instance
export const db = new DatabaseUtils();

// Export individual utility instances for direct use
export const cooperativeUtils = new CooperativeUtils();
export const memberUtils = new MemberUtils();
export const apartmentUtils = new ApartmentUtils();
export const financialUtils = new FinancialUtils();
