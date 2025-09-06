import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { z } from 'zod';

const CreateWebhookEventSchema = z.object({
  event_type: z.string().min(1),
  source_service: z.string().min(1),
  payload: z.record(z.any()),
  correlation_id: z.string().optional(),
  headers_received: z.record(z.string()).default({}),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  is_test_event: z.boolean().default(false),
});

/**
 * GET /api/webhooks/events - List webhook events with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperative_id');
    const endpointId = searchParams.get('endpoint_id');
    const eventType = searchParams.get('event_type');
    const sourceService = searchParams.get('source_service');
    const deliveryStatus = searchParams.get('delivery_status');
    const isTestEvent = searchParams.get('is_test_event');
    const isReplayed = searchParams.get('is_replayed');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Build dynamic query
    let query = `
      SELECT 
        e.*,
        ep.name as endpoint_name,
        ep.service_type as endpoint_service_type,
        ep.url as endpoint_url
      FROM webhook_events e
      LEFT JOIN webhook_endpoints ep ON e.endpoint_id = ep.id
      WHERE e.cooperative_id = ?
    `;
    
    const params: any[] = [cooperativeId];

    if (endpointId) {
      query += ' AND e.endpoint_id = ?';
      params.push(endpointId);
    }

    if (eventType) {
      query += ' AND e.event_type LIKE ?';
      params.push(`%${eventType}%`);
    }

    if (sourceService) {
      query += ' AND e.source_service = ?';
      params.push(sourceService);
    }

    if (deliveryStatus) {
      query += ' AND e.delivery_status = ?';
      params.push(deliveryStatus);
    }

    if (isTestEvent !== null) {
      query += ' AND e.is_test_event = ?';
      params.push(isTestEvent === 'true' ? 1 : 0);
    }

    if (isReplayed !== null) {
      query += ' AND e.is_replayed = ?';
      params.push(isReplayed === 'true' ? 1 : 0);
    }

    if (fromDate) {
      query += ' AND e.created_at >= ?';
      params.push(fromDate);
    }

    if (toDate) {
      query += ' AND e.created_at <= ?';
      params.push(toDate);
    }

    query += `
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);

    const events = db.prepare(query).all(...params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM webhook_events e
      WHERE e.cooperative_id = ?
    `;
    
    const countParams: any[] = [cooperativeId];
    let countParamIndex = 1;
    
    if (endpointId) {
      countQuery += ' AND e.endpoint_id = ?';
      countParams.push(endpointId);
    }

    if (eventType) {
      countQuery += ' AND e.event_type LIKE ?';
      countParams.push(`%${eventType}%`);
    }

    if (sourceService) {
      countQuery += ' AND e.source_service = ?';
      countParams.push(sourceService);
    }

    if (deliveryStatus) {
      countQuery += ' AND e.delivery_status = ?';
      countParams.push(deliveryStatus);
    }

    if (isTestEvent !== null) {
      countQuery += ' AND e.is_test_event = ?';
      countParams.push(isTestEvent === 'true' ? 1 : 0);
    }

    if (isReplayed !== null) {
      countQuery += ' AND e.is_replayed = ?';
      countParams.push(isReplayed === 'true' ? 1 : 0);
    }

    if (fromDate) {
      countQuery += ' AND e.created_at >= ?';
      countParams.push(fromDate);
    }

    if (toDate) {
      countQuery += ' AND e.created_at <= ?';
      countParams.push(toDate);
    }

    const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

    // Get summary statistics
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN delivery_status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN delivery_status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN delivery_status = 'retrying' THEN 1 END) as retrying,
        AVG(response_time_ms) as avg_response_time,
        AVG(payload_size) as avg_payload_size
      FROM webhook_events 
      WHERE cooperative_id = ?
      AND created_at >= datetime('now', '-24 hours')
    `).get(cooperativeId);

    return NextResponse.json({
      events: events.map(event => ({
        ...event,
        payload: JSON.parse(event.payload),
        headers_received: JSON.parse(event.headers_received || '{}'),
        response_headers: JSON.parse(event.response_headers || '{}'),
        error_details: event.error_details ? JSON.parse(event.error_details) : null,
        is_test_event: Boolean(event.is_test_event),
        is_replayed: Boolean(event.is_replayed),
        signature_valid: Boolean(event.signature_valid),
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats,
    });
  } catch (error) {
    console.error('Failed to fetch webhook events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/events - Create a webhook event (for simulator/testing)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateWebhookEventSchema.parse(body);

    if (!body.cooperative_id) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Generate event ID
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create event
    const stmt = db.prepare(`
      INSERT INTO webhook_events (
        id, cooperative_id, endpoint_id, event_id, event_type, source_service,
        correlation_id, payload, payload_size, headers_received,
        delivery_status, ip_address, user_agent, is_test_event
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const payloadJson = JSON.stringify(validatedData.payload);
    const headersJson = JSON.stringify(validatedData.headers_received);

    const result = stmt.run(
      crypto.randomUUID().replace(/-/g, ''),
      body.cooperative_id,
      body.endpoint_id || null,
      eventId,
      validatedData.event_type,
      validatedData.source_service,
      validatedData.correlation_id || null,
      payloadJson,
      Buffer.byteLength(payloadJson, 'utf8'),
      headersJson,
      'pending',
      validatedData.ip_address || null,
      validatedData.user_agent || null,
      validatedData.is_test_event ? 1 : 0
    );

    // Fetch the created event
    const newEvent = db
      .prepare('SELECT * FROM webhook_events WHERE event_id = ?')
      .get(eventId);

    return NextResponse.json({
      event: {
        ...newEvent,
        payload: JSON.parse(newEvent.payload),
        headers_received: JSON.parse(newEvent.headers_received || '{}'),
        is_test_event: Boolean(newEvent.is_test_event),
        is_replayed: Boolean(newEvent.is_replayed),
        signature_valid: Boolean(newEvent.signature_valid),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to create webhook event:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook event' },
      { status: 500 }
    );
  }
}