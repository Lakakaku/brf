/**
 * Mobile photo upload components for the BRF Portal
 * Comprehensive mobile-optimized photo upload functionality
 */

// Main mobile upload component
export { default as MobilePhotoUpload } from './mobile-photo-upload';
export type { MobilePhotoUploadProps } from './mobile-types';

// Camera integration
export { default as MobileCamera } from './mobile-camera';
export type { MobileCameraProps } from './mobile-camera';

// Photo editor
export { default as MobilePhotoEditor } from './mobile-photo-editor';
export type { MobilePhotoEditorProps } from './mobile-photo-editor';

// Image processing utilities
export * from './image-processing';

// Types and interfaces
export * from './mobile-types';

// Translations and formatting utilities
export * from './mobile-translations';

// Internal components
export { Slider } from './mobile-slider';

// Re-export core types for convenience
export type {
  MobilePhotoUploadFile,
  MobileCameraConfig,
  MobileUploadConfig,
  DeviceCapabilities,
  ImageProcessingOperation,
  BRFPhotoCategory,
  MobileTexts,
  OfflineUploadQueue,
} from './mobile-types';