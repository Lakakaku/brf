# BRF Portal - API Specification

## API Overview

The BRF Portal API uses tRPC for type-safe communication between frontend and backend. All endpoints are authenticated using JWT tokens obtained through BankID authentication.

## Base Configuration

```typescript
// Base URL Structure
Production: https://api.brfportal.se
Staging: https://api-staging.brfportal.se
Development: http://localhost:3001

// Headers
Authorization: Bearer ${JWT_TOKEN}
X-Cooperative-ID: ${COOPERATIVE_UUID}
Content-Type: application/json
```

## Authentication with Supabase Auth

### Sign Up with BankID (via Edge Function)

```typescript
// Edge Function handles BankID flow
const { data, error } = await supabase.functions.invoke('bankid-auth', {
  body: {
    action: 'initiate',
    personalNumber: '199001010101',
  },
});

// Poll for completion
const { data: session } = await supabase.functions.invoke('bankid-auth', {
  body: {
    action: 'complete',
    orderRef: data.orderRef,
  },
});

// Session created automatically
```

### Email/Password Fallback

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    data: {
      first_name: 'John',
      last_name: 'Doe',
      cooperative_id: 'uuid',
    },
  },
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
});
```

## Database Operations (Auto-generated REST API)

### Fetch Members

```typescript
// Supabase automatically applies RLS based on auth
const { data, error } = await supabase
  .from('members')
  .select(
    `
    *,
    apartments (
      apartment_number,
      size_sqm,
      monthly_fee
    )
  `
  )
  .eq('is_active', true)
  .order('last_name');

// RLS ensures only cooperative members are returned
```

### Create Document

```typescript
// Upload file to Supabase Storage
const { data: file, error } = await supabase.storage
  .from('documents')
  .upload(`${cooperativeId}/${year}/${filename}`, fileBlob);

// Create database record
const { data, error } = await supabase.from('documents').insert({
  filename: filename,
  storage_path: file.path,
  document_type: 'invoice',
  uploaded_by: userId,
});
```

## Real-time Subscriptions

### Subscribe to Case Updates

```typescript
// Subscribe to changes in cases table
const subscription = supabase
  .channel('cases')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'cases',
    },
    payload => {
      console.log('Case change:', payload);
      // RLS ensures only own cooperative's cases
    }
  )
  .subscribe();
```

### Presence (Online Members)

```typescript
// Track online members
const channel = supabase.channel('online-members');

channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    console.log('Online members:', state);
  })
  .subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
      });
    }
  });
```

## Edge Functions for Complex Operations

### Process Invoice (Edge Function)

```typescript
// Call Edge Function for AI processing
const { data, error } = await supabase.functions.invoke('process-invoice', {
  body: {
    documentId: 'uuid',
    invoiceData: base64String
  }
})

// Returns
{
  success: true,
  extracted: {
    supplier: 'Vattenfall',
    amount: 8453,
    dueDate: '2024-12-15',
    invoiceNumber: 'INV-2024-1234',
    suggestedAccount: '5020'
  }
}
```

### Generate Monthly Fees (Edge Function)

```typescript
const { data, error } = await supabase.functions.invoke('generate-fees', {
  body: {
    year: 2024,
    month: 12
  }
})

// Returns
{
  created: 50,
  totalAmount: 375000,
  fees: [...]
}
```

## Storage Operations

### Upload Document

```typescript
// Direct upload to Supabase Storage
const { data, error } = await supabase.storage
  .from('documents')
  .upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

// Get public URL (if bucket is public)
const { data } = supabase.storage.from('documents').getPublicUrl(path);

// Get signed URL (for private files)
const { data, error } = await supabase.storage
  .from('documents')
  .createSignedUrl(path, 3600); // 1 hour expiry
```

## Error Handling with Supabase

```typescript
// Supabase error structure
if (error) {
  console.error({
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code
  })
}

// Common error codes
- '42501': Insufficient permissions (RLS)
- '23505': Unique violation
- '23503': Foreign key violation
- 'PGRST116': No rows returned
- 'PGRST204': No rows updated
```

## Type Safety with Supabase

```typescript
// Generate TypeScript types from database
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID

import { Database } from '@/types/supabase';

const supabase = createClient<Database>(url, key);

// Now all operations are fully typed
const { data } = await supabase.from('members').select('*');
// data is typed as Member[]
```

## Rate Limiting

Supabase automatically handles rate limiting:

- **Auth**: 30 requests per hour per IP
- **Database**: Based on plan (Free: 500 concurrent connections)
- **Storage**: 100 uploads per second
- **Edge Functions**: 1000 invocations per hour (Free tier)

---

_API Version: 2.0 (Supabase)_
_Last Updated: January 2025_
