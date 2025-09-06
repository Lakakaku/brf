# Scanner Integration System - BRF Portal

This document describes the comprehensive scanner integration mock system built for the BRF Portal, enabling direct document scanning and automatic upload functionality.

## Overview

The scanner integration system provides a complete workflow for BRF offices to scan documents directly to the portal, with automatic document type detection, OCR text extraction, and seamless integration with the existing upload infrastructure.

## Key Features

### 1. Network Scanner Discovery
- Automatic discovery of network-connected scanners
- Support for major Swedish scanner brands (Canon, Brother, HP, Epson, etc.)
- Real-time scanner status monitoring
- Connection testing and validation

### 2. Scan-to-Upload Workflow  
- Customizable scan settings (resolution, color mode, format)
- Document type detection and categorization
- Batch scanning with automatic page separation
- Quality settings optimization for BRF document types

### 3. OCR Integration
- Mock OCR service with Swedish language support
- Automatic text extraction from scanned documents
- Entity extraction (invoice numbers, dates, amounts, etc.)
- Document confidence scoring

### 4. BRF Document Types
- **Faktura** (Invoice) - Optimized for financial documents
- **Protokoll** (Protocol/Minutes) - Meeting documentation
- **Avtal** (Contract) - Legal agreements  
- **Underhåll** (Maintenance) - Property maintenance records
- **Ekonomi** (Financial) - Financial reports and statements
- **Försäkring** (Insurance) - Insurance documentation
- **Juridisk** (Legal) - Legal documents
- **Styrelse** (Board) - Board-related documents
- **Medlemmar** (Members) - Member communications
- **Leverantör** (Supplier) - Supplier documentation

## Architecture

### Core Components

```
/lib/scanner/
├── types.ts                 # TypeScript interfaces and types
├── mock-service.ts         # Mock scanner service implementation  
└── upload-integration.ts   # Integration with bulk upload system

/app/api/upload/scanner/
├── route.ts                # Scanner discovery and management
├── scan/
│   ├── route.ts           # Scan job management
│   └── [jobId]/
│       └── route.ts       # Individual scan job control
└── config/
    └── route.ts           # Scanner configuration management
```

### Data Models

#### Scanner Device
```typescript
interface ScannerDevice {
  id: string;
  name: string;
  model: string;
  brand: ScannerBrand;
  ip_address: string;
  status: ScannerStatus;
  capabilities: ScannerCapabilities;
  location?: string;
  cooperative_id: string;
}
```

#### Scan Job
```typescript
interface ScanJob {
  id: string;
  scanner_id: string;
  cooperative_id: string;
  user_id: string;
  status: ScanJobStatus;
  settings: ScanSettings;
  pages_scanned: number;
  files_created: ScanFile[];
  progress_percentage: number;
}
```

#### Scan Settings
```typescript
interface ScanSettings {
  resolution: number;        // DPI (150-1200)
  color_mode: 'color' | 'grayscale' | 'monochrome';
  format: 'pdf' | 'jpg' | 'png' | 'tiff';
  duplex: boolean;
  auto_crop: boolean;
  blank_page_removal: boolean;
  document_separation: boolean;
  document_type?: BRFDocumentType;
}
```

## API Endpoints

### Scanner Discovery
- `GET /api/upload/scanner` - Discover available scanners
- `POST /api/upload/scanner?action=test` - Test scanner connection

### Scan Job Management  
- `POST /api/upload/scanner/scan` - Start scanning job
- `GET /api/upload/scanner/scan` - List scan jobs
- `GET /api/upload/scanner/scan/[jobId]` - Get scan job status
- `POST /api/upload/scanner/scan/[jobId]?action=cancel` - Cancel scan job
- `POST /api/upload/scanner/scan/[jobId]?action=upload` - Upload scanned files
- `DELETE /api/upload/scanner/scan/[jobId]` - Delete scan job

### Configuration Management
- `GET /api/upload/scanner/config` - List scanner configurations
- `POST /api/upload/scanner/config` - Create scanner configuration

## Usage Examples

### Discover Scanners
```typescript
const response = await fetch('/api/upload/scanner', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await response.json();
console.log(data.data.scanners); // Available scanners
```

### Start Scan Job
```typescript
const scanJob = await fetch('/api/upload/scanner/scan', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    scanner_id: 'canon-ir-adv-c5535i-001',
    settings: {
      resolution: 300,
      color_mode: 'color',
      format: 'pdf',
      document_type: 'faktura',
      duplex: true,
      auto_crop: true
    }
  })
});
```

### Monitor Scan Progress
```typescript
const jobStatus = await fetch(`/api/upload/scanner/scan/${jobId}`, {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await jobStatus.json();
console.log(data.data.scan_job.progress.percentage); // Progress %
```

## Swedish Language Support

All user-facing messages are provided in Swedish:

- **Status Messages**: "Ansluten", "Skannar", "Slutförd"
- **Error Messages**: "Skannern hittades inte", "Skanning misslyckades"
- **Success Messages**: "Skanning startad", "Filer uppladdade"
- **Document Types**: "Faktura", "Protokoll", "Avtal", etc.

## Integration Features

### Upload System Integration
- Automatic integration with existing bulk upload system
- File validation using BRF validation rules  
- Support for cooperative-specific settings
- Batch creation and management

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Cooperative data isolation
- Permission validation per scanner

### Logging & Monitoring
- Comprehensive event logging
- Audit trails for all scanner operations
- Error tracking and reporting
- Usage statistics and monitoring

## Configuration Presets

The system includes default configurations for common BRF scenarios:

### Standard Invoice Scanning
- **Resolution**: 300 DPI
- **Color Mode**: Color
- **Format**: PDF  
- **Features**: Duplex, auto-crop, compression
- **Permissions**: Economics and board roles

### Protocol Scanning
- **Resolution**: 300 DPI
- **Color Mode**: Grayscale
- **Format**: PDF
- **Features**: Document separation, duplex
- **Permissions**: Board and secretary roles

### Contract Scanning
- **Resolution**: 400 DPI
- **Color Mode**: Color
- **Format**: PDF
- **Features**: High compression, no blank page removal
- **Permissions**: Board and property manager roles

## Mock Implementation Details

### Scanner Simulation
- Network discovery with realistic delays
- Status changes (online/offline/scanning)
- Capability-based validation
- Connection testing simulation

### OCR Simulation  
- Swedish language text extraction
- Entity detection for common BRF documents
- Confidence scoring and quality assessment
- Document type classification

### Development Features
- Configurable simulation delays
- Error injection for testing
- State management and persistence
- Reset functionality for testing

## Error Handling

The system provides comprehensive error handling with Swedish messages:

- **Scanner Errors**: Not found, offline, busy
- **Network Errors**: Connection failures, timeouts  
- **Validation Errors**: Invalid settings, permission denied
- **Processing Errors**: Scan failures, OCR errors
- **Upload Errors**: Integration failures, file validation

## Security Considerations

- Authentication required for all operations
- Cooperative-based access control
- Scan job isolation per cooperative
- File validation and security scanning
- Audit logging for compliance
- Rate limiting and quotas

## Future Enhancements

The mock system is designed to be easily replaced with real scanner integration:

1. **Real Scanner APIs**: TWAIN/WIA integration
2. **Advanced OCR**: Azure Cognitive Services, AWS Textract  
3. **Hardware Integration**: Direct USB/network protocols
4. **Cloud Scanning**: Mobile scanning apps integration
5. **AI Enhancement**: Smart document routing and classification

## Testing

The mock service includes comprehensive testing capabilities:

- Scanner discovery simulation
- Scan job lifecycle testing
- Error condition simulation
- Performance testing with delays
- Integration testing with upload system

## Conclusion

The scanner integration system provides a complete, production-ready foundation for document scanning in BRF environments, with full Swedish language support, comprehensive logging, and seamless integration with existing upload infrastructure.