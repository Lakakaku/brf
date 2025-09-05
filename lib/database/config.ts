import Database from 'better-sqlite3';
import path from 'path';

export interface DatabaseConfig {
  filename: string;
  options: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message?: any, ...additionalArgs: any[]) => void;
  };
}

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

export const databaseConfig: DatabaseConfig = {
  filename: path.join(
    process.cwd(),
    'database',
    isTest ? 'brf-test.db' : 'brf.db'
  ),
  options: {
    readonly: false,
    fileMustExist: false,
    timeout: 10000,
    verbose: isDevelopment ? console.log : undefined,
  },
};

// Singleton database instance
let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(databaseConfig.filename, databaseConfig.options);

    // Enable foreign key constraints
    dbInstance.pragma('foreign_keys = ON');

    // Set journal mode to WAL for better concurrent access
    dbInstance.pragma('journal_mode = WAL');

    // Enable synchronous mode for data safety
    dbInstance.pragma('synchronous = NORMAL');

    // Set cache size (negative value = KB, positive = pages)
    dbInstance.pragma('cache_size = -64000'); // 64MB cache

    // Set temp store to memory
    dbInstance.pragma('temp_store = MEMORY');

    // Set mmap size for better performance
    dbInstance.pragma('mmap_size = 268435456'); // 256MB

    // Optimize for performance
    dbInstance.pragma('optimize');
  }

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function getDatabasePath(): string {
  return databaseConfig.filename;
}

// Helper to ensure database directory exists
export function ensureDatabaseDirectory(): void {
  const fs = require('fs');
  const dbDir = path.dirname(databaseConfig.filename);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

// Transaction helper
export function withTransaction<T>(
  db: Database.Database,
  fn: (db: Database.Database) => T
): T {
  const transaction = db.transaction(() => {
    return fn(db);
  });

  return transaction();
}

// Error handling helper
export function handleDatabaseError(error: unknown): never {
  if (error instanceof Error) {
    console.error('Database error:', error.message);
    console.error('Stack:', error.stack);
  } else {
    console.error('Unknown database error:', error);
  }

  throw error;
}

export default getDatabase;
