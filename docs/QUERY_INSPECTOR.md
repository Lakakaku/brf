# Database Query Inspector System

## Översikt

Query Inspector är ett omfattande system för databasövervakning och analys specifikt utformat för svenska BRF-system (Bostadsrättsföreningar). Systemet säkerställer prestanda, säkerhet, GDPR-efterlevnad och regelefterlevnad för svenska bostadsledningssystem.

## Funktioner

### 🔍 Kärnanfunktioner

- **Realtidsövervakning**: Automatisk loggning och analys av alla databasfrågor
- **Prestandaanalys**: Detaljerad prestandamätning med BRF-specifika benchmarks  
- **Multi-tenant isolering**: Verifiering av dataisolering mellan olika BRF:er
- **GDPR-efterlevnad**: Automatisk kontroll av personuppgiftsskydd
- **Svenska regulations**: Stöd för K2/K3 redovisningsstandarder och Bostadsrättslagen
- **Säkerhetsauditoring**: Kontinuerlig övervakning av säkerhetshot och violations

### 📊 Swedish BRF-Specific Features

- **K2/K3 Compliance**: Säkerställer att finansiella queries följer svenska redovisningsstandarder
- **Bostadsrättslagen (BRL)**: Övervakning av queries relaterade till styrelsearbete och medlemsrättigheter
- **GDPR/Dataskyddsförordningen**: Svenska implementationen av dataskyddsregler
- **Personnummer-skydd**: Speciell hantering av svenska personnummer
- **Energirapportering**: Stöd för svenska energieffektivitetskrav

## Systemarkitektur

```
┌─────────────────────────────────────────────┐
│             Query Inspector                  │
├─────────────────────────────────────────────┤
│  🔧 Engine          │  📊 BRF Analyzer      │
│  - Query Logging    │  - Performance Metrics │
│  - Interception     │  - Swedish Compliance  │
│  - Basic Analysis   │  - Optimization Tips   │
├─────────────────────────────────────────────┤
│  🛡️ Isolation       │  📋 BRF Templates      │
│  - Multi-tenant     │  - Pre-built Queries   │
│  - Security Tests   │  - Swedish Legal Context│
│  - RLS Verification │  - Parameter Validation │
├─────────────────────────────────────────────┤
│  🔒 GDPR Checker    │  📈 Dashboard UI       │
│  - Privacy Analysis │  - Real-time Monitoring │
│  - Legal Basis      │  - Swedish Language     │
│  - Subject Rights   │  - Compliance Reports   │
└─────────────────────────────────────────────┘
```

## Installation och Setup

### 1. Installera systemet

```typescript
import { initializeQueryInspector } from '@/lib/database/query-inspector';

// Initiera med standardkonfiguration
const inspector = await initializeQueryInspector({
  enableLogging: true,
  enableGDPRTracking: true,
  enableIsolationAudit: true,
  slowQueryThresholdMs: 1000,
  logRetentionDays: 90
});
```

### 2. Databasschema

Systemet skapar automatiskt nödvändiga tabeller:

```sql
-- Huvudtabeller
- query_execution_log      -- Alla query-exekveringar
- query_patterns          -- Identifierade mönster
- query_performance_alerts -- Prestanda-varningar

-- Säkerhet och isolation
- tenant_isolation_audit   -- Multi-tenant säkerhetstest
- gdpr_data_access_log    -- GDPR-spårning

-- Analys och optimering
- schema_analysis         -- Databasschemaanalys
```

## Användning

### 1. Grundläggande Query Inspection

```typescript
import { integratedQueryInspector } from '@/lib/database/query-inspector';

// Inspektera en query
const result = await integratedQueryInspector.inspectQuery(
  'SELECT * FROM members WHERE cooperative_id = ? AND email = ?',
  [cooperativeId, email],
  context,
  executionTimeMs,
  rowsAffected
);

console.log('Performance Score:', result.performanceScore);
console.log('GDPR Compliant:', result.complianceStatus.gdprCompliant);
console.log('Recommendations:', result.recommendations);
```

### 2. BRF-Specific Templates

```typescript
// Använd förbygda BRF-mallar
const memberData = await integratedQueryInspector.executeTemplate(
  'member_profile_lookup',
  {
    cooperative_id: 'brf-123',
    member_id: 'member-456'
  },
  context
);

// Få ekonomisk sammanställning
const financialReport = await integratedQueryInspector.executeTemplate(
  'monthly_financial_summary',
  {
    cooperative_id: 'brf-123',
    year: 2024,
    month: 1
  },
  context
);
```

### 3. GDPR Compliance Checking

```typescript
// Kontrollera GDPR-efterlevnad för en query
const gdprCheck = await integratedQueryInspector.checkGDPRCompliance(
  'SELECT personal_number, email FROM queue_positions WHERE cooperative_id = ?',
  [cooperativeId],
  context,
  'queue_management'
);

if (!gdprCheck.compliant) {
  console.log('GDPR Violations:', gdprCheck.violations);
  console.log('Recommendations:', gdprCheck.recommendations);
}
```

### 4. Multi-Tenant Isolation Verification

```typescript
// Verifiera dataisolering mellan BRF:er
const isolationReport = await integratedQueryInspector.verifyIsolation(
  cooperativeId,
  ['member_data_isolation', 'financial_data_isolation']
);

console.log('Overall Status:', isolationReport.overallStatus);
console.log('Critical Issues:', isolationReport.criticalIssues);
```

## Dashboard och Monitoring

### React Dashboard Component

```tsx
import { QueryInspectorDashboard } from '@/components/query-inspector/QueryInspectorDashboard';

function BRFAdminPage() {
  return (
    <div>
      <h1>BRF Databasövervakning</h1>
      <QueryInspectorDashboard cooperativeId={coop.id} />
    </div>
  );
}
```

### Continuous Monitoring

```typescript
// Starta kontinuerlig övervakning
await integratedQueryInspector.startContinuousMonitoring(cooperativeId);

// Schemalägga regelbunden cleanup
setInterval(async () => {
  await integratedQueryInspector.cleanupExpiredLogs();
}, 24 * 60 * 60 * 1000); // Dagligen
```

## BRF-Specific Templates

### Tillgängliga Mallar

#### 1. Medlemshantering
```sql
-- member_profile_lookup
SELECT m.*, a.apartment_number 
FROM members m 
LEFT JOIN apartments a ON m.id = a.owner_id 
WHERE m.cooperative_id = ? AND m.id = ?
```

#### 2. Ekonomi och K2/K3
```sql
-- monthly_financial_summary  
SELECT 'Månadsavgifter' as category, SUM(total_amount) as amount
FROM monthly_fees 
WHERE cooperative_id = ? AND year = ? AND month = ?
UNION ALL
SELECT 'Fakturor', SUM(total_amount) 
FROM invoices 
WHERE cooperative_id = ? AND invoice_date BETWEEN ? AND ?
```

#### 3. Styrelsearbete
```sql
-- board_meeting_agenda_items
SELECT c.title, c.priority, c.status
FROM cases c 
WHERE c.cooperative_id = ? AND c.status IN ('open', 'in_progress')
ORDER BY priority DESC, reported_at
```

### Skapa Egna Mallar

```typescript
const customTemplate: BRFQueryTemplate = {
  id: 'energy_efficiency_report',
  name: 'Energieffektivitetsrapport',
  description: 'Generera energiförbrukningsrapport för miljöredovisning',
  category: 'energiuppföljning',
  sqlTemplate: `
    SELECT 
      year, month,
      AVG(kwh_per_sqm) as avg_consumption,
      (kwh_per_sqm - LAG(kwh_per_sqm) OVER (ORDER BY year, month)) as change
    FROM energy_consumption 
    WHERE cooperative_id = :cooperative_id 
    AND year = :year
  `,
  parameters: [
    {
      name: 'cooperative_id',
      type: 'string', 
      description: 'BRF:s ID',
      required: true
    },
    {
      name: 'year',
      type: 'number',
      description: 'År för rapporten',
      required: true,
      swedishContext: 'Kalendervår för miljörapportering'
    }
  ],
  complianceNotes: {
    gdprRelevant: false,
    k2k3Relevant: false,
    brlCompliance: ['Miljöredovisning enligt plan- och bygglagen']
  },
  swedishLegalContext: {
    applicableLaws: ['Miljöbalken', 'Plan- och bygglagen'],
    riskLevel: 'low',
    dataProtectionImpact: 'Ingen personuppgiftsbehandling'
  }
};
```

## GDPR Compliance Features

### Automatisk Personuppgiftsdetektor

Systemet känner automatiskt igen svenska personuppgifter:
- Personnummer/Personal numbers
- Namn (för- och efternamn)
- E-post och telefonnummer  
- Adressuppgifter
- Bankkontouppgifter

### Legal Basis Validation

```typescript
// Automatisk validering av rättslig grund
const legalBasisCheck = {
  medlemshantering: ['contract', 'legitimate_interests'],
  ekonomi: ['contract', 'legal_obligation'], 
  styrelsearbete: ['legitimate_interests'],
  energiövervakning: ['legitimate_interests', 'legal_obligation']
};
```

### Data Subject Rights

Systemet stödjer alla GDPR-rättigheter:
- Rätt till tillgång (Article 15)
- Rätt till rättelse (Article 16) 
- Rätt till radering (Article 17)
- Rätt till begränsning (Article 18)
- Rätt till dataportabilitet (Article 20)
- Rätt till invändning (Article 21)

## Performance Optimization

### Automatiska Optimeringsrekommendationer

```typescript
// Få optimeringsförslag
const suggestions = integratedQueryInspector.getOptimizationSuggestions('member_profile_lookup');

/*
Exempel-output:
{
  indexRecommendations: [
    'CREATE INDEX idx_members_cooperative_email ON members(cooperative_id, email)',
    'CREATE INDEX idx_apartments_owner ON apartments(owner_id)'  
  ],
  queryOptimizations: [
    'Undvik SELECT * - specificera endast nödvändiga kolumner',
    'Använd LIMIT för stora resultatmängder'
  ],
  cacheStrategies: [
    'Cachea medlemsprofiler i 15 minuter',
    'Använd session-scope cache för användardata'
  ]
}
*/
```

### Performance Benchmarks för BRF

- **Medlemsuppslag**: < 10ms
- **Finansiell sammanställning**: < 100ms  
- **Styrelserapporter**: < 50ms
- **Energirapporter**: < 200ms
- **Kö-hantering**: < 25ms

## Swedish Regulatory Compliance

### K2/K3 Redovisningsstandard

```typescript
// Automatisk kontroll av K2/K3-efterlevnad
const k2k3Check = query.includes('invoices') || query.includes('financial');
if (k2k3Check) {
  // Säkerställ revisionsspår
  auditRequired = true;
  retentionPeriod = '7 years'; // Bokföringslagen
}
```

### Bostadsrättslagen (BRL) 

- **Medlemsregister**: Obligatoriskt att föra enligt BRL
- **Styrelseprotokoll**: Permanent förvaring krävs
- **Ekonomisk redovisning**: Årlig rapportering till medlemmar
- **Ägarregister**: Måste uppdateras vid ägarskifte

### Svenska Myndigheter

- **Integritetsskyddsmyndigheten (IMY)**: GDPR-tillsyn
- **Bolagsverket**: Ekonomisk rapportering
- **Skatteverket**: Skattedeklarationer
- **Boverket**: Bygglov och energicertifiering

## Felsökning och Underhåll

### Hälsokontroll

```typescript
// Kontrollera systemhälsa
const health = await integratedQueryInspector.generateHealthReport();

console.log('Status:', health.status); // 'healthy' | 'warning' | 'critical'
console.log('Checks:', health.checks);

if (health.status !== 'healthy') {
  // Åtgärda problem
  await integratedQueryInspector.initialize();
}
```

### Loggrensning

```typescript
// Automatisk rensning av gamla loggar
const deletedEntries = await integratedQueryInspector.cleanupExpiredLogs();
console.log(`Cleaned up ${deletedEntries} expired entries`);
```

### Prestanda-tuning

```sql
-- Rekommenderade index för optimal prestanda
CREATE INDEX idx_query_execution_cooperative_time ON query_execution_log(cooperative_id, created_at);
CREATE INDEX idx_gdpr_access_retention ON gdpr_data_access_log(retention_until);
CREATE INDEX idx_isolation_audit_status ON tenant_isolation_audit(isolation_status, risk_level);
```

## Integration med Befintliga System

### Med RLS (Row-Level Security)

```typescript
import { createRLSDatabase } from '@/lib/database/rls';

// Query Inspector integreras automatiskt med RLS
const rlsDb = createRLSDatabase(db, context);
// Alla queries loggas automatiskt av inspector
```

### Med Audit System

```typescript
// Audit logs länkas automatiskt till query inspector
auditLogEntry.query_inspector_id = result.queryId;
```

### Med Error Monitoring

```typescript
// Errors från query inspector skickas till monitoring
if (result.violations.length > 0) {
  await errorMonitoring.logSecurityViolation({
    cooperativeId,
    violations: result.violations,
    queryId: result.queryId
  });
}
```

## Säkerhet och Best Practices

### 1. Säker Konfiguration

```typescript
const productionConfig = {
  enableLogging: true,
  enableGDPRTracking: true,
  enableIsolationAudit: true,
  slowQueryThresholdMs: 500, // Strängare i produktion
  memoryWarningThresholdKb: 5120, // 5MB limit
  logRetentionDays: 30, // Kortare retention i produktion
};
```

### 2. Rollbaserad Åtkomst

```typescript
// Begränsa åtkomst till query inspector baserat på användarroll
const hasInspectorAccess = ['admin', 'chairman', 'treasurer'].includes(userRole);

if (!hasInspectorAccess) {
  throw new Error('Insufficient permissions for query inspector');
}
```

### 3. Rate Limiting

```typescript
// Begränsa antal queries per användare
const rateLimitCheck = await rateLimiter.checkLimit(context.user_id, 'query_inspector');
if (!rateLimitCheck.allowed) {
  throw new Error('Rate limit exceeded for query inspector');
}
```

## Vanliga Problem och Lösningar

### Problem: Långsamma Queries
```typescript
// Lösning: Automatiska optimeringsförslag
if (result.performanceScore < 60) {
  console.log('Performance issues detected:', result.recommendations);
  // Implementera föreslagna indexer och optimeringar
}
```

### Problem: GDPR Violations
```typescript
// Lösning: Automatisk violation handling  
if (!result.complianceStatus.gdprCompliant) {
  await handleGDPRViolation(result.violations, context);
  // Blockera query om kritiska violations
}
```

### Problem: Cross-Tenant Data Access
```typescript
// Lösning: Automatisk isolation verification
const isolationResult = await verifyQueryIsolation(query, context);
if (isolationResult.riskLevel === 'critical') {
  await blockUserAccess(context.user_id);
  await notifyAdministrators(isolationResult);
}
```

## API Reference

Se den fullständiga API-dokumentationen för alla klasser och metoder:

- [`QueryInspectorEngine`](./api/QueryInspectorEngine.md) - Huvudmotor för query logging
- [`BRFQueryAnalyzer`](./api/BRFQueryAnalyzer.md) - BRF-specifik prestandaanalys  
- [`MultiTenantIsolationChecker`](./api/MultiTenantIsolationChecker.md) - Multi-tenant säkerhet
- [`BRFQueryTemplateManager`](./api/BRFQueryTemplateManager.md) - BRF query templates
- [`GDPRComplianceChecker`](./api/GDPRComplianceChecker.md) - GDPR-efterlevnad
- [`IntegratedQueryInspector`](./api/IntegratedQueryInspector.md) - Integrerat system

## Support och Utveckling

För support, buggrapporter eller funktionsförfrågningar:

1. Kontrollera befintliga [GitHub Issues](https://github.com/your-org/brf-portal/issues)
2. Skapa en ny issue med detaljerad beskrivning
3. Inkludera query logs och felmeddelanden
4. Specificera BRF-specifika krav eller svenska regulatoriska behov

## Licens

Detta system är utvecklat specifikt för svenska BRF-operationer och följer svensk rätt och GDPR-implementationen i Sverige. Se [LICENSE](../LICENSE) för fullständiga villkor.