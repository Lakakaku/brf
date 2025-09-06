/**
 * Enhanced File Type Validation System for Swedish BRF Portal
 * Extends the basic FileValidator with BRF-specific document categorization,
 * MIME type verification, file signature checking, and Swedish language support
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { FileValidator, FileValidationResult, FileToValidate, ValidationRules } from './validator';
import { SwedishMessages, MessageFormatter } from './messages';
import { SecurityScanner, SecurityScanResult, createDevelopmentScanner, createProductionScanner } from './security-scanner';
import { logEvent } from '@/lib/monitoring/events';

// BRF-specific document categories
export type BRFDocumentCategory = 
  | 'invoice'           // Fakturor
  | 'protocol'          // Protokoll
  | 'contract'          // Avtal
  | 'financial_report'  // Ekonomiska rapporter
  | 'technical_report'  // Tekniska rapporter
  | 'insurance'         // Försäkringshandlingar
  | 'legal'            // Juridiska dokument
  | 'maintenance'      // Underhållsdokument
  | 'energy'           // Energideklarationer
  | 'tenant_related'   // Hyresgästrelaterat
  | 'board_materials'  // Styrelsematerial
  | 'general'          // Allmänt dokument
  | 'unknown';         // Okänd kategori

// Enhanced validation rules for BRF documents
export interface BRFValidationRules extends ValidationRules {
  // BRF-specific settings
  enable_ocr_classification: boolean;
  enable_content_analysis: boolean;
  require_swedish_content: boolean;
  enable_pii_detection: boolean;
  
  // Category-specific rules
  category_rules: Record<BRFDocumentCategory, {
    allowed_extensions: string[];
    max_file_size_mb: number;
    require_manual_review: boolean;
    auto_archive_after_days: number;
    enable_full_text_search: boolean;
  }>;
  
  // Security settings
  scan_for_macros: boolean;
  scan_for_embedded_files: boolean;
  check_password_protection: boolean;
  max_embedded_depth: number;
}

export interface BRFValidationResult extends FileValidationResult {
  category: BRFDocumentCategory;
  confidence: number; // 0-100% confidence in categorization
  swedish_content_detected: boolean;
  pii_detected: {
    personal_numbers: boolean;
    addresses: boolean;
    phone_numbers: boolean;
    email_addresses: boolean;
  };
  content_analysis: {
    text_preview: string;
    language_detected: string;
    keywords: string[];
    entities: Array<{
      type: 'person' | 'organization' | 'location' | 'amount' | 'date';
      value: string;
      confidence: number;
    }>;
  };
  security_analysis: {
    has_macros: boolean;
    has_embedded_files: boolean;
    is_password_protected: boolean;
    suspicious_patterns: string[];
  };
  virus_scan_result?: SecurityScanResult;
}

// File signature database with more comprehensive coverage
const FILE_SIGNATURES: Record<string, {
  extensions: string[];
  signatures: string[];
  description: string;
}> = {
  'PDF': {
    extensions: ['pdf'],
    signatures: ['25504446'], // %PDF
    description: 'PDF Document'
  },
  'OFFICE_DOC': {
    extensions: ['doc'],
    signatures: ['D0CF11E0A1B11AE1'], // OLE2 compound document
    description: 'Microsoft Word Document'
  },
  'OFFICE_DOCX': {
    extensions: ['docx', 'xlsx', 'pptx'],
    signatures: ['504B0304'], // ZIP signature (Office 2007+)
    description: 'Microsoft Office Document'
  },
  'JPEG': {
    extensions: ['jpg', 'jpeg'],
    signatures: ['FFD8FFE0', 'FFD8FFE1', 'FFD8FFE2', 'FFD8FFE3', 'FFD8FFDB'],
    description: 'JPEG Image'
  },
  'PNG': {
    extensions: ['png'],
    signatures: ['89504E47'],
    description: 'PNG Image'
  },
  'EXCEL_OLD': {
    extensions: ['xls'],
    signatures: ['D0CF11E0A1B11AE1'], // OLE2
    description: 'Microsoft Excel Spreadsheet'
  },
  'ZIP': {
    extensions: ['zip'],
    signatures: ['504B0304', '504B0506', '504B0708'],
    description: 'ZIP Archive'
  },
  'TIFF': {
    extensions: ['tiff', 'tif'],
    signatures: ['49492A00', '4D4D002A'],
    description: 'TIFF Image'
  }
};

export class BRFFileValidator extends FileValidator {
  private brfRules: BRFValidationRules;
  private securityScanner: SecurityScanner;

  constructor(customRules?: Partial<BRFValidationRules>) {
    // Initialize with BRF-specific defaults
    const brfDefaults: BRFValidationRules = {
      // Base validation rules
      max_file_size_mb: 500, // Increased for BRF documents
      allowed_extensions: [
        // Documents
        'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt',
        // Spreadsheets
        'xls', 'xlsx', 'ods', 'csv',
        // Images (for scanned documents)
        'jpg', 'jpeg', 'png', 'tiff', 'bmp', 'webp',
        // Archives (for bulk submissions)
        'zip', 'rar', '7z'
      ],
      allowed_mime_types: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg', 'image/png', 'image/tiff', 'image/bmp',
        'text/plain', 'text/csv',
        'application/zip'
      ],
      blocked_extensions: [
        'exe', 'com', 'bat', 'cmd', 'scr', 'pif', 'msi',
        'js', 'vbs', 'ps1', 'sh', 'py', 'pl', 'rb', 'php'
      ],
      blocked_mime_types: [
        'application/x-executable',
        'application/x-msdownload',
        'application/javascript',
        'text/javascript'
      ],
      max_filename_length: 255,
      require_virus_scan: true,
      allow_executable_files: false,
      allow_archive_files: true,
      max_archive_depth: 2,
      require_content_validation: true,

      // BRF-specific settings
      enable_ocr_classification: true,
      enable_content_analysis: true,
      require_swedish_content: false, // Optional for flexibility
      enable_pii_detection: true,
      scan_for_macros: true,
      scan_for_embedded_files: true,
      check_password_protection: true,
      max_embedded_depth: 3,

      // Category-specific rules
      category_rules: {
        invoice: {
          allowed_extensions: ['pdf', 'jpg', 'jpeg', 'png', 'tiff'],
          max_file_size_mb: 50,
          require_manual_review: false,
          auto_archive_after_days: 2555, // 7 years (Swedish law)
          enable_full_text_search: true
        },
        protocol: {
          allowed_extensions: ['pdf', 'doc', 'docx'],
          max_file_size_mb: 100,
          require_manual_review: true, // Board protocols need review
          auto_archive_after_days: 3650, // 10 years
          enable_full_text_search: true
        },
        contract: {
          allowed_extensions: ['pdf', 'doc', 'docx'],
          max_file_size_mb: 200,
          require_manual_review: true,
          auto_archive_after_days: 3650, // 10 years
          enable_full_text_search: true
        },
        financial_report: {
          allowed_extensions: ['pdf', 'xls', 'xlsx', 'csv'],
          max_file_size_mb: 100,
          require_manual_review: true,
          auto_archive_after_days: 2555, // 7 years
          enable_full_text_search: true
        },
        technical_report: {
          allowed_extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'tiff'],
          max_file_size_mb: 300,
          require_manual_review: false,
          auto_archive_after_days: 1825, // 5 years
          enable_full_text_search: true
        },
        insurance: {
          allowed_extensions: ['pdf', 'doc', 'docx'],
          max_file_size_mb: 50,
          require_manual_review: false,
          auto_archive_after_days: 2555, // 7 years
          enable_full_text_search: true
        },
        legal: {
          allowed_extensions: ['pdf', 'doc', 'docx'],
          max_file_size_mb: 200,
          require_manual_review: true,
          auto_archive_after_days: 3650, // 10 years
          enable_full_text_search: true
        },
        maintenance: {
          allowed_extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'xls', 'xlsx'],
          max_file_size_mb: 100,
          require_manual_review: false,
          auto_archive_after_days: 1825, // 5 years
          enable_full_text_search: true
        },
        energy: {
          allowed_extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
          max_file_size_mb: 50,
          require_manual_review: false,
          auto_archive_after_days: 3650, // 10 years (energy certificates)
          enable_full_text_search: true
        },
        tenant_related: {
          allowed_extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
          max_file_size_mb: 50,
          require_manual_review: false,
          auto_archive_after_days: 1095, // 3 years
          enable_full_text_search: true
        },
        board_materials: {
          allowed_extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
          max_file_size_mb: 200,
          require_manual_review: true,
          auto_archive_after_days: 3650, // 10 years
          enable_full_text_search: true
        },
        general: {
          allowed_extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'txt'],
          max_file_size_mb: 100,
          require_manual_review: false,
          auto_archive_after_days: 1095, // 3 years
          enable_full_text_search: false
        },
        unknown: {
          allowed_extensions: ['pdf', 'jpg', 'jpeg', 'png'],
          max_file_size_mb: 50,
          require_manual_review: true,
          auto_archive_after_days: 365, // 1 year
          enable_full_text_search: false
        }
      }
    };

    super(brfDefaults);
    this.brfRules = { ...brfDefaults, ...customRules };
    
    // Initialize security scanner
    this.securityScanner = process.env.NODE_ENV === 'production' 
      ? createProductionScanner() 
      : createDevelopmentScanner();
  }

  /**
   * Enhanced validation for BRF documents
   */
  async validateBRFFile(
    file: FileToValidate,
    cooperativeId: string,
    customRules?: Partial<BRFValidationRules>
  ): Promise<BRFValidationResult> {
    const rules = customRules ? { ...this.brfRules, ...customRules } : this.brfRules;
    
    // Start with base validation
    const baseResult = await this.validateFile(file, rules);
    
    // Enhanced BRF validation
    const errors: string[] = [...baseResult.errors];
    const warnings: string[] = [...baseResult.warnings];
    
    // File signature validation
    if (file.tempPath) {
      const signatureResult = await this.validateFileSignatureEnhanced(file.tempPath, baseResult.metadata.file_extension);
      errors.push(...signatureResult.errors);
      warnings.push(...signatureResult.warnings);
    }

    // Document categorization
    const categoryResult = await this.categorizeDocument(file, rules);
    
    // Content analysis (if enabled)
    let contentAnalysis = {
      text_preview: '',
      language_detected: 'sv', // Default to Swedish
      keywords: [] as string[],
      entities: [] as any[]
    };
    
    if (rules.enable_content_analysis && file.tempPath) {
      contentAnalysis = await this.analyzeContent(file.tempPath, baseResult.metadata.file_extension);
    }

    // PII detection
    let piiDetected = {
      personal_numbers: false,
      addresses: false,
      phone_numbers: false,
      email_addresses: false
    };

    if (rules.enable_pii_detection && contentAnalysis.text_preview) {
      piiDetected = this.detectPII(contentAnalysis.text_preview);
    }

    // Security analysis
    let securityAnalysis = {
      has_macros: false,
      has_embedded_files: false,
      is_password_protected: false,
      suspicious_patterns: [] as string[]
    };
    let virusScanResult: SecurityScanResult | undefined;

    if (file.tempPath) {
      securityAnalysis = await this.performSecurityAnalysis(file.tempPath, baseResult.metadata.file_extension, rules);
      
      // Perform virus scan if enabled
      if (rules.require_virus_scan) {
        try {
          virusScanResult = await this.securityScanner.scanFile(file.tempPath, cooperativeId);
          
          // Add virus scan results to errors/warnings
          if (!virusScanResult.clean) {
            const criticalThreats = virusScanResult.threats.filter(t => 
              t.severity === 'critical' || t.severity === 'high' || t.type === 'virus'
            );
            
            if (criticalThreats.length > 0) {
              errors.push(...criticalThreats.map(t => 
                `Säkerhetshot upptäckt: ${t.name} (${t.severity})`
              ));
            } else {
              warnings.push(...virusScanResult.threats.map(t => 
                `Misstänkt innehåll: ${t.name} (${t.severity})`
              ));
            }
          }
        } catch (scanError) {
          warnings.push(`Virusskanning misslyckades: ${scanError instanceof Error ? scanError.message : 'Okänt fel'}`);
        }
      }
    }

    // Swedish content validation
    const swedishContentDetected = this.detectSwedishContent(contentAnalysis.text_preview);
    if (rules.require_swedish_content && !swedishContentDetected) {
      warnings.push('Svenskt innehåll krävs men ej upptäckt');
    }

    // Category-specific validation
    const categorySpecificResult = this.validateCategorySpecific(file, categoryResult.category, rules);
    errors.push(...categorySpecificResult.errors);
    warnings.push(...categorySpecificResult.warnings);

    // Log validation event
    await this.logValidationEvent(cooperativeId, file, {
      category: categoryResult.category,
      confidence: categoryResult.confidence,
      errors: errors.length,
      warnings: warnings.length,
      pii_detected: Object.values(piiDetected).some(v => v),
      security_issues: securityAnalysis.suspicious_patterns.length > 0
    });

    return {
      valid: errors.length === 0,
      errors: errors.map(error => this.translateErrorToSwedish(error)),
      warnings: warnings.map(warning => this.translateWarningToSwedish(warning)),
      metadata: {
        ...baseResult.metadata,
        requires_manual_review: baseResult.metadata.requires_manual_review || 
                               rules.category_rules[categoryResult.category].require_manual_review
      },
      category: categoryResult.category,
      confidence: categoryResult.confidence,
      swedish_content_detected: swedishContentDetected,
      pii_detected: piiDetected,
      content_analysis: contentAnalysis,
      security_analysis: securityAnalysis,
      virus_scan_result: virusScanResult
    };
  }

  /**
   * Enhanced file signature validation
   */
  private async validateFileSignatureEnhanced(filePath: string, extension: string): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const buffer = await fs.readFile(filePath);
      if (buffer.length < 16) {
        warnings.push('Filen är för kort för signaturverifiering');
        return { errors, warnings };
      }

      const signature = buffer.slice(0, 8).toString('hex').toUpperCase();
      
      // Find matching file type
      let expectedType: string | null = null;
      for (const [type, info] of Object.entries(FILE_SIGNATURES)) {
        if (info.extensions.includes(extension)) {
          expectedType = type;
          const matches = info.signatures.some(sig => signature.startsWith(sig));
          if (!matches) {
            warnings.push(`Filsignatur matchar inte förväntat format för .${extension}-filer`);
          }
          break;
        }
      }

      if (!expectedType) {
        warnings.push(`Okänd filtyp för validering: .${extension}`);
      }

    } catch (error) {
      warnings.push(`Kunde inte validera filsignatur: ${error instanceof Error ? error.message : 'Okänt fel'}`);
    }

    return { errors, warnings };
  }

  /**
   * Document categorization using filename patterns and content analysis
   */
  private async categorizeDocument(file: FileToValidate, rules: BRFValidationRules): Promise<{
    category: BRFDocumentCategory;
    confidence: number;
  }> {
    const filename = file.filename.toLowerCase();
    let category: BRFDocumentCategory = 'unknown';
    let confidence = 0;

    // Filename-based categorization (Swedish terms)
    const patterns: Array<{ pattern: RegExp; category: BRFDocumentCategory; confidence: number }> = [
      // Invoices / Fakturor
      { pattern: /faktur|invoice|räkning|bill/, category: 'invoice', confidence: 85 },
      
      // Protocols / Protokoll
      { pattern: /protokoll|meeting|möte|styrelse|board/, category: 'protocol', confidence: 80 },
      
      // Contracts / Avtal
      { pattern: /avtal|contract|överenskomm|agreement/, category: 'contract', confidence: 90 },
      
      // Financial reports / Ekonomiska rapporter
      { pattern: /årsredovisning|bokslut|budget|ekonomi|financial|balans|resultat/, category: 'financial_report', confidence: 85 },
      
      // Technical reports / Tekniska rapporter
      { pattern: /besiktning|inspektion|technical|teknisk|underhåll|maintenance/, category: 'technical_report', confidence: 75 },
      
      // Insurance / Försäkring
      { pattern: /försäkring|insurance|skada|claim/, category: 'insurance', confidence: 80 },
      
      // Legal documents / Juridiska dokument
      { pattern: /juridisk|legal|dom|beslut|föreskrift/, category: 'legal', confidence: 85 },
      
      // Energy certificates / Energideklarationer
      { pattern: /energi|energy|certifikat|deklaration/, category: 'energy', confidence: 90 },
      
      // Tenant related / Hyresgästrelaterat
      { pattern: /hyresgäst|tenant|boende|resident/, category: 'tenant_related', confidence: 80 },
      
      // Board materials / Styrelsematerial
      { pattern: /styrelse|board|kallelse|dagordning|agenda/, category: 'board_materials', confidence: 85 }
    ];

    // Check filename patterns
    for (const { pattern, category: cat, confidence: conf } of patterns) {
      if (pattern.test(filename)) {
        if (conf > confidence) {
          category = cat;
          confidence = conf;
        }
      }
    }

    // If still unknown, try to infer from file extension
    if (category === 'unknown') {
      const extension = file.filename.split('.').pop()?.toLowerCase();
      if (extension === 'pdf') {
        category = 'general';
        confidence = 50;
      } else if (['xls', 'xlsx', 'csv'].includes(extension || '')) {
        category = 'financial_report';
        confidence = 40;
      }
    }

    return { category, confidence };
  }

  /**
   * Content analysis for text extraction and language detection
   */
  private async analyzeContent(filePath: string, extension: string): Promise<{
    text_preview: string;
    language_detected: string;
    keywords: string[];
    entities: Array<{
      type: 'person' | 'organization' | 'location' | 'amount' | 'date';
      value: string;
      confidence: number;
    }>;
  }> {
    // This is a simplified implementation
    // In a real system, you'd integrate with OCR services for images and PDFs
    
    let textContent = '';
    
    try {
      if (extension === 'txt') {
        textContent = await fs.readFile(filePath, 'utf-8');
      } else if (extension === 'pdf') {
        // Placeholder for PDF text extraction
        textContent = '[PDF content extraction would go here]';
      } else if (['jpg', 'jpeg', 'png', 'tiff'].includes(extension)) {
        // Placeholder for OCR
        textContent = '[OCR text extraction would go here]';
      }
    } catch (error) {
      textContent = '';
    }

    const text_preview = textContent.substring(0, 500);
    
    // Simple language detection (Swedish indicators)
    const swedishWords = ['och', 'för', 'att', 'med', 'till', 'från', 'av', 'är', 'på'];
    const language_detected = swedishWords.some(word => 
      text_preview.toLowerCase().includes(word)
    ) ? 'sv' : 'unknown';

    // Extract simple keywords (Swedish context)
    const keywords = this.extractKeywords(text_preview);
    
    // Simple entity extraction
    const entities = this.extractEntities(text_preview);

    return {
      text_preview,
      language_detected,
      keywords,
      entities
    };
  }

  /**
   * PII Detection for Swedish personal data
   */
  private detectPII(text: string): {
    personal_numbers: boolean;
    addresses: boolean;
    phone_numbers: boolean;
    email_addresses: boolean;
  } {
    return {
      // Swedish personal numbers (personnummer)
      personal_numbers: /\d{6}-?\d{4}|\d{8}-?\d{4}/.test(text),
      
      // Swedish addresses (postal codes)
      addresses: /\d{3}\s?\d{2}\s+\w+/.test(text),
      
      // Swedish phone numbers
      phone_numbers: /(\+46|0)\s?7[0-9]\s?\d{3}\s?\d{2}\s?\d{2}/.test(text),
      
      // Email addresses
      email_addresses: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)
    };
  }

  /**
   * Security analysis for malicious content
   */
  private async performSecurityAnalysis(filePath: string, extension: string, rules: BRFValidationRules): Promise<{
    has_macros: boolean;
    has_embedded_files: boolean;
    is_password_protected: boolean;
    suspicious_patterns: string[];
  }> {
    const suspicious_patterns: string[] = [];
    let has_macros = false;
    let has_embedded_files = false;
    let is_password_protected = false;

    try {
      const buffer = await fs.readFile(filePath);
      const content = buffer.toString('binary');

      // Check for macros in Office documents
      if (rules.scan_for_macros && ['doc', 'docx', 'xls', 'xlsx'].includes(extension)) {
        if (content.includes('macro') || content.includes('vba') || content.includes('VBA')) {
          has_macros = true;
          suspicious_patterns.push('Makron upptäckta i dokument');
        }
      }

      // Check for embedded files
      if (rules.scan_for_embedded_files) {
        // Look for common embedded file signatures
        const embeddedSignatures = ['504B0304', '25504446', 'FFD8FF'];
        let signatureCount = 0;
        
        for (let i = 0; i < buffer.length - 4; i++) {
          const sig = buffer.slice(i, i + 4).toString('hex').toUpperCase();
          if (embeddedSignatures.some(s => sig.startsWith(s))) {
            signatureCount++;
          }
        }

        if (signatureCount > 1) {
          has_embedded_files = true;
          suspicious_patterns.push('Inbäddade filer upptäckta');
        }
      }

      // Check for password protection
      if (rules.check_password_protection) {
        if (extension === 'pdf' && content.includes('/Encrypt')) {
          is_password_protected = true;
          suspicious_patterns.push('Lösenordsskyddad PDF');
        }
      }

      // Check for suspicious URLs
      const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
      const urls = content.match(urlPattern);
      if (urls && urls.length > 5) {
        suspicious_patterns.push('Många externa länkar upptäckta');
      }

    } catch (error) {
      suspicious_patterns.push('Kunde inte utföra säkerhetsanalys');
    }

    return {
      has_macros,
      has_embedded_files,
      is_password_protected,
      suspicious_patterns
    };
  }

  /**
   * Helper methods
   */
  private detectSwedishContent(text: string): boolean {
    const swedishIndicators = [
      'och', 'för', 'att', 'med', 'till', 'från', 'av', 'är', 'på', 'som',
      'styrelse', 'protokoll', 'beslut', 'möte', 'faktura', 'avtal'
    ];
    
    const lowercaseText = text.toLowerCase();
    return swedishIndicators.some(word => lowercaseText.includes(word));
  }

  private extractKeywords(text: string): string[] {
    const brfKeywords = [
      'styrelse', 'protokoll', 'beslut', 'budget', 'bokslut', 'avtal',
      'faktura', 'underhåll', 'försäkring', 'hyresgäst', 'lägenheter'
    ];
    
    return brfKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  private extractEntities(text: string): Array<{
    type: 'person' | 'organization' | 'location' | 'amount' | 'date';
    value: string;
    confidence: number;
  }> {
    const entities: Array<{
      type: 'person' | 'organization' | 'location' | 'amount' | 'date';
      value: string;
      confidence: number;
    }> = [];

    // Extract amounts (SEK)
    const amountMatches = text.match(/\d+\s*kr|\d+\s*SEK|\d+:\d+/gi);
    if (amountMatches) {
      amountMatches.forEach(match => {
        entities.push({
          type: 'amount',
          value: match,
          confidence: 80
        });
      });
    }

    // Extract dates (Swedish format)
    const dateMatches = text.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}-\d{4}/g);
    if (dateMatches) {
      dateMatches.forEach(match => {
        entities.push({
          type: 'date',
          value: match,
          confidence: 90
        });
      });
    }

    return entities;
  }

  private validateCategorySpecific(
    file: FileToValidate, 
    category: BRFDocumentCategory, 
    rules: BRFValidationRules
  ): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const categoryRule = rules.category_rules[category];
    const extension = file.filename.split('.').pop()?.toLowerCase() || '';
    const sizeMB = file.size / (1024 * 1024);

    // Check extension against category rules
    if (!categoryRule.allowed_extensions.includes(extension)) {
      errors.push(`Filtyp .${extension} är inte tillåten för kategori "${category}"`);
    }

    // Check size against category limits
    if (sizeMB > categoryRule.max_file_size_mb) {
      errors.push(`Filstorlek ${sizeMB.toFixed(2)}MB överstiger gränsen ${categoryRule.max_file_size_mb}MB för kategori "${category}"`);
    }

    return { errors, warnings };
  }

  private translateErrorToSwedish(error: string): string {
    // Map common English errors to Swedish
    const translations: Record<string, string> = {
      'File size exceeds maximum': 'Filstorleken överstiger maximalt tillåten storlek',
      'File extension not allowed': 'Filändelsen är inte tillåten',
      'Invalid filename': 'Ogiltigt filnamn',
      'File is empty': 'Filen är tom',
      'MIME type not allowed': 'MIME-typen är inte tillåten'
    };

    for (const [english, swedish] of Object.entries(translations)) {
      if (error.includes(english)) {
        return error.replace(english, swedish);
      }
    }

    return error;
  }

  private translateWarningToSwedish(warning: string): string {
    // Map common English warnings to Swedish
    const translations: Record<string, string> = {
      'Large file detected': 'Stor fil upptäckt',
      'Non-ASCII characters': 'Icke-ASCII tecken',
      'Multiple dots': 'Flera punkter i filnamn',
      'Archive files require additional processing': 'Arkivfiler kräver extra bearbetning'
    };

    for (const [english, swedish] of Object.entries(translations)) {
      if (warning.includes(english)) {
        return warning.replace(english, swedish);
      }
    }

    return warning;
  }

  private async logValidationEvent(cooperativeId: string, file: FileToValidate, metadata: any): Promise<void> {
    try {
      await logEvent({
        cooperative_id: cooperativeId,
        event_type: 'file_validation',
        event_level: 'info',
        event_source: 'brf_file_validator',
        event_message: `File validation completed for ${file.filename}`,
        event_data: {
          filename: file.filename,
          file_size: file.size,
          mime_type: file.mimeType,
          ...metadata
        }
      });
    } catch (error) {
      console.error('Failed to log validation event:', error);
    }
  }
}

// Export convenience function
export function createBRFValidator(rules?: Partial<BRFValidationRules>): BRFFileValidator {
  return new BRFFileValidator(rules);
}