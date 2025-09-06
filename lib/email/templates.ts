/**
 * Swedish Email Templates for BRF Portal
 * Provides localized email templates for upload confirmations, notifications, and errors
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface UploadConfirmationData {
  cooperative_name: string;
  batch_id: string;
  files_uploaded: number;
  original_subject: string;
  upload_date: string;
}

export interface UploadErrorData {
  cooperative_name: string;
  error_message: string;
  files_attempted: number;
  original_subject: string;
  support_contact?: string;
}

export class EmailTemplates {
  /**
   * Generate upload confirmation email
   */
  generateUploadConfirmation(data: UploadConfirmationData): EmailTemplate {
    const uploadDate = new Date(data.upload_date).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = `Uppladdning bekräftad - ${data.cooperative_name}`;

    const html = `
      <!DOCTYPE html>
      <html lang="sv">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: #2563eb;
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .content {
            background: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
          }
          .footer {
            background: #374151;
            color: white;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            text-align: center;
            font-size: 14px;
          }
          .success-icon {
            font-size: 48px;
            color: #10b981;
            text-align: center;
            margin-bottom: 20px;
          }
          .details-box {
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #374151;
          }
          .detail-value {
            color: #6b7280;
          }
          .batch-id {
            font-family: monospace;
            background: #f3f4f6;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
          }
          .warning {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
          }
          .warning-title {
            font-weight: 600;
            color: #92400e;
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BRF Portal</h1>
          <h2>Uppladdning Bekräftad</h2>
        </div>
        
        <div class="content">
          <div class="success-icon">✅</div>
          
          <h3>Hej!</h3>
          
          <p>Dina dokument har framgångsrikt laddats upp till <strong>${data.cooperative_name}</strong> via e-post.</p>
          
          <div class="details-box">
            <div class="detail-row">
              <span class="detail-label">Antal filer:</span>
              <span class="detail-value">${data.files_uploaded} st</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Ursprungligt ämne:</span>
              <span class="detail-value">${data.original_subject}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Uppladdningsdatum:</span>
              <span class="detail-value">${uploadDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Batch-ID:</span>
              <span class="detail-value">
                <span class="batch-id">${data.batch_id}</span>
              </span>
            </div>
          </div>
          
          <div class="warning">
            <div class="warning-title">Nästa steg</div>
            <p>Dina filer kommer nu att behandlas automatiskt. Du kan följa processen i BRF Portalen genom att logga in och navigera till dokumenthantering.</p>
          </div>
          
          <p>Om du har frågor eller behöver hjälp, kontakta din bostadsrättsförenings administration.</p>
        </div>
        
        <div class="footer">
          <p>Detta meddelande skickades automatiskt från BRF Portal<br>
          Svara inte på detta e-postmeddelande</p>
        </div>
      </body>
      </html>
    `;

    const text = `
BRF Portal - Uppladdning Bekräftad

Hej!

Dina dokument har framgångsrikt laddats upp till ${data.cooperative_name} via e-post.

Detaljer:
- Antal filer: ${data.files_uploaded} st
- Ursprungligt ämne: ${data.original_subject}
- Uppladdningsdatum: ${uploadDate}
- Batch-ID: ${data.batch_id}

Nästa steg:
Dina filer kommer nu att behandlas automatiskt. Du kan följa processen i BRF Portalen genom att logga in och navigera till dokumenthantering.

Om du har frågor eller behöver hjälp, kontakta din bostadsrättsförenings administration.

---
Detta meddelande skickades automatiskt från BRF Portal
Svara inte på detta e-postmeddelande
    `;

    return { subject, html, text };
  }

  /**
   * Generate upload error notification email
   */
  generateUploadError(data: UploadErrorData): EmailTemplate {
    const subject = `Problem med uppladdning - ${data.cooperative_name}`;

    const html = `
      <!DOCTYPE html>
      <html lang="sv">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: #dc2626;
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .content {
            background: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
          }
          .footer {
            background: #374151;
            color: white;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            text-align: center;
            font-size: 14px;
          }
          .error-icon {
            font-size: 48px;
            color: #dc2626;
            text-align: center;
            margin-bottom: 20px;
          }
          .error-box {
            background: #fef2f2;
            border: 1px solid #fca5a5;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
          }
          .error-title {
            font-weight: 600;
            color: #991b1b;
            margin-bottom: 10px;
          }
          .error-message {
            color: #7f1d1d;
            font-family: monospace;
            background: white;
            padding: 10px;
            border-radius: 4px;
          }
          .help-section {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
          }
          .help-title {
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 10px;
          }
          ul {
            margin: 0;
            padding-left: 20px;
          }
          li {
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BRF Portal</h1>
          <h2>Problem med Uppladdning</h2>
        </div>
        
        <div class="content">
          <div class="error-icon">❌</div>
          
          <h3>Hej!</h3>
          
          <p>Tyvärr uppstod ett problem när dina dokument skulle laddas upp till <strong>${data.cooperative_name}</strong>.</p>
          
          <div class="error-box">
            <div class="error-title">Felmeddelande:</div>
            <div class="error-message">${data.error_message}</div>
          </div>
          
          <p><strong>Antal filer som försökte laddas upp:</strong> ${data.files_attempted} st</p>
          <p><strong>Ursprungligt ämne:</strong> ${data.original_subject}</p>
          
          <div class="help-section">
            <div class="help-title">Möjliga lösningar:</div>
            <ul>
              <li>Kontrollera att filerna inte är för stora (vanligtvis max 25MB per fil)</li>
              <li>Säkerställ att filformaten är tillåtna (PDF, Word, Excel, bilder)</li>
              <li>Kontrollera att du skickar från en registrerad e-postadress</li>
              <li>Försök skicka färre filer åt gången</li>
              <li>Vänta några minuter och försök igen</li>
            </ul>
          </div>
          
          ${data.support_contact ? `
          <p>Om problemet kvarstår, kontakta support på: <strong>${data.support_contact}</strong></p>
          ` : `
          <p>Om problemet kvarstår, kontakta din bostadsrättsförenings administration för hjälp.</p>
          `}
        </div>
        
        <div class="footer">
          <p>Detta meddelande skickades automatiskt från BRF Portal<br>
          Svara inte på detta e-postmeddelande</p>
        </div>
      </body>
      </html>
    `;

    const text = `
BRF Portal - Problem med Uppladdning

Hej!

Tyvärr uppstod ett problem när dina dokument skulle laddas upp till ${data.cooperative_name}.

Felmeddelande: ${data.error_message}

Antal filer som försökte laddas upp: ${data.files_attempted} st
Ursprungligt ämne: ${data.original_subject}

Möjliga lösningar:
- Kontrollera att filerna inte är för stora (vanligtvis max 25MB per fil)
- Säkerställ att filformaten är tillåtna (PDF, Word, Excel, bilder)
- Kontrollera att du skickar från en registrerad e-postadress
- Försök skicka färre filer åt gången
- Vänta några minuter och försök igen

${data.support_contact ? 
  `Om problemet kvarstår, kontakta support på: ${data.support_contact}` :
  `Om problemet kvarstår, kontakta din bostadsrättsförenings administration för hjälp.`}

---
Detta meddelande skickades automatiskt från BRF Portal
Svara inte på detta e-postmeddelande
    `;

    return { subject, html, text };
  }
}