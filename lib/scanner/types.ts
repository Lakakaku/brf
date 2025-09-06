/**
 * Scanner Integration Types for BRF Portal
 * Defines types for scanner management, scanning workflows, and device integration
 */

export interface ScannerDevice {
  id: string;
  name: string;
  model: string;
  brand: ScannerBrand;
  ip_address: string;
  mac_address: string;
  status: ScannerStatus;
  capabilities: ScannerCapabilities;
  location?: string;
  cooperative_id: string;
  created_at: string;
  updated_at: string;
  last_seen: string;
}

export type ScannerBrand = 
  | 'Canon'
  | 'Brother' 
  | 'HP'
  | 'Epson'
  | 'Xerox'
  | 'Konica Minolta'
  | 'Sharp'
  | 'Ricoh';

export type ScannerStatus = 
  | 'online'
  | 'offline' 
  | 'scanning'
  | 'error'
  | 'maintenance'
  | 'disabled';

export interface ScannerCapabilities {
  duplex: boolean;
  color: boolean;
  max_dpi: number;
  supported_formats: string[];
  auto_document_feeder: boolean;
  max_batch_size: number;
  ocr_supported: boolean;
  auto_crop: boolean;
  blank_page_detection: boolean;
  document_separation: boolean;
}

export interface ScanJob {
  id: string;
  scanner_id: string;
  cooperative_id: string;
  user_id: string;
  batch_id?: string;
  status: ScanJobStatus;
  settings: ScanSettings;
  pages_scanned: number;
  pages_total?: number;
  files_created: ScanFile[];
  progress_percentage: number;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  estimated_completion?: string;
}

export type ScanJobStatus = 
  | 'queued'
  | 'scanning'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ScanSettings {
  resolution: number; // DPI
  color_mode: 'color' | 'grayscale' | 'monochrome';
  format: 'pdf' | 'jpg' | 'png' | 'tiff';
  duplex: boolean;
  auto_crop: boolean;
  blank_page_removal: boolean;
  document_separation: boolean;
  multi_page_pdf: boolean;
  compression_level: number; // 1-100
  document_type?: BRFDocumentType;
  custom_filename?: string;
}

export type BRFDocumentType = 
  | 'faktura' // Invoice
  | 'protokoll' // Protocol/Minutes
  | 'avtal' // Contract
  | 'underhall' // Maintenance
  | 'ekonomi' // Financial
  | 'forsaking' // Insurance
  | 'juridisk' // Legal
  | 'styrelse' // Board
  | 'medlemmar' // Members
  | 'leverantor' // Suppliers
  | 'ovrigt'; // Other

export interface ScanFile {
  id: string;
  scan_job_id: string;
  filename: string;
  original_filename?: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  page_count?: number;
  resolution: number;
  color_mode: string;
  thumbnail_path?: string;
  ocr_text?: string;
  ocr_confidence?: number;
  document_category?: BRFDocumentType;
  category_confidence?: number;
  upload_status?: 'pending' | 'uploading' | 'completed' | 'failed';
  upload_batch_id?: string;
  created_at: string;
}

export interface ScannerConfiguration {
  id: string;
  scanner_id: string;
  cooperative_id: string;
  name: string;
  is_default: boolean;
  settings: ScanSettings;
  access_permissions: ScannerPermissions;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ScannerPermissions {
  allowed_users?: string[]; // User IDs
  allowed_roles?: string[]; // Member roles
  restricted_hours?: TimeRestriction[];
  max_daily_scans?: number;
  max_scan_pages?: number;
  document_types?: BRFDocumentType[];
}

export interface TimeRestriction {
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  days_of_week: number[]; // 0=Sunday, 1=Monday, etc.
}

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  pages: OCRPage[];
  entities?: ExtractedEntity[];
  document_type?: BRFDocumentType;
  document_confidence?: number;
}

export interface OCRPage {
  page_number: number;
  text: string;
  confidence: number;
  bounding_boxes?: BoundingBox[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
}

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: number;
  bounding_box?: BoundingBox;
}

export type EntityType = 
  | 'invoice_number'
  | 'amount'
  | 'date'
  | 'due_date'
  | 'supplier_name'
  | 'invoice_reference'
  | 'organization_number'
  | 'address'
  | 'phone_number'
  | 'email'
  | 'bank_account';

// Swedish scanner interface messages
export const ScannerMessages = {
  status: {
    ONLINE: 'Ansluten',
    OFFLINE: 'Frånkopplad', 
    SCANNING: 'Skannar',
    ERROR: 'Fel',
    MAINTENANCE: 'Underhåll',
    DISABLED: 'Inaktiverad'
  },
  
  jobStatus: {
    QUEUED: 'I kö',
    SCANNING: 'Skannar',
    PROCESSING: 'Bearbetar',
    COMPLETED: 'Slutförd',
    FAILED: 'Misslyckades',
    CANCELLED: 'Avbruten'
  },
  
  documentTypes: {
    faktura: 'Faktura',
    protokoll: 'Protokoll',
    avtal: 'Avtal',
    underhall: 'Underhåll',
    ekonomi: 'Ekonomi',
    forsaking: 'Försäkring',
    juridisk: 'Juridisk',
    styrelse: 'Styrelse',
    medlemmar: 'Medlemmar',
    leverantor: 'Leverantör',
    ovrigt: 'Övrigt'
  },
  
  errors: {
    SCANNER_NOT_FOUND: 'Skannern hittades inte',
    SCANNER_OFFLINE: 'Skannern är inte ansluten',
    SCANNER_BUSY: 'Skannern används av annan användare',
    PERMISSION_DENIED: 'Du har inte behörighet att använda denna skanner',
    SCAN_FAILED: 'Skanning misslyckades',
    OCR_FAILED: 'Textigenkänning misslyckades',
    INVALID_SETTINGS: 'Ogiltiga skanningsinställningar',
    QUEUE_FULL: 'Skanningskön är full',
    FILE_TOO_LARGE: 'Filen är för stor',
    UNSUPPORTED_FORMAT: 'Format stöds inte',
    NETWORK_ERROR: 'Nätverksfel',
    AUTHENTICATION_FAILED: 'Autentisering misslyckades'
  },
  
  success: {
    SCAN_STARTED: 'Skanning startad',
    SCAN_COMPLETED: 'Skanning slutförd',
    SCAN_CANCELLED: 'Skanning avbruten',
    FILES_UPLOADED: 'Filer uppladdade',
    SCANNER_CONFIGURED: 'Skanner konfigurerad',
    SCANNER_CONNECTED: 'Skanner ansluten'
  },
  
  info: {
    DISCOVERING_SCANNERS: 'Söker efter skannrar...',
    CONNECTING_SCANNER: 'Ansluter till skanner...',
    PREPARING_SCAN: 'Förbereder skanning...',
    PROCESSING_PAGES: 'Bearbetar sidor...',
    EXTRACTING_TEXT: 'Extraherar text...',
    UPLOADING_FILES: 'Laddar upp filer...',
    SCAN_PROGRESS: 'Skannat {current} av {total} sidor'
  }
} as const;

// Mock scanner data for development
export const MOCK_SCANNERS: Omit<ScannerDevice, 'cooperative_id' | 'created_at' | 'updated_at' | 'last_seen'>[] = [
  {
    id: 'canon-ir-adv-c5535i-001',
    name: 'Canon iR-ADV C5535i - Kontor',
    model: 'imageRUNNER ADVANCE C5535i',
    brand: 'Canon',
    ip_address: '192.168.1.101',
    mac_address: '00:1E:8F:12:34:56',
    status: 'online',
    location: 'Huvudkontor',
    capabilities: {
      duplex: true,
      color: true,
      max_dpi: 600,
      supported_formats: ['pdf', 'jpg', 'tiff'],
      auto_document_feeder: true,
      max_batch_size: 100,
      ocr_supported: true,
      auto_crop: true,
      blank_page_detection: true,
      document_separation: true
    }
  },
  {
    id: 'brother-mfc-l2750dw-001',
    name: 'Brother MFC-L2750DW - Reception',
    model: 'MFC-L2750DW',
    brand: 'Brother',
    ip_address: '192.168.1.102',
    mac_address: '00:80:77:98:76:54',
    status: 'online',
    location: 'Reception',
    capabilities: {
      duplex: true,
      color: false,
      max_dpi: 1200,
      supported_formats: ['pdf', 'jpg'],
      auto_document_feeder: true,
      max_batch_size: 50,
      ocr_supported: false,
      auto_crop: false,
      blank_page_detection: false,
      document_separation: false
    }
  },
  {
    id: 'hp-laserjet-pro-m428fdw-001',
    name: 'HP LaserJet Pro M428fdw - Ekonomi',
    model: 'LaserJet Pro M428fdw',
    brand: 'HP',
    ip_address: '192.168.1.103',
    mac_address: '00:25:B3:AB:CD:EF',
    status: 'offline',
    location: 'Ekonomiavdelning',
    capabilities: {
      duplex: true,
      color: false,
      max_dpi: 600,
      supported_formats: ['pdf'],
      auto_document_feeder: true,
      max_batch_size: 30,
      ocr_supported: false,
      auto_crop: true,
      blank_page_detection: true,
      document_separation: false
    }
  }
];

export const DEFAULT_SCAN_SETTINGS: ScanSettings = {
  resolution: 300,
  color_mode: 'color',
  format: 'pdf',
  duplex: true,
  auto_crop: true,
  blank_page_removal: true,
  document_separation: false,
  multi_page_pdf: true,
  compression_level: 80
};