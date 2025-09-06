/**
 * Mock Scanner Service for BRF Portal Development
 * Simulates scanner hardware and scanning operations for testing
 */

import { 
  ScannerDevice, 
  ScanJob, 
  ScanFile, 
  ScanSettings, 
  OCRResult, 
  ExtractedEntity,
  BRFDocumentType,
  ScanJobStatus,
  MOCK_SCANNERS,
  DEFAULT_SCAN_SETTINGS 
} from './types';

export class MockScannerService {
  private scanners: Map<string, ScannerDevice> = new Map();
  private scanJobs: Map<string, ScanJob> = new Map();
  private simulatedDelays = {
    discovery: 2000,
    connection: 1500,
    scanPage: 3000,
    ocrProcessing: 2000,
    upload: 1000
  };

  constructor() {
    this.initializeMockScanners();
  }

  private initializeMockScanners() {
    // Initialize with mock scanners for development
    MOCK_SCANNERS.forEach((mockScanner, index) => {
      const scanner: ScannerDevice = {
        ...mockScanner,
        cooperative_id: 'mock-coop-' + (index + 1),
        created_at: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
      };
      this.scanners.set(scanner.id, scanner);
    });
  }

  /**
   * Discover available scanners on network
   */
  async discoverScanners(cooperativeId: string): Promise<ScannerDevice[]> {
    // Simulate network discovery delay
    await this.delay(this.simulatedDelays.discovery);

    // Return scanners for the cooperative
    const cooperativeScanners = Array.from(this.scanners.values())
      .filter(scanner => scanner.cooperative_id === cooperativeId || scanner.cooperative_id.startsWith('mock-coop'));
    
    // Randomize some scanner statuses for realistic simulation
    cooperativeScanners.forEach(scanner => {
      const random = Math.random();
      if (random > 0.8) {
        scanner.status = 'offline';
      } else if (random > 0.7) {
        scanner.status = 'scanning';
      } else if (random > 0.95) {
        scanner.status = 'error';
      } else {
        scanner.status = 'online';
      }
      scanner.last_seen = new Date().toISOString();
    });

    return cooperativeScanners;
  }

  /**
   * Get scanner details by ID
   */
  async getScanner(scannerId: string): Promise<ScannerDevice | null> {
    await this.delay(100);
    return this.scanners.get(scannerId) || null;
  }

  /**
   * Test scanner connection
   */
  async testConnection(scannerId: string): Promise<boolean> {
    await this.delay(this.simulatedDelays.connection);
    
    const scanner = this.scanners.get(scannerId);
    if (!scanner) return false;
    
    // Simulate connection success/failure based on scanner status
    const success = scanner.status === 'online' || scanner.status === 'scanning';
    
    if (success) {
      scanner.last_seen = new Date().toISOString();
      scanner.status = 'online';
    }
    
    return success;
  }

  /**
   * Start a scanning job
   */
  async startScan(
    scannerId: string, 
    userId: string, 
    cooperativeId: string,
    settings: Partial<ScanSettings> = {},
    batchId?: string
  ): Promise<ScanJob> {
    const scanner = this.scanners.get(scannerId);
    if (!scanner) {
      throw new Error('Scanner not found');
    }

    if (scanner.status !== 'online') {
      throw new Error(`Scanner is ${scanner.status}`);
    }

    // Merge with default settings
    const scanSettings: ScanSettings = {
      ...DEFAULT_SCAN_SETTINGS,
      ...settings
    };

    // Create scan job
    const jobId = `scan-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const scanJob: ScanJob = {
      id: jobId,
      scanner_id: scannerId,
      cooperative_id: cooperativeId,
      user_id: userId,
      batch_id: batchId,
      status: 'queued',
      settings: scanSettings,
      pages_scanned: 0,
      pages_total: this.estimatePageCount(),
      files_created: [],
      progress_percentage: 0,
      created_at: new Date().toISOString()
    };

    this.scanJobs.set(jobId, scanJob);

    // Update scanner status
    scanner.status = 'scanning';

    // Start scanning simulation
    this.simulateScanning(jobId);

    return scanJob;
  }

  /**
   * Get scan job status
   */
  async getScanJob(jobId: string): Promise<ScanJob | null> {
    await this.delay(50);
    return this.scanJobs.get(jobId) || null;
  }

  /**
   * Cancel a scanning job
   */
  async cancelScan(jobId: string): Promise<boolean> {
    const job = this.scanJobs.get(jobId);
    if (!job) return false;

    if (job.status === 'scanning' || job.status === 'queued') {
      job.status = 'cancelled';
      job.completed_at = new Date().toISOString();

      // Free up the scanner
      const scanner = this.scanners.get(job.scanner_id);
      if (scanner) {
        scanner.status = 'online';
      }

      return true;
    }

    return false;
  }

  /**
   * Get scan jobs for a cooperative
   */
  async getScanJobs(cooperativeId: string, limit = 10, offset = 0): Promise<ScanJob[]> {
    await this.delay(100);
    
    const jobs = Array.from(this.scanJobs.values())
      .filter(job => job.cooperative_id === cooperativeId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit);

    return jobs;
  }

  /**
   * Perform OCR on scanned content (mock)
   */
  async performOCR(filePath: string, language = 'sv'): Promise<OCRResult> {
    await this.delay(this.simulatedDelays.ocrProcessing);

    // Generate mock OCR results based on document type
    const documentType = this.detectDocumentType(filePath);
    const mockText = this.generateMockOCRText(documentType);
    
    return {
      text: mockText,
      confidence: 0.85 + Math.random() * 0.14, // 85-99% confidence
      language: language,
      pages: [
        {
          page_number: 1,
          text: mockText,
          confidence: 0.87 + Math.random() * 0.12
        }
      ],
      entities: this.extractMockEntities(documentType),
      document_type: documentType,
      document_confidence: 0.75 + Math.random() * 0.24
    };
  }

  private async simulateScanning(jobId: string) {
    const job = this.scanJobs.get(jobId);
    if (!job) return;

    try {
      // Start scanning
      job.status = 'scanning';
      job.started_at = new Date().toISOString();

      const totalPages = job.pages_total || this.estimatePageCount();
      
      for (let page = 1; page <= totalPages; page++) {
        // Check if job was cancelled
        const currentJob = this.scanJobs.get(jobId);
        if (!currentJob || currentJob.status === 'cancelled') {
          return;
        }

        // Simulate scanning each page
        await this.delay(this.simulatedDelays.scanPage);
        
        job.pages_scanned = page;
        job.progress_percentage = Math.round((page / totalPages) * 100);

        // Create scanned file
        const scanFile = await this.createMockScanFile(job, page);
        job.files_created.push(scanFile);
      }

      // Processing phase
      job.status = 'processing';

      // Simulate OCR processing if enabled
      if (job.settings.document_type && job.scanner_id.includes('canon')) {
        for (const file of job.files_created) {
          const ocrResult = await this.performOCR(file.file_path);
          file.ocr_text = ocrResult.text;
          file.ocr_confidence = ocrResult.confidence;
          file.document_category = ocrResult.document_type;
          file.category_confidence = ocrResult.document_confidence;
        }
      }

      // Complete the job
      job.status = 'completed';
      job.completed_at = new Date().toISOString();
      job.progress_percentage = 100;

      // Free up the scanner
      const scanner = this.scanners.get(job.scanner_id);
      if (scanner) {
        scanner.status = 'online';
      }

    } catch (error) {
      job.status = 'failed';
      job.error_message = error instanceof Error ? error.message : 'Unknown scanning error';
      job.completed_at = new Date().toISOString();

      // Free up the scanner
      const scanner = this.scanners.get(job.scanner_id);
      if (scanner) {
        scanner.status = 'online';
      }
    }
  }

  private async createMockScanFile(job: ScanJob, pageNumber: number): Promise<ScanFile> {
    const timestamp = Date.now();
    const filename = job.settings.custom_filename 
      ? `${job.settings.custom_filename}_page${pageNumber}.${job.settings.format}`
      : `scan_${timestamp}_page${pageNumber}.${job.settings.format}`;

    // Simulate file size based on settings
    const baseSize = job.settings.resolution * job.settings.resolution * 0.1;
    const colorMultiplier = job.settings.color_mode === 'color' ? 3 : 1;
    const compressionDivisor = job.settings.compression_level / 100;
    const fileSize = Math.round(baseSize * colorMultiplier * compressionDivisor);

    return {
      id: `scan-file-${timestamp}-${pageNumber}`,
      scan_job_id: job.id,
      filename: filename,
      file_path: `/tmp/scans/${job.cooperative_id}/${filename}`,
      file_size: fileSize,
      mime_type: this.getMimeType(job.settings.format),
      page_count: 1,
      resolution: job.settings.resolution,
      color_mode: job.settings.color_mode,
      thumbnail_path: `/tmp/scans/${job.cooperative_id}/thumbs/${filename}_thumb.jpg`,
      upload_status: 'pending',
      created_at: new Date().toISOString()
    };
  }

  private estimatePageCount(): number {
    // Random page count between 1 and 20 for simulation
    return Math.floor(Math.random() * 20) + 1;
  }

  private detectDocumentType(filePath: string): BRFDocumentType {
    // Simple mock document type detection based on filename patterns
    const filename = filePath.toLowerCase();
    
    if (filename.includes('faktura') || filename.includes('invoice')) {
      return 'faktura';
    }
    if (filename.includes('protokoll') || filename.includes('protocol')) {
      return 'protokoll';
    }
    if (filename.includes('avtal') || filename.includes('contract')) {
      return 'avtal';
    }
    if (filename.includes('underhall') || filename.includes('maintenance')) {
      return 'underhall';
    }
    
    // Random document type for realistic variety
    const types: BRFDocumentType[] = ['faktura', 'protokoll', 'avtal', 'underhall', 'ekonomi'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private generateMockOCRText(documentType: BRFDocumentType): string {
    const templates = {
      faktura: `
FAKTURA

Leverantör AB
Företagsgatan 123
112 34 Stockholm
Org.nr: 556123-4567

Fakturanummer: FAK-2024-001
Fakturadag: ${new Date().toLocaleDateString('sv-SE')}
Förfallodag: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE')}

BRF Testgården
c/o Förvaltare
Testgatan 456
123 45 Test

Beskrivning                    Belopp
Underhållstjänster            12 500 SEK
Materialomkostnader           2 300 SEK
Moms 25%                      3 700 SEK
--------------------------------------
Totalt att betala            18 500 SEK

Bankgiro: 123-4567
Referens: UND2024001
      `.trim(),
      
      protokoll: `
STYRELSEMÖTE - PROTOKOLL

BRF Testgården
Möte: ${new Date().toLocaleDateString('sv-SE')}
Tid: 19:00-21:30
Plats: Föreningslokalen

Närvarande:
- Anna Andersson, ordförande
- Bengt Bengtsson, kassör  
- Cecilia Carlsson, sekreterare

Agenda:
1. Mötet öppnas
2. Val av justerare
3. Ekonomisk rapport
4. Underhållsplan 2024
5. Övriga frågor
6. Mötet avslutas

Beslut:
- Underhållsplan godkänns
- Budget för takrenoverring 450 000 SEK
      `.trim(),
      
      avtal: `
SERVICEAVTAL

Mellan BRF Testgården (556987-1234)
och ServicePartner AB (556123-7890)

Avtalstid: 2024-01-01 - 2024-12-31
Uppsägningstid: 3 månader

Tjänster som ingår:
- Städning av trapphus 2 gånger/vecka
- Snöröjning och halkbekämpning
- Mindre underhållsarbeten

Ersättning: 15 000 SEK/månad
Fakturering: Månadsvis i efterskott

Kontaktperson:
Maria Nilsson, 08-123 456 78
      `.trim()
    };

    return templates[documentType] || templates.faktura;
  }

  private extractMockEntities(documentType: BRFDocumentType): ExtractedEntity[] {
    switch (documentType) {
      case 'faktura':
        return [
          { type: 'invoice_number', value: 'FAK-2024-001', confidence: 0.95 },
          { type: 'amount', value: '18500', confidence: 0.92 },
          { type: 'due_date', value: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], confidence: 0.88 },
          { type: 'supplier_name', value: 'Leverantör AB', confidence: 0.90 },
          { type: 'organization_number', value: '556123-4567', confidence: 0.93 }
        ];
      
      case 'protokoll':
        return [
          { type: 'date', value: new Date().toISOString().split('T')[0], confidence: 0.94 }
        ];
        
      default:
        return [];
    }
  }

  private getMimeType(format: string): string {
    const mimeTypes = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      tiff: 'image/tiff'
    };
    return mimeTypes[format as keyof typeof mimeTypes] || 'application/octet-stream';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset mock service state (useful for testing)
   */
  reset() {
    this.scanJobs.clear();
    this.initializeMockScanners();
  }
}

// Singleton instance for the application
export const mockScannerService = new MockScannerService();