'use client';

import * as React from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { FileUploadProps, UploadFile, DropzoneState } from './types';
import { 
  createUploadFile, 
  validateFiles, 
  parseAcceptString, 
  hasFiles, 
  getFilesFromDragEvent,
  removeFileById,
  updateFile,
  formatBytes
} from './utils';
import { swedishTexts, formatFileSize } from './translations';
import { FilePreview } from './file-preview';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * FileUpload component - comprehensive drag-and-drop file upload interface
 * Supports Swedish BRF portal requirements with full accessibility
 */
export const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(
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
    uploadFunction,
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

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const dropzoneRef = React.useRef<HTMLDivElement>(null);

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
      
      // Only reset if leaving the dropzone completely
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
        const newUploadFiles = validFiles.map(createUploadFile);
        const updatedFiles = [...files, ...newUploadFiles];
        
        // Respect maxFiles limit
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
      
      // Reset input value to allow selecting the same file again
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
      setFiles(prev => removeFileById(prev, fileId));
      onFileRemove?.(fileId);
    };

    // Handle upload
    const handleUpload = async () => {
      if (!uploadFunction || files.length === 0) return;
      
      setIsUploading(true);
      onUploadStart?.(files);

      for (const file of files) {
        if (file.status !== 'pending') continue;

        try {
          // Update file status to uploading
          setFiles(prev => updateFile(prev, file.id, { 
            status: 'uploading', 
            progress: 0 
          }));

          // Simulate progress updates (replace with actual upload progress)
          const progressInterval = setInterval(() => {
            setFiles(prev => {
              const currentFile = prev.find(f => f.id === file.id);
              if (!currentFile || currentFile.status !== 'uploading') {
                clearInterval(progressInterval);
                return prev;
              }
              
              const newProgress = Math.min(currentFile.progress + 10, 90);
              onUploadProgress?.(file.id, newProgress);
              
              return updateFile(prev, file.id, { progress: newProgress });
            });
          }, 200);

          // Perform upload
          const result = await uploadFunction(file.file);

          clearInterval(progressInterval);

          // Update file status to completed
          setFiles(prev => updateFile(prev, file.id, { 
            status: 'completed', 
            progress: 100 
          }));

          onUploadComplete?.(file.id, result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          
          setFiles(prev => updateFile(prev, file.id, { 
            status: 'error', 
            error: errorMessage 
          }));

          onUploadError?.(file.id, errorMessage);
        }
      }

      setIsUploading(false);
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
      <div ref={ref} className={cn('space-y-4', className)} {...props}>
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

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              Valda filer ({files.length})
            </h3>
            
            <div className="space-y-2">
              {files.map((file) => (
                <FilePreview
                  key={file.id}
                  file={file}
                  onRemove={handleFileRemove}
                  showRemove={!isUploading || file.status !== 'uploading'}
                />
              ))}
            </div>

            {/* Upload controls */}
            {uploadFunction && files.some(f => f.status === 'pending') && (
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {files.filter(f => f.status === 'pending').length} filer redo att laddas upp
                </p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFiles([])}
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
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

FileUpload.displayName = 'FileUpload';

export default FileUpload;