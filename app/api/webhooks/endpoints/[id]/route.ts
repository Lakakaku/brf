import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { z } from 'zod';

const UpdateWebhookEndpointSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  service_type: z.enum(['bankid', 'fortnox', 'kivra', 'payment', 'notification', 'custom']).optional(),
  description: z.string().optional(),
  secret: z.string().optional(),
  auth_header: z.string().optional(),
  auth_token: z.string().optional(),
  events: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  timeout_seconds: z.number().int().min(1).max(300).optional(),
  retry_attempts: z.number().int().min(0).max(10).optional(),
  retry_backoff_seconds: z.number().int().min(1).max(3600).optional(),
  rate_limit_requests: z.number().int().min(1).max(1000).optional(),
  rate_limit_window_minutes: z.number().int().min(1).max(60).optional(),
  environment: z.enum(['development', 'staging', 'production', 'test']).optional(),
  test_mode: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

/**
 * GET /api/webhooks/endpoints/[id] - Get webhook endpoint details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperative_id');

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Get endpoint with statistics
    const endpoint = db.prepare(`
      SELECT 
        e.*,
        COUNT(ev.id) as total_events,
        COUNT(CASE WHEN ev.delivery_status = 'delivered' THEN 1 END) as successful_events,
        COUNT(CASE WHEN ev.delivery_status = 'failed' THEN 1 END) as failed_events,
        COUNT(CASE WHEN ev.delivery_status = 'pending' THEN 1 END) as pending_events,
        COUNT(CASE WHEN ev.delivery_status = 'retrying' THEN 1 END) as retrying_events,
        AVG(ev.response_time_ms) as avg_response_time_ms,
        MAX(ev.created_at) as last_event_at
      FROM webhook_endpoints e
      LEFT JOIN webhook_events ev ON e.id = ev.endpoint_id
      WHERE e.id = ? AND e.cooperative_id = ? AND e.deleted_at IS NULL
      GROUP BY e.id
    `).get(params.id, cooperativeId);

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Webhook endpoint not found' },
        { status: 404 }
      );
    }

    // Get recent events
    const recentEvents = db.prepare(`
      SELECT 
        event_id, event_type, source_service, delivery_status,
        response_status_code, response_time_ms, created_at, error_message
      FROM webhook_events
      WHERE endpoint_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(params.id);

    // Get subscriptions
    const subscriptions = db.prepare(`
      SELECT * FROM webhook_subscriptions
      WHERE endpoint_id = ? AND is_active = 1
    `).all(params.id);

    return NextResponse.json({
      endpoint: {
        ...endpoint,
        events: JSON.parse(endpoint.events || '[]'),
        headers: JSON.parse(endpoint.headers || '{}'),
        is_active: Boolean(endpoint.is_active),
        is_verified: Boolean(endpoint.is_verified),
        test_mode: Boolean(endpoint.test_mode),
      },
      recent_events: recentEvents.map(event => ({
        ...event,
        is_test_event: Boolean(event.is_test_event),
        is_replayed: Boolean(event.is_replayed),
        signature_valid: Boolean(event.signature_valid),
      })),
      subscriptions: subscriptions.map(sub => ({
        ...sub,
        is_active: Boolean(sub.is_active),
        filter_conditions: JSON.parse(sub.filter_conditions || '{}'),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch webhook endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook endpoint' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/webhooks/endpoints/[id] - Update webhook endpoint
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = UpdateWebhookEndpointSchema.parse(body);

    if (!body.cooperative_id) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Check if endpoint exists
    const existingEndpoint = db
      .prepare('SELECT id, name FROM webhook_endpoints WHERE id = ? AND cooperative_id = ? AND deleted_at IS NULL')
      .get(params.id, body.cooperative_id);

    if (!existingEndpoint) {
      return NextResponse.json(
        { error: 'Webhook endpoint not found' },
        { status: 404 }
      );
    }

    // Check if new name conflicts (if name is being changed)
    if (validatedData.name && validatedData.name !== existingEndpoint.name) {
      const nameConflict = db
        .prepare('SELECT id FROM webhook_endpoints WHERE cooperative_id = ? AND name = ? AND id != ? AND deleted_at IS NULL')
        .get(body.cooperative_id, validatedData.name, params.id);

      if (nameConflict) {
        return NextResponse.json(
          { error: 'Webhook endpoint with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(validatedData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'events' || key === 'headers') {
          updates.push(`${key} = ?`);
          values.push(JSON.stringify(value));
        } else if (key === 'is_active' || key === 'test_mode') {
          updates.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
    });

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at and updated_by
    updates.push('updated_at = datetime(\'now\')');
    if (body.user_id) {
      updates.push('updated_by = ?');
      values.push(body.user_id);
    }

    values.push(params.id, body.cooperative_id);

    const stmt = db.prepare(`
      UPDATE webhook_endpoints 
      SET ${updates.join(', ')}
      WHERE id = ? AND cooperative_id = ?
    `);

    const result = stmt.run(...values);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Failed to update webhook endpoint' },
        { status: 400 }
      );
    }

    // Fetch updated endpoint
    const updatedEndpoint = db
      .prepare('SELECT * FROM webhook_endpoints WHERE id = ?')
      .get(params.id);

    return NextResponse.json({
      endpoint: {
        ...updatedEndpoint,
        events: JSON.parse(updatedEndpoint.events || '[]'),
        headers: JSON.parse(updatedEndpoint.headers || '{}'),
        is_active: Boolean(updatedEndpoint.is_active),
        is_verified: Boolean(updatedEndpoint.is_verified),
        test_mode: Boolean(updatedEndpoint.test_mode),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to update webhook endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook endpoint' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks/endpoints/[id] - Soft delete webhook endpoint
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperative_id');

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Check if endpoint exists
    const existingEndpoint = db
      .prepare('SELECT id FROM webhook_endpoints WHERE id = ? AND cooperative_id = ? AND deleted_at IS NULL')
      .get(params.id, cooperativeId);

    if (!existingEndpoint) {
      return NextResponse.json(
        { error: 'Webhook endpoint not found' },
        { status: 404 }
      );
    }

    // Soft delete endpoint
    const stmt = db.prepare(`
      UPDATE webhook_endpoints 
      SET deleted_at = datetime('now'), is_active = 0
      WHERE id = ? AND cooperative_id = ?
    `);

    const result = stmt.run(params.id, cooperativeId);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Failed to delete webhook endpoint' },
        { status: 400 }
      );
    }

    // Deactivate all subscriptions for this endpoint
    db.prepare(`
      UPDATE webhook_subscriptions 
      SET is_active = 0 
      WHERE endpoint_id = ?
    `).run(params.id);

    return NextResponse.json({
      message: 'Webhook endpoint deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete webhook endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook endpoint' },
      { status: 500 }
    );
  }
}