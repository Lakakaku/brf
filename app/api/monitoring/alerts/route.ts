import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

/**
 * Performance alerts management API endpoint
 * Handles CRUD operations for performance alerts
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
    
    const alerts = db.prepare(`
      SELECT *
      FROM performance_alerts
      WHERE cooperative_id = ? OR cooperative_id IS NULL
      ORDER BY created_at DESC
    `).all(cooperativeId);

    // Parse JSON fields
    const formattedAlerts = alerts.map(alert => ({
      ...alert,
      notificationChannels: JSON.parse(alert.notification_channels || '[]'),
      notifyRoles: JSON.parse(alert.notify_roles || '[]'),
      notifyEmails: JSON.parse(alert.notify_emails || '[]'),
    }));

    return NextResponse.json({ alerts: formattedAlerts });

  } catch (error) {
    console.error('Alerts GET API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cooperativeId,
      alertName,
      alertType,
      metricName,
      metricCategory,
      thresholdValue,
      thresholdOperator,
      thresholdDurationMinutes,
      isActive,
      severity,
      notificationChannels,
      notifyRoles,
      notifyEmails,
      suppressDurationMinutes,
      maxAlertsPerDay,
    } = body;

    if (!cooperativeId || !alertName || !metricName || !metricCategory) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    db.prepare(`
      INSERT INTO performance_alerts (
        id, cooperative_id, alert_name, alert_type, metric_name, metric_category,
        threshold_value, threshold_operator, threshold_duration_minutes,
        is_active, severity, notification_channels, notify_roles, notify_emails,
        suppress_duration_minutes, max_alerts_per_day, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      alertId,
      cooperativeId,
      alertName,
      alertType,
      metricName,
      metricCategory,
      thresholdValue || null,
      thresholdOperator || null,
      thresholdDurationMinutes || 5,
      isActive ? 1 : 0,
      severity,
      JSON.stringify(notificationChannels || []),
      JSON.stringify(notifyRoles || []),
      JSON.stringify(notifyEmails || []),
      suppressDurationMinutes || 60,
      maxAlertsPerDay || 10
    );

    return NextResponse.json({ success: true, alertId });

  } catch (error) {
    console.error('Alerts POST API error:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}