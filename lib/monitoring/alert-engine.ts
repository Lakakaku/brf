import { getDatabase } from '../database';
import { performanceCollector } from './collector';

/**
 * Performance alert engine for BRF Portal
 * Monitors metrics and triggers notifications based on configured thresholds
 */

export interface AlertRule {
  id: string;
  alertName: string;
  alertType: 'threshold' | 'anomaly' | 'trend' | 'availability';
  metricName: string;
  metricCategory: string;
  thresholdValue?: number;
  thresholdOperator?: '>' | '<' | '>=' | '<=' | '=';
  thresholdDurationMinutes: number;
  isActive: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notificationChannels: string[];
  notifyRoles: string[];
  notifyEmails: string[];
  suppressDurationMinutes: number;
  maxAlertsPerDay: number;
  lastTriggeredAt?: string;
  triggerCountToday: number;
}

export interface AlertContext {
  cooperativeId: string;
  metricValue: number;
  metricName: string;
  timestamp: string;
  additionalContext?: Record<string, any>;
}

export interface NotificationChannel {
  type: 'email' | 'sms' | 'webhook' | 'slack';
  send(alert: AlertRule, context: AlertContext, message: string): Promise<boolean>;
}

export class AlertEngine {
  private static instance: AlertEngine;
  private enabled: boolean = true;
  private checkInterval: number = 60000; // Check every minute
  private timer?: NodeJS.Timeout;
  private notificationChannels: Map<string, NotificationChannel> = new Map();

  private constructor() {
    this.setupDefaultNotificationChannels();
  }

  public static getInstance(): AlertEngine {
    if (!AlertEngine.instance) {
      AlertEngine.instance = new AlertEngine();
    }
    return AlertEngine.instance;
  }

  /**
   * Start the alert monitoring engine
   */
  public start(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(async () => {
      await this.checkAlerts();
    }, this.checkInterval);

    console.log('Alert engine started');
  }

  /**
   * Stop the alert monitoring engine
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    console.log('Alert engine stopped');
  }

  /**
   * Set the check interval
   */
  public setCheckInterval(ms: number): void {
    this.checkInterval = ms;
    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  /**
   * Enable or disable the alert engine
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Register a notification channel
   */
  public registerNotificationChannel(type: string, channel: NotificationChannel): void {
    this.notificationChannels.set(type, channel);
  }

  /**
   * Main alert checking logic
   */
  private async checkAlerts(): Promise<void> {
    if (!this.enabled) return;

    try {
      const db = getDatabase();
      
      // Get all active alerts
      const alerts = db.prepare(`
        SELECT * FROM performance_alerts
        WHERE is_active = 1
        ORDER BY severity DESC
      `).all() as AlertRule[];

      for (const alert of alerts) {
        await this.checkAlert(alert);
      }

    } catch (error) {
      console.error('Alert checking error:', error);
    }
  }

  /**
   * Check a specific alert rule
   */
  private async checkAlert(alert: AlertRule): Promise<void> {
    try {
      // Skip if we've hit the daily limit
      if (alert.triggerCountToday >= alert.maxAlertsPerDay) {
        return;
      }

      // Skip if still in suppression period
      if (alert.lastTriggeredAt) {
        const lastTriggered = new Date(alert.lastTriggeredAt);
        const suppressUntil = new Date(lastTriggered.getTime() + (alert.suppressDurationMinutes * 60 * 1000));
        if (new Date() < suppressUntil) {
          return;
        }
      }

      const shouldTrigger = await this.evaluateAlertCondition(alert);
      
      if (shouldTrigger) {
        await this.triggerAlert(alert);
      }

    } catch (error) {
      console.error(`Error checking alert ${alert.id}:`, error);
    }
  }

  /**
   * Evaluate if an alert condition is met
   */
  private async evaluateAlertCondition(alert: AlertRule): Promise<boolean> {
    const db = getDatabase();
    
    switch (alert.alertType) {
      case 'threshold':
        return this.evaluateThresholdAlert(alert);
      
      case 'anomaly':
        return this.evaluateAnomalyAlert(alert);
      
      case 'trend':
        return this.evaluateTrendAlert(alert);
      
      case 'availability':
        return this.evaluateAvailabilityAlert(alert);
      
      default:
        return false;
    }
  }

  /**
   * Evaluate threshold-based alert
   */
  private async evaluateThresholdAlert(alert: AlertRule): Promise<boolean> {
    const db = getDatabase();
    
    // Get recent metric values within the duration window
    const metrics = db.prepare(`
      SELECT value, recorded_at
      FROM performance_metrics
      WHERE metric_name = ?
        AND metric_category = ?
        AND (cooperative_id = ? OR cooperative_id IS NULL)
        AND recorded_at >= datetime('now', '-${alert.thresholdDurationMinutes} minutes')
      ORDER BY recorded_at DESC
    `).all(alert.metricName, alert.metricCategory, alert.cooperativeId || null);

    if (metrics.length === 0) return false;

    // Check if threshold condition is met for the duration
    const thresholdViolations = metrics.filter(metric => {
      const value = parseFloat(metric.value);
      const threshold = alert.thresholdValue!;
      
      switch (alert.thresholdOperator) {
        case '>': return value > threshold;
        case '<': return value < threshold;
        case '>=': return value >= threshold;
        case '<=': return value <= threshold;
        case '=': return Math.abs(value - threshold) < 0.01;
        default: return false;
      }
    });

    // Require violations for at least 80% of the duration
    return thresholdViolations.length >= Math.ceil(metrics.length * 0.8);
  }

  /**
   * Evaluate anomaly-based alert
   */
  private async evaluateAnomalyAlert(alert: AlertRule): Promise<boolean> {
    const db = getDatabase();
    
    // Get historical data for baseline
    const historicalMetrics = db.prepare(`
      SELECT value
      FROM performance_metrics
      WHERE metric_name = ?
        AND metric_category = ?
        AND (cooperative_id = ? OR cooperative_id IS NULL)
        AND recorded_at BETWEEN datetime('now', '-7 days') AND datetime('now', '-1 day')
    `).all(alert.metricName, alert.metricCategory, alert.cooperativeId || null);

    // Get recent values
    const recentMetrics = db.prepare(`
      SELECT value
      FROM performance_metrics
      WHERE metric_name = ?
        AND metric_category = ?
        AND (cooperative_id = ? OR cooperative_id IS NULL)
        AND recorded_at >= datetime('now', '-${alert.thresholdDurationMinutes} minutes')
    `).all(alert.metricName, alert.metricCategory, alert.cooperativeId || null);

    if (historicalMetrics.length < 10 || recentMetrics.length === 0) return false;

    // Calculate baseline statistics
    const historicalValues = historicalMetrics.map(m => parseFloat(m.value));
    const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);

    // Check if recent values are anomalous (outside 3 standard deviations)
    const recentValues = recentMetrics.map(m => parseFloat(m.value));
    const anomalies = recentValues.filter(value => 
      Math.abs(value - mean) > (3 * stdDev)
    );

    return anomalies.length >= Math.ceil(recentValues.length * 0.5);
  }

  /**
   * Evaluate trend-based alert
   */
  private async evaluateTrendAlert(alert: AlertRule): Promise<boolean> {
    const db = getDatabase();
    
    // Get metrics from the last hour in 5-minute buckets
    const metrics = db.prepare(`
      SELECT 
        AVG(value) as avg_value,
        datetime(
          strftime('%Y-%m-%d %H:', recorded_at) || 
          printf('%02d', (CAST(strftime('%M', recorded_at) AS INTEGER) / 5) * 5) || 
          ':00'
        ) as bucket
      FROM performance_metrics
      WHERE metric_name = ?
        AND metric_category = ?
        AND (cooperative_id = ? OR cooperative_id IS NULL)
        AND recorded_at >= datetime('now', '-1 hour')
      GROUP BY bucket
      ORDER BY bucket
    `).all(alert.metricName, alert.metricCategory, alert.cooperativeId || null);

    if (metrics.length < 3) return false;

    // Calculate trend (simple linear regression slope)
    const n = metrics.length;
    const values = metrics.map((m, i) => ({ x: i, y: parseFloat(m.avg_value) }));
    
    const sumX = values.reduce((sum, p) => sum + p.x, 0);
    const sumY = values.reduce((sum, p) => sum + p.y, 0);
    const sumXY = values.reduce((sum, p) => sum + (p.x * p.y), 0);
    const sumXX = values.reduce((sum, p) => sum + (p.x * p.x), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Trigger if trend is significantly positive or negative
    const trendThreshold = alert.thresholdValue || 0.1;
    return Math.abs(slope) > trendThreshold;
  }

  /**
   * Evaluate availability-based alert
   */
  private async evaluateAvailabilityAlert(alert: AlertRule): Promise<boolean> {
    const db = getDatabase();
    
    // Check API error rates or system availability metrics
    const errorRate = db.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code >= 500 THEN 1 END) as error_requests
      FROM api_performance
      WHERE (cooperative_id = ? OR cooperative_id IS NULL)
        AND started_at >= datetime('now', '-${alert.thresholdDurationMinutes} minutes')
    `).get(alert.cooperativeId || null) as any;

    if (!errorRate || errorRate.total_requests === 0) return false;

    const currentErrorRate = (errorRate.error_requests / errorRate.total_requests) * 100;
    const threshold = alert.thresholdValue || 5; // 5% error rate threshold
    
    return currentErrorRate > threshold;
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(alert: AlertRule): Promise<void> {
    const db = getDatabase();
    const context: AlertContext = {
      cooperativeId: alert.cooperativeId || '',
      metricValue: 0, // Would be populated with actual value
      metricName: alert.metricName,
      timestamp: new Date().toISOString(),
    };

    try {
      // Get current metric value for context
      const currentMetric = db.prepare(`
        SELECT value FROM performance_metrics
        WHERE metric_name = ?
          AND metric_category = ?
          AND (cooperative_id = ? OR cooperative_id IS NULL)
        ORDER BY recorded_at DESC
        LIMIT 1
      `).get(alert.metricName, alert.metricCategory, alert.cooperativeId || null) as any;

      if (currentMetric) {
        context.metricValue = parseFloat(currentMetric.value);
      }

      // Create alert history entry
      const historyId = db.prepare(`
        INSERT INTO alert_history (
          cooperative_id, alert_id, event_type, metric_value, threshold_value,
          metric_name, severity, message, triggered_at
        ) VALUES (?, ?, 'triggered', ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        alert.cooperativeId,
        alert.id,
        context.metricValue,
        alert.thresholdValue || null,
        alert.metricName,
        alert.severity,
        this.generateAlertMessage(alert, context)
      );

      // Send notifications
      await this.sendNotifications(alert, context);

      // Update alert statistics
      db.prepare(`
        UPDATE performance_alerts SET
          last_triggered_at = datetime('now'),
          total_trigger_count = total_trigger_count + 1,
          trigger_count_today = CASE 
            WHEN date(last_triggered_at) = date('now') 
            THEN trigger_count_today + 1 
            ELSE 1 
          END
        WHERE id = ?
      `).run(alert.id);

      // Record metric for monitoring the alert system itself
      performanceCollector.recordMetric({
        name: 'alert_triggered',
        category: 'system',
        type: 'counter',
        value: 1,
        unit: 'count',
        cooperativeId: alert.cooperativeId,
        tags: {
          alert_id: alert.id,
          severity: alert.severity,
          metric_name: alert.metricName,
        },
      });

      console.log(`Alert triggered: ${alert.alertName} (${alert.severity})`);

    } catch (error) {
      console.error(`Failed to trigger alert ${alert.id}:`, error);
    }
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: AlertRule, context: AlertContext): Promise<void> {
    const message = this.generateAlertMessage(alert, context);
    const notifications: Array<{ channel: string; success: boolean }> = [];

    for (const channelType of alert.notificationChannels) {
      const channel = this.notificationChannels.get(channelType);
      if (channel) {
        try {
          const success = await channel.send(alert, context, message);
          notifications.push({ channel: channelType, success });
        } catch (error) {
          console.error(`Failed to send ${channelType} notification:`, error);
          notifications.push({ channel: channelType, success: false });
        }
      }
    }

    // Update notification status in alert history
    const db = getDatabase();
    db.prepare(`
      UPDATE alert_history SET
        notifications_sent = ?,
        notification_status = ?
      WHERE alert_id = ? AND triggered_at >= datetime('now', '-1 minute')
      ORDER BY triggered_at DESC
      LIMIT 1
    `).run(
      JSON.stringify(notifications),
      notifications.every(n => n.success) ? 'sent' : 'partial_failure'
    );
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(alert: AlertRule, context: AlertContext): string {
    const timestamp = new Date(context.timestamp).toLocaleString('sv-SE');
    
    let message = `🚨 ${alert.alertName}\n\n`;
    message += `Allvarlighetsgrad: ${alert.severity.toUpperCase()}\n`;
    message += `Mätvärde: ${alert.metricName}\n`;
    message += `Aktuellt värde: ${context.metricValue}\n`;
    
    if (alert.thresholdValue !== undefined) {
      message += `Tröskelvärde: ${alert.thresholdOperator} ${alert.thresholdValue}\n`;
    }
    
    message += `Tid: ${timestamp}\n`;
    
    if (context.cooperativeId) {
      message += `BRF: ${context.cooperativeId}\n`;
    }
    
    message += `\nVänligen kontrollera systemet och vidta nödvändiga åtgärder.`;
    
    return message;
  }

  /**
   * Setup default notification channels
   */
  private setupDefaultNotificationChannels(): void {
    // Email notification channel
    this.registerNotificationChannel('email', {
      type: 'email',
      async send(alert: AlertRule, context: AlertContext, message: string): Promise<boolean> {
        // This would integrate with email service (SendGrid, AWS SES, etc.)
        console.log('Email notification:', {
          to: alert.notifyEmails,
          subject: `Alert: ${alert.alertName}`,
          message
        });
        return true; // Assume success for now
      }
    });

    // Console/log notification channel (for development)
    this.registerNotificationChannel('console', {
      type: 'webhook',
      async send(alert: AlertRule, context: AlertContext, message: string): Promise<boolean> {
        console.log('ALERT NOTIFICATION:', message);
        return true;
      }
    });
  }
}

// Export singleton instance
export const alertEngine = AlertEngine.getInstance();