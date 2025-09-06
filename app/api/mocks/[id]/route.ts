import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiMocker } from '@/lib/api-mocker';
import { getDatabase } from '@/lib/database';

const UpdateMockConfigSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  delayMs: z.number().min(0).max(30000).optional(),
  responseStatus: z.number().min(100).max(599).optional(),
  responseData: z.record(z.any()).optional(),
  headers: z.record(z.string()).optional(),
  isEnabled: z.boolean().optional(),
  environment: z.enum(['development', 'staging', 'production', 'test']).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * GET /api/mocks/[id] - Get specific mock configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const configId = params.id;
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperative_id');

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Try to get from database first
    const config = db
      .prepare(`
        SELECT 
          mc.*,
          m.first_name || ' ' || m.last_name as created_by_name
        FROM mock_configurations mc
        LEFT JOIN members m ON mc.created_by = m.id
        WHERE mc.id = ? AND mc.cooperative_id = ?
      `)
      .get(configId, cooperativeId);

    if (config) {
      return NextResponse.json({
        configuration: {
          ...config,
          response_data: JSON.parse(config.response_data || '{}'),
          headers: JSON.parse(config.headers || '{}'),
          tags: JSON.parse(config.tags || '[]'),
          is_enabled: Boolean(config.is_enabled),
          source: 'database',
        },
      });
    }

    // Try to get from in-memory configuration
    const memoryConfig = apiMocker.getMockConfig(configId);
    if (memoryConfig && (!cooperativeId || memoryConfig.cooperativeId === cooperativeId)) {
      return NextResponse.json({
        configuration: {
          ...memoryConfig,
          id: configId,
          source: 'memory',
        },
      });
    }

    return NextResponse.json(
      { error: 'Mock configuration not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Failed to fetch mock configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mock configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/mocks/[id] - Update mock configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const configId = params.id;
    const body = await request.json();
    const cooperativeId = body.cooperative_id;

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const validatedData = UpdateMockConfigSchema.parse(body);
    const db = getDatabase();
    
    // Check if configuration exists in database
    const existingConfig = db
      .prepare('SELECT * FROM mock_configurations WHERE id = ? AND cooperative_id = ?')
      .get(configId, cooperativeId);

    if (existingConfig) {
      // Update database configuration
      const updateFields = [];
      const updateValues = [];

      Object.entries(validatedData).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbKey = key === 'delayMs' ? 'delay_ms' : 
                       key === 'responseStatus' ? 'response_status' :
                       key === 'responseData' ? 'response_data' :
                       key === 'isEnabled' ? 'is_enabled' :
                       key;
          
          updateFields.push(`${dbKey} = ?`);
          
          if (key === 'responseData' || key === 'headers' || key === 'tags') {
            updateValues.push(JSON.stringify(value));
          } else if (key === 'isEnabled') {
            updateValues.push(value ? 1 : 0);
          } else {
            updateValues.push(value);
          }
        }
      });

      if (updateFields.length > 0) {
        updateFields.push('updated_at = datetime(\'now\')');
        updateValues.push(configId, cooperativeId);

        const stmt = db.prepare(`
          UPDATE mock_configurations 
          SET ${updateFields.join(', ')}
          WHERE id = ? AND cooperative_id = ?
        `);

        stmt.run(...updateValues);

        // Also update in-memory configuration if it exists
        const memoryConfigId = `${existingConfig.service}_${existingConfig.method}_${existingConfig.endpoint.replace(/[^a-zA-Z0-9]/g, '_')}_${existingConfig.scenario}`.toLowerCase();
        const memoryUpdates = {};
        
        if (validatedData.delayMs !== undefined) memoryUpdates.delayMs = validatedData.delayMs;
        if (validatedData.responseStatus !== undefined) memoryUpdates.responseStatus = validatedData.responseStatus;
        if (validatedData.responseData !== undefined) memoryUpdates.responseData = validatedData.responseData;
        if (validatedData.headers !== undefined) memoryUpdates.headers = validatedData.headers;
        if (validatedData.isEnabled !== undefined) memoryUpdates.isEnabled = validatedData.isEnabled;

        apiMocker.updateMockConfig(memoryConfigId, memoryUpdates);
      }

      // Fetch updated configuration
      const updatedConfig = db
        .prepare('SELECT * FROM mock_configurations WHERE id = ? AND cooperative_id = ?')
        .get(configId, cooperativeId);

      return NextResponse.json({
        configuration: {
          ...updatedConfig,
          response_data: JSON.parse(updatedConfig.response_data || '{}'),
          headers: JSON.parse(updatedConfig.headers || '{}'),
          tags: JSON.parse(updatedConfig.tags || '[]'),
          is_enabled: Boolean(updatedConfig.is_enabled),
        },
      });
    }

    // Try to update in-memory configuration
    const updated = apiMocker.updateMockConfig(configId, validatedData);
    if (updated) {
      const memoryConfig = apiMocker.getMockConfig(configId);
      return NextResponse.json({
        configuration: {
          ...memoryConfig,
          id: configId,
          source: 'memory',
        },
      });
    }

    return NextResponse.json(
      { error: 'Mock configuration not found' },
      { status: 404 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to update mock configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update mock configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mocks/[id] - Delete mock configuration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const configId = params.id;
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperative_id');

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Try to delete from database
    const result = db
      .prepare('UPDATE mock_configurations SET deleted_at = datetime(\'now\') WHERE id = ? AND cooperative_id = ?')
      .run(configId, cooperativeId);

    let deleted = result.changes > 0;

    // Also try to delete from in-memory configuration
    const memoryDeleted = apiMocker.deleteMockConfig(configId);
    deleted = deleted || memoryDeleted;

    if (!deleted) {
      return NextResponse.json(
        { error: 'Mock configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Mock configuration deleted successfully',
      deleted_from_database: result.changes > 0,
      deleted_from_memory: memoryDeleted,
    });
  } catch (error) {
    console.error('Failed to delete mock configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete mock configuration' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mocks/[id] - Toggle mock configuration on/off
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const configId = params.id;
    const body = await request.json();
    const { enabled, cooperative_id: cooperativeId } = body;

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean value' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Try to update database configuration
    const result = db
      .prepare(`
        UPDATE mock_configurations 
        SET is_enabled = ?, updated_at = datetime('now')
        WHERE id = ? AND cooperative_id = ?
      `)
      .run(enabled ? 1 : 0, configId, cooperativeId);

    let updated = result.changes > 0;

    // Also try to update in-memory configuration
    const memoryUpdated = apiMocker.toggleMockConfig(configId, enabled);
    updated = updated || memoryUpdated;

    if (!updated) {
      return NextResponse.json(
        { error: 'Mock configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: `Mock configuration ${enabled ? 'enabled' : 'disabled'} successfully`,
      enabled,
      updated_database: result.changes > 0,
      updated_memory: memoryUpdated,
    });
  } catch (error) {
    console.error('Failed to toggle mock configuration:', error);
    return NextResponse.json(
      { error: 'Failed to toggle mock configuration' },
      { status: 500 }
    );
  }
}