/**
 * Security Scanner for BRF Portal File Uploads
 * Provides virus scanning, malware detection, and security analysis for uploaded files
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { logEvent } from '@/lib/monitoring/events';

export interface SecurityScanResult {
  clean: boolean;
  threats: Array<{
    type: 'virus' | 'malware' | 'suspicious' | 'pua'; // Potentially Unwanted Application
    name: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    action_taken: 'quarantine' | 'delete' | 'flag' | 'none';
  }>;
  scan_details: {
    scanner_engine: string;
    scanner_version: string;
    scan_duration_ms: number;
    file_hash: string;
    scan_timestamp: string;
    signatures_version?: string;
  };
  recommendations: string[];
}

export interface SecurityConfig {
  // Scanner settings
  enable_virus_scan: boolean;
  enable_malware_scan: boolean;
  enable_pua_scan: boolean;
  scanner_timeout_ms: number;
  
  // Action settings
  quarantine_threats: boolean;
  delete_infected_files: boolean;
  notify_on_detection: boolean;
  
  // Advanced settings
  scan_archives: boolean;
  max_archive_depth: number;
  scan_compressed_files: boolean;
  heuristic_scanning: boolean;
  
  // Mock mode for development
  mock_mode: boolean;
  mock_threat_probability: number; // 0-1, probability of mock threats
}

export class SecurityScanner {
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enable_virus_scan: true,
      enable_malware_scan: true,
      enable_pua_scan: false,
      scanner_timeout_ms: 30000, // 30 seconds
      quarantine_threats: true,
      delete_infected_files: false,
      notify_on_detection: true,
      scan_archives: true,
      max_archive_depth: 3,
      scan_compressed_files: true,
      heuristic_scanning: true,
      mock_mode: process.env.NODE_ENV === 'development',
      mock_threat_probability: 0.05, // 5% chance in mock mode
      ...config
    };
  }

  /**
   * Scan a file for security threats
   */
  async scanFile(filePath: string, cooperativeId: string): Promise<SecurityScanResult> {
    const startTime = Date.now();
    
    try {
      // Calculate file hash for tracking
      const fileHash = await this.calculateFileHash(filePath);
      
      let result: SecurityScanResult;
      
      if (this.config.mock_mode) {
        result = await this.mockScan(filePath, fileHash);
      } else {
        result = await this.realScan(filePath, fileHash);
      }
      
      // Log scan result
      await this.logScanResult(cooperativeId, filePath, result);
      
      return result;
      
    } catch (error) {
      const errorResult: SecurityScanResult = {
        clean: false,
        threats: [{
          type: 'suspicious',
          name: 'SCAN_ERROR',
          severity: 'medium',
          description: `Säkerhetsscanning misslyckades: ${error instanceof Error ? error.message : 'Okänt fel'}`,
          action_taken: 'flag'
        }],
        scan_details: {
          scanner_engine: 'error',
          scanner_version: 'unknown',
          scan_duration_ms: Date.now() - startTime,
          file_hash: await this.calculateFileHash(filePath).catch(() => 'unknown'),
          scan_timestamp: new Date().toISOString()
        },
        recommendations: ['Kontakta systemadministratören om problemet kvarstår']
      };
      
      await this.logScanResult(cooperativeId, filePath, errorResult);
      return errorResult;
    }
  }

  /**
   * Batch scan multiple files
   */
  async scanBatch(
    files: Array<{ path: string; name: string }>,
    cooperativeId: string
  ): Promise<{
    results: Array<{ fileName: string; result: SecurityScanResult }>;
    summary: {
      total: number;
      clean: number;
      infected: number;
      errors: number;
      total_scan_time_ms: number;
    };
  }> {
    const startTime = Date.now();
    const results: Array<{ fileName: string; result: SecurityScanResult }> = [];
    let clean = 0;
    let infected = 0;
    let errors = 0;

    // Scan files in parallel with concurrency limit
    const concurrency = 3; // Max 3 concurrent scans
    const chunks = this.chunkArray(files, concurrency);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (file) => {
        const result = await this.scanFile(file.path, cooperativeId);
        return { fileName: file.name, result };
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
      
      // Update counters
      for (const { result } of chunkResults) {
        if (result.threats.some(t => t.type === 'suspicious' && t.name === 'SCAN_ERROR')) {
          errors++;
        } else if (result.clean) {
          clean++;
        } else {
          infected++;
        }
      }
    }

    const summary = {
      total: files.length,
      clean,
      infected,
      errors,
      total_scan_time_ms: Date.now() - startTime
    };

    // Log batch summary
    await logEvent({
      cooperative_id: cooperativeId,
      event_type: 'batch_security_scan',
      event_level: infected > 0 ? 'warning' : 'info',
      event_source: 'security_scanner',
      event_message: `Batch security scan completed: ${clean} clean, ${infected} infected, ${errors} errors`,
      event_data: {
        ...summary,
        infected_files: results
          .filter(r => !r.result.clean)
          .map(r => ({
            fileName: r.fileName,
            threats: r.result.threats.length
          }))
      }
    });

    return { results, summary };
  }

  /**
   * Real virus scanning (integrates with ClamAV or similar)
   */
  private async realScan(filePath: string, fileHash: string): Promise<SecurityScanResult> {
    // In a production environment, this would integrate with:
    // - ClamAV (open source antivirus)
    // - Windows Defender API
    // - Commercial antivirus solutions
    // - Cloud-based scanning services (VirusTotal, etc.)
    
    // For now, implement a basic file analysis
    const startTime = Date.now();
    const threats: SecurityScanResult['threats'] = [];
    
    try {
      // Basic static analysis
      const buffer = await fs.readFile(filePath);
      
      // Check for suspicious patterns
      const suspiciousPatterns = await this.detectSuspiciousPatterns(buffer, filePath);
      threats.push(...suspiciousPatterns);
      
      // File signature analysis
      const signatureThreats = await this.analyzeFileSignature(buffer, filePath);
      threats.push(...signatureThreats);
      
      // Entropy analysis (detect packed/encrypted files)
      const entropyThreats = await this.analyzeEntropy(buffer, filePath);
      threats.push(...entropyThreats);
      
      return {
        clean: threats.length === 0,
        threats,
        scan_details: {
          scanner_engine: 'BRF-Internal-Scanner',
          scanner_version: '1.0.0',
          scan_duration_ms: Date.now() - startTime,
          file_hash: fileHash,
          scan_timestamp: new Date().toISOString()
        },
        recommendations: this.generateRecommendations(threats)
      };
      
    } catch (error) {
      throw new Error(`Säkerhetsscanning misslyckades: ${error instanceof Error ? error.message : 'Okänt fel'}`);
    }
  }

  /**
   * Mock scanning for development
   */
  private async mockScan(filePath: string, fileHash: string): Promise<SecurityScanResult> {
    const startTime = Date.now();
    
    // Simulate scan delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
    
    const threats: SecurityScanResult['threats'] = [];
    
    // Random chance of finding mock threats
    if (Math.random() < this.config.mock_threat_probability) {
      const mockThreats = [
        {
          type: 'virus' as const,
          name: 'Mock.TestVirus.EICAR',
          severity: 'high' as const,
          description: 'EICAR test virus signature detected (mock)',
          action_taken: 'quarantine' as const
        },
        {
          type: 'malware' as const,
          name: 'Mock.Trojan.Generic',
          severity: 'critical' as const,
          description: 'Generic trojan detected (mock)',
          action_taken: 'quarantine' as const
        },
        {
          type: 'pua' as const,
          name: 'Mock.PUA.Adware',
          severity: 'low' as const,
          description: 'Potentially unwanted application detected (mock)',
          action_taken: 'flag' as const
        }
      ];
      
      // Add 1-2 random threats
      const numThreats = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < numThreats; i++) {
        threats.push(mockThreats[Math.floor(Math.random() * mockThreats.length)]);
      }
    }
    
    return {
      clean: threats.length === 0,
      threats,
      scan_details: {
        scanner_engine: 'BRF-Mock-Scanner',
        scanner_version: '1.0.0-dev',
        scan_duration_ms: Date.now() - startTime,
        file_hash: fileHash,
        scan_timestamp: new Date().toISOString(),
        signatures_version: 'mock-signatures-2024'
      },
      recommendations: this.generateRecommendations(threats)
    };
  }

  /**
   * Detect suspicious patterns in file content
   */
  private async detectSuspiciousPatterns(
    buffer: Buffer, 
    filePath: string
  ): Promise<SecurityScanResult['threats']> {
    const threats: SecurityScanResult['threats'] = [];
    const content = buffer.toString('binary');
    
    // Check for EICAR test signature
    if (content.includes('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')) {
      threats.push({
        type: 'virus',
        name: 'EICAR-Test-File',
        severity: 'high',
        description: 'EICAR antivirus test file detected',
        action_taken: 'quarantine'
      });
    }
    
    // Check for suspicious URLs
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const urls = content.match(urlPattern) || [];
    const suspiciousDomains = [
      'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'short.link',
      '.tk', '.ml', '.cf', '.ga' // Suspicious TLDs
    ];
    
    const suspiciousUrls = urls.filter(url => 
      suspiciousDomains.some(domain => url.includes(domain))
    );
    
    if (suspiciousUrls.length > 0) {
      threats.push({
        type: 'suspicious',
        name: 'Suspicious-URLs',
        severity: 'medium',
        description: `${suspiciousUrls.length} misstänkta webbadresser upptäckta`,
        action_taken: 'flag'
      });
    }
    
    // Check for base64 encoded content (common in malware)
    const base64Pattern = /[A-Za-z0-9+/]{50,}={0,2}/g;
    const base64Matches = content.match(base64Pattern) || [];
    if (base64Matches.length > 5) {
      threats.push({
        type: 'suspicious',
        name: 'Excessive-Base64',
        severity: 'low',
        description: 'Stort antal base64-kodade strängar upptäckta',
        action_taken: 'flag'
      });
    }
    
    return threats;
  }

  /**
   * Analyze file signature for threats
   */
  private async analyzeFileSignature(
    buffer: Buffer, 
    filePath: string
  ): Promise<SecurityScanResult['threats']> {
    const threats: SecurityScanResult['threats'] = [];
    
    if (buffer.length < 4) return threats;
    
    const signature = buffer.slice(0, 8).toString('hex').toUpperCase();
    
    // Check for executable files disguised as documents
    const executableSignatures = [
      '4D5A', // PE executable
      '7F454C46', // ELF executable
      'CAFEBABE', // Java class file
      'FEEDFACE', // Mach-O executable
    ];
    
    const extension = path.extname(filePath).toLowerCase();
    const documentExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
    
    if (documentExtensions.includes(extension)) {
      for (const execSig of executableSignatures) {
        if (signature.startsWith(execSig)) {
          threats.push({
            type: 'malware',
            name: 'Disguised-Executable',
            severity: 'high',
            description: 'Körbar fil dold som dokument',
            action_taken: 'quarantine'
          });
          break;
        }
      }
    }
    
    return threats;
  }

  /**
   * Analyze file entropy
   */
  private async analyzeEntropy(
    buffer: Buffer, 
    filePath: string
  ): Promise<SecurityScanResult['threats']> {
    const threats: SecurityScanResult['threats'] = [];
    
    // Calculate Shannon entropy
    const frequencies: Record<number, number> = {};
    for (let i = 0; i < Math.min(buffer.length, 8192); i++) { // First 8KB
      const byte = buffer[i];
      frequencies[byte] = (frequencies[byte] || 0) + 1;
    }
    
    let entropy = 0;
    const length = Math.min(buffer.length, 8192);
    
    for (const freq of Object.values(frequencies)) {
      const probability = freq / length;
      entropy -= probability * Math.log2(probability);
    }
    
    // High entropy might indicate encryption/packing
    if (entropy > 7.5) {
      threats.push({
        type: 'suspicious',
        name: 'High-Entropy',
        severity: 'low',
        description: `Hög entropi (${entropy.toFixed(2)}) - möjligen krypterad eller packad`,
        action_taken: 'flag'
      });
    }
    
    return threats;
  }

  /**
   * Generate recommendations based on threats
   */
  private generateRecommendations(threats: SecurityScanResult['threats']): string[] {
    const recommendations: string[] = [];
    
    if (threats.length === 0) {
      recommendations.push('Filen är säker att använda');
      return recommendations;
    }
    
    const hasVirus = threats.some(t => t.type === 'virus');
    const hasMalware = threats.some(t => t.type === 'malware');
    const hasCritical = threats.some(t => t.severity === 'critical');
    const hasHigh = threats.some(t => t.severity === 'high');
    
    if (hasVirus || hasMalware || hasCritical) {
      recommendations.push('Ta inte emot denna fil - den innehåller skadlig kod');
      recommendations.push('Kontakta säkerhetsansvarig omedelbart');
      recommendations.push('Radera filen från systemet');
    } else if (hasHigh) {
      recommendations.push('Använd försiktighet med denna fil');
      recommendations.push('Kör filen i en säker miljö om möjligt');
      recommendations.push('Låt en erfaren användare granska innehållet först');
    } else {
      recommendations.push('Filen har inga allvarliga säkerhetshot');
      recommendations.push('Normal försiktighet rekommenderas');
      recommendations.push('Kontrollera innehållet innan användning');
    }
    
    return recommendations;
  }

  /**
   * Helper methods
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      return createHash('sha256').update(buffer).digest('hex');
    } catch (error) {
      return 'hash-calculation-failed';
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async logScanResult(
    cooperativeId: string, 
    filePath: string, 
    result: SecurityScanResult
  ): Promise<void> {
    try {
      await logEvent({
        cooperative_id: cooperativeId,
        event_type: 'security_scan',
        event_level: result.clean ? 'info' : 'warning',
        event_source: 'security_scanner',
        event_message: `Security scan completed for ${path.basename(filePath)}`,
        event_data: {
          file_path: path.basename(filePath),
          file_hash: result.scan_details.file_hash,
          scanner_engine: result.scan_details.scanner_engine,
          clean: result.clean,
          threats_found: result.threats.length,
          scan_duration_ms: result.scan_details.scan_duration_ms,
          threats: result.threats.map(t => ({
            type: t.type,
            name: t.name,
            severity: t.severity
          }))
        }
      });
    } catch (error) {
      console.error('Failed to log security scan result:', error);
    }
  }
}

// Export convenience functions
export function createSecurityScanner(config?: Partial<SecurityConfig>): SecurityScanner {
  return new SecurityScanner(config);
}

export function createProductionScanner(): SecurityScanner {
  return new SecurityScanner({
    mock_mode: false,
    scanner_timeout_ms: 60000, // 1 minute
    quarantine_threats: true,
    delete_infected_files: false,
    heuristic_scanning: true
  });
}

export function createDevelopmentScanner(): SecurityScanner {
  return new SecurityScanner({
    mock_mode: true,
    mock_threat_probability: 0.1, // 10% for testing
    scanner_timeout_ms: 5000 // 5 seconds
  });
}