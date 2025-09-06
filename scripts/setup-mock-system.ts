#!/usr/bin/env tsx

/**
 * Setup Script for API Mock System
 * Initializes the mock system with default configurations for Swedish BRF services
 */

import { getDatabase } from '../lib/database';
import { apiMocker, MockConfig } from '../lib/api-mocker';

interface DefaultMockConfig extends Omit<MockConfig, 'cooperativeId'> {
  cooperativeId?: string;
}

// Default mock configurations for Swedish BRF services
const defaultMockConfigs: DefaultMockConfig[] = [
  // BankID Mocks
  {
    service: 'bankid',
    endpoint: '/auth',
    method: 'POST',
    scenario: 'success',
    delayMs: 2000,
    responseStatus: 200,
    responseData: {
      orderRef: '131daac9-16c6-4618-beb0-365768f37288',
      autoStartToken: '7c40b5c9-fa74-49cf-b98c-927a8d8c5e7c',
      qrStartToken: '67df3917-fa0d-44e5-b327-edcc928297f8',
      qrStartSecret: 'd28db9c7-4637-4251-84b5-25ba5dda2e1f',
    },
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    isEnabled: true,
    environment: 'development',
  },
  {
    service: 'bankid',
    endpoint: '/collect',
    method: 'POST',
    scenario: 'complete',
    delayMs: 1000,
    responseStatus: 200,
    responseData: {
      orderRef: '131daac9-16c6-4618-beb0-365768f37288',
      status: 'complete',
      hintCode: 'userSign',
      completionData: {
        user: {
          personalNumber: '198001011234',
          name: 'Test Testsson',
          givenName: 'Test',
          surname: 'Testsson',
        },
        device: {
          ipAddress: '192.168.1.100',
          uhi: 'mock-device-12345',
        },
        cert: {
          notBefore: new Date().toISOString(),
          notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        signature: 'mock-signature-data',
        ocspResponse: 'mock-ocsp-response',
      },
    },
    isEnabled: true,
    environment: 'development',
  },
  {
    service: 'bankid',
    endpoint: '/auth',
    method: 'POST',
    scenario: 'user_cancel',
    delayMs: 3000,
    responseStatus: 200,
    responseData: {
      orderRef: '131daac9-16c6-4618-beb0-365768f37288',
      status: 'cancelled',
      hintCode: 'userCancel',
      errorCode: 'cancelled',
      details: 'User cancelled the authentication',
    },
    isEnabled: true,
    environment: 'development',
  },

  // Fortnox Mocks
  {
    service: 'fortnox',
    endpoint: '/invoices',
    method: 'POST',
    scenario: 'invoice_created',
    delayMs: 1500,
    responseStatus: 201,
    responseData: {
      Invoice: {
        DocumentNumber: 12345,
        CustomerNumber: '1001',
        CustomerName: 'Testbostadsrättsförening',
        InvoiceDate: new Date().toISOString().split('T')[0],
        DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        Currency: 'SEK',
        Total: 15000,
        Balance: 15000,
        InvoiceRows: [
          {
            ArticleNumber: 'MA001',
            Description: 'Månadsavgift',
            Price: 15000,
            Unit: 'st',
            DeliveredQuantity: 1,
            Total: 15000,
          },
        ],
      },
    },
    headers: {
      'Content-Type': 'application/json',
      'Access-Token': 'mock-fortnox-token',
    },
    isEnabled: true,
    environment: 'development',
  },
  {
    service: 'fortnox',
    endpoint: '/customers',
    method: 'POST',
    scenario: 'customer_created',
    delayMs: 1000,
    responseStatus: 201,
    responseData: {
      Customer: {
        CustomerNumber: '1001',
        Name: 'Testbostadsrättsförening',
        OrganisationNumber: '556123-1234',
        Type: 'COMPANY',
        Address1: 'Testgatan 123',
        ZipCode: '12345',
        City: 'Stockholm',
        Country: 'SE',
        Currency: 'SEK',
        VATType: 'SEVAT',
      },
    },
    isEnabled: true,
    environment: 'development',
  },

  // Kivra Mocks
  {
    service: 'kivra',
    endpoint: '/messages',
    method: 'POST',
    scenario: 'message_delivered',
    delayMs: 2000,
    responseStatus: 200,
    responseData: {
      messageId: 'kivra-msg-12345',
      recipientId: '198001011234',
      status: 'delivered',
      deliveryTimestamp: new Date().toISOString(),
      deliveryMethod: 'kivra_app',
      legallyBinding: true,
      deliveryReceipt: {
        delivered: true,
        deliveredAt: new Date().toISOString(),
        certificateId: `CERT-${Date.now()}`,
      },
    },
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mock-kivra-token',
    },
    isEnabled: true,
    environment: 'development',
  },

  // Swedish Banks Mocks
  {
    service: 'swedish_banks',
    endpoint: '/payment-requests',
    method: 'POST',
    scenario: 'payment_completed',
    delayMs: 3000,
    responseStatus: 200,
    responseData: {
      paymentId: 'PAY-SWEDBANK-12345',
      status: 'COMPLETED',
      amount: { amount: 15000, currency: 'SEK' },
      debtorAccount: { identification: '800012345678901' },
      creditorAccount: { identification: '800098765432109' },
      executionDate: new Date().toISOString().split('T')[0],
      bankTransactionCode: 'PMNT-RCDT-ESCT',
      endToEndId: 'E2E-PAY-12345',
    },
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': 'req-12345',
    },
    isEnabled: true,
    environment: 'development',
  },
  {
    service: 'swedish_banks',
    endpoint: '/accounts/*/balance',
    method: 'GET',
    scenario: 'account_balance_check',
    delayMs: 1500,
    responseStatus: 200,
    responseData: {
      accountIdentification: {
        clearingNumber: '8000',
        accountNumber: '12345678901',
        iban: 'SE0580000000012345678901',
      },
      balances: [
        {
          balanceType: 'CLBD',
          balanceAmount: { amount: 450000, currency: 'SEK' },
          creditDebitIndicator: 'CRDT',
          date: new Date().toISOString().split('T')[0],
        },
      ],
      accountType: 'CACC',
      accountStatus: 'ACTV',
    },
    isEnabled: true,
    environment: 'development',
  },
  {
    service: 'swedish_banks',
    endpoint: '/autogiro/mandates',
    method: 'POST',
    scenario: 'direct_debit_setup',
    delayMs: 5000,
    responseStatus: 201,
    responseData: {
      mandateId: `AG-${Date.now()}`,
      status: 'ACTIVE',
      payerAccount: {
        clearingNumber: '8000',
        accountNumber: '12345678901',
        accountHolder: 'Test Testsson',
      },
      payeeAccount: {
        clearingNumber: '8000',
        accountNumber: '98765432109',
        accountHolder: 'Testbostadsrättsförening',
        bgNumber: '123-4567',
      },
      mandateDetails: {
        type: 'RECURRING',
        frequency: 'MONTHLY',
        maxAmount: 20000,
        currency: 'SEK',
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      nextCollectionDate: getNextMonthFirstDay(),
    },
    isEnabled: true,
    environment: 'development',
  },
];

async function setupMockSystem(cooperativeId: string = 'default-cooperative') {
  console.log('🚀 Setting up API Mock System...');
  
  try {
    // Initialize database
    const db = getDatabase();
    console.log('✅ Database connection established');

    // Check if mock_configurations table exists
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mock_configurations'")
      .get();

    if (!tableExists) {
      console.log('⚠️  Mock configurations table does not exist');
      console.log('   Please run database migrations first: npm run migrate');
      return;
    }

    console.log('✅ Mock configurations table found');

    // Clear existing mock configurations for this cooperative
    const deleteResult = db
      .prepare('DELETE FROM mock_configurations WHERE cooperative_id = ?')
      .run(cooperativeId);
    
    console.log(`🗑️  Removed ${deleteResult.changes} existing mock configurations`);

    // Insert default mock configurations
    const insertStmt = db.prepare(`
      INSERT INTO mock_configurations (
        id, cooperative_id, name, description, service, endpoint,
        method, scenario, delay_ms, response_status, response_data,
        headers, is_enabled, environment, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let insertedCount = 0;
    
    for (const config of defaultMockConfigs) {
      try {
        const configId = crypto.randomUUID();
        const name = `${config.service.toUpperCase()} ${config.scenario} (${config.method})`;
        const description = `Default ${config.service} mock for ${config.scenario} scenario`;
        
        insertStmt.run(
          configId,
          cooperativeId,
          name,
          description,
          config.service,
          config.endpoint,
          config.method,
          config.scenario,
          config.delayMs,
          config.responseStatus,
          JSON.stringify(config.responseData),
          JSON.stringify(config.headers || {}),
          config.isEnabled ? 1 : 0,
          config.environment,
          JSON.stringify([config.service, config.scenario, 'default'])
        );

        // Also register with in-memory apiMocker
        apiMocker.registerMock({
          ...config,
          cooperativeId,
        });

        insertedCount++;
      } catch (error) {
        console.warn(`Failed to insert mock config for ${config.service}:`, error);
      }
    }

    console.log(`✅ Inserted ${insertedCount} default mock configurations`);

    // Create mock templates
    await createMockTemplates(db, cooperativeId);

    // Create mock scenarios
    await createMockScenarios(db, cooperativeId);

    console.log('🎉 Mock system setup completed successfully!');
    console.log(`\nNext steps:`);
    console.log(`1. Visit /admin/mocks in your application to manage mocks`);
    console.log(`2. Test the mocks using the examples in /examples/api-mock-system-example.ts`);
    console.log(`3. Configure your services to use mocks in development`);
    
    // Show summary
    const totalConfigs = db
      .prepare('SELECT COUNT(*) as count FROM mock_configurations WHERE cooperative_id = ?')
      .get(cooperativeId);
    
    const enabledConfigs = db
      .prepare('SELECT COUNT(*) as count FROM mock_configurations WHERE cooperative_id = ? AND is_enabled = 1')
      .get(cooperativeId);

    console.log(`\nSummary:`);
    console.log(`- Total configurations: ${totalConfigs.count}`);
    console.log(`- Enabled configurations: ${enabledConfigs.count}`);
    console.log(`- Services configured: ${new Set(defaultMockConfigs.map(c => c.service)).size}`);

  } catch (error) {
    console.error('❌ Mock system setup failed:', error);
    throw error;
  }
}

async function createMockTemplates(db: any, cooperativeId: string) {
  console.log('📋 Creating mock templates...');

  const templates = [
    {
      name: 'BankID Success Response',
      service: 'bankid',
      category: 'success',
      response_template: JSON.stringify({
        orderRef: '{{uuid}}',
        autoStartToken: '{{uuid}}',
        qrStartToken: '{{uuid}}',
        qrStartSecret: '{{uuid}}',
      }),
      variables: JSON.stringify(['uuid']),
      description: 'Standard BankID success response template',
    },
    {
      name: 'Fortnox Invoice Response',
      service: 'fortnox',
      category: 'success',
      response_template: JSON.stringify({
        Invoice: {
          DocumentNumber: '{{documentNumber}}',
          CustomerNumber: '{{customerNumber}}',
          Total: '{{amount}}',
          Currency: 'SEK',
          InvoiceDate: '{{today}}',
          DueDate: '{{dueDate}}',
        },
      }),
      variables: JSON.stringify(['documentNumber', 'customerNumber', 'amount', 'today', 'dueDate']),
      description: 'Fortnox invoice creation response template',
    },
    {
      name: 'Payment Success Response',
      service: 'swedish_banks',
      category: 'success',
      response_template: JSON.stringify({
        paymentId: 'PAY-{{timestamp}}',
        status: 'COMPLETED',
        amount: { amount: '{{amount}}', currency: 'SEK' },
        executionDate: '{{today}}',
        endToEndId: 'E2E-{{uuid}}',
      }),
      variables: JSON.stringify(['timestamp', 'amount', 'today', 'uuid']),
      description: 'Swedish bank payment success response template',
    },
  ];

  const insertTemplateStmt = db.prepare(`
    INSERT INTO mock_templates (
      id, cooperative_id, name, description, service, category,
      response_template, variables, is_system_template
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  let insertedTemplates = 0;
  for (const template of templates) {
    try {
      insertTemplateStmt.run(
        crypto.randomUUID(),
        cooperativeId,
        template.name,
        template.description,
        template.service,
        template.category,
        template.response_template,
        template.variables
      );
      insertedTemplates++;
    } catch (error) {
      console.warn(`Failed to create template ${template.name}:`, error);
    }
  }

  console.log(`✅ Created ${insertedTemplates} mock templates`);
}

async function createMockScenarios(db: any, cooperativeId: string) {
  console.log('🎬 Creating mock scenarios...');

  const scenarios = [
    {
      name: 'success',
      display_name: 'Success',
      description: 'Successful operation with expected response',
      service: 'bankid',
      default_status_code: 200,
      default_delay_ms: 2000,
      category: 'success',
      use_cases: JSON.stringify(['Authentication', 'Identity verification', 'Digital signing']),
    },
    {
      name: 'user_cancel',
      display_name: 'User Cancellation',
      description: 'User cancels the operation',
      service: 'bankid',
      default_status_code: 200,
      default_delay_ms: 1000,
      category: 'user_action',
      use_cases: JSON.stringify(['Authentication cancellation', 'User workflow testing']),
    },
    {
      name: 'payment_completed',
      display_name: 'Payment Completed',
      description: 'Payment successfully processed',
      service: 'swedish_banks',
      default_status_code: 200,
      default_delay_ms: 3000,
      category: 'success',
      use_cases: JSON.stringify(['Monthly fees', 'Special assessments', 'Vendor payments']),
    },
    {
      name: 'insufficient_funds',
      display_name: 'Insufficient Funds',
      description: 'Payment failed due to insufficient account balance',
      service: 'swedish_banks',
      default_status_code: 400,
      default_delay_ms: 1000,
      category: 'error',
      use_cases: JSON.stringify(['Payment failure handling', 'Error recovery testing']),
    },
  ];

  const insertScenarioStmt = db.prepare(`
    INSERT INTO mock_scenarios (
      id, cooperative_id, name, display_name, description, service,
      default_status_code, default_delay_ms, category, use_cases, is_system_scenario
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  let insertedScenarios = 0;
  for (const scenario of scenarios) {
    try {
      insertScenarioStmt.run(
        crypto.randomUUID(),
        cooperativeId,
        scenario.name,
        scenario.display_name,
        scenario.description,
        scenario.service,
        scenario.default_status_code,
        scenario.default_delay_ms,
        scenario.category,
        scenario.use_cases
      );
      insertedScenarios++;
    } catch (error) {
      console.warn(`Failed to create scenario ${scenario.name}:`, error);
    }
  }

  console.log(`✅ Created ${insertedScenarios} mock scenarios`);
}

function getNextMonthFirstDay(): string {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  return nextMonth.toISOString().split('T')[0];
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const cooperativeId = args[0] || 'default-cooperative';

  console.log('API Mock System Setup');
  console.log('====================');
  console.log(`Cooperative ID: ${cooperativeId}`);
  console.log('');

  try {
    await setupMockSystem(cooperativeId);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// Export functions for use as module
export { setupMockSystem, createMockTemplates, createMockScenarios };

// Run if this file is executed directly
if (require.main === module) {
  main();
}