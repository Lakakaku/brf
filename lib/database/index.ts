// Main database module exports

// Core database functionality
export * from './config';
export * from './types';
export * from './schema';

// Migration system
export * from './migrations';

// Seed data
export * from './seeds/development';

// Database utilities
export * from './utils';

// Initialization and management
export * from './init';

// Re-export the main database utilities for easy access
export { db as database } from './utils';

// Export default database connection
export { default as getDatabase } from './config';
