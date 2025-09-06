/**
 * Chunked Upload Validation Middleware
 * Provides validation, assembly, and security checks for chunked uploads
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SwedishMessages } from './messages';
import { validateSingleFile } from './validation-middleware';
import { SecurityScanner, createProductionScanner } from './security-scanner';
import { logEvent } from '@/lib/monitoring/events';

export interface ChunkedValidationConfig {
  maxFileSize?: number; // 500MB default
  maxChunkSize?: number; // 10MB default
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  enableVirusScanning?: boolean;
  enableContentAnalysis?: boolean;
  enableIntegrityVerification?: boolean;
  cooperativeId: string;
  userId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    detectedMimeType?: string;
    fileSignature?: string;
    contentAnalysis?: any;
    virusScanResult?: any;
    integrityVerified?: boolean;
  };
}

export class ChunkedValidationMiddleware {
  private securityScanner: SecurityScanner;
  
  constructor() {
    this.securityScanner = createProductionScanner();
  }

  /**
   * Validate chunk upload request
   */
  async validateChunkUpload(
    request: NextRequest,
    sessionId: string,
    chunkNumber: number,
    config: ChunkedValidationConfig
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate headers
      const contentLength = request.headers.get('content-length');
      const contentType = request.headers.get('content-type');
      const chunkHash = request.headers.get('x-chunk-hash');

      if (!contentLength || parseInt(contentLength) === 0) {
        errors.push(SwedishMessages.errors.FILE_EMPTY);
        return { valid: false, errors, warnings };
      }

      const chunkSize = parseInt(contentLength);
      if (chunkSize > (config.maxChunkSize || 10 * 1024 * 1024)) {
        errors.push(SwedishMessages.errors.FILE_TOO_LARGE);
        return { valid: false, errors, warnings };
      }

      // Validate chunk number
      if (chunkNumber < 0 || !Number.isInteger(chunkNumber)) {
        errors.push('Ogiltigt chunknummer');
        return { valid: false, errors, warnings };
      }

      // Basic validation passed
      return { valid: true, errors, warnings };

    } catch (error) {
      errors.push(SwedishMessages.errors.VALIDATION_FAILED);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate chunk data and integrity
   */
  async validateChunkData(
    chunkData: Buffer,
    expectedHash?: string,
    expectedSize?: number
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: any = {};

    try {
      // Validate size
      if (expectedSize && chunkData.length !== expectedSize) {
        errors.push(SwedishMessages.errors.UPLOAD_SIZE_MISMATCH);
        return { valid: false, errors, warnings };
      }

      // Validate hash if provided
      if (expectedHash) {
        const actualHash = crypto.createHash('sha256').update(chunkData).digest('hex');
        if (actualHash !== expectedHash) {
          errors.push(SwedishMessages.errors.INVALID_FILE_SIGNATURE);
          return { valid: false, errors, warnings };
        }
        metadata.integrityVerified = true;
      }

      // Basic malware scanning on chunk
      if (chunkData.length > 0) {
        const suspiciousPatterns = [
          /(?:eval|exec|system|shell_exec|passthru)\s*\(/gi,
          /<script[^>]*>.*?<\/script>/gi,
          /javascript:/gi,
          /vbscript:/gi,
          /%00/g, // null bytes
        ];

        const chunkText = chunkData.toString('utf8', 0, Math.min(chunkData.length, 4096));
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(chunkText)) {
            warnings.push(SwedishMessages.warnings.EMBEDDED_CONTENT);
            break;
          }
        }
      }

      return { valid: true, errors, warnings, metadata };

    } catch (error) {
      errors.push(SwedishMessages.errors.VALIDATION_FAILED);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate complete file after assembly
   */
  async validateAssembledFile(
    filePath: string,
    originalFilename: string,
    config: ChunkedValidationConfig
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: any = {};

    try {
      // Check if file exists and is readable
      const fileStats = await fs.stat(filePath);
      if (!fileStats.isFile()) {
        errors.push('Filen kunde inte assembleras korrekt');
        return { valid: false, errors, warnings };
      }

      // Validate file size
      if (config.maxFileSize && fileStats.size > config.maxFileSize) {
        errors.push(SwedishMessages.errors.FILE_TOO_LARGE);
        return { valid: false, errors, warnings };
      }

      // Read file for validation
      const fileBuffer = await fs.readFile(filePath);
      
      // Use existing BRF file validation
      const validationResult = await validateSingleFile({
        filename: originalFilename,
        size: fileStats.size,
        mimeType: this.detectMimeType(fileBuffer, originalFilename),
        contentType: this.detectMimeType(fileBuffer, originalFilename),
        buffer: fileBuffer,
      }, {
        cooperativeId: config.cooperativeId,
        userId: config.userId,
        enableIntegrityVerification: config.enableIntegrityVerification,
        enableVirusScanning: config.enableVirusScanning,
        logValidation: true,
      });

      if (!validationResult.success) {
        errors.push(...(validationResult.errors || []));
        return { valid: false, errors, warnings };
      }

      // Additional security scanning
      if (config.enableVirusScanning) {
        try {
          const scanResult = await this.securityScanner.scanFile(filePath, {
            cooperativeId: config.cooperativeId,
            filename: originalFilename,
            fileSize: fileStats.size,
          });

          metadata.virusScanResult = scanResult;

          if (!scanResult.safe) {
            errors.push(SwedishMessages.errors.VIRUS_DETECTED);
            return { valid: false, errors, warnings };
          }

          if (scanResult.warnings.length > 0) {
            warnings.push(...scanResult.warnings);
          }
        } catch (scanError) {
          warnings.push(SwedishMessages.warnings.VIRUS_SCAN_PENDING);
        }
      }

      // File signature validation
      metadata.detectedMimeType = this.detectMimeType(fileBuffer, originalFilename);
      metadata.fileSignature = this.getFileSignature(fileBuffer);

      // Content analysis for BRF documents
      if (config.enableContentAnalysis) {
        try {
          metadata.contentAnalysis = await this.analyzeContent(fileBuffer, originalFilename);
        } catch (analysisError) {
          warnings.push('Innehållsanalys misslyckades');
        }
      }

      return { 
        valid: validationResult.success, 
        errors, 
        warnings: [...warnings, ...(validationResult.warnings || [])], 
        metadata 
      };

    } catch (error) {
      console.error('File validation error:', error);
      errors.push(SwedishMessages.errors.VALIDATION_FAILED);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate session configuration and permissions
   */
  async validateSessionConfig(
    config: {
      cooperativeId: string;
      filename: string;
      fileSize: number;
      chunkSize: number;
      totalChunks: number;
      userId?: string;
    }
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate filename
      if (!config.filename || config.filename.trim().length === 0) {
        errors.push(SwedishMessages.errors.FILENAME_INVALID);
      }

      if (config.filename.length > 255) {
        errors.push(SwedishMessages.errors.FILENAME_TOO_LONG);
      }

      // Check for suspicious filename patterns
      const suspiciousPatterns = [
        /\.(exe|bat|cmd|com|scr|pif|vbs|js)$/i,
        /\.\./,
        /[<>:"|?*]/,
        /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i,
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(config.filename)) {
          errors.push(SwedishMessages.errors.FILENAME_INVALID);
          break;
        }
      }

      // Validate file extension
      const extension = path.extname(config.filename).toLowerCase().slice(1);
      const allowedExtensions = [
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'txt', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'tiff', 'bmp',
        'zip', 'rar', '7z', 'mp4', 'avi', 'mov', 'wmv'
      ];

      if (!allowedExtensions.includes(extension)) {
        errors.push(SwedishMessages.errors.FILE_TYPE_NOT_ALLOWED);
      }

      // Validate file size
      if (config.fileSize <= 0) {
        errors.push(SwedishMessages.errors.FILE_EMPTY);
      }

      if (config.fileSize > 500 * 1024 * 1024) { // 500MB
        errors.push(SwedishMessages.errors.FILE_TOO_LARGE);
      }

      // Validate chunk configuration
      if (config.chunkSize <= 0 || config.chunkSize > 10 * 1024 * 1024) { // Max 10MB chunks
        errors.push('Ogiltig chunkstorlek');
      }

      if (config.totalChunks <= 0 || config.totalChunks > 10000) { // Max 10k chunks
        errors.push('Ogiltigt antal chunks');
      }

      // Verify chunk calculation
      const expectedChunks = Math.ceil(config.fileSize / config.chunkSize);
      if (config.totalChunks !== expectedChunks) {
        errors.push('Felaktig chunkberäkning');
      }

      return { valid: errors.length === 0, errors, warnings };

    } catch (error) {
      errors.push(SwedishMessages.errors.VALIDATION_FAILED);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Cleanup validation - verify all chunks are present and valid
   */
  async validateChunkAssembly(
    sessionId: string,
    storagePath: string,
    totalChunks: number,
    expectedFileSize: number
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      let totalSize = 0;
      const missingChunks: number[] = [];

      // Check each chunk file
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(storagePath, `chunk_${i.toString().padStart(6, '0')}`);
        
        try {
          const chunkStats = await fs.stat(chunkPath);
          if (!chunkStats.isFile()) {
            missingChunks.push(i);
            continue;
          }
          totalSize += chunkStats.size;
        } catch (error) {
          missingChunks.push(i);
        }
      }

      if (missingChunks.length > 0) {
        errors.push(`Saknade chunks: ${missingChunks.join(', ')}`);
        return { valid: false, errors, warnings };
      }

      // Validate total size
      if (totalSize !== expectedFileSize) {
        errors.push(`Storleksmismatchning: förväntad ${expectedFileSize}, faktisk ${totalSize}`);
        return { valid: false, errors, warnings };
      }

      return { valid: true, errors, warnings };

    } catch (error) {
      console.error('Chunk assembly validation error:', error);
      errors.push('Chunk assemblering validering misslyckades');
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Log validation events
   */
  async logValidationEvent(
    cooperativeId: string,
    eventType: 'validation_success' | 'validation_failed' | 'validation_warning',
    eventData: {
      sessionId?: string;
      chunkNumber?: number;
      filename?: string;
      errors?: string[];
      warnings?: string[];
      metadata?: any;
      userId?: string;
      ipAddress?: string;
    }
  ): Promise<void> {
    try {
      await logEvent({
        cooperative_id: cooperativeId,
        event_type: eventType,
        event_level: eventType === 'validation_failed' ? 'error' : 
                   eventType === 'validation_warning' ? 'warning' : 'info',
        event_source: 'chunked_validation_middleware',
        event_message: this.formatValidationMessage(eventType, eventData),
        user_id: eventData.userId,
        request_ip: eventData.ipAddress || 'unknown',
        event_data: {
          session_id: eventData.sessionId,
          chunk_number: eventData.chunkNumber,
          filename: eventData.filename,
          errors: eventData.errors,
          warnings: eventData.warnings,
          metadata: eventData.metadata,
        },
      });
    } catch (error) {
      console.error('Failed to log validation event:', error);
    }
  }

  /**
   * Detect MIME type from file buffer and filename
   */
  private detectMimeType(buffer: Buffer, filename: string): string {
    // File signature detection
    if (buffer.length < 4) return 'application/octet-stream';

    const header = buffer.subarray(0, 8);
    const signature = Array.from(header)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('').toUpperCase();

    // Common file signatures
    const signatures: Record<string, string> = {
      '25504446': 'application/pdf', // PDF
      '504B0304': 'application/zip', // ZIP/Office docs
      'FFD8FFE0': 'image/jpeg',
      'FFD8FFE1': 'image/jpeg',
      '89504E47': 'image/png',
      '47494638': 'image/gif',
      '52494646': 'audio/wav', // RIFF/WAV
    };

    for (const [sig, mimeType] of Object.entries(signatures)) {
      if (signature.startsWith(sig)) {
        return mimeType;
      }
    }

    // Fallback to extension-based detection
    const extension = path.extname(filename).toLowerCase();
    const extensionMimes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
    };

    return extensionMimes[extension] || 'application/octet-stream';
  }

  /**
   * Get file signature as hex string
   */
  private getFileSignature(buffer: Buffer): string {
    const headerSize = Math.min(16, buffer.length);
    return Array.from(buffer.subarray(0, headerSize))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('').toUpperCase();
  }

  /**
   * Analyze file content for BRF-specific patterns
   */
  private async analyzeContent(buffer: Buffer, filename: string): Promise<any> {
    const analysis: any = {
      language: 'unknown',
      documentType: 'unknown',
      hasSwedishContent: false,
      suspiciousContent: [],
      metadata: {},
    };

    try {
      // For text files, analyze content directly
      if (filename.endsWith('.txt') || filename.endsWith('.csv')) {
        const content = buffer.toString('utf8');
        
        // Check for Swedish content
        const swedishPatterns = [
          /\b(och|eller|men|att|för|med|på|av|till|från|är|var|den|det|som|har|hade|inte|bara|också|mycket|stor|liten|bra|dålig)\b/gi,
          /[åäöÅÄÖ]/g,
        ];

        for (const pattern of swedishPatterns) {
          if (pattern.test(content)) {
            analysis.hasSwedishContent = true;
            break;
          }
        }

        // Check document type patterns
        if (/(?:protokoll|möte|beslut|förening)/gi.test(content)) {
          analysis.documentType = 'protocol';
        } else if (/(?:faktura|betalning|kostnad|utgift)/gi.test(content)) {
          analysis.documentType = 'invoice';
        } else if (/(?:kontrakt|avtal|överenskommelse)/gi.test(content)) {
          analysis.documentType = 'contract';
        } else if (/(?:rapport|redovisning|årsredovisning)/gi.test(content)) {
          analysis.documentType = 'report';
        }
      }

      return analysis;
    } catch (error) {
      console.error('Content analysis error:', error);
      return analysis;
    }
  }

  /**
   * Format validation message for logging
   */
  private formatValidationMessage(
    eventType: 'validation_success' | 'validation_failed' | 'validation_warning',
    eventData: any
  ): string {
    const filename = eventData.filename || 'unknown';
    const sessionId = eventData.sessionId || 'unknown';
    
    switch (eventType) {
      case 'validation_success':
        return `Chunked upload validation passed for ${filename} (session: ${sessionId})`;
      case 'validation_failed':
        const errors = eventData.errors?.join(', ') || 'unknown errors';
        return `Chunked upload validation failed for ${filename}: ${errors}`;
      case 'validation_warning':
        const warnings = eventData.warnings?.join(', ') || 'unknown warnings';
        return `Chunked upload validation warnings for ${filename}: ${warnings}`;
      default:
        return `Chunked upload validation event for ${filename}`;
    }
  }
}

// Export singleton instance
let chunkedValidationMiddleware: ChunkedValidationMiddleware;

export function getChunkedValidationMiddleware(): ChunkedValidationMiddleware {
  if (!chunkedValidationMiddleware) {
    chunkedValidationMiddleware = new ChunkedValidationMiddleware();
  }
  return chunkedValidationMiddleware;
}

export default ChunkedValidationMiddleware;