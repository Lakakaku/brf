# Error Logging System - BRF Portal

En omfattande felloggningssystem för BRF-portalen med svensk lokalisering och BRF-specifik kontextualisering.

## Översikt

Det här systemet tillhandahåller komplett felhantering och loggning som är specialanpassad för svenska bostadsrättsföreningar (BRF). Systemet inkluderar automatisk kategorisering, trendanalys, och användarvänliga gränssnitt för felhantering.

## Komponenter

### 1. Databasschema (`/lib/monitoring/error-schema.ts`)
- **error_logs**: Huvudtabell för alla fel med BRF-specifik kontext
- **error_patterns**: Automatisk identifiering av återkommande felmönster  
- **error_notifications**: Hantering av notifieringar och varningar
- **error_metrics**: Aggregerade data för rapporter och dashboards
- **error_suppression_rules**: Konfigurerbara regler för att minska notifikationsbrus

### 2. Error Logger Service (`/lib/monitoring/error-logger.ts`)
Kärnfunktionalitet för felloggning:

```typescript
import { createErrorLogger } from '@/lib/monitoring/error-logger';

const logger = createErrorLogger('cooperative-id');

// Logga fel med BRF-kontext
await logger.logPaymentError('Payment failed for monthly fee', {
  brfContext: 'monthly_fees',
  apartmentId: 'apt_123',
  affectsMembers: true
});

// Allmänna felmeddelanden
await logger.error('Database connection failed', {
  errorCategory: 'database',
  affectsOperations: true
});
```

### 3. Användargränssnitt

#### Error Filters (`/components/errors/ErrorFilters.tsx`)
Avancerat filtrering och sökning:
- Fulltextsökning i felmeddelanden
- Filtrering på felnivå, kategori, BRF-kontext
- Tidsbaserad filtrering
- Påverkansanalys (medlemmar/verksamhet)

#### Error Detail Dialog (`/components/errors/ErrorDetailDialog.tsx`)
Detaljerad felvisning:
- Stack traces och teknisk information
- BRF-specifik kontextinformation
- Upplösningshantering med svenska kommentarer
- Relaterade objekt (lägenheter, ärenden, fakturor)

#### Admin Error Management (`/app/admin/errors/enhanced/page.tsx`)
Huvudinterface för administratörer:
- Realtidsdashboard med nyckeltal
- Kategoriserad felöversikt
- Trendanalys och mönsterigenkänning
- Masshantering av fel

### 4. API Endpoints (`/app/api/admin/errors/route.ts`)
RESTful API för felhantering:
- `GET /api/admin/errors` - Hämta fel med filtrering
- `POST /api/admin/errors` - Logga nytt fel
- `PUT /api/admin/errors?id=...` - Uppdatera fel (lösa/återöppna)
- `DELETE /api/admin/errors?action=...` - Massoperationer

## BRF-specifika funktioner

### Felkategorier
Systemet använder BRF-relevanta kategorier:
- **payment**: Betalningssystem och månadsavgifter
- **document**: Dokumenthantering och godkännanden
- **member_management**: Medlemsregistrering och användarhantering
- **booking**: Bokningssystem för gemensamma utrymmen
- **case_management**: Underhåll och ärendehantering
- **energy**: Energideklarationer och förbrukning
- **contractor**: Entreprenörsbedömning och utvärdering
- **board_meeting**: Styrelsemöten och protokoll
- **queue**: Köhantering för lägenheter

### BRF-kontext
Specifika sammanhang inom BRF-verksamhet:
- `monthly_fees`: Månadsavgifter
- `annual_report`: Årsredovisning
- `energy_declaration`: Energideklaration
- `contractor_evaluation`: Entreprenörsbedömning
- `meeting_protocol`: Mötesprotokoll
- `queue_management`: Köhantering
- `audit_trail`: Revisionsspår

### Regelefterlevnad
- **GDPR-flagging**: Automatisk markering av fel som involverar persondata
- **Revision**: Flagga fel som kräver revisionsspår
- **Regulatorisk påverkan**: Spåra fel som påverkar regelefterlevnad

## Svenska översättningar

Hela systemet är lokaliserat på svenska:
- Alla användarinterfacer och meddelanden
- Felkategorier och BRF-kontext
- Notifikationer och rapporter
- API-svar och felmeddelanden

## Installation och setup

1. **Databasschema** skapas automatiskt via `/lib/database/schema.ts`
2. **Komponenter** är tillgängliga via `/components/errors/index.ts`
3. **API-endpoints** är automatiskt registrerade i Next.js

## Användning

### Grundläggande felloggning
```typescript
import { createErrorLogger } from '@/lib/monitoring/error-logger';

const logger = createErrorLogger('your-cooperative-id');

// Kritiskt fel
await logger.critical('Database corruption detected', {
  brfContext: 'audit_trail',
  affectsOperations: true,
  auditRequired: true
});

// Betalningsfel
await logger.logPaymentError('Swish payment timeout', {
  apartmentId: 'apt_456',
  caseId: 'case_789'
});
```

### API middleware för automatisk felloggning
```typescript
import { withErrorLogging } from '@/lib/monitoring/error-logger';

export default withErrorLogging(async (req, res) => {
  // Din API-logik här
  // Fel loggas automatiskt om exception kastas
});
```

### React komponenter
```typescript
import { ErrorFilters, ErrorDetailDialog } from '@/components/errors';

function MyErrorPage() {
  return (
    <>
      <ErrorFilters 
        filters={filters}
        onFiltersChange={setFilters}
        showAdvanced={true}
      />
      <ErrorDetailDialog 
        error={selectedError}
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        canModify={true}
      />
    </>
  );
}
```

## Prestandaöverväganden

- **Indexering**: Optimerade databas-index för snabba sökningar
- **Retention policies**: Automatisk rensning av gamla fel via triggers
- **Mönsterigenkänning**: Gruppering av liknande fel för att minska datavolym
- **Caching**: Cached aggregated metrics för dashboard-prestanda

## Säkerhet

- **Känslig data**: Möjlighet att dölja känsliga data i stack traces
- **Access control**: Rolbaserad åtkomst till felloggar
- **Audit trail**: Fullständig spårning av vem som löser/ändrar fel
- **GDPR-compliance**: Automatisk flagging och dataretention

## Framtida utveckling

- Machine learning för automatisk felklassificering
- Proaktiva varningar baserat på trender
- Integration med externa system (Slack, Teams)
- Avancerad visualisering och rapportering
- Automatisk lösningsförslag

## Support

För frågor eller problem, kontakta utvecklingsteamet eller skapa en issue i projektets repository.