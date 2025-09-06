'use client';

import * as React from 'react';
import { X, FileText, Download, AlertCircle } from 'lucide-react';
import { FilePreviewProps } from './types';
import { formatBytes, isImageFile, getFileIcon } from './utils';
import { swedishTexts } from './translations';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/**
 * FilePreview component - displays individual file with preview, status, and controls
 */
export const FilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  ({ file, showRemove = true, onRemove, className }, ref) => {
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [previewError, setPreviewError] = React.useState(false);

    // Generate preview for image files
    React.useEffect(() => {
      if (isImageFile(file.file)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string);
        };
        reader.onerror = () => {
          setPreviewError(true);
        };
        reader.readAsDataURL(file.file);
      }
    }, [file.file]);

    // Cleanup preview URL
    React.useEffect(() => {
      return () => {
        if (previewUrl && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
      };
    }, [previewUrl]);

    const handleRemove = () => {
      if (onRemove) {
        onRemove(file.id);
      }
    };

    const getStatusColor = () => {
      switch (file.status) {
        case 'completed':
          return 'text-green-600 dark:text-green-400';
        case 'error':
          return 'text-red-600 dark:text-red-400';
        case 'uploading':
          return 'text-blue-600 dark:text-blue-400';
        default:
          return 'text-muted-foreground';
      }
    };

    const getStatusText = () => {
      switch (file.status) {
        case 'completed':
          return swedishTexts.status.completed;
        case 'error':
          return file.error || swedishTexts.status.error;
        case 'uploading':
          return `${swedishTexts.status.uploading} ${file.progress}%`;
        default:
          return swedishTexts.status.pending;
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50',
          file.status === 'error' && 'border-destructive/50 bg-destructive/5',
          file.status === 'completed' && 'border-green-500/50 bg-green-500/5',
          className
        )}
      >
        {/* File Preview/Icon */}
        <div className="flex-shrink-0">
          {previewUrl && !previewError ? (
            <div className="relative h-12 w-12 overflow-hidden rounded-md border">
              <img
                src={previewUrl}
                alt={file.name}
                className="h-full w-full object-cover"
                onError={() => setPreviewError(true)}
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted">
              <span className="text-xl" role="img" aria-label="File icon">
                {getFileIcon(file.file)}
              </span>
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {file.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatBytes(file.size)}</span>
                <span>•</span>
                <span className={getStatusColor()}>
                  {getStatusText()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {file.status === 'error' && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              
              {showRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  title={swedishTexts.removeText}
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">{swedishTexts.removeText}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {file.status === 'uploading' && (
            <div className="mt-2">
              <Progress value={file.progress} className="h-1" />
            </div>
          )}

          {/* Error Message */}
          {file.status === 'error' && file.error && (
            <p className="mt-1 text-xs text-destructive">
              {file.error}
            </p>
          )}
        </div>
      </div>
    );
  }
);

FilePreview.displayName = 'FilePreview';

export default FilePreview;