import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import crypto from 'crypto';

/**
 * POST /api/webhooks/events/[event_id]/replay - Replay a webhook event
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { event_id: string } }
) {
  try {
    const body = await request.json();
    const { cooperative_id, endpoint_id, user_id } = body;

    if (!cooperative_id) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Get original event
    const originalEvent = db.prepare(`
      SELECT * FROM webhook_events 
      WHERE event_id = ? AND cooperative_id = ?
    `).get(params.event_id, cooperative_id);

    if (!originalEvent) {
      return NextResponse.json(
        { error: 'Original webhook event not found' },
        { status: 404 }
      );
    }

    // Determine target endpoint
    let targetEndpoint = null;
    if (endpoint_id) {
      // Replay to specific endpoint
      targetEndpoint = db.prepare(`
        SELECT * FROM webhook_endpoints 
        WHERE id = ? AND cooperative_id = ? AND deleted_at IS NULL
      `).get(endpoint_id, cooperative_id);
    } else {
      // Replay to original endpoint (if it still exists)
      if (originalEvent.endpoint_id) {
        targetEndpoint = db.prepare(`
          SELECT * FROM webhook_endpoints 
          WHERE id = ? AND cooperative_id = ? AND deleted_at IS NULL
        `).get(originalEvent.endpoint_id, cooperative_id);
      }
    }

    if (!targetEndpoint) {
      return NextResponse.json(
        { error: 'Target webhook endpoint not found or inactive' },
        { status: 404 }
      );
    }

    // Create replayed event
    const newEventId = `evt_replay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const stmt = db.prepare(`
      INSERT INTO webhook_events (
        id, cooperative_id, endpoint_id, event_id, event_type, source_service,
        correlation_id, payload, payload_size, headers_received,
        delivery_status, ip_address, user_agent, is_test_event, 
        is_replayed, original_event_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const replayedEventDbId = crypto.randomUUID().replace(/-/g, '');
    
    stmt.run(
      replayedEventDbId,
      cooperative_id,
      targetEndpoint.id,
      newEventId,
      originalEvent.event_type,
      originalEvent.source_service,
      originalEvent.correlation_id,
      originalEvent.payload,
      originalEvent.payload_size,
      originalEvent.headers_received,
      'pending',
      originalEvent.ip_address,
      originalEvent.user_agent,
      originalEvent.is_test_event,
      1, // is_replayed = true
      originalEvent.event_id
    );

    // Attempt to deliver the replayed webhook
    try {
      await deliverWebhook(replayedEventDbId, targetEndpoint);
    } catch (deliveryError) {
      console.error('Failed to deliver replayed webhook:', deliveryError);
      // Update event with failure status
      db.prepare(`
        UPDATE webhook_events 
        SET delivery_status = 'failed', 
            error_message = ?,
            delivery_attempts = 1,
            last_delivery_attempt = datetime('now')
        WHERE id = ?
      `).run(String(deliveryError), replayedEventDbId);
    }

    // Fetch the replayed event
    const replayedEvent = db
      .prepare('SELECT * FROM webhook_events WHERE id = ?')
      .get(replayedEventDbId);

    return NextResponse.json({
      message: 'Webhook event replayed successfully',
      original_event_id: params.event_id,
      replayed_event: {
        ...replayedEvent,
        payload: JSON.parse(replayedEvent.payload),
        headers_received: JSON.parse(replayedEvent.headers_received || '{}'),
        response_headers: replayedEvent.response_headers ? JSON.parse(replayedEvent.response_headers) : {},
        error_details: replayedEvent.error_details ? JSON.parse(replayedEvent.error_details) : null,
        is_test_event: Boolean(replayedEvent.is_test_event),
        is_replayed: Boolean(replayedEvent.is_replayed),
        signature_valid: Boolean(replayedEvent.signature_valid),
      },
    });
  } catch (error) {
    console.error('Failed to replay webhook event:', error);
    return NextResponse.json(
      { error: 'Failed to replay webhook event' },
      { status: 500 }
    );
  }
}

/**
 * Deliver a webhook to the specified endpoint
 */
async function deliverWebhook(eventDbId: string, endpoint: any) {
  const db = getDatabase();
  
  // Get event details
  const event = db.prepare('SELECT * FROM webhook_events WHERE id = ?').get(eventDbId);
  if (!event) {
    throw new Error('Event not found');
  }

  const startTime = Date.now();
  let response: Response | null = null;
  let error: Error | null = null;

  try {
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'BRF-Webhook-Delivery/1.0',
      'X-Webhook-Event-ID': event.event_id,
      'X-Webhook-Event-Type': event.event_type,
      'X-Webhook-Source': event.source_service,
      'X-Webhook-Delivery-Attempt': '1',
      'X-Webhook-Timestamp': new Date().toISOString(),
      ...JSON.parse(endpoint.headers || '{}'),
    };

    // Add correlation ID if present
    if (event.correlation_id) {
      headers['X-Webhook-Correlation-ID'] = event.correlation_id;
    }

    // Add signature if endpoint has secret
    if (endpoint.secret) {
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(event.payload)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Add authentication header if configured
    if (endpoint.auth_header && endpoint.auth_token) {
      headers[endpoint.auth_header] = endpoint.auth_token;
    }

    // Make the webhook request
    response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: event.payload,
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
        responseBody.slice(0, 10000), // Limit response body size
        responseTime,
        eventDbId
      );

      // Update endpoint success metrics
      db.prepare(`
        UPDATE webhook_endpoints 
        SET last_success_at = datetime('now'),
            consecutive_failures = 0
        WHERE id = ?
      `).run(endpoint.id);
    } else {
      throw new Error(`HTTP ${response.status}: ${responseBody}`);
    }
  } catch (e) {
    error = e as Error;
    const responseTime = Date.now() - startTime;
    
    // Update event with failure
    db.prepare(`
      UPDATE webhook_events 
      SET delivery_status = 'failed',
          delivery_attempts = 1,
          last_delivery_attempt = datetime('now'),
          response_status_code = ?,
          response_time_ms = ?,
          error_message = ?,
          error_details = ?
      WHERE id = ?
    `).run(
      response?.status || null,
      responseTime,
      error.message.slice(0, 1000),
      JSON.stringify({ 
        name: error.name, 
        message: error.message,
        stack: error.stack?.slice(0, 2000) 
      }),
      eventDbId
    );

    // Update endpoint failure metrics
    db.prepare(`
      UPDATE webhook_endpoints 
      SET last_failure_at = datetime('now'),
          consecutive_failures = consecutive_failures + 1
      WHERE id = ?
    `).run(endpoint.id);

    throw error;
  }
}