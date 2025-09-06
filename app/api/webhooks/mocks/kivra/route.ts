import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const KivraMockConfigSchema = z.object({
  scenario: z.enum(['message_delivered', 'message_read', 'message_failed', 'delivery_receipt', 'message_expired']).default('message_delivered'),
  delay_seconds: z.number().min(0).max(300).default(2),
  recipient_id: z.string().optional().default('198001011234'), // Swedish personal number
  message_type: z.enum(['invoice', 'notice', 'reminder', 'information', 'contract']).default('invoice'),
  subject: z.string().optional().default('Månadsavgift BRF'),
  language: z.enum(['sv', 'en']).default('sv'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

/**
 * POST /api/webhooks/mocks/kivra - Mock Kivra digital mailbox events
 * Simulates Swedish Kivra digital postal service webhooks for BRF communications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = KivraMockConfigSchema.parse(body);
    const cooperativeId = body.cooperative_id;

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const messageId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    
    // Generate scenario-specific data
    const scenarios = {
      message_delivered: {
        event_type: 'kivra.message.delivered',
        status: 'delivered',
        data: generateMessageData(config, messageId, 'delivered'),
      },
      message_read: {
        event_type: 'kivra.message.read',
        status: 'read',
        data: generateMessageData(config, messageId, 'read'),
      },
      message_failed: {
        event_type: 'kivra.message.failed',
        status: 'failed',
        data: generateMessageData(config, messageId, 'failed'),
      },
      delivery_receipt: {
        event_type: 'kivra.delivery.receipt',
        status: 'receipt',
        data: generateDeliveryReceiptData(config, messageId),
      },
      message_expired: {
        event_type: 'kivra.message.expired',
        status: 'expired',
        data: generateMessageData(config, messageId, 'expired'),
      },
    };

    const scenarioData = scenarios[config.scenario];

    // Create webhook payload with Kivra-specific structure
    const webhookPayload = {
      messageId: messageId,
      recipientId: config.recipient_id,
      senderId: cooperativeId,
      messageType: config.message_type,
      subject: config.subject,
      language: config.language,
      priority: config.priority,
      status: scenarioData.status,
      timestamp: new Date().toISOString(),
      eventType: scenarioData.event_type,
      ...scenarioData.data,
      metadata: {
        source: 'Kivra',
        apiVersion: '2.0',
        transactionId: transactionId,
        environment: 'simulation',
        deliveryMethod: 'digital_mailbox',
      },
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
        service_type: 'kivra',
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
      message: 'Kivra mock event initiated',
      scenario: config.scenario,
      message_id: messageId,
      recipient_id: config.recipient_id,
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

    console.error('Kivra mock error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Kivra mock event' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/mocks/kivra - Get Kivra mock configuration options
 */
export async function GET() {
  return NextResponse.json({
    scenarios: [
      {
        id: 'message_delivered',
        name: 'Message Delivered',
        description: 'Message successfully delivered to recipient\'s digital mailbox',
        typical_duration: '1-5 minutes',
      },
      {
        id: 'message_read',
        name: 'Message Read',
        description: 'Recipient has opened and read the message',
        typical_duration: '1 hour - several days',
      },
      {
        id: 'message_failed',
        name: 'Delivery Failed',
        description: 'Message delivery failed (no Kivra account, blocked, etc.)',
        typical_duration: '1-10 minutes',
      },
      {
        id: 'delivery_receipt',
        name: 'Delivery Receipt',
        description: 'Official delivery receipt with legal timestamp',
        typical_duration: '5-15 minutes',
      },
      {
        id: 'message_expired',
        name: 'Message Expired',
        description: 'Message expired before being read (typically after 90 days)',
        typical_duration: '90 days',
      },
    ],
    message_types: [
      {
        type: 'invoice',
        description: 'Invoice documents (fakturor)',
        retention: '7 years',
        legal_value: 'High',
      },
      {
        type: 'notice',
        description: 'Official notices (meddelanden)',
        retention: '3 years',
        legal_value: 'Medium',
      },
      {
        type: 'reminder',
        description: 'Payment reminders (påminnelser)',
        retention: '3 years',
        legal_value: 'High',
      },
      {
        type: 'information',
        description: 'General information (information)',
        retention: '1 year',
        legal_value: 'Low',
      },
      {
        type: 'contract',
        description: 'Contracts and agreements (avtal)',
        retention: '10 years',
        legal_value: 'Very High',
      },
    ],
    webhook_events: [
      'kivra.message.sent',
      'kivra.message.delivered',
      'kivra.message.read',
      'kivra.message.failed',
      'kivra.message.expired',
      'kivra.delivery.receipt',
      'kivra.recipient.status_changed',
    ],
    brf_use_cases: [
      'Monthly fee invoices with legal delivery confirmation',
      'Meeting notices with read receipts',
      'Important announcements to all members',
      'Contract amendments and updates',
      'Payment reminders with certified delivery',
      'Annual reports and financial statements',
    ],
    test_recipients: [
      { id: '198001011234', name: 'Test Testsson', has_kivra: true },
      { id: '198501011234', name: 'Anna Andersson', has_kivra: false },
      { id: '197001011234', name: 'Erik Eriksson', has_kivra: true, blocks_sender: false },
    ],
  });
}

// Helper functions for generating mock Kivra data

function generateMessageData(config: any, messageId: string, status: string) {
  const baseData = {
    content: generateBRFMessageContent(config.message_type, config.language),
    deliveryDetails: {
      method: 'digital_mailbox',
      channel: 'kivra_app',
      deliveredAt: new Date().toISOString(),
    },
    senderInfo: {
      name: 'Testbostadsrättsförening',
      organizationNumber: '556123-1234',
      contactEmail: 'styrelsen@testbrf.se',
      contactPhone: '08-123 456 78',
    },
    recipientInfo: {
      recipientId: config.recipient_id,
      hasKivra: true,
      preferredLanguage: config.language,
    },
  };

  switch (status) {
    case 'delivered':
      return {
        ...baseData,
        deliveryReceipt: {
          delivered: true,
          deliveredAt: new Date().toISOString(),
          deliveryMethod: 'kivra_app',
          legallyBinding: true,
        },
      };

    case 'read':
      return {
        ...baseData,
        deliveryReceipt: {
          delivered: true,
          deliveredAt: new Date(Date.now() - 60000).toISOString(),
          readAt: new Date().toISOString(),
          deliveryMethod: 'kivra_app',
          legallyBinding: true,
        },
        readReceipt: {
          read: true,
          readAt: new Date().toISOString(),
          readFromDevice: 'mobile_app',
          ipAddress: '192.168.1.100',
        },
      };

    case 'failed':
      return {
        ...baseData,
        deliveryReceipt: {
          delivered: false,
          failedAt: new Date().toISOString(),
          failureReason: getRandomFailureReason(),
          fallbackMethod: 'physical_mail',
          fallbackRequired: true,
        },
        recipientInfo: {
          ...baseData.recipientInfo,
          hasKivra: false,
        },
      };

    case 'expired':
      return {
        ...baseData,
        deliveryReceipt: {
          delivered: true,
          deliveredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          expiredAt: new Date().toISOString(),
          deliveryMethod: 'kivra_app',
          legallyBinding: true,
        },
        expirationInfo: {
          expired: true,
          expirationDate: new Date().toISOString(),
          retentionPeriod: 90,
          autoDeleted: true,
        },
      };

    default:
      return baseData;
  }
}

function generateDeliveryReceiptData(config: any, messageId: string) {
  return {
    receipt: {
      messageId: messageId,
      recipientId: config.recipient_id,
      deliveryTimestamp: new Date().toISOString(),
      deliveryMethod: 'kivra_digital_mailbox',
      legalStatus: 'legally_delivered',
      certificateId: `CERT-${Date.now()}`,
      signatureHash: generateMockSignatureHash(messageId),
    },
    verification: {
      method: 'digital_signature',
      algorithm: 'SHA-256',
      timestamp: new Date().toISOString(),
      authority: 'Kivra AB',
      certificateChain: ['kivra-root-ca', 'kivra-delivery-cert'],
    },
    legalCompliance: {
      gdpr_compliant: true,
      retention_period: '7_years',
      audit_trail: true,
      evidential_value: 'high',
    },
  };
}

function generateBRFMessageContent(messageType: string, language: string) {
  const content = {
    invoice: {
      sv: {
        documentType: 'invoice',
        title: 'Faktura - Månadsavgift',
        description: 'Månadsavgift för bostadsrättsförening',
        amount: 15000,
        currency: 'SEK',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        reference: `INV-${Date.now()}`,
        ocrNumber: generateOCRNumber(),
        bankgiro: '123-4567',
        attachments: [
          {
            filename: 'faktura_månadsavgift.pdf',
            mimeType: 'application/pdf',
            size: 245760,
          },
        ],
      },
      en: {
        documentType: 'invoice',
        title: 'Invoice - Monthly Fee',
        description: 'Monthly fee for housing cooperative',
        amount: 15000,
        currency: 'SEK',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        reference: `INV-${Date.now()}`,
        ocrNumber: generateOCRNumber(),
        bankgiro: '123-4567',
        attachments: [
          {
            filename: 'invoice_monthly_fee.pdf',
            mimeType: 'application/pdf',
            size: 245760,
          },
        ],
      },
    },
    notice: {
      sv: {
        documentType: 'notice',
        title: 'Meddelande från styrelsen',
        content: 'Information om kommande stämma och viktiga beslut.',
        meetingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        location: 'Föreningslokalen',
        agenda: ['Årsredovisning', 'Budget 2024', 'Underhållsplan'],
      },
      en: {
        documentType: 'notice',
        title: 'Notice from the Board',
        content: 'Information about upcoming meeting and important decisions.',
        meetingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        location: 'Community Room',
        agenda: ['Annual Report', 'Budget 2024', 'Maintenance Plan'],
      },
    },
    reminder: {
      sv: {
        documentType: 'reminder',
        title: 'Påminnelse - Förfallen betalning',
        originalInvoice: `INV-${Date.now() - 1000000}`,
        originalAmount: 15000,
        reminderFee: 60,
        totalAmount: 15060,
        daysOverdue: 15,
        newDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        consequences: 'Inkasso och extra avgifter kan tillkomma vid fortsatt dröjsmål.',
      },
      en: {
        documentType: 'reminder',
        title: 'Reminder - Overdue Payment',
        originalInvoice: `INV-${Date.now() - 1000000}`,
        originalAmount: 15000,
        reminderFee: 60,
        totalAmount: 15060,
        daysOverdue: 15,
        newDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        consequences: 'Collection and additional fees may apply for continued delay.',
      },
    },
  };

  return content[messageType]?.[language] || content.invoice[language];
}

function generateOCRNumber(): string {
  // Generate a Swedish OCR number (reference number with check digit)
  const base = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
  const checkDigit = calculateLuhnCheckDigit(base);
  return base + checkDigit;
}

function calculateLuhnCheckDigit(number: string): string {
  // Simplified Luhn algorithm for OCR check digit
  let sum = 0;
  let alternate = true;
  
  for (let i = number.length - 1; i >= 0; i--) {
    let n = parseInt(number.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n = (n % 10) + 1;
    }
    sum += n;
    alternate = !alternate;
  }
  
  return ((10 - (sum % 10)) % 10).toString();
}

function generateMockSignatureHash(messageId: string): string {
  // Generate a mock signature hash for the delivery receipt
  const data = messageId + new Date().toISOString();
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getRandomFailureReason(): string {
  const reasons = [
    'recipient_no_kivra_account',
    'recipient_blocked_sender',
    'recipient_mailbox_full',
    'invalid_recipient_id',
    'temporary_service_unavailable',
    'content_rejected_by_filter',
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
}