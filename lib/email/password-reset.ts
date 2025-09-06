/**
 * Password Reset Email Service for BRF Portal
 * Handles sending password reset emails with Swedish localization
 * Includes mock email service for development and comprehensive logging
 */

import { logSecurityEvent } from '@/lib/audit/security-logger';

/**
 * Email service configuration
 */
interface EmailConfig {
  fromAddress: string;
  fromName: string;
  supportEmail: string;
  baseUrl: string;
  brfName?: string;
}

/**
 * Get email configuration from environment
 */
function getEmailConfig(): EmailConfig {
  return {
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@brfportal.se',
    fromName: process.env.EMAIL_FROM_NAME || 'BRF Portal',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@brfportal.se',
    baseUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    brfName: process.env.BRF_NAME || 'Din BRF'
  };
}

/**
 * Email template data for password reset
 */
interface PasswordResetEmailData {
  email: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  brfName?: string;
}

/**
 * Email template data for password reset confirmation
 */
interface PasswordResetConfirmationData {
  email: string;
  firstName: string;
  ipAddress?: string;
  userAgent?: string;
  brfName?: string;
}

/**
 * Generate Swedish password reset email HTML template
 */
function generatePasswordResetEmailHTML(data: PasswordResetEmailData, config: EmailConfig): string {
  const resetUrl = `${config.baseUrl}/reset-password/${data.token}`;
  const expiryTime = data.expiresAt.toLocaleTimeString('sv-SE', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const expiryDate = data.expiresAt.toLocaleDateString('sv-SE');

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Återställ ditt lösenord - ${data.brfName || config.brfName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 0;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 30px;
        }
        .alert {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        .alert-icon {
            color: #f59e0b;
            font-size: 18px;
            margin-right: 8px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            text-align: center;
        }
        .button:hover {
            background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
        }
        .security-info {
            background-color: #f3f4f6;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
            font-size: 14px;
            color: #6b7280;
        }
        .footer {
            background-color: #f9fafb;
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            border-radius: 0 0 8px 8px;
            font-size: 12px;
            color: #6b7280;
        }
        .link {
            color: #3b82f6;
            text-decoration: none;
        }
        .link:hover {
            text-decoration: underline;
        }
        @media only screen and (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            .header, .content, .footer {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏠 ${data.brfName || config.brfName}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">BRF Portal - Återställ lösenord</p>
        </div>
        
        <div class="content">
            <h2>Återställ ditt lösenord</h2>
            
            <p>Hej!</p>
            
            <p>Vi har mottagit en begäran om att återställa lösenordet för ditt konto i BRF Portalen. Om du inte har gjort denna begäran kan du bortse från detta meddelande.</p>
            
            <div class="alert">
                <span class="alert-icon">⚠️</span>
                <strong>Viktigt:</strong> Denna länk är giltig till <strong>${expiryDate} kl. ${expiryTime}</strong> och kan endast användas en gång.
            </div>
            
            <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Återställ lösenord</a>
            </div>
            
            <p>Alternativt kan du kopiera och klistra in följande länk i din webbläsare:</p>
            <p style="word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">
                ${resetUrl}
            </p>
            
            <div class="security-info">
                <h3 style="margin-top: 0; color: #374151;">🔒 Säkerhetsinformation</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Av säkerhetsskäl kommer alla dina aktiva sessioner att avslutas efter lösenordsbytet</li>
                    <li>Använd ett starkt lösenord med minst 8 tecken, både bokstäver och siffror</li>
                    <li>Dela aldrig ditt lösenord med någon annan</li>
                    <li>Om du inte begärde denna återställning, kontakta oss omedelbart</li>
                </ul>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p><strong>Behöver du hjälp?</strong></p>
            <p>Kontakta BRF-styrelsen eller vår support:</p>
            <ul>
                <li>E-post: <a href="mailto:${config.supportEmail}" class="link">${config.supportEmail}</a></li>
                <li>För akuta ärenden, kontakta styrelsen direkt</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Detta meddelande skickades från ${config.fromName} till <strong>${data.email}</strong></p>
            ${data.ipAddress ? `<p>Begäran gjordes från IP-adress: ${data.ipAddress}</p>` : ''}
            <p style="margin-top: 15px;">
                © ${new Date().getFullYear()} ${data.brfName || config.brfName} - BRF Portal<br>
                Detta är ett automatiskt meddelande, svara inte på detta e-postmeddelande.
            </p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate Swedish password reset email text template (fallback)
 */
function generatePasswordResetEmailText(data: PasswordResetEmailData, config: EmailConfig): string {
  const resetUrl = `${config.baseUrl}/reset-password/${data.token}`;
  const expiryTime = data.expiresAt.toLocaleString('sv-SE');

  return `
Återställ ditt lösenord - ${data.brfName || config.brfName}

Hej!

Vi har mottagit en begäran om att återställa lösenordet för ditt konto i BRF Portalen.

Klicka på följande länk för att återställa ditt lösenord:
${resetUrl}

VIKTIGT: Denna länk är giltig till ${expiryTime} och kan endast användas en gång.

Säkerhetsinformation:
- Av säkerhetsskäl kommer alla dina aktiva sessioner att avslutas efter lösenordsbytet
- Använd ett starkt lösenord med minst 8 tecken, både bokstäver och siffror  
- Dela aldrig ditt lösenord med någon annan
- Om du inte begärde denna återställning, kontakta oss omedelbart

Behöver du hjälp?
Kontakta BRF-styrelsen eller vår support: ${config.supportEmail}

${data.ipAddress ? `Begäran gjordes från IP-adress: ${data.ipAddress}` : ''}

---
Detta meddelande skickades från ${config.fromName} till ${data.email}
© ${new Date().getFullYear()} ${data.brfName || config.brfName} - BRF Portal
Detta är ett automatiskt meddelande, svara inte på detta e-postmeddelande.
`;
}

/**
 * Generate password reset confirmation email HTML template
 */
function generatePasswordResetConfirmationHTML(data: PasswordResetConfirmationData, config: EmailConfig): string {
  const now = new Date();
  const timestamp = now.toLocaleString('sv-SE');

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lösenord återställt - ${data.brfName || config.brfName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 0;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .success-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
        .content {
            padding: 30px;
        }
        .success-box {
            background-color: #d1fae5;
            border: 1px solid #10b981;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
        .security-info {
            background-color: #f3f4f6;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
            font-size: 14px;
            color: #6b7280;
        }
        .footer {
            background-color: #f9fafb;
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            border-radius: 0 0 8px 8px;
            font-size: 12px;
            color: #6b7280;
        }
        .link {
            color: #3b82f6;
            text-decoration: none;
        }
        .link:hover {
            text-decoration: underline;
        }
        @media only screen and (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            .header, .content, .footer {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">✅</div>
            <h1>🏠 ${data.brfName || config.brfName}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">BRF Portal - Lösenord återställt</p>
        </div>
        
        <div class="content">
            <h2>Ditt lösenord har återställts</h2>
            
            <p>Hej ${data.firstName}!</p>
            
            <div class="success-box">
                <h3 style="margin-top: 0; color: #065f46;">🎉 Klart!</h3>
                <p style="margin-bottom: 0;">Ditt lösenord för BRF Portalen har återställts framgångsrikt.</p>
            </div>
            
            <p>Du kan nu logga in med ditt nya lösenord på:</p>
            <p><a href="${config.baseUrl}/login" class="link">${config.baseUrl}/login</a></p>
            
            <div class="security-info">
                <h3 style="margin-top: 0; color: #374151;">🔒 Säkerhetsåtgärder som vidtagits</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Alla dina tidigare aktiva sessioner har avslutats</li>
                    <li>Lösenordsåterställningen loggades säkert</li>
                    <li>Endast du kan nu logga in med det nya lösenordet</li>
                </ul>
                
                <p style="margin-top: 15px;"><strong>Tidpunkt för återställning:</strong> ${timestamp}</p>
                ${data.ipAddress ? `<p><strong>IP-adress:</strong> ${data.ipAddress}</p>` : ''}
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p><strong>Var det inte du?</strong></p>
            <p>Om du inte genomförde denna lösenordsåterställning, kontakta oss omedelbart. Detta kan indikera att någon annan har tillgång till din e-post.</p>
            
            <p><strong>Kontakt:</strong></p>
            <ul>
                <li>Support: <a href="mailto:${config.supportEmail}" class="link">${config.supportEmail}</a></li>
                <li>För akuta säkerhetsärenden, kontakta styrelsen direkt</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Detta meddelande skickades från ${config.fromName} till <strong>${data.email}</strong></p>
            <p style="margin-top: 15px;">
                © ${new Date().getFullYear()} ${data.brfName || config.brfName} - BRF Portal<br>
                Detta är ett automatiskt meddelande, svara inte på detta e-postmeddelande.
            </p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Mock email service for development
 * In production, replace with actual email service (SendGrid, Mailgun, AWS SES, etc.)
 */
class MockEmailService {
  private static sentEmails: Array<{
    to: string;
    subject: string;
    html: string;
    text: string;
    timestamp: Date;
  }> = [];

  static async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

      // Store email for development debugging
      this.sentEmails.push({
        to,
        subject,
        html,
        text,
        timestamp: new Date()
      });

      // Log email in development
      if (process.env.NODE_ENV === 'development') {
        console.log('\n📧 MOCK EMAIL SENT:');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('HTML Length:', html.length);
        console.log('Text Length:', text.length);
        console.log('---');
      }

      // Simulate occasional failures (1% chance)
      if (Math.random() < 0.01) {
        throw new Error('Mock email service failure');
      }

      return {
        success: true,
        messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static getSentEmails() {
    return this.sentEmails;
  }

  static clearSentEmails() {
    this.sentEmails = [];
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
  const config = getEmailConfig();

  const htmlContent = generatePasswordResetEmailHTML(data, config);
  const textContent = generatePasswordResetEmailText(data, config);

  const subject = `Återställ ditt lösenord - ${data.brfName || config.brfName}`;

  try {
    // In development, use mock email service
    // In production, replace with actual email service
    const result = await MockEmailService.sendEmail(
      data.email,
      subject,
      htmlContent,
      textContent
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    // Log successful email sending
    await logSecurityEvent({
      event: 'password_reset_email_sent',
      severity: 'info',
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      details: {
        email: data.email,
        expiresAt: data.expiresAt.toISOString(),
        messageId: result.messageId
      }
    });

  } catch (error) {
    // Log email sending failure
    await logSecurityEvent({
      event: 'password_reset_email_failed',
      severity: 'high',
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      details: {
        email: data.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    throw error;
  }
}

/**
 * Send password reset confirmation email
 */
export async function sendPasswordResetConfirmationEmail(data: PasswordResetConfirmationData): Promise<void> {
  const config = getEmailConfig();

  const htmlContent = generatePasswordResetConfirmationHTML(data, config);
  const textContent = `Ditt lösenord har återställts - ${data.brfName || config.brfName}\n\nHej ${data.firstName}!\n\nDitt lösenord för BRF Portalen har återställts framgångsrikt.\n\nDu kan nu logga in med ditt nya lösenord på: ${config.baseUrl}/login\n\n${data.ipAddress ? `IP-adress: ${data.ipAddress}` : ''}\n\nOm du inte genomförde denna lösenordsåterställning, kontakta oss omedelbart.\n\nSupport: ${config.supportEmail}`;

  const subject = `Lösenord återställt - ${data.brfName || config.brfName}`;

  try {
    const result = await MockEmailService.sendEmail(
      data.email,
      subject,
      htmlContent,
      textContent
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to send confirmation email');
    }

    // Log successful confirmation email sending
    await logSecurityEvent({
      event: 'password_reset_confirmation_email_sent',
      severity: 'info',
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      details: {
        email: data.email,
        firstName: data.firstName,
        messageId: result.messageId
      }
    });

  } catch (error) {
    // Log confirmation email failure
    await logSecurityEvent({
      event: 'password_reset_confirmation_email_failed',
      severity: 'medium',
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      details: {
        email: data.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    throw error;
  }
}

/**
 * Get mock email service for testing (development only)
 */
export function getMockEmailService() {
  if (process.env.NODE_ENV === 'development') {
    return MockEmailService;
  }
  return null;
}