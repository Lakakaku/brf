# BRF Portal Test Suite

This directory contains comprehensive tests for the Swedish BRF (Bostadsrättsförening) management system, with a focus on database isolation and security.

## Directory Structure

```
tests/
├── database/                   # Database isolation and security tests
│   ├── isolation.test.ts      # Main isolation test suite
│   ├── repository-isolation.test.ts  # Repository pattern tests
│   ├── isolation-report.md    # Static test documentation
│   ├── test-summary.md        # Generated test summary (after run)
│   └── detailed-test-report.md # Generated detailed report (after run)
├── helpers/                    # Test utilities and helpers
│   └── database-test-utils.ts  # Database testing utilities
└── README.md                   # This file
```

## Test Categories

### 1. Database Isolation Tests (`isolation.test.ts`)
Comprehensive testing of data isolation between Swedish housing cooperatives:

- **Basic Data Isolation**: Verifies each table properly isolates by cooperative_id
- **Cross-Tenant Access Prevention**: Ensures users cannot access other cooperatives' data  
- **RLS Bypass Prevention**: Tests SQL injection and security bypass attempts
- **Audit Trail Verification**: Confirms all operations are properly logged
- **Soft Delete Isolation**: Verifies deleted records maintain isolation
- **Transaction Isolation**: Tests transaction boundaries respect cooperative context
- **Performance Testing**: Validates isolation performance with large datasets
- **Edge Cases**: Tests boundary conditions and error scenarios

### 2. Repository Pattern Tests (`repository-isolation.test.ts`)
Tests data access through repository classes:

- **Member Repository**: User account and permission isolation
- **Apartment Repository**: Property unit and ownership isolation  
- **Invoice Repository**: Financial transaction isolation
- **Repository Methods**: Tests exists(), count(), and other utility methods
- **Error Handling**: Validates graceful handling of invalid operations

## Running Tests

### Run All Isolation Tests
```bash
npm run test:isolation
```

### Run Tests in Watch Mode
```bash
npm run test:isolation:watch
```

### Run Specific Test File
```bash
npx jest tests/database/isolation.test.ts
```

### Run with Coverage
```bash
npx jest tests/database --coverage
```

## Test Environment

### Database Setup
- **Engine**: SQLite (in-memory for testing)
- **Schema**: Full production schema with all tables
- **Data**: Realistic Swedish BRF test data
- **Isolation**: Mock Row-Level Security (RLS) implementation

### Test Data
The test suite creates multiple cooperatives with:
- **3 Cooperatives**: Different Swedish housing cooperatives
- **~10 Members each**: Various roles (member, board, chairman, treasurer)
- **~15 Apartments each**: Different sizes and ownership
- **Financial Data**: Invoices, monthly fees, loans
- **Operational Data**: Cases, documents, bookings

## Security Testing

### What We Test
1. **Data Isolation**: No cooperative can see another's data
2. **SQL Injection Protection**: Malicious queries are blocked
3. **Authorization**: Role-based access is enforced
4. **Audit Logging**: All operations are tracked
5. **Soft Deletion**: Deleted records remain isolated
6. **Performance**: Isolation doesn't degrade performance

### Security Compliance
- ✅ **GDPR Compliance**: Data minimization and purpose limitation
- ✅ **Swedish BRF Regulations**: Financial and governance isolation
- ✅ **Multi-tenant Security**: Complete tenant data segregation

## Test Results

After running tests, you'll get:

1. **Console Output**: Real-time test progress and results
2. **test-summary.md**: High-level pass/fail summary
3. **detailed-test-report.md**: Comprehensive security analysis
4. **Coverage Report**: Code coverage in `coverage/` directory

### Example Output
```
🔒 BRF Portal Database Isolation Test Suite
==================================================
📋 Running isolation tests...

✅ Basic Data Isolation: 13/13 tables passed
✅ Cross-Tenant Access Prevention: All scenarios blocked
✅ RLS Bypass Prevention: All attacks detected
✅ Audit Trail Verification: Complete logging verified
✅ Soft Delete Isolation: Isolation maintained
✅ Transaction Isolation: Boundaries respected
✅ Performance Tests: Within acceptable limits
✅ Repository Pattern: All methods isolated

📊 Results: 89/89 tests passed
⏱️  Duration: 2847ms
📄 Reports generated in tests/database/
```

## Writing New Tests

### Test Structure
```typescript
import { 
  createTestDatabase, 
  initializeTestDatabase,
  executeIsolationTest 
} from '../helpers/database-test-utils';

describe('My Isolation Test', () => {
  let db: Database.Database;
  
  beforeAll(async () => {
    db = createTestDatabase();
    await initializeTestDatabase(db);
  });
  
  test('should maintain isolation', async () => {
    const result = await executeIsolationTest(
      'Test description',
      async () => {
        // Test logic here
        return testResult;
      }
    );
    
    expect(result.success).toBe(true);
  });
});
```

### Test Utilities
The `database-test-utils.ts` file provides:
- Database setup and teardown
- Test data generators
- Security context creators
- Isolation test wrappers
- Performance measurement
- Result reporting

## Production Readiness

### Test Coverage Requirements
- ✅ All database tables tested for isolation
- ✅ All CRUD operations verified
- ✅ Security bypass attempts blocked  
- ✅ Performance within acceptable limits
- ✅ Edge cases and error conditions handled

### Deployment Criteria
- **100% Test Pass Rate**: All isolation tests must pass
- **No Security Violations**: Zero cross-cooperative data leaks
- **Performance Acceptable**: < 5 seconds for large operations
- **Compliance Verified**: GDPR and Swedish BRF requirements met

### Continuous Testing
Recommended schedule:
- **Every Commit**: Basic isolation tests
- **Daily**: Full test suite with performance metrics
- **Weekly**: Extended security and compliance testing
- **Monthly**: Review and update test scenarios

## Troubleshooting

### Common Issues

**Tests failing with "Database locked"**
```bash
# Stop any running processes and retry
pkill -f "jest.*database"
npm run test:isolation
```

**Memory issues with large datasets**
```bash
# Run tests with increased memory
NODE_OPTIONS="--max-old-space-size=4096" npm run test:isolation
```

**TypeScript compilation errors**
```bash
# Clear build cache and retry
rm -rf node_modules/.cache
npm run test:isolation
```

### Getting Help
1. Check test output for specific failure details
2. Review generated reports in `tests/database/`
3. Enable verbose logging: `DEBUG=* npm run test:isolation`
4. Contact the development team for security-related failures

---

**Test Suite Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: BRF Portal Development Team