'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, FlashOff, FlashOn, RotateCcw, X, Check, SwitchCamera } from 'lucide-react';
import { 
  MobileCameraConfig, 
  MobilePhotoUploadFile, 
  DeviceCapabilities,
  MobileTexts 
} from './mobile-types';
import { swedishMobileTexts } from './mobile-translations';

export interface MobileCameraProps {
  /** Camera configuration */
  config?: Partial<MobileCameraConfig>;
  /** Device capabilities */
  deviceCapabilities?: Partial<DeviceCapabilities>;
  /** Swedish translations */
  texts?: Partial<MobileTexts>;
  /** Custom class name */
  className?: string;
  /** Enable GPS extraction */
  enableGPS?: boolean;
  /** Auto-detect BRF category */
  autoDetectCategory?: boolean;
  /** Callback when photo is captured */
  onCapture?: (photo: MobilePhotoUploadFile) => void;
  /** Callback when camera is closed */
  onClose?: () => void;
  /** Callback when permission is requested */
  onPermissionRequest?: (type: 'camera' | 'gps') => void;
  /** Callback for errors */
  onError?: (error: string) => void;
}

const defaultConfig: MobileCameraConfig = {
  facingMode: 'environment',
  resolution: { width: 1920, height: 1080 },
  format: 'jpeg',
  quality: 0.8,
  flash: false,
  autofocus: true,
  burstMode: false,
};

export default function MobileCamera({
  config = {},
  deviceCapabilities = {},
  texts = {},
  className = '',
  enableGPS = true,
  autoDetectCategory = false,
  onCapture,
  onClose,
  onPermissionRequest,
  onError,
}: MobileCameraProps) {
  const mergedConfig = { ...defaultConfig, ...config };
  const mergedTexts = { ...swedishMobileTexts, ...texts };
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(mergedConfig.flash);
  const [currentFacingMode, setCurrentFacingMode] = useState(mergedConfig.facingMode);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionRequested, setIsPermissionRequested] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<GeolocationPosition | null>(null);

  /**
   * Initialize camera stream
   */
  const initializeCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Check for camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamerastöd saknas i denna webbläsare');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: currentFacingMode,
          width: { ideal: mergedConfig.resolution.width },
          height: { ideal: mergedConfig.resolution.height },
          focusMode: mergedConfig.autofocus ? 'continuous' : 'manual',
        },
        audio: false,
      };

      onPermissionRequest?.('camera');
      setIsPermissionRequested(true);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsInitialized(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt kamerafel';
      setError(errorMessage);
      onError?.(errorMessage);
      console.error('Camera initialization error:', err);
    }
  }, [currentFacingMode, mergedConfig, onPermissionRequest, onError]);

  /**
   * Get GPS location
   */
  const getGPSLocation = useCallback(async (): Promise<GeolocationPosition | null> => {
    if (!enableGPS || !navigator.geolocation) {
      return null;
    }

    return new Promise((resolve) => {
      onPermissionRequest?.('gps');
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation(position);
          resolve(position);
        },
        (error) => {
          console.warn('GPS location error:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, [enableGPS, onPermissionRequest]);

  /**
   * Extract EXIF data from image
   */
  const extractEXIFData = useCallback((imageData: string) => {
    // Basic EXIF extraction - in a real implementation, you'd use a library like exif-js
    // For now, we'll return basic orientation data
    return {
      orientation: 1, // Normal orientation
      make: 'Unknown',
      model: 'Web Camera',
      software: 'BRF Portal',
      dateTime: new Date().toISOString(),
    };
  }, []);

  /**
   * Capture photo from video stream
   */
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) {
      return;
    }

    try {
      setIsCapturing(true);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas context inte tillgänglig');
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Kunde inte skapa bildfil'));
          },
          `image/${mergedConfig.format}`,
          mergedConfig.quality
        );
      });

      // Get GPS location
      const location = await getGPSLocation();

      // Create data URL for preview
      const dataUrl = canvas.toDataURL(`image/${mergedConfig.format}`, mergedConfig.quality);
      setCapturedPhoto(dataUrl);

      // Extract EXIF data
      const exifData = extractEXIFData(dataUrl);

      // Create file object
      const timestamp = Date.now();
      const filename = `photo_${timestamp}.${mergedConfig.format}`;
      const file = new File([blob], filename, { type: blob.type });

      // Create mobile upload file
      const mobileFile: MobilePhotoUploadFile = {
        id: `mobile_${timestamp}`,
        file,
        name: filename,
        size: blob.size,
        type: blob.type,
        progress: 0,
        status: 'pending',
        preview: dataUrl,
        captureTime: timestamp,
        gpsLocation: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude || undefined,
          heading: location.coords.heading || undefined,
        } : undefined,
        exifData: {
          ...exifData,
          gps: location ? {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            altitude: location.coords.altitude || undefined,
          } : undefined,
        },
        processingHistory: [],
        originalDimensions: {
          width: canvas.width,
          height: canvas.height,
        },
        currentDimensions: {
          width: canvas.width,
          height: canvas.height,
        },
        compressionLevel: 1 - mergedConfig.quality,
        qualityLevel: mergedConfig.quality,
        isEdited: false,
        brfCategory: autoDetectCategory ? 'other' : undefined,
      };

      setIsCapturing(false);
      return mobileFile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte ta foto';
      setError(errorMessage);
      onError?.(errorMessage);
      setIsCapturing(false);
      return null;
    }
  }, [mergedConfig, getGPSLocation, extractEXIFData, autoDetectCategory, onError]);

  /**
   * Handle use photo button
   */
  const handleUsePhoto = useCallback(async () => {
    if (capturedPhoto) {
      const photo = await capturePhoto();
      if (photo) {
        onCapture?.(photo);
      }
    }
  }, [capturedPhoto, capturePhoto, onCapture]);

  /**
   * Retake photo
   */
  const handleRetake = useCallback(() => {
    setCapturedPhoto(null);
  }, []);

  /**
   * Switch camera (front/back)
   */
  const switchCamera = useCallback(() => {
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    setCurrentFacingMode(newFacingMode);
    
    // Reinitialize camera with new facing mode
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsInitialized(false);
  }, [currentFacingMode]);

  /**
   * Toggle flash
   */
  const toggleFlash = useCallback(async () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();
      
      if ('torch' in capabilities) {
        try {
          await videoTrack.applyConstraints({
            advanced: [{ torch: !flashEnabled } as any]
          });
          setFlashEnabled(!flashEnabled);
        } catch (err) {
          console.warn('Flash toggle failed:', err);
        }
      }
    }
  }, [flashEnabled]);

  /**
   * Close camera
   */
  const handleClose = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsInitialized(false);
    setCapturedPhoto(null);
    onClose?.();
  }, [onClose]);

  /**
   * Initialize camera on mount
   */
  useEffect(() => {
    initializeCamera();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeCamera]);

  /**
   * Reinitialize camera when facing mode changes
   */
  useEffect(() => {
    if (!isInitialized) {
      initializeCamera();
    }
  }, [currentFacingMode, isInitialized, initializeCamera]);

  if (error) {
    return (
      <Card className={`w-full max-w-md mx-auto p-6 ${className}`}>
        <Alert variant="destructive">
          <Camera className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex gap-2 mt-4">
          <Button onClick={initializeCamera} variant="outline" className="flex-1">
            {mergedTexts.camera.retakePhoto}
          </Button>
          <Button onClick={handleClose} variant="ghost" className="flex-1">
            {mergedTexts.editor.cancel}
          </Button>
        </div>
      </Card>
    );
  }

  if (capturedPhoto) {
    return (
      <Card className={`w-full max-w-md mx-auto ${className}`}>
        <div className="relative">
          <img
            src={capturedPhoto}
            alt="Captured photo"
            className="w-full h-auto rounded-t-lg"
          />
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4 flex gap-2">
          <Button
            onClick={handleRetake}
            variant="outline"
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {mergedTexts.camera.retakePhoto}
          </Button>
          <Button
            onClick={handleUsePhoto}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            {mergedTexts.camera.usePhoto}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto rounded-t-lg bg-black"
          style={{ aspectRatio: '4/3' }}
        />
        
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
        
        {/* Camera controls overlay */}
        <div className="absolute top-2 left-2 right-2 flex justify-between">
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex gap-2">
            {deviceCapabilities.hasFlash && (
              <Button
                onClick={toggleFlash}
                variant="ghost"
                size="icon"
                className="bg-black/50 hover:bg-black/70 text-white"
              >
                {flashEnabled ? 
                  <FlashOn className="h-4 w-4" /> : 
                  <FlashOff className="h-4 w-4" />
                }
              </Button>
            )}
            
            {deviceCapabilities.hasMultipleCameras && (
              <Button
                onClick={switchCamera}
                variant="ghost"
                size="icon"
                className="bg-black/50 hover:bg-black/70 text-white"
              >
                <SwitchCamera className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* GPS location indicator */}
        {gpsLocation && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
            <div className="bg-black/50 text-white text-xs px-2 py-1 rounded">
              GPS: {gpsLocation.coords.accuracy.toFixed(0)}m
            </div>
          </div>
        )}
      </div>
      
      {/* Camera controls */}
      <div className="p-4">
        <div className="flex justify-center">
          <Button
            onClick={async () => {
              const photo = await capturePhoto();
              if (photo) {
                setCapturedPhoto(photo.preview || '');
              }
            }}
            disabled={!isInitialized || isCapturing}
            size="lg"
            className="rounded-full w-16 h-16 p-0"
          >
            <Camera className="h-8 w-8" />
          </Button>
        </div>
        
        {isCapturing && (
          <div className="text-center mt-2 text-sm text-muted-foreground">
            {mergedTexts.accessibility.processingIndicator}
          </div>
        )}
        
        {!isInitialized && !error && (
          <div className="text-center mt-2 text-sm text-muted-foreground">
            {isPermissionRequested ? 'Startar kamera...' : 'Förbereder kamera...'}
          </div>
        )}
      </div>
    </Card>
  );
}