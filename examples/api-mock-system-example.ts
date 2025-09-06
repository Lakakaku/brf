/**
 * API Mock System - Example Usage
 * Demonstrates how to use the API Response Mocker System in a Swedish BRF context
 */

import { 
  ServiceAdapter, 
  ServiceAdapterConfig, 
  BankIDAdapter, 
  FortnoxAdapter, 
  KivraAdapter, 
  SwedishBankAdapter,
  ServiceAdapterManager 
} from '../lib/api-mocker/service-adapter';

// Example 1: Basic Service Adapter Usage
async function basicServiceAdapterExample() {
  console.log('=== Basic Service Adapter Example ===');

  const config: ServiceAdapterConfig = {
    useMocks: true,
    environment: 'development',
    cooperativeId: 'example-brf-001',
    fallbackToReal: false, // Always use mocks in this example
  };

  const adapter = new ServiceAdapter(config);

  try {
    // Example BankID authentication request
    const bankidResponse = await adapter.request({
      service: 'bankid',
      endpoint: '/auth',
      method: 'POST',
      scenario: 'success',
      data: {
        personalNumber: '198001011234',
        endUserIp: '192.168.1.100',
      },
    });

    console.log('BankID Response:', {
      status: bankidResponse.status,
      isMocked: bankidResponse.isMocked,
      responseTime: bankidResponse.responseTime,
      data: bankidResponse.data,
    });

  } catch (error) {
    console.error('BankID request failed:', error);
  }
}

// Example 2: Specialized BankID Adapter
async function bankidAdapterExample() {
  console.log('\n=== BankID Adapter Example ===');

  const config: ServiceAdapterConfig = {
    useMocks: true,
    environment: 'development',
    cooperativeId: 'example-brf-001',
  };

  const bankidAdapter = new BankIDAdapter(config);

  try {
    // Start authentication
    const authResponse = await bankidAdapter.authenticate('198001011234', 'success');
    console.log('Authentication started:', authResponse.data);

    // Simulate waiting and then collecting result
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const collectResponse = await bankidAdapter.collect(authResponse.data.orderRef, 'complete');
    console.log('Authentication result:', collectResponse.data);

  } catch (error) {
    console.error('BankID authentication failed:', error);
  }
}

// Example 3: Fortnox Integration
async function fortnoxAdapterExample() {
  console.log('\n=== Fortnox Adapter Example ===');

  const config: ServiceAdapterConfig = {
    useMocks: true,
    environment: 'development',
    cooperativeId: 'example-brf-001',
  };

  const fortnoxAdapter = new FortnoxAdapter(config);

  try {
    // Create a monthly fee invoice
    const invoiceData = {
      CustomerNumber: '1001',
      Currency: 'SEK',
      VATIncluded: true,
      DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      YourReference: 'Styrelsen',
      OurReference: 'BRF System',
      Remarks: 'Månadsavgift för bostadsrättsförening',
      InvoiceRows: [
        {
          ArticleNumber: 'MA001',
          Description: 'Månadsavgift',
          Price: 12000, // SEK per month
          Unit: 'st',
          DeliveredQuantity: 1,
          VAT: 0, // No VAT on monthly fees for BRF
        }
      ],
    };

    const invoiceResponse = await fortnoxAdapter.createInvoice(invoiceData, 'invoice_created');
    console.log('Invoice created:', invoiceResponse.data);

    // Get the created invoice
    const invoiceNumber = invoiceResponse.data.Data?.DocumentNumber;
    if (invoiceNumber) {
      const invoiceDetails = await fortnoxAdapter.getInvoice(invoiceNumber);
      console.log('Invoice details:', invoiceDetails.data);
    }

  } catch (error) {
    console.error('Fortnox operation failed:', error);
  }
}

// Example 4: Kivra Digital Mailbox
async function kivraAdapterExample() {
  console.log('\n=== Kivra Adapter Example ===');

  const config: ServiceAdapterConfig = {
    useMocks: true,
    environment: 'development',
    cooperativeId: 'example-brf-001',
  };

  const kivraAdapter = new KivraAdapter(config);

  try {
    // Send a digital invoice via Kivra
    const messageData = {
      recipientId: '198001011234',
      messageType: 'invoice',
      subject: 'Faktura - Månadsavgift BRF Exempel',
      language: 'sv',
      priority: 'medium',
      content: {
        documentType: 'invoice',
        title: 'Månadsavgift',
        amount: 12000,
        currency: 'SEK',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        reference: 'INV-001-2024',
        ocrNumber: '1234567890',
        bankgiro: '123-4567',
      },
    };

    const messageResponse = await kivraAdapter.sendMessage(messageData, 'message_delivered');
    console.log('Message sent via Kivra:', messageResponse.data);

    // Check delivery status
    const messageId = messageResponse.data.message_id;
    if (messageId) {
      const statusResponse = await kivraAdapter.getDeliveryStatus(messageId, 'delivered');
      console.log('Delivery status:', statusResponse.data);
    }

  } catch (error) {
    console.error('Kivra operation failed:', error);
  }
}

// Example 5: Swedish Bank Integration
async function swedishBankAdapterExample() {
  console.log('\n=== Swedish Bank Adapter Example ===');

  const config: ServiceAdapterConfig = {
    useMocks: true,
    environment: 'development',
    cooperativeId: 'example-brf-001',
  };

  const bankAdapter = new SwedishBankAdapter(config);

  try {
    // Check account balance before processing payments
    const balanceResponse = await bankAdapter.getAccountBalance('12345678901', 'account_balance_check');
    console.log('Account balance:', balanceResponse.data);

    // Setup Autogiro for recurring monthly fees
    const autogiroData = {
      payerAccount: {
        clearingNumber: '8000',
        accountNumber: '12345678901',
        accountHolder: 'Erik Eriksson',
      },
      payeeAccount: {
        clearingNumber: '8000',
        accountNumber: '98765432109',
        accountHolder: 'BRF Exempel',
        bgNumber: '123-4567',
      },
      mandateDetails: {
        type: 'RECURRING',
        frequency: 'MONTHLY',
        amount: {
          maxAmount: 15000,
          currency: 'SEK',
        },
        validFrom: new Date().toISOString().split('T')[0],
      },
    };

    const autogiroResponse = await bankAdapter.setupAutogiro(autogiroData, 'direct_debit_setup');
    console.log('Autogiro setup:', autogiroResponse.data);

    // Process a one-time payment
    const paymentData = {
      amount: { amount: 5000, currency: 'SEK' },
      debtorAccount: { identification: '800012345678901' },
      creditorAccount: { identification: '800098765432109' },
      remittanceInformation: 'Extra avgift - Hisreparation',
      requestedExecutionDate: new Date().toISOString().split('T')[0],
    };

    const paymentResponse = await bankAdapter.initiatePayment(paymentData, 'payment_completed');
    console.log('Payment processed:', paymentResponse.data);

  } catch (error) {
    console.error('Bank operation failed:', error);
  }
}

// Example 6: Service Adapter Manager
async function serviceAdapterManagerExample() {
  console.log('\n=== Service Adapter Manager Example ===');

  const globalConfig: ServiceAdapterConfig = {
    useMocks: true,
    environment: 'staging',
    cooperativeId: 'example-brf-001',
    fallbackToReal: true,
    mockOverrides: {
      bankid: true,      // Always use BankID mocks in staging
      fortnox: false,    // Use real Fortnox for accurate accounting
      kivra: true,       // Use Kivra mocks to avoid sending real messages
      swedish_banks: true, // Use bank mocks for safe testing
    },
  };

  const manager = new ServiceAdapterManager(globalConfig);

  try {
    // Get adapters for different services
    const bankidAdapter = manager.getAdapter('bankid') as BankIDAdapter;
    const fortnoxAdapter = manager.getAdapter('fortnox') as FortnoxAdapter;
    const bankAdapter = manager.getAdapter('swedish_banks') as SwedishBankAdapter;

    // Example: Complete monthly fee collection flow
    console.log('Starting monthly fee collection flow...');

    // 1. Authenticate board member with BankID
    const authResponse = await bankidAdapter.authenticate('198001011234', 'success');
    console.log('Board member authenticated');

    // 2. Check cooperative account balance
    const balanceResponse = await bankAdapter.getAccountBalance('98765432109');
    console.log('Account balance checked:', balanceResponse.data.balances?.[0]?.balanceAmount);

    // 3. Create invoices in Fortnox
    const invoiceResponse = await fortnoxAdapter.createInvoice({
      CustomerNumber: '1001',
      Currency: 'SEK',
      InvoiceRows: [
        {
          ArticleNumber: 'MA001',
          Description: 'Månadsavgift Mars 2024',
          Price: 12000,
          Unit: 'st',
          DeliveredQuantity: 1,
        }
      ],
    }, 'invoice_created');
    console.log('Invoice created in Fortnox');

    // 4. Process Autogiro collections
    const autogiroResponse = await bankAdapter.setupAutogiro({
      payerAccount: { identification: '800012345678901' },
      payeeAccount: { identification: '800098765432109' },
      mandateDetails: {
        type: 'RECURRING',
        frequency: 'MONTHLY',
        amount: { maxAmount: 15000, currency: 'SEK' },
      },
    }, 'direct_debit_payment');
    console.log('Autogiro payment processed');

    console.log('Monthly fee collection flow completed successfully!');

  } catch (error) {
    console.error('Monthly fee collection failed:', error);
  }
}

// Example 7: Error Handling and Fallback
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');

  const config: ServiceAdapterConfig = {
    useMocks: true,
    environment: 'development',
    cooperativeId: 'example-brf-001',
    fallbackToReal: true, // Enable fallback for this example
  };

  const adapter = new ServiceAdapter(config);

  try {
    // Test different error scenarios
    const scenarios = ['success', 'timeout', 'server_error', 'insufficient_funds'];

    for (const scenario of scenarios) {
      try {
        console.log(`Testing scenario: ${scenario}`);
        
        const response = await adapter.request({
          service: 'swedish_banks',
          endpoint: '/payment-requests',
          method: 'POST',
          scenario,
          data: {
            amount: { amount: 15000, currency: 'SEK' },
            debtorAccount: { identification: '800012345678901' },
            creditorAccount: { identification: '800098765432109' },
          },
        });

        console.log(`${scenario} - Status: ${response.status}, Mocked: ${response.isMocked}`);

      } catch (error) {
        console.log(`${scenario} - Error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Error handling test failed:', error);
  }
}

// Example 8: Performance Testing
async function performanceTestingExample() {
  console.log('\n=== Performance Testing Example ===');

  const config: ServiceAdapterConfig = {
    useMocks: true,
    environment: 'development',
    cooperativeId: 'example-brf-001',
  };

  const adapter = new ServiceAdapter(config);

  // Test different response delays
  const delayScenarios = [
    { name: 'fast', expectedDelay: 100 },
    { name: 'normal', expectedDelay: 2000 },
    { name: 'slow', expectedDelay: 5000 },
  ];

  for (const delayScenario of delayScenarios) {
    try {
      const startTime = Date.now();
      
      const response = await adapter.request({
        service: 'bankid',
        endpoint: '/auth',
        method: 'POST',
        scenario: delayScenario.name,
        data: { personalNumber: '198001011234' },
      });

      const actualDelay = Date.now() - startTime;
      
      console.log(`${delayScenario.name} scenario:`);
      console.log(`  Expected delay: ${delayScenario.expectedDelay}ms`);
      console.log(`  Actual response time: ${actualDelay}ms`);
      console.log(`  Mock delay setting: ${response.delay}ms`);
      console.log('');

    } catch (error) {
      console.error(`Performance test failed for ${delayScenario.name}:`, error);
    }
  }
}

// Run all examples
async function runAllExamples() {
  try {
    await basicServiceAdapterExample();
    await bankidAdapterExample();
    await fortnoxAdapterExample();
    await kivraAdapterExample();
    await swedishBankAdapterExample();
    await serviceAdapterManagerExample();
    await errorHandlingExample();
    await performanceTestingExample();
    
    console.log('\n=== All Examples Completed Successfully! ===');
  } catch (error) {
    console.error('Examples failed:', error);
  }
}

// Export for use in other files
export {
  basicServiceAdapterExample,
  bankidAdapterExample,
  fortnoxAdapterExample,
  kivraAdapterExample,
  swedishBankAdapterExample,
  serviceAdapterManagerExample,
  errorHandlingExample,
  performanceTestingExample,
  runAllExamples,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}