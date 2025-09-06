'use client';

import * as React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Pause, 
  Play, 
  X, 
  RotateCcw,
  Clock,
  Zap,
  AlertCircle,
  FileText
} from 'lucide-react';
import { ProgressTrackerProps } from './types';
import { 
  formatFileSize, 
  formatUploadSpeed, 
  formatTimeRemaining, 
  getStatusDisplayText,
  swedishTexts 
} from './translations';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Advanced progress tracker component with animations and Swedish text
 * Displays detailed upload progress with cancel, pause/resume, and retry functionality
 */
export const ProgressTracker = React.forwardRef<HTMLDivElement, ProgressTrackerProps>(
  ({
    file,
    showDetails = true,
    showCancel = true,
    showPauseResume = true,
    showRetry = true,
    compact = false,
    className,
    onCancel,
    onPause,
    onResume,
    onRetry,
    ...props
  }, ref) => {
    // Animation states
    const [isAnimating, setIsAnimating] = React.useState(false);
    const [previousProgress, setPreviousProgress] = React.useState(file.progress);

    // Progress animation effect
    React.useEffect(() => {
      if (file.progress !== previousProgress) {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 300);
        setPreviousProgress(file.progress);
        return () => clearTimeout(timer);
      }
    }, [file.progress, previousProgress]);

    // Get status icon and color
    const getStatusIcon = () => {
      switch (file.status) {
        case 'completed':
          return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'error':
          return <XCircle className="h-4 w-4 text-destructive" />;
        case 'cancelled':
          return <X className="h-4 w-4 text-muted-foreground" />;
        case 'paused':
          return <Pause className="h-4 w-4 text-orange-500" />;
        case 'uploading':
          return (
            <div className="relative">
              <div className={cn(
                "h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin",
                isAnimating && "animate-pulse"
              )} />
            </div>
          );
        default:
          return <Clock className="h-4 w-4 text-muted-foreground" />;
      }
    };

    // Get status color class
    const getStatusColor = () => {
      switch (file.status) {
        case 'completed':
          return 'border-green-200 bg-green-50';
        case 'error':
          return 'border-destructive/20 bg-destructive/5';
        case 'cancelled':
          return 'border-muted bg-muted/50';
        case 'paused':
          return 'border-orange-200 bg-orange-50';
        case 'uploading':
          return 'border-primary/20 bg-primary/5';
        default:
          return 'border-border bg-background';
      }
    };

    // Handle action buttons
    const handleCancel = () => {
      if (onCancel && file.status === 'uploading') {
        onCancel(file.id);
      }
    };

    const handlePause = () => {
      if (onPause && file.status === 'uploading') {
        onPause(file.id);
      }
    };

    const handleResume = () => {
      if (onResume && file.status === 'paused') {
        onResume(file.id);
      }
    };

    const handleRetry = () => {
      if (onRetry && (file.status === 'error' || file.canRetry)) {
        onRetry(file.id);
      }
    };

    // Render compact version
    if (compact) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex items-center gap-2 p-2 rounded-md transition-colors',
            getStatusColor(),
            className
          )}
          {...props}
        >
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress 
                value={file.progress} 
                className={cn(
                  "h-1 flex-1",
                  isAnimating && "transition-all duration-300"
                )}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {file.progress}%
              </span>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {showPauseResume && file.status === 'uploading' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePause}
                    className="h-6 w-6 p-0"
                    aria-label={swedishTexts.pauseText}
                  >
                    <Pause className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{swedishTexts.pauseText}</TooltipContent>
              </Tooltip>
            )}
            
            {showPauseResume && file.status === 'paused' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResume}
                    className="h-6 w-6 p-0"
                    aria-label={swedishTexts.resumeText}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{swedishTexts.resumeText}</TooltipContent>
              </Tooltip>
            )}
            
            {showRetry && (file.status === 'error' || file.canRetry) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRetry}
                    className="h-6 w-6 p-0"
                    aria-label={swedishTexts.retryText}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{swedishTexts.retryText}</TooltipContent>
              </Tooltip>
            )}
            
            {showCancel && file.status === 'uploading' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    aria-label={swedishTexts.cancelText}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{swedishTexts.cancelText}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      );
    }

    // Render detailed version
    return (
      <Card
        ref={ref}
        className={cn(
          'transition-all duration-200',
          getStatusColor(),
          isAnimating && 'ring-2 ring-primary/20',
          className
        )}
        {...props}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {getStatusIcon()}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate" title={file.name}>
                  {file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {getStatusDisplayText(file.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              {showPauseResume && file.status === 'uploading' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePause}
                      aria-label={swedishTexts.pauseText}
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      {swedishTexts.pauseText}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{swedishTexts.pauseText}</TooltipContent>
                </Tooltip>
              )}
              
              {showPauseResume && file.status === 'paused' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResume}
                      aria-label={swedishTexts.resumeText}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      {swedishTexts.resumeText}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{swedishTexts.resumeText}</TooltipContent>
                </Tooltip>
              )}
              
              {showRetry && (file.status === 'error' || file.canRetry) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      aria-label={swedishTexts.retryText}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {swedishTexts.retryText}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{swedishTexts.retryText}</TooltipContent>
                </Tooltip>
              )}
              
              {showCancel && (file.status === 'uploading' || file.status === 'paused') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      className="text-destructive hover:text-destructive"
                      aria-label={swedishTexts.cancelText}
                    >
                      <X className="h-3 w-3 mr-1" />
                      {swedishTexts.cancelText}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{swedishTexts.cancelText}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {file.progress}%
              </span>
              {file.bytesUploaded && (
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.bytesUploaded)} / {formatFileSize(file.size)}
                </span>
              )}
            </div>
            
            <Progress 
              value={file.progress} 
              className={cn(
                "h-2",
                isAnimating && "transition-all duration-300"
              )}
              aria-label={`Upload progress: ${file.progress}%`}
            />
          </div>

          {/* Details */}
          {showDetails && (
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              {/* Upload speed */}
              {file.uploadSpeed && file.status === 'uploading' && (
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  <span>{formatUploadSpeed(file.uploadSpeed)}</span>
                </div>
              )}
              
              {/* Time remaining */}
              {file.estimatedTimeRemaining && file.status === 'uploading' && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimeRemaining(file.estimatedTimeRemaining)}</span>
                </div>
              )}
              
              {/* Retry count */}
              {file.retryCount && file.retryCount > 0 && (
                <div className="flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" />
                  <span>Försök {file.retryCount}</span>
                </div>
              )}
              
              {/* Chunk info for large files */}
              {file.chunks && (
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>
                    {file.chunks.uploaded} / {file.chunks.total} block
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {file.error && file.status === 'error' && (
            <div className="mt-3 p-2 rounded-md bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{file.error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

ProgressTracker.displayName = 'ProgressTracker';

export default ProgressTracker;