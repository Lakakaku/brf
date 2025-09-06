import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const BankIDMockConfigSchema = z.object({
  scenario: z.enum(['success', 'user_cancel', 'timeout', 'start_failed', 'expired_transaction']).default('success'),
  delay_seconds: z.number().min(0).max(300).default(3),
  personal_number: z.string().optional().default('198001011234'),
  user_name: z.string().optional().default('Test Testsson'),
  signature_type: z.enum(['simple', 'advanced']).default('advanced'),
  auto_start: z.boolean().default(true),
});

/**
 * POST /api/webhooks/mocks/bankid - Mock BankID authentication flow
 * Simulates the Swedish BankID authentication process for testing webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = BankIDMockConfigSchema.parse(body);
    const cooperativeId = body.cooperative_id;

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    // Generate mock BankID transaction
    const orderRef = `mock_bankid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transactionId = crypto.randomUUID();

    // Simulate different scenarios
    const scenarios = {
      success: {
        status: 'complete',
        hintCode: 'userSign',
        completionData: {
          user: {
            personalNumber: config.personal_number,
            name: config.user_name,
            givenName: config.user_name.split(' ')[0],
            surname: config.user_name.split(' ').slice(1).join(' ') || 'Testsson',
          },
          device: {
            ipAddress: request.headers.get('x-forwarded-for') || '192.168.1.100',
            uhi: 'mock-device-' + Math.random().toString(36).substr(2, 9),
          },
          cert: {
            notBefore: new Date().toISOString(),
            notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          },
          signature: generateMockSignature(orderRef),
          ocspResponse: generateMockOCSP(),
        },
      },
      user_cancel: {
        status: 'cancelled',
        hintCode: 'userCancel',
        errorCode: 'cancelled',
        details: 'User cancelled the authentication',
      },
      timeout: {
        status: 'failed',
        hintCode: 'expiredTransaction',
        errorCode: 'timeout',
        details: 'Authentication timed out',
      },
      start_failed: {
        status: 'failed',
        hintCode: 'startFailed',
        errorCode: 'startFailed', 
        details: 'Failed to start BankID application',
      },
      expired_transaction: {
        status: 'failed',
        hintCode: 'expiredTransaction',
        errorCode: 'expiredTransaction',
        details: 'Transaction has expired',
      },
    };

    const scenarioData = scenarios[config.scenario];

    // Create webhook payload for different BankID events
    const webhookPayloads = [];

    // 1. Authentication started
    if (config.scenario !== 'start_failed') {
      webhookPayloads.push({
        event_type: 'bankid.auth.started',
        orderRef,
        transactionId,
        status: 'pending',
        hintCode: 'outstandingTransaction',
        personalNumber: config.personal_number,
        timestamp: new Date().toISOString(),
        delay: 0,
      });
    }

    // 2. User sign prompt (if auto_start is false)
    if (!config.auto_start && config.scenario !== 'start_failed') {
      webhookPayloads.push({
        event_type: 'bankid.auth.user_sign',
        orderRef,
        transactionId,
        status: 'pending',
        hintCode: 'userSign',
        personalNumber: config.personal_number,
        timestamp: new Date(Date.now() + 1000).toISOString(),
        delay: 1,
      });
    }

    // 3. Final result
    webhookPayloads.push({
      event_type: `bankid.auth.${scenarioData.status}`,
      orderRef,
      transactionId,
      ...scenarioData,
      personalNumber: config.personal_number,
      timestamp: new Date(Date.now() + config.delay_seconds * 1000).toISOString(),
      delay: config.delay_seconds,
    });

    // Schedule webhook deliveries with appropriate delays
    const scheduledWebhooks = [];
    for (const payload of webhookPayloads) {
      const webhookResponse = await fetch(`${request.nextUrl.origin}/api/webhooks/simulator/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cooperative_id: cooperativeId,
          event_type: payload.event_type,
          service_type: 'bankid',
          payload: payload,
          delay_seconds: payload.delay,
          correlation_id: transactionId,
        }),
      });

      if (webhookResponse.ok) {
        const result = await webhookResponse.json();
        scheduledWebhooks.push({
          event_type: payload.event_type,
          scheduled_delivery: payload.timestamp,
          simulated_events: result.simulated_events,
        });
      }
    }

    return NextResponse.json({
      message: 'BankID mock authentication flow initiated',
      scenario: config.scenario,
      order_ref: orderRef,
      transaction_id: transactionId,
      expected_completion: new Date(Date.now() + config.delay_seconds * 1000).toISOString(),
      scheduled_webhooks: scheduledWebhooks,
      mock_response: {
        orderRef,
        autoStartToken: generateAutoStartToken(),
        qrStartToken: generateQRStartToken(),
        qrStartSecret: generateQRSecret(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: error.errors },
        { status: 400 }
      );
    }

    console.error('BankID mock error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate BankID mock authentication' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/mocks/bankid - Get BankID mock configuration options
 */
export async function GET() {
  return NextResponse.json({
    scenarios: [
      {
        id: 'success',
        name: 'Successful Authentication',
        description: 'Complete authentication flow with user signature',
        typical_duration: '3-10 seconds',
      },
      {
        id: 'user_cancel',
        name: 'User Cancellation',
        description: 'User cancels authentication in BankID app',
        typical_duration: '1-5 seconds',
      },
      {
        id: 'timeout',
        name: 'Authentication Timeout',
        description: 'Authentication expires due to inactivity',
        typical_duration: '30-120 seconds',
      },
      {
        id: 'start_failed',
        name: 'Start Failed',
        description: 'BankID app fails to start or is not installed',
        typical_duration: 'Immediate',
      },
      {
        id: 'expired_transaction',
        name: 'Expired Transaction',
        description: 'Transaction expires before user interaction',
        typical_duration: '60-180 seconds',
      },
    ],
    webhook_events: [
      'bankid.auth.started',
      'bankid.auth.user_sign',
      'bankid.auth.complete',
      'bankid.auth.cancelled', 
      'bankid.auth.failed',
    ],
    test_personal_numbers: [
      { number: '198001011234', name: 'Test Testsson', description: 'Standard test person' },
      { number: '198501011234', name: 'Anna Andersson', description: 'Alternative test person' },
      { number: '197001011234', name: 'Erik Eriksson', description: 'Senior test person' },
    ],
  });
}

// Helper functions for generating mock data
function generateMockSignature(orderRef: string): string {
  // Generate a mock signature that looks realistic but is clearly fake
  const hash = crypto.createHash('sha256').update(orderRef + 'mock-signature').digest('hex');
  return Buffer.from(`mock-signature-${hash.substring(0, 32)}`).toString('base64');
}

function generateMockOCSP(): string {
  // Generate a mock OCSP response
  const timestamp = Date.now().toString();
  return Buffer.from(`mock-ocsp-response-${timestamp}`).toString('base64');
}

function generateAutoStartToken(): string {
  // Generate a mock auto start token
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateQRStartToken(): string {
  // Generate a mock QR start token
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `qr.${timestamp}.${random}`;
}

function generateQRSecret(): string {
  // Generate a mock QR secret
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
}