/**
 * Jest Configuration for BRF Multi-Tenant Isolation Tests
 * 
 * Specialized Jest configuration optimized for isolation testing,
 * performance monitoring, and security validation.
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const isolationTestConfig = {
  displayName: 'BRF Isolation Tests',
  
  // Test environment
  testEnvironment: 'node', // Use Node environment for database tests
  
  // Test patterns - specifically for isolation tests
  testMatch: [
    '<rootDir>/tests/**/*isolation*.test.(ts|js)',
    '<rootDir>/tests/**/cooperative-switching*.test.(ts|js)',
    '<rootDir>/tests/**/session-switching*.test.(ts|js)',
    '<rootDir>/tests/database/**/*.test.(ts|js)',
    '<rootDir>/tests/generators/**/*.test.(ts|js)'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/isolation-setup.js',
    '<rootDir>/jest.setup.js'
  ],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/tests/setup/global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.js',
  
  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/tests/(.*)$': '<rootDir>/tests/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1'
  },
  
  // Coverage configuration optimized for isolation testing
  collectCoverage: true,
  collectCoverageFrom: [
    'lib/database/**/*.{ts,js}',
    'lib/auth/**/*.{ts,js}',
    'lib/security/**/*.{ts,js}',
    'hooks/**/*.{ts,js}',
    'tests/helpers/**/*.{ts,js}',
    'tests/generators/**/*.{ts,js}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**'
  ],
  
  coverageDirectory: '<rootDir>/tests/coverage/isolation',
  
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json-summary'
  ],
  
  // Stricter coverage thresholds for security-critical code
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './lib/database/rls.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './lib/database/security.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './lib/auth/**/*.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Test timeout - generous for database operations
  testTimeout: 120000, // 2 minutes
  
  // Isolation test specific settings
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  
  // Clear mocks between tests for isolation
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Verbose output for detailed test reporting
  verbose: true,
  
  // Detect handles and async operations
  detectOpenHandles: true,
  forceExit: true,
  
  // Custom reporters
  reporters: [
    'default',
    [
      '<rootDir>/tests/reporters/isolation-reporter.js',
      {
        outputPath: '<rootDir>/tests/reports/isolation-results.json',
        includeConsoleOutput: true,
        includeSkipped: true
      }
    ],
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/tests/reports',
        filename: 'isolation-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'BRF Isolation Test Report'
      }
    ]
  ],
  
  // Transform settings for TypeScript
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2019'
        }
      }
    }]
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Test path ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/', // E2E tests have separate config
    '<rootDir>/mcp-servers/',
    '<rootDir>/exa-mcp-server/',
    '<rootDir>/playwright-mcp/',
    '<rootDir>/semgrep-mcp/'
  ],
  
  // Watch mode settings (for development)
  watchPathIgnorePatterns: [
    '<rootDir>/tests/reports/',
    '<rootDir>/tests/coverage/',
    '<rootDir>/tests/logs/'
  ],
  
  // Custom matchers for isolation testing
  setupFilesAfterEnv: [
    '<rootDir>/tests/matchers/isolation-matchers.js'
  ],
  
  // Environment variables for testing
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    DATABASE_URL: ':memory:',
    LOG_LEVEL: 'error' // Reduce noise in test output
  },
  
  // Snapshot settings
  snapshotSerializers: [
    '<rootDir>/tests/serializers/database-serializer.js'
  ],
  
  // Global variables
  globals: {
    'ts-jest': {
      isolatedModules: true,
      useESM: false
    },
    TEST_TIMEOUT: 120000,
    ISOLATION_TEST_MODE: true
  }
};

module.exports = createJestConfig(isolationTestConfig);