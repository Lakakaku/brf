'use client';

import * as React from 'react';
import { 
  EnhancedFileUpload,
  ProgressTracker,
  BatchProgress,
  UploadFile,
  UploadOptions,
  RealtimeProgressConfig,
} from './index';

/**
 * Example usage of the enhanced file upload components
 * Demonstrates all features including real-time progress, cancellation,
 * and Swedish localization for BRF Portal
 */
export function FileUploadExample() {
  const [files, setFiles] = React.useState<UploadFile[]>([]);

  // Mock upload function
  const handleUpload = async (file: File, options?: UploadOptions): Promise<any> => {
    return new Promise((resolve, reject) => {
      const controller = options?.controller;
      
      // Simulate upload with progress
      let progress = 0;
      const interval = setInterval(() => {
        if (controller?.signal.aborted) {
          clearInterval(interval);
          reject(new Error('Upload cancelled'));
          return;
        }
        
        progress += Math.random() * 20;
        if (progress >= 100) {
          clearInterval(interval);
          resolve({ 
            fileId: Math.random().toString(36),
            url: `https://example.com/files/${file.name}`,
            uploadedAt: new Date().toISOString()
          });
        }
      }, 500);
    });
  };

  // Real-time configuration
  const realtimeConfig: RealtimeProgressConfig = {
    useSSE: true,
    sseUrl: '/api/upload/progress',
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 2000,
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">BRF Portal - Filuppladdning</h1>
        <p className="text-muted-foreground">
          Demonstration av avancerad filuppladdning med realtidsframsteg, 
          avbrottsfunktionalitet och svensk lokalisering.
        </p>
      </div>

      {/* Enhanced File Upload with all features */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Förbättrad Filuppladdning</h2>
        <p className="text-sm text-muted-foreground">
          Fullständig filuppladdning med realtidsuppdateringar, avbrottsmöjligheter och batch-hantering.
        </p>
        
        <EnhancedFileUpload
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          maxSize={50 * 1024 * 1024} // 50MB
          maxFiles={20}
          uploadFunction={handleUpload}
          realtimeConfig={realtimeConfig}
          showBatchProgress={true}
          enablePersistence={true}
          showConnectionStatus={true}
          maxConcurrentUploads={3}
          enableChunkedUpload={true}
          chunkSize={2 * 1024 * 1024} // 2MB chunks
          maxRetries={3}
          onFilesSelect={(newFiles) => {
            console.log('Files selected:', newFiles);
            setFiles(prev => [...prev, ...newFiles]);
          }}
          onUploadComplete={(fileId, result) => {
            console.log('Upload completed:', fileId, result);
          }}
          onUploadError={(fileId, error) => {
            console.error('Upload failed:', fileId, error);
          }}
          onUploadCancel={(fileId) => {
            console.log('Upload cancelled:', fileId);
          }}
        />
      </div>

      {/* Standalone Progress Tracker Examples */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Individuell Framstegsindikator</h2>
        <p className="text-sm text-muted-foreground">
          Detaljerad framstegsvisning för enskilda filer med animationer och kontroller.
        </p>

        <div className="grid gap-4">
          {/* Uploading file example */}
          <ProgressTracker
            file={{
              id: 'example-1',
              name: 'Styrelsemöte-protokoll-2024.pdf',
              size: 2.5 * 1024 * 1024,
              type: 'application/pdf',
              file: new File([], 'example'),
              progress: 65,
              status: 'uploading',
              uploadSpeed: 850 * 1024, // 850 KB/s
              estimatedTimeRemaining: 15000, // 15 seconds
              bytesUploaded: 1.625 * 1024 * 1024,
              startTime: Date.now() - 30000,
            }}
            onCancel={(id) => console.log('Cancel:', id)}
            onPause={(id) => console.log('Pause:', id)}
          />

          {/* Completed file example */}
          <ProgressTracker
            file={{
              id: 'example-2',
              name: 'Årsredovisning-2023.xlsx',
              size: 1.2 * 1024 * 1024,
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              file: new File([], 'example'),
              progress: 100,
              status: 'completed',
              bytesUploaded: 1.2 * 1024 * 1024,
            }}
            compact={false}
          />

          {/* Error file example */}
          <ProgressTracker
            file={{
              id: 'example-3',
              name: 'Stor-fil-som-misslyckades.mp4',
              size: 25 * 1024 * 1024,
              type: 'video/mp4',
              file: new File([], 'example'),
              progress: 23,
              status: 'error',
              error: 'Anslutningen förlorades under uppladdning',
              canRetry: true,
              retryCount: 1,
              bytesUploaded: 5.75 * 1024 * 1024,
            }}
            onRetry={(id) => console.log('Retry:', id)}
          />
        </div>
      </div>

      {/* Batch Progress Example */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Batch-framsteg</h2>
        <p className="text-sm text-muted-foreground">
          Översikt av flera filer med sammanlagd statistik och batch-kontroller.
        </p>

        <BatchProgress
          files={[
            {
              id: 'batch-1',
              name: 'Faktura-001.pdf',
              size: 500 * 1024,
              type: 'application/pdf',
              file: new File([], 'example'),
              progress: 100,
              status: 'completed',
            },
            {
              id: 'batch-2',
              name: 'Faktura-002.pdf',
              size: 750 * 1024,
              type: 'application/pdf',
              file: new File([], 'example'),
              progress: 45,
              status: 'uploading',
              uploadSpeed: 200 * 1024,
            },
            {
              id: 'batch-3',
              name: 'Faktura-003.pdf',
              size: 600 * 1024,
              type: 'application/pdf',
              file: new File([], 'example'),
              progress: 0,
              status: 'pending',
            },
            {
              id: 'batch-4',
              name: 'Skadad-faktura.pdf',
              size: 400 * 1024,
              type: 'application/pdf',
              file: new File([], 'example'),
              progress: 12,
              status: 'error',
              error: 'Filen är skadad',
              canRetry: true,
            },
          ]}
          onCancelAll={() => console.log('Cancel all uploads')}
          onPauseAll={() => console.log('Pause all uploads')}
          onResumeAll={() => console.log('Resume all uploads')}
          onRetryAll={() => console.log('Retry failed uploads')}
        />
      </div>

      {/* Mobile Responsive Examples */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Mobilanpassad Vy</h2>
        <p className="text-sm text-muted-foreground">
          Kompakt visning optimerad for mobila enheter.
        </p>

        <div className="space-y-2">
          <ProgressTracker
            file={{
              id: 'mobile-1',
              name: 'Mobil-uppladdning.jpg',
              size: 3 * 1024 * 1024,
              type: 'image/jpeg',
              file: new File([], 'example'),
              progress: 78,
              status: 'uploading',
              uploadSpeed: 450 * 1024,
            }}
            compact={true}
            showDetails={false}
          />
          
          <ProgressTracker
            file={{
              id: 'mobile-2',
              name: 'Dokument-från-telefon.pdf',
              size: 1.5 * 1024 * 1024,
              type: 'application/pdf',
              file: new File([], 'example'),
              progress: 100,
              status: 'completed',
            }}
            compact={true}
            showDetails={false}
          />
        </div>
      </div>

      {/* Developer Information */}
      <div className="p-4 bg-muted/30 rounded-lg space-y-2">
        <h3 className="font-semibold">Utvecklarinformation</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>✅ Realtidsuppdateringar via Server-Sent Events</li>
          <li>✅ Avbrottsfunktionalitet med AbortController</li>
          <li>✅ Automatiska återförsök med konfigurerbar gräns</li>
          <li>✅ Framstegsbeständighet över siduppdateringar</li>
          <li>✅ Chunked upload för stora filer (>5MB)</li>
          <li>✅ Batch-operationer (pausa/återuppta/avbryt alla)</li>
          <li>✅ Mobilanpassad responsiv design</li>
          <li>✅ Fullständig svensk lokalisering</li>
          <li>✅ Tillgänglighetsanpassning för skärmläsare</li>
          <li>✅ TypeScript-stöd med omfattande typdefinitioner</li>
        </ul>
      </div>
    </div>
  );
}

export default FileUploadExample;