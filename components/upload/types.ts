/**
 * File upload types and interfaces for the BRF Portal
 * Supports drag-and-drop file selection with comprehensive validation
 */

export interface UploadFile {
  /** Unique identifier for the file */
  id: string;
  /** The actual File object */
  file: File;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type of the file */
  type: string;
  /** Upload progress percentage (0-100) */
  progress: number;
  /** Upload status */
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled' | 'paused';
  /** Error message if upload failed */
  error?: string;
  /** Preview URL for images */
  preview?: string;
  /** Upload controller for cancellation */
  controller?: AbortController;
  /** Upload start time */
  startTime?: number;
  /** Estimated time remaining (in milliseconds) */
  estimatedTimeRemaining?: number;
  /** Upload speed in bytes per second */
  uploadSpeed?: number;
  /** Number of bytes uploaded */
  bytesUploaded?: number;
  /** Retry count */
  retryCount?: number;
  /** Whether the file can be retried */
  canRetry?: boolean;
  /** Chunk information for large file uploads */
  chunks?: {
    total: number;
    uploaded: number;
    failed: number[];
  };
}

export interface FileUploadProps {
  /** Accepted file types (MIME types or extensions) */
  accept?: string;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when files are selected/dropped */
  onFilesSelect?: (files: UploadFile[]) => void;
  /** Callback when a file is removed */
  onFileRemove?: (fileId: string) => void;
  /** Callback when upload starts */
  onUploadStart?: (files: UploadFile[]) => void;
  /** Callback for upload progress */
  onUploadProgress?: (fileId: string, progress: number, uploadInfo?: UploadProgressInfo) => void;
  /** Callback when upload completes */
  onUploadComplete?: (fileId: string, response?: any) => void;
  /** Callback when upload fails */
  onUploadError?: (fileId: string, error: string) => void;
  /** Callback when upload is cancelled */
  onUploadCancel?: (fileId: string) => void;
  /** Callback when upload is paused */
  onUploadPause?: (fileId: string) => void;
  /** Callback when upload is resumed */
  onUploadResume?: (fileId: string) => void;
  /** Callback when retry is requested */
  onRetry?: (fileId: string) => void;
  /** Custom upload function */
  uploadFunction?: (file: File, options?: UploadOptions) => Promise<any>;
  /** Enable real-time progress updates */
  enableRealtimeProgress?: boolean;
  /** Server-Sent Events endpoint for real-time updates */
  sseEndpoint?: string;
}

export interface FilePreviewProps {
  /** File to preview */
  file: UploadFile;
  /** Show remove button */
  showRemove?: boolean;
  /** Callback when remove button is clicked */
  onRemove?: (fileId: string) => void;
  /** Custom class name */
  className?: string;
}

export interface DropzoneState {
  /** Whether files are being dragged over the dropzone */
  isDragOver: boolean;
  /** Whether the dropzone is active (can accept files) */
  isDragActive: boolean;
  /** Whether the dragged files are accepted */
  isDragAccept: boolean;
  /** Whether the dragged files are rejected */
  isDragReject: boolean;
}

export interface FileValidationResult {
  /** Whether the file is valid */
  isValid: boolean;
  /** Error message if invalid */
  error?: string;
}

export interface FileUploadConfig {
  /** Accepted file types */
  acceptedTypes: string[];
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Maximum number of files */
  maxFiles: number;
  /** Upload endpoint URL */
  uploadUrl?: string;
  /** Additional upload headers */
  uploadHeaders?: Record<string, string>;
}

// Swedish translations interface
export interface FileUploadTexts {
  /** Drag and drop instruction text */
  dragDropText: string;
  /** Click to browse text */
  browseText: string;
  /** Or separator text */
  orText: string;
  /** File type restriction text */
  fileTypesText: string;
  /** Max size text */
  maxSizeText: string;
  /** Remove file text */
  removeText: string;
  /** Upload button text */
  uploadText: string;
  /** Cancel button text */
  cancelText: string;
  /** Pause button text */
  pauseText: string;
  /** Resume button text */
  resumeText: string;
  /** Retry button text */
  retryText: string;
  /** Cancel all text */
  cancelAllText: string;
  /** Pause all text */
  pauseAllText: string;
  /** Resume all text */
  resumeAllText: string;
  /** Time remaining text */
  timeRemainingText: string;
  /** Upload speed text */
  uploadSpeedText: string;
  /** Error messages */
  errors: {
    fileTooLarge: string;
    fileTypeNotAccepted: string;
    tooManyFiles: string;
    uploadFailed: string;
    networkError: string;
    uploadCancelled: string;
    connectionLost: string;
    serverError: string;
    chunkUploadFailed: string;
  };
  /** Status messages */
  status: {
    pending: string;
    uploading: string;
    completed: string;
    error: string;
    cancelled: string;
    paused: string;
    retrying: string;
  };
  /** Progress messages */
  progress: {
    preparing: string;
    uploading: string;
    processing: string;
    finalizing: string;
    complete: string;
  };
  /** Batch operation messages */
  batch: {
    uploadingFiles: string;
    completedFiles: string;
    failedFiles: string;
    cancelledFiles: string;
    totalFiles: string;
    allComplete: string;
    someErrors: string;
    allCancelled: string;
  };
}

// Additional interfaces for progress tracking
export interface UploadProgressInfo {
  /** Current upload speed in bytes per second */
  speed: number;
  /** Estimated time remaining in milliseconds */
  timeRemaining: number;
  /** Number of bytes uploaded */
  loaded: number;
  /** Total number of bytes */
  total: number;
  /** Upload percentage */
  percentage: number;
}

export interface UploadOptions {
  /** Abort controller for cancellation */
  controller?: AbortController;
  /** Enable chunked upload for large files */
  enableChunked?: boolean;
  /** Chunk size in bytes */
  chunkSize?: number;
  /** Maximum concurrent chunks */
  maxConcurrentChunks?: number;
  /** Enable retry mechanism */
  enableRetry?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

export interface BatchUploadProgress {
  /** Total number of files */
  total: number;
  /** Number of files uploaded successfully */
  completed: number;
  /** Number of files currently uploading */
  uploading: number;
  /** Number of files pending upload */
  pending: number;
  /** Number of files with errors */
  failed: number;
  /** Number of files cancelled */
  cancelled: number;
  /** Number of files paused */
  paused: number;
  /** Overall progress percentage */
  overallProgress: number;
  /** Average upload speed across all files */
  averageSpeed: number;
  /** Estimated time remaining for batch */
  estimatedTimeRemaining: number;
}

export interface ProgressTrackerProps {
  /** Upload file to track */
  file: UploadFile;
  /** Show detailed information */
  showDetails?: boolean;
  /** Show cancel button */
  showCancel?: boolean;
  /** Show pause/resume button */
  showPauseResume?: boolean;
  /** Show retry button */
  showRetry?: boolean;
  /** Compact display mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when cancel is clicked */
  onCancel?: (fileId: string) => void;
  /** Callback when pause is clicked */
  onPause?: (fileId: string) => void;
  /** Callback when resume is clicked */
  onResume?: (fileId: string) => void;
  /** Callback when retry is clicked */
  onRetry?: (fileId: string) => void;
}

export interface BatchProgressProps {
  /** List of files in the batch */
  files: UploadFile[];
  /** Show individual file progress */
  showIndividualProgress?: boolean;
  /** Show batch controls */
  showBatchControls?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when cancel all is clicked */
  onCancelAll?: () => void;
  /** Callback when pause all is clicked */
  onPauseAll?: () => void;
  /** Callback when resume all is clicked */
  onResumeAll?: () => void;
  /** Callback when retry all is clicked */
  onRetryAll?: () => void;
}

export interface RealtimeProgressConfig {
  /** Enable Server-Sent Events */
  useSSE?: boolean;
  /** Enable WebSocket connection */
  useWebSocket?: boolean;
  /** SSE endpoint URL */
  sseUrl?: string;
  /** WebSocket endpoint URL */
  wsUrl?: string;
  /** Reconnect automatically on connection loss */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
}

// Folder upload specific interfaces
export interface FolderStructure {
  /** Unique identifier for the folder */
  id: string;
  /** Folder name */
  name: string;
  /** Folder path from root */
  path: string;
  /** Parent folder ID (null for root) */
  parentId: string | null;
  /** Direct child folders */
  children: FolderStructure[];
  /** Files in this folder */
  files: UploadFile[];
  /** Total files in folder and subfolders */
  totalFiles: number;
  /** Total size of all files in folder and subfolders */
  totalSize: number;
  /** Folder creation time */
  created: Date;
  /** Whether folder is expanded in UI */
  expanded?: boolean;
  /** Whether folder is selected */
  selected?: boolean;
  /** Upload status for the entire folder */
  status?: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled' | 'paused';
  /** Upload progress for the entire folder (0-100) */
  progress?: number;
  /** Number of files completed in folder */
  completedFiles?: number;
  /** Number of files failed in folder */
  failedFiles?: number;
}

export interface FolderUploadFile extends UploadFile {
  /** Relative path within the folder structure */
  relativePath: string;
  /** Folder ID this file belongs to */
  folderId: string;
  /** Directory handle if using File System Access API */
  directoryHandle?: FileSystemDirectoryHandle;
  /** File handle if using File System Access API */
  fileHandle?: FileSystemFileHandle;
}

export interface BRFFolderTemplate {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Expected folder structure */
  structure: {
    path: string;
    description: string;
    required: boolean;
    fileTypes?: string[];
  }[];
}

export interface FolderUploadProps extends Omit<FileUploadProps, 'uploadFunction'> {
  /** Enable folder upload support */
  enableFolderUpload?: boolean;
  /** Show folder structure tree */
  showFolderTree?: boolean;
  /** Enable folder compression before upload */
  enableCompression?: boolean;
  /** Maximum folder depth allowed */
  maxFolderDepth?: number;
  /** Maximum number of files in a folder */
  maxFilesPerFolder?: number;
  /** BRF folder templates */
  brfTemplates?: BRFFolderTemplate[];
  /** Enable File System Access API */
  useFileSystemAccess?: boolean;
  /** Callback when folders are selected */
  onFoldersSelect?: (folders: FolderStructure[]) => void;
  /** Callback when folder is removed */
  onFolderRemove?: (folderId: string) => void;
  /** Callback when folder structure changes */
  onFolderStructureChange?: (folders: FolderStructure[]) => void;
  /** Custom folder upload function */
  folderUploadFunction?: (folder: FolderStructure, options?: FolderUploadOptions) => Promise<any>;
}

export interface FolderUploadOptions extends UploadOptions {
  /** Preserve folder structure on server */
  preserveStructure?: boolean;
  /** Compress folder before upload */
  compress?: boolean;
  /** Compression format (zip, tar, etc.) */
  compressionFormat?: 'zip' | 'tar' | 'gzip';
  /** Compression level (1-9) */
  compressionLevel?: number;
  /** Process folders in parallel */
  parallelProcessing?: boolean;
  /** Maximum parallel folder uploads */
  maxParallelFolders?: number;
}

export interface FolderTreeProps {
  /** Folder structures to display */
  folders: FolderStructure[];
  /** Show file counts */
  showFileCounts?: boolean;
  /** Show folder sizes */
  showSizes?: boolean;
  /** Enable folder selection */
  selectable?: boolean;
  /** Enable folder expansion/collapse */
  collapsible?: boolean;
  /** Maximum depth to display */
  maxDepth?: number;
  /** Custom class name */
  className?: string;
  /** Callback when folder is selected */
  onFolderSelect?: (folderId: string, selected: boolean) => void;
  /** Callback when folder is expanded/collapsed */
  onFolderToggle?: (folderId: string, expanded: boolean) => void;
  /** Callback when folder is removed */
  onFolderRemove?: (folderId: string) => void;
}

export interface FolderPreviewProps {
  /** Folder to preview */
  folder: FolderStructure;
  /** Show detailed file list */
  showFileDetails?: boolean;
  /** Show folder statistics */
  showStatistics?: boolean;
  /** Enable file removal */
  allowFileRemoval?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when file is removed */
  onFileRemove?: (fileId: string) => void;
  /** Callback when folder structure changes */
  onFolderChange?: (folder: FolderStructure) => void;
}

export interface FolderManagerProps {
  /** Folders to manage */
  folders: FolderStructure[];
  /** Show batch operations */
  showBatchOperations?: boolean;
  /** Show folder templates */
  showTemplates?: boolean;
  /** Available BRF templates */
  templates?: BRFFolderTemplate[];
  /** Custom class name */
  className?: string;
  /** Callback when folders change */
  onFoldersChange?: (folders: FolderStructure[]) => void;
  /** Callback when template is applied */
  onTemplateApply?: (template: BRFFolderTemplate) => void;
  /** Callback when batch operation is performed */
  onBatchOperation?: (operation: string, folderIds: string[]) => void;
}

export interface FolderValidationResult {
  /** Whether the folder structure is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Folder statistics */
  stats: {
    totalFolders: number;
    totalFiles: number;
    totalSize: number;
    maxDepth: number;
    duplicateFiles: string[];
    emptyFolders: string[];
  };
}

// Extended Swedish translations for folders
export interface FolderUploadTexts extends FileUploadTexts {
  /** Folder-specific texts */
  folders: {
    selectFolder: string;
    selectFolders: string;
    folderSelected: string;
    foldersSelected: string;
    dropFolders: string;
    browseFolder: string;
    browseFolders: string;
    folderStructure: string;
    preserveStructure: string;
    compressFolder: string;
    compressFolders: string;
    folderPreview: string;
    expandFolder: string;
    collapseFolder: string;
    removeFolder: string;
    emptyFolder: string;
    folderSize: string;
    fileCount: string;
    folderDepth: string;
    applyTemplate: string;
    createFromTemplate: string;
    folderNotSupported: string;
    fileSystemAccessDenied: string;
    folderTooDeep: string;
    tooManyFilesInFolder: string;
    duplicateFilesFound: string;
    compressingFolder: string;
    extractingFolder: string;
    folderUploadComplete: string;
    folderUploadFailed: string;
  };
  /** BRF-specific folder templates */
  brfTemplates: {
    byYear: string;
    byCategory: string;
    financial: string;
    maintenance: string;
    protocols: string;
    contracts: string;
    invoices: string;
    reports: string;
    documentation: string;
    legal: string;
  };
}