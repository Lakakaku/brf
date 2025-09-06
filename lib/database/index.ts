// Main database module exports

// Core database functionality
export * from './config';
export * from './types';
export * from './schema';

// Migration system
export * from './migrations';

// Seed data
export * from './seeds/development';

// Row-Level Security (RLS) implementation
export * from './rls';
export * from './security';
export * from './views';

// Database utilities (now RLS-aware)
export * from './utils';

// Query inspector system for Swedish BRF compliance
export * from './query-inspector';

// Initialization and management
export * from './init';

// Export default database connection
export { default as getDatabase } from './config';
