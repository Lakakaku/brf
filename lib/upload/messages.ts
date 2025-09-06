/**
 * Swedish Language Messages for Bulk Upload System
 * All user-facing messages in Swedish for the BRF Portal
 */

export const SwedishMessages = {
  // Success messages
  success: {
    BATCH_CREATED: 'Bulk-uppladdning skapad framgångsrikt',
    BATCH_STARTED: 'Bulk-uppladdning startad',
    BATCH_COMPLETED: 'Bulk-uppladdning slutförd',
    FILES_UPLOADED: 'Filer uppladdade framgångsrikt',
    FILES_PROCESSED: 'Filer bearbetade framgångsrikt',
    DUPLICATE_DETECTED: 'Dubblettfil upptäckt och hanterad',
    VALIDATION_PASSED: 'Filvalidering godkänd',
    VIRUS_SCAN_CLEAN: 'Virusskanning slutförd - inga hot upptäckta',
    EMAIL_PROCESSED: 'E-post bearbetad och bifogade filer uppladdade framgångsrikt',
    EMAIL_CONFIRMED: 'E-postuppladdning bekräftad',
    WEBHOOK_VERIFIED: 'E-post webhook verifierad',
  },

  // Error messages
  errors: {
    // General errors
    SYSTEM_ERROR: 'Ett systemfel uppstod. Vänligen försök igen senare.',
    INVALID_REQUEST: 'Ogiltigt förfrågning',
    ACCESS_DENIED: 'Åtkomst nekad',
    AUTHENTICATION_REQUIRED: 'Autentisering krävs',
    INSUFFICIENT_PERMISSIONS: 'Otillräckliga behörigheter för denna åtgärd',
    
    // Batch errors
    BATCH_NOT_FOUND: 'Bulk-uppladdning hittades inte',
    BATCH_ALREADY_STARTED: 'Bulk-uppladdning redan startad',
    BATCH_CANCELLED: 'Bulk-uppladdning avbruten',
    BATCH_FAILED: 'Bulk-uppladdning misslyckades',
    BATCH_SIZE_EXCEEDED: 'Batchstorleken överstiger gränsen',
    MAX_FILES_EXCEEDED: 'Maximalt antal filer överskridet',
    
    // File errors
    FILE_NOT_FOUND: 'Filen hittades inte',
    FILE_TOO_LARGE: 'Filen är för stor',
    FILE_EMPTY: 'Filen är tom',
    FILE_CORRUPTED: 'Filen är skadad',
    FILE_TYPE_NOT_ALLOWED: 'Filtypen är inte tillåten',
    FILENAME_INVALID: 'Ogiltigt filnamn',
    FILENAME_TOO_LONG: 'Filnamnet är för långt',
    
    // Upload errors
    UPLOAD_FAILED: 'Uppladdning misslyckades',
    UPLOAD_INTERRUPTED: 'Uppladdning avbruten',
    UPLOAD_TIMEOUT: 'Uppladdning tog för lång tid',
    UPLOAD_SIZE_MISMATCH: 'Filstorlek stämmer inte överens',
    
    // Processing errors
    PROCESSING_FAILED: 'Bearbetning misslyckades',
    PROCESSING_TIMEOUT: 'Bearbetning tog för lång tid',
    OCR_FAILED: 'OCR-bearbetning misslyckades',
    VIRUS_SCAN_FAILED: 'Virusskanning misslyckades',
    VIRUS_DETECTED: 'Virus upptäckt i filen',
    
    // Validation errors
    VALIDATION_FAILED: 'Filvalidering misslyckades',
    INVALID_FILE_SIGNATURE: 'Ogiltig filsignatur',
    MIME_TYPE_MISMATCH: 'MIME-typ stämmer inte överens med filändelsen',
    SUSPICIOUS_CONTENT: 'Misstänkt innehåll upptäckt i filen',
    
    // BRF-specific validation errors
    CATEGORY_VALIDATION_FAILED: 'Kategorivalidering misslyckades',
    UNSUPPORTED_DOCUMENT_TYPE: 'Dokumenttypen stöds inte för denna kategori',
    SWEDISH_CONTENT_REQUIRED: 'Svenskt innehåll krävs men ej upptäckt',
    PII_DETECTED_ERROR: 'Personuppgifter upptäckta utan tillstånd',
    MACRO_DETECTED: 'Makron upptäckta i dokument - säkerhetsrisk',
    EMBEDDED_FILES_DETECTED: 'Inbäddade filer upptäckta - kräver granskning',
    PASSWORD_PROTECTED_FILE: 'Lösenordsskyddade filer är inte tillåtna',
    CONTENT_ANALYSIS_FAILED: 'Innehållsanalys misslyckades',
    OCR_PROCESSING_FAILED: 'OCR-bearbetning misslyckades',
    DOCUMENT_CORRUPTED: 'Dokumentet verkar vara skadat',
    EXTENSION_MISMATCH: 'Filändelse matchar inte innehållet',
    
    // Duplicate detection errors
    DUPLICATE_NOT_FOUND: 'Dublikat hittades inte',
    DUPLICATE_ALREADY_RESOLVED: 'Dublikat redan löst',
    DUPLICATE_DETECTION_FAILED: 'Dubblettdetektion misslyckades',
    RESOLUTION_FAILED: 'Dublikatlösning misslyckades',
    INVALID_RESOLUTION_ACTION: 'Ogiltig lösningsåtgärd',
    DUPLICATE_GROUP_NOT_FOUND: 'Dubblettgrupp hittades inte',
    CANNOT_RESOLVE_GROUP: 'Kan inte lösa dubblettgrupp automatiskt',
    HASH_CALCULATION_FAILED: 'Hashberäkning misslyckades',
    SIMILARITY_ANALYSIS_FAILED: 'Likhetsanalys misslyckades',
    METADATA_EXTRACTION_FAILED: 'Metadataextrahering misslyckades',
    
    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'För många förfrågningar. Vänligen vänta innan du försöker igen.',
    DAILY_LIMIT_EXCEEDED: 'Daglig gräns för uppladdningar överskriden',
    CONCURRENT_LIMIT_EXCEEDED: 'För många samtidiga uppladdningar',
    
    // Storage errors
    STORAGE_FULL: 'Lagringsutrymme fullt',
    STORAGE_ERROR: 'Lagringsfel uppstod',
    DISK_SPACE_LOW: 'Lågt diskutrymme',
    
    // Network errors
    NETWORK_ERROR: 'Nätverksfel uppstod',
    CONNECTION_TIMEOUT: 'Anslutning tog för lång tid',
    SERVER_UNAVAILABLE: 'Server otillgänglig',
  },

  // Warning messages
  warnings: {
    LARGE_FILE: 'Stor fil - bearbetning kan ta längre tid',
    DUPLICATE_FILENAME: 'Dubblettfilnamn upptäckt',
    NON_ASCII_FILENAME: 'Filnamnet innehåller icke-ASCII tecken',
    MULTIPLE_EXTENSIONS: 'Filnamnet innehåller flera filändelser',
    UNKNOWN_FILE_TYPE: 'Okänd filtyp - extra validering kan krävas',
    HIGH_ENTROPY: 'Filen kan vara krypterad eller komprimerad',
    EMBEDDED_CONTENT: 'Filen kan innehålla inbäddat innehåll eller makron',
    MANUAL_REVIEW_REQUIRED: 'Manuell granskning krävs',
    PROCESSING_DELAY: 'Bearbetning kan ta längre tid än förväntat',
    ARCHIVE_DETECTED: 'Arkivfil - kräver extra bearbetning',
    VIRUS_SCAN_PENDING: 'Virusskanning väntar',
  },

  // Status messages
  status: {
    PENDING: 'Väntar',
    VALIDATING: 'Validerar',
    UPLOADING: 'Laddar upp',
    PROCESSING: 'Bearbetar',
    COMPLETED: 'Slutförd',
    FAILED: 'Misslyckades',
    CANCELLED: 'Avbruten',
    PARTIALLY_COMPLETED: 'Delvis slutförd',
    QUEUED: 'I kö',
    RUNNING: 'Körs',
    PAUSED: 'Pausad',
    EXPIRED: 'Utgången',
    SKIPPED: 'Hoppades över',
    CLEAN: 'Ren',
    INFECTED: 'Infekterad',
    SCANNING: 'Skannar',
    VALID: 'Giltig',
    INVALID: 'Ogiltig',
    APPROVED: 'Godkänd',
    REJECTED: 'Avvisad',
    NEEDS_REVISION: 'Behöver revidering',
    
    // Duplicate detection statuses
    DUPLICATE_DETECTED: 'Dublikat upptäckt',
    DUPLICATE_REVIEWED: 'Dublikat granskat',
    DUPLICATE_RESOLVED: 'Dublikat löst',
    DUPLICATE_IGNORED: 'Dublikat ignorerat',
    FALSE_POSITIVE: 'Falskt positivt',
    EXACT_MATCH: 'Exakt matchning',
    SIMILAR_MATCH: 'Liknande matchning',
    POSSIBLE_DUPLICATE: 'Möjligt dublikat',
    AUTO_RESOLVED: 'Automatiskt löst',
  },

  // Progress messages
  progress: {
    STARTING: 'Startar bulk-uppladdning...',
    VALIDATING_FILES: 'Validerar filer...',
    UPLOADING_FILES: 'Laddar upp filer...',
    PROCESSING_FILES: 'Bearbetar filer...',
    SCANNING_FOR_VIRUSES: 'Skannar efter virus...',
    EXTRACTING_TEXT: 'Extraherar text...',
    CLASSIFYING_DOCUMENTS: 'Klassificerar dokument...',
    GENERATING_THUMBNAILS: 'Genererar miniatyrbilder...',
    FINALIZING: 'Slutför...',
    COMPLETED: 'Slutfört!',
    
    // Duplicate detection progress
    DETECTING_DUPLICATES: 'Söker efter dubbletter...',
    CALCULATING_HASHES: 'Beräknar filhashar...',
    COMPARING_FILES: 'Jämför filer...',
    ANALYZING_CONTENT: 'Analyserar innehåll...',
    GROUPING_DUPLICATES: 'Grupperar dubbletter...',
    RESOLVING_DUPLICATES: 'Löser dubbletter...',
    DUPLICATE_DETECTION_COMPLETED: 'Dublettdetektion slutförd',
  },

  // Notification messages
  notifications: {
    BATCH_READY: 'Din bulk-uppladdning är redo för bearbetning',
    BATCH_PROCESSING: 'Bearbetar din bulk-uppladdning...',
    BATCH_COMPLETED_SUCCESS: 'Bulk-uppladdning slutförd framgångsrikt',
    BATCH_COMPLETED_ERRORS: 'Bulk-uppladdning slutförd med fel',
    BATCH_FAILED: 'Bulk-uppladdning misslyckades',
    MANUAL_REVIEW_NEEDED: 'Vissa filer kräver manuell granskning',
    VIRUS_QUARANTINED: 'Filer med virus har satts i karantän',
    DUPLICATE_DETECTED: 'Dubblettfil upptäckt',
    DUPLICATE_RESOLVED: 'Dublikat löst framgångsrikt',
    DUPLICATE_GROUP_CREATED: 'Dubblettgrupp skapad för manuell granskning',
    AUTO_RESOLUTION_APPLIED: 'Automatisk lösning tillämpades för duplikat',
    MANUAL_REVIEW_DUPLICATE: 'Potentiellt duplikat kräver manuell granskning',
  },

  // File types (Swedish names)
  fileTypes: {
    pdf: 'PDF-dokument',
    doc: 'Word-dokument',
    docx: 'Word-dokument',
    xls: 'Excel-kalkylblad',
    xlsx: 'Excel-kalkylblad',
    ppt: 'PowerPoint-presentation',
    pptx: 'PowerPoint-presentation',
    txt: 'Textfil',
    csv: 'CSV-fil',
    jpg: 'JPEG-bild',
    jpeg: 'JPEG-bild',
    png: 'PNG-bild',
    gif: 'GIF-bild',
    zip: 'ZIP-arkiv',
    rar: 'RAR-arkiv',
  },

  // Time and units
  units: {
    BYTES: 'byte',
    KB: 'KB',
    MB: 'MB',
    GB: 'GB',
    SECOND: 'sekund',
    SECONDS: 'sekunder',
    MINUTE: 'minut',
    MINUTES: 'minuter',
    HOUR: 'timme',
    HOURS: 'timmar',
    FILE: 'fil',
    FILES: 'filer',
    OF: 'av',
    REMAINING: 'kvar',
    ESTIMATED: 'beräknad',
  },

  // API response messages
  api: {
    // Success responses
    BATCH_CREATED_SUCCESS: 'Bulk-uppladdning skapad framgångsrikt',
    FILES_ADDED_SUCCESS: 'Filer tillagda framgångsrikt',
    BATCH_STARTED_SUCCESS: 'Bulk-uppladdning startad framgångsrikt',
    BATCH_CANCELLED_SUCCESS: 'Bulk-uppladdning avbruten framgångsrikt',
    
    // Error responses
    INVALID_JSON: 'Ogiltig JSON-data',
    MISSING_REQUIRED_FIELD: 'Obligatoriskt fält saknas',
    INVALID_FIELD_VALUE: 'Ogiltigt fältvärde',
    INVALID_FILE_DATA: 'Ogiltiga fildata',
    BATCH_LIMIT_REACHED: 'Gräns för antal batches nådd',
    
    // Validation messages
    COOPERATIVE_ID_REQUIRED: 'Kooperativ-ID krävs',
    FILES_REQUIRED: 'Filer krävs',
    VALID_EMAIL_REQUIRED: 'Giltig e-postadress krävs',
    VALID_WEBHOOK_URL_REQUIRED: 'Giltig webhook-URL krävs',
  },

  // Help and instructions
  help: {
    BATCH_CREATION: 'För att skapa en bulk-uppladdning, välj filer och klicka på "Skapa batch"',
    FILE_SELECTION: 'Välj upp till 500 filer med en total storlek på högst 5GB',
    ALLOWED_TYPES: 'Tillåtna filtyper: PDF, Word, Excel, PowerPoint, bilder och textfiler',
    PROCESSING_TIME: 'Bearbetningstiden beror på antal filer och deras storlek',
    MANUAL_REVIEW: 'Vissa filer kan kräva manuell granskning av säkerhetsskäl',
    VIRUS_SCANNING: 'Alla filer skannas automatiskt efter virus',
    PROGRESS_TRACKING: 'Du kan följa framstegen i realtid',
    NOTIFICATIONS: 'Du får meddelanden när bearbetningen är klar',
  },

  // Tooltips and hints
  tooltips: {
    BATCH_NAME: 'Valfritt namn för att identifiera denna batch',
    PROCESSING_MODE: 'Parallell bearbetning är snabbare men använder mer resurser',
    DUPLICATE_HANDLING: 'Hur dubblettfiler ska hanteras',
    VIRUS_SCANNING: 'Aktivera virusskanning för alla filer',
    PRIORITY: 'Högre prioritet innebär snabbare bearbetning',
    WEBHOOK_URL: 'URL som anropas när bearbetningen är klar',
  },
} as const;

// Helper functions for formatting messages
export class MessageFormatter {
  /**
   * Format file size with appropriate units
   */
  static formatFileSize(bytes: number): string {
    const units = ['byte', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    const formatted = unitIndex === 0 ? size.toString() : size.toFixed(1);
    return `${formatted} ${units[unitIndex]}`;
  }

  /**
   * Format processing time
   */
  static formatProcessingTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)} ${seconds === 1 ? SwedishMessages.units.SECOND : SwedishMessages.units.SECONDS}`;
    }
    
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} ${minutes === 1 ? SwedishMessages.units.MINUTE : SwedishMessages.units.MINUTES}`;
    }
    
    const hours = Math.round(minutes / 60);
    return `${hours} ${hours === 1 ? SwedishMessages.units.HOUR : SwedishMessages.units.HOURS}`;
  }

  /**
   * Format progress message
   */
  static formatProgress(completed: number, total: number, currentFile?: string): string {
    const progress = `${completed} ${SwedishMessages.units.OF} ${total} ${SwedishMessages.units.FILES}`;
    
    if (currentFile) {
      return `${progress} - Bearbetar: ${currentFile}`;
    }
    
    return progress;
  }

  /**
   * Format batch summary
   */
  static formatBatchSummary(batch: {
    total_files: number;
    files_completed: number;
    files_failed: number;
    total_size_bytes: number;
  }): string {
    const size = this.formatFileSize(batch.total_size_bytes);
    const success = batch.files_completed;
    const failed = batch.files_failed;
    const total = batch.total_files;
    
    if (failed === 0) {
      return `${success} ${SwedishMessages.units.OF} ${total} ${SwedishMessages.units.FILES} slutförda (${size})`;
    }
    
    return `${success} slutförda, ${failed} misslyckades av ${total} ${SwedishMessages.units.FILES} (${size})`;
  }

  /**
   * Format estimated completion time
   */
  static formatEstimatedCompletion(estimatedSeconds: number): string {
    const formatted = this.formatProcessingTime(estimatedSeconds);
    return `${SwedishMessages.units.ESTIMATED} ${formatted} ${SwedishMessages.units.REMAINING}`;
  }

  /**
   * Get file type display name
   */
  static getFileTypeDisplayName(extension: string): string {
    const fileType = SwedishMessages.fileTypes[extension as keyof typeof SwedishMessages.fileTypes];
    return fileType || `${extension.toUpperCase()}-fil`;
  }

  /**
   * Format error message with context
   */
  static formatErrorWithContext(error: string, context?: {
    filename?: string;
    batch_name?: string;
    operation?: string;
  }): string {
    let message = error;
    
    if (context?.filename) {
      message += ` (Fil: ${context.filename})`;
    }
    
    if (context?.batch_name) {
      message += ` (Batch: ${context.batch_name})`;
    }
    
    if (context?.operation) {
      message += ` (Åtgärd: ${context.operation})`;
    }
    
    return message;
  }

  /**
   * Pluralize Swedish words
   */
  static pluralize(word: string, count: number): string {
    if (count === 1) return word;
    
    // Simple Swedish pluralization rules
    const pluralForms: Record<string, string> = {
      'fil': 'filer',
      'fel': 'fel',
      'varning': 'varningar',
      'batch': 'batches',
      'dokument': 'dokument',
    };
    
    return pluralForms[word] || `${word}ar`;
  }
}

// Export default for convenience
export default SwedishMessages;