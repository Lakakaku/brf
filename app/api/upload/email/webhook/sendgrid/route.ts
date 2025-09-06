/**
 * SendGrid Email-to-Upload Webhook Handler
 * Processes incoming emails from SendGrid's Inbound Parse API
 * Part of the BRF Portal email-to-upload functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { EmailUploadProcessor } from '@/lib/email/processor';
import { EmailValidator } from '@/lib/email/validator';
import { logEvent } from '@/lib/monitoring/events';
import { SwedishMessages } from '@/lib/upload/messages';
import { BulkUploadSystem } from '@/lib/upload';

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
 * POST /api/upload/email/webhook/sendgrid - Handle SendGrid webhook
 */
export async function POST(request: NextRequest) {
  try {
    const { emailProcessor, emailValidator, bulkUploadSystem } = getEmailSystems();

    // Parse SendGrid webhook payload
    const formData = await request.formData();
    
    const emailData = {
      to: formData.get('to') as string,
      from: formData.get('from') as string,
      cc: formData.get('cc') as string,
      bcc: formData.get('bcc') as string,
      subject: formData.get('subject') as string,
      text: formData.get('text') as string,
      html: formData.get('html') as string,
      headers: formData.get('headers') as string,
      envelope: formData.get('envelope') as string,
      dkim: formData.get('dkim') as string,
      spf: formData.get('spf') as string,
      charsets: formData.get('charsets') as string,
    };

    // Extract attachments
    const attachments = [];
    let attachmentIndex = 1;
    
    while (formData.get(`attachment${attachmentIndex}`)) {
      const attachmentFile = formData.get(`attachment${attachmentIndex}`) as File;
      const attachmentInfo = formData.get(`attachment${attachmentIndex}-info`) as string;
      
      if (attachmentFile && attachmentFile.size > 0) {
        attachments.push({
          filename: attachmentFile.name,
          contentType: attachmentFile.type,
          size: attachmentFile.size,
          content: await attachmentFile.arrayBuffer(),
          info: attachmentInfo ? JSON.parse(attachmentInfo) : null,
        });
      }
      attachmentIndex++;
    }

    // Process email header for authentication verification
    const headers = emailData.headers ? JSON.parse(emailData.headers) : {};
    const envelope = emailData.envelope ? JSON.parse(emailData.envelope) : {};

    // Validate email source and authentication
    const validationResult = await emailValidator.validateEmailSource({
      from: emailData.from,
      to: emailData.to,
      headers,
      envelope,
      dkim: emailData.dkim,
      spf: emailData.spf,
      provider: 'sendgrid',
    });

    if (!validationResult.success) {
      await logEvent({
        cooperative_id: 'unknown',
        event_type: 'email_upload_rejected',
        event_level: 'warning',
        event_source: 'email_upload_webhook',
        event_message: 'Email rejected due to validation failure',
        event_data: {
          provider: 'sendgrid',
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          validation_error: validationResult.error,
          webhook_endpoint: '/api/upload/email/webhook/sendgrid',
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
      email_data: emailData,
      attachments,
      provider: 'sendgrid',
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
          provider: 'sendgrid',
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          attachments_count: attachments.length,
          processing_error: processingResult.error,
          webhook_endpoint: '/api/upload/email/webhook/sendgrid',
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
            message_id: headers['Message-ID'],
            date: headers['Date'],
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
          provider: 'sendgrid',
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          batch_id: batchResult.batch_id,
          attachments_processed: processingResult.data.valid_attachments.length,
          attachments_rejected: processingResult.data.rejected_attachments.length,
          webhook_endpoint: '/api/upload/email/webhook/sendgrid',
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
    console.error('SendGrid webhook error:', error);

    await logEvent({
      cooperative_id: 'unknown',
      event_type: 'email_upload_webhook_error',
      event_level: 'error',
      event_source: 'email_upload_webhook',
      event_message: 'SendGrid webhook processing failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      event_data: {
        provider: 'sendgrid',
        webhook_endpoint: '/api/upload/email/webhook/sendgrid',
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
 * GET /api/upload/email/webhook/sendgrid - Webhook verification
 */
export async function GET(request: NextRequest) {
  // Handle webhook verification if needed
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({
    success: true,
    message: 'SendGrid webhook endpoint active',
    provider: 'sendgrid',
    timestamp: new Date().toISOString(),
  });
}