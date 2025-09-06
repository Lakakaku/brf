/**
 * Email Upload Validation System
 * Validates email sources, authenticates senders, and enforces cooperative-specific rules
 * Part of the BRF Portal email-to-upload functionality
 */

import { Database } from 'sqlite3';
import { SwedishMessages } from '@/lib/upload/messages';

export interface EmailValidationContext {
  from: string;
  to: string;
  headers: Record<string, string>;
  envelope?: Record<string, string>;
  dkim?: string;
  spf?: string;
  provider: string;
}

export interface EmailValidationResult {
  success: boolean;
  error?: string;
  data?: {
    cooperative: {
      id: string;
      name: string;
      settings: any;
    };
    member?: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    validation_level: 'strict' | 'moderate' | 'permissive';
    authentication_status: {
      spf: 'pass' | 'fail' | 'neutral' | 'unknown';
      dkim: 'pass' | 'fail' | 'unknown';
      overall: 'authenticated' | 'suspicious' | 'failed';
    };
  };
}

export class EmailValidator {
  private db: Database;

  constructor(options: { database: Database }) {
    this.db = options.database;
  }

  /**
   * Validate email source and authenticate sender
   */
  async validateEmailSource(context: EmailValidationContext): Promise<EmailValidationResult> {
    try {
      // Extract cooperative from recipient email
      const cooperativeResult = await this.extractCooperativeFromRecipient(context.to);
      if (!cooperativeResult.success) {
        return {
          success: false,
          error: cooperativeResult.error || 'Could not identify cooperative from recipient',
        };
      }

      const cooperative = cooperativeResult.data;
      const cooperativeSettings = JSON.parse(cooperative.settings || '{}');
      const emailUploadSettings = cooperativeSettings.email_upload || {};

      // Check if email upload is enabled for this cooperative
      if (!emailUploadSettings.enabled) {
        return {
          success: false,
          error: 'E-postuppladdning är inte aktiverad för denna bostadsrättsförening',
        };
      }

      // Validate sender authentication
      const authStatus = this.validateEmailAuthentication(context);

      // Get validation level from cooperative settings
      const validationLevel = emailUploadSettings.validation_level || 'moderate';

      // Check sender authorization
      const senderResult = await this.validateSender(
        context.from,
        cooperative.id,
        validationLevel,
        authStatus
      );

      if (!senderResult.success) {
        return {
          success: false,
          error: senderResult.error || 'Sender not authorized',
        };
      }

      // Check rate limiting
      const rateLimitResult = await this.checkRateLimit(
        context.from,
        cooperative.id,
        emailUploadSettings
      );

      if (!rateLimitResult.success) {
        return {
          success: false,
          error: rateLimitResult.error || 'Rate limit exceeded',
        };
      }

      return {
        success: true,
        data: {
          cooperative: {
            id: cooperative.id,
            name: cooperative.name,
            settings: cooperativeSettings,
          },
          member: senderResult.data?.member,
          validation_level: validationLevel,
          authentication_status: authStatus,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      };
    }
  }

  /**
   * Extract cooperative information from recipient email
   */
  private async extractCooperativeFromRecipient(recipientEmail: string): Promise<{
    success: boolean;
    error?: string;
    data?: any;
  }> {
    try {
      // Try to match email patterns configured for cooperatives
      const cooperatives = this.db.prepare(`
        SELECT id, name, settings 
        FROM cooperatives 
        WHERE deleted_at IS NULL
      `).all();

      for (const cooperative of cooperatives) {
        const settings = JSON.parse((cooperative as any).settings || '{}');
        const emailPatterns = settings.email_upload?.email_patterns || [];

        // Check if recipient matches any configured patterns
        for (const pattern of emailPatterns) {
          const regex = new RegExp(pattern.replace('*', '.*'), 'i');
          if (regex.test(recipientEmail)) {
            return {
              success: true,
              data: cooperative,
            };
          }
        }

        // Check if recipient matches cooperative domain patterns
        const domainPatterns = settings.email_upload?.domain_patterns || [];
        const recipientDomain = recipientEmail.split('@')[1];

        for (const domainPattern of domainPatterns) {
          if (recipientDomain === domainPattern || recipientDomain.endsWith(`.${domainPattern}`)) {
            return {
              success: true,
              data: cooperative,
            };
          }
        }
      }

      // Fallback: look for exact email addresses in cooperative settings
      const emailRecipient = this.db.prepare(`
        SELECT c.id, c.name, c.settings
        FROM cooperatives c
        WHERE JSON_EXTRACT(c.settings, '$.email_upload.upload_addresses') LIKE ?
          AND c.deleted_at IS NULL
      `).get(`%${recipientEmail}%`) as any;

      if (emailRecipient) {
        return {
          success: true,
          data: emailRecipient,
        };
      }

      return {
        success: false,
        error: 'No cooperative found for recipient email',
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract cooperative',
      };
    }
  }

  /**
   * Validate email authentication (SPF, DKIM)
   */
  private validateEmailAuthentication(context: EmailValidationContext): {
    spf: 'pass' | 'fail' | 'neutral' | 'unknown';
    dkim: 'pass' | 'fail' | 'unknown';
    overall: 'authenticated' | 'suspicious' | 'failed';
  } {
    let spfStatus: 'pass' | 'fail' | 'neutral' | 'unknown' = 'unknown';
    let dkimStatus: 'pass' | 'fail' | 'unknown' = 'unknown';

    // Parse SPF result
    if (context.spf) {
      const spfLower = context.spf.toLowerCase();
      if (spfLower.includes('pass')) spfStatus = 'pass';
      else if (spfLower.includes('fail')) spfStatus = 'fail';
      else if (spfLower.includes('neutral') || spfLower.includes('softfail')) spfStatus = 'neutral';
    }

    // Parse DKIM result
    if (context.dkim) {
      const dkimLower = context.dkim.toLowerCase();
      if (dkimLower.includes('pass') || dkimLower === 'valid') dkimStatus = 'pass';
      else if (dkimLower.includes('fail') || dkimLower.includes('invalid')) dkimStatus = 'fail';
    }

    // Determine overall authentication status
    let overall: 'authenticated' | 'suspicious' | 'failed';
    
    if (spfStatus === 'pass' && dkimStatus === 'pass') {
      overall = 'authenticated';
    } else if (spfStatus === 'fail' || dkimStatus === 'fail') {
      overall = 'failed';
    } else if (spfStatus === 'pass' || dkimStatus === 'pass') {
      overall = 'authenticated';
    } else {
      overall = 'suspicious';
    }

    return { spf: spfStatus, dkim: dkimStatus, overall };
  }

  /**
   * Validate sender authorization
   */
  private async validateSender(
    senderEmail: string,
    cooperativeId: string,
    validationLevel: string,
    authStatus: any
  ): Promise<{
    success: boolean;
    error?: string;
    data?: { member?: any };
  }> {
    try {
      // Check if sender is a member of the cooperative
      const member = this.db.prepare(`
        SELECT id, email, first_name, last_name, role, status
        FROM members 
        WHERE cooperative_id = ? 
          AND email = ? 
          AND deleted_at IS NULL
      `).get(cooperativeId, senderEmail) as any;

      if (member) {
        // Check member status
        if (member.status !== 'active') {
          return {
            success: false,
            error: 'Medlemskontot är inte aktivt',
          };
        }

        return {
          success: true,
          data: { 
            member: {
              id: member.id,
              email: member.email,
              name: `${member.first_name} ${member.last_name}`,
              role: member.role,
            }
          },
        };
      }

      // If not a member, check validation level requirements
      if (validationLevel === 'strict') {
        return {
          success: false,
          error: 'Endast registrerade medlemmar kan ladda upp dokument via e-post',
        };
      }

      // For moderate/permissive levels, check authentication
      if (validationLevel === 'moderate' && authStatus.overall !== 'authenticated') {
        return {
          success: false,
          error: 'E-postautentisering krävs för externa avsändare',
        };
      }

      // Check if sender domain is allowed
      const senderDomain = senderEmail.split('@')[1];
      const cooperative = this.db.prepare(`
        SELECT settings FROM cooperatives WHERE id = ?
      `).get(cooperativeId) as any;

      if (cooperative) {
        const settings = JSON.parse(cooperative.settings || '{}');
        const allowedDomains = settings.email_upload?.allowed_external_domains || [];

        if (allowedDomains.length > 0 && !allowedDomains.includes(senderDomain)) {
          return {
            success: false,
            error: `Domänen ${senderDomain} är inte tillåten för e-postuppladdning`,
          };
        }
      }

      // Allow external sender for permissive level
      return {
        success: true,
        data: {},
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sender validation failed',
      };
    }
  }

  /**
   * Check rate limiting for email uploads
   */
  private async checkRateLimit(
    senderEmail: string,
    cooperativeId: string,
    emailUploadSettings: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rateLimits = emailUploadSettings.rate_limits || {
        emails_per_hour: 10,
        emails_per_day: 50,
        files_per_day: 100,
      };

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Check emails per hour
      const emailsLastHour = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM bulk_upload_events
        WHERE cooperative_id = ?
          AND event_type = 'email_processed'
          AND JSON_EXTRACT(event_data, '$.from') = ?
          AND created_at >= ?
      `).get(cooperativeId, senderEmail, oneHourAgo.toISOString()) as any;

      if (emailsLastHour.count >= rateLimits.emails_per_hour) {
        return {
          success: false,
          error: `För många e-postmeddelanden per timme (max ${rateLimits.emails_per_hour})`,
        };
      }

      // Check emails per day
      const emailsLastDay = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM bulk_upload_events
        WHERE cooperative_id = ?
          AND event_type = 'email_processed'
          AND JSON_EXTRACT(event_data, '$.from') = ?
          AND created_at >= ?
      `).get(cooperativeId, senderEmail, oneDayAgo.toISOString()) as any;

      if (emailsLastDay.count >= rateLimits.emails_per_day) {
        return {
          success: false,
          error: `För många e-postmeddelanden per dag (max ${rateLimits.emails_per_day})`,
        };
      }

      // Check files per day
      const filesLastDay = this.db.prepare(`
        SELECT COALESCE(SUM(JSON_EXTRACT(event_data, '$.attachments_valid')), 0) as count
        FROM bulk_upload_events
        WHERE cooperative_id = ?
          AND event_type = 'email_processed'
          AND JSON_EXTRACT(event_data, '$.from') = ?
          AND created_at >= ?
      `).get(cooperativeId, senderEmail, oneDayAgo.toISOString()) as any;

      if (filesLastDay.count >= rateLimits.files_per_day) {
        return {
          success: false,
          error: `För många filer per dag (max ${rateLimits.files_per_day})`,
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rate limit check failed',
      };
    }
  }

  /**
   * Get allowed email patterns for a cooperative
   */
  getAllowedEmailPatterns(cooperativeId: string): string[] {
    try {
      const cooperative = this.db.prepare(`
        SELECT settings FROM cooperatives WHERE id = ? AND deleted_at IS NULL
      `).get(cooperativeId) as any;

      if (!cooperative) return [];

      const settings = JSON.parse(cooperative.settings || '{}');
      const emailUpload = settings.email_upload || {};

      return [
        ...(emailUpload.email_patterns || []),
        ...(emailUpload.upload_addresses || []),
      ];

    } catch (error) {
      console.error('Failed to get email patterns:', error);
      return [];
    }
  }

  /**
   * Get validation statistics for a cooperative
   */
  getValidationStats(cooperativeId: string, days: number = 30): any {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.db.prepare(`
      SELECT 
        COUNT(*) as total_validations,
        COUNT(CASE WHEN event_type = 'email_upload_rejected' THEN 1 END) as rejected_emails,
        COUNT(CASE WHEN event_type = 'email_processed' THEN 1 END) as accepted_emails,
        COUNT(DISTINCT JSON_EXTRACT(event_data, '$.from')) as unique_senders
      FROM bulk_upload_events 
      WHERE cooperative_id = ? 
        AND event_source IN ('email_upload_webhook', 'email_upload_processor')
        AND created_at >= ?
    `).get(cooperativeId, cutoffDate.toISOString());
  }
}