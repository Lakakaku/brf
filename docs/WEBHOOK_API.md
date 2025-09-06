# Webhook Testing API Documentation

## Overview

The BRF Portal Webhook Testing API provides comprehensive functionality for testing, monitoring, and managing webhook integrations specifically designed for Swedish housing cooperatives (BRF). The system includes mock integrations for BankID, Fortnox, and Kivra services commonly used in Swedish BRF management.

## Table of Contents

1. [Authentication](#authentication)
2. [Webhook Endpoints Management](#webhook-endpoints-management)
3. [Webhook Events](#webhook-events)
4. [Webhook Replay](#webhook-replay)
5. [Webhook Simulator](#webhook-simulator)
6. [Swedish Service Mocks](#swedish-service-mocks)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Security](#security)

## Authentication

All API endpoints require a valid `cooperative_id` parameter. In production, this would be extracted from authentication tokens.

```json
{
  "cooperative_id": "your-cooperative-id"
}
```

## Webhook Endpoints Management

### List Webhook Endpoints

**GET** `/api/webhooks/endpoints`

Retrieve webhook endpoints with filtering and pagination.

**Query Parameters:**
- `cooperative_id` (required): Cooperative identifier
- `service_type` (optional): Filter by service type (`bankid`, `fortnox`, `kivra`, `payment`, `notification`, `custom`)
- `environment` (optional): Filter by environment (`development`, `staging`, `production`, `test`)
- `is_active` (optional): Filter by active status (`true`, `false`)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
{
  "endpoints": [
    {
      "id": "endpoint-id",
      "name": "My BankID Endpoint",
      "url": "https://myapp.com/webhook/bankid",
      "service_type": "bankid",
      "description": "Handles BankID authentication callbacks",
      "events": ["bankid.auth.complete", "bankid.auth.failed"],
      "headers": {"Authorization": "Bearer token"},
      "timeout_seconds": 30,
      "retry_attempts": 3,
      "retry_backoff_seconds": 60,
      "is_active": true,
      "is_verified": true,
      "consecutive_failures": 0,
      "total_events": 1250,
      "successful_events": 1200,
      "failed_events": 50,
      "avg_response_time_ms": 185,
      "last_success_at": "2024-01-15T10:30:00Z",
      "last_failure_at": "2024-01-14T15:45:00Z",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### Create Webhook Endpoint

**POST** `/api/webhooks/endpoints`

Create a new webhook endpoint.

**Request Body:**
```json
{
  "cooperative_id": "your-cooperative-id",
  "name": "My Test Endpoint",
  "url": "https://myapp.com/webhook",
  "service_type": "bankid",
  "description": "Test endpoint for BankID",
  "secret": "webhook_secret_key",
  "auth_header": "Authorization",
  "auth_token": "Bearer your-token",
  "events": ["bankid.auth.complete"],
  "headers": {"X-Custom": "value"},
  "timeout_seconds": 30,
  "retry_attempts": 3,
  "retry_backoff_seconds": 60,
  "rate_limit_requests": 100,
  "rate_limit_window_minutes": 1,
  "environment": "production",
  "test_mode": false
}
```

### Get Webhook Endpoint Details

**GET** `/api/webhooks/endpoints/{id}`

Get detailed information about a specific webhook endpoint.

**Query Parameters:**
- `cooperative_id` (required): Cooperative identifier

**Response:**
```json
{
  "endpoint": {
    // ... endpoint details
    "total_events": 1250,
    "successful_events": 1200,
    "failed_events": 50,
    "pending_events": 0,
    "retrying_events": 0
  },
  "recent_events": [
    {
      "event_id": "evt_123",
      "event_type": "bankid.auth.complete",
      "source_service": "bankid",
      "delivery_status": "delivered",
      "response_status_code": 200,
      "response_time_ms": 150,
      "created_at": "2024-01-15T10:30:00Z",
      "error_message": null
    }
  ],
  "subscriptions": [
    {
      "id": "sub_123",
      "event_type": "bankid.auth.*",
      "is_active": true,
      "filter_conditions": {}
    }
  ]
}
```

### Update Webhook Endpoint

**PUT** `/api/webhooks/endpoints/{id}`

Update an existing webhook endpoint.

**Request Body:** (all fields optional)
```json
{
  "cooperative_id": "your-cooperative-id",
  "name": "Updated Name",
  "url": "https://myapp.com/new-webhook",
  "is_active": false
}
```

### Delete Webhook Endpoint

**DELETE** `/api/webhooks/endpoints/{id}`

Soft delete a webhook endpoint (sets deleted_at timestamp).

**Query Parameters:**
- `cooperative_id` (required): Cooperative identifier

## Webhook Events

### List Webhook Events

**GET** `/api/webhooks/events`

Retrieve webhook events with comprehensive filtering.

**Query Parameters:**
- `cooperative_id` (required): Cooperative identifier
- `endpoint_id` (optional): Filter by specific endpoint
- `event_type` (optional): Filter by event type (supports partial matching)
- `source_service` (optional): Filter by source service
- `delivery_status` (optional): Filter by delivery status
- `is_test_event` (optional): Filter test events (`true`, `false`)
- `is_replayed` (optional): Filter replayed events (`true`, `false`)
- `from_date` (optional): Filter events from date (ISO 8601)
- `to_date` (optional): Filter events to date (ISO 8601)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
{
  "events": [
    {
      "id": "event-db-id",
      "event_id": "evt_123",
      "event_type": "bankid.auth.complete",
      "source_service": "bankid",
      "correlation_id": "corr_456",
      "payload": {
        "orderRef": "order_789",
        "status": "complete",
        "completionData": {
          "user": {
            "personalNumber": "198001011234",
            "name": "Test Testsson"
          }
        }
      },
      "payload_size": 1024,
      "headers_received": {"Content-Type": "application/json"},
      "delivery_status": "delivered",
      "delivery_attempts": 1,
      "last_delivery_attempt": "2024-01-15T10:30:00Z",
      "response_status_code": 200,
      "response_headers": {"Content-Type": "application/json"},
      "response_body": "{\"received\": true}",
      "response_time_ms": 150,
      "error_message": null,
      "signature_valid": true,
      "ip_address": "192.168.1.100",
      "user_agent": "BRF-Webhook-Delivery/1.0",
      "is_test_event": true,
      "is_replayed": false,
      "original_event_id": null,
      "created_at": "2024-01-15T10:30:00Z",
      "endpoint_name": "My BankID Endpoint",
      "endpoint_service_type": "bankid"
    }
  ],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "stats": {
    "total_events": 150,
    "delivered": 140,
    "failed": 8,
    "pending": 1,
    "retrying": 1,
    "avg_response_time": 185,
    "avg_payload_size": 2048
  }
}
```

### Create Webhook Event

**POST** `/api/webhooks/events`

Create a webhook event for testing purposes.

**Request Body:**
```json
{
  "cooperative_id": "your-cooperative-id",
  "endpoint_id": "endpoint-id",
  "event_type": "test.event",
  "source_service": "custom",
  "payload": {
    "test": "data",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "correlation_id": "test-correlation-123",
  "headers_received": {"Content-Type": "application/json"},
  "ip_address": "127.0.0.1",
  "user_agent": "Test-Client/1.0",
  "is_test_event": true
}
```

## Webhook Replay

### Replay Webhook Event

**POST** `/api/webhooks/events/{event_id}/replay`

Replay a webhook event to the same or different endpoint.

**Request Body:**
```json
{
  "cooperative_id": "your-cooperative-id",
  "endpoint_id": "target-endpoint-id", // optional, defaults to original
  "user_id": "user-id" // optional, for audit purposes
}
```

**Response:**
```json
{
  "message": "Webhook event replayed successfully",
  "original_event_id": "evt_123",
  "replayed_event": {
    // ... new event details with is_replayed: true
    "event_id": "evt_replay_456",
    "is_replayed": true,
    "original_event_id": "evt_123"
  }
}
```

## Webhook Simulator

### List Simulator Sessions

**GET** `/api/webhooks/simulator`

List webhook simulator sessions.

**Query Parameters:**
- `cooperative_id` (required): Cooperative identifier
- `service_type` (optional): Filter by service type
- `is_active` (optional): Filter active sessions

### Start Simulator Session

**POST** `/api/webhooks/simulator`

Start a new webhook simulation session.

**Request Body:**
```json
{
  "cooperative_id": "your-cooperative-id",
  "name": "BankID Authentication Tests",
  "description": "Testing various BankID authentication scenarios",
  "service_type": "bankid",
  "base_url": "https://test.bankid.com",
  "scenarios": [
    {
      "name": "Successful Authentication",
      "event_type": "bankid.auth.complete",
      "payload_template": {
        "orderRef": "{{orderRef}}",
        "status": "complete"
      },
      "delay_seconds": 3,
      "repeat_count": 1,
      "repeat_interval_seconds": 60
    }
  ]
}
```

### Simulate Webhook Events

**POST** `/api/webhooks/simulator/simulate`

Simulate webhook events immediately.

**Request Body:**
```json
{
  "cooperative_id": "your-cooperative-id",
  "event_type": "bankid.auth.complete",
  "service_type": "bankid",
  "payload": {
    "orderRef": "test_123",
    "status": "complete",
    "completionData": {
      "user": {
        "personalNumber": "198001011234",
        "name": "Test Testsson"
      }
    }
  },
  "target_endpoints": ["endpoint-id-1", "endpoint-id-2"], // optional
  "delay_seconds": 0,
  "correlation_id": "sim_123"
}
```

## Swedish Service Mocks

### BankID Mock

**POST** `/api/webhooks/mocks/bankid`

Simulate BankID authentication flows.

**Request Body:**
```json
{
  "cooperative_id": "your-cooperative-id",
  "scenario": "success", // success, user_cancel, timeout, start_failed, expired_transaction
  "delay_seconds": 3,
  "personal_number": "198001011234",
  "user_name": "Test Testsson",
  "signature_type": "advanced", // simple, advanced
  "auto_start": true
}
```

**Response:**
```json
{
  "message": "BankID mock authentication flow initiated",
  "scenario": "success",
  "order_ref": "mock_bankid_123",
  "transaction_id": "uuid-456",
  "expected_completion": "2024-01-15T10:33:00Z",
  "scheduled_webhooks": [
    {
      "event_type": "bankid.auth.started",
      "scheduled_delivery": "2024-01-15T10:30:00Z",
      "simulated_events": [/* webhook delivery details */]
    }
  ],
  "mock_response": {
    "orderRef": "mock_bankid_123",
    "autoStartToken": "auto-start-token",
    "qrStartToken": "qr.1705316400.xyz",
    "qrStartSecret": "secret-hex-string"
  }
}
```

### Fortnox Mock

**POST** `/api/webhooks/mocks/fortnox`

Simulate Fortnox accounting system events.

**Request Body:**
```json
{
  "cooperative_id": "your-cooperative-id",
  "scenario": "invoice_created", // invoice_created, invoice_paid, invoice_overdue, customer_created, article_updated, voucher_created
  "delay_seconds": 1,
  "customer_number": "1001",
  "customer_name": "Testbostadsrättsförening",
  "amount": 15000,
  "currency": "SEK",
  "include_vat": true
}
```

**Response:**
```json
{
  "message": "Fortnox mock event initiated",
  "scenario": "invoice_created",
  "document_number": 1234,
  "transaction_id": "uuid-789",
  "scheduled_delivery": "2024-01-15T10:31:00Z",
  "scheduled_webhooks": [/* delivery details */],
  "mock_data": {
    "EventType": "create",
    "EntityType": "Invoice",
    "Data": {
      "DocumentNumber": 1234,
      "CustomerNumber": "1001",
      "CustomerName": "Testbostadsrättsförening",
      "Total": 15000,
      "Currency": "SEK",
      "InvoiceRows": [
        {
          "ArticleNumber": "MA001",
          "Description": "Månadsavgift",
          "Price": 12000,
          "VAT": 3000,
          "Total": 15000
        }
      ]
    }
  }
}
```

### Kivra Mock

**POST** `/api/webhooks/mocks/kivra`

Simulate Kivra digital mailbox events.

**Request Body:**
```json
{
  "cooperative_id": "your-cooperative-id",
  "scenario": "message_delivered", // message_delivered, message_read, message_failed, delivery_receipt, message_expired
  "delay_seconds": 2,
  "recipient_id": "198001011234",
  "message_type": "invoice", // invoice, notice, reminder, information, contract
  "subject": "Månadsavgift BRF",
  "language": "sv", // sv, en
  "priority": "medium" // low, medium, high, urgent
}
```

**Response:**
```json
{
  "message": "Kivra mock event initiated",
  "scenario": "message_delivered",
  "message_id": "uuid-msg-123",
  "recipient_id": "198001011234",
  "transaction_id": "uuid-txn-456",
  "scheduled_delivery": "2024-01-15T10:32:00Z",
  "scheduled_webhooks": [/* delivery details */],
  "mock_data": {
    "messageId": "uuid-msg-123",
    "recipientId": "198001011234",
    "messageType": "invoice",
    "subject": "Månadsavgift BRF",
    "status": "delivered",
    "content": {
      "documentType": "invoice",
      "amount": 15000,
      "currency": "SEK",
      "dueDate": "2024-02-15",
      "ocrNumber": "1234567890"
    },
    "deliveryReceipt": {
      "delivered": true,
      "deliveredAt": "2024-01-15T10:32:00Z",
      "legallyBinding": true
    }
  }
}
```

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "details": [/* validation errors if applicable */],
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Rate Limited
- `500` - Internal Server Error

## Rate Limiting

**Default Limits:**
- API endpoints: 100 requests per minute per cooperative
- Webhook deliveries: Configurable per endpoint (default: 100/minute)
- Simulator: 50 simulations per minute per cooperative

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705316400
```

## Security

### Webhook Signatures

Webhooks include HMAC-SHA256 signatures when endpoints have secrets configured:

```
X-Webhook-Signature: sha256=hash_value
```

**Verification Example (Node.js):**
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expectedSignature}`;
}
```

### Standard Headers

All webhook deliveries include these headers:
```
Content-Type: application/json
User-Agent: BRF-Webhook-Delivery/1.0
X-Webhook-Event-ID: evt_123
X-Webhook-Event-Type: bankid.auth.complete
X-Webhook-Source: bankid
X-Webhook-Delivery-Attempt: 1
X-Webhook-Timestamp: 2024-01-15T10:30:00Z
X-Webhook-Correlation-ID: corr_456 (if available)
```

### IP Allowlisting

For production endpoints, consider implementing IP allowlisting for webhook sources:
- BankID: `203.0.113.0/24` (example)
- Fortnox: `198.51.100.0/24` (example)  
- Kivra: `192.0.2.0/24` (example)
- BRF Portal: Configure your server IPs

## Best Practices

1. **Idempotency**: Handle duplicate webhook deliveries gracefully
2. **Timeouts**: Respond within the configured timeout (default: 30s)
3. **Status Codes**: Return 2xx for success, 4xx for client errors, 5xx for server errors
4. **Logging**: Log all webhook receptions for debugging and compliance
5. **Retry Logic**: Implement exponential backoff for failed deliveries
6. **Monitoring**: Monitor endpoint health and response times
7. **Testing**: Use the simulator extensively before production deployment

## Swedish BRF Context

This webhook system is specifically designed for Swedish housing cooperatives with:

- **Legal Compliance**: Support for Swedish digital service requirements
- **Multi-language**: Swedish and English language support
- **Currency**: SEK currency handling
- **Personal Numbers**: Swedish personal number (personnummer) format validation
- **VAT**: Swedish VAT (moms) calculations (25% standard rate)
- **Banking**: Support for Swedish payment methods (Autogiro, Bankgiro, Plusgiro)
- **Document Types**: Swedish document classifications and retention requirements

For more information about Swedish BRF regulations and digital service requirements, consult:
- Boverket (Swedish National Board of Housing)
- Skatteverket (Swedish Tax Agency)  
- DIGG (Agency for Digital Government)