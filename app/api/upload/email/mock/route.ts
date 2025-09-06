/**
 * Mock Email Service for Development and Testing
 * Simulates incoming emails for testing the email-to-upload functionality
 * Part of the BRF Portal email-to-upload system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { EmailUploadProcessor } from '@/lib/email/processor';
import { logEvent } from '@/lib/monitoring/events';
import { SwedishMessages } from '@/lib/upload/messages';
import { z } from 'zod';

// Mock email data schema
const MockEmailSchema = z.object({
  cooperative_id: z.string().uuid(),
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body_text: z.string().optional(),
  body_html: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content_type: z.string(),
    size: z.number().positive(),
    content_base64: z.string(), // Base64 encoded file content
  })).optional().default([]),
  scenario: z.enum([
    'invoice_from_contractor',
    'board_protocol',
    'annual_report', 
    'maintenance_request',
    'insurance_document',
    'mixed_documents',
    'large_files',
    'invalid_files',
    'unauthorized_sender',
  ]).optional().default('mixed_documents'),
});

// Initialize email processor
let emailProcessor: EmailUploadProcessor;

function getEmailProcessor() {
  if (!emailProcessor) {
    const db = getDatabase();
    emailProcessor = new EmailUploadProcessor({ database: db });
  }
  return emailProcessor;
}

/**
 * POST /api/upload/email/mock - Send mock email for testing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = MockEmailSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        { 
          error: 'Invalid mock email data',
          details: errors,
          code: 'VALIDATION_FAILED' 
        },
        { status: 400 }
      );
    }

    const mockEmail = validationResult.data;

    // Apply scenario-specific modifications
    const processedEmail = applyEmailScenario(mockEmail);

    // Convert base64 attachments to ArrayBuffer format
    const attachments = processedEmail.attachments.map(attachment => ({
      filename: attachment.filename,
      contentType: attachment.content_type,
      size: attachment.size,
      content: Buffer.from(attachment.content_base64, 'base64').buffer,
    }));

    // Process the mock email
    const processor = getEmailProcessor();
    const result = await processor.processIncomingEmail({
      cooperative_id: processedEmail.cooperative_id,
      member_id: undefined, // Will be determined by validation
      email_data: {
        from: processedEmail.from,
        to: processedEmail.to,
        subject: processedEmail.subject,
        text: processedEmail.body_text,
        html: processedEmail.body_html,
        headers: JSON.stringify({
          'Message-ID': `<mock-${Date.now()}@brf-portal.test>`,
          'Date': new Date().toUTCString(),
          'X-Mock-Scenario': processedEmail.scenario,
        }),
      },
      attachments,
      provider: 'mock',
      webhook_headers: { 'x-mock-test': 'true' },
    });

    // Log mock email processing
    await logEvent({
      cooperative_id: processedEmail.cooperative_id,
      event_type: 'mock_email_sent',
      event_level: 'info',
      event_source: 'email_mock_service',
      event_message: 'Mock email processed for testing',
      event_data: {
        scenario: processedEmail.scenario,
        from: processedEmail.from,
        subject: processedEmail.subject,
        attachments_count: attachments.length,
        processing_success: result.success,
        endpoint: '/api/upload/email/mock',
      },
    });

    return NextResponse.json({
      success: true,
      message: SwedishMessages.success.EMAIL_PROCESSED,
      data: {
        scenario: processedEmail.scenario,
        mock_email_id: `mock-${Date.now()}`,
        processing_result: result,
        cooperative_id: processedEmail.cooperative_id,
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Mock email service error:', error);

    await logEvent({
      cooperative_id: 'unknown',
      event_type: 'mock_email_error',
      event_level: 'error',
      event_source: 'email_mock_service',
      event_message: 'Mock email processing failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      event_data: {
        endpoint: '/api/upload/email/mock',
        error: error instanceof Error ? error.stack : error,
      },
    });

    return NextResponse.json({
      success: false,
      message: SwedishMessages.errors.SYSTEM_ERROR,
      code: 'MOCK_EMAIL_ERROR'
    }, { status: 500 });
  }
}

/**
 * GET /api/upload/email/mock - Get available mock scenarios
 */
export async function GET(request: NextRequest) {
  const scenarios = {
    invoice_from_contractor: {
      name: 'Faktura från entreprenör',
      description: 'Simulerar en elräkning från Vattenfall med PDF-bifogning',
      example_attachments: ['vattenfall_faktura_2024-12.pdf'],
      expected_category: 'invoice',
    },
    board_protocol: {
      name: 'Styrelseprotokoll',
      description: 'Simulerar styrelseprotokoll med Word-dokument',
      example_attachments: ['protokoll_2024-12-15.docx'],
      expected_category: 'protocol',
    },
    annual_report: {
      name: 'Årsredovisning',
      description: 'Simulerar årsredovisning med PDF och Excel-bilagor',
      example_attachments: ['arsredovisning_2023.pdf', 'budget_2024.xlsx'],
      expected_category: 'report',
    },
    maintenance_request: {
      name: 'Underhållsärende',
      description: 'Simulerar underhållsrapport med bilder',
      example_attachments: ['skada_tak.jpg', 'reparation_kostnader.pdf'],
      expected_category: 'maintenance',
    },
    insurance_document: {
      name: 'Försäkringsdokument',
      description: 'Simulerar försäkringshandlingar från Folksam',
      example_attachments: ['forsakring_2024.pdf'],
      expected_category: 'contract',
    },
    mixed_documents: {
      name: 'Blandade dokument',
      description: 'Simulerar e-post med olika typer av dokument',
      example_attachments: ['faktura.pdf', 'protokoll.docx', 'bild.jpg'],
      expected_category: 'general',
    },
    large_files: {
      name: 'Stora filer',
      description: 'Simulerar e-post med stora filer för att testa begränsningar',
      example_attachments: ['stor_ritning.pdf', 'video_besiktning.mp4'],
      expected_category: 'general',
      note: 'Kan generera valideringsfel beroende på storleksbegränsningar',
    },
    invalid_files: {
      name: 'Ogiltiga filer',
      description: 'Simulerar e-post med otillåtna filtyper',
      example_attachments: ['virus.exe', 'script.js'],
      expected_category: 'general',
      note: 'Förväntas generera valideringsfel',
    },
    unauthorized_sender: {
      name: 'Obehörig avsändare',
      description: 'Simulerar e-post från obehörig avsändare',
      example_attachments: ['dokument.pdf'],
      note: 'Förväntas avvisas av valideringssystemet',
    },
  };

  return NextResponse.json({
    success: true,
    data: {
      scenarios,
      usage: {
        endpoint: '/api/upload/email/mock',
        method: 'POST',
        required_fields: ['cooperative_id', 'from', 'to', 'subject'],
        optional_fields: ['body_text', 'body_html', 'attachments', 'scenario'],
      },
      examples: {
        simple_test: {
          cooperative_id: 'uuid-of-cooperative',
          from: 'medlem@example.com',
          to: 'upload@brf-example.se',
          subject: 'Test av e-postuppladdning',
          body_text: 'Detta är ett testmeddelande',
          scenario: 'mixed_documents',
        },
      },
    }
  });
}

/**
 * Apply scenario-specific modifications to mock email
 */
function applyEmailScenario(mockEmail: z.infer<typeof MockEmailSchema>) {
  const modifiedEmail = { ...mockEmail };

  switch (mockEmail.scenario) {
    case 'invoice_from_contractor':
      modifiedEmail.from = 'faktura@vattenfall.se';
      modifiedEmail.subject = 'Elräkning december 2024 - BRF ' + mockEmail.cooperative_id.slice(0, 8);
      modifiedEmail.body_text = 'Bifogat finner ni elräkningen för december 2024.';
      if (modifiedEmail.attachments.length === 0) {
        modifiedEmail.attachments.push({
          filename: 'vattenfall_faktura_2024-12.pdf',
          content_type: 'application/pdf',
          size: 256000,
          content_base64: generateMockFileContent('pdf'),
        });
      }
      break;

    case 'board_protocol':
      modifiedEmail.from = 'ordf@brf-example.se';
      modifiedEmail.subject = 'Styrelseprotokoll 2024-12-15';
      modifiedEmail.body_text = 'Bifogat finner ni protokollet från senaste styrelsemötet.';
      if (modifiedEmail.attachments.length === 0) {
        modifiedEmail.attachments.push({
          filename: 'protokoll_2024-12-15.docx',
          content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 512000,
          content_base64: generateMockFileContent('docx'),
        });
      }
      break;

    case 'annual_report':
      modifiedEmail.from = 'revisor@redovisning.se';
      modifiedEmail.subject = 'Årsredovisning 2023 och budget 2024';
      modifiedEmail.body_text = 'Årsredovisning och budget bifogade.';
      if (modifiedEmail.attachments.length === 0) {
        modifiedEmail.attachments.push(
          {
            filename: 'arsredovisning_2023.pdf',
            content_type: 'application/pdf',
            size: 1024000,
            content_base64: generateMockFileContent('pdf'),
          },
          {
            filename: 'budget_2024.xlsx',
            content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 128000,
            content_base64: generateMockFileContent('xlsx'),
          }
        );
      }
      break;

    case 'large_files':
      modifiedEmail.attachments = modifiedEmail.attachments.map(attachment => ({
        ...attachment,
        size: 50 * 1024 * 1024, // 50MB - exceeds typical limits
      }));
      break;

    case 'invalid_files':
      modifiedEmail.attachments = [
        {
          filename: 'virus.exe',
          content_type: 'application/x-executable',
          size: 1024,
          content_base64: generateMockFileContent('exe'),
        },
        {
          filename: 'script.js',
          content_type: 'text/javascript',
          size: 512,
          content_base64: generateMockFileContent('js'),
        },
      ];
      break;

    case 'unauthorized_sender':
      modifiedEmail.from = 'hacker@suspicious.com';
      modifiedEmail.subject = 'Confidential Documents';
      break;
  }

  return modifiedEmail;
}

/**
 * Generate mock file content for testing
 */
function generateMockFileContent(fileType: string): string {
  const mockContent = {
    pdf: 'JVBERi0xLjQKJcOkw7zDtsOgCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQ==', // Mock PDF header
    docx: 'UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAAAWAAAAd29yZC9kb2N1bWVudC54bWw=', // Mock DOCX structure
    xlsx: 'UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAAATAAAAeGwvc2hhcmVkU3RyaW5ncy54bWw=', // Mock XLSX structure
    jpg: '/9j/4AAQSkZJRgABAQEAAAABAAEAAP/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=', // Minimal JPEG
    exe: 'TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAA4fug4AtAnNIbgBTM0hVGhpcyBwcm9ncmFtIGNhbm5vdCBiZSBydW4gaW4gRE9TIG1vZGUuDQ0KJAAAAAAAAABQRQAATAEDABwrGnUAAAAAAAAAAOAAIiALATAAAOAAAAYAAAAKAAA', // Mock EXE header
    js: 'Ly8gVGhpcyBpcyBhIG1vY2sgSmF2YVNjcmlwdCBmaWxlCmNvbnNvbGUubG9nKCJNb2NrIGZpbGUgY29udGVudCIpOw==', // Base64 encoded JS comment
  };

  return mockContent[fileType as keyof typeof mockContent] || mockContent.pdf;
}

/**
 * DELETE /api/upload/email/mock - Clear mock email logs (development only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const db = getDatabase();
    
    // Clear mock email events
    const result = db.prepare(`
      DELETE FROM bulk_upload_events 
      WHERE event_source = 'email_mock_service' 
        AND created_at >= date('now', '-1 day')
    `).run();

    return NextResponse.json({
      success: true,
      message: 'Mock email logs cleared',
      data: {
        deleted_events: result.changes,
      }
    });

  } catch (error) {
    console.error('Failed to clear mock email logs:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to clear mock email logs',
      code: 'CLEAR_LOGS_FAILED'
    }, { status: 500 });
  }
}