/**
 * Scanner Integration System - Main Export
 * Provides comprehensive document scanner integration for the BRF Portal
 */

// Core types and interfaces
export type {
  ScannerDevice,
  ScanJob,
  ScanFile,
  ScanSettings,
  ScannerConfiguration,
  ScannerCapabilities,
  ScannerPermissions,
  OCRResult,
  BRFDocumentType,
  ScannerBrand,
  ScannerStatus,
  ScanJobStatus,
  ExtractedEntity,
  EntityType,
} from './types';

// Constants and defaults
export {
  ScannerMessages,
  MOCK_SCANNERS,
  DEFAULT_SCAN_SETTINGS,
} from './types';

// Mock service for development
export {
  MockScannerService,
  mockScannerService,
} from './mock-service';

// Upload integration
export type {
  ScanToUploadOptions,
  ScanUploadResult,
  ScanUploadFileResult,
} from './upload-integration';

export {
  ScannerUploadIntegration,
  scannerUploadIntegration,
} from './upload-integration';

/**
 * Convenience re-exports for common use cases
 */

// Quick scanner discovery
export const discoverScanners = (cooperativeId: string) => {
  return mockScannerService.discoverScanners(cooperativeId);
};

// Start a scan with default settings
export const startQuickScan = (
  scannerId: string,
  userId: string,
  cooperativeId: string,
  documentType?: BRFDocumentType
) => {
  return mockScannerService.startScan(scannerId, userId, cooperativeId, {
    document_type: documentType,
  });
};

// Get scan job status
export const getScanStatus = (jobId: string) => {
  return mockScannerService.getScanJob(jobId);
};

// Cancel scan
export const cancelScan = (jobId: string) => {
  return mockScannerService.cancelScan(jobId);
};

// Upload scanned files
export const uploadScanFiles = (scanJob: ScanJob, options: ScanToUploadOptions) => {
  return scannerUploadIntegration.uploadScanFiles(scanJob, options);
};

/**
 * Utility functions
 */

// Format scanner status for display
export const formatScannerStatus = (status: ScannerStatus): string => {
  return ScannerMessages.status[status.toUpperCase() as keyof typeof ScannerMessages.status] || status;
};

// Format document type for display  
export const formatDocumentType = (type: BRFDocumentType): string => {
  return ScannerMessages.documentTypes[type] || type;
};

// Format scan job status for display
export const formatScanJobStatus = (status: ScanJobStatus): string => {
  return ScannerMessages.jobStatus[status.toUpperCase() as keyof typeof ScannerMessages.jobStatus] || status;
};

// Check if scanner supports specific feature
export const scannerSupports = (scanner: ScannerDevice, feature: keyof ScannerCapabilities): boolean => {
  return Boolean(scanner.capabilities[feature]);
};

// Validate scan settings against scanner capabilities
export const validateScanSettings = (
  settings: ScanSettings,
  scanner: ScannerDevice
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const caps = scanner.capabilities;

  if (settings.resolution > caps.max_dpi) {
    errors.push(`Upplösning ${settings.resolution} DPI överskrider skannerns max ${caps.max_dpi} DPI`);
  }

  if (settings.color_mode === 'color' && !caps.color) {
    errors.push('Skannern stöder inte färgskanningar');
  }

  if (!caps.supported_formats.includes(settings.format)) {
    errors.push(`Format ${settings.format} stöds inte av skannern`);
  }

  if (settings.duplex && !caps.duplex) {
    errors.push('Skannern stöder inte dubbelsidig skanning');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Get recommended settings for document type
export const getRecommendedSettings = (documentType: BRFDocumentType): Partial<ScanSettings> => {
  const recommendations: Record<BRFDocumentType, Partial<ScanSettings>> = {
    faktura: {
      resolution: 300,
      color_mode: 'color',
      format: 'pdf',
      duplex: true,
      auto_crop: true,
      compression_level: 80,
    },
    protokoll: {
      resolution: 300,
      color_mode: 'grayscale',
      format: 'pdf',
      duplex: true,
      document_separation: true,
      compression_level: 70,
    },
    avtal: {
      resolution: 400,
      color_mode: 'color',
      format: 'pdf',
      duplex: true,
      blank_page_removal: false,
      compression_level: 90,
    },
    underhall: {
      resolution: 300,
      color_mode: 'color',
      format: 'jpg',
      duplex: false,
      auto_crop: true,
      compression_level: 85,
    },
    ekonomi: {
      resolution: 300,
      color_mode: 'color',
      format: 'pdf',
      duplex: true,
      compression_level: 75,
    },
    forsaking: {
      resolution: 400,
      color_mode: 'color',
      format: 'pdf',
      duplex: true,
      compression_level: 90,
    },
    juridisk: {
      resolution: 400,
      color_mode: 'color',
      format: 'pdf',
      duplex: true,
      blank_page_removal: false,
      compression_level: 95,
    },
    styrelse: {
      resolution: 300,
      color_mode: 'grayscale',
      format: 'pdf',
      duplex: true,
      document_separation: true,
      compression_level: 70,
    },
    medlemmar: {
      resolution: 300,
      color_mode: 'grayscale',
      format: 'pdf',
      duplex: true,
      compression_level: 75,
    },
    leverantor: {
      resolution: 300,
      color_mode: 'color',
      format: 'pdf',
      duplex: true,
      auto_crop: true,
      compression_level: 80,
    },
    ovrigt: {
      resolution: 300,
      color_mode: 'color',
      format: 'pdf',
      duplex: true,
      compression_level: 80,
    },
  };

  return recommendations[documentType] || recommendations.ovrigt;
};

/**
 * Development and testing utilities
 */

// Reset mock service state
export const resetMockService = () => {
  mockScannerService.reset();
};

// Get scanner simulation delays (for testing)
export const getSimulationDelays = () => ({
  discovery: 2000,
  connection: 1500,
  scanPage: 3000,
  ocrProcessing: 2000,
  upload: 1000,
});

/**
 * Export all types for external use
 */
export type { MockScannerService } from './mock-service';
export type { ScannerUploadIntegration } from './upload-integration';