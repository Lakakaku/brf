# Email-to-Upload API Documentation

## Overview

The Email-to-Upload functionality allows BRF members and external parties to upload documents by sending emails with attachments. This system integrates with the existing bulk upload infrastructure and provides intelligent document categorization, security validation, and comprehensive audit trails.

## Architecture

### Components

1. **Email Webhook Handlers** - Process incoming emails from providers
2. **Email Processor** - Parse emails and extract attachments
3. **Document Classifier** - Categorize documents using BRF-specific rules
4. **Email Validator** - Authenticate senders and validate permissions
5. **Mock Service** - Development and testing support

### Supported Email Providers

- **SendGrid** - Full webhook support with signature verification
- **Mailgun** - Full webhook support with signature verification
- **Custom SMTP** - Basic webhook support without signature verification

## API Endpoints

### Webhook Endpoints

#### SendGrid Webhook
```
POST /api/upload/email/webhook/sendgrid
```

Processes incoming emails from SendGrid's Inbound Parse API.

**Headers:**
- `Content-Type: multipart/form-data`

**Form Data:**
- `to` - Recipient email address
- `from` - Sender email address
- `subject` - Email subject line
- `text` - Plain text email body
- `html` - HTML email body
- `attachmentN` - File attachments (N = 1, 2, 3...)

**Response:**
```json
{
  "success": true,
  "message": "E-post bearbetad och bifogade filer uppladdade framgångsrikt",
  "data": {
    "batch_id": "batch-uuid",
    "files_processed": 3,
    "files_rejected": 0,
    "cooperative": "BRF Example",
    "member_email": "member@example.com"
  }
}
```

#### Mailgun Webhook
```
POST /api/upload/email/webhook/mailgun
```

Processes incoming emails from Mailgun's Routes API.

**Headers:**
- `Content-Type: multipart/form-data`

**Form Data:**
- `To` - Recipient email address
- `From` - Sender email address  
- `Subject` - Email subject line
- `body-plain` - Plain text email body
- `body-html` - HTML email body
- `attachment-count` - Number of attachments
- `attachment-N` - File attachments (N = 1, 2, 3...)
- `timestamp` - Webhook timestamp
- `token` - Webhook token
- `signature` - HMAC signature for verification

### Configuration Endpoints

#### Get Email Configuration
```
GET /api/upload/email/config
```

Retrieves current email upload configuration for the authenticated user's cooperative.

**Authentication:** Required (canManageSettings permission)

**Response:**
```json
{
  "success": true,
  "data": {
    "cooperative_id": "coop-uuid",
    "cooperative_name": "BRF Example",
    "email_upload": {
      "enabled": true,
      "validation_level": "moderate",
      "email_patterns": ["upload@brf-example.se", "documents@*.brf-example.se"],
      "max_file_size_mb": 25,
      "allowed_file_types": ["application/pdf", "image/jpeg"],
      "rate_limits": {
        "emails_per_hour": 10,
        "emails_per_day": 50,
        "files_per_day": 100
      },
      "send_confirmations": true
    },
    "available_providers": [...],
    "suggested_upload_addresses": [...]
  }
}
```

#### Update Email Configuration
```
PUT /api/upload/email/config
```

Updates email upload configuration for the cooperative.

**Authentication:** Required (canManageSettings permission)

**Request Body:**
```json
{
  "enabled": true,
  "validation_level": "moderate",
  "email_patterns": ["upload@brf-example.se"],
  "max_file_size_mb": 25,
  "allowed_file_types": [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ],
  "rate_limits": {
    "emails_per_hour": 10,
    "emails_per_day": 50,
    "files_per_day": 100
  },
  "send_confirmations": true,
  "require_member_authentication": true
}
```

### Mock Service Endpoints

#### Send Mock Email
```
POST /api/upload/email/mock
```

Sends a mock email for testing purposes.

**Authentication:** Not required (development only)

**Request Body:**
```json
{
  "cooperative_id": "coop-uuid",
  "from": "test@example.com",
  "to": "upload@brf-example.se",
  "subject": "Test upload",
  "body_text": "Test message",
  "scenario": "invoice_from_contractor",
  "attachments": [
    {
      "filename": "test.pdf",
      "content_type": "application/pdf",
      "size": 256000,
      "content_base64": "JVBERi0xLjQ..."
    }
  ]
}
```

**Available Scenarios:**
- `invoice_from_contractor` - Simulates invoice from utility company
- `board_protocol` - Simulates board meeting protocol
- `annual_report` - Simulates annual report with multiple files
- `maintenance_request` - Simulates maintenance report with images
- `large_files` - Tests file size limits
- `invalid_files` - Tests file type restrictions
- `unauthorized_sender` - Tests sender validation

#### Get Mock Scenarios
```
GET /api/upload/email/mock
```

Returns available mock scenarios and usage instructions.

## Configuration Options

### Validation Levels

1. **Strict** - Only registered members can upload via email
2. **Moderate** - External senders allowed if email authentication passes
3. **Permissive** - External senders allowed from configured domains

### Email Patterns

Configure which email addresses accept uploads:

- `upload@brf-example.se` - Exact match
- `documents@*.brf-example.se` - Subdomain wildcard
- `files@brf-example.*` - TLD wildcard

### Rate Limiting

Prevent abuse with configurable rate limits:

- **emails_per_hour** - Maximum emails per hour per sender
- **emails_per_day** - Maximum emails per day per sender  
- **files_per_day** - Maximum files per day per sender

### File Restrictions

Control what files can be uploaded:

- **max_file_size_mb** - Maximum file size (1-100 MB)
- **allowed_file_types** - MIME types (array)

Common BRF file types:
```json
[
  "application/pdf",
  "image/jpeg", 
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]
```

## Document Classification

The system automatically categorizes documents based on:

1. **Filename patterns** - Keywords in filenames
2. **Sender patterns** - Known sender domains/addresses
3. **Subject analysis** - Keywords in email subject
4. **Content analysis** - Keywords in email body

### BRF Categories

- **invoice** - Bills and invoices (electricity, heating, maintenance)
- **protocol** - Board meeting protocols and decisions
- **contract** - Insurance, service contracts, agreements
- **report** - Annual reports, financial statements, audits
- **maintenance** - Repair requests, inspections, service reports
- **legal** - Legal documents, disputes, notices
- **member** - Member-related documents, applications
- **general** - Uncategorized documents

### Classification Rules

Each category has specific keywords and sender patterns:

#### Invoice Category
- **Keywords:** faktura, räkning, betalning, hyra, avgift
- **Senders:** vattenfall.se, eon.se, fortum.se
- **Confidence:** Based on keyword matches and sender reputation

#### Protocol Category  
- **Keywords:** protokoll, styrelseprotokoll, årsmöte, beslut
- **Senders:** Internal board member addresses
- **Confidence:** High for internal senders, moderate for external

## Security Features

### Email Authentication

1. **SPF Verification** - Sender Policy Framework validation
2. **DKIM Verification** - Domain Keys Identified Mail validation
3. **Signature Verification** - Webhook signature validation (provider-specific)

### Sender Validation

1. **Member Check** - Verify sender is registered cooperative member
2. **Domain Validation** - Check sender domain against allowed list
3. **Rate Limiting** - Prevent spam and abuse
4. **Blacklist Check** - Block known malicious senders

### File Security

1. **MIME Type Validation** - Verify file types match content
2. **File Signature Check** - Validate file headers
3. **Size Limits** - Prevent oversized uploads
4. **Virus Scanning** - Scan for malware (planned)

## Error Handling

### Common Error Responses

#### Authentication Failed
```json
{
  "success": false,
  "message": "E-postautentisering misslyckades",
  "code": "EMAIL_VALIDATION_FAILED"
}
```

#### File Too Large
```json
{
  "success": false,
  "message": "Filen är för stor: 30MB (max 25MB)",
  "code": "FILE_SIZE_EXCEEDED"
}
```

#### Rate Limit Exceeded
```json
{
  "success": false,
  "message": "För många e-postmeddelanden per timme (max 10)",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

#### Invalid File Type
```json
{
  "success": false,
  "message": "Filtyp inte tillåten: application/x-executable",
  "code": "FILE_TYPE_NOT_ALLOWED"
}
```

## Logging and Monitoring

### Event Types

- `email_processed` - Successfully processed email
- `email_upload_rejected` - Email rejected due to validation failure
- `email_upload_success` - Files uploaded successfully
- `email_upload_processing_failed` - Processing error
- `email_config_updated` - Configuration changed
- `mock_email_sent` - Mock email processed (development)

### Event Data Structure

```json
{
  "cooperative_id": "coop-uuid",
  "event_type": "email_processed",
  "event_level": "info",
  "event_source": "email_upload_processor",
  "event_message": "Email processed for upload",
  "user_id": "user-uuid",
  "event_data": {
    "provider": "sendgrid",
    "from": "sender@example.com",
    "subject": "Document upload",
    "attachments_count": 3,
    "batch_id": "batch-uuid",
    "processing_time_ms": 1500
  },
  "created_at": "2024-12-15T10:30:00Z"
}
```

## Testing

### Development Setup

1. **Configure Mock Service** - Use `/api/upload/email/mock` endpoint
2. **Test Scenarios** - Use predefined test scenarios
3. **Webhook Testing** - Use ngrok or similar for webhook testing
4. **Provider Testing** - Use provider test endpoints

### Test Scenarios

#### Basic Upload Test
```bash
curl -X POST http://localhost:3000/api/upload/email/mock \
  -H "Content-Type: application/json" \
  -d '{
    "cooperative_id": "test-coop-uuid",
    "from": "member@example.com",
    "to": "upload@brf-test.se",
    "subject": "Test Document Upload",
    "scenario": "mixed_documents"
  }'
```

#### Invalid File Test
```bash
curl -X POST http://localhost:3000/api/upload/email/mock \
  -H "Content-Type: application/json" \
  -d '{
    "cooperative_id": "test-coop-uuid", 
    "from": "member@example.com",
    "to": "upload@brf-test.se",
    "subject": "Invalid File Test",
    "scenario": "invalid_files"
  }'
```

### Production Testing

1. **SendGrid Setup** - Configure inbound parse webhook
2. **Mailgun Setup** - Configure routes with webhook URL
3. **DNS Configuration** - Set up MX records for email domains
4. **SSL Certificates** - Ensure webhook endpoints use HTTPS

## Deployment

### Environment Variables

```bash
# Email provider settings
SENDGRID_WEBHOOK_SECRET=your-sendgrid-secret
MAILGUN_SIGNING_KEY=your-mailgun-key

# Email storage
EMAIL_TEMP_STORAGE_PATH=/tmp/email-uploads
EMAIL_MAX_STORAGE_DAYS=7

# Feature flags
EMAIL_UPLOAD_ENABLED=true
EMAIL_MOCK_SERVICE_ENABLED=false
```

### Webhook URLs

Configure these URLs in your email provider settings:

- **SendGrid:** `https://yourdomain.com/api/upload/email/webhook/sendgrid`
- **Mailgun:** `https://yourdomain.com/api/upload/email/webhook/mailgun`

### Database Requirements

The email-to-upload system uses existing database tables:

- `cooperatives` - Stores email configuration in settings JSON
- `bulk_upload_batches` - Tracks email upload batches
- `bulk_upload_files` - Tracks individual file uploads
- `bulk_upload_events` - Logs all email processing events
- `members` - Used for sender validation

## Best Practices

### Security

1. **Always validate webhook signatures** when available
2. **Use HTTPS for all webhook endpoints**
3. **Implement rate limiting** to prevent abuse
4. **Validate file types and sizes** before processing
5. **Log all email processing events** for audit trails

### Performance

1. **Process attachments asynchronously** for large files
2. **Use temporary storage** for file processing
3. **Clean up temporary files** after processing
4. **Implement queue system** for high-volume processing

### User Experience

1. **Send confirmation emails** for successful uploads
2. **Provide clear error messages** in Swedish
3. **Support common BRF document types**
4. **Allow flexible email address patterns**

## Troubleshooting

### Common Issues

1. **Webhook not receiving emails**
   - Check DNS MX records
   - Verify webhook URL configuration
   - Check firewall settings

2. **Files not processing**
   - Check file size limits
   - Verify file type restrictions
   - Check temporary storage permissions

3. **Authentication failures**
   - Verify cooperative email patterns
   - Check member email addresses
   - Review validation level settings

4. **Rate limiting issues**
   - Review rate limit configuration
   - Check sender patterns
   - Verify time window calculations

### Debug Information

Enable debug logging by checking the `bulk_upload_events` table for detailed processing information.

```sql
SELECT * FROM bulk_upload_events 
WHERE event_source LIKE 'email%' 
ORDER BY created_at DESC 
LIMIT 50;
```