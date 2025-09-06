import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { z } from 'zod';

// Webhook endpoint validation schemas
const CreateWebhookEndpointSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  service_type: z.enum(['bankid', 'fortnox', 'kivra', 'payment', 'notification', 'custom']),
  description: z.string().optional(),
  secret: z.string().optional(),
  auth_header: z.string().optional(),
  auth_token: z.string().optional(),
  events: z.array(z.string()).default([]),
  headers: z.record(z.string()).default({}),
  timeout_seconds: z.number().int().min(1).max(300).default(30),
  retry_attempts: z.number().int().min(0).max(10).default(3),
  retry_backoff_seconds: z.number().int().min(1).max(3600).default(60),
  rate_limit_requests: z.number().int().min(1).max(1000).default(100),
  rate_limit_window_minutes: z.number().int().min(1).max(60).default(1),
  environment: z.enum(['development', 'staging', 'production', 'test']).default('production'),
  test_mode: z.boolean().default(false),
});

const UpdateWebhookEndpointSchema = CreateWebhookEndpointSchema.partial();

/**
 * GET /api/webhooks/endpoints - List webhook endpoints
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperative_id');
    const serviceType = searchParams.get('service_type');
    const environment = searchParams.get('environment');
    const isActive = searchParams.get('is_active');
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
        COUNT(ev.id) as total_events,
        COUNT(CASE WHEN ev.delivery_status = 'delivered' THEN 1 END) as successful_events,
        COUNT(CASE WHEN ev.delivery_status = 'failed' THEN 1 END) as failed_events,
        AVG(ev.response_time_ms) as avg_response_time_ms
      FROM webhook_endpoints e
      LEFT JOIN webhook_events ev ON e.id = ev.endpoint_id
      WHERE e.cooperative_id = ? AND e.deleted_at IS NULL
    `;
    
    const params: any[] = [cooperativeId];

    if (serviceType) {
      query += ' AND e.service_type = ?';
      params.push(serviceType);
    }

    if (environment) {
      query += ' AND e.environment = ?';
      params.push(environment);
    }

    if (isActive !== null) {
      query += ' AND e.is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    query += `
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);

    const endpoints = db.prepare(query).all(...params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM webhook_endpoints
      WHERE cooperative_id = ? AND deleted_at IS NULL
    `;
    
    const countParams: any[] = [cooperativeId];
    
    if (serviceType) {
      countQuery += ' AND service_type = ?';
      countParams.push(serviceType);
    }

    if (environment) {
      countQuery += ' AND environment = ?';
      countParams.push(environment);
    }

    if (isActive !== null) {
      countQuery += ' AND is_active = ?';
      countParams.push(isActive === 'true' ? 1 : 0);
    }

    const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

    return NextResponse.json({
      endpoints: endpoints.map(endpoint => ({
        ...endpoint,
        events: JSON.parse(endpoint.events || '[]'),
        headers: JSON.parse(endpoint.headers || '{}'),
        is_active: Boolean(endpoint.is_active),
        is_verified: Boolean(endpoint.is_verified),
        test_mode: Boolean(endpoint.test_mode),
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Failed to fetch webhook endpoints:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook endpoints' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/endpoints - Create webhook endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateWebhookEndpointSchema.parse(body);

    if (!body.cooperative_id) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Check if endpoint name already exists for this cooperative
    const existingEndpoint = db
      .prepare('SELECT id FROM webhook_endpoints WHERE cooperative_id = ? AND name = ? AND deleted_at IS NULL')
      .get(body.cooperative_id, validatedData.name);

    if (existingEndpoint) {
      return NextResponse.json(
        { error: 'Webhook endpoint with this name already exists' },
        { status: 409 }
      );
    }

    // Create endpoint
    const endpointId = crypto.randomUUID().replace(/-/g, '');
    
    const stmt = db.prepare(`
      INSERT INTO webhook_endpoints (
        id, cooperative_id, name, url, service_type, description,
        secret, auth_header, auth_token, events, headers,
        timeout_seconds, retry_attempts, retry_backoff_seconds,
        rate_limit_requests, rate_limit_window_minutes,
        environment, test_mode, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      endpointId,
      body.cooperative_id,
      validatedData.name,
      validatedData.url,
      validatedData.service_type,
      validatedData.description || null,
      validatedData.secret || null,
      validatedData.auth_header || null,
      validatedData.auth_token || null,
      JSON.stringify(validatedData.events),
      JSON.stringify(validatedData.headers),
      validatedData.timeout_seconds,
      validatedData.retry_attempts,
      validatedData.retry_backoff_seconds,
      validatedData.rate_limit_requests,
      validatedData.rate_limit_window_minutes,
      validatedData.environment,
      validatedData.test_mode ? 1 : 0,
      body.user_id || null
    );

    // Fetch the created endpoint
    const newEndpoint = db
      .prepare('SELECT * FROM webhook_endpoints WHERE id = ?')
      .get(endpointId);

    return NextResponse.json({
      endpoint: {
        ...newEndpoint,
        events: JSON.parse(newEndpoint.events || '[]'),
        headers: JSON.parse(newEndpoint.headers || '{}'),
        is_active: Boolean(newEndpoint.is_active),
        is_verified: Boolean(newEndpoint.is_verified),
        test_mode: Boolean(newEndpoint.test_mode),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to create webhook endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook endpoint' },
      { status: 500 }
    );
  }
}