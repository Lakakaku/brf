import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const FortnoxMockConfigSchema = z.object({
  scenario: z.enum(['invoice_created', 'invoice_paid', 'invoice_overdue', 'customer_created', 'article_updated', 'voucher_created']).default('invoice_created'),
  delay_seconds: z.number().min(0).max(300).default(1),
  customer_number: z.string().optional().default('1001'),
  customer_name: z.string().optional().default('Testbostadsrättsförening'),
  amount: z.number().positive().optional().default(15000),
  currency: z.string().optional().default('SEK'),
  include_vat: z.boolean().default(true),
});

/**
 * POST /api/webhooks/mocks/fortnox - Mock Fortnox accounting events
 * Simulates Swedish Fortnox accounting system webhooks for BRF management
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = FortnoxMockConfigSchema.parse(body);
    const cooperativeId = body.cooperative_id;

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const transactionId = crypto.randomUUID();
    const documentNumber = Math.floor(Math.random() * 10000) + 1000;
    
    // Generate scenario-specific data
    const scenarios = {
      invoice_created: {
        event_type: 'fortnox.invoice.created',
        data: generateInvoiceData(config, documentNumber, 'created'),
      },
      invoice_paid: {
        event_type: 'fortnox.invoice.paid',
        data: generateInvoiceData(config, documentNumber, 'paid'),
      },
      invoice_overdue: {
        event_type: 'fortnox.invoice.overdue',
        data: generateInvoiceData(config, documentNumber, 'overdue'),
      },
      customer_created: {
        event_type: 'fortnox.customer.created',
        data: generateCustomerData(config),
      },
      article_updated: {
        event_type: 'fortnox.article.updated',
        data: generateArticleData(config),
      },
      voucher_created: {
        event_type: 'fortnox.voucher.created',
        data: generateVoucherData(config, documentNumber),
      },
    };

    const scenarioData = scenarios[config.scenario];

    // Create webhook payload
    const webhookPayload = {
      ...scenarioData.data,
      EventType: getEventType(config.scenario),
      EntityType: getEntityType(config.scenario),
      Timestamp: new Date().toISOString(),
      Source: 'Fortnox',
      ApiVersion: '3.0',
      TransactionId: transactionId,
      CompanyId: cooperativeId,
      WebhookId: crypto.randomUUID(),
    };

    // Send webhook simulation
    const webhookResponse = await fetch(`${request.nextUrl.origin}/api/webhooks/simulator/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cooperative_id: cooperativeId,
        event_type: scenarioData.event_type,
        service_type: 'fortnox',
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
      message: 'Fortnox mock event initiated',
      scenario: config.scenario,
      document_number: documentNumber,
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

    console.error('Fortnox mock error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Fortnox mock event' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/mocks/fortnox - Get Fortnox mock configuration options
 */
export async function GET() {
  return NextResponse.json({
    scenarios: [
      {
        id: 'invoice_created',
        name: 'Invoice Created',
        description: 'New invoice created in Fortnox (e.g., monthly fees)',
        entity_type: 'Invoice',
        typical_data: 'Customer info, invoice rows, amounts, due dates',
      },
      {
        id: 'invoice_paid',
        name: 'Invoice Paid',
        description: 'Invoice payment received and processed',
        entity_type: 'Invoice',
        typical_data: 'Payment date, amount, payment method',
      },
      {
        id: 'invoice_overdue',
        name: 'Invoice Overdue',
        description: 'Invoice past due date, triggers reminder process',
        entity_type: 'Invoice',
        typical_data: 'Days overdue, reminder level, late fees',
      },
      {
        id: 'customer_created',
        name: 'Customer Created',
        description: 'New customer/member added to Fortnox',
        entity_type: 'Customer',
        typical_data: 'Customer details, default settings',
      },
      {
        id: 'article_updated',
        name: 'Article Updated',
        description: 'Service/fee article updated (e.g., monthly fee rate)',
        entity_type: 'Article',
        typical_data: 'Price changes, description updates',
      },
      {
        id: 'voucher_created',
        name: 'Voucher Created',
        description: 'Accounting voucher created for transaction',
        entity_type: 'Voucher',
        typical_data: 'Accounting entries, account codes, amounts',
      },
    ],
    webhook_events: [
      'fortnox.invoice.created',
      'fortnox.invoice.updated',
      'fortnox.invoice.paid',
      'fortnox.invoice.overdue',
      'fortnox.customer.created',
      'fortnox.customer.updated',
      'fortnox.article.created',
      'fortnox.article.updated',
      'fortnox.voucher.created',
      'fortnox.voucher.approved',
    ],
    brf_use_cases: [
      'Monthly fee invoicing',
      'Payment tracking and reconciliation',
      'Member billing management',
      'Maintenance cost accounting',
      'Budget vs actual reporting',
      'Year-end financial preparation',
    ],
  });
}

// Helper functions for generating mock Fortnox data

function generateInvoiceData(config: any, documentNumber: number, status: string) {
  const baseAmount = config.amount;
  const vatRate = config.include_vat ? 0.25 : 0; // 25% Swedish VAT
  const vatAmount = config.include_vat ? Math.round(baseAmount * vatRate / (1 + vatRate)) : 0;
  const netAmount = baseAmount - vatAmount;

  const invoice = {
    DocumentNumber: documentNumber,
    CustomerNumber: config.customer_number,
    CustomerName: config.customer_name,
    InvoiceDate: new Date().toISOString().split('T')[0],
    DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    Currency: config.currency,
    CurrencyRate: 1,
    VATIncluded: config.include_vat,
    Total: baseAmount,
    NetSum: netAmount,
    VATSum: vatAmount,
    RoundingAmount: 0,
    Balance: status === 'paid' ? 0 : baseAmount,
    Remarks: getBRFInvoiceRemarks(status),
    YourReference: 'Styrelsen',
    OurReference: 'BRF System',
    InvoiceRows: [
      {
        ArticleNumber: 'MA001',
        Description: 'Månadsavgift',
        Price: netAmount,
        Unit: 'st',
        DeliveredQuantity: 1,
        Total: netAmount,
        VAT: vatAmount,
        AccountNumber: 3010, // Swedish account for rental income
      },
    ],
  };

  if (status === 'paid') {
    invoice['PaymentDate'] = new Date().toISOString().split('T')[0];
    invoice['PaymentMethod'] = 'Autogiro';
    invoice['PaymentReference'] = `PAY-${documentNumber}`;
  } else if (status === 'overdue') {
    invoice['DaysOverdue'] = 15;
    invoice['ReminderLevel'] = 1;
    invoice['ReminderFee'] = 60; // Standard Swedish reminder fee
    invoice['InterestAmount'] = Math.round(baseAmount * 0.08 * 15 / 365); // 8% annual interest
  }

  return { Data: invoice };
}

function generateCustomerData(config: any) {
  return {
    Data: {
      CustomerNumber: config.customer_number,
      Name: config.customer_name,
      OrganisationNumber: '556123-1234', // Mock Swedish organization number
      Type: 'COMPANY',
      Address1: 'Testgatan 123',
      ZipCode: '12345',
      City: 'Stockholm',
      Country: 'SE',
      Phone1: '08-123 456 78',
      Email: 'styrelsen@testbrf.se',
      Currency: config.currency,
      VATType: 'SEVAT', // Swedish VAT
      PaymentTerms: 'NET30',
      DeliveryTerms: 'EXW',
      PriceList: 'A',
      YourReference: 'Styrelsen',
      DefaultTemplates: {
        Invoice: 'BRF_INVOICE_TEMPLATE',
        Reminder: 'BRF_REMINDER_TEMPLATE',
      },
    },
  };
}

function generateArticleData(config: any) {
  return {
    Data: {
      ArticleNumber: 'MA001',
      Description: 'Månadsavgift BRF',
      Type: 'SERVICE',
      Unit: 'st',
      Price: config.amount,
      PurchasePrice: 0,
      VATPercent: config.include_vat ? 25 : 0,
      AccountNumber: 3010, // Revenue account
      CostAccountNumber: null,
      Active: true,
      StockPlace: null,
      StockAccount: null,
      StockGoods: false,
      Note: 'Månadsavgift för bostadsrättsförening',
      EAN: null,
      Expired: false,
      SalesAccount: 3010,
      PurchaseAccount: 4010,
    },
  };
}

function generateVoucherData(config: any, documentNumber: number) {
  const amount = config.amount;
  
  return {
    Data: {
      VoucherNumber: documentNumber,
      VoucherSeries: 'A', // Main series
      TransactionDate: new Date().toISOString().split('T')[0],
      Description: `Månadsavgift ${config.customer_name}`,
      VoucherRows: [
        {
          Account: 1511, // Kundfordringar (Accounts Receivable)
          Debit: amount,
          Credit: 0,
          TransactionInformation: `Faktura ${documentNumber}`,
          CostCenter: 'BRF',
          Project: null,
        },
        {
          Account: 3010, // Hyresintäkter (Rental Income)
          Debit: 0,
          Credit: amount,
          TransactionInformation: `Månadsavgift ${config.customer_name}`,
          CostCenter: 'BRF',
          Project: null,
        },
      ],
      Year: new Date().getFullYear(),
      ReferenceNumber: `REF-${documentNumber}`,
      ReferenceType: 'INVOICE',
      ApprovalState: 0, // 0 = Not approved, 1 = Approved
    },
  };
}

function getEventType(scenario: string): string {
  const eventMap = {
    invoice_created: 'create',
    invoice_paid: 'update',
    invoice_overdue: 'update',
    customer_created: 'create',
    article_updated: 'update',
    voucher_created: 'create',
  };
  return eventMap[scenario] || 'update';
}

function getEntityType(scenario: string): string {
  const entityMap = {
    invoice_created: 'Invoice',
    invoice_paid: 'Invoice',
    invoice_overdue: 'Invoice',
    customer_created: 'Customer',
    article_updated: 'Article',
    voucher_created: 'Voucher',
  };
  return entityMap[scenario] || 'Unknown';
}

function getBRFInvoiceRemarks(status: string): string {
  const remarks = {
    created: 'Månadsavgift för bostadsrättsförening. Förfallodag: 30 dagar.',
    paid: 'Tack för er betalning! Månadsavgiften är betald.',
    overdue: 'FÖRSENINGSAVGIFT: Månadsavgiften är försenad. Påminnelseavgift tillkommer.',
  };
  return remarks[status] || 'Månadsavgift bostadsrättsförening';
}