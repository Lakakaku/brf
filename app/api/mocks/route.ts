import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiMocker, MockConfigSchema } from '@/lib/api-mocker';
import { getDatabase } from '@/lib/database';

const CreateMockConfigSchema = z.object({
  cooperative_id: z.string().min(1),
  service: z.string().min(1),
  endpoint: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  scenario: z.string().min(1),
  delayMs: z.number().min(0).max(30000).default(0),
  responseStatus: z.number().min(100).max(599).default(200),
  responseData: z.record(z.any()),
  headers: z.record(z.string()).optional(),
  isEnabled: z.boolean().default(true),
  environment: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const UpdateMockConfigSchema = CreateMockConfigSchema.partial().omit(['cooperative_id']);

/**
 * GET /api/mocks - List all mock configurations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperative_id');
    const service = searchParams.get('service');
    const environment = searchParams.get('environment');
    const isEnabled = searchParams.get('is_enabled');

    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Get stored configurations from database
    let query = `
      SELECT 
        id,
        cooperative_id,
        name,
        description,
        service,
        endpoint,
        method,
        scenario,
        delay_ms,
        response_status,
        response_data,
        headers,
        is_enabled,
        environment,
        tags,
        usage_count,
        last_used_at,
        created_at,
        updated_at,
        created_by,
        m.first_name || ' ' || m.last_name as created_by_name
      FROM mock_configurations mc
      LEFT JOIN members m ON mc.created_by = m.id
      WHERE mc.cooperative_id = ?
    `;
    
    const params: any[] = [cooperativeId];

    if (service) {
      query += ' AND mc.service = ?';
      params.push(service);
    }

    if (environment) {
      query += ' AND mc.environment = ?';
      params.push(environment);
    }

    if (isEnabled !== null) {
      query += ' AND mc.is_enabled = ?';
      params.push(isEnabled === 'true' ? 1 : 0);
    }

    query += ' ORDER BY mc.service, mc.endpoint, mc.scenario';

    const configs = db.prepare(query).all(...params);

    // Also get in-memory configurations from apiMocker
    const memoryConfigs = apiMocker.getMockConfigs().filter(config => 
      !cooperativeId || config.cooperativeId === cooperativeId
    );

    const combinedConfigs = [
      ...configs.map(config => ({
        ...config,
        response_data: JSON.parse(config.response_data || '{}'),
        headers: JSON.parse(config.headers || '{}'),
        tags: JSON.parse(config.tags || '[]'),
        is_enabled: Boolean(config.is_enabled),
        source: 'database',
      })),
      ...memoryConfigs.map(config => ({
        ...config,
        id: null, // Memory configs don't have database IDs
        source: 'memory',
      })),
    ];

    // Get service statistics
    const serviceStats = {};
    combinedConfigs.forEach(config => {
      if (!serviceStats[config.service]) {
        serviceStats[config.service] = {
          total: 0,
          enabled: 0,
          scenarios: new Set(),
          environments: new Set(),
        };
      }
      serviceStats[config.service].total++;
      if (config.is_enabled) {
        serviceStats[config.service].enabled++;
      }
      serviceStats[config.service].scenarios.add(config.scenario);
      serviceStats[config.service].environments.add(config.environment);
    });

    // Convert Sets to Arrays for JSON serialization
    Object.keys(serviceStats).forEach(service => {
      serviceStats[service].scenarios = Array.from(serviceStats[service].scenarios);
      serviceStats[service].environments = Array.from(serviceStats[service].environments);
    });

    return NextResponse.json({
      configurations: combinedConfigs,
      statistics: {
        total: combinedConfigs.length,
        enabled: combinedConfigs.filter(c => c.is_enabled).length,
        services: Object.keys(serviceStats).length,
        byService: serviceStats,
      },
      available_services: apiMocker.getServiceConfigs(),
    });
  } catch (error) {
    console.error('Failed to fetch mock configurations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mock configurations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mocks - Create a new mock configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateMockConfigSchema.parse(body);

    const db = getDatabase();

    const configId = crypto.randomUUID();
    
    // Store in database for persistence
    const stmt = db.prepare(`
      INSERT INTO mock_configurations (
        id, cooperative_id, name, description, service, endpoint,
        method, scenario, delay_ms, response_status, response_data,
        headers, is_enabled, environment, tags, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      configId,
      validatedData.cooperative_id,
      validatedData.name,
      validatedData.description || null,
      validatedData.service,
      validatedData.endpoint,
      validatedData.method,
      validatedData.scenario,
      validatedData.delayMs,
      validatedData.responseStatus,
      JSON.stringify(validatedData.responseData),
      JSON.stringify(validatedData.headers || {}),
      validatedData.isEnabled ? 1 : 0,
      validatedData.environment,
      JSON.stringify(validatedData.tags),
      body.user_id || null
    );

    // Also register with in-memory apiMocker
    const mockConfig = {
      service: validatedData.service,
      endpoint: validatedData.endpoint,
      method: validatedData.method,
      scenario: validatedData.scenario,
      delayMs: validatedData.delayMs,
      responseStatus: validatedData.responseStatus,
      responseData: validatedData.responseData,
      headers: validatedData.headers,
      isEnabled: validatedData.isEnabled,
      environment: validatedData.environment,
      cooperativeId: validatedData.cooperative_id,
    };

    const memoryConfigId = apiMocker.registerMock(mockConfig);

    // Fetch the created configuration
    const newConfig = db
      .prepare('SELECT * FROM mock_configurations WHERE id = ?')
      .get(configId);

    return NextResponse.json({
      configuration: {
        ...newConfig,
        response_data: JSON.parse(newConfig.response_data || '{}'),
        headers: JSON.parse(newConfig.headers || '{}'),
        tags: JSON.parse(newConfig.tags || '[]'),
        is_enabled: Boolean(newConfig.is_enabled),
      },
      memory_config_id: memoryConfigId,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to create mock configuration:', error);
    return NextResponse.json(
      { error: 'Failed to create mock configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/mocks - Bulk import mock configurations
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { cooperative_id, configurations } = body;

    if (!cooperative_id) {
      return NextResponse.json(
        { error: 'cooperative_id is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(configurations)) {
      return NextResponse.json(
        { error: 'configurations must be an array' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const importResults = {
      total: configurations.length,
      imported: 0,
      failed: 0,
      errors: [],
    };

    // Process each configuration
    for (const config of configurations) {
      try {
        const validatedConfig = CreateMockConfigSchema.parse({
          ...config,
          cooperative_id,
        });

        const configId = crypto.randomUUID();
        
        // Store in database
        const stmt = db.prepare(`
          INSERT INTO mock_configurations (
            id, cooperative_id, name, description, service, endpoint,
            method, scenario, delay_ms, response_status, response_data,
            headers, is_enabled, environment, tags, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          configId,
          validatedConfig.cooperative_id,
          validatedConfig.name,
          validatedConfig.description || null,
          validatedConfig.service,
          validatedConfig.endpoint,
          validatedConfig.method,
          validatedConfig.scenario,
          validatedConfig.delayMs,
          validatedConfig.responseStatus,
          JSON.stringify(validatedConfig.responseData),
          JSON.stringify(validatedConfig.headers || {}),
          validatedConfig.isEnabled ? 1 : 0,
          validatedConfig.environment,
          JSON.stringify(validatedConfig.tags),
          body.user_id || null
        );

        // Register with in-memory apiMocker
        apiMocker.registerMock({
          service: validatedConfig.service,
          endpoint: validatedConfig.endpoint,
          method: validatedConfig.method,
          scenario: validatedConfig.scenario,
          delayMs: validatedConfig.delayMs,
          responseStatus: validatedConfig.responseStatus,
          responseData: validatedConfig.responseData,
          headers: validatedConfig.headers,
          isEnabled: validatedConfig.isEnabled,
          environment: validatedConfig.environment,
          cooperativeId: validatedConfig.cooperative_id,
        });

        importResults.imported++;
      } catch (configError) {
        importResults.failed++;
        importResults.errors.push({
          config: config.name || 'unnamed',
          error: configError.message,
        });
        console.warn('Failed to import config:', config, configError);
      }
    }

    return NextResponse.json({
      message: `Imported ${importResults.imported} configurations`,
      results: importResults,
    });
  } catch (error) {
    console.error('Failed to bulk import configurations:', error);
    return NextResponse.json(
      { error: 'Failed to bulk import configurations' },
      { status: 500 }
    );
  }
}