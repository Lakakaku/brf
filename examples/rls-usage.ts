/**
 * Example usage of the Row-Level Security (RLS) implementation
 * 
 * This file demonstrates how to use the RLS system for secure
 * database operations in the BRF Portal.
 */

import {
  createRLSDatabase,
  createSecureDatabase,
  SecurityMiddleware,
  MembersRepository,
  ApartmentsRepository,
  CasesRepository,
  InvoicesRepository,
  MonthlyFeesRepository,
  withSecureTransaction,
  initializeSecureDatabase,
  type RLSContext,
  type SecurityContext
} from '../lib/database';

// Initialize the database with RLS support
initializeSecureDatabase();

/**
 * Example 1: Basic RLS Database Operations
 */
async function basicRLSOperations() {
  console.log('=== Basic RLS Operations ===');

  // Create security context for a cooperative
  const context: RLSContext = {
    cooperative_id: 'coop-12345',
    user_id: 'user-67890',
    user_role: 'treasurer',
    ip_address: '192.168.1.100',
    user_agent: 'BRF-Portal/1.0'
  };

  // Create RLS-aware database instance
  const rlsDb = createRLSDatabase(getDatabase(), context);

  try {
    // SELECT: Automatically filtered by cooperative_id
    const members = rlsDb.select('members', {
      where: { is_active: 1 },
      orderBy: 'last_name',
      limit: 10
    });
    console.log(`Found ${members.length} active members`);

    // INSERT: Automatically adds cooperative_id
    const newMember = rlsDb.insert('members', {
      email: 'john.doe@example.com',
      first_name: 'John',
      last_name: 'Doe',
      role: 'member',
      is_active: 1
    });
    console.log(`Created member: ${newMember.id}`);

    // UPDATE: Only affects records with matching cooperative_id
    const updated = rlsDb.update(
      'members',
      { phone: '+46701234567' },
      { id: newMember.id }
    );
    console.log(`Updated ${updated} member(s)`);

    // COUNT: Automatically filtered
    const memberCount = rlsDb.count('members', { is_active: 1 });
    console.log(`Total active members: ${memberCount}`);

  } catch (error) {
    console.error('Error in basic operations:', error.message);
  }
}

/**
 * Example 2: Repository Pattern Usage
 */
async function repositoryPatternExample() {
  console.log('=== Repository Pattern Example ===');

  const context: SecurityContext = {
    cooperative_id: 'coop-12345',
    user_id: 'user-67890',
    user_role: 'chairman', // Chairman has elevated permissions
    ip_address: '192.168.1.100'
  };

  try {
    // Members repository
    const membersRepo = new MembersRepository(context);
    
    const activeMembers = membersRepo.findActiveMembers();
    console.log(`Active members: ${activeMembers.length}`);
    
    const boardMembers = membersRepo.findByRole('board');
    console.log(`Board members: ${boardMembers.length}`);
    
    const memberByEmail = membersRepo.findByEmail('john.doe@example.com');
    console.log(`Found member by email:`, memberByEmail?.first_name);

    // Apartments repository
    const apartmentsRepo = new ApartmentsRepository(context);
    
    const apartmentsWithOwners = apartmentsRepo.findWithOwners();
    console.log(`Apartments with owners: ${apartmentsWithOwners.length}`);
    
    const vacantApartments = apartmentsRepo.findVacant();
    console.log(`Vacant apartments: ${vacantApartments.length}`);

    // Cases repository
    const casesRepo = new CasesRepository(context);
    
    const activeCases = casesRepo.findActiveCases();
    console.log(`Active cases: ${activeCases.length}`);
    
    if (activeCases.length > 0) {
      // Assign a case (requires board+ permissions)
      const assigned = casesRepo.assignCase(activeCases[0].id, 'user-67890');
      console.log(`Assigned case: ${assigned > 0 ? 'Success' : 'Failed'}`);
    }

    // Invoices repository
    const invoicesRepo = new InvoicesRepository(context);
    
    const outstandingInvoices = invoicesRepo.findOutstanding();
    console.log(`Outstanding invoices: ${outstandingInvoices.length}`);
    
    const financialSummary = invoicesRepo.getFinancialSummary();
    console.log('Financial summary:', financialSummary);

  } catch (error) {
    console.error('Error in repository operations:', error.message);
  }
}

/**
 * Example 3: Transaction Support
 */
async function transactionExample() {
  console.log('=== Transaction Example ===');

  const context: SecurityContext = {
    cooperative_id: 'coop-12345',
    user_id: 'user-67890',
    user_role: 'treasurer'
  };

  try {
    // Execute multiple operations in a secure transaction
    const result = withSecureTransaction(context, (rlsDb) => {
      // Create a new member
      const member = rlsDb.insert('members', {
        email: 'jane.smith@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'member',
        is_active: 1
      });

      // Assign them to an apartment
      const apartment = rlsDb.selectOne('apartments', { 
        where: { owner_id: null } 
      });

      if (apartment) {
        rlsDb.update('apartments', 
          { 
            owner_id: member.id,
            ownership_date: new Date().toISOString()
          },
          { id: apartment.id }
        );
      }

      return { member, apartment };
    });

    console.log('Transaction completed:', {
      memberId: result.member.id,
      apartmentNumber: result.apartment?.apartment_number
    });

  } catch (error) {
    console.error('Transaction failed:', error.message);
  }
}

/**
 * Example 4: Security Middleware Usage
 */
async function securityMiddlewareExample() {
  console.log('=== Security Middleware Example ===');

  const context: SecurityContext = {
    cooperative_id: 'coop-12345',
    user_id: 'user-67890',
    user_role: 'member',
    ip_address: '192.168.1.100',
    user_agent: 'BRF-Portal/1.0'
  };

  const middleware = new SecurityMiddleware(getDatabase(), {
    enableRateLimiting: true,
    maxRequestsPerMinute: 10,
    enableQueryAnalysis: true
  });

  try {
    // Check authentication (mock token)
    const authContext = await middleware.authenticate('user-67890.session-123', context.cooperative_id);
    console.log('Authentication result:', authContext ? 'Success' : 'Failed');

    // Check authorization for an action
    const canUpdateInvoices = middleware.authorize(context, 'UPDATE', 'invoices');
    console.log('Can update invoices:', canUpdateInvoices);

    // Check rate limiting
    const withinRateLimit = middleware.checkRateLimit(context);
    console.log('Within rate limit:', withinRateLimit);

    // Analyze a query for security issues
    const queryIsSafe = middleware.analyzeQuery(
      "SELECT * FROM members WHERE is_active = 1",
      context
    );
    console.log('Query is safe:', queryIsSafe);

    // Test suspicious query detection
    const suspiciousQuery = middleware.analyzeQuery(
      "SELECT * FROM members WHERE 1=1 OR cooperative_id != ?",
      context
    );
    console.log('Suspicious query blocked:', !suspiciousQuery);

  } catch (error) {
    console.error('Security middleware error:', error.message);
  }
}

/**
 * Example 5: View-Based Queries
 */
async function viewBasedQueriesExample() {
  console.log('=== View-Based Queries Example ===');

  const context: RLSContext = {
    cooperative_id: 'coop-12345',
    user_id: 'user-67890',
    user_role: 'treasurer'
  };

  const rlsDb = createRLSDatabase(getDatabase(), context);

  try {
    // Use pre-built views for complex queries
    const activeCases = rlsDb.executeQuery(`
      SELECT * FROM v_active_cases 
      WHERE cooperative_id = ? 
      ORDER BY effective_priority, reported_at
      LIMIT 5
    `, [context.cooperative_id]);
    console.log(`Active cases from view: ${activeCases.length}`);

    const outstandingFees = rlsDb.executeQuery(`
      SELECT * FROM v_outstanding_monthly_fees 
      WHERE cooperative_id = ?
      ORDER BY year DESC, month DESC
      LIMIT 10
    `, [context.cooperative_id]);
    console.log(`Outstanding fees from view: ${outstandingFees.length}`);

    const financialSummary = rlsDb.executeQuery(`
      SELECT * FROM v_financial_summary 
      WHERE cooperative_id = ?
    `, [context.cooperative_id]);
    console.log('Financial summary from view:', financialSummary[0]);

    const energyAnalysis = rlsDb.executeQuery(`
      SELECT * FROM v_energy_consumption_analysis 
      WHERE cooperative_id = ?
      ORDER BY year DESC, month DESC
      LIMIT 12
    `, [context.cooperative_id]);
    console.log(`Energy analysis records: ${energyAnalysis.length}`);

  } catch (error) {
    console.error('Error in view queries:', error.message);
  }
}

/**
 * Example 6: Error Handling
 */
async function errorHandlingExample() {
  console.log('=== Error Handling Example ===');

  const context: RLSContext = {
    cooperative_id: 'coop-12345',
    user_id: 'user-67890',
    user_role: 'member'
  };

  const rlsDb = createRLSDatabase(getDatabase(), context);

  try {
    // Try to insert data for a different cooperative (should fail)
    rlsDb.insert('members', {
      cooperative_id: 'other-coop', // This will trigger RLS violation
      email: 'hacker@example.com',
      first_name: 'Bad',
      last_name: 'Actor'
    });
  } catch (error) {
    if (error.message.startsWith('RLS_VIOLATION')) {
      console.log('✅ RLS violation correctly blocked:', error.message);
    }
  }

  try {
    // Try to execute dangerous query (should fail)
    rlsDb.executeQuery("DROP TABLE members");
  } catch (error) {
    if (error.message.includes('dangerous operations')) {
      console.log('✅ Dangerous query correctly blocked:', error.message);
    }
  }

  try {
    // Try role-restricted operation
    const membersRepo = new MembersRepository(context);
    membersRepo.updateRole('member-123', 'admin'); // Member role can't change roles
  } catch (error) {
    if (error.message.startsWith('AUTHORIZATION_ERROR')) {
      console.log('✅ Insufficient permissions correctly blocked:', error.message);
    }
  }
}

/**
 * Example 7: Monthly Fee Generation
 */
async function monthlyFeeGenerationExample() {
  console.log('=== Monthly Fee Generation Example ===');

  const context: SecurityContext = {
    cooperative_id: 'coop-12345',
    user_id: 'user-67890',
    user_role: 'treasurer' // Required for fee generation
  };

  try {
    const feesRepo = new MonthlyFeesRepository(context);
    
    // Generate monthly fees for current month
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    const generated = feesRepo.generateForMonth(year, month);
    console.log(`Generated ${generated} monthly fees for ${year}-${month.toString().padStart(2, '0')}`);
    
    // Find outstanding fees
    const outstanding = feesRepo.findOutstanding();
    console.log(`Total outstanding fees: ${outstanding.length}`);
    
    // Calculate total outstanding amount
    const totalOutstanding = outstanding.reduce((sum, fee) => sum + fee.total_amount, 0);
    console.log(`Total outstanding amount: ${totalOutstanding} SEK`);

  } catch (error) {
    console.error('Error in monthly fee operations:', error.message);
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('🔐 BRF Portal RLS Implementation Examples');
  console.log('=========================================\n');

  try {
    await basicRLSOperations();
    console.log('');

    await repositoryPatternExample();
    console.log('');

    await transactionExample();
    console.log('');

    await securityMiddlewareExample();
    console.log('');

    await viewBasedQueriesExample();
    console.log('');

    await errorHandlingExample();
    console.log('');

    await monthlyFeeGenerationExample();
    console.log('');

    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Export for use in other files
export {
  basicRLSOperations,
  repositoryPatternExample,
  transactionExample,
  securityMiddlewareExample,
  viewBasedQueriesExample,
  errorHandlingExample,
  monthlyFeeGenerationExample,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}