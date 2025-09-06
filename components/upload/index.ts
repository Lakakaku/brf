/**
 * Upload components for BRF Portal
 * Comprehensive drag-and-drop file upload interface with Swedish localization
 * Enhanced with progress tracking, real-time updates, and cancellation support
 */

// Core components
export { FileUpload as default } from './file-upload';
export { FileUpload } from './file-upload';
export { FilePreview } from './file-preview';

// Advanced progress tracking components
export { ProgressTracker } from './progress-tracker';
export { BatchProgress } from './batch-progress';
export { EnhancedFileUpload } from './enhanced-file-upload';

// Hooks for real-time progress and persistence
export { 
  useRealtimeProgress, 
  useProgressPersistence, 
  useUploadStatistics 
} from './use-realtime-progress';

// Types and utilities
export * from './types';
export * from './utils';
export * from './translations';

// Mobile photo upload components
export { 
  MobilePhotoUpload,
  MobileCamera,
  MobilePhotoEditor
} from './mobile';
export type { 
  MobilePhotoUploadFile,
  MobilePhotoUploadProps,
  MobileCameraConfig,
  MobileUploadConfig,
  DeviceCapabilities,
  BRFPhotoCategory 
} from './mobile';

// Mobile utilities
export {
  formatMobileFileSize,
  formatMobileTimeAgo,
  formatCoordinates,
  swedishMobileTexts
} from './mobile';

// Folder upload components
export { FolderUpload } from './folder-upload';
export { FolderTree } from './folder-tree';
export { FolderPreview } from './folder-preview';

// Folder upload hook
export { useFolderUpload } from './use-folder-upload';
export type { 
  UseFolderUploadConfig,
  UseFolderUploadReturn 
} from './use-folder-upload';

// Folder-specific types
export type {
  FolderStructure,
  FolderUploadFile,
  FolderUploadProps,
  FolderTreeProps,
  FolderPreviewProps,
  FolderValidationResult,
  BRFFolderTemplate,
  FolderUploadOptions
} from './types';

// Folder utilities
export {
  generateFolderId,
  createFolderStructureFromFiles,
  isFileSystemAccessSupported,
  processDirectoryHandle,
  hasFolders,
  getFoldersFromDragEvent,
  flattenFolderStructure,
  validateFolderStructure,
  updateFolder,
  removeFolderById,
  findFolderById,
  calculateFolderProgress,
  getBRFFolderTemplates
} from './utils';

// Re-export commonly used utilities
export { 
  formatFileSize as formatBytes,
  getFileTypeDisplayName,
  formatUploadSpeed,
  formatTimeRemaining,
  getStatusDisplayText,
  getProgressPhaseText,
  calculateProgress,
  calculateTimeRemaining,
  swedishTexts 
} from './translations';