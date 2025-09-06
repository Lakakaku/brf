import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { brfMetricsCollector } from '@/lib/monitoring/brf-metrics';
import { performanceCollector } from '@/lib/monitoring/collector';

/**
 * Performance monitoring dashboard API endpoint
 * Provides real-time performance metrics for BRF portals
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperativeId');
    
    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperativeId is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Get system metrics (latest readings within last 5 minutes)
    const systemMetrics = await getSystemMetrics(cooperativeId);
    
    // Get database performance metrics
    const databaseMetrics = await getDatabaseMetrics(cooperativeId);
    
    // Get API performance metrics
    const apiMetrics = await getApiMetrics(cooperativeId);
    
    // Get BRF-specific metrics
    const brfMetrics = await getBrfMetrics(cooperativeId);
    
    // Get active alerts
    const alerts = await getActiveAlerts(cooperativeId);

    // Record the dashboard access for monitoring
    performanceCollector.recordMetric({
      name: 'dashboard_access',
      category: 'api',
      type: 'counter',
      value: 1,
      unit: 'count',
      cooperativeId,
      endpoint: '/api/monitoring/dashboard',
    });

    const responseData = {
      system: systemMetrics,
      database: databaseMetrics,
      api: apiMetrics,
      brf: brfMetrics,
      alerts: alerts,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

async function getSystemMetrics(cooperativeId: string) {
  const db = getDatabase();
  
  // Get latest system metrics
  const latestMetrics = db.prepare(`
    SELECT metric_name, value, unit, recorded_at
    FROM performance_metrics
    WHERE cooperative_id = ? OR cooperative_id IS NULL
      AND metric_category = 'system'
      AND recorded_at >= datetime('now', '-5 minutes')
    ORDER BY recorded_at DESC
    LIMIT 50
  `).all(cooperativeId);

  const metrics = latestMetrics.reduce((acc: any, metric: any) => {
    if (!acc[metric.metric_name]) {
      acc[metric.metric_name] = metric.value;
    }
    return acc;
  }, {});

  // Get current memory usage
  const memUsage = process.memoryUsage();
  
  return {
    cpuUsage: metrics.cpu_usage || 0,
    memoryUsage: memUsage.rss,
    memoryTotal: metrics.memory_total || (memUsage.rss * 1.5), // Estimate if not available
    uptime: metrics.uptime || process.uptime(),
    eventLoopLag: metrics.event_loop_lag || 0,
  };
}

async function getDatabaseMetrics(cooperativeId: string) {
  const db = getDatabase();
  
  // Get database performance metrics from last hour
  const queryStats = db.prepare(`
    SELECT 
      COUNT(*) as totalQueries,
      COUNT(CASE WHEN is_slow_query = 1 THEN 1 END) as slowQueries,
      AVG(execution_time_ms) as averageResponseTime,
      query_type
    FROM query_performance
    WHERE cooperative_id = ? OR cooperative_id IS NULL
      AND executed_at >= datetime('now', '-1 hour')
    GROUP BY query_type
  `).all(cooperativeId);

  const queriesByType = queryStats.reduce((acc: any, stat: any) => {
    acc[stat.query_type] = stat.totalQueries;
    return acc;
  }, {});

  const totalQueries = queryStats.reduce((sum, stat: any) => sum + stat.totalQueries, 0);
  const slowQueries = queryStats.reduce((sum, stat: any) => sum + stat.slowQueries, 0);
  const avgResponseTime = queryStats.length > 0 
    ? queryStats.reduce((sum, stat: any) => sum + (stat.averageResponseTime * stat.totalQueries), 0) / totalQueries
    : 0;

  // Get top slow queries
  const topSlowQueries = db.prepare(`
    SELECT 
      qp.query_hash,
      AVG(qp.execution_time_ms) as executionTime,
      qp.table_name as table,
      'Query details not shown for security' as query
    FROM query_performance qp
    WHERE qp.cooperative_id = ? OR qp.cooperative_id IS NULL
      AND qp.executed_at >= datetime('now', '-1 hour')
      AND qp.is_slow_query = 1
    GROUP BY qp.query_hash, qp.table_name
    ORDER BY executionTime DESC
    LIMIT 10
  `).all(cooperativeId);

  return {
    totalQueries,
    slowQueries,
    averageResponseTime: avgResponseTime || 0,
    queriesByType,
    topSlowQueries: topSlowQueries.map(q => ({
      query: q.query,
      executionTime: q.executionTime,
      table: q.table || 'unknown'
    }))
  };
}

async function getApiMetrics(cooperativeId: string) {
  const db = getDatabase();
  
  // Get API performance metrics from last hour
  const apiStats = db.prepare(`
    SELECT 
      COUNT(*) as totalRequests,
      AVG(response_time_ms) as averageResponseTime,
      COUNT(CASE WHEN status_code >= 400 THEN 1 END) as errorCount,
      endpoint,
      status_code
    FROM api_performance
    WHERE cooperative_id = ? OR cooperative_id IS NULL
      AND started_at >= datetime('now', '-1 hour')
    GROUP BY endpoint, status_code
  `).all(cooperativeId);

  const totalRequests = apiStats.reduce((sum, stat: any) => sum + stat.totalRequests, 0);
  const errorCount = apiStats.reduce((sum, stat: any) => sum + stat.errorCount, 0);
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
  
  const avgResponseTime = apiStats.length > 0
    ? apiStats.reduce((sum, stat: any) => sum + (stat.averageResponseTime * stat.totalRequests), 0) / totalRequests
    : 0;

  // Get requests by endpoint
  const requestsByEndpoint = db.prepare(`
    SELECT 
      endpoint,
      COUNT(*) as count,
      AVG(response_time_ms) as avgResponseTime
    FROM api_performance
    WHERE cooperative_id = ? OR cooperative_id IS NULL
      AND started_at >= datetime('now', '-1 hour')
    GROUP BY endpoint
    ORDER BY count DESC
    LIMIT 10
  `).all(cooperativeId);

  // Get status code distribution
  const statusCodes = db.prepare(`
    SELECT 
      status_code,
      COUNT(*) as count
    FROM api_performance
    WHERE cooperative_id = ? OR cooperative_id IS NULL
      AND started_at >= datetime('now', '-1 hour')
    GROUP BY status_code
  `).all(cooperativeId);

  const statusCodeMap = statusCodes.reduce((acc: any, stat: any) => {
    acc[stat.status_code.toString()] = stat.count;
    return acc;
  }, {});

  return {
    totalRequests,
    averageResponseTime: avgResponseTime || 0,
    errorRate,
    requestsByEndpoint: requestsByEndpoint.map(req => ({
      endpoint: req.endpoint,
      count: req.count,
      avgResponseTime: req.avgResponseTime || 0
    })),
    statusCodes: statusCodeMap
  };
}

async function getBrfMetrics(cooperativeId: string) {
  const db = getDatabase();
  
  // Get latest BRF business metrics
  const latestMetrics = db.prepare(`
    SELECT *
    FROM brf_business_metrics
    WHERE cooperative_id = ?
    ORDER BY calculated_at DESC
    LIMIT 1
  `).get(cooperativeId) as any;

  if (latestMetrics) {
    return {
      activeMembers: latestMetrics.active_members_count || 0,
      monthlyFeeCollectionRate: latestMetrics.payment_collection_rate || 0,
      openCases: latestMetrics.maintenance_cases_opened || 0,
      energyCostPerSqm: latestMetrics.energy_cost_per_sqm || 0,
      invoicesProcessed: latestMetrics.invoices_processed || 0,
      overduePayments: latestMetrics.overdue_payments_count || 0,
      bookingUtilization: 0, // Would calculate from booking data
    };
  }

  // Calculate real-time metrics if no cached data
  try {
    const kpiMetrics = await brfMetricsCollector.calculateKpiMetrics(cooperativeId);
    return {
      activeMembers: db.prepare(`
        SELECT COUNT(*) as count FROM members 
        WHERE cooperative_id = ? AND is_active = 1 AND deleted_at IS NULL
      `).get(cooperativeId)?.count || 0,
      monthlyFeeCollectionRate: kpiMetrics.monthlyFeeCollectionRate,
      openCases: db.prepare(`
        SELECT COUNT(*) as count FROM cases 
        WHERE cooperative_id = ? AND status IN ('open', 'in_progress')
      `).get(cooperativeId)?.count || 0,
      energyCostPerSqm: kpiMetrics.energyCostPerSqm,
      invoicesProcessed: db.prepare(`
        SELECT COUNT(*) as count FROM invoices 
        WHERE cooperative_id = ? AND created_at >= datetime('now', '-30 days')
      `).get(cooperativeId)?.count || 0,
      overduePayments: db.prepare(`
        SELECT COUNT(*) as count FROM monthly_fees 
        WHERE cooperative_id = ? AND payment_status = 'overdue'
      `).get(cooperativeId)?.count || 0,
      bookingUtilization: 75, // Default value
    };
  } catch (error) {
    console.error('Error calculating BRF metrics:', error);
    return {
      activeMembers: 0,
      monthlyFeeCollectionRate: 0,
      openCases: 0,
      energyCostPerSqm: 0,
      invoicesProcessed: 0,
      overduePayments: 0,
      bookingUtilization: 0,
    };
  }
}

async function getActiveAlerts(cooperativeId: string) {
  const db = getDatabase();
  
  // Get recent alert history
  const activeAlerts = db.prepare(`
    SELECT 
      ah.id,
      ah.message,
      ah.severity,
      ah.triggered_at as timestamp,
      pa.alert_name
    FROM alert_history ah
    JOIN performance_alerts pa ON ah.alert_id = pa.id
    WHERE ah.cooperative_id = ?
      AND ah.event_type = 'triggered'
      AND ah.resolved_at IS NULL
      AND ah.triggered_at >= datetime('now', '-1 hour')
    ORDER BY ah.triggered_at DESC
    LIMIT 10
  `).all(cooperativeId);

  return activeAlerts.map(alert => ({
    id: alert.id,
    severity: alert.severity,
    message: alert.message || `Alert: ${alert.alert_name}`,
    timestamp: alert.timestamp
  }));
}

// POST endpoint for recording custom metrics
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperativeId = searchParams.get('cooperativeId');
    
    if (!cooperativeId) {
      return NextResponse.json(
        { error: 'cooperativeId is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { metrics } = body;

    if (!Array.isArray(metrics)) {
      return NextResponse.json(
        { error: 'metrics must be an array' },
        { status: 400 }
      );
    }

    // Record each metric
    for (const metric of metrics) {
      performanceCollector.recordMetric({
        name: metric.name,
        category: metric.category || 'api',
        type: metric.type || 'gauge',
        value: metric.value,
        unit: metric.unit || 'count',
        cooperativeId,
        endpoint: metric.endpoint,
        userId: metric.userId,
        sessionId: metric.sessionId,
        requestId: metric.requestId,
        metadata: metric.metadata,
        tags: metric.tags,
      });
    }

    return NextResponse.json({ success: true, recordedCount: metrics.length });

  } catch (error) {
    console.error('Metrics recording API error:', error);
    return NextResponse.json(
      { error: 'Failed to record metrics' },
      { status: 500 }
    );
  }
}