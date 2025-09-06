/**
 * Mobile photo upload types and interfaces for the BRF Portal
 * Extends the base upload types with mobile-specific functionality
 */

import { UploadFile } from '../types';

export interface MobilePhotoUploadFile extends UploadFile {
  /** Original photo capture timestamp */
  captureTime?: number;
  /** GPS coordinates when photo was taken */
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    heading?: number;
  };
  /** Image EXIF metadata */
  exifData?: {
    orientation: number;
    make?: string;
    model?: string;
    software?: string;
    dateTime?: string;
    gps?: {
      latitude: number;
      longitude: number;
      altitude?: number;
    };
  };
  /** Image processing history */
  processingHistory: ImageProcessingOperation[];
  /** Original dimensions before processing */
  originalDimensions?: {
    width: number;
    height: number;
  };
  /** Current dimensions after processing */
  currentDimensions?: {
    width: number;
    height: number;
  };
  /** Compression level applied (0-1) */
  compressionLevel?: number;
  /** Quality level for JPEG (0-1) */
  qualityLevel?: number;
  /** Whether the image has been edited */
  isEdited: boolean;
  /** Offline upload queue status */
  offlineStatus?: 'queued' | 'syncing' | 'synced';
  /** BRF document category */
  brfCategory?: BRFPhotoCategory;
}

export interface ImageProcessingOperation {
  type: 'rotate' | 'crop' | 'brightness' | 'contrast' | 'compression' | 'resize';
  value: number | { x: number; y: number; width: number; height: number };
  timestamp: number;
}

export type BRFPhotoCategory = 
  | 'damage_report'
  | 'maintenance'
  | 'invoice'
  | 'protocol'
  | 'inspection'
  | 'renovation'
  | 'property_exterior'
  | 'property_interior'
  | 'common_areas'
  | 'parking'
  | 'other';

export interface MobileCameraConfig {
  /** Preferred camera facing mode */
  facingMode: 'user' | 'environment';
  /** Capture resolution */
  resolution: {
    width: number;
    height: number;
  };
  /** Image format */
  format: 'jpeg' | 'png' | 'webp';
  /** Quality level (0-1) */
  quality: number;
  /** Enable flash */
  flash: boolean;
  /** Enable autofocus */
  autofocus: boolean;
  /** Capture multiple photos in burst mode */
  burstMode: boolean;
}

export interface MobilePhotoEditor {
  /** Current image data URL */
  imageData: string;
  /** Image dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  /** Applied transformations */
  transformations: {
    rotation: number;
    brightness: number;
    contrast: number;
    saturation: number;
    crop?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  /** Processing history */
  history: ImageProcessingOperation[];
  /** Undo/redo support */
  canUndo: boolean;
  canRedo: boolean;
}

export interface MobileUploadConfig {
  /** Maximum photo resolution */
  maxResolution: {
    width: number;
    height: number;
  };
  /** Compression settings */
  compression: {
    quality: number;
    maxFileSize: number;
    format: 'jpeg' | 'webp';
  };
  /** Enable offline support */
  enableOffline: boolean;
  /** Offline storage quota (bytes) */
  offlineStorageQuota: number;
  /** Auto-upload when online */
  autoUploadWhenOnline: boolean;
  /** GPS metadata extraction */
  extractGPS: boolean;
  /** Auto image enhancement */
  autoEnhancement: boolean;
  /** BRF-specific settings */
  brfSettings: {
    enableCategoryDetection: boolean;
    requireGPSForProperty: boolean;
    maxPhotosPerBatch: number;
  };
}

export interface TouchGestureEvent {
  type: 'pinch' | 'pan' | 'tap' | 'double_tap' | 'long_press';
  scale?: number;
  deltaX?: number;
  deltaY?: number;
  touches: number;
  preventDefault: () => void;
}

export interface MobileDropzoneProps {
  /** Enable camera capture */
  enableCamera?: boolean;
  /** Enable gallery selection */
  enableGallery?: boolean;
  /** Camera configuration */
  cameraConfig?: Partial<MobileCameraConfig>;
  /** Upload configuration */
  uploadConfig?: Partial<MobileUploadConfig>;
  /** Touch gesture support */
  enableTouchGestures?: boolean;
  /** Mobile-specific styling */
  mobileTheme?: 'light' | 'dark' | 'auto';
  /** Screen orientation handling */
  orientationLock?: boolean;
  /** Haptic feedback */
  enableHaptics?: boolean;
  /** Custom class for mobile styling */
  mobileClassName?: string;
  /** Callback for camera permission requests */
  onCameraPermission?: (granted: boolean) => void;
  /** Callback for GPS permission requests */
  onGPSPermission?: (granted: boolean) => void;
  /** Callback for photo capture */
  onPhotoCapture?: (photo: MobilePhotoUploadFile) => void;
  /** Callback for batch capture */
  onBatchCapture?: (photos: MobilePhotoUploadFile[]) => void;
  /** Callback for offline queue changes */
  onOfflineQueueChange?: (queueLength: number) => void;
  /** Callback for image processing */
  onImageProcess?: (file: MobilePhotoUploadFile, operation: ImageProcessingOperation) => void;
}

export interface MobilePhotoPreviewProps {
  /** Photo to preview */
  photo: MobilePhotoUploadFile;
  /** Enable editing */
  enableEditing?: boolean;
  /** Show metadata */
  showMetadata?: boolean;
  /** Show processing history */
  showHistory?: boolean;
  /** Touch gesture support */
  enableGestures?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when photo is edited */
  onEdit?: (photo: MobilePhotoUploadFile) => void;
  /** Callback when photo is deleted */
  onDelete?: (photoId: string) => void;
  /** Callback when sharing is requested */
  onShare?: (photo: MobilePhotoUploadFile) => void;
}

export interface MobileBatchPhotoProps {
  /** Photos in the batch */
  photos: MobilePhotoUploadFile[];
  /** Enable batch editing */
  enableBatchEditing?: boolean;
  /** Show batch progress */
  showProgress?: boolean;
  /** Enable sorting */
  enableSorting?: boolean;
  /** Grid view configuration */
  gridConfig?: {
    columns: number;
    gap: number;
    aspectRatio: number;
  };
  /** Custom class name */
  className?: string;
  /** Callback when batch is reordered */
  onReorder?: (photos: MobilePhotoUploadFile[]) => void;
  /** Callback when batch upload starts */
  onBatchUpload?: (photos: MobilePhotoUploadFile[]) => void;
  /** Callback when photos are selected */
  onPhotosSelect?: (photoIds: string[]) => void;
}

export interface OfflineUploadQueue {
  /** Queued files */
  queue: MobilePhotoUploadFile[];
  /** Total queue size in bytes */
  totalSize: number;
  /** Available storage space */
  availableSpace: number;
  /** Sync status */
  syncStatus: 'idle' | 'syncing' | 'error';
  /** Last sync timestamp */
  lastSync?: number;
  /** Sync progress */
  syncProgress?: {
    current: number;
    total: number;
  };
}

export interface PWAFeatures {
  /** Installation support */
  installable: boolean;
  /** Offline capability */
  offline: boolean;
  /** Background sync */
  backgroundSync: boolean;
  /** Push notifications */
  pushNotifications: boolean;
  /** Native sharing */
  nativeSharing: boolean;
  /** File system access */
  fileSystemAccess: boolean;
  /** Camera access */
  cameraAccess: boolean;
  /** Geolocation access */
  geolocationAccess: boolean;
}

export interface MobileAccessibilityConfig {
  /** Screen reader support */
  screenReader: boolean;
  /** High contrast mode */
  highContrast: boolean;
  /** Large touch targets */
  largeTouchTargets: boolean;
  /** Voice commands */
  voiceCommands: boolean;
  /** Simplified interface */
  simplifiedUI: boolean;
  /** Reduced motion */
  reducedMotion: boolean;
}

// Swedish mobile translations interface
export interface MobileTexts {
  camera: {
    title: string;
    switchCamera: string;
    capturePhoto: string;
    retakePhoto: string;
    usePhoto: string;
    enableFlash: string;
    disableFlash: string;
    focusHere: string;
    cameraError: string;
    permissionDenied: string;
    permissionRequest: string;
  };
  gallery: {
    title: string;
    selectPhotos: string;
    selectAll: string;
    deselectAll: string;
    selectedCount: string;
    noPhotos: string;
    loading: string;
  };
  editor: {
    title: string;
    rotate: string;
    crop: string;
    brightness: string;
    contrast: string;
    saturation: string;
    enhance: string;
    undo: string;
    redo: string;
    reset: string;
    apply: string;
    cancel: string;
    save: string;
  };
  batch: {
    title: string;
    selectedPhotos: string;
    uploadAll: string;
    removeAll: string;
    sortBy: string;
    sortByDate: string;
    sortBySize: string;
    sortByName: string;
    gridView: string;
    listView: string;
  };
  offline: {
    title: string;
    queuedUploads: string;
    syncWhenOnline: string;
    syncNow: string;
    clearQueue: string;
    storageUsed: string;
    storageAvailable: string;
  };
  gps: {
    extractingLocation: string;
    locationExtracted: string;
    locationFailed: string;
    permissionRequired: string;
    accuracy: string;
    coordinates: string;
  };
  categories: {
    damage_report: string;
    maintenance: string;
    invoice: string;
    protocol: string;
    inspection: string;
    renovation: string;
    property_exterior: string;
    property_interior: string;
    common_areas: string;
    parking: string;
    other: string;
  };
  gestures: {
    pinchToZoom: string;
    doubleTapToZoom: string;
    panToMove: string;
    longPressForMenu: string;
    swipeToDelete: string;
    swipeToEdit: string;
  };
  pwa: {
    installApp: string;
    offlineReady: string;
    updateAvailable: string;
    updateNow: string;
    installInstructions: string;
  };
  accessibility: {
    cameraButton: string;
    galleryButton: string;
    editButton: string;
    deleteButton: string;
    shareButton: string;
    photoThumbnail: string;
    processingIndicator: string;
    uploadProgress: string;
  };
}

export interface DeviceCapabilities {
  /** Has camera access */
  hasCamera: boolean;
  /** Has multiple cameras */
  hasMultipleCameras: boolean;
  /** Has flash support */
  hasFlash: boolean;
  /** Has GPS capability */
  hasGPS: boolean;
  /** Has accelerometer */
  hasAccelerometer: boolean;
  /** Has gyroscope */
  hasGyroscope: boolean;
  /** Screen dimensions */
  screen: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  /** Touch support */
  touch: {
    maxTouchPoints: number;
    supportsGestures: boolean;
  };
  /** Network information */
  network: {
    type: string;
    effectiveType: string;
    downlink: number;
    saveData: boolean;
  };
  /** Storage capabilities */
  storage: {
    persistent: boolean;
    quota: number;
    usage: number;
  };
}

export interface MobilePhotoUploadProps extends MobileDropzoneProps {
  /** Files to display */
  files?: MobilePhotoUploadFile[];
  /** Batch upload configuration */
  batchConfig?: {
    maxFiles: number;
    autoUpload: boolean;
    enableSorting: boolean;
  };
  /** Device capabilities */
  deviceCapabilities?: Partial<DeviceCapabilities>;
  /** Accessibility configuration */
  accessibility?: Partial<MobileAccessibilityConfig>;
  /** Swedish translations */
  texts?: Partial<MobileTexts>;
  /** Custom mobile styles */
  mobileStyles?: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderRadius: number;
  };
}