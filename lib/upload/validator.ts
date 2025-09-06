/**
 * File Validation System for Bulk Uploads
 * Validates files before processing in the BRF Portal
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    sanitized_filename: string;
    file_extension: string;
    estimated_processing_time_seconds: number;
    security_risk_level: 'low' | 'medium' | 'high';
    requires_manual_review: boolean;
  };
}

export interface FileToValidate {
  filename: string;
  size: number;
  mimeType?: string;
  contentType?: string;
  tempPath?: string;
}

export interface ValidationRules {
  max_file_size_mb: number;
  allowed_extensions: string[];
  allowed_mime_types: string[];
  blocked_extensions: string[];
  blocked_mime_types: string[];
  max_filename_length: number;
  require_virus_scan: boolean;
  allow_executable_files: boolean;
  allow_archive_files: boolean;
  max_archive_depth: number;
  require_content_validation: boolean;
}

export class FileValidator {
  private defaultRules: ValidationRules = {
    max_file_size_mb: 100,
    allowed_extensions: [
      // Documents
      'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt',
      // Spreadsheets  
      'xls', 'xlsx', 'ods', 'csv',
      // Presentations
      'ppt', 'pptx', 'odp',
      // Images
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp',
      // Archives (with restrictions)
      'zip', 'rar', '7z', 'tar', 'gz',
    ],
    allowed_mime_types: [
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text',
      'application/rtf',
      'text/plain',
      // Spreadsheets
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet',
      'text/csv',
      // Presentations
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.oasis.opendocument.presentation',
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/webp',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
    ],
    blocked_extensions: [
      // Executables
      'exe', 'com', 'bat', 'cmd', 'scr', 'pif', 'msi', 'app', 'deb', 'rpm',
      // Scripts
      'js', 'vbs', 'ps1', 'sh', 'py', 'pl', 'rb', 'php', 'asp', 'jsp',
      // System files
      'dll', 'sys', 'drv', 'ini', 'cfg', 'reg',
      // Dangerous archives
      'cab', 'ace', 'iso', 'img', 'dmg',
    ],
    blocked_mime_types: [
      'application/x-executable',
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/javascript',
      'text/javascript',
      'application/x-php',
      'application/x-python',
      'application/x-shellscript',
    ],
    max_filename_length: 255,
    require_virus_scan: true,
    allow_executable_files: false,
    allow_archive_files: true,
    max_archive_depth: 3,
    require_content_validation: true,
  };

  constructor(customRules?: Partial<ValidationRules>) {
    if (customRules) {
      this.defaultRules = { ...this.defaultRules, ...customRules };
    }
  }

  /**
   * Validate a single file
   */
  async validateFile(
    file: FileToValidate,
    customRules?: Partial<ValidationRules>
  ): Promise<FileValidationResult> {
    const rules = customRules ? { ...this.defaultRules, ...customRules } : this.defaultRules;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Sanitize filename
    const sanitized_filename = this.sanitizeFilename(file.filename);
    const file_extension = this.getFileExtension(sanitized_filename).toLowerCase();

    // Basic file validation
    const basicValidation = this.validateBasicProperties(file, rules);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);

    // Filename validation
    const filenameValidation = this.validateFilename(sanitized_filename, rules);
    errors.push(...filenameValidation.errors);
    warnings.push(...filenameValidation.warnings);

    // Extension validation
    const extensionValidation = this.validateExtension(file_extension, rules);
    errors.push(...extensionValidation.errors);
    warnings.push(...extensionValidation.warnings);

    // MIME type validation
    const mimeValidation = this.validateMimeType(file.mimeType, file.contentType, rules);
    errors.push(...mimeValidation.errors);
    warnings.push(...mimeValidation.warnings);

    // Content validation (if file path provided)
    if (file.tempPath && rules.require_content_validation) {
      const contentValidation = await this.validateFileContent(file.tempPath, file_extension);
      errors.push(...contentValidation.errors);
      warnings.push(...contentValidation.warnings);
    }

    // Security assessment
    const securityAssessment = this.assessSecurityRisk(file, file_extension, rules);

    // Processing time estimation
    const estimated_processing_time_seconds = this.estimateProcessingTime(file, file_extension);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        sanitized_filename,
        file_extension,
        estimated_processing_time_seconds,
        security_risk_level: securityAssessment.risk_level,
        requires_manual_review: securityAssessment.requires_manual_review,
      },
    };
  }

  /**
   * Validate multiple files in batch
   */
  async validateBatch(files: FileToValidate[]): Promise<{
    valid: boolean;
    file_results: FileValidationResult[];
    batch_errors: string[];
    batch_warnings: string[];
    total_size_mb: number;
    estimated_processing_time_minutes: number;
  }> {
    const file_results: FileValidationResult[] = [];
    const batch_errors: string[] = [];
    const batch_warnings: string[] = [];

    // Validate each file
    for (const file of files) {
      const result = await this.validateFile(file);
      file_results.push(result);
    }

    // Batch-level validations
    const total_size_bytes = files.reduce((sum, file) => sum + file.size, 0);
    const total_size_mb = total_size_bytes / (1024 * 1024);

    // Check total batch size (e.g., max 5GB)
    if (total_size_mb > 5120) {
      batch_errors.push(`Batch size ${total_size_mb.toFixed(2)}MB exceeds maximum of 5GB`);
    }

    // Check for duplicate filenames
    const filenames = files.map(f => this.sanitizeFilename(f.filename));
    const duplicates = filenames.filter((name, index) => filenames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      batch_warnings.push(`Duplicate filenames detected: ${duplicates.join(', ')}`);
    }

    // Estimate total processing time
    const estimated_processing_time_minutes = file_results.reduce(
      (sum, result) => sum + result.metadata.estimated_processing_time_seconds, 0
    ) / 60;

    // Check if batch requires manual review
    const requires_review = file_results.some(r => r.metadata.requires_manual_review);
    if (requires_review) {
      batch_warnings.push('Some files in this batch require manual review');
    }

    return {
      valid: batch_errors.length === 0 && file_results.every(r => r.valid),
      file_results,
      batch_errors,
      batch_warnings,
      total_size_mb,
      estimated_processing_time_minutes,
    };
  }

  /**
   * Validate basic file properties
   */
  private validateBasicProperties(file: FileToValidate, rules: ValidationRules): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // File size validation
    const size_mb = file.size / (1024 * 1024);
    if (size_mb > rules.max_file_size_mb) {
      errors.push(`File size ${size_mb.toFixed(2)}MB exceeds maximum of ${rules.max_file_size_mb}MB`);
    }

    // Zero-byte file check
    if (file.size === 0) {
      errors.push('File is empty (0 bytes)');
    }

    // Very large file warning
    if (size_mb > 50) {
      warnings.push(`Large file detected (${size_mb.toFixed(2)}MB) - processing may take longer`);
    }

    return { errors, warnings };
  }

  /**
   * Validate filename
   */
  private validateFilename(filename: string, rules: ValidationRules): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Length validation
    if (filename.length > rules.max_filename_length) {
      errors.push(`Filename exceeds maximum length of ${rules.max_filename_length} characters`);
    }

    // Empty filename check
    if (!filename.trim()) {
      errors.push('Filename cannot be empty');
    }

    // Invalid characters (Windows/Unix)
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(filename)) {
      errors.push('Filename contains invalid characters');
    }

    // Reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const basename = path.parse(filename).name.toUpperCase();
    if (reservedNames.includes(basename)) {
      errors.push(`Filename '${basename}' is reserved and cannot be used`);
    }

    // Non-ASCII characters warning
    if (!/^[\x20-\x7E]+$/.test(filename)) {
      warnings.push('Filename contains non-ASCII characters - may cause compatibility issues');
    }

    // Multiple dots warning
    if ((filename.match(/\./g) || []).length > 1) {
      warnings.push('Filename contains multiple dots - may cause processing issues');
    }

    return { errors, warnings };
  }

  /**
   * Validate file extension
   */
  private validateExtension(extension: string, rules: ValidationRules): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!extension) {
      warnings.push('File has no extension - content type detection may be unreliable');
      return { errors, warnings };
    }

    // Check blocked extensions
    if (rules.blocked_extensions.includes(extension)) {
      errors.push(`File extension '.${extension}' is not allowed for security reasons`);
    }

    // Check allowed extensions
    if (rules.allowed_extensions.length > 0 && !rules.allowed_extensions.includes(extension)) {
      errors.push(`File extension '.${extension}' is not in the allowed list: ${rules.allowed_extensions.join(', ')}`);
    }

    // Executable file check
    const executableExtensions = ['exe', 'com', 'bat', 'cmd', 'scr', 'pif', 'msi'];
    if (executableExtensions.includes(extension) && !rules.allow_executable_files) {
      errors.push(`Executable file type '.${extension}' is not allowed`);
    }

    // Archive file check
    const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
    if (archiveExtensions.includes(extension)) {
      if (!rules.allow_archive_files) {
        errors.push(`Archive file type '.${extension}' is not allowed`);
      } else {
        warnings.push('Archive files require additional processing and security scanning');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate MIME type
   */
  private validateMimeType(
    mimeType?: string, 
    contentType?: string, 
    rules?: ValidationRules
  ): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rules) return { errors, warnings };

    const typeToCheck = mimeType || contentType;
    
    if (!typeToCheck) {
      warnings.push('No MIME type provided - relying on file extension for validation');
      return { errors, warnings };
    }

    // Clean MIME type (remove charset, etc.)
    const cleanMimeType = typeToCheck.split(';')[0].trim().toLowerCase();

    // Check blocked MIME types
    if (rules.blocked_mime_types.includes(cleanMimeType)) {
      errors.push(`MIME type '${cleanMimeType}' is not allowed for security reasons`);
    }

    // Check allowed MIME types
    if (rules.allowed_mime_types.length > 0 && !rules.allowed_mime_types.includes(cleanMimeType)) {
      errors.push(`MIME type '${cleanMimeType}' is not in the allowed list`);
    }

    // Generic/octet-stream warning
    if (cleanMimeType === 'application/octet-stream') {
      warnings.push('Generic binary MIME type - additional content validation recommended');
    }

    return { errors, warnings };
  }

  /**
   * Validate file content
   */
  private async validateFileContent(filePath: string, extension: string): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if file exists and is readable
      await fs.access(filePath, fs.constants.R_OK);

      // Read first few bytes to check file signature
      const buffer = await fs.readFile(filePath, { flag: 'r' });
      const signature = this.getFileSignature(buffer);

      // Validate file signature against extension
      const signatureValidation = this.validateFileSignature(signature, extension);
      errors.push(...signatureValidation.errors);
      warnings.push(...signatureValidation.warnings);

      // Check for embedded content
      if (this.hasEmbeddedContent(buffer, extension)) {
        warnings.push('File may contain embedded content or macros - requires additional security review');
      }

      // Check file entropy (may indicate encryption/compression)
      const entropy = this.calculateEntropy(buffer.slice(0, 1024)); // First 1KB
      if (entropy > 7.5) {
        warnings.push('File has high entropy - may be encrypted, compressed, or contain binary data');
      }

    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        errors.push('File not found at specified path');
      } else if ((error as any).code === 'EACCES') {
        errors.push('File is not readable');
      } else {
        warnings.push(`Could not validate file content: ${(error as Error).message}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Assess security risk level
   */
  private assessSecurityRisk(
    file: FileToValidate, 
    extension: string, 
    rules: ValidationRules
  ): {
    risk_level: 'low' | 'medium' | 'high';
    requires_manual_review: boolean;
  } {
    let risk_score = 0;

    // Extension-based risk
    const highRiskExtensions = ['exe', 'com', 'bat', 'cmd', 'scr', 'pif', 'js', 'vbs', 'ps1'];
    const mediumRiskExtensions = ['zip', 'rar', '7z', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
    
    if (highRiskExtensions.includes(extension)) {
      risk_score += 3;
    } else if (mediumRiskExtensions.includes(extension)) {
      risk_score += 1;
    }

    // Size-based risk
    const size_mb = file.size / (1024 * 1024);
    if (size_mb > 100) {
      risk_score += 1;
    }

    // MIME type mismatch risk
    if (file.mimeType && file.contentType && file.mimeType !== file.contentType) {
      risk_score += 1;
    }

    // Unknown or generic MIME type
    if (!file.mimeType || file.mimeType === 'application/octet-stream') {
      risk_score += 1;
    }

    // Determine risk level
    let risk_level: 'low' | 'medium' | 'high' = 'low';
    let requires_manual_review = false;

    if (risk_score >= 3) {
      risk_level = 'high';
      requires_manual_review = true;
    } else if (risk_score >= 2) {
      risk_level = 'medium';
      requires_manual_review = size_mb > 50; // Large medium-risk files need review
    }

    return { risk_level, requires_manual_review };
  }

  /**
   * Estimate processing time
   */
  private estimateProcessingTime(file: FileToValidate, extension: string): number {
    const size_mb = file.size / (1024 * 1024);
    let base_time = 2; // 2 seconds base processing time

    // Size-based time (1 second per 10MB)
    base_time += Math.ceil(size_mb / 10);

    // Extension-specific processing time
    const processingTimes: Record<string, number> = {
      // Documents (OCR required)
      'pdf': 5,
      'doc': 3,
      'docx': 3,
      'odt': 3,
      // Images (OCR required)
      'jpg': 3,
      'jpeg': 3,
      'png': 3,
      'tiff': 5,
      // Spreadsheets (data extraction)
      'xls': 4,
      'xlsx': 4,
      'csv': 2,
      // Archives (need extraction)
      'zip': 8,
      'rar': 10,
      '7z': 12,
      // Simple files
      'txt': 1,
    };

    const extensionTime = processingTimes[extension] || 2;
    return base_time + extensionTime;
  }

  /**
   * Helper methods
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Replace invalid chars
      .replace(/\.+/g, '.') // Collapse multiple dots
      .replace(/^\./, '_') // Don't start with dot
      .substring(0, 255); // Truncate to max length
  }

  private getFileExtension(filename: string): string {
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private getFileSignature(buffer: Buffer): string {
    if (buffer.length < 4) return '';
    return buffer.slice(0, 4).toString('hex').toUpperCase();
  }

  private validateFileSignature(signature: string, extension: string): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const knownSignatures: Record<string, string[]> = {
      'pdf': ['25504446'],
      'jpg': ['FFD8FFE0', 'FFD8FFE1', 'FFD8FFE2', 'FFD8FFE3'],
      'jpeg': ['FFD8FFE0', 'FFD8FFE1', 'FFD8FFE2', 'FFD8FFE3'],
      'png': ['89504E47'],
      'zip': ['504B0304', '504B0506', '504B0708'],
      'docx': ['504B0304'], // DOCX is ZIP-based
      'xlsx': ['504B0304'], // XLSX is ZIP-based
    };

    const expectedSignatures = knownSignatures[extension];
    if (expectedSignatures && !expectedSignatures.includes(signature)) {
      warnings.push(`File signature doesn't match extension '.${extension}' - possible format mismatch`);
    }

    return { errors, warnings };
  }

  private hasEmbeddedContent(buffer: Buffer, extension: string): boolean {
    // Simple check for embedded content markers
    const content = buffer.toString('binary');
    
    // Office documents with macros
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
      return content.includes('macro') || content.includes('vba') || content.includes('script');
    }

    // PDFs with JavaScript
    if (extension === 'pdf') {
      return content.includes('/JavaScript') || content.includes('/JS');
    }

    return false;
  }

  private calculateEntropy(buffer: Buffer): number {
    const frequencies: Record<number, number> = {};
    
    // Count byte frequencies
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      frequencies[byte] = (frequencies[byte] || 0) + 1;
    }

    // Calculate Shannon entropy
    let entropy = 0;
    const length = buffer.length;
    
    for (const freq of Object.values(frequencies)) {
      const probability = freq / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }
}