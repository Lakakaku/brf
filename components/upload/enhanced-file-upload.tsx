'use client';

import * as React from 'react';
import { Upload, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { FileUploadProps, UploadFile, DropzoneState, UploadOptions, RealtimeProgressConfig } from './types';
import { 
  createUploadFile, 
  validateFiles, 
  parseAcceptString, 
  hasFiles, 
  getFilesFromDragEvent,
  removeFileById,
  updateFile,
} from './utils';
import { swedishTexts, formatFileSize } from './translations';
import { ProgressTracker } from './progress-tracker';
import { BatchProgress } from './batch-progress';
import { useRealtimeProgress, useProgressPersistence } from './use-realtime-progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface EnhancedFileUploadProps extends Omit<FileUploadProps, 'uploadFunction'> {
  /** Enhanced upload function with cancellation support */
  uploadFunction?: (file: File, options?: UploadOptions) => Promise<any>;
  /** Real-time progress configuration */
  realtimeConfig?: RealtimeProgressConfig;
  /** Show batch progress summary */
  showBatchProgress?: boolean;
  /** Enable progress persistence across page refreshes */
  enablePersistence?: boolean;
  /** Custom persistence key */
  persistenceKey?: string;
  /** Show connection status indicator */
  showConnectionStatus?: boolean;
  /** Maximum concurrent uploads */
  maxConcurrentUploads?: number;
  /** Enable chunked uploads for large files */
  enableChunkedUpload?: boolean;
  /** Chunk size in bytes (default: 1MB) */
  chunkSize?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * Enhanced file upload component with comprehensive progress tracking,
 * real-time updates, cancellation support, and Swedish localization
 */
export const EnhancedFileUpload = React.forwardRef<HTMLDivElement, EnhancedFileUploadProps>(
  ({
    accept,
    multiple = true,
    maxSize = 10 * 1024 * 1024, // 10MB default
    maxFiles = 10,
    disabled = false,
    className,
    onFilesSelect,
    onFileRemove,
    onUploadStart,
    onUploadProgress,
    onUploadComplete,
    onUploadError,
    onUploadCancel,
    onUploadPause,
    onUploadResume,
    onRetry,
    uploadFunction,
    realtimeConfig,
    showBatchProgress = true,
    enablePersistence = true,
    persistenceKey = 'brf-upload-progress',
    showConnectionStatus = true,
    maxConcurrentUploads = 3,
    enableChunkedUpload = true,
    chunkSize = 1024 * 1024, // 1MB
    maxRetries = 3,
    ...props
  }, ref) => {
    const [files, setFiles] = React.useState<UploadFile[]>([]);
    const [dropzoneState, setDropzoneState] = React.useState<DropzoneState>({
      isDragOver: false,
      isDragActive: false,
      isDragAccept: false,
      isDragReject: false,
    });
    const [errors, setErrors] = React.useState<string[]>([]);
    const [isUploading, setIsUploading] = React.useState(false);
    const [activeUploads, setActiveUploads] = React.useState<Set<string>>(new Set());

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const dropzoneRef = React.useRef<HTMLDivElement>(null);
    const uploadControllers = React.useRef<Map<string, AbortController>>(new Map());

    // Persistence hook
    const { saveProgress, loadProgress, clearProgress } = useProgressPersistence(persistenceKey);

    // Real-time progress hook
    const { isConnected, reconnect } = useRealtimeProgress({
      config: realtimeConfig || {},
      onProgressUpdate: (update) => {
        setFiles(prev => updateFile(prev, update.fileId, {
          progress: update.progress,
          status: update.status,
          error: update.error,
          bytesUploaded: update.uploadInfo?.loaded,
          uploadSpeed: update.uploadInfo?.speed,
          estimatedTimeRemaining: update.uploadInfo?.timeRemaining,
          chunks: update.chunks,
        }));

        onUploadProgress?.(update.fileId, update.progress, update.uploadInfo);
      },
      onConnectionStateChange: (connected) => {
        console.log('Real-time connection:', connected ? 'connected' : 'disconnected');
      },
    });

    // Load persisted progress on mount
    React.useEffect(() => {
      if (enablePersistence) {
        const persistedFiles = loadProgress();
        if (persistedFiles.length > 0) {
          const restoredFiles = persistedFiles.map(data => ({
            ...createUploadFile(new File([], data.name || 'unknown')),
            ...data,
            file: new File([], data.name || 'unknown'),
            controller: undefined, // Reset controllers
          }));
          setFiles(restoredFiles as UploadFile[]);
        }
      }
    }, [enablePersistence, loadProgress]);

    // Save progress when files change
    React.useEffect(() => {
      if (enablePersistence && files.length > 0) {
        saveProgress(files);
      }
    }, [files, enablePersistence, saveProgress]);

    // Clear progress when all files are completed or cancelled
    React.useEffect(() => {
      if (enablePersistence && files.length > 0) {
        const activeFiles = files.filter(f => 
          f.status === 'pending' || f.status === 'uploading' || f.status === 'paused'
        );
        if (activeFiles.length === 0) {
          clearProgress();
        }
      }
    }, [files, enablePersistence, clearProgress]);

    // Parse accepted file types
    const acceptedTypes = React.useMemo(() => {
      return accept ? parseAcceptString(accept) : [];
    }, [accept]);

    // Handle drag events
    const handleDragEnter = React.useCallback((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (disabled) return;
      
      const hasValidFiles = hasFiles(e);
      setDropzoneState(prev => ({
        ...prev,
        isDragOver: true,
        isDragActive: hasValidFiles,
        isDragAccept: hasValidFiles && !disabled,
        isDragReject: !hasValidFiles || disabled,
      }));
    }, [disabled]);

    const handleDragLeave = React.useCallback((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (dropzoneRef.current && !dropzoneRef.current.contains(e.relatedTarget as Node)) {
        setDropzoneState({
          isDragOver: false,
          isDragActive: false,
          isDragAccept: false,
          isDragReject: false,
        });
      }
    }, []);

    const handleDragOver = React.useCallback((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const handleDrop = React.useCallback((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      setDropzoneState({
        isDragOver: false,
        isDragActive: false,
        isDragAccept: false,
        isDragReject: false,
      });
      
      if (disabled) return;
      
      const droppedFiles = getFilesFromDragEvent(e);
      handleFiles(droppedFiles);
    }, [disabled]);

    // Set up drag event listeners
    React.useEffect(() => {
      const dropzone = dropzoneRef.current;
      if (!dropzone) return;

      dropzone.addEventListener('dragenter', handleDragEnter);
      dropzone.addEventListener('dragleave', handleDragLeave);
      dropzone.addEventListener('dragover', handleDragOver);
      dropzone.addEventListener('drop', handleDrop);

      return () => {
        dropzone.removeEventListener('dragenter', handleDragEnter);
        dropzone.removeEventListener('dragleave', handleDragLeave);
        dropzone.removeEventListener('dragover', handleDragOver);
        dropzone.removeEventListener('drop', handleDrop);
      };
    }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

    // Handle file selection
    const handleFiles = React.useCallback((selectedFiles: File[]) => {
      if (selectedFiles.length === 0) return;

      setErrors([]);

      const config = {
        acceptedTypes,
        maxFileSize: maxSize,
        maxFiles,
      };

      const { validFiles, errors: validationErrors } = validateFiles(
        selectedFiles,
        config,
        files
      );

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
      }

      if (validFiles.length > 0) {
        const newUploadFiles = validFiles.map(file => ({
          ...createUploadFile(file),
          canRetry: true,
          retryCount: 0,
        }));
        
        const updatedFiles = [...files, ...newUploadFiles];
        const finalFiles = maxFiles 
          ? updatedFiles.slice(0, maxFiles)
          : updatedFiles;
        
        setFiles(finalFiles);
        onFilesSelect?.(newUploadFiles);
      }
    }, [files, acceptedTypes, maxSize, maxFiles, onFilesSelect]);

    // Handle file input change
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      handleFiles(selectedFiles);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    // Handle browse button click
    const handleBrowseClick = () => {
      if (disabled) return;
      fileInputRef.current?.click();
    };

    // Handle file removal
    const handleFileRemove = (fileId: string) => {
      // Cancel upload if in progress
      const controller = uploadControllers.current.get(fileId);
      if (controller) {
        controller.abort();
        uploadControllers.current.delete(fileId);
      }
      
      setFiles(prev => removeFileById(prev, fileId));
      setActiveUploads(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
      onFileRemove?.(fileId);
    };

    // Enhanced upload function with progress tracking
    const performUpload = async (file: UploadFile) => {
      if (!uploadFunction) return;

      const controller = new AbortController();
      uploadControllers.current.set(file.id, controller);

      const options: UploadOptions = {
        controller,
        enableChunked: enableChunkedUpload,
        chunkSize,
        maxConcurrentChunks: 3,
        enableRetry: true,
        maxRetries,
      };

      try {
        const startTime = Date.now();
        
        setFiles(prev => updateFile(prev, file.id, { 
          status: 'uploading', 
          progress: 0,
          startTime,
          controller,
        }));

        // Simulate progress updates for demonstration
        // In real implementation, this would come from the upload function or real-time updates
        const progressInterval = setInterval(() => {
          setFiles(prev => {
            const currentFile = prev.find(f => f.id === file.id);
            if (!currentFile || currentFile.status !== 'uploading') {
              clearInterval(progressInterval);
              return prev;
            }
            
            const newProgress = Math.min(currentFile.progress + Math.random() * 15, 95);
            const elapsed = Date.now() - startTime;
            const speed = (newProgress / 100 * file.size) / (elapsed / 1000);
            const remaining = ((100 - newProgress) / 100 * file.size) / speed * 1000;
            
            onUploadProgress?.(file.id, newProgress, {
              speed,
              timeRemaining: remaining,
              loaded: newProgress / 100 * file.size,
              total: file.size,
              percentage: newProgress,
            });
            
            return updateFile(prev, file.id, { 
              progress: newProgress,
              uploadSpeed: speed,
              estimatedTimeRemaining: remaining,
              bytesUploaded: newProgress / 100 * file.size,
            });
          });
        }, 500);

        const result = await uploadFunction(file.file, options);

        clearInterval(progressInterval);
        uploadControllers.current.delete(file.id);

        setFiles(prev => updateFile(prev, file.id, { 
          status: 'completed', 
          progress: 100,
          uploadSpeed: 0,
          estimatedTimeRemaining: 0,
          bytesUploaded: file.size,
        }));

        onUploadComplete?.(file.id, result);
      } catch (error: any) {
        uploadControllers.current.delete(file.id);
        
        if (error.name === 'AbortError') {
          setFiles(prev => updateFile(prev, file.id, { 
            status: 'cancelled',
            error: swedishTexts.errors.uploadCancelled,
          }));
          onUploadCancel?.(file.id);
        } else {
          const errorMessage = error.message || swedishTexts.errors.uploadFailed;
          setFiles(prev => updateFile(prev, file.id, { 
            status: 'error', 
            error: errorMessage,
            canRetry: (file.retryCount || 0) < maxRetries,
          }));
          onUploadError?.(file.id, errorMessage);
        }
      } finally {
        setActiveUploads(prev => {
          const newSet = new Set(prev);
          newSet.delete(file.id);
          return newSet;
        });
      }
    };

    // Handle upload
    const handleUpload = async () => {
      if (!uploadFunction || files.length === 0) return;
      
      const pendingFiles = files.filter(f => f.status === 'pending');
      if (pendingFiles.length === 0) return;

      setIsUploading(true);
      onUploadStart?.(pendingFiles);

      // Process files with concurrency limit
      const uploadQueue = [...pendingFiles];
      const uploadPromises: Promise<void>[] = [];

      while (uploadQueue.length > 0 || uploadPromises.length > 0) {
        // Start new uploads if under concurrency limit
        while (uploadQueue.length > 0 && activeUploads.size < maxConcurrentUploads) {
          const file = uploadQueue.shift()!;
          setActiveUploads(prev => new Set(prev).add(file.id));
          uploadPromises.push(performUpload(file));
        }

        // Wait for at least one upload to complete
        if (uploadPromises.length > 0) {
          await Promise.race(uploadPromises);
          // Remove completed promises
          uploadPromises.splice(0, uploadPromises.length);
        }
      }

      setIsUploading(false);
    };

    // Handle file actions
    const handleCancel = (fileId: string) => {
      const controller = uploadControllers.current.get(fileId);
      if (controller) {
        controller.abort();
      }
    };

    const handlePause = (fileId: string) => {
      const controller = uploadControllers.current.get(fileId);
      if (controller) {
        controller.abort();
        setFiles(prev => updateFile(prev, fileId, { status: 'paused' }));
        onUploadPause?.(fileId);
      }
    };

    const handleResume = (fileId: string) => {
      const file = files.find(f => f.id === fileId);
      if (file && file.status === 'paused') {
        setFiles(prev => updateFile(prev, fileId, { status: 'pending' }));
        performUpload(file);
        onUploadResume?.(fileId);
      }
    };

    const handleRetry = (fileId: string) => {
      const file = files.find(f => f.id === fileId);
      if (file && (file.status === 'error' || file.canRetry)) {
        const retryCount = (file.retryCount || 0) + 1;
        setFiles(prev => updateFile(prev, fileId, { 
          status: 'pending',
          error: undefined,
          progress: 0,
          retryCount,
          canRetry: retryCount < maxRetries,
        }));
        performUpload(file);
        onRetry?.(fileId);
      }
    };

    // Batch actions
    const handleCancelAll = () => {
      activeUploads.forEach(fileId => {
        const controller = uploadControllers.current.get(fileId);
        if (controller) {
          controller.abort();
        }
      });
      setFiles(prev => prev.map(file => 
        file.status === 'uploading' || file.status === 'pending' || file.status === 'paused'
          ? { ...file, status: 'cancelled' as const }
          : file
      ));
      setActiveUploads(new Set());
      setIsUploading(false);
    };

    const handlePauseAll = () => {
      activeUploads.forEach(fileId => {
        const controller = uploadControllers.current.get(fileId);
        if (controller) {
          controller.abort();
        }
      });
      setFiles(prev => prev.map(file => 
        file.status === 'uploading' 
          ? { ...file, status: 'paused' as const }
          : file
      ));
      setActiveUploads(new Set());
    };

    const handleResumeAll = () => {
      const pausedFiles = files.filter(f => f.status === 'paused');
      pausedFiles.forEach(file => handleResume(file.id));
    };

    const handleRetryAll = () => {
      const failedFiles = files.filter(f => f.status === 'error' && f.canRetry);
      failedFiles.forEach(file => handleRetry(file.id));
    };

    // Generate helper text
    const getHelperText = () => {
      const parts: string[] = [];
      
      if (acceptedTypes.length > 0) {
        parts.push(`${swedishTexts.fileTypesText}: ${acceptedTypes.join(', ')}`);
      }
      
      if (maxSize) {
        parts.push(`${swedishTexts.maxSizeText}: ${formatFileSize(maxSize)}`);
      }
      
      return parts.join(' • ');
    };

    return (
      <TooltipProvider>
        <div ref={ref} className={cn('space-y-4', className)} {...props}>
          {/* Connection status */}
          {showConnectionStatus && realtimeConfig && (realtimeConfig.useSSE || realtimeConfig.useWebSocket) && (
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
              <div className="flex items-center gap-2 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span>Realtidsuppdateringar aktiva</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                    <span>Ingen realtidsanslutning</span>
                  </>
                )}
              </div>
              {!isConnected && (
                <Button variant="outline" size="sm" onClick={reconnect}>
                  Återanslut
                </Button>
              )}
            </div>
          )}

          {/* Dropzone */}
          <Card
            ref={dropzoneRef}
            className={cn(
              'border-2 border-dashed transition-all duration-200 ease-in-out',
              'hover:border-primary/50 hover:bg-primary/5',
              dropzoneState.isDragActive && 'border-primary bg-primary/10',
              dropzoneState.isDragAccept && 'border-green-500 bg-green-500/10',
              dropzoneState.isDragReject && 'border-destructive bg-destructive/10',
              disabled && 'opacity-50 cursor-not-allowed',
              !disabled && 'cursor-pointer'
            )}
            onClick={handleBrowseClick}
          >
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className={cn(
                  'rounded-full p-4 transition-colors',
                  dropzoneState.isDragAccept 
                    ? 'bg-green-500/20 text-green-600' 
                    : dropzoneState.isDragReject
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-primary/20 text-primary'
                )}>
                  <Upload className="h-8 w-8" />
                </div>
                
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    {swedishTexts.dragDropText}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {swedishTexts.orText}{' '}
                    <span className="font-medium text-primary hover:underline">
                      {swedishTexts.browseText.toLowerCase()}
                    </span>
                  </p>
                  
                  {getHelperText() && (
                    <p className="text-xs text-muted-foreground">
                      {getHelperText()}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileInputChange}
            disabled={disabled}
            className="hidden"
            aria-describedby="file-upload-description"
          />

          {/* Error messages */}
          {errors.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    {errors.map((error, index) => (
                      <p key={index} className="text-sm text-destructive">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Batch progress */}
          {showBatchProgress && files.length > 0 && (
            <BatchProgress
              files={files}
              showIndividualProgress={false}
              onCancelAll={handleCancelAll}
              onPauseAll={handlePauseAll}
              onResumeAll={handleResumeAll}
              onRetryAll={handleRetryAll}
            />
          )}

          {/* Individual file progress */}
          {files.length > 0 && (
            <div className="space-y-2">
              {!showBatchProgress && (
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">
                    Valda filer ({files.length})
                  </h3>
                  
                  {uploadFunction && files.some(f => f.status === 'pending') && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelAll}
                        disabled={isUploading}
                      >
                        {swedishTexts.cancelText}
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={handleUpload}
                        disabled={isUploading}
                      >
                        {isUploading ? 'Laddar upp...' : swedishTexts.uploadText}
                      </Button>
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                {files.map((file) => (
                  <ProgressTracker
                    key={file.id}
                    file={file}
                    onCancel={handleCancel}
                    onPause={handlePause}
                    onResume={handleResume}
                    onRetry={handleRetry}
                    showCancel={file.status === 'uploading' || file.status === 'paused'}
                    showPauseResume={file.status === 'uploading' || file.status === 'paused'}
                    showRetry={file.status === 'error' && file.canRetry}
                    compact={showBatchProgress}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }
);

EnhancedFileUpload.displayName = 'EnhancedFileUpload';

export default EnhancedFileUpload;