import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { z } from 'zod';

const StartSimulatorSessionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  service_type: z.enum(['bankid', 'fortnox', 'kivra', 'payment', 'notification', 'custom']),
  base_url: z.string().url().optional(),
  scenarios: z.array(z.object({
    name: z.string(),
    event_type: z.string(),
    payload_template: z.record(z.any()),
    delay_seconds: z.number().optional().default(0),
    repeat_count: z.number().optional().default(1),
    repeat_interval_seconds: z.number().optional().default(60),
  })).default([]),
});

const SimulateEventSchema = z.object({
  event_type: z.string().min(1),
  payload: z.record(z.any()),
  target_endpoints: z.array(z.string()).optional(),
  delay_seconds: z.number().optional().default(0),
});

/**
 * GET /api/webhooks/simulator - List simulator sessions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperative_id');
    const serviceType = searchParams.get('service_type');
    const isActive = searchParams.get('is_active');

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    let query = `
      SELECT 
        s.*,
        m.first_name || ' ' || m.last_name as created_by_name
      FROM webhook_simulator_sessions s
      LEFT JOIN members m ON s.created_by = m.id
      WHERE s.cooperative_id = ?
    `;
    
    const params: any[] = [cooperativeId];

    if (serviceType) {
      query += ' AND s.service_type = ?';
      params.push(serviceType);
    }

    if (isActive !== null) {
      query += ' AND s.is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    query += ' ORDER BY s.created_at DESC';

    const sessions = db.prepare(query).all(...params);

    return NextResponse.json({
      sessions: sessions.map(session => ({
        ...session,
        scenarios: JSON.parse(session.scenarios || '[]'),
        is_active: Boolean(session.is_active),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch simulator sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch simulator sessions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/simulator - Start a new simulator session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = StartSimulatorSessionSchema.parse(body);

    if (!body.cooperative_id) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    const sessionId = crypto.randomUUID().replace(/-/g, '');
    
    const stmt = db.prepare(`
      INSERT INTO webhook_simulator_sessions (
        id, cooperative_id, name, description, service_type,
        base_url, scenarios, started_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `);

    stmt.run(
      sessionId,
      body.cooperative_id,
      validatedData.name,
      validatedData.description || null,
      validatedData.service_type,
      validatedData.base_url || null,
      JSON.stringify(validatedData.scenarios),
      body.user_id || null
    );

    // Fetch the created session
    const newSession = db
      .prepare('SELECT * FROM webhook_simulator_sessions WHERE id = ?')
      .get(sessionId);

    return NextResponse.json({
      session: {
        ...newSession,
        scenarios: JSON.parse(newSession.scenarios || '[]'),
        is_active: Boolean(newSession.is_active),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to start simulator session:', error);
    return NextResponse.json(
      { error: 'Failed to start simulator session' },
      { status: 500 }
    );
  }
}