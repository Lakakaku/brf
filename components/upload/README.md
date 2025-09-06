# BRF Portal - Advanced File Upload System

Comprehensive file upload system with real-time progress tracking, cancellation support, and Swedish localization specifically designed for BRF Portal requirements.

## 🚀 New Enhanced Features

### Real-time Progress Tracking
- **Server-Sent Events (SSE)** and **WebSocket** support for live progress updates
- **Automatic reconnection** with exponential backoff
- **Connection status indicators** with manual reconnection option
- **Progress persistence** across page refreshes using localStorage

### Advanced Upload Controls
- **Individual file cancellation** with AbortController
- **Pause and resume** functionality for uploads
- **Automatic retry mechanism** with configurable attempts
- **Batch operations** (cancel all, pause all, resume all, retry all)
- **Concurrent upload management** with configurable limits

### Enhanced User Experience
- **Animated progress bars** with smooth transitions
- **Detailed progress information** (speed, time remaining, bytes uploaded)
- **Chunked upload support** for large files (>5MB)
- **Mobile-responsive design** with compact and detailed views
- **Complete Swedish localization** with BRF terminology

## 📦 Components Overview

### Core Components

#### `FileUpload`
Original drag-and-drop upload component with basic progress tracking.

#### `FilePreview` 
Individual file preview with thumbnail, metadata, and remove functionality.

### New Advanced Components

#### `EnhancedFileUpload`
**Most advanced component** - includes all features:
- Real-time progress updates via SSE/WebSocket
- Progress persistence across page refreshes
- Batch upload management with overall statistics
- Connection status monitoring
- Chunked upload for large files
- Comprehensive error handling and retry logic

#### `ProgressTracker`
Detailed progress indicator for individual files:
- **Two display modes**: compact and detailed
- **Real-time metrics**: upload speed, time remaining, bytes uploaded
- **Action controls**: cancel, pause/resume, retry buttons
- **Animated progress bars** with status-based colors
- **Chunk progress** for large file uploads
- **Accessibility support** with ARIA labels and screen reader announcements

#### `BatchProgress`
Comprehensive batch upload overview:
- **Overall statistics**: total progress, file counts by status
- **Performance metrics**: average speed, estimated completion time
- **Batch controls**: pause all, resume all, cancel all, retry failed
- **Individual file visibility** with collapsible detailed view
- **Mobile-optimized layout** with responsive statistics

### React Hooks

#### `useRealtimeProgress`
Custom hook for real-time progress updates:
- **Multiple transport support**: SSE and WebSocket
- **Automatic reconnection** with configurable retry logic
- **Connection state management**
- **Message parsing and validation**

#### `useProgressPersistence`
Upload progress persistence:
- **localStorage integration** with automatic cleanup
- **Cross-session continuity** for long uploads
- **Data validation** and migration support

#### `useUploadStatistics`
Upload statistics calculator:
- **Real-time metrics** calculation
- **Batch progress** aggregation
- **Performance analytics**

## 🎯 Supported File Types

Enhanced support for BRF-specific document types:
- **PDF documents**: protocols, invoices, annual reports, contracts
- **Office documents**: Word (.doc, .docx), Excel (.xls, .xlsx)
- **Images**: JPG, PNG, GIF, WebP, SVG
- **Archives**: ZIP, RAR
- **Text files**: CSV, JSON, plain text
- **Media files**: MP3, WAV, MP4, QuickTime

## 🛠️ Quick Start

### Basic Usage
```tsx
import { EnhancedFileUpload } from '@/components/upload';

function BRFDocumentUpload() {
  const handleUpload = async (file: File, options?: UploadOptions) => {
    // Enhanced upload with cancellation support
    const formData = new FormData();
    formData.append('file', file);
    
    return fetch('/api/upload', {
      method: 'POST',
      body: formData,
      signal: options?.controller?.signal, // Cancellation support
    }).then(res => res.json());
  };

  return (
    <EnhancedFileUpload
      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
      maxSize={50 * 1024 * 1024} // 50MB for BRF documents
      maxFiles={20}
      uploadFunction={handleUpload}
      showBatchProgress={true}
      enablePersistence={true}
      maxConcurrentUploads={3}
      enableChunkedUpload={true}
      realtimeConfig={{
        useSSE: true,
        sseUrl: '/api/upload/progress',
        autoReconnect: true,
      }}
    />
  );
}
```

### Real-time Configuration
```tsx
const realtimeConfig = {
  useSSE: true,
  sseUrl: '/api/upload/progress',
  useWebSocket: false, // Alternative to SSE
  wsUrl: '/api/upload/ws',
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 2000,
};
```

### Individual Progress Tracking
```tsx
import { ProgressTracker } from '@/components/upload';

<ProgressTracker
  file={uploadFile}
  showDetails={true}
  showCancel={true}
  showPauseResume={true}
  showRetry={true}
  onCancel={(fileId) => handleCancel(fileId)}
  onPause={(fileId) => handlePause(fileId)}
  onResume={(fileId) => handleResume(fileId)}
  onRetry={(fileId) => handleRetry(fileId)}
/>
```

### Batch Progress Overview
```tsx
import { BatchProgress } from '@/components/upload';

<BatchProgress
  files={allUploadFiles}
  showIndividualProgress={true}
  showBatchControls={true}
  onCancelAll={() => handleCancelAll()}
  onPauseAll={() => handlePauseAll()}
  onResumeAll={() => handleResumeAll()}
  onRetryAll={() => handleRetryAll()}
/>
```

## 🌍 Swedish Localization

Comprehensive Swedish translation following BRF terminology:

### Status Messages
- `pending`: "Väntar"
- `uploading`: "Laddar upp" 
- `completed`: "Klar"
- `error`: "Fel"
- `cancelled`: "Avbruten"
- `paused`: "Pausad"

### Action Buttons
- `cancelText`: "Avbryt"
- `pauseText`: "Pausa"
- `resumeText`: "Återuppta" 
- `retryText`: "Försök igen"
- `cancelAllText`: "Avbryt alla"

### Progress Information
- Upload speed: "Uppladdningshastighet"
- Time remaining: "Återstående tid"
- File types in Swedish: "PDF-dokument", "Excel-kalkylblad", etc.

### Error Messages
- Connection lost: "Anslutningen förlorades"
- Upload cancelled: "Uppladdningen avbröts"
- Server error: "Serverfel uppstod"

## ♿ Accessibility Features

### Screen Reader Support
- **ARIA labels** for all interactive elements
- **Progress announcements** for upload status changes
- **Semantic markup** with proper headings and landmarks
- **Focus management** for keyboard navigation

### Keyboard Navigation
- **Tab navigation** through all controls
- **Enter/Space activation** for buttons
- **Escape key** to cancel operations
- **Arrow keys** for list navigation

### Visual Accessibility
- **High contrast** color schemes
- **Clear focus indicators** 
- **Large touch targets** (minimum 44px)
- **Consistent visual hierarchy**

## 📱 Mobile Optimization

### Responsive Design
- **Compact progress view** for mobile screens
- **Touch-friendly controls** with proper spacing
- **Optimized layouts** for different screen sizes
- **Swipe gestures** for file management

### Performance
- **Efficient rendering** with virtualization for large lists
- **Optimized animations** with reduced motion support
- **Memory management** for large file sets
- **Battery-conscious** progress updates

## 🔧 Advanced Configuration

### Chunked Upload
```tsx
{
  enableChunkedUpload: true,
  chunkSize: 2 * 1024 * 1024, // 2MB chunks
  maxConcurrentChunks: 3,
  enableRetry: true,
  maxRetries: 3,
}
```

### Progress Persistence
```tsx
{
  enablePersistence: true,
  persistenceKey: 'brf-upload-progress',
  // Automatically saves/restores progress across page refreshes
}
```

### Real-time Updates
```tsx
{
  realtimeConfig: {
    useSSE: true,
    sseUrl: '/api/upload/progress',
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectDelay: 1000,
  }
}
```

## 📊 Performance Metrics

The system tracks detailed performance metrics:
- **Upload speed** in KB/s, MB/s
- **Time remaining** calculations
- **Bytes uploaded** vs total size
- **Retry attempts** and success rates
- **Connection reliability** statistics

## 🧪 Example Usage

Check `/components/upload/example-usage.tsx` for comprehensive examples demonstrating:
- **All component variations** with different configurations
- **Real-world BRF scenarios** (invoices, protocols, reports)
- **Mobile-responsive layouts**
- **Error handling demonstrations**
- **Performance optimization examples**

## 🔒 Security Features

- **File type validation** with MIME type verification
- **File size limits** to prevent abuse
- **AbortController integration** for secure cancellation
- **Input sanitization** for file names
- **Rate limiting** support for upload endpoints

## 🎨 Styling

Built with **Tailwind CSS** and **Radix UI** components:
- Consistent with BRF Portal design system
- **CSS custom properties** for theming
- **Dark mode support** ready
- **Animation classes** for smooth transitions
- **Responsive utilities** for all screen sizes

## 📚 API Reference

Detailed TypeScript interfaces available in `/components/upload/types.ts`:
- `UploadFile`: Enhanced file interface with progress tracking
- `ProgressTrackerProps`: Individual progress component props
- `BatchProgressProps`: Batch progress component props
- `RealtimeProgressConfig`: Real-time update configuration
- `UploadOptions`: Advanced upload configuration

This enhanced file upload system provides production-ready functionality for the BRF Portal with comprehensive progress tracking, real-time updates, and excellent user experience in Swedish.