/**
 * Email Upload Processing System
 * Handles email parsing, attachment extraction, and BRF-specific document processing
 * Part of the BRF Portal email-to-upload functionality
 */

import { Database } from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { BRFDocumentClassifier } from './document-classifier';
import { EmailTemplates } from './templates';
import { SwedishMessages } from '@/lib/upload/messages';

export interface EmailData {
  to: string;
  from: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: string;
  envelope?: string;
  [key: string]: any;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: ArrayBuffer;
  cid?: string;
  info?: any;
}

export interface ProcessedAttachment {
  filename: string;
  contentType: string;
  size: number;
  temp_path: string;
  category: string;
  confidence: number;
  validation_errors?: string[];
}

export interface EmailProcessingResult {
  success: boolean;
  error?: string;
  data: {
    batch_id?: string;
    valid_attachments: ProcessedAttachment[];
    rejected_attachments: Array<{
      filename: string;
      reason: string;
      errors: string[];
    }>;
    email_metadata: {
      from: string;
      subject: string;
      processed_at: string;
      provider: string;
    };
  };
}

export class EmailUploadProcessor {
  private db: Database;
  private classifier: BRFDocumentClassifier;
  private templates: EmailTemplates;

  constructor(options: { database: Database }) {
    this.db = options.database;
    this.classifier = new BRFDocumentClassifier();
    this.templates = new EmailTemplates();
  }

  /**
   * Process incoming email with attachments
   */
  async processIncomingEmail(params: {
    cooperative_id: string;
    member_id?: string;
    email_data: EmailData;
    attachments: EmailAttachment[];
    provider: string;
    webhook_headers: Record<string, string>;
  }): Promise<EmailProcessingResult> {
    const { cooperative_id, member_id, email_data, attachments, provider } = params;
    
    try {
      // Create processing session
      const processing_id = uuidv4();
      const processed_at = new Date().toISOString();

      // Get cooperative settings for email upload rules
      const cooperative = this.db.prepare(`
        SELECT name, settings FROM cooperatives WHERE id = ? AND deleted_at IS NULL
      `).get(cooperative_id) as any;

      if (!cooperative) {
        throw new Error('Cooperative not found');
      }

      const cooperativeSettings = JSON.parse(cooperative.settings || '{}');
      const emailRules = cooperativeSettings.email_upload || {};

      const validAttachments: ProcessedAttachment[] = [];
      const rejectedAttachments: Array<{ filename: string; reason: string; errors: string[] }> = [];

      // Process each attachment
      for (const attachment of attachments) {
        try {
          const processingResult = await this.processAttachment(
            attachment, 
            cooperative_id, 
            emailRules,
            email_data
          );

          if (processingResult.success) {
            validAttachments.push(processingResult.data);
          } else {
            rejectedAttachments.push({
              filename: attachment.filename,
              reason: processingResult.error || 'Unknown error',
              errors: processingResult.errors || [],
            });
          }
        } catch (error) {
          rejectedAttachments.push({
            filename: attachment.filename,
            reason: 'Processing failed',
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          });
        }
      }

      // Log email processing event
      this.db.prepare(`
        INSERT INTO bulk_upload_events (
          id, cooperative_id, event_type, event_level, event_source,
          event_message, user_id, event_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        cooperative_id,
        'email_processed',
        'info',
        'email_upload_processor',
        'Email processed for upload',
        member_id,
        JSON.stringify({
          processing_id,
          provider,
          from: email_data.from,
          subject: email_data.subject,
          attachments_total: attachments.length,
          attachments_valid: validAttachments.length,
          attachments_rejected: rejectedAttachments.length,
        }),
        processed_at
      );

      return {
        success: true,
        data: {
          valid_attachments: validAttachments,
          rejected_attachments: rejectedAttachments,
          email_metadata: {
            from: email_data.from,
            subject: email_data.subject,
            processed_at,
            provider,
          },
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          valid_attachments: [],
          rejected_attachments: [],
          email_metadata: {
            from: email_data.from,
            subject: email_data.subject,
            processed_at: new Date().toISOString(),
            provider,
          },
        },
      };
    }
  }

  /**
   * Process individual attachment
   */
  private async processAttachment(
    attachment: EmailAttachment,
    cooperative_id: string,
    emailRules: any,
    email_data: EmailData
  ): Promise<{
    success: boolean;
    error?: string;
    errors?: string[];
    data?: ProcessedAttachment;
  }> {
    const errors: string[] = [];

    try {
      // Validate file size
      const maxFileSize = emailRules.max_file_size_mb || 25; // Default 25MB
      const maxFileSizeBytes = maxFileSize * 1024 * 1024;

      if (attachment.size > maxFileSizeBytes) {
        errors.push(`Filen är för stor: ${Math.round(attachment.size / 1024 / 1024)}MB (max ${maxFileSize}MB)`);
      }

      // Validate file type
      const allowedTypes = emailRules.allowed_file_types || [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];

      if (!allowedTypes.includes(attachment.contentType)) {
        errors.push(`Filtyp inte tillåten: ${attachment.contentType}`);
      }

      // Validate filename
      if (!attachment.filename || attachment.filename.trim() === '') {
        errors.push('Filnamn saknas');
      }

      // Check for dangerous file extensions
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.vbs', '.js'];
      const fileExt = path.extname(attachment.filename).toLowerCase();
      if (dangerousExtensions.includes(fileExt)) {
        errors.push(`Farlig filtyp: ${fileExt}`);
      }

      if (errors.length > 0) {
        return {
          success: false,
          error: 'File validation failed',
          errors,
        };
      }

      // Save attachment to temporary storage
      const tempDir = path.join(process.cwd(), 'uploads', 'temp', 'email');
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempFilename = `${uuidv4()}_${attachment.filename}`;
      const tempPath = path.join(tempDir, tempFilename);
      
      await fs.writeFile(tempPath, Buffer.from(attachment.content));

      // Classify document using BRF-specific rules
      const classificationResult = await this.classifier.classifyDocument({
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        tempPath,
        email_context: {
          from: email_data.from,
          subject: email_data.subject,
          body: email_data.text || email_data.html || '',
        },
        cooperative_id,
      });

      return {
        success: true,
        data: {
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          temp_path: tempPath,
          category: classificationResult.category,
          confidence: classificationResult.confidence,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errors: [error instanceof Error ? error.message : 'Unknown processing error'],
      };
    }
  }

  /**
   * Send upload confirmation email
   */
  async sendUploadConfirmation(params: {
    to: string;
    cooperative_id: string;
    batch_id: string;
    files_uploaded: number;
    subject: string;
  }): Promise<void> {
    const { to, cooperative_id, batch_id, files_uploaded, subject } = params;

    try {
      // Get cooperative details
      const cooperative = this.db.prepare(`
        SELECT name FROM cooperatives WHERE id = ? AND deleted_at IS NULL
      `).get(cooperative_id) as any;

      if (!cooperative) {
        throw new Error('Cooperative not found');
      }

      // Generate confirmation email
      const emailContent = this.templates.generateUploadConfirmation({
        cooperative_name: cooperative.name,
        batch_id,
        files_uploaded,
        original_subject: subject,
        upload_date: new Date().toISOString(),
      });

      // In a real implementation, this would send via SMTP or email service
      console.log('Email confirmation would be sent:', {
        to,
        subject: emailContent.subject,
        html: emailContent.html,
      });

      // Log confirmation sent
      this.db.prepare(`
        INSERT INTO bulk_upload_events (
          id, cooperative_id, event_type, event_level, event_source,
          event_message, event_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        cooperative_id,
        'email_confirmation_sent',
        'info',
        'email_upload_processor',
        'Upload confirmation email sent',
        JSON.stringify({
          recipient: to,
          batch_id,
          files_uploaded,
        }),
        new Date().toISOString()
      );

    } catch (error) {
      console.error('Failed to send upload confirmation:', error);
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(tempPaths: string[]): Promise<void> {
    for (const tempPath of tempPaths) {
      try {
        await fs.unlink(tempPath);
      } catch (error) {
        console.error(`Failed to clean up temp file: ${tempPath}`, error);
      }
    }
  }

  /**
   * Get email processing statistics
   */
  getProcessingStats(cooperative_id: string, days: number = 30): any {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.db.prepare(`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN event_type = 'email_processed' THEN 1 END) as emails_processed,
        COUNT(CASE WHEN event_type = 'email_upload_rejected' THEN 1 END) as emails_rejected,
        AVG(CASE WHEN event_type = 'email_processed' 
          THEN JSON_EXTRACT(event_data, '$.attachments_valid') END) as avg_files_per_email
      FROM bulk_upload_events 
      WHERE cooperative_id = ? 
        AND event_source = 'email_upload_processor'
        AND created_at >= ?
    `).get(cooperative_id, cutoffDate.toISOString());
  }
}