# Feature Flags System - BRF Portal

Ett komplett system för hantering av feature flags (funktionsomkopplare) i BRF Portal som möjliggör säker utrullning, A/B-testning och granulär kontroll över systemfunktioner.

## 🎯 Översikt

Feature flags-systemet ger dig möjlighet att:

- **Säker utrullning**: Rulla ut nya funktioner gradvis till utvalda användare
- **A/B-testning**: Testa olika varianter av funktioner
- **Snabb återkoppling**: Stäng av problematiska funktioner direkt
- **Granulär kontroll**: Rikta funktioner till specifika BRF:er, användare eller roller
- **Testning i produktion**: Testa funktioner med riktiga användare utan risk

## 🏗️ Arkitektur

### Databasschema

Systemet använder tre huvudtabeller:

- `feature_flags`: Huvudtabell för feature flags
- `feature_flag_usage`: Loggning av flag-utvärderingar  
- `feature_flag_variants`: Stöd för A/B-testning

### Komponenter

- **Service Layer** (`lib/features/service.ts`): Kärnlogik för flag-utvärdering
- **React Hooks** (`hooks/useFeatureFlags.ts`): React-integration
- **UI Components** (`components/features/`): Admin-gränssnitt
- **API Routes** (`app/api/features/`): REST API för hantering

## 🚀 Användning

### 1. Grundläggande användning

```tsx
import { useFeatureToggle } from '@/hooks/useFeatureFlags';

function PaymentComponent() {
  const hasNewPaymentSystem = useFeatureToggle('new_payment_system');
  
  return (
    <div>
      {hasNewPaymentSystem ? (
        <NewPaymentInterface />
      ) : (
        <LegacyPaymentInterface />
      )}
    </div>
  );
}
```

### 2. Med kontext

```tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlags';

function BoardMemberFeature() {
  const { isEnabled } = useFeatureFlag('advanced_reporting', {
    cooperative_id: 'brf-123',
    user: {
      id: 'user-456',
      role: 'board',
      email: 'styrelse@brf.se'
    }
  });
  
  if (!isEnabled) return null;
  
  return <AdvancedReports />;
}
```

### 3. Komponentsbaserad gating

```tsx
import FeatureGate from '@/components/features/FeatureGate';

function App() {
  return (
    <FeatureGate 
      feature="dark_mode"
      fallback={<LightTheme />}
    >
      <DarkTheme />
    </FeatureGate>
  );
}
```

### 4. Flera flags samtidigt

```tsx
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

function Dashboard() {
  const { flags } = useFeatureFlags([
    'push_notifications',
    'sms_notifications', 
    'email_templates'
  ]);
  
  return (
    <div>
      {flags.push_notifications && <PushNotifications />}
      {flags.sms_notifications && <SmsSettings />}
      {flags.email_templates && <EmailTemplates />}
    </div>
  );
}
```

## ⚙️ Konfiguration

### Fördefinierade BRF Features

Systemet kommer med fördefinierade feature flags för svenska BRF:er:

```typescript
// Autentisering
'two_factor_auth'        // Tvåfaktorsautentisering
'social_login'           // BankID, Google login
'password_complexity'    // Komplexa lösenordskrav

// Betalningar  
'new_payment_system'     // Swish, kort, moderna betalningar
'payment_reminders'      // Automatiska påminnelser
'late_payment_fees'      // Förseningsavgifter

// Dokument
'document_ocr'           // Automatisk textigenkänning
'digital_signatures'     // Elektroniska underskrifter
'bulk_document_upload'   // Massuppladdning

// Bokningar
'advanced_booking_rules' // Komplexa bokningsregler
'booking_payments'       // Avgifter för bokningar
'recurring_booknings'    // Återkommande bokningar

// UI/UX
'dark_mode'             // Mörkt tema
'accessibility_mode'    // Förbättrad tillgänglighet
'swedish_language_only' // Endast svenska
```

### Målgruppstyper

- **all**: Alla användare
- **percentage**: Procentuell fördelning (t.ex. 25% av användare)
- **users**: Specifika användar-ID:n
- **roles**: Användarroller (member, board, chairman, admin)
- **apartments**: Specifika lägenheter

### Miljöer

- **all**: Alla miljöer
- **development**: Endast utvecklingsmiljö
- **staging**: Endast testmiljö  
- **production**: Endast produktion

## 🎛️ Admin-gränssnitt

Navigera till `/admin/features` för att:

- Skapa och hantera feature flags
- Konfigurera målgrupper och regler
- Övervaka användningsstatistik
- Aktivera/avaktivera flags i realtid

### Funktioner i admin-panelen:

- **Drag & drop** för enkel flagghantering
- **Realtidsfiltrering** efter kategori, status, miljö
- **Bulkoperationer** för hantering av flera flags
- **Fördefinierade mallar** för svenska BRF-funktioner
- **Användningsstatistik** med grafer och metrics

## 📊 Övervakning och analys

### Användningsstatistik

Systemet loggar automatiskt:

- Antal utvärderingar per flag
- Vilka användare som påverkas
- Prestanda (utvärderingstid)
- Felfrekvens

### API för statistik

```typescript
// Hämta statistik för en flag
const stats = await service.getUsageStats(
  'new_payment_system', 
  'brf-123', 
  30 // senaste 30 dagarna
);

console.log(stats.total_evaluations); // Totalt antal utvärderingar
console.log(stats.enabled_evaluations); // Antal gånger aktiverad  
console.log(stats.unique_users); // Unika användare
```

## 🛡️ Säkerhet och prestanda

### Säkerhetsåtgärder

- **Rollbaserad åtkomst**: Endast administratörer kan hantera flags
- **Auditlogg**: All flaggaktivitet loggas
- **Rate limiting**: Begränsar API-anrop
- **Validering**: Strikt validering av flaggkonfiguration

### Prestanda

- **Caching**: Flags cachas för snabb åtkomst
- **Batch-utvärdering**: Utvärdera flera flags samtidigt
- **Asynkron loggning**: Påverkar inte användarupplevelse
- **Indexerade databassökningar**: Optimerad för snabbhet

## 🚀 Deployment

### Steg 1: Databas

```bash
# Kör migreringar för att skapa tabeller
npm run db:migrate
```

### Steg 2: Seed data

```bash
# Lägg till fördefinierade BRF flags (valfritt)
npm run db:seed-features
```

### Steg 3: Miljövariabler

```bash
FEATURE_FLAGS_ENABLED=true
FEATURE_FLAGS_CACHE_TTL=300 # 5 minuter cache
```

## 📚 Exempel och demos

Besök `/admin/features/examples` för interaktiva exempel på:

- Grundläggande feature gating
- Rollbaserad funktionalitet
- A/B-testning
- Flerflagg-logik
- Kontextuell utvärdering

## 🔧 API Reference

### REST Endpoints

- `GET /api/features` - Hämta alla flags
- `POST /api/features` - Skapa ny flag
- `PUT /api/features/:id` - Uppdatera flag  
- `DELETE /api/features/:id` - Ta bort flag
- `POST /api/features/:id/toggle` - Aktivera/avaktivera
- `POST /api/features/evaluate` - Utvärdera flag
- `POST /api/features/evaluate-multiple` - Utvärdera flera flags

### Service Methods

```typescript
const service = getFeatureFlagService();

// Utvärdera flag
await service.evaluate('flag_key', context);

// Kontrollera om aktiverad
await service.isEnabled('flag_key', context);

// Hämta alla flags
await service.getAllFlags('cooperative_id');

// Skapa flag
await service.createFlag(flagData);

// Uppdatera flag  
await service.updateFlag(id, updates);
```

## 🆘 Felsökning

### Vanliga problem

**Q: Flag utvärderas inte som förväntat**
A: Kontrollera att flaggen är aktiv, inte utgången och att målgruppen är korrekt konfigurerad.

**Q: Långsam sidladdning**
A: Kontrollera cache-inställningar och överväg batch-utvärdering av flags.

**Q: Flags visas inte i admin-panelen**
A: Verifiera databasanslutning och att migreringarna körts.

### Debug-läge

```typescript
// Aktivera debug-läge i utveckling
const evaluation = await service.evaluate('flag_key', {
  ...context,
  debug: true
});

console.log(evaluation.reason); // Visa anledning till resultat
```

## 🤝 Bidrag

För att bidra till feature flags-systemet:

1. Skapa en ny branch för din feature
2. Lägg till tester för ny funktionalitet
3. Uppdatera dokumentationen
4. Skapa en pull request

## 📄 Licens

Detta system är en del av BRF Portal och följer projektets licens.

---

**💡 Tips**: Börja med enkla boolean flags och utveckla gradvis mot mer komplexa målgrupper och A/B-testning när ditt team blir bekvämt med systemet.