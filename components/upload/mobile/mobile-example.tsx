'use client';

import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Camera, 
  Image, 
  MapPin, 
  Clock, 
  FileImage, 
  Smartphone,
  Wifi,
  WifiOff 
} from 'lucide-react';

import MobilePhotoUpload from './mobile-photo-upload';
import { 
  MobilePhotoUploadFile, 
  MobileCameraConfig, 
  MobileUploadConfig,
  DeviceCapabilities 
} from './mobile-types';
import { 
  formatMobileFileSize, 
  formatMobileTimeAgo, 
  formatCoordinates 
} from './mobile-translations';

export interface MobileExampleProps {
  /** Show configuration panel */
  showConfiguration?: boolean;
  /** Show usage examples */
  showExamples?: boolean;
  /** Demo mode */
  demoMode?: boolean;
  /** Custom class name */
  className?: string;
}

export default function MobileExample({
  showConfiguration = true,
  showExamples = true,
  demoMode = false,
  className = '',
}: MobileExampleProps) {
  const [uploadedPhotos, setUploadedPhotos] = useState<MobilePhotoUploadFile[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [uploadConfig, setUploadConfig] = useState<Partial<MobileUploadConfig>>({
    maxResolution: { width: 1920, height: 1080 },
    compression: {
      quality: 0.8,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      format: 'jpeg',
    },
    enableOffline: true,
    offlineStorageQuota: 100 * 1024 * 1024, // 100MB
    autoUploadWhenOnline: true,
    extractGPS: true,
    autoEnhancement: true,
    brfSettings: {
      enableCategoryDetection: true,
      requireGPSForProperty: false,
      maxPhotosPerBatch: 20,
    },
  });

  const [cameraConfig, setCameraConfig] = useState<Partial<MobileCameraConfig>>({
    facingMode: 'environment',
    resolution: { width: 1920, height: 1080 },
    format: 'jpeg',
    quality: 0.8,
    flash: false,
    autofocus: true,
    burstMode: false,
  });

  // Mock device capabilities for demo
  const deviceCapabilities: DeviceCapabilities = {
    hasCamera: true,
    hasMultipleCameras: true,
    hasFlash: true,
    hasGPS: true,
    hasAccelerometer: true,
    hasGyroscope: true,
    screen: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    touch: {
      maxTouchPoints: navigator.maxTouchPoints,
      supportsGestures: true,
    },
    network: {
      type: isOnline ? '4g' : 'none',
      effectiveType: '4g',
      downlink: 10,
      saveData: false,
    },
    storage: {
      persistent: true,
      quota: 100 * 1024 * 1024,
      usage: 25 * 1024 * 1024,
    },
  };

  /**
   * Handle photo capture
   */
  const handlePhotoCapture = useCallback((photo: MobilePhotoUploadFile) => {
    console.log('Photo captured:', photo);
    setUploadedPhotos(prev => [...prev, photo]);
  }, []);

  /**
   * Handle batch upload
   */
  const handleBatchUpload = useCallback((photos: MobilePhotoUploadFile[]) => {
    console.log('Batch upload started:', photos);
    
    // Simulate upload progress
    photos.forEach((photo, index) => {
      setTimeout(() => {
        setUploadedPhotos(prev => prev.map(p => 
          p.id === photo.id 
            ? { ...p, status: 'uploading', progress: 0 }
            : p
        ));
        
        // Simulate progress updates
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 20;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setUploadedPhotos(prev => prev.map(p => 
              p.id === photo.id 
                ? { ...p, status: 'completed', progress: 100 }
                : p
            ));
          } else {
            setUploadedPhotos(prev => prev.map(p => 
              p.id === photo.id 
                ? { ...p, progress }
                : p
            ));
          }
        }, 500);
      }, index * 1000);
    });
  }, []);

  /**
   * Handle upload progress
   */
  const handleUploadProgress = useCallback((fileId: string, progress: number) => {
    setUploadedPhotos(prev => prev.map(p => 
      p.id === fileId ? { ...p, progress } : p
    ));
  }, []);

  /**
   * Handle upload complete
   */
  const handleUploadComplete = useCallback((fileId: string) => {
    setUploadedPhotos(prev => prev.map(p => 
      p.id === fileId ? { ...p, status: 'completed', progress: 100 } : p
    ));
  }, []);

  /**
   * Handle upload error
   */
  const handleUploadError = useCallback((fileId: string, error: string) => {
    setUploadedPhotos(prev => prev.map(p => 
      p.id === fileId ? { ...p, status: 'error', error } : p
    ));
  }, []);

  return (
    <div className={`max-w-4xl mx-auto space-y-6 p-4 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Smartphone className="h-6 w-6" />
          Mobil Fotouppladdning - BRF Portal
        </h1>
        <p className="text-muted-foreground">
          Komplett mobilanpassad fotouppladdning med kameraintegration och bildbehandling
        </p>
      </div>

      {/* Status indicators */}
      <div className="flex gap-2 justify-center text-xs">
        <Badge variant={isOnline ? "default" : "destructive"} className="flex items-center gap-1">
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </Badge>
        <Badge variant="outline" className="flex items-center gap-1">
          <Camera className="h-3 w-3" />
          {deviceCapabilities.hasCamera ? 'Kamera tillgänglig' : 'Ingen kamera'}
        </Badge>
        <Badge variant="outline" className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {deviceCapabilities.hasGPS ? 'GPS tillgänglig' : 'Ingen GPS'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mobile Upload Component */}
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Mobil Fotouppladdning</h2>
            <MobilePhotoUpload
              enableCamera={deviceCapabilities.hasCamera}
              enableGallery={true}
              cameraConfig={cameraConfig}
              uploadConfig={uploadConfig}
              deviceCapabilities={deviceCapabilities}
              batchConfig={{
                maxFiles: 20,
                autoUpload: false,
                enableSorting: true,
              }}
              onPhotoCapture={handlePhotoCapture}
              onBatchUpload={handleBatchUpload}
              onUploadProgress={handleUploadProgress}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
          </Card>
        </div>

        {/* Results and Configuration */}
        <div className="space-y-4">
          {/* Uploaded Photos */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              Uppladdade Foton ({uploadedPhotos.length})
            </h3>
            
            {uploadedPhotos.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Inga foton uppladdade än
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {uploadedPhotos.map((photo) => (
                  <div key={photo.id} className="border rounded-lg p-3">
                    <div className="flex gap-3">
                      <img
                        src={photo.preview}
                        alt={photo.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium truncate">{photo.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMobileFileSize(photo.size)} • {formatMobileTimeAgo(photo.captureTime || Date.now())}
                        </p>
                        
                        {photo.gpsLocation && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {formatCoordinates(photo.gpsLocation.latitude, photo.gpsLocation.longitude)}
                          </p>
                        )}
                        
                        <div className="flex gap-1">
                          <Badge 
                            variant={
                              photo.status === 'completed' ? 'default' :
                              photo.status === 'error' ? 'destructive' :
                              photo.status === 'uploading' ? 'secondary' :
                              'outline'
                            }
                            className="text-xs"
                          >
                            {photo.status === 'completed' && 'Slutförd'}
                            {photo.status === 'error' && 'Fel'}
                            {photo.status === 'uploading' && `${photo.progress}%`}
                            {photo.status === 'pending' && 'Väntar'}
                          </Badge>
                          
                          {photo.isEdited && (
                            <Badge variant="outline" className="text-xs">
                              Redigerad
                            </Badge>
                          )}
                          
                          {photo.brfCategory && (
                            <Badge variant="outline" className="text-xs">
                              {photo.brfCategory}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {photo.processingHistory.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Bearbetning: {photo.processingHistory.map(op => op.type).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Configuration */}
          {showConfiguration && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Konfiguration</h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium">Kamerainställningar</h4>
                  <ul className="mt-1 text-muted-foreground">
                    <li>• Läge: {cameraConfig.facingMode === 'environment' ? 'Bakkamera' : 'Frontkamera'}</li>
                    <li>• Upplösning: {cameraConfig.resolution?.width} × {cameraConfig.resolution?.height}</li>
                    <li>• Kvalitet: {Math.round((cameraConfig.quality || 0.8) * 100)}%</li>
                    <li>• Format: {cameraConfig.format?.toUpperCase()}</li>
                  </ul>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium">Uppladdningsinställningar</h4>
                  <ul className="mt-1 text-muted-foreground">
                    <li>• Max upplösning: {uploadConfig.maxResolution?.width} × {uploadConfig.maxResolution?.height}</li>
                    <li>• Komprimering: {Math.round((uploadConfig.compression?.quality || 0.8) * 100)}%</li>
                    <li>• Max filstorlek: {formatMobileFileSize(uploadConfig.compression?.maxFileSize || 0)}</li>
                    <li>• Offline: {uploadConfig.enableOffline ? 'Aktiverad' : 'Inaktiverad'}</li>
                    <li>• GPS: {uploadConfig.extractGPS ? 'Aktiverad' : 'Inaktiverad'}</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Examples */}
      {showExamples && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Användningsexempel</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Grundläggande användning</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`import { MobilePhotoUpload } from '@/components/upload/mobile';

<MobilePhotoUpload
  enableCamera={true}
  enableGallery={true}
  onPhotoCapture={(photo) => console.log(photo)}
  onBatchUpload={(photos) => uploadPhotos(photos)}
/>`}
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Avancerad konfiguration</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`<MobilePhotoUpload
  cameraConfig={{
    facingMode: 'environment',
    quality: 0.9,
    flash: true
  }}
  uploadConfig={{
    extractGPS: true,
    autoEnhancement: true,
    enableOffline: true
  }}
  batchConfig={{
    maxFiles: 10,
    autoUpload: false
  }}
/>`}
              </pre>
            </div>
          </div>
        </Card>
      )}

      {/* Demo Controls */}
      {demoMode && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Demo Kontroller</h3>
          
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setIsOnline(!isOnline)}
              variant="outline"
              size="sm"
            >
              {isOnline ? 'Simulera Offline' : 'Simulera Online'}
            </Button>
            
            <Button
              onClick={() => setUploadedPhotos([])}
              variant="outline"
              size="sm"
            >
              Rensa Foton
            </Button>
            
            <Button
              onClick={() => {
                const mockPhoto: MobilePhotoUploadFile = {
                  id: `demo_${Date.now()}`,
                  file: new File([], 'demo.jpg', { type: 'image/jpeg' }),
                  name: 'Demo Foto.jpg',
                  size: 1024 * 1024,
                  type: 'image/jpeg',
                  progress: 100,
                  status: 'completed',
                  preview: '/api/placeholder/300/200',
                  captureTime: Date.now(),
                  processingHistory: [],
                  isEdited: false,
                  originalDimensions: { width: 300, height: 200 },
                  currentDimensions: { width: 300, height: 200 },
                  gpsLocation: {
                    latitude: 59.3293,
                    longitude: 18.0686,
                    accuracy: 10
                  },
                  brfCategory: 'maintenance'
                };
                handlePhotoCapture(mockPhoto);
              }}
              variant="outline"
              size="sm"
            >
              Lägg till Demo Foto
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}