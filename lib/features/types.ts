/**
 * Feature Flag System Types
 * TypeScript definitions for the BRF Portal feature flag system
 */

export type FeatureEnvironment = 'all' | 'development' | 'staging' | 'production';

export type FeatureCategory = 'general' | 'auth' | 'payments' | 'documents' | 'bookings' | 'admin' | 'ui' | 'api';

export type FeatureStatus = 'draft' | 'active' | 'archived' | 'deprecated';

export type FeatureTargetType = 'all' | 'percentage' | 'users' | 'roles' | 'apartments';

// Base feature flag interface
export interface FeatureFlag {
  id: string;
  cooperative_id: string | null; // null for global flags
  key: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  environment: FeatureEnvironment;
  target_type: FeatureTargetType;
  target_config: FeatureTargetConfig;
  category: FeatureCategory;
  tags: string[];
  status: FeatureStatus;
  rollout_percentage: number;
  dependencies: string[];
  conflicts: string[];
  testing_notes?: string;
  validation_rules: Record<string, any>;
  created_by: string | null;
  updated_by: string | null;
  enabled_at?: string;
  disabled_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Targeting configuration for different target types
export interface FeatureTargetConfig {
  // For percentage targeting
  percentage?: number;
  
  // For user targeting
  users?: string[];
  user_attributes?: {
    field: string;
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with';
    value: string;
  }[];
  
  // For role targeting
  roles?: string[];
  
  // For apartment targeting
  apartments?: string[];
  apartment_attributes?: {
    field: string;
    operator: 'equals' | 'greater_than' | 'less_than';
    value: string | number;
  }[];
  
  // Time-based targeting
  schedule?: {
    start_date?: string;
    end_date?: string;
    days_of_week?: number[]; // 0 = Sunday, 1 = Monday, etc.
    hours_of_day?: { start: number; end: number }; // 0-23
  };
}

// Feature flag variant for A/B testing
export interface FeatureFlagVariant {
  id: string;
  cooperative_id: string | null;
  feature_flag_id: string;
  key: string;
  name: string;
  description?: string;
  is_control: boolean;
  weight: number; // 0-100
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Feature flag usage log entry
export interface FeatureFlagUsage {
  id: number;
  cooperative_id: string | null;
  feature_flag_id: string;
  feature_key: string;
  user_id: string | null;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  is_enabled: boolean;
  evaluation_reason: string;
  context_data: Record<string, any>;
  evaluation_time_ms?: number;
  created_at: string;
}

// Context for feature flag evaluation
export interface FeatureFlagContext {
  cooperative_id?: string;
  user_id?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    apartment_id?: string;
    [key: string]: any;
  };
  apartment?: {
    id: string;
    number: string;
    floor?: number;
    size_sqm?: number;
    [key: string]: any;
  };
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  timestamp?: Date;
  custom_attributes?: Record<string, any>;
}

// Feature flag evaluation result
export interface FeatureFlagEvaluation {
  flag_key: string;
  is_enabled: boolean;
  variant?: string;
  variant_config?: Record<string, any>;
  reason: string;
  evaluation_time_ms: number;
}

// Predefined BRF feature flags
export interface BRFFeatureFlags {
  // Authentication features
  'two_factor_auth': boolean;
  'social_login': boolean;
  'password_complexity': boolean;
  'session_timeout': boolean;
  
  // Payment features
  'new_payment_system': boolean;
  'payment_reminders': boolean;
  'late_payment_fees': boolean;
  'payment_plans': boolean;
  
  // Document features
  'document_ocr': boolean;
  'digital_signatures': boolean;
  'document_approval_workflow': boolean;
  'bulk_document_upload': boolean;
  
  // Booking features
  'advanced_booking_rules': boolean;
  'booking_payments': boolean;
  'recurring_bookings': boolean;
  'booking_waitlist': boolean;
  
  // Communication features
  'push_notifications': boolean;
  'sms_notifications': boolean;
  'email_templates': boolean;
  'announcement_system': boolean;
  
  // Admin features
  'audit_logging': boolean;
  'advanced_reporting': boolean;
  'data_export': boolean;
  'system_monitoring': boolean;
  
  // UI/UX features
  'dark_mode': boolean;
  'accessibility_mode': boolean;
  'mobile_app': boolean;
  'swedish_language_only': boolean;
}

// Feature flag configuration for BRF-specific features
export const BRF_FEATURE_CONFIGS: Record<keyof BRFFeatureFlags, Partial<FeatureFlag>> = {
  'two_factor_auth': {
    name: 'Tvåfaktorsautentisering',
    description: 'Aktivera tvåfaktorsautentisering för förbättrad säkerhet',
    category: 'auth',
    tags: ['säkerhet', '2fa', 'autentisering'],
  },
  'social_login': {
    name: 'Social inloggning',
    description: 'Tillåt inloggning med BankID, Google, etc.',
    category: 'auth',
    tags: ['bankid', 'google', 'inloggning'],
  },
  'password_complexity': {
    name: 'Komplex lösenordspolicy',
    description: 'Krav på starka lösenord med specialtecken',
    category: 'auth',
    tags: ['lösenord', 'säkerhet'],
  },
  'session_timeout': {
    name: 'Session timeout',
    description: 'Automatisk utloggning efter inaktivitet',
    category: 'auth',
    tags: ['session', 'säkerhet'],
  },
  'new_payment_system': {
    name: 'Nytt betalningssystem',
    description: 'Moderniserat betalningssystem med Swish och kort',
    category: 'payments',
    tags: ['betalning', 'swish', 'kort'],
  },
  'payment_reminders': {
    name: 'Betalningspåminnelser',
    description: 'Automatiska påminnelser för förfallna betalningar',
    category: 'payments',
    tags: ['påminnelser', 'fakturor'],
  },
  'late_payment_fees': {
    name: 'Förseningsavgifter',
    description: 'Automatisk tillämpning av förseningsavgifter',
    category: 'payments',
    tags: ['avgifter', 'förseningar'],
  },
  'payment_plans': {
    name: 'Betalningsplaner',
    description: 'Möjlighet att dela upp betalningar',
    category: 'payments',
    tags: ['betalningsplan', 'delbetalning'],
  },
  'document_ocr': {
    name: 'Dokumentigenkänning (OCR)',
    description: 'Automatisk textigenkänning i dokument',
    category: 'documents',
    tags: ['ocr', 'automatisering'],
  },
  'digital_signatures': {
    name: 'Digitala underskrifter',
    description: 'Elektroniska underskrifter för dokument',
    category: 'documents',
    tags: ['underskrift', 'digital'],
  },
  'document_approval_workflow': {
    name: 'Godkännandeflöde för dokument',
    description: 'Strukturerat godkännandeflöde för viktiga dokument',
    category: 'documents',
    tags: ['godkännande', 'arbetsflöde'],
  },
  'bulk_document_upload': {
    name: 'Massuppladdning av dokument',
    description: 'Ladda upp flera dokument samtidigt',
    category: 'documents',
    tags: ['uppladdning', 'batch'],
  },
  'advanced_booking_rules': {
    name: 'Avancerade bokningsregler',
    description: 'Komplex bokningslogik och regler',
    category: 'bookings',
    tags: ['bokningar', 'regler'],
  },
  'booking_payments': {
    name: 'Bokningsavgifter',
    description: 'Möjlighet att ta betalt för bokningar',
    category: 'bookings',
    tags: ['bokningar', 'avgifter'],
  },
  'recurring_bookings': {
    name: 'Återkommande bokningar',
    description: 'Boka samma tid varje vecka/månad',
    category: 'bookings',
    tags: ['bokningar', 'återkommande'],
  },
  'booking_waitlist': {
    name: 'Kölista för bokningar',
    description: 'Väntelista när tider är fullbokade',
    category: 'bookings',
    tags: ['bokningar', 'kö'],
  },
  'push_notifications': {
    name: 'Push-notifikationer',
    description: 'Direktnotifikationer till mobila enheter',
    category: 'ui',
    tags: ['notifikationer', 'mobil'],
  },
  'sms_notifications': {
    name: 'SMS-notifikationer',
    description: 'Textmeddelanden för viktiga uppdateringar',
    category: 'ui',
    tags: ['sms', 'notifikationer'],
  },
  'email_templates': {
    name: 'E-postmallar',
    description: 'Anpassningsbara mallar för e-post',
    category: 'ui',
    tags: ['e-post', 'mallar'],
  },
  'announcement_system': {
    name: 'Meddelandesystem',
    description: 'Kommunicera meddelanden till alla medlemmar',
    category: 'ui',
    tags: ['meddelanden', 'kommunikation'],
  },
  'audit_logging': {
    name: 'Granskningslogg',
    description: 'Detaljerad loggning av alla systemaktiviteter',
    category: 'admin',
    tags: ['granskning', 'säkerhet'],
  },
  'advanced_reporting': {
    name: 'Avancerad rapportering',
    description: 'Detaljerade rapporter och analytics',
    category: 'admin',
    tags: ['rapporter', 'analytics'],
  },
  'data_export': {
    name: 'Dataexport',
    description: 'Exportera data i olika format (Excel, PDF, etc.)',
    category: 'admin',
    tags: ['export', 'data'],
  },
  'system_monitoring': {
    name: 'Systemövervakning',
    description: 'Övervakning av systemets hälsa och prestanda',
    category: 'admin',
    tags: ['övervakning', 'prestanda'],
  },
  'dark_mode': {
    name: 'Mörkt tema',
    description: 'Mörk bakgrund för bättre användarupplevelse',
    category: 'ui',
    tags: ['tema', 'tillgänglighet'],
  },
  'accessibility_mode': {
    name: 'Tillgänglighetsläge',
    description: 'Förbättrad tillgänglighet för användare med funktionshinder',
    category: 'ui',
    tags: ['tillgänglighet', 'wcag'],
  },
  'mobile_app': {
    name: 'Mobilapp',
    description: 'Dedikerad mobilapplikation',
    category: 'ui',
    tags: ['mobil', 'app'],
  },
  'swedish_language_only': {
    name: 'Endast svenska',
    description: 'Begränsa systemet till endast svenska språket',
    category: 'ui',
    tags: ['språk', 'svenska'],
  },
};