import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const SwedishBankMockConfigSchema = z.object({
  scenario: z.enum([
    'payment_initiated',
    'payment_completed',
    'payment_failed',
    'account_balance_check',
    'transaction_history',
    'direct_debit_setup',
    'direct_debit_payment',
    'standing_order_created',
    'account_blocked',
    'insufficient_funds'
  ]).default('payment_completed'),
  delay_seconds: z.number().min(0).max(300).default(2),
  bank: z.enum(['swedbank', 'handelsbanken', 'seb', 'nordea', 'danske_bank', 'sbab']).default('swedbank'),
  account_number: z.string().optional().default('12345678901'),
  clearing_number: z.string().optional().default('8000'),
  amount: z.number().positive().optional().default(15000),
  currency: z.string().optional().default('SEK'),
  payer_name: z.string().optional().default('Testbostadsrättsförening'),
  payment_reference: z.string().optional().default('Månadsavgift'),
  include_psd2_data: z.boolean().default(true),
});

/**
 * POST /api/webhooks/mocks/swedish-banks - Mock Swedish banking system events
 * Simulates Swedish banking APIs for BRF payment processing and account management
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = SwedishBankMockConfigSchema.parse(body);
    const cooperativeId = body.cooperative_id;

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const transactionId = crypto.randomUUID();
    const paymentId = `${config.bank.toUpperCase()}-${Date.now()}`;
    
    // Generate scenario-specific data
    const scenarios = {
      payment_initiated: {
        event_type: 'swedish_bank.payment.initiated',
        data: generatePaymentData(config, paymentId, 'initiated'),
      },
      payment_completed: {
        event_type: 'swedish_bank.payment.completed',
        data: generatePaymentData(config, paymentId, 'completed'),
      },
      payment_failed: {
        event_type: 'swedish_bank.payment.failed',
        data: generatePaymentData(config, paymentId, 'failed'),
      },
      account_balance_check: {
        event_type: 'swedish_bank.account.balance_checked',
        data: generateAccountBalanceData(config),
      },
      transaction_history: {
        event_type: 'swedish_bank.account.transaction_history',
        data: generateTransactionHistoryData(config),
      },
      direct_debit_setup: {
        event_type: 'swedish_bank.autogiro.setup',
        data: generateAutogiroSetupData(config),
      },
      direct_debit_payment: {
        event_type: 'swedish_bank.autogiro.payment',
        data: generateAutogiroPaymentData(config, paymentId),
      },
      standing_order_created: {
        event_type: 'swedish_bank.standing_order.created',
        data: generateStandingOrderData(config),
      },
      account_blocked: {
        event_type: 'swedish_bank.account.blocked',
        data: generateAccountStatusData(config, 'blocked'),
      },
      insufficient_funds: {
        event_type: 'swedish_bank.payment.insufficient_funds',
        data: generatePaymentData(config, paymentId, 'failed', 'INSUFFICIENT_FUNDS'),
      },
    };

    const scenarioData = scenarios[config.scenario];

    // Create webhook payload with Swedish banking standards
    const webhookPayload = {
      paymentId: paymentId,
      transactionId: transactionId,
      bank: config.bank,
      clearingNumber: config.clearing_number,
      accountNumber: config.account_number,
      amount: config.amount,
      currency: config.currency,
      payerName: config.payer_name,
      paymentReference: config.payment_reference,
      timestamp: new Date().toISOString(),
      eventType: scenarioData.event_type,
      ...scenarioData.data,
      metadata: {
        source: 'Swedish_Banking_System',
        apiVersion: '1.0',
        transactionId: transactionId,
        environment: 'simulation',
        bankingStandard: config.include_psd2_data ? 'PSD2' : 'Swedish_Domestic',
        complianceLevel: 'PCI_DSS_Level_1',
      },
    };

    // Add PSD2 data if requested
    if (config.include_psd2_data) {
      webhookPayload.metadata['psd2'] = generatePSD2Data(config);
    }

    // Send webhook simulation
    const webhookResponse = await fetch(`${request.nextUrl.origin}/api/webhooks/simulator/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cooperative_id: cooperativeId,
        event_type: scenarioData.event_type,
        service_type: 'swedish_banks',
        payload: webhookPayload,
        delay_seconds: config.delay_seconds,
        correlation_id: transactionId,
      }),
    });

    let scheduledWebhooks = [];
    if (webhookResponse.ok) {
      const result = await webhookResponse.json();
      scheduledWebhooks = result.simulated_events;
    }

    return NextResponse.json({
      message: 'Swedish bank mock event initiated',
      scenario: config.scenario,
      bank: config.bank,
      payment_id: paymentId,
      transaction_id: transactionId,
      scheduled_delivery: new Date(Date.now() + config.delay_seconds * 1000).toISOString(),
      scheduled_webhooks: scheduledWebhooks,
      mock_data: webhookPayload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Swedish bank mock error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Swedish bank mock event' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/mocks/swedish-banks - Get Swedish bank mock configuration options
 */
export async function GET() {
  return NextResponse.json({
    scenarios: [
      {
        id: 'payment_initiated',
        name: 'Payment Initiated',
        description: 'Payment instruction received and being processed',
        typical_duration: '1-5 seconds',
      },
      {
        id: 'payment_completed',
        name: 'Payment Completed',
        description: 'Payment successfully processed and funds transferred',
        typical_duration: '2-10 seconds',
      },
      {
        id: 'payment_failed',
        name: 'Payment Failed',
        description: 'Payment processing failed due to various reasons',
        typical_duration: '1-5 seconds',
      },
      {
        id: 'account_balance_check',
        name: 'Account Balance Check',
        description: 'Account balance inquiry completed',
        typical_duration: '1-3 seconds',
      },
      {
        id: 'transaction_history',
        name: 'Transaction History',
        description: 'Account transaction history retrieved',
        typical_duration: '2-5 seconds',
      },
      {
        id: 'direct_debit_setup',
        name: 'Direct Debit Setup (Autogiro)',
        description: 'Autogiro mandate setup completed',
        typical_duration: '5-15 minutes',
      },
      {
        id: 'direct_debit_payment',
        name: 'Direct Debit Payment (Autogiro)',
        description: 'Autogiro payment processed',
        typical_duration: '1-3 business days',
      },
      {
        id: 'standing_order_created',
        name: 'Standing Order Created',
        description: 'Recurring payment instruction created',
        typical_duration: '2-5 seconds',
      },
      {
        id: 'account_blocked',
        name: 'Account Blocked',
        description: 'Account temporarily blocked for security reasons',
        typical_duration: 'Immediate',
      },
      {
        id: 'insufficient_funds',
        name: 'Insufficient Funds',
        description: 'Payment failed due to insufficient account balance',
        typical_duration: '1-3 seconds',
      },
    ],
    supported_banks: [
      {
        bank: 'swedbank',
        name: 'Swedbank',
        clearing_numbers: ['8000-8999'],
        api_features: ['PSD2', 'Open_Banking', 'Autogiro', 'Swish_Integration'],
      },
      {
        bank: 'handelsbanken',
        name: 'Svenska Handelsbanken',
        clearing_numbers: ['6000-6999'],
        api_features: ['PSD2', 'Open_Banking', 'Autogiro', 'Corporate_Banking'],
      },
      {
        bank: 'seb',
        name: 'Skandinaviska Enskilda Banken',
        clearing_numbers: ['5000-5999', '9120-9124', '9130-9149'],
        api_features: ['PSD2', 'Open_Banking', 'Autogiro', 'Treasury_Services'],
      },
      {
        bank: 'nordea',
        name: 'Nordea Bank',
        clearing_numbers: ['3000-3999', '4000-4999'],
        api_features: ['PSD2', 'Open_Banking', 'Autogiro', 'Nordic_Banking'],
      },
      {
        bank: 'danske_bank',
        name: 'Danske Bank',
        clearing_numbers: ['1200-1399'],
        api_features: ['PSD2', 'Open_Banking', 'Nordic_Banking'],
      },
      {
        bank: 'sbab',
        name: 'SBAB (Savings Bank)',
        clearing_numbers: ['9250-9259'],
        api_features: ['PSD2', 'Mortgage_Services', 'Savings_Accounts'],
      },
    ],
    webhook_events: [
      'swedish_bank.payment.initiated',
      'swedish_bank.payment.completed',
      'swedish_bank.payment.failed',
      'swedish_bank.payment.insufficient_funds',
      'swedish_bank.account.balance_checked',
      'swedish_bank.account.transaction_history',
      'swedish_bank.account.blocked',
      'swedish_bank.account.unblocked',
      'swedish_bank.autogiro.setup',
      'swedish_bank.autogiro.payment',
      'swedish_bank.autogiro.cancelled',
      'swedish_bank.standing_order.created',
      'swedish_bank.standing_order.executed',
      'swedish_bank.standing_order.cancelled',
    ],
    brf_use_cases: [
      'Monthly fee collection via Autogiro',
      'One-time payment processing for special assessments',
      'Account balance verification before large expenditures',
      'Payment reconciliation and transaction tracking',
      'Standing orders for recurring maintenance payments',
      'Refund processing for overpayments',
      'Payment failure handling and retry logic',
    ],
    test_accounts: [
      {
        bank: 'swedbank',
        clearing_number: '8000',
        account_number: '12345678901',
        balance: 250000,
        currency: 'SEK',
        account_holder: 'Testbostadsrättsförening',
        account_type: 'business_current',
      },
      {
        bank: 'handelsbanken',
        clearing_number: '6000',
        account_number: '98765432109',
        balance: 150000,
        currency: 'SEK',
        account_holder: 'BRF Test Kooperativ',
        account_type: 'business_savings',
      },
    ],
  });
}

// Helper functions for generating mock Swedish banking data

function generatePaymentData(config: any, paymentId: string, status: string, failureReason?: string) {
  const baseData = {
    paymentInstruction: {
      instructionId: paymentId,
      endToEndId: `E2E-${paymentId}`,
      amount: {
        amount: config.amount,
        currency: config.currency,
      },
      debtorAccount: {
        identification: `${config.clearing_number}${config.account_number}`,
        clearingNumber: config.clearing_number,
        accountNumber: config.account_number,
        accountHolder: config.payer_name,
      },
      creditorAccount: {
        identification: generateCreditorAccount(config.bank),
        clearingNumber: '8000', // BRF's bank
        accountNumber: '11111111111',
        accountHolder: 'BRF Mottagare',
      },
      remittanceInformation: config.payment_reference,
      requestedExecutionDate: new Date().toISOString().split('T')[0],
    },
    bankProcessing: {
      processingTimestamp: new Date().toISOString(),
      processingBank: getBankName(config.bank),
      processingBIC: getBankBIC(config.bank),
      processingReference: `${config.bank.toUpperCase()}-${Date.now()}`,
    },
  };

  switch (status) {
    case 'initiated':
      return {
        ...baseData,
        paymentStatus: {
          status: 'ACCP', // AcceptedCustomerProfile
          statusDescription: 'Betalning mottagen och behandlas',
          timestamp: new Date().toISOString(),
        },
      };

    case 'completed':
      return {
        ...baseData,
        paymentStatus: {
          status: 'ACSC', // AcceptedSettlementCompleted
          statusDescription: 'Betalning genomförd',
          timestamp: new Date().toISOString(),
        },
        settlement: {
          settlementDate: new Date().toISOString().split('T')[0],
          settlementAmount: config.amount,
          settlementCurrency: config.currency,
          exchangeRate: config.currency === 'SEK' ? 1 : 10.5,
        },
        fees: {
          transactionFee: 0, // Most BRF accounts have no transaction fees
          exchangeFee: 0,
          totalFees: 0,
        },
      };

    case 'failed':
      return {
        ...baseData,
        paymentStatus: {
          status: 'RJCT', // Rejected
          statusDescription: getFailureDescription(failureReason),
          timestamp: new Date().toISOString(),
          reasonCode: failureReason || 'TECH',
        },
        rejectionReason: {
          code: failureReason || 'TECH',
          description: getFailureDescription(failureReason),
          additionalInfo: getFailureDetails(failureReason),
        },
      };

    default:
      return baseData;
  }
}

function generateAccountBalanceData(config: any) {
  return {
    accountIdentification: {
      clearingNumber: config.clearing_number,
      accountNumber: config.account_number,
      iban: generateSwedishIBAN(config.clearing_number, config.account_number),
    },
    accountHolder: {
      name: config.payer_name,
      organizationNumber: generateSwedishOrgNumber(),
    },
    balances: [
      {
        balanceType: 'CLBD', // ClosingBooked
        balanceAmount: {
          amount: Math.floor(Math.random() * 1000000) + 50000, // 50k - 1M SEK
          currency: config.currency,
        },
        creditDebitIndicator: 'CRDT',
        date: new Date().toISOString().split('T')[0],
      },
      {
        balanceType: 'ITBD', // InterimBooked
        balanceAmount: {
          amount: Math.floor(Math.random() * 1000000) + 45000,
          currency: config.currency,
        },
        creditDebitIndicator: 'CRDT',
        date: new Date().toISOString(),
      },
    ],
    accountType: 'CACC', // Current Account
    accountStatus: 'ACTV', // Active
    accountServicer: {
      bic: getBankBIC(config.bank),
      name: getBankName(config.bank),
    },
  };
}

function generateTransactionHistoryData(config: any) {
  const transactions = [];
  const today = new Date();
  
  // Generate last 30 days of transactions
  for (let i = 0; i < 30; i++) {
    const transactionDate = new Date(today);
    transactionDate.setDate(today.getDate() - i);
    
    // Skip weekends for most business transactions
    if (transactionDate.getDay() === 0 || transactionDate.getDay() === 6) {
      continue;
    }

    // Generate 1-3 transactions per day
    const transactionCount = Math.floor(Math.random() * 3) + 1;
    
    for (let j = 0; j < transactionCount; j++) {
      transactions.push(generateSingleTransaction(config, transactionDate));
    }
  }

  return {
    accountIdentification: {
      clearingNumber: config.clearing_number,
      accountNumber: config.account_number,
    },
    transactions: transactions.slice(0, 50), // Limit to 50 transactions
    balanceAfterTransactions: {
      amount: Math.floor(Math.random() * 500000) + 100000,
      currency: config.currency,
    },
  };
}

function generateSingleTransaction(config: any, date: Date): any {
  const transactionTypes = [
    { type: 'incoming_payment', description: 'Månadsavgift', amount: 15000 },
    { type: 'outgoing_payment', description: 'El och värme', amount: -25000 },
    { type: 'outgoing_payment', description: 'Städning', amount: -8000 },
    { type: 'outgoing_payment', description: 'Försäkring', amount: -12000 },
    { type: 'incoming_payment', description: 'Parkeringsavgift', amount: 500 },
    { type: 'outgoing_payment', description: 'Reparation', amount: -15000 },
  ];

  const transaction = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
  const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  return {
    transactionId: transactionId,
    bookingDate: date.toISOString().split('T')[0],
    valueDate: date.toISOString().split('T')[0],
    transactionAmount: {
      amount: Math.abs(transaction.amount) + Math.floor(Math.random() * 5000),
      currency: config.currency,
    },
    creditDebitIndicator: transaction.amount > 0 ? 'CRDT' : 'DBIT',
    status: 'BOOK', // Booked
    bankTransactionCode: transaction.type === 'incoming_payment' ? 'PMNT-RCDT-ESCT' : 'PMNT-PMNT-OTHR',
    remittanceInformation: transaction.description,
    debtorAccount: transaction.amount < 0 ? {
      clearingNumber: config.clearing_number,
      accountNumber: config.account_number,
    } : null,
    creditorAccount: transaction.amount > 0 ? {
      clearingNumber: config.clearing_number,
      accountNumber: config.account_number,
    } : null,
  };
}

function generateAutogiroSetupData(config: any) {
  return {
    mandateId: `AG-${Date.now()}`,
    payerBankAccount: {
      clearingNumber: config.clearing_number,
      accountNumber: config.account_number,
      accountHolder: config.payer_name,
    },
    payeeBankAccount: {
      clearingNumber: '8000',
      accountNumber: '11111111111',
      accountHolder: 'BRF Mottagare',
      bgNumber: '123-4567', // Bankgiro number
    },
    mandateDetails: {
      type: 'RECURRING', // Recurring direct debit
      frequency: 'MONTHLY',
      amount: {
        maxAmount: config.amount,
        currency: config.currency,
      },
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year
    },
    status: 'ACTIVE',
    setupDate: new Date().toISOString(),
    nextCollectionDate: getNextMonthFirstDay(),
  };
}

function generateAutogiroPaymentData(config: any, paymentId: string) {
  return {
    autogiroPaymentId: paymentId,
    mandateId: `AG-${Date.now() - 10000}`, // Reference to existing mandate
    paymentDetails: {
      amount: config.amount,
      currency: config.currency,
      dueDate: new Date().toISOString().split('T')[0],
      reference: config.payment_reference,
    },
    payerAccount: {
      clearingNumber: config.clearing_number,
      accountNumber: config.account_number,
      accountHolder: config.payer_name,
    },
    payeeAccount: {
      clearingNumber: '8000',
      accountNumber: '11111111111',
      bgNumber: '123-4567',
    },
    status: 'COMPLETED',
    processingDate: new Date().toISOString().split('T')[0],
    settlementDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Next day
  };
}

function generateStandingOrderData(config: any) {
  return {
    standingOrderId: `SO-${Date.now()}`,
    paymentInstruction: {
      amount: config.amount,
      currency: config.currency,
      frequency: 'MONTHLY',
      executionRule: 'FOLLOWING', // If due date is weekend/holiday, execute following business day
      startDate: getNextMonthFirstDay(),
      endDate: null, // Indefinite
    },
    debtorAccount: {
      clearingNumber: config.clearing_number,
      accountNumber: config.account_number,
      accountHolder: config.payer_name,
    },
    creditorAccount: {
      clearingNumber: '8000',
      accountNumber: '11111111111',
      accountHolder: 'BRF Mottagare',
    },
    remittanceInformation: config.payment_reference,
    status: 'ACTIVE',
    nextExecutionDate: getNextMonthFirstDay(),
  };
}

function generateAccountStatusData(config: any, status: string) {
  return {
    accountIdentification: {
      clearingNumber: config.clearing_number,
      accountNumber: config.account_number,
    },
    accountHolder: config.payer_name,
    statusChange: {
      previousStatus: 'ACTIVE',
      newStatus: status.toUpperCase(),
      effectiveDate: new Date().toISOString(),
      reason: status === 'blocked' ? 'SECURITY_REVIEW' : 'ADMINISTRATIVE',
      reasonDescription: status === 'blocked' 
        ? 'Konto tillfälligt blockerat för säkerhetsgranskning'
        : 'Administrativ åtgärd',
    },
    impactedServices: [
      'outgoing_payments',
      'standing_orders',
      'autogiro_setup',
    ],
    estimatedResolution: status === 'blocked' 
      ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days
      : null,
  };
}

function generatePSD2Data(config: any) {
  return {
    consentId: `CONSENT-${Date.now()}`,
    tppId: 'BRF_PORTAL_TPP_ID',
    permissions: [
      'ReadAccountsBasic',
      'ReadAccountsDetail',
      'ReadBalances',
      'ReadTransactionsBasic',
      'ReadTransactionsCredits',
      'ReadTransactionsDebits',
    ],
    expirationDateTime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    statusUpdateDateTime: new Date().toISOString(),
    strongCustomerAuthentication: {
      required: true,
      method: 'BANKID',
      completed: true,
      completedAt: new Date().toISOString(),
    },
    regulatoryCompliance: {
      psd2Compliant: true,
      gdprCompliant: true,
      dataRetentionPeriod: '13_months',
      auditTrail: true,
    },
  };
}

// Utility functions

function getBankName(bankCode: string): string {
  const bankNames = {
    swedbank: 'Swedbank AB',
    handelsbanken: 'Svenska Handelsbanken AB',
    seb: 'Skandinaviska Enskilda Banken AB',
    nordea: 'Nordea Bank Abp',
    danske_bank: 'Danske Bank A/S',
    sbab: 'SBAB Bank AB',
  };
  return bankNames[bankCode] || 'Unknown Bank';
}

function getBankBIC(bankCode: string): string {
  const bankBICs = {
    swedbank: 'SWEDSESS',
    handelsbanken: 'HANDSESS',
    seb: 'ESSESESS',
    nordea: 'NDEASESS',
    danske_bank: 'DABASESX',
    sbab: 'SBABSESS',
  };
  return bankBICs[bankCode] || 'UNKNSESS';
}

function generateCreditorAccount(bankCode: string): string {
  const clearingNumbers = {
    swedbank: '8000',
    handelsbanken: '6000',
    seb: '5000',
    nordea: '3000',
    danske_bank: '1200',
    sbab: '9250',
  };
  const clearing = clearingNumbers[bankCode] || '8000';
  const accountNumber = Math.floor(Math.random() * 10000000000).toString().padStart(11, '0');
  return `${clearing}${accountNumber}`;
}

function generateSwedishIBAN(clearingNumber: string, accountNumber: string): string {
  // Simplified IBAN generation for Swedish accounts
  const bankCode = clearingNumber.padStart(4, '0');
  const account = accountNumber.padStart(16, '0').substring(0, 16);
  const checkDigits = '00'; // Simplified - real IBAN has calculated check digits
  return `SE${checkDigits}${bankCode}${account}`;
}

function generateSwedishOrgNumber(): string {
  const first6 = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const orgDigit = Math.floor(Math.random() * 5) + 5; // 5-9 for organizations
  const last3 = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${first6}-${orgDigit}${last3}`;
}

function getNextMonthFirstDay(): string {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  return nextMonth.toISOString().split('T')[0];
}

function getFailureDescription(reasonCode?: string): string {
  const descriptions = {
    INSUFFICIENT_FUNDS: 'Otillräckligt saldo på kontot',
    INVALID_ACCOUNT: 'Ogiltigt kontonummer',
    ACCOUNT_BLOCKED: 'Kontot är blockerat',
    TECH: 'Tekniskt fel',
    TIMEOUT: 'Timeout vid behandling',
    INVALID_AMOUNT: 'Ogiltigt belopp',
    LIMIT_EXCEEDED: 'Beloppsgräns överskrides',
  };
  return descriptions[reasonCode] || 'Okänt fel uppstod';
}

function getFailureDetails(reasonCode?: string): string {
  const details = {
    INSUFFICIENT_FUNDS: 'Kontrollera kontosaldot och försök igen',
    INVALID_ACCOUNT: 'Verifiera clearingnummer och kontonummer',
    ACCOUNT_BLOCKED: 'Kontakta din bank för mer information',
    TECH: 'Försök igen senare eller kontakta support',
    TIMEOUT: 'Systemet svarade inte inom förväntat tid',
    INVALID_AMOUNT: 'Beloppet måste vara positivt och inom tillåtna gränser',
    LIMIT_EXCEEDED: 'Kontakta din bank för höjning av beloppsgräns',
  };
  return details[reasonCode] || 'Kontakta din bank för mer information';
}