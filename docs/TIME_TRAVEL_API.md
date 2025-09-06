# Time Travel API Documentation

## Overview

The Time Travel API provides comprehensive time manipulation capabilities for testing Swedish BRF (Bostadsrättförening) features that depend on time-sensitive business logic. This system allows developers and testers to simulate different dates and times to thoroughly test features like monthly fee generation, invoice due dates, board meeting deadlines, and regulatory reporting periods.

## Architecture

The Time Travel system consists of:

1. **API Endpoints** - RESTful APIs for time manipulation
2. **React Hooks** - Client-side integration and state management
3. **UI Components** - Control panel for manual time manipulation
4. **Utility Functions** - Swedish BRF-specific time calculations
5. **Mock Features** - Realistic Swedish BRF data that respects time travel state

## API Endpoints

### Base Time Travel API

#### `GET /api/time-travel`
Returns the current time travel state.

**Response:**
```json
{
  "success": true,
  "data": {
    "currentTime": "2024-03-15T10:30:00.000Z",
    "realTime": "2024-01-15T10:30:00.000Z",
    "frozen": false,
    "timeTravelActive": true,
    "timezone": "Europe/Stockholm",
    "manipulationHistory": [],
    "brfContext": {
      "fiscalYear": {
        "fiscalYear": "2023/2024",
        "fiscalYearStart": "2023-07-01T00:00:00.000Z",
        "fiscalYearEnd": "2024-06-30T00:00:00.000Z",
        "daysUntilFiscalYearEnd": 107
      },
      "paymentPeriod": {
        "currentMonth": "2024-03",
        "paymentDueDate": "2024-03-31T21:59:59.000Z",
        "daysUntilDue": 16,
        "isOverdue": false
      },
      "reportingPeriod": {
        "currentPeriod": "2024-03",
        "nextEnergyReporting": "2025-02-01T00:00:00.000Z",
        "annualReportDeadline": "2024-12-31T00:00:00.000Z",
        "daysUntilAnnualReport": 291
      }
    }
  }
}
```

#### `POST /api/time-travel`
Manipulates system time based on the specified action.

**Request Body:**
```json
{
  "action": "set|advance|freeze|unfreeze|reset",
  "date": "2024-06-30T17:00:00.000Z", // Required for 'set' action
  "amount": { // Required for 'advance' action
    "years": 0,
    "months": 1,
    "days": 15,
    "hours": 2,
    "minutes": 30
  },
  "timezone": "Europe/Stockholm"
}
```

**Actions:**
- `set` - Set time to a specific date/time
- `advance` - Advance time by specified amount
- `freeze` - Freeze time at current moment
- `unfreeze` - Resume time progression from current point
- `reset` - Reset to real time and clear time travel state

**Response:**
```json
{
  "success": true,
  "data": {
    "currentTime": "2024-06-30T17:00:00.000Z",
    "realTime": "2024-01-15T10:30:00.000Z",
    "frozen": false,
    "timeTravelActive": true,
    "description": "Set time to 2024-06-30T17:00:00.000Z",
    "brfContext": {
      // Swedish BRF context for the new time
    }
  }
}
```

#### `DELETE /api/time-travel`
Resets time travel to real time and clears all state.

**Response:**
```json
{
  "success": true,
  "data": {
    "currentTime": "2024-01-15T10:30:00.000Z",
    "timeTravelActive": false,
    "description": "Time travel reset to real time"
  }
}
```

### Scenario Management API

#### `GET /api/time-travel/scenarios`
Returns available pre-configured testing scenarios.

**Response:**
```json
{
  "success": true,
  "data": {
    "scenarios": [
      "month_end_payment_due",
      "fiscal_year_end",
      "overdue_payments",
      "board_meeting_season",
      "energy_reporting_period",
      "annual_report_deadline",
      "summer_maintenance_season",
      "winter_heating_season"
    ],
    "details": {
      "month_end_payment_due": {
        "name": "Month-End Payment Due",
        "description": "Test monthly fee payment deadlines and overdue calculations",
        "context": {
          "season": "Any",
          "paymentContext": "Monthly fees due at month end",
          "regulatoryContext": "Standard payment terms apply",
          "businessContext": "Peak payment processing period"
        },
        "suggestedTests": [
          "Monthly fee generation and calculation",
          "Payment deadline enforcement",
          "Overdue payment detection"
        ]
      }
    },
    "brfContext": {
      "fiscalYear": "Swedish BRFs typically have fiscal year ending June 30",
      "paymentSchedule": "Monthly fees usually due at month end",
      "regulatoryFramework": "Governed by Bostadsrättslagen (BrfL)",
      "annualCycle": "Annual meetings typically held September-November"
    }
  }
}
```

#### `POST /api/time-travel/scenarios`
Activates a specific testing scenario.

**Request Body:**
```json
{
  "scenario": "month_end_payment_due",
  "cooperative_id": "optional_coop_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scenario": "month_end_payment_due",
    "name": "Month-End Payment Due",
    "description": "Testing payment deadlines for March 2024",
    "targetDate": "2024-03-31T21:59:00.000Z",
    "context": {
      "fiscalYear": "2023/2024",
      "season": "Spring",
      "paymentContext": "Monthly fees for March are due",
      "regulatoryContext": "Standard payment terms and late fee calculations",
      "businessContext": "Peak payment processing and deadline enforcement"
    },
    "suggestedTests": [
      "Generate monthly fees for all apartments",
      "Test payment deadline calculations",
      "Verify overdue payment detection"
    ],
    "timeTravel": {
      // Time travel state after scenario activation
    },
    "instructions": [
      "Time has been set to the scenario date",
      "Run your tests for the suggested features",
      "Use the time travel API to advance time as needed",
      "Reset time travel when testing is complete"
    ]
  }
}
```

### Mock Swedish BRF Features API

#### `GET /api/mock/swedish-brf`
Returns comprehensive mock data for Swedish BRF features that respects time travel state.

**Query Parameters:**
- `cooperative_id` (optional) - Cooperative identifier
- `feature` (optional) - Specific feature to return: `monthly-fees`, `invoices`, `board-meetings`, `energy-reports`, `contract-renewals`, `dashboard-summary`

**Response (without feature parameter):**
```json
{
  "success": true,
  "data": {
    "currentTime": "2024-03-15T10:30:00.000Z",
    "brfContext": {
      // Swedish BRF time context
    },
    "monthlyFees": [
      {
        "id": "fee_0001_2024_3",
        "apartmentId": "apt_0001",
        "apartmentNumber": "0001",
        "year": 2024,
        "month": 3,
        "baseFee": 4500,
        "parkingFee": 450,
        "storageFee": 0,
        "totalAmount": 4950,
        "dueDate": "2024-03-31T21:59:59.000Z",
        "paymentStatus": "pending",
        "ocrNumber": "0012024030",
        "overdueDays": 0,
        "lateInterest": 0,
        "reminderLevel": 0,
        "reminderFees": 0
      }
    ],
    "supplierInvoices": [
      {
        "id": "inv_556000-4615_1710249600000",
        "invoiceNumber": "SKA202403001",
        "supplierName": "Skanska AB",
        "supplierOrgNumber": "556000-4615",
        "totalAmount": 25000,
        "currency": "SEK",
        "invoiceDate": "2024-03-01T00:00:00.000Z",
        "dueDate": "2024-03-31T00:00:00.000Z",
        "paymentStatus": "pending",
        "category": "Byggunderhåll",
        "overdueDays": 0,
        "lateInterest": 0
      }
    ],
    "boardMeetings": [
      {
        "id": "meeting_annual_2024",
        "meetingNumber": 1,
        "title": "Årsstämma 2024",
        "meetingType": "annual",
        "scheduledDate": "2024-10-15T17:00:00.000Z",
        "scheduledTime": "19:00",
        "location": "Föreningens lokal",
        "noticeRequiredByDate": "2024-09-24T17:00:00.000Z",
        "isNoticeValid": false,
        "status": "planned",
        "attendees": ["member_001", "member_002"],
        "quorumMet": true,
        "protocolApproved": false
      }
    ],
    "energyReports": [
      {
        "id": "energy_2024_03",
        "year": 2024,
        "month": 3,
        "electricityKwh": 18000,
        "heatingKwh": 12000,
        "hotWaterKwh": 9000,
        "totalCost": 46800,
        "costPerSqm": 13,
        "outdoorTempAvg": 8.5,
        "heatingDegreeDays": 285,
        "reportingDeadline": "2025-02-28T00:00:00.000Z",
        "isReportingOverdue": false,
        "reportSubmitted": true,
        "complianceStatus": "compliant"
      }
    ],
    "contractRenewals": [
      {
        "id": "contract_fjarrvaermeavtal",
        "contractType": "Fjärrvärmeavtal",
        "supplierName": "Fortum Värme AB",
        "contractStart": "2023-01-01T00:00:00.000Z",
        "contractEnd": "2025-01-01T00:00:00.000Z",
        "renewalDeadline": "2024-10-03T00:00:00.000Z",
        "daysUntilRenewal": 202,
        "autoRenewal": true,
        "renewalStatus": "active",
        "renewalNotificationSent": false,
        "remindersSent": 0
      }
    ],
    "summary": {
      "totalOutstandingPayments": 125000,
      "overduePaymentCount": 0,
      "upcomingMeetings": 1,
      "contractsNeedingRenewal": 0,
      "overdueReports": 0
    }
  }
}
```

**Feature-Specific Responses:**

##### `?feature=dashboard-summary`
```json
{
  "success": true,
  "data": {
    "currentTime": "2024-03-15T10:30:00.000Z",
    "brfContext": {
      // Swedish BRF context
    },
    "summary": {
      "totalOutstandingPayments": 125000,
      "overduePaymentCount": 0,
      "upcomingMeetings": 1,
      "contractsNeedingRenewal": 0,
      "overdueReports": 0
    },
    "criticalAlerts": [
      {
        "type": "overdue_payments",
        "severity": "high",
        "title": "5 förfallna betalningar",
        "description": "Totalt 45,000 SEK förfallna betalningar kräver åtgärd",
        "actionRequired": "Skicka påminnelser och inkassokrav",
        "dueDate": "2024-03-15T10:30:00.000Z"
      }
    ],
    "upcomingDeadlines": [
      {
        "type": "payment_due",
        "title": "Betalning förfaller",
        "description": "Månadsavgift lägenhet 0001: 4,950 SEK",
        "dueDate": "2024-03-31T21:59:59.000Z",
        "daysUntilDue": 16
      }
    ]
  }
}
```

## React Hooks

### `useTimeTravel()`
Primary hook for time travel functionality.

```typescript
const {
  currentTime,
  realTime,
  frozen,
  timeTravelActive,
  brfContext,
  manipulationHistory,
  actions: {
    setTime,
    advanceTime,
    freezeTime,
    unfreezeTime,
    resetTime,
    activateScenario,
    refreshState,
  },
  isLoading,
  error,
} = useTimeTravel();
```

**Usage Examples:**
```typescript
// Set specific date and time
await actions.setTime(new Date('2024-06-30T17:00:00'));

// Advance time by 1 month and 15 days
await actions.advanceTime({ months: 1, days: 15 });

// Freeze time for precise testing
await actions.freezeTime();

// Activate predefined scenario
await actions.activateScenario('fiscal_year_end');

// Reset to real time
await actions.resetTime();
```

### `useTimeTravelScenarios()`
Hook for managing predefined testing scenarios.

```typescript
const {
  scenarios,
  isLoading,
  error,
  reload,
} = useTimeTravelScenarios();
```

### `useSwedishBRFTime()`
Hook for Swedish BRF-specific time utilities.

```typescript
const {
  currentTime,
  brfContext,
  timeTravelActive,
  isWorkingHours,
  isSwedenOfficeHours,
  isPaymentProcessingTime,
  timeZoneInfo,
} = useSwedishBRFTime();
```

## Utility Functions

### Time Manipulation
```typescript
import {
  getCurrentTime,
  isTimeTravelActive,
  getSwedishBRFTimeContext,
} from '@/lib/utils/time-travel';

// Get current time (respects time travel)
const now = getCurrentTime();

// Check if time travel is active
const isActive = isTimeTravelActive();

// Get comprehensive Swedish BRF context
const context = getSwedishBRFTimeContext();
```

### Swedish BRF Calculations
```typescript
import {
  calculateSwedishLateInterest,
  calculateSwedishReminderFees,
  generateSwedishOCR,
  formatSwedishCurrency,
  formatSwedishDate,
  getNextSwedishBusinessDay,
  isSwedishHolidayPeriod,
} from '@/lib/utils/time-travel';

// Calculate late payment interest (8% per annum)
const interest = calculateSwedishLateInterest(5000, 30); // 5000 SEK, 30 days overdue

// Get reminder fees by level
const firstReminderFee = calculateSwedishReminderFees(1); // 60 SEK
const secondReminderFee = calculateSwedishReminderFees(2); // 130 SEK
const finalReminderFee = calculateSwedishReminderFees(3); // 220 SEK

// Generate OCR number for payments
const ocrNumber = generateSwedishOCR('0001', 2024, 3); // "0012024030"

// Format Swedish currency
const formattedAmount = formatSwedishCurrency(4950); // "4 950 kr"

// Format Swedish date
const formattedDate = formatSwedishDate(new Date()); // "2024-03-15"

// Get next business day
const nextBusinessDay = getNextSwedishBusinessDay(new Date());

// Check if date is during Swedish holidays
const isHoliday = isSwedishHolidayPeriod(new Date('2024-06-21'));
```

## UI Components

### `<TimeTravelPanel />`
Complete time travel control panel component.

```typescript
import { TimeTravelPanel } from '@/components/time-travel-panel';

function TestingPage() {
  return (
    <div>
      <h1>BRF Feature Testing</h1>
      <TimeTravelPanel />
      {/* Your test components */}
    </div>
  );
}
```

**Features:**
- Real-time time display with Swedish timezone
- Manual date/time setting
- Time advancement controls
- Predefined scenario activation
- Swedish BRF context display
- Manipulation history
- Quick action buttons (freeze, advance day, reset)

## Swedish BRF Context

The system provides comprehensive context for Swedish BRF operations:

### Fiscal Year Information
- Swedish BRFs typically use July 1 - June 30 fiscal year
- Tracks days until fiscal year end
- Provides fiscal year designation (e.g., "2023/2024")

### Payment Period Information
- Monthly fees typically due on last day of month
- Tracks payment due dates and overdue status
- Calculates days until payment due

### Reporting Period Information
- Energy reporting deadlines (February 1st for previous year)
- Annual report filing deadline (December 31st)
- Tracks compliance status

### Heating Period Information
- Heating season typically October 1 - April 30
- Tracks heating degree days for cost calculations
- Determines if currently in heating period

### Maintenance Period Information
- Optimal maintenance season May 1 - September 30
- Peak maintenance window June - August
- Weather-dependent maintenance scheduling

## Testing Scenarios

### Available Scenarios

1. **`month_end_payment_due`** - Test monthly fee payment deadlines
2. **`fiscal_year_end`** - Test year-end processes (June 30)
3. **`overdue_payments`** - Test debt collection processes
4. **`board_meeting_season`** - Test annual meeting procedures (Sept-Nov)
5. **`energy_reporting_period`** - Test energy consumption tracking
6. **`annual_report_deadline`** - Test regulatory compliance (Dec 31)
7. **`summer_maintenance_season`** - Test maintenance planning
8. **`winter_heating_season`** - Test heating cost management

### Scenario Usage Pattern

1. **Activate Scenario**
   ```typescript
   await actions.activateScenario('fiscal_year_end');
   ```

2. **Run Tests**
   - Test time-dependent business logic
   - Verify calculations and deadlines
   - Check regulatory compliance

3. **Advance Time as Needed**
   ```typescript
   // Test what happens after deadline
   await actions.advanceTime({ days: 5 });
   ```

4. **Reset When Complete**
   ```typescript
   await actions.resetTime();
   ```

## Swedish Regulatory Compliance

### Bostadsrättslagen (BrfL) Requirements
- Annual member meetings with 21-day notice
- Board meetings with 7-day notice
- Financial reporting and audit requirements
- Member register maintenance

### Payment Terms and Interest
- Reference rate from Swedish National Debt Office
- Late payment interest: reference rate + 8% per annum
- Standardized reminder fees: 60, 130, 220 SEK

### Environmental Reporting
- Energy consumption reporting deadlines
- Environmental impact assessments
- Energy certificate compliance

### Tax and Financial Reporting
- Annual report filing by December 31
- Fiscal year typically July 1 - June 30
- K2 or K3 accounting standards

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Description of the error",
  "details": {
    // Additional error details when available
  }
}
```

**Common Error Codes:**
- `400` - Bad request (invalid parameters)
- `500` - Internal server error

## Best Practices

### Time Travel Usage
1. **Always reset after testing** to avoid affecting other tests
2. **Use scenarios** for common test cases instead of manual time setting
3. **Test edge cases** like Swedish holidays and weekends
4. **Verify Swedish timezone** (Europe/Stockholm) for accurate calculations

### Swedish BRF Testing
1. **Test fiscal year boundaries** (June 30 / July 1)
2. **Verify payment deadlines** (month-end due dates)
3. **Check regulatory compliance** (meeting notices, reporting deadlines)
4. **Test seasonal variations** (heating costs, maintenance windows)

### Mock Data Usage
1. **Use realistic amounts** based on Swedish market rates
2. **Test various apartment types** (different sizes and fees)
3. **Include edge cases** (overdue payments, contract renewals)
4. **Verify Swedish formatting** (currency, dates, organization numbers)

## Integration Examples

### Testing Monthly Fee Generation
```typescript
// Activate month-end scenario
await actions.activateScenario('month_end_payment_due');

// Get monthly fees data
const response = await fetch('/api/mock/swedish-brf?feature=monthly-fees');
const { data: monthlyFees } = await response.json();

// Verify calculations
monthlyFees.forEach(fee => {
  expect(fee.totalAmount).toBe(fee.baseFee + fee.parkingFee + fee.storageFee);
  expect(fee.ocrNumber).toMatch(/^\d{10}$/);
  expect(new Date(fee.dueDate).getDate()).toBe(31); // Last day of month
});

// Test overdue scenario
await actions.advanceTime({ days: 15 });

// Verify overdue calculations
const overdueResponse = await fetch('/api/mock/swedish-brf?feature=monthly-fees');
const { data: overdueFees } = await overdueResponse.json();

overdueFees.filter(fee => fee.paymentStatus === 'overdue').forEach(fee => {
  expect(fee.overdueDays).toBeGreaterThan(0);
  expect(fee.lateInterest).toBeGreaterThan(0);
  expect(fee.reminderLevel).toBeGreaterThan(0);
});

// Reset when done
await actions.resetTime();
```

### Testing Board Meeting Compliance
```typescript
// Activate board meeting scenario
await actions.activateScenario('board_meeting_season');

// Get board meetings
const response = await fetch('/api/mock/swedish-brf?feature=board-meetings');
const { data: meetings } = await response.json();

// Test notice requirements
const annualMeeting = meetings.find(m => m.meetingType === 'annual');
expect(annualMeeting.noticeRequiredByDate).toBeDefined();

// Calculate notice period
const noticeDate = new Date(annualMeeting.noticeRequiredByDate);
const meetingDate = new Date(annualMeeting.scheduledDate);
const noticeDays = (meetingDate.getTime() - noticeDate.getTime()) / (1000 * 60 * 60 * 24);
expect(noticeDays).toBeGreaterThanOrEqual(21); // Annual meeting requires 21 days

// Test regular meeting notice
const regularMeeting = meetings.find(m => m.meetingType === 'regular');
const regularNoticeDate = new Date(regularMeeting.noticeRequiredByDate);
const regularMeetingDate = new Date(regularMeeting.scheduledDate);
const regularNoticeDays = (regularMeetingDate.getTime() - regularNoticeDate.getTime()) / (1000 * 60 * 60 * 24);
expect(regularNoticeDays).toBeGreaterThanOrEqual(7); // Regular meetings require 7 days
```

This comprehensive Time Travel API enables thorough testing of all Swedish BRF time-dependent features, ensuring robust and compliant software for Swedish housing cooperatives.