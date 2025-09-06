/**
 * Bulk Upload Webhook API
 * Handles webhook notifications for bulk upload status updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { logEvent } from '@/lib/monitoring/events';
import { z } from 'zod';

const WebhookPayloadSchema = z.object({
  event_type: z.enum([
    'batch.created',
    'batch.started',
    'batch.progress',
    'batch.completed',
    'batch.failed',
    'batch.cancelled',
    'file.uploaded',
    'file.processed',
    'file.failed',
    'file.virus_detected'
  ]),
  batch_id: z.string(),
  cooperative_id: z.string(),
  timestamp: z.string(),
  data: z.record(z.any()),
  signature: z.string().optional(),
});

/**
 * POST /api/upload/webhook - Receive webhook notifications from external services
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const validationResult = WebhookPayloadSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      
      await logEvent({
        cooperative_id: body.cooperative_id || 'unknown',
        event_type: 'webhook_validation_failed',
        event_level: 'warning',
        event_source: 'webhook_api',
        event_message: 'Invalid webhook payload received',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          validation_errors: errors,
          payload: body,
        },
      });

      return NextResponse.json(
        { 
          error: 'Invalid webhook payload',
          details: errors,
          code: 'VALIDATION_FAILED' 
        },
        { status: 400 }
      );
    }

    const { event_type, batch_id, cooperative_id, timestamp, data, signature } = validationResult.data;

    // Verify webhook signature if provided
    if (signature) {
      const isValid = await verifyWebhookSignature(request, body, signature);
      if (!isValid) {
        await logEvent({
          cooperative_id,
          event_type: 'webhook_signature_invalid',
          event_level: 'error',
          event_source: 'webhook_api',
          event_message: 'Invalid webhook signature',
          batch_id,
          request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          event_data: { signature },
        });

        return NextResponse.json(
          { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
          { status: 401 }
        );
      }
    }

    // Process the webhook event
    await processWebhookEvent(event_type, batch_id, cooperative_id, data, request);

    // Log successful webhook processing
    await logEvent({
      cooperative_id,
      event_type: 'webhook_processed',
      event_level: 'info',
      event_source: 'webhook_api',
      event_message: `Webhook event ${event_type} processed successfully`,
      batch_id,
      request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        event_type,
        webhook_timestamp: timestamp,
        data_keys: Object.keys(data),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      event_type,
      batch_id,
      processed_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Webhook processing error:', error);

    // Log error
    try {
      await logEvent({
        cooperative_id: 'unknown',
        event_type: 'webhook_processing_error',
        event_level: 'error',
        event_source: 'webhook_api',
        event_message: 'Webhook processing failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        event_data: {
          error: error instanceof Error ? error.stack : error,
        },
      });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Webhook processing failed',
        code: 'WEBHOOK_PROCESSING_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload/webhook - Get webhook configuration info
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upload/webhook`,
      supported_events: [
        'batch.created',
        'batch.started', 
        'batch.progress',
        'batch.completed',
        'batch.failed',
        'batch.cancelled',
        'file.uploaded',
        'file.processed', 
        'file.failed',
        'file.virus_detected'
      ],
      authentication: {
        signature_header: 'X-Webhook-Signature',
        algorithm: 'HMAC-SHA256',
      },
      rate_limits: {
        requests_per_minute: 100,
        burst_limit: 10,
      },
    },
  });
}

/**
 * Verify webhook signature using HMAC-SHA256
 */
async function verifyWebhookSignature(
  request: NextRequest, 
  payload: any, 
  signature: string
): Promise<boolean> {
  try {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      console.warn('WEBHOOK_SECRET not configured, skipping signature verification');
      return true; // Allow if no secret configured
    }

    const crypto = await import('crypto');
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    // Compare signatures using constant-time comparison
    const providedSignature = signature.replace('sha256=', '');
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Process different types of webhook events
 */
async function processWebhookEvent(
  eventType: string, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>,
  request: NextRequest
): Promise<void> {
  const db = getDatabase();

  switch (eventType) {
    case 'batch.created':
      await handleBatchCreated(db, batchId, cooperativeId, data);
      break;

    case 'batch.started':
      await handleBatchStarted(db, batchId, cooperativeId, data);
      break;

    case 'batch.progress':
      await handleBatchProgress(db, batchId, cooperativeId, data);
      break;

    case 'batch.completed':
      await handleBatchCompleted(db, batchId, cooperativeId, data);
      break;

    case 'batch.failed':
      await handleBatchFailed(db, batchId, cooperativeId, data);
      break;

    case 'batch.cancelled':
      await handleBatchCancelled(db, batchId, cooperativeId, data);
      break;

    case 'file.uploaded':
      await handleFileUploaded(db, batchId, cooperativeId, data);
      break;

    case 'file.processed':
      await handleFileProcessed(db, batchId, cooperativeId, data);
      break;

    case 'file.failed':
      await handleFileFailed(db, batchId, cooperativeId, data);
      break;

    case 'file.virus_detected':
      await handleVirusDetected(db, batchId, cooperativeId, data);
      break;

    default:
      console.warn(`Unknown webhook event type: ${eventType}`);
  }
}

/**
 * Event handlers for specific webhook events
 */
async function handleBatchCreated(
  db: any, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>
): Promise<void> {
  // Update batch status if needed
  const stmt = db.prepare(`
    UPDATE bulk_upload_batches 
    SET updated_at = datetime('now')
    WHERE id = ? AND cooperative_id = ?
  `);
  stmt.run(batchId, cooperativeId);

  // Send notification if configured
  await sendNotificationIfConfigured(cooperativeId, {
    type: 'batch_created',
    batch_id: batchId,
    message: 'Bulk upload batch created successfully',
    data,
  });
}

async function handleBatchStarted(
  db: any, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>
): Promise<void> {
  const stmt = db.prepare(`
    UPDATE bulk_upload_batches 
    SET status = 'uploading', started_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND cooperative_id = ? AND status = 'pending'
  `);
  stmt.run(batchId, cooperativeId);

  await sendNotificationIfConfigured(cooperativeId, {
    type: 'batch_started',
    batch_id: batchId,
    message: 'Bulk upload processing started',
    data,
  });
}

async function handleBatchProgress(
  db: any, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>
): Promise<void> {
  if (data.progress_percentage !== undefined) {
    const stmt = db.prepare(`
      UPDATE bulk_upload_batches 
      SET progress_percentage = ?, updated_at = datetime('now')
      WHERE id = ? AND cooperative_id = ?
    `);
    stmt.run(data.progress_percentage, batchId, cooperativeId);
  }
}

async function handleBatchCompleted(
  db: any, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>
): Promise<void> {
  const stmt = db.prepare(`
    UPDATE bulk_upload_batches 
    SET status = 'completed', progress_percentage = 100, completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND cooperative_id = ?
  `);
  stmt.run(batchId, cooperativeId);

  await sendNotificationIfConfigured(cooperativeId, {
    type: 'batch_completed',
    batch_id: batchId,
    message: 'Bulk upload completed successfully',
    data,
  });
}

async function handleBatchFailed(
  db: any, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>
): Promise<void> {
  const stmt = db.prepare(`
    UPDATE bulk_upload_batches 
    SET status = 'failed', updated_at = datetime('now')
    WHERE id = ? AND cooperative_id = ?
  `);
  stmt.run(batchId, cooperativeId);

  await sendNotificationIfConfigured(cooperativeId, {
    type: 'batch_failed',
    batch_id: batchId,
    message: 'Bulk upload failed',
    data,
    priority: 'high',
  });
}

async function handleBatchCancelled(
  db: any, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>
): Promise<void> {
  const stmt = db.prepare(`
    UPDATE bulk_upload_batches 
    SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ? AND cooperative_id = ?
  `);
  stmt.run(batchId, cooperativeId);
}

async function handleFileUploaded(
  db: any, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>
): Promise<void> {
  if (data.file_id) {
    const stmt = db.prepare(`
      UPDATE bulk_upload_files 
      SET upload_status = 'uploaded', upload_completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND batch_id = ? AND cooperative_id = ?
    `);
    stmt.run(data.file_id, batchId, cooperativeId);
  }
}

async function handleFileProcessed(
  db: any, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>
): Promise<void> {
  if (data.file_id) {
    const stmt = db.prepare(`
      UPDATE bulk_upload_files 
      SET processing_status = 'processed', processing_completed_at = datetime('now'), 
          document_id = ?, updated_at = datetime('now')
      WHERE id = ? AND batch_id = ? AND cooperative_id = ?
    `);
    stmt.run(data.document_id || null, data.file_id, batchId, cooperativeId);
  }
}

async function handleFileFailed(
  db: any, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>
): Promise<void> {
  if (data.file_id) {
    const stmt = db.prepare(`
      UPDATE bulk_upload_files 
      SET upload_status = 'failed', processing_status = 'failed',
          error_count = error_count + 1, last_error_message = ?,
          updated_at = datetime('now')
      WHERE id = ? AND batch_id = ? AND cooperative_id = ?
    `);
    stmt.run(data.error_message || 'File processing failed', data.file_id, batchId, cooperativeId);
  }
}

async function handleVirusDetected(
  db: any, 
  batchId: string, 
  cooperativeId: string, 
  data: Record<string, any>
): Promise<void> {
  if (data.file_id) {
    const stmt = db.prepare(`
      UPDATE bulk_upload_files 
      SET virus_scan_status = 'infected', quarantined = 1, quarantine_reason = ?,
          upload_status = 'failed', processing_status = 'failed',
          updated_at = datetime('now')
      WHERE id = ? AND batch_id = ? AND cooperative_id = ?
    `);
    stmt.run(data.virus_details || 'Virus detected', data.file_id, batchId, cooperativeId);

    // High priority notification for virus detection
    await sendNotificationIfConfigured(cooperativeId, {
      type: 'virus_detected',
      batch_id: batchId,
      file_id: data.file_id,
      message: 'Virus detected in uploaded file',
      data,
      priority: 'critical',
    });
  }
}

/**
 * Send notification if configured for the cooperative
 */
async function sendNotificationIfConfigured(
  cooperativeId: string, 
  notification: {
    type: string;
    batch_id: string;
    file_id?: string;
    message: string;
    data: Record<string, any>;
    priority?: string;
  }
): Promise<void> {
  try {
    const db = getDatabase();
    
    // Get notification settings for the cooperative
    const stmt = db.prepare(`
      SELECT notification_emails, slack_webhook_url, teams_webhook_url
      FROM bulk_upload_settings 
      WHERE cooperative_id = ?
    `);
    
    const settings = stmt.get(cooperativeId);
    if (!settings) return;

    const emails = JSON.parse(settings.notification_emails || '[]');
    
    // Create notification record
    if (emails.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO notifications (
          cooperative_id, type, title, message, data, channels, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      
      insertStmt.run(
        cooperativeId,
        notification.type,
        `Bulk Upload: ${notification.message}`,
        notification.message,
        JSON.stringify(notification.data),
        JSON.stringify(['email'])
      );
    }

    // Send to Slack/Teams webhooks if configured
    if (settings.slack_webhook_url) {
      await sendSlackNotification(settings.slack_webhook_url, notification);
    }
    
    if (settings.teams_webhook_url) {
      await sendTeamsNotification(settings.teams_webhook_url, notification);
    }

  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(webhookUrl: string, notification: any): Promise<void> {
  try {
    const payload = {
      text: notification.message,
      attachments: [{
        color: notification.priority === 'critical' ? 'danger' : 
               notification.priority === 'high' ? 'warning' : 'good',
        fields: [
          {
            title: 'Batch ID',
            value: notification.batch_id,
            short: true,
          },
          {
            title: 'Type',
            value: notification.type,
            short: true,
          },
        ],
        timestamp: Math.floor(Date.now() / 1000),
      }],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Slack notification failed:', response.statusText);
    }

  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
}

/**
 * Send Teams notification
 */
async function sendTeamsNotification(webhookUrl: string, notification: any): Promise<void> {
  try {
    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: notification.priority === 'critical' ? 'FF0000' : 
                  notification.priority === 'high' ? 'FFA500' : '00FF00',
      summary: notification.message,
      sections: [{
        activityTitle: 'Bulk Upload Notification',
        activitySubtitle: notification.message,
        facts: [
          {
            name: 'Batch ID',
            value: notification.batch_id,
          },
          {
            name: 'Type',
            value: notification.type,
          },
          {
            name: 'Time',
            value: new Date().toISOString(),
          },
        ],
      }],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Teams notification failed:', response.statusText);
    }

  } catch (error) {
    console.error('Failed to send Teams notification:', error);
  }
}