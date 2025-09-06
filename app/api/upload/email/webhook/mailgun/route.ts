/**
 * Mailgun Email-to-Upload Webhook Handler
 * Processes incoming emails from Mailgun's Routes API
 * Part of the BRF Portal email-to-upload functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { EmailUploadProcessor } from '@/lib/email/processor';
import { EmailValidator } from '@/lib/email/validator';
import { logEvent } from '@/lib/monitoring/events';
import { SwedishMessages } from '@/lib/upload/messages';
import { BulkUploadSystem } from '@/lib/upload';
import crypto from 'crypto';

// Initialize email upload system
let emailProcessor: EmailUploadProcessor;
let emailValidator: EmailValidator;
let bulkUploadSystem: BulkUploadSystem;

function getEmailSystems() {
  if (!emailProcessor) {
    const db = getDatabase();
    emailProcessor = new EmailUploadProcessor({ database: db });
    emailValidator = new EmailValidator({ database: db });
    bulkUploadSystem = new BulkUploadSystem({ database: db });
  }
  return { emailProcessor, emailValidator, bulkUploadSystem };
}

/**
 * Verify Mailgun webhook signature
 */
function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string,
  signingKey: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', signingKey);
    hmac.update(timestamp + token);
    const calculatedSignature = hmac.digest('hex');
    return calculatedSignature === signature;
  } catch (error) {
    console.error('Mailgun signature verification error:', error);
    return false;
  }
}

/**
 * POST /api/upload/email/webhook/mailgun - Handle Mailgun webhook
 */
export async function POST(request: NextRequest) {
  try {
    const { emailProcessor, emailValidator, bulkUploadSystem } = getEmailSystems();

    // Parse Mailgun webhook payload
    const formData = await request.formData();
    
    // Extract signature for verification
    const timestamp = formData.get('timestamp') as string;
    const token = formData.get('token') as string;
    const signature = formData.get('signature') as string;

    // Verify webhook signature (using environment variable for signing key)
    const signingKey = process.env.MAILGUN_SIGNING_KEY;
    if (signingKey && !verifyMailgunSignature(timestamp, token, signature, signingKey)) {
      await logEvent({
        cooperative_id: 'unknown',
        event_type: 'email_upload_webhook_security_violation',
        event_level: 'warning',
        event_source: 'email_upload_webhook',
        event_message: 'Mailgun webhook signature verification failed',
        event_data: {
          provider: 'mailgun',
          webhook_endpoint: '/api/upload/email/webhook/mailgun',
          timestamp,
          token: token ? 'present' : 'missing',
          signature: signature ? 'present' : 'missing',
        },
      });

      return NextResponse.json({
        success: false,
        message: 'Unauthorized',
        code: 'SIGNATURE_VERIFICATION_FAILED'
      }, { status: 401 });
    }

    const emailData = {
      to: formData.get('To') as string,
      from: formData.get('From') as string,
      cc: formData.get('Cc') as string,
      bcc: formData.get('Bcc') as string,
      subject: formData.get('Subject') as string,
      'body-plain': formData.get('body-plain') as string,
      'body-html': formData.get('body-html') as string,
      'stripped-text': formData.get('stripped-text') as string,
      'stripped-html': formData.get('stripped-html') as string,
      'stripped-signature': formData.get('stripped-signature') as string,
      'message-headers': formData.get('message-headers') as string,
      'content-id-map': formData.get('content-id-map') as string,
      References: formData.get('References') as string,
      'In-Reply-To': formData.get('In-Reply-To') as string,
      'Message-Id': formData.get('Message-Id') as string,
    };

    // Extract attachments
    const attachments = [];
    const attachmentCount = parseInt(formData.get('attachment-count') as string || '0');
    
    for (let i = 1; i <= attachmentCount; i++) {
      const attachmentFile = formData.get(`attachment-${i}`) as File;
      
      if (attachmentFile && attachmentFile.size > 0) {
        attachments.push({
          filename: attachmentFile.name,
          contentType: attachmentFile.type,
          size: attachmentFile.size,
          content: await attachmentFile.arrayBuffer(),
          cid: formData.get(`content-id-${i}`) as string,
        });
      }
    }

    // Process message headers
    const headers = emailData['message-headers'] 
      ? JSON.parse(emailData['message-headers']) 
      : {};

    // Convert headers array to object for easier access
    const headersObj: Record<string, string> = {};
    if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        headersObj[key] = value;
      });
    }

    // Validate email source and authentication
    const validationResult = await emailValidator.validateEmailSource({
      from: emailData.from,
      to: emailData.to,
      headers: headersObj,
      envelope: {
        from: emailData.from,
        to: emailData.to,
      },
      provider: 'mailgun',
    });

    if (!validationResult.success) {
      await logEvent({
        cooperative_id: 'unknown',
        event_type: 'email_upload_rejected',
        event_level: 'warning',
        event_source: 'email_upload_webhook',
        event_message: 'Email rejected due to validation failure',
        event_data: {
          provider: 'mailgun',
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          validation_error: validationResult.error,
          webhook_endpoint: '/api/upload/email/webhook/mailgun',
        },
      });

      return NextResponse.json({
        success: false,
        message: 'Email rejected',
        code: 'EMAIL_VALIDATION_FAILED'
      }, { status: 400 });
    }

    const { cooperative, member } = validationResult.data;

    // Process the email and attachments
    const processingResult = await emailProcessor.processIncomingEmail({
      cooperative_id: cooperative.id,
      member_id: member?.id,
      email_data: {
        ...emailData,
        text: emailData['body-plain'],
        html: emailData['body-html'],
        headers: JSON.stringify(headersObj),
      },
      attachments,
      provider: 'mailgun',
      webhook_headers: Object.fromEntries(request.headers.entries()),
    });

    if (!processingResult.success) {
      await logEvent({
        cooperative_id: cooperative.id,
        event_type: 'email_upload_processing_failed',
        event_level: 'error',
        event_source: 'email_upload_webhook',
        event_message: 'Email processing failed',
        user_id: member?.id,
        event_data: {
          provider: 'mailgun',
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          attachments_count: attachments.length,
          processing_error: processingResult.error,
          webhook_endpoint: '/api/upload/email/webhook/mailgun',
        },
      });

      return NextResponse.json({
        success: false,
        message: 'Email processing failed',
        code: 'EMAIL_PROCESSING_FAILED'
      }, { status: 500 });
    }

    // Create bulk upload batch if there are valid attachments
    if (processingResult.data.valid_attachments.length > 0) {
      const batchResult = await bulkUploadSystem.createBatch({
        cooperative_id: cooperative.id,
        batch_name: `Email Upload: ${emailData.subject}`,
        batch_description: `Files uploaded via email from ${emailData.from}`,
        uploaded_by: member?.id,
        upload_source: 'email',
        files: processingResult.data.valid_attachments.map(attachment => ({
          filename: attachment.filename,
          size: attachment.size,
          mimeType: attachment.contentType,
          tempPath: attachment.temp_path,
          category: attachment.category,
          confidence: attachment.confidence,
          email_source: {
            from: emailData.from,
            subject: emailData.subject,
            message_id: emailData['Message-Id'],
            date: headersObj['Date'],
          },
        })),
      });

      await logEvent({
        cooperative_id: cooperative.id,
        event_type: 'email_upload_success',
        event_level: 'info',
        event_source: 'email_upload_webhook',
        event_message: 'Email upload processed successfully',
        user_id: member?.id,
        event_data: {
          provider: 'mailgun',
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          batch_id: batchResult.batch_id,
          attachments_processed: processingResult.data.valid_attachments.length,
          attachments_rejected: processingResult.data.rejected_attachments.length,
          webhook_endpoint: '/api/upload/email/webhook/mailgun',
        },
      });

      // Send confirmation email if configured
      if (cooperative.settings?.email_upload?.send_confirmations) {
        await emailProcessor.sendUploadConfirmation({
          to: emailData.from,
          cooperative_id: cooperative.id,
          batch_id: batchResult.batch_id,
          files_uploaded: processingResult.data.valid_attachments.length,
          subject: emailData.subject,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: SwedishMessages.success.EMAIL_PROCESSED,
      data: {
        batch_id: processingResult.data.batch_id,
        files_processed: processingResult.data.valid_attachments.length,
        files_rejected: processingResult.data.rejected_attachments.length,
        cooperative: cooperative.name,
        member_email: member?.email,
      }
    });

  } catch (error) {
    console.error('Mailgun webhook error:', error);

    await logEvent({
      cooperative_id: 'unknown',
      event_type: 'email_upload_webhook_error',
      event_level: 'error',
      event_source: 'email_upload_webhook',
      event_message: 'Mailgun webhook processing failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      event_data: {
        provider: 'mailgun',
        webhook_endpoint: '/api/upload/email/webhook/mailgun',
        error: error instanceof Error ? error.stack : error,
      },
    });

    return NextResponse.json({
      success: false,
      message: SwedishMessages.errors.SYSTEM_ERROR,
      code: 'WEBHOOK_ERROR'
    }, { status: 500 });
  }
}

/**
 * GET /api/upload/email/webhook/mailgun - Webhook verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Mailgun webhook endpoint active',
    provider: 'mailgun',
    timestamp: new Date().toISOString(),
  });
}