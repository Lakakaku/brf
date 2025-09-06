# Mobile Photo Upload - BRF Portal

Comprehensive mobile-optimized photo upload functionality for the Swedish BRF Portal. This module provides native-like camera integration, image processing, and mobile-specific upload features designed for property management and documentation.

## Features

### 🎯 Core Functionality
- **Camera Integration**: Native iOS and Android camera access with flash and multi-camera support
- **Gallery Selection**: Multi-photo selection from device gallery
- **Image Processing**: Rotation, cropping, brightness/contrast adjustment, compression
- **BRF Optimization**: Category-specific image optimization for Swedish BRF use cases
- **GPS Metadata**: Automatic location extraction for property documentation
- **Offline Support**: Upload queue with automatic sync when online
- **Progress Tracking**: Real-time upload progress with cancellation support

### 📱 Mobile-First Design
- **Touch Optimized**: Large touch targets and gesture support
- **Responsive**: Adapts to all screen sizes and orientations
- **Accessibility**: Full ARIA support and screen reader compatibility
- **PWA Ready**: Service worker integration for native-like experience
- **Network Aware**: Handles poor connectivity and offline scenarios

### 🇸🇪 Swedish BRF Integration
- **Swedish Interface**: Complete Swedish language support
- **BRF Categories**: Pre-configured categories (damage reports, maintenance, invoices, etc.)
- **Document Optimization**: Automatic optimization for common BRF document types
- **Property Documentation**: GPS tagging for property location tracking

## Installation

The mobile photo upload components are part of the main BRF Portal upload system:

```bash
# Already included in the BRF Portal project
import { MobilePhotoUpload } from '@/components/upload/mobile';
```

## Quick Start

### Basic Usage

```tsx
import { MobilePhotoUpload } from '@/components/upload/mobile';

export default function MyComponent() {
  const handlePhotoCapture = (photo) => {
    console.log('Photo captured:', photo);
  };

  const handleBatchUpload = (photos) => {
    // Upload photos to your backend
    uploadPhotos(photos);
  };

  return (
    <MobilePhotoUpload
      enableCamera={true}
      enableGallery={true}
      onPhotoCapture={handlePhotoCapture}
      onBatchUpload={handleBatchUpload}
    />
  );
}
```

### Advanced Configuration

```tsx
import { 
  MobilePhotoUpload,
  MobileCameraConfig,
  MobileUploadConfig 
} from '@/components/upload/mobile';

const cameraConfig: MobileCameraConfig = {
  facingMode: 'environment', // Back camera
  resolution: { width: 1920, height: 1080 },
  format: 'jpeg',
  quality: 0.9,
  flash: true,
  autofocus: true,
  burstMode: false,
};

const uploadConfig: MobileUploadConfig = {
  maxResolution: { width: 2048, height: 1536 },
  compression: {
    quality: 0.8,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    format: 'jpeg',
  },
  enableOffline: true,
  extractGPS: true,
  autoEnhancement: true,
  brfSettings: {
    enableCategoryDetection: true,
    requireGPSForProperty: true,
    maxPhotosPerBatch: 20,
  },
};

export default function AdvancedMobileUpload() {
  return (
    <MobilePhotoUpload
      cameraConfig={cameraConfig}
      uploadConfig={uploadConfig}
      batchConfig={{
        maxFiles: 10,
        autoUpload: false,
        enableSorting: true,
      }}
      onPhotoCapture={(photo) => {
        // Handle individual photo capture
        console.log('New photo:', photo);
      }}
      onBatchUpload={(photos) => {
        // Handle batch upload
        uploadBatch(photos);
      }}
      onUploadProgress={(fileId, progress) => {
        // Track upload progress
        console.log(`File ${fileId}: ${progress}%`);
      }}
      onOfflineQueueChange={(queueLength) => {
        // Monitor offline queue
        console.log(`${queueLength} photos queued for upload`);
      }}
    />
  );
}
```

## Components

### MobilePhotoUpload

The main mobile photo upload component with integrated camera, gallery, and upload functionality.

#### Props

```tsx
interface MobilePhotoUploadProps {
  // File management
  files?: MobilePhotoUploadFile[];
  
  // Feature toggles
  enableCamera?: boolean;
  enableGallery?: boolean;
  
  // Configuration
  cameraConfig?: Partial<MobileCameraConfig>;
  uploadConfig?: Partial<MobileUploadConfig>;
  batchConfig?: {
    maxFiles: number;
    autoUpload: boolean;
    enableSorting: boolean;
  };
  
  // Device integration
  deviceCapabilities?: Partial<DeviceCapabilities>;
  accessibility?: Partial<MobileAccessibilityConfig>;
  
  // Localization
  texts?: Partial<MobileTexts>;
  
  // Styling
  mobileStyles?: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderRadius: number;
  };
  
  // Event callbacks
  onFilesSelect?: (files: MobilePhotoUploadFile[]) => void;
  onPhotoCapture?: (photo: MobilePhotoUploadFile) => void;
  onBatchCapture?: (photos: MobilePhotoUploadFile[]) => void;
  onBatchUpload?: (photos: MobilePhotoUploadFile[]) => void;
  onUploadStart?: (files: MobilePhotoUploadFile[]) => void;
  onUploadProgress?: (fileId: string, progress: number) => void;
  onUploadComplete?: (fileId: string, response?: any) => void;
  onUploadError?: (fileId: string, error: string) => void;
  onOfflineQueueChange?: (queueLength: number) => void;
  onImageProcess?: (file: MobilePhotoUploadFile, operation: ImageProcessingOperation) => void;
}
```

### MobileCamera

Dedicated camera component for photo capture.

```tsx
import { MobileCamera } from '@/components/upload/mobile';

<MobileCamera
  config={{
    facingMode: 'environment',
    quality: 0.9,
    flash: true
  }}
  enableGPS={true}
  onCapture={(photo) => console.log('Photo captured:', photo)}
  onClose={() => console.log('Camera closed')}
/>
```

### MobilePhotoEditor

Touch-optimized photo editing interface.

```tsx
import { MobilePhotoEditor } from '@/components/upload/mobile';

<MobilePhotoEditor
  photo={selectedPhoto}
  enableCrop={true}
  enableRotation={true}
  enableEnhancement={true}
  onSave={(editedPhoto) => console.log('Photo edited:', editedPhoto)}
  onCancel={() => console.log('Edit cancelled')}
/>
```

## Image Processing

### Available Operations

- **Rotation**: 90°, 180°, 270° rotation with automatic orientation correction
- **Cropping**: Touch-friendly crop area selection
- **Enhancement**: Brightness, contrast, saturation adjustment
- **Compression**: Quality and size optimization
- **BRF Optimization**: Category-specific processing for different document types

### BRF Categories

The system includes pre-configured optimization for Swedish BRF use cases:

- `damage_report`: High quality with enhanced contrast for damage documentation
- `maintenance`: Balanced quality for maintenance photos
- `invoice`: Text-optimized with high contrast for invoice scanning
- `protocol`: Compressed for efficient document storage
- `property_exterior`: High quality for exterior property photos
- `property_interior`: High quality for interior property photos
- `common_areas`: Standard quality for common area documentation
- `parking`: Standard quality for parking area photos
- `inspection`: Enhanced quality for inspection documentation
- `renovation`: High quality for renovation progress photos

### Processing Example

```tsx
import { 
  rotateImage, 
  cropImage, 
  enhanceImage, 
  optimizeForBRF 
} from '@/components/upload/mobile';

// Rotate image
const rotated = await rotateImage(imageFile, 90);

// Crop image
const cropped = await cropImage(imageFile, {
  x: 10, y: 10, width: 200, height: 200
});

// Enhance image
const enhanced = await enhanceImage(imageFile, {
  brightness: 10,
  contrast: 15,
  saturation: 0,
  sharpness: 5
});

// Optimize for BRF category
const optimized = await optimizeForBRF(imageFile, 'damage_report');
```

## GPS and Metadata

### GPS Extraction

Automatically extracts GPS coordinates from photos for property documentation:

```tsx
const photo = {
  // ... other properties
  gpsLocation: {
    latitude: 59.3293,
    longitude: 18.0686,
    accuracy: 10, // meters
    altitude: 25, // meters (optional)
    heading: 180 // degrees (optional)
  }
};
```

### EXIF Data

Basic EXIF metadata extraction:

```tsx
const photo = {
  // ... other properties
  exifData: {
    orientation: 6, // EXIF orientation
    make: 'Apple',
    model: 'iPhone 12',
    software: 'iOS 15.0',
    dateTime: '2023-06-15T10:30:00Z',
    gps: {
      latitude: 59.3293,
      longitude: 18.0686
    }
  }
};
```

## Offline Support

### Upload Queue

The system maintains an offline upload queue that automatically syncs when the device comes online:

```tsx
const offlineQueue = {
  queue: [photo1, photo2, photo3],
  totalSize: 15728640, // bytes
  availableSpace: 104857600, // bytes
  syncStatus: 'idle' | 'syncing' | 'error',
  lastSync: 1686825000000 // timestamp
};
```

### Storage Management

- **Persistent Storage**: Requests persistent storage quota
- **Storage Estimation**: Monitors available storage space
- **Cleanup**: Automatic cleanup of processed photos
- **Compression**: Intelligent compression based on storage constraints

## Accessibility

### ARIA Support

Full ARIA labeling for screen readers:

- Camera controls with descriptive labels
- Photo thumbnails with capture time and metadata
- Upload progress indicators
- Error states and success messages

### Touch Accessibility

- Large touch targets (minimum 44px)
- High contrast mode support
- Reduced motion support
- Voice command integration (where supported)

### Screen Reader Support

```tsx
const accessibilityTexts = {
  cameraButton: 'Öppna kamera för att ta foto',
  galleryButton: 'Öppna fotogalleri för att välja foton',
  editButton: 'Redigera vald bild',
  deleteButton: 'Ta bort vald bild',
  shareButton: 'Dela vald bild',
  photoThumbnail: 'Miniatyrbild av foto taget {date}',
  processingIndicator: 'Bearbetar bild, vänligen vänta',
  uploadProgress: 'Uppladdning pågår, {progress}% klar',
};
```

## PWA Integration

### Service Worker Features

- **Offline Capability**: Full functionality when offline
- **Background Sync**: Automatic upload when connection restored
- **Push Notifications**: Upload completion notifications
- **Install Prompt**: Add to home screen functionality

### Manifest Integration

The mobile components work seamlessly with PWA manifests for native-like experience on mobile devices.

## Swedish Localization

### Complete Swedish Interface

All text strings are available in Swedish with proper BRF terminology:

```tsx
const swedishTexts = {
  camera: {
    title: 'Kamera',
    capturePhoto: 'Ta foto',
    switchCamera: 'Växla kamera',
    // ... more translations
  },
  categories: {
    damage_report: 'Skaderapport',
    maintenance: 'Underhåll',
    invoice: 'Faktura',
    // ... more categories
  }
};
```

### Number and Date Formatting

Swedish-specific formatting for file sizes, dates, and coordinates:

```tsx
formatMobileFileSize(1024000); // "1,0 MB"
formatMobileTimeAgo(Date.now() - 3600000); // "1 tim sedan"
formatCoordinates(59.3293, 18.0686); // "59,329300, 18,068600"
```

## Performance Optimization

### Image Processing

- **Web Workers**: Offloads heavy processing to prevent UI blocking
- **Canvas Optimization**: Efficient canvas operations for image manipulation
- **Memory Management**: Proper cleanup of image data and blob URLs
- **Progressive Enhancement**: Graceful fallbacks for unsupported features

### Network Optimization

- **Intelligent Compression**: Adaptive quality based on network conditions
- **Chunked Uploads**: Large files uploaded in chunks for reliability
- **Progress Tracking**: Real-time upload progress without blocking UI
- **Retry Logic**: Automatic retry for failed uploads

## Browser Support

### Mobile Browsers

- **iOS Safari**: 12+
- **Chrome Mobile**: 80+
- **Samsung Internet**: 12+
- **Firefox Mobile**: 85+

### Required APIs

- **MediaDevices**: Camera access
- **Geolocation**: GPS extraction
- **Canvas**: Image processing
- **File API**: File handling
- **IndexedDB**: Offline storage (optional)
- **Service Workers**: PWA features (optional)

### Graceful Degradation

Features degrade gracefully when APIs are not available:
- Camera falls back to gallery selection
- GPS extraction is optional
- Offline support falls back to immediate upload
- PWA features are progressive enhancements

## Development

### Local Development

```bash
# Start development server
npm run dev

# Navigate to mobile example
# http://localhost:3000/examples/mobile-upload
```

### Testing

```bash
# Run mobile component tests
npm run test:mobile

# Run with mobile device emulation
npm run test:mobile:devices
```

### Building

```bash
# Build for production
npm run build

# Optimize mobile assets
npm run build:mobile
```

## Examples

Complete examples are available in the `/mobile-example.tsx` file, including:

- Basic photo upload
- Advanced configuration
- Offline queue management
- Progress tracking
- Error handling
- PWA integration

## Contributing

When contributing to the mobile photo upload functionality:

1. Follow the existing TypeScript patterns
2. Maintain Swedish language support
3. Test on both iOS and Android devices
4. Ensure accessibility compliance
5. Update documentation for new features

## License

Part of the BRF Portal project - see main project license for details.