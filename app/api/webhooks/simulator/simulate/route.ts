import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { z } from 'zod';

const SimulateEventSchema = z.object({
  event_type: z.string().min(1),
  service_type: z.enum(['bankid', 'fortnox', 'kivra', 'payment', 'notification', 'custom']),
  payload: z.record(z.any()),
  target_endpoints: z.array(z.string()).optional(),
  delay_seconds: z.number().optional().default(0),
  correlation_id: z.string().optional(),
});

/**
 * POST /api/webhooks/simulator/simulate - Simulate webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = SimulateEventSchema.parse(body);

    if (!body.cooperative_id) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Get target endpoints
    let endpoints = [];
    if (validatedData.target_endpoints && validatedData.target_endpoints.length > 0) {
      // Simulate to specific endpoints
      const placeholders = validatedData.target_endpoints.map(() => '?').join(',');
      endpoints = db.prepare(`
        SELECT * FROM webhook_endpoints 
        WHERE id IN (${placeholders}) 
        AND cooperative_id = ? 
        AND is_active = 1 
        AND deleted_at IS NULL
      `).all(...validatedData.target_endpoints, body.cooperative_id);
    } else {
      // Simulate to all active endpoints for this service type
      endpoints = db.prepare(`
        SELECT * FROM webhook_endpoints 
        WHERE cooperative_id = ? 
        AND service_type = ? 
        AND is_active = 1 
        AND deleted_at IS NULL
      `).all(body.cooperative_id, validatedData.service_type);
    }

    if (endpoints.length === 0) {
      return NextResponse.json(
        { error: 'No active webhook endpoints found for simulation' },
        { status: 404 }
      );
    }

    const simulatedEvents = [];

    // Create events for each endpoint
    for (const endpoint of endpoints) {
      // Generate event ID
      const eventId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const correlationId = validatedData.correlation_id || `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Enhance payload with BRF-specific context based on service type
      const enhancedPayload = enhancePayloadForService(
        validatedData.service_type, 
        validatedData.payload,
        body.cooperative_id
      );

      // Create webhook event
      const eventDbId = crypto.randomUUID().replace(/-/g, '');
      const stmt = db.prepare(`
        INSERT INTO webhook_events (
          id, cooperative_id, endpoint_id, event_id, event_type, source_service,
          correlation_id, payload, payload_size, headers_received,
          delivery_status, is_test_event, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const payloadJson = JSON.stringify(enhancedPayload);
      const headersReceived = JSON.stringify({
        'Content-Type': 'application/json',
        'X-Webhook-Simulator': 'true',
        'X-Simulation-Service': validatedData.service_type,
      });

      stmt.run(
        eventDbId,
        body.cooperative_id,
        endpoint.id,
        eventId,
        validatedData.event_type,
        validatedData.service_type,
        correlationId,
        payloadJson,
        Buffer.byteLength(payloadJson, 'utf8'),
        headersReceived,
        'pending',
        1, // is_test_event = true
        request.headers.get('x-forwarded-for') || '127.0.0.1',
        request.headers.get('user-agent') || 'Webhook-Simulator'
      );

      // Schedule delivery (with delay if specified)
      if (validatedData.delay_seconds > 0) {
        // In a real implementation, you'd use a job queue here
        // For now, we'll just set the event as 'pending'
        simulatedEvents.push({
          event_id: eventId,
          endpoint_id: endpoint.id,
          endpoint_name: endpoint.name,
          endpoint_url: endpoint.url,
          scheduled_delivery: new Date(Date.now() + validatedData.delay_seconds * 1000).toISOString(),
        });
      } else {
        // Deliver immediately
        try {
          await deliverWebhook(eventDbId, endpoint, enhancedPayload, correlationId);
          simulatedEvents.push({
            event_id: eventId,
            endpoint_id: endpoint.id,
            endpoint_name: endpoint.name,
            endpoint_url: endpoint.url,
            delivered: true,
          });
        } catch (error) {
          simulatedEvents.push({
            event_id: eventId,
            endpoint_id: endpoint.id,
            endpoint_name: endpoint.name,
            endpoint_url: endpoint.url,
            delivered: false,
            error: error.message,
          });
        }
      }
    }

    return NextResponse.json({
      message: 'Webhook simulation initiated',
      service_type: validatedData.service_type,
      event_type: validatedData.event_type,
      correlation_id: validatedData.correlation_id,
      simulated_events: simulatedEvents,
      total_endpoints: endpoints.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to simulate webhook events:', error);
    return NextResponse.json(
      { error: 'Failed to simulate webhook events' },
      { status: 500 }
    );
  }
}

/**
 * Enhance payload with service-specific Swedish BRF context
 */
function enhancePayloadForService(serviceType: string, payload: any, cooperativeId: string) {
  const basePayload = {
    ...payload,
    timestamp: new Date().toISOString(),
    cooperative_id: cooperativeId,
    environment: 'simulation',
  };

  switch (serviceType) {
    case 'bankid':
      return {
        ...basePayload,
        orderRef: payload.orderRef || `sim_${Date.now()}`,
        status: payload.status || 'complete',
        hintCode: payload.hintCode || 'userSign',
        completionData: payload.completionData || {
          user: {
            personalNumber: '198001011234',
            name: 'Test Testsson',
            givenName: 'Test',
            surname: 'Testsson',
          },
          device: {
            ipAddress: '192.168.1.100',
            uhi: 'simulation-device',
          },
          cert: {
            notBefore: new Date().toISOString(),
            notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          },
          signature: 'simulated-signature-data',
          ocspResponse: 'simulated-ocsp-response',
        },
      };

    case 'fortnox':
      return {
        ...basePayload,
        Data: payload.Data || {
          DocumentNumber: Math.floor(Math.random() * 10000),
          CustomerNumber: '1001',
          CustomerName: 'Testbostadsrättsförening',
          InvoiceDate: new Date().toISOString().split('T')[0],
          DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          Total: 15000,
          Currency: 'SEK',
          VATIncluded: true,
          Remarks: 'Månadsavgift BRF Test',
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
        EventType: payload.EventType || 'create',
        EntityType: 'Invoice',
      };

    case 'kivra':
      return {
        ...basePayload,
        messageId: payload.messageId || crypto.randomUUID(),
        recipientId: payload.recipientId || '198001011234',
        senderId: payload.senderId || cooperativeId,
        messageType: payload.messageType || 'invoice',
        subject: payload.subject || 'Månadsavgift BRF',
        content: payload.content || {
          documentType: 'invoice',
          amount: 15000,
          currency: 'SEK',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          reference: `INV-${Date.now()}`,
        },
        status: payload.status || 'delivered',
        deliveryReceipt: {
          delivered: true,
          deliveredAt: new Date().toISOString(),
          readAt: payload.readAt || null,
        },
      };

    case 'payment':
      return {
        ...basePayload,
        paymentId: payload.paymentId || crypto.randomUUID(),
        amount: payload.amount || 15000,
        currency: payload.currency || 'SEK',
        reference: payload.reference || `PAY-${Date.now()}`,
        payerReference: payload.payerReference || '1001',
        status: payload.status || 'completed',
        paymentMethod: payload.paymentMethod || 'autogiro',
        transactionId: payload.transactionId || `TXN-${Date.now()}`,
        processedAt: new Date().toISOString(),
        settlementDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fees: payload.fees || {
          transactionFee: 5,
          currency: 'SEK',
        },
      };

    case 'notification':
      return {
        ...basePayload,
        notificationId: payload.notificationId || crypto.randomUUID(),
        type: payload.type || 'system_update',
        priority: payload.priority || 'medium',
        title: payload.title || 'System Update',
        message: payload.message || 'Ett systemuppdatering har genomförts',
        channels: payload.channels || ['email', 'app'],
        targetAudience: payload.targetAudience || 'all_members',
        actionRequired: payload.actionRequired || false,
        expiresAt: payload.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

    default:
      return basePayload;
  }
}

/**
 * Deliver webhook to endpoint (simplified version for simulation)
 */
async function deliverWebhook(eventDbId: string, endpoint: any, payload: any, correlationId: string) {
  const db = getDatabase();
  
  const startTime = Date.now();
  let response: Response | null = null;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'BRF-Webhook-Simulator/1.0',
      'X-Webhook-Event-Type': payload.event_type || 'simulation',
      'X-Webhook-Source': 'simulation',
      'X-Webhook-Correlation-ID': correlationId,
      'X-Webhook-Timestamp': new Date().toISOString(),
      'X-Webhook-Simulator': 'true',
      ...JSON.parse(endpoint.headers || '{}'),
    };

    // Add signature if endpoint has secret
    if (endpoint.secret) {
      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(payloadString)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Make the webhook request
    response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(endpoint.timeout_seconds * 1000),
    });

    const responseTime = Date.now() - startTime;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody = '';
    try {
      responseBody = await response.text();
    } catch (e) {
      // Ignore response body read errors
    }

    // Update event with delivery result
    if (response.ok) {
      db.prepare(`
        UPDATE webhook_events 
        SET delivery_status = 'delivered',
            delivery_attempts = 1,
            last_delivery_attempt = datetime('now'),
            response_status_code = ?,
            response_headers = ?,
            response_body = ?,
            response_time_ms = ?,
            processed_at = datetime('now')
        WHERE id = ?
      `).run(
        response.status,
        JSON.stringify(responseHeaders),
        responseBody.slice(0, 10000),
        responseTime,
        eventDbId
      );
    } else {
      throw new Error(`HTTP ${response.status}: ${responseBody}`);
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    db.prepare(`
      UPDATE webhook_events 
      SET delivery_status = 'failed',
          delivery_attempts = 1,
          last_delivery_attempt = datetime('now'),
          response_status_code = ?,
          response_time_ms = ?,
          error_message = ?
      WHERE id = ?
    `).run(
      response?.status || null,
      responseTime,
      error.message.slice(0, 1000),
      eventDbId
    );

    throw error;
  }
}