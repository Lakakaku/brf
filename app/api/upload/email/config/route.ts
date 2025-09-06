/**
 * Email Upload Configuration API
 * Manages email-to-upload settings for cooperatives
 * Part of the BRF Portal email-to-upload system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { requireAuth } from '@/lib/auth/middleware';
import { logEvent } from '@/lib/monitoring/events';
import { SwedishMessages } from '@/lib/upload/messages';
import { z } from 'zod';

// Email configuration schema
const EmailConfigSchema = z.object({
  enabled: z.boolean().default(false),
  validation_level: z.enum(['strict', 'moderate', 'permissive']).default('moderate'),
  email_patterns: z.array(z.string()).default([]),
  domain_patterns: z.array(z.string()).default([]),
  upload_addresses: z.array(z.string().email()).default([]),
  allowed_external_domains: z.array(z.string()).default([]),
  max_file_size_mb: z.number().min(1).max(100).default(25),
  allowed_file_types: z.array(z.string()).default([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]),
  rate_limits: z.object({
    emails_per_hour: z.number().min(1).max(100).default(10),
    emails_per_day: z.number().min(1).max(500).default(50),
    files_per_day: z.number().min(1).max(1000).default(100),
  }).default({}),
  send_confirmations: z.boolean().default(true),
  require_member_authentication: z.boolean().default(true),
  auto_categorization: z.boolean().default(true),
  quarantine_suspicious_emails: z.boolean().default(true),
  notification_settings: z.object({
    notify_admin_on_upload: z.boolean().default(false),
    notify_admin_on_rejection: z.boolean().default(true),
    admin_email: z.string().email().optional(),
    weekly_digest: z.boolean().default(true),
  }).default({}),
});

/**
 * GET /api/upload/email/config - Get email upload configuration
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request, {
      permissions: ['canManageSettings'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.AUTHENTICATION_REQUIRED,
          code: 'AUTHENTICATION_REQUIRED' 
        },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const db = getDatabase();

    // Get current cooperative settings
    const cooperative = db.prepare(`
      SELECT id, name, settings
      FROM cooperatives 
      WHERE id = ? AND deleted_at IS NULL
    `).get(user.cooperativeId) as any;

    if (!cooperative) {
      return NextResponse.json(
        { 
          error: 'Cooperative not found',
          code: 'COOPERATIVE_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    const settings = JSON.parse(cooperative.settings || '{}');
    const emailConfig = settings.email_upload || {};

    // Parse and validate current configuration
    const currentConfig = EmailConfigSchema.parse(emailConfig);

    return NextResponse.json({
      success: true,
      data: {
        cooperative_id: cooperative.id,
        cooperative_name: cooperative.name,
        email_upload: currentConfig,
        available_providers: [
          {
            name: 'SendGrid',
            webhook_url: '/api/upload/email/webhook/sendgrid',
            supports_signature_verification: true,
          },
          {
            name: 'Mailgun',
            webhook_url: '/api/upload/email/webhook/mailgun',
            supports_signature_verification: true,
          },
          {
            name: 'Custom SMTP',
            webhook_url: '/api/upload/email/webhook/custom',
            supports_signature_verification: false,
          },
        ],
        suggested_upload_addresses: [
          `upload@${cooperative.name.toLowerCase().replace(/\s+/g, '-')}.brf-portal.se`,
          `documents@${cooperative.name.toLowerCase().replace(/\s+/g, '-')}.brf-portal.se`,
          `files@${cooperative.name.toLowerCase().replace(/\s+/g, '-')}.brf-portal.se`,
        ],
      }
    });

  } catch (error) {
    console.error('Email config GET error:', error);

    return NextResponse.json({
      success: false,
      message: SwedishMessages.errors.SYSTEM_ERROR,
      code: 'CONFIG_GET_FAILED'
    }, { status: 500 });
  }
}

/**
 * PUT /api/upload/email/config - Update email upload configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request, {
      permissions: ['canManageSettings'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.AUTHENTICATION_REQUIRED,
          code: 'AUTHENTICATION_REQUIRED' 
        },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const body = await request.json();

    // Validate configuration
    const validationResult = EmailConfigSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        { 
          error: 'Invalid configuration',
          details: errors,
          code: 'VALIDATION_FAILED' 
        },
        { status: 400 }
      );
    }

    const newConfig = validationResult.data;
    const db = getDatabase();

    // Get current cooperative settings
    const cooperative = db.prepare(`
      SELECT id, name, settings
      FROM cooperatives 
      WHERE id = ? AND deleted_at IS NULL
    `).get(user.cooperativeId) as any;

    if (!cooperative) {
      return NextResponse.json(
        { 
          error: 'Cooperative not found',
          code: 'COOPERATIVE_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    const currentSettings = JSON.parse(cooperative.settings || '{}');
    const previousConfig = currentSettings.email_upload || {};

    // Update settings with new email configuration
    const updatedSettings = {
      ...currentSettings,
      email_upload: newConfig,
    };

    // Save updated settings
    db.prepare(`
      UPDATE cooperatives 
      SET settings = ?, updated_at = ? 
      WHERE id = ?
    `).run(
      JSON.stringify(updatedSettings),
      new Date().toISOString(),
      user.cooperativeId
    );

    // Log configuration change
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'email_config_updated',
      event_level: 'info',
      event_source: 'email_config_api',
      event_message: 'Email upload configuration updated',
      user_id: user.id,
      event_data: {
        previous_config: previousConfig,
        new_config: newConfig,
        changes: getConfigurationChanges(previousConfig, newConfig),
        endpoint: '/api/upload/email/config',
        method: 'PUT',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Email upload configuration updated successfully',
      data: {
        cooperative_id: user.cooperativeId,
        email_upload: newConfig,
        changes_applied: getConfigurationChanges(previousConfig, newConfig),
      }
    });

  } catch (error) {
    console.error('Email config PUT error:', error);

    // Log error
    try {
      const authResult = await requireAuth(request, { skipPermissionCheck: true });
      const user = authResult.success ? authResult.user : null;

      await logEvent({
        cooperative_id: user?.cooperativeId || 'unknown',
        event_type: 'email_config_update_error',
        event_level: 'error',
        event_source: 'email_config_api',
        event_message: 'Email configuration update failed',
        user_id: user?.id,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        event_data: {
          endpoint: '/api/upload/email/config',
          method: 'PUT',
          error: error instanceof Error ? error.stack : error,
        },
      });
    } catch (logError) {
      console.error('Failed to log config error:', logError);
    }

    return NextResponse.json({
      success: false,
      message: SwedishMessages.errors.SYSTEM_ERROR,
      code: 'CONFIG_UPDATE_FAILED'
    }, { status: 500 });
  }
}

/**
 * POST /api/upload/email/config/test - Test email configuration
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request, {
      permissions: ['canManageSettings'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.AUTHENTICATION_REQUIRED,
          code: 'AUTHENTICATION_REQUIRED' 
        },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const body = await request.json();

    const testSchema = z.object({
      test_email: z.string().email(),
      test_scenario: z.enum(['basic', 'with_attachments', 'large_files', 'invalid_sender']).default('basic'),
    });

    const testParams = testSchema.parse(body);

    // Log test request
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'email_config_test',
      event_level: 'info',
      event_source: 'email_config_api',
      event_message: 'Email configuration test initiated',
      user_id: user.id,
      event_data: {
        test_email: testParams.test_email,
        test_scenario: testParams.test_scenario,
        endpoint: '/api/upload/email/config/test',
      },
    });

    // Generate test instructions
    const testInstructions = generateTestInstructions(user.cooperativeId, testParams);

    return NextResponse.json({
      success: true,
      message: 'Test instructions generated',
      data: testInstructions,
    });

  } catch (error) {
    console.error('Email config test error:', error);

    return NextResponse.json({
      success: false,
      message: SwedishMessages.errors.SYSTEM_ERROR,
      code: 'CONFIG_TEST_FAILED'
    }, { status: 500 });
  }
}

/**
 * Compare configurations and return changes
 */
function getConfigurationChanges(previous: any, current: any): string[] {
  const changes: string[] = [];
  
  if (previous.enabled !== current.enabled) {
    changes.push(`Email upload ${current.enabled ? 'enabled' : 'disabled'}`);
  }
  
  if (previous.validation_level !== current.validation_level) {
    changes.push(`Validation level changed from ${previous.validation_level || 'default'} to ${current.validation_level}`);
  }
  
  if (previous.max_file_size_mb !== current.max_file_size_mb) {
    changes.push(`Max file size changed from ${previous.max_file_size_mb || 25}MB to ${current.max_file_size_mb}MB`);
  }
  
  if (JSON.stringify(previous.upload_addresses || []) !== JSON.stringify(current.upload_addresses)) {
    changes.push(`Upload addresses updated`);
  }
  
  if (previous.send_confirmations !== current.send_confirmations) {
    changes.push(`Confirmation emails ${current.send_confirmations ? 'enabled' : 'disabled'}`);
  }
  
  return changes;
}

/**
 * Generate test instructions for email configuration
 */
function generateTestInstructions(cooperativeId: string, testParams: any) {
  return {
    test_id: `test-${Date.now()}`,
    instructions: {
      sv: `
        Testa e-postuppladdning:
        1. Skicka ett e-postmeddelande till: ${testParams.test_email}
        2. Använd ämnesrad: "Test av e-postuppladdning - ${testParams.test_scenario}"
        3. ${getScenarioInstructions(testParams.test_scenario)}
        4. Kontrollera resultatet i BRF Portalen under dokumenthantering
      `,
      en: `
        Test email upload:
        1. Send an email to: ${testParams.test_email}
        2. Use subject line: "Email upload test - ${testParams.test_scenario}"
        3. ${getScenarioInstructions(testParams.test_scenario, 'en')}
        4. Check the result in BRF Portal under document management
      `,
    },
    expected_results: getExpectedResults(testParams.test_scenario),
    monitoring: {
      check_logs: '/api/monitoring/dashboard',
      webhook_status: '/api/upload/email/webhook/status',
      batch_status: '/api/upload/batch',
    },
  };
}

/**
 * Get scenario-specific instructions
 */
function getScenarioInstructions(scenario: string, language: string = 'sv'): string {
  const instructions = {
    basic: {
      sv: 'Bifoga en enkel PDF-fil (max 5MB)',
      en: 'Attach a simple PDF file (max 5MB)',
    },
    with_attachments: {
      sv: 'Bifoga 2-3 filer med olika format (PDF, Word, Excel)',
      en: 'Attach 2-3 files with different formats (PDF, Word, Excel)',
    },
    large_files: {
      sv: 'Bifoga en stor fil (>10MB) för att testa storleksbegränsningar',
      en: 'Attach a large file (>10MB) to test size limits',
    },
    invalid_sender: {
      sv: 'Skicka från en e-postadress som inte är registrerad',
      en: 'Send from an email address that is not registered',
    },
  };

  return instructions[scenario as keyof typeof instructions]?.[language as keyof typeof instructions.basic] || instructions.basic[language as keyof typeof instructions.basic];
}

/**
 * Get expected results for test scenario
 */
function getExpectedResults(scenario: string): any {
  const results = {
    basic: {
      expected_status: 'success',
      expected_files: 1,
      expected_category: 'general',
    },
    with_attachments: {
      expected_status: 'success',
      expected_files: '2-3',
      expected_categories: ['general', 'document'],
    },
    large_files: {
      expected_status: 'failure',
      expected_error: 'File size limit exceeded',
      expected_files: 0,
    },
    invalid_sender: {
      expected_status: 'failure',
      expected_error: 'Sender not authorized',
      expected_files: 0,
    },
  };

  return results[scenario as keyof typeof results] || results.basic;
}