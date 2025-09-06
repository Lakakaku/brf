# API Response Mocker System

A comprehensive API response mocking system designed specifically for Swedish BRF (Bostadsrättsförening) applications, with built-in support for Swedish services like BankID, Fortnox, Kivra, and Swedish banks.

## Overview

The API Response Mocker System provides:

- **Configurable Mock Responses**: Create and manage mock API responses with custom delays, status codes, and payloads
- **Swedish Service Integration**: Pre-built mocks for BankID, Fortnox, Kivra, and Swedish banking services
- **UI Management**: Web-based interface for managing mock configurations
- **Service Adapters**: Seamless switching between mock and real services
- **Webhook Integration**: Mock webhook events for testing integration flows
- **Database Persistence**: Store mock configurations in SQLite database
- **Response Delay Simulation**: Simulate real-world API response times

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UI Manager    │    │  Service Adapter │    │  Mock Engine    │
│   Dashboard     │◄──►│     Layer        │◄──►│   (Core)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌──────────────────┐             │
                       │   Database       │◄────────────┘
                       │  Persistence     │
                       └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Swedish Service Mocks                        │
├─────────────┬─────────────┬─────────────┬─────────────┬────────┤
│   BankID    │   Fortnox   │    Kivra    │ Swedish     │  ...   │
│    Mock     │    Mock     │    Mock     │  Banks      │        │
└─────────────┴─────────────┴─────────────┴─────────────┴────────┘
```

## Quick Start

### 1. Basic Setup

```typescript
import { apiMocker, ServiceAdapter, ServiceAdapterConfig } from '@/lib/api-mocker';

// Configure the service adapter
const config: ServiceAdapterConfig = {
  useMocks: true,
  environment: 'development',
  cooperativeId: 'your-cooperative-id',
  fallbackToReal: true,
  mockOverrides: {
    bankid: true,
    fortnox: false, // Use real Fortnox API
  }
};

const adapter = new ServiceAdapter(config);
```

### 2. Making API Requests

```typescript
// The adapter will automatically use mock or real service based on configuration
const response = await adapter.request({
  service: 'bankid',
  endpoint: '/auth',
  method: 'POST',
  scenario: 'success',
  data: {
    personalNumber: '198001011234',
    endUserIp: '192.168.1.1'
  }
});

console.log('Response:', response.data);
console.log('Is Mocked:', response.isMocked);
console.log('Response Time:', response.responseTime, 'ms');
```

### 3. Using Specialized Adapters

```typescript
import { BankIDAdapter, FortnoxAdapter, KivraAdapter } from '@/lib/api-mocker/service-adapter';

// BankID authentication
const bankidAdapter = new BankIDAdapter(config);
const authResponse = await bankidAdapter.authenticate('198001011234', 'success');

// Fortnox invoice creation
const fortnoxAdapter = new FortnoxAdapter(config);
const invoiceResponse = await fortnoxAdapter.createInvoice(invoiceData, 'invoice_created');

// Kivra message sending
const kivraAdapter = new KivraAdapter(config);
const messageResponse = await kivraAdapter.sendMessage(messageData, 'message_delivered');
```

## API Endpoints

### Mock Configuration Management

#### GET /api/mocks
List all mock configurations for a cooperative.

**Parameters:**
- `cooperative_id` (required): Cooperative identifier
- `service` (optional): Filter by service name
- `environment` (optional): Filter by environment
- `is_enabled` (optional): Filter by enabled status

**Response:**
```json
{
  "configurations": [
    {
      "id": "mock-config-id",
      "name": "BankID Success Mock",
      "service": "bankid",
      "endpoint": "/auth",
      "method": "POST",
      "scenario": "success",
      "delay_ms": 2000,
      "response_status": 200,
      "response_data": { "orderRef": "abc123", "autoStartToken": "..." },
      "is_enabled": true,
      "environment": "development",
      "source": "database"
    }
  ],
  "statistics": {
    "total": 15,
    "enabled": 12,
    "services": 4
  }
}
```

#### POST /api/mocks
Create a new mock configuration.

**Request Body:**
```json
{
  "cooperative_id": "coop-123",
  "name": "Payment Success Mock",
  "description": "Mock successful payment response",
  "service": "swedish_banks",
  "endpoint": "/payment-requests",
  "method": "POST",
  "scenario": "payment_completed",
  "delayMs": 3000,
  "responseStatus": 200,
  "responseData": {
    "paymentId": "PAY-123",
    "status": "COMPLETED",
    "amount": 15000,
    "currency": "SEK"
  },
  "headers": {
    "Content-Type": "application/json"
  },
  "isEnabled": true,
  "environment": "development",
  "tags": ["payment", "success", "brf"]
}
```

#### PUT /api/mocks/[id]
Update an existing mock configuration.

#### DELETE /api/mocks/[id]
Delete a mock configuration (soft delete).

#### PATCH /api/mocks/[id]
Toggle mock configuration on/off.

**Request Body:**
```json
{
  "enabled": true,
  "cooperative_id": "coop-123"
}
```

### Swedish Service Mocks

#### POST /api/webhooks/mocks/bankid
Trigger BankID authentication mock flow.

**Request Body:**
```json
{
  "cooperative_id": "coop-123",
  "scenario": "success",
  "delay_seconds": 3,
  "personal_number": "198001011234",
  "user_name": "Test Testsson",
  "auto_start": true
}
```

**Available Scenarios:**
- `success`: Complete authentication with user signature
- `user_cancel`: User cancels authentication
- `timeout`: Authentication times out
- `start_failed`: BankID app fails to start
- `expired_transaction`: Transaction expires

#### POST /api/webhooks/mocks/fortnox
Trigger Fortnox accounting system mock events.

**Request Body:**
```json
{
  "cooperative_id": "coop-123",
  "scenario": "invoice_created",
  "delay_seconds": 1,
  "customer_number": "1001",
  "customer_name": "Testbostadsrättsförening",
  "amount": 15000,
  "currency": "SEK",
  "include_vat": true
}
```

**Available Scenarios:**
- `invoice_created`: New invoice created
- `invoice_paid`: Invoice payment received
- `invoice_overdue`: Invoice past due date
- `customer_created`: New customer added
- `article_updated`: Service/fee article updated
- `voucher_created`: Accounting voucher created

#### POST /api/webhooks/mocks/kivra
Trigger Kivra digital mailbox mock events.

**Request Body:**
```json
{
  "cooperative_id": "coop-123",
  "scenario": "message_delivered",
  "delay_seconds": 2,
  "recipient_id": "198001011234",
  "message_type": "invoice",
  "subject": "Månadsavgift BRF",
  "language": "sv",
  "priority": "medium"
}
```

**Available Scenarios:**
- `message_delivered`: Message successfully delivered
- `message_read`: Recipient opened the message
- `message_failed`: Delivery failed
- `delivery_receipt`: Official delivery receipt
- `message_expired`: Message expired unread

#### POST /api/webhooks/mocks/swedish-banks
Trigger Swedish banking system mock events.

**Request Body:**
```json
{
  "cooperative_id": "coop-123",
  "scenario": "payment_completed",
  "delay_seconds": 2,
  "bank": "swedbank",
  "account_number": "12345678901",
  "clearing_number": "8000",
  "amount": 15000,
  "currency": "SEK",
  "payer_name": "Testbostadsrättsförening",
  "payment_reference": "Månadsavgift",
  "include_psd2_data": true
}
```

**Available Scenarios:**
- `payment_initiated`: Payment instruction received
- `payment_completed`: Payment successfully processed
- `payment_failed`: Payment processing failed
- `account_balance_check`: Account balance inquiry
- `transaction_history`: Account transaction history
- `direct_debit_setup`: Autogiro mandate setup
- `direct_debit_payment`: Autogiro payment processed
- `standing_order_created`: Recurring payment created
- `account_blocked`: Account temporarily blocked
- `insufficient_funds`: Payment failed due to insufficient balance

## Service Adapter Usage

### Basic Service Adapter

```typescript
import { ServiceAdapter, ServiceAdapterConfig } from '@/lib/api-mocker/service-adapter';

const config: ServiceAdapterConfig = {
  useMocks: process.env.NODE_ENV === 'development',
  environment: process.env.NODE_ENV as any,
  cooperativeId: 'your-coop-id',
  fallbackToReal: true
};

const adapter = new ServiceAdapter(config);

// Make a request that will use mock or real service based on configuration
const response = await adapter.request({
  service: 'bankid',
  endpoint: '/auth',
  method: 'POST',
  scenario: 'success',
  data: { personalNumber: '198001011234' }
});
```

### Specialized Adapters

#### BankID Adapter

```typescript
import { BankIDAdapter } from '@/lib/api-mocker/service-adapter';

const bankidAdapter = new BankIDAdapter(config);

// Authenticate user
const authResult = await bankidAdapter.authenticate('198001011234');

// Collect authentication status
const collectResult = await bankidAdapter.collect(authResult.data.orderRef);

// Cancel authentication
const cancelResult = await bankidAdapter.cancel(authResult.data.orderRef);
```

#### Fortnox Adapter

```typescript
import { FortnoxAdapter } from '@/lib/api-mocker/service-adapter';

const fortnoxAdapter = new FortnoxAdapter(config);

// Create invoice
const invoice = await fortnoxAdapter.createInvoice({
  CustomerNumber: '1001',
  InvoiceRows: [{
    ArticleNumber: 'MA001',
    Description: 'Månadsavgift',
    Price: 15000,
    Unit: 'st',
    DeliveredQuantity: 1
  }]
});

// Get invoice
const invoiceDetails = await fortnoxAdapter.getInvoice('12345');

// Create customer
const customer = await fortnoxAdapter.createCustomer({
  Name: 'Testbostadsrättsförening',
  OrganisationNumber: '556123-1234',
  Type: 'COMPANY'
});
```

#### Swedish Bank Adapter

```typescript
import { SwedishBankAdapter } from '@/lib/api-mocker/service-adapter';

const bankAdapter = new SwedishBankAdapter(config);

// Initiate payment
const payment = await bankAdapter.initiatePayment({
  amount: { amount: 15000, currency: 'SEK' },
  debtorAccount: { identification: '800012345678901' },
  creditorAccount: { identification: '800098765432109' },
  remittanceInformation: 'Månadsavgift'
});

// Check account balance
const balance = await bankAdapter.getAccountBalance('12345678901');

// Get transaction history
const transactions = await bankAdapter.getTransactionHistory(
  '12345678901',
  '2024-01-01',
  '2024-01-31'
);

// Setup Autogiro (direct debit)
const autogiroSetup = await bankAdapter.setupAutogiro({
  payerAccount: { identification: '800012345678901' },
  payeeAccount: { identification: '800098765432109' },
  maxAmount: { amount: 20000, currency: 'SEK' }
});
```

### Service Adapter Manager

For managing multiple services:

```typescript
import { ServiceAdapterManager } from '@/lib/api-mocker/service-adapter';

const manager = new ServiceAdapterManager({
  useMocks: true,
  environment: 'development',
  cooperativeId: 'coop-123',
  fallbackToReal: true
});

// Get adapters for different services
const bankidAdapter = manager.getAdapter('bankid');
const fortnoxAdapter = manager.getAdapter('fortnox');
const kivraAdapter = manager.getAdapter('kivra');

// Enable/disable mocks globally
manager.setMocksEnabled(false);

// Enable/disable mocks for specific service
manager.setServiceMockEnabled('bankid', true);
```

## Mock Response Configuration

### Response Structure

All mock responses follow this structure:

```typescript
interface MockResponse {
  status: number;           // HTTP status code
  data: Record<string, any>; // Response payload
  headers: Record<string, string>; // Response headers
  delay: number;           // Applied delay in milliseconds
  timestamp: string;       // Response timestamp
}
```

### Delay Simulation

Mock responses can simulate real-world API delays:

```typescript
// 0-30 seconds delay supported
const mockConfig = {
  delayMs: 3000, // 3 second delay
  // ... other config
};
```

### Dynamic Response Data

Use templating for dynamic responses:

```json
{
  "responseData": {
    "transactionId": "{{uuid}}",
    "timestamp": "{{timestamp}}",
    "amount": "{{amount}}",
    "personalNumber": "{{personalNumber}}"
  }
}
```

## Environment Configuration

### Development
```typescript
const config: ServiceAdapterConfig = {
  useMocks: true,
  environment: 'development',
  fallbackToReal: false, // Always use mocks in dev
  mockOverrides: {} // Use global mock setting
};
```

### Staging
```typescript
const config: ServiceAdapterConfig = {
  useMocks: true,
  environment: 'staging',
  fallbackToReal: true, // Fallback to real services if mock fails
  mockOverrides: {
    bankid: true,     // Use BankID mocks
    fortnox: false,   // Use real Fortnox
    kivra: false,     // Use real Kivra
    swedish_banks: true // Use bank mocks
  }
};
```

### Production
```typescript
const config: ServiceAdapterConfig = {
  useMocks: false,
  environment: 'production',
  fallbackToReal: false, // No fallback needed
  mockOverrides: {} // No mocks in production
};
```

## Database Schema

### Mock Configurations Table

```sql
CREATE TABLE mock_configurations (
  id TEXT PRIMARY KEY,
  cooperative_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  service TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  scenario TEXT NOT NULL,
  delay_ms INTEGER DEFAULT 0,
  response_status INTEGER DEFAULT 200,
  response_data TEXT NOT NULL, -- JSON
  headers TEXT DEFAULT '{}',   -- JSON
  is_enabled INTEGER DEFAULT 1,
  environment TEXT DEFAULT 'development',
  tags TEXT DEFAULT '[]',      -- JSON array
  usage_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES members(id),
  deleted_at TEXT
);
```

### Mock Usage History Table

```sql
CREATE TABLE mock_usage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cooperative_id TEXT NOT NULL,
  mock_configuration_id TEXT,
  service TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  scenario TEXT NOT NULL,
  request_data TEXT DEFAULT '{}',    -- JSON
  request_headers TEXT DEFAULT '{}', -- JSON
  response_status INTEGER NOT NULL,
  response_data TEXT NOT NULL,       -- JSON
  response_time_ms INTEGER,
  delay_applied_ms INTEGER DEFAULT 0,
  correlation_id TEXT,
  session_id TEXT,
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## UI Management

The Mock Manager Dashboard provides a web-based interface for:

### Features
- **Configuration Management**: Create, edit, delete, and toggle mock configurations
- **Service Overview**: View statistics and status for all services
- **Environment Filtering**: Filter configurations by environment and service
- **Real-time Testing**: Test mock configurations directly from the UI
- **Import/Export**: Backup and share mock configurations
- **Usage Tracking**: Monitor mock usage and performance

### Usage

```tsx
import MockManagerDashboard from '@/components/admin/MockManagerDashboard';

function AdminPage() {
  return (
    <MockManagerDashboard cooperativeId="your-cooperative-id" />
  );
}
```

## Best Practices

### 1. Environment-Specific Configuration

Use environment variables to control mock behavior:

```typescript
const config: ServiceAdapterConfig = {
  useMocks: process.env.USE_MOCKS === 'true',
  environment: process.env.NODE_ENV as any,
  cooperativeId: process.env.COOPERATIVE_ID!,
  fallbackToReal: process.env.MOCK_FALLBACK === 'true'
};
```

### 2. Realistic Mock Data

Create mocks that closely resemble real API responses:

```json
{
  "responseData": {
    "orderRef": "131daac9-16c6-4618-beb0-365768f37288",
    "autoStartToken": "7c40b5c9-fa74-49cf-b98c-927a8d8c5e7c",
    "qrStartToken": "67df3917-fa0d-44e5-b327-edcc928297f8",
    "qrStartSecret": "d28db9c7-4637-4251-84b5-25ba5dda2e1f"
  }
}
```

### 3. Error Scenario Testing

Include error scenarios in your mocks:

```typescript
const mockConfigs = [
  {
    scenario: 'success',
    responseStatus: 200,
    responseData: { /* success data */ }
  },
  {
    scenario: 'timeout',
    responseStatus: 408,
    responseData: { error: 'Request timeout' }
  },
  {
    scenario: 'server_error',
    responseStatus: 500,
    responseData: { error: 'Internal server error' }
  }
];
```

### 4. Response Time Simulation

Use realistic delays to test timeout handling:

```typescript
const scenarios = {
  fast_response: { delayMs: 100 },
  normal_response: { delayMs: 2000 },
  slow_response: { delayMs: 10000 },
  timeout_scenario: { delayMs: 30000 }
};
```

### 5. Service-Specific Overrides

Use granular control for different services:

```typescript
const config: ServiceAdapterConfig = {
  useMocks: true,
  environment: 'staging',
  mockOverrides: {
    // Use real BankID for integration testing
    bankid: false,
    // Mock Fortnox to avoid test data in accounting system
    fortnox: true,
    // Mock Kivra to avoid sending real messages
    kivra: true,
    // Use real banks for payment validation
    swedish_banks: false
  }
};
```

## Troubleshooting

### Common Issues

1. **Mock not triggering**: Check if mock is enabled and environment matches
2. **Wrong response**: Verify scenario name and service configuration
3. **Database errors**: Ensure database migrations have been run
4. **UI not loading**: Check cooperative_id parameter

### Debug Mode

Enable debug logging:

```typescript
// Add to your environment configuration
process.env.DEBUG_MOCKS = 'true';
```

### Health Check

Test your mock system:

```bash
curl -X GET "http://localhost:3000/api/mocks?cooperative_id=test-coop" \
  -H "Content-Type: application/json"
```

## Migration and Deployment

### Database Migrations

Run the mock configuration migration:

```bash
npm run migrate
```

### Environment Variables

Required environment variables:

```bash
# Mock system configuration
USE_MOCKS=true
MOCK_FALLBACK=true
DEBUG_MOCKS=false

# Database
DATABASE_URL=file:./database.sqlite

# Service configurations
BANKID_CLIENT_ID=your-bankid-client-id
FORTNOX_API_KEY=your-fortnox-api-key
KIVRA_CLIENT_ID=your-kivra-client-id
```

## Contributing

When adding new service mocks:

1. Create mock endpoint in `/app/api/webhooks/mocks/[service]/route.ts`
2. Add service configuration to ApiMocker class
3. Create specialized adapter in service-adapter.ts
4. Add documentation and examples
5. Include realistic test data for Swedish BRF context

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review logs for error messages
3. Test with simplified mock configurations
4. Verify database schema is up to date

The API Response Mocker System provides comprehensive testing capabilities for Swedish BRF applications, ensuring reliable integration with critical services like BankID, Fortnox, Kivra, and Swedish banking systems.