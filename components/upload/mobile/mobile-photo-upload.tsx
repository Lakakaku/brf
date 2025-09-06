'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Camera, 
  Image, 
  Upload, 
  Edit3, 
  Trash2, 
  Grid3x3, 
  List,
  WifiOff,
  MapPin,
  Settings,
  Plus,
  X
} from 'lucide-react';

import MobileCamera from './mobile-camera';
import MobilePhotoEditor from './mobile-photo-editor';
import { 
  MobilePhotoUploadFile, 
  MobilePhotoUploadProps,
  DeviceCapabilities,
  BRFPhotoCategory,
  MobileTexts,
  OfflineUploadQueue
} from './mobile-types';
import { swedishMobileTexts, formatMobileFileSize, formatMobileTimeAgo } from './mobile-translations';
import { optimizeForBRF, getImageDimensions } from './image-processing';

export default function MobilePhotoUpload({
  files = [],
  enableCamera = true,
  enableGallery = true,
  cameraConfig,
  uploadConfig,
  batchConfig,
  deviceCapabilities,
  accessibility,
  texts = {},
  mobileStyles,
  className = '',
  onFilesSelect,
  onPhotoCapture,
  onBatchCapture,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  onOfflineQueueChange,
}: MobilePhotoUploadProps) {
  const mergedTexts = { ...swedishMobileTexts, ...texts };
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [photos, setPhotos] = useState<MobilePhotoUploadFile[]>(files);
  const [activeView, setActiveView] = useState<'capture' | 'gallery' | 'upload'>('capture');
  const [showCamera, setShowCamera] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<MobilePhotoUploadFile | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineUploadQueue>({
    queue: [],
    totalSize: 0,
    availableSpace: 0,
    syncStatus: 'idle',
  });

  // Device capabilities detection
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
    hasCamera: false,
    hasMultipleCameras: false,
    hasFlash: false,
    hasGPS: false,
    hasAccelerometer: false,
    hasGyroscope: false,
    screen: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    touch: {
      maxTouchPoints: navigator.maxTouchPoints,
      supportsGestures: 'ontouchstart' in window,
    },
    network: {
      type: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      saveData: false,
    },
    storage: {
      persistent: false,
      quota: 0,
      usage: 0,
    },
    ...deviceCapabilities,
  });

  /**
   * Detect device capabilities on mount
   */
  useEffect(() => {
    const detectCapabilities = async () => {
      const updatedCapabilities = { ...capabilities };

      // Camera detection
      if (navigator.mediaDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          updatedCapabilities.hasCamera = videoDevices.length > 0;
          updatedCapabilities.hasMultipleCameras = videoDevices.length > 1;
        } catch (error) {
          console.warn('Camera detection failed:', error);
        }
      }

      // GPS detection
      updatedCapabilities.hasGPS = 'geolocation' in navigator;

      // Motion sensors detection
      updatedCapabilities.hasAccelerometer = 'DeviceMotionEvent' in window;
      updatedCapabilities.hasGyroscope = 'DeviceOrientationEvent' in window;

      // Network information
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        updatedCapabilities.network = {
          type: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          saveData: connection.saveData || false,
        };
      }

      // Storage estimation
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          updatedCapabilities.storage = {
            persistent: await navigator.storage.persist(),
            quota: estimate.quota || 0,
            usage: estimate.usage || 0,
          };
        } catch (error) {
          console.warn('Storage estimation failed:', error);
        }
      }

      setCapabilities(updatedCapabilities);
    };

    detectCapabilities();
  }, []);

  /**
   * Monitor online status
   */
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Handle photo capture from camera
   */
  const handlePhotoCapture = useCallback(async (photo: MobilePhotoUploadFile) => {
    try {
      // Auto-optimize for BRF use case
      const optimized = await optimizeForBRF(
        photo.file, 
        photo.brfCategory || 'other', 
        uploadConfig
      );

      const optimizedPhoto: MobilePhotoUploadFile = {
        ...photo,
        file: new File([optimized.blob], photo.name, { type: optimized.blob.type }),
        size: optimized.blob.size,
        preview: optimized.dataUrl,
        processingHistory: [...photo.processingHistory, ...optimized.optimizations],
        isEdited: optimized.optimizations.length > 0,
      };

      setPhotos(prev => [...prev, optimizedPhoto]);
      onPhotoCapture?.(optimizedPhoto);
      setShowCamera(false);
    } catch (error) {
      console.error('Photo capture processing failed:', error);
    }
  }, [uploadConfig, onPhotoCapture]);

  /**
   * Handle gallery file selection
   */
  const handleGallerySelection = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    const newPhotos: MobilePhotoUploadFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      
      try {
        const dimensions = await getImageDimensions(file);
        const preview = URL.createObjectURL(file);

        const photo: MobilePhotoUploadFile = {
          id: `gallery_${Date.now()}_${i}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          progress: 0,
          status: 'pending',
          preview,
          captureTime: file.lastModified,
          processingHistory: [],
          originalDimensions: dimensions,
          currentDimensions: dimensions,
          isEdited: false,
        };

        // Auto-optimize for BRF
        const optimized = await optimizeForBRF(file, 'other', uploadConfig);
        photo.file = new File([optimized.blob], photo.name, { type: optimized.blob.type });
        photo.size = optimized.blob.size;
        photo.preview = optimized.dataUrl;
        photo.processingHistory = optimized.optimizations;
        photo.isEdited = optimized.optimizations.length > 0;

        newPhotos.push(photo);
      } catch (error) {
        console.error('Gallery photo processing failed:', error);
      }
    }

    setPhotos(prev => [...prev, ...newPhotos]);
    onFilesSelect?.(newPhotos);
    
    // Reset input
    event.target.value = '';
  }, [uploadConfig, onFilesSelect]);

  /**
   * Handle photo editing
   */
  const handlePhotoEdit = useCallback((editedPhoto: MobilePhotoUploadFile) => {
    setPhotos(prev => prev.map(p => p.id === editedPhoto.id ? editedPhoto : p));
    setEditingPhoto(null);
  }, []);

  /**
   * Handle photo deletion
   */
  const handlePhotoDelete = useCallback((photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    setSelectedPhotos(prev => prev.filter(id => id !== photoId));
  }, []);

  /**
   * Handle photo selection toggle
   */
  const handlePhotoSelect = useCallback((photoId: string) => {
    setSelectedPhotos(prev => 
      prev.includes(photoId) 
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
  }, []);

  /**
   * Handle select all photos
   */
  const handleSelectAll = useCallback(() => {
    const allIds = photos.map(p => p.id);
    setSelectedPhotos(selectedPhotos.length === photos.length ? [] : allIds);
  }, [photos, selectedPhotos]);

  /**
   * Handle batch upload
   */
  const handleBatchUpload = useCallback(() => {
    const photosToUpload = selectedPhotos.length > 0 
      ? photos.filter(p => selectedPhotos.includes(p.id))
      : photos;
    
    onUploadStart?.(photosToUpload);
    
    if (!isOnline) {
      // Add to offline queue
      const newQueue = [...offlineQueue.queue, ...photosToUpload];
      const newTotalSize = newQueue.reduce((sum, p) => sum + p.size, 0);
      
      setOfflineQueue(prev => ({
        ...prev,
        queue: newQueue,
        totalSize: newTotalSize,
      }));
      
      onOfflineQueueChange?.(newQueue.length);
    }
  }, [photos, selectedPhotos, onUploadStart, isOnline, offlineQueue, onOfflineQueueChange]);

  // Calculate statistics
  const totalSize = photos.reduce((sum, p) => sum + p.size, 0);
  const selectedSize = photos
    .filter(p => selectedPhotos.includes(p.id))
    .reduce((sum, p) => sum + p.size, 0);

  if (editingPhoto) {
    return (
      <MobilePhotoEditor
        photo={editingPhoto}
        texts={mergedTexts}
        className={className}
        onSave={handlePhotoEdit}
        onCancel={() => setEditingPhoto(null)}
      />
    );
  }

  if (showCamera && enableCamera) {
    return (
      <MobileCamera
        config={cameraConfig}
        deviceCapabilities={capabilities}
        texts={mergedTexts}
        className={className}
        enableGPS={uploadConfig?.extractGPS}
        onCapture={handlePhotoCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className={`w-full max-w-md mx-auto space-y-4 ${className}`}>
      {/* Status indicators */}
      <div className="flex gap-2 text-xs">
        {!isOnline && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <WifiOff className="h-3 w-3" />
            Offline
          </Badge>
        )}
        {offlineQueue.queue.length > 0 && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Upload className="h-3 w-3" />
            {offlineQueue.queue.length} i kö
          </Badge>
        )}
      </div>

      {/* Main interface */}
      <Card>
        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="capture" className="text-xs">
              <Camera className="h-4 w-4 mr-1" />
              Foto
            </TabsTrigger>
            <TabsTrigger value="gallery" className="text-xs">
              <Image className="h-4 w-4 mr-1" />
              Galleri
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-xs">
              <Upload className="h-4 w-4 mr-1" />
              Ladda upp
            </TabsTrigger>
          </TabsList>

          {/* Capture Tab */}
          <TabsContent value="capture" className="p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {enableCamera && capabilities.hasCamera && (
                  <Button
                    onClick={() => setShowCamera(true)}
                    className="h-20 flex-col"
                    aria-label={mergedTexts.accessibility.cameraButton}
                  >
                    <Camera className="h-6 w-6 mb-1" />
                    <span className="text-xs">{mergedTexts.camera.title}</span>
                  </Button>
                )}
                
                {enableGallery && (
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="h-20 flex-col"
                    aria-label={mergedTexts.accessibility.galleryButton}
                  >
                    <Image className="h-6 w-6 mb-1" />
                    <span className="text-xs">{mergedTexts.gallery.title}</span>
                  </Button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGallerySelection}
              />

              {photos.length > 0 && (
                <div className="text-center text-sm text-muted-foreground">
                  {photos.length} foton • {formatMobileFileSize(totalSize)}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="p-4">
            {photos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{mergedTexts.gallery.noPhotos}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* View controls */}
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSelectAll}
                      variant="outline"
                      size="sm"
                    >
                      {selectedPhotos.length === photos.length ? 
                        mergedTexts.gallery.deselectAll : 
                        mergedTexts.gallery.selectAll
                      }
                    </Button>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button
                      onClick={() => setViewMode('grid')}
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="icon-sm"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => setViewMode('list')}
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="icon-sm"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {selectedPhotos.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      {mergedTexts.gallery.selectedCount.replace('{count}', selectedPhotos.length.toString())} • {formatMobileFileSize(selectedSize)}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Photo grid/list */}
                <div className={
                  viewMode === 'grid' 
                    ? 'grid grid-cols-2 gap-2'
                    : 'space-y-2'
                }>
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className={`relative ${viewMode === 'grid' ? 'aspect-square' : 'flex items-center gap-3 p-2'} border rounded-lg overflow-hidden ${
                        selectedPhotos.includes(photo.id) ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handlePhotoSelect(photo.id)}
                    >
                      <img
                        src={photo.preview}
                        alt={photo.name}
                        className={
                          viewMode === 'grid' 
                            ? 'w-full h-full object-cover'
                            : 'w-12 h-12 object-cover rounded'
                        }
                      />
                      
                      {viewMode === 'list' && (
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{photo.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatMobileFileSize(photo.size)} • {formatMobileTimeAgo(photo.captureTime || Date.now())}
                          </p>
                          {photo.gpsLocation && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              GPS
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Photo actions */}
                      <div className="absolute top-1 right-1 flex gap-1">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPhoto(photo);
                          }}
                          variant="secondary"
                          size="icon"
                          className="h-6 w-6 opacity-80 hover:opacity-100"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoDelete(photo.id);
                          }}
                          variant="destructive"
                          size="icon"
                          className="h-6 w-6 opacity-80 hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Selection indicator */}
                      {selectedPhotos.includes(photo.id) && (
                        <div className="absolute top-1 left-1">
                          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <X className="h-3 w-3 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                      
                      {/* Processing indicator */}
                      {photo.isEdited && (
                        <Badge className="absolute bottom-1 left-1 text-xs">
                          Redigerad
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="p-4">
            <div className="space-y-4">
              {photos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Inga foton att ladda upp</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">
                        {selectedPhotos.length > 0 ? selectedPhotos.length : photos.length} foton
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatMobileFileSize(selectedPhotos.length > 0 ? selectedSize : totalSize)}
                      </p>
                    </div>
                    
                    <Button
                      onClick={handleBatchUpload}
                      disabled={photos.length === 0}
                      className="flex-1 max-w-32"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Ladda upp
                    </Button>
                  </div>

                  {!isOnline && (
                    <Alert>
                      <WifiOff className="h-4 w-4" />
                      <AlertDescription>
                        Offline - foton läggs till i uppladdningskö
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}