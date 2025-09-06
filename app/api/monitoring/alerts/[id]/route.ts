import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * Individual alert management API endpoints
 * Handles UPDATE, DELETE operations for specific alerts
 */

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    
    const {
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

    const db = getDatabase();
    
    const result = db.prepare(`
      UPDATE performance_alerts SET
        alert_name = ?,
        alert_type = ?,
        metric_name = ?,
        metric_category = ?,
        threshold_value = ?,
        threshold_operator = ?,
        threshold_duration_minutes = ?,
        is_active = ?,
        severity = ?,
        notification_channels = ?,
        notify_roles = ?,
        notify_emails = ?,
        suppress_duration_minutes = ?,
        max_alerts_per_day = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
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
      maxAlertsPerDay || 10,
      id
    );

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Alert PUT API error:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const db = getDatabase();
    
    // Delete associated alert history first
    db.prepare(`DELETE FROM alert_history WHERE alert_id = ?`).run(id);
    
    // Delete the alert
    const result = db.prepare(`DELETE FROM performance_alerts WHERE id = ?`).run(id);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Alert DELETE API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert' },
      { status: 500 }
    );
  }
}