'use client';

import * as React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Pause, 
  Play, 
  X, 
  RotateCcw,
  Clock,
  Zap,
  FileText,
  TrendingUp,
  Users
} from 'lucide-react';
import { BatchProgressProps, UploadFile, BatchUploadProgress } from './types';
import { 
  formatFileSize, 
  formatUploadSpeed, 
  formatTimeRemaining,
  swedishTexts 
} from './translations';
import { ProgressTracker } from './progress-tracker';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * Batch upload progress component with overall status and individual file tracking
 * Shows comprehensive batch upload statistics and controls
 */
export const BatchProgress = React.forwardRef<HTMLDivElement, BatchProgressProps>(
  ({
    files,
    showIndividualProgress = true,
    showBatchControls = true,
    className,
    onCancelAll,
    onPauseAll,
    onResumeAll,
    onRetryAll,
    ...props
  }, ref) => {
    const [showDetails, setShowDetails] = React.useState(false);

    // Calculate batch statistics
    const batchStats = React.useMemo((): BatchUploadProgress => {
      const total = files.length;
      const completed = files.filter(f => f.status === 'completed').length;
      const uploading = files.filter(f => f.status === 'uploading').length;
      const pending = files.filter(f => f.status === 'pending').length;
      const failed = files.filter(f => f.status === 'error').length;
      const cancelled = files.filter(f => f.status === 'cancelled').length;
      const paused = files.filter(f => f.status === 'paused').length;

      // Calculate overall progress
      const totalProgress = files.reduce((sum, file) => sum + file.progress, 0);
      const overallProgress = total > 0 ? Math.round(totalProgress / total) : 0;

      // Calculate average speed and time remaining
      const activeUploads = files.filter(f => f.status === 'uploading' && f.uploadSpeed);
      const averageSpeed = activeUploads.length > 0 
        ? activeUploads.reduce((sum, file) => sum + (file.uploadSpeed || 0), 0) / activeUploads.length
        : 0;

      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const uploadedSize = files.reduce((sum, file) => sum + (file.bytesUploaded || 0), 0);
      const remainingSize = totalSize - uploadedSize;
      const estimatedTimeRemaining = averageSpeed > 0 ? (remainingSize / averageSpeed) * 1000 : 0;

      return {
        total,
        completed,
        uploading,
        pending,
        failed,
        cancelled,
        paused,
        overallProgress,
        averageSpeed,
        estimatedTimeRemaining
      };
    }, [files]);

    // Get batch status
    const getBatchStatus = () => {
      if (batchStats.total === batchStats.completed) {
        return { status: 'completed', text: swedishTexts.batch.allComplete, icon: CheckCircle2, color: 'text-green-500' };
      } else if (batchStats.failed > 0 && batchStats.uploading === 0 && batchStats.pending === 0) {
        return { status: 'error', text: swedishTexts.batch.someErrors, icon: XCircle, color: 'text-destructive' };
      } else if (batchStats.total === batchStats.cancelled) {
        return { status: 'cancelled', text: swedishTexts.batch.allCancelled, icon: X, color: 'text-muted-foreground' };
      } else if (batchStats.uploading > 0) {
        return { status: 'uploading', text: `${batchStats.uploading} ${swedishTexts.batch.uploadingFiles}`, icon: TrendingUp, color: 'text-primary' };
      } else if (batchStats.paused > 0) {
        return { status: 'paused', text: `${batchStats.paused} filer pausade`, icon: Pause, color: 'text-orange-500' };
      } else {
        return { status: 'pending', text: `${batchStats.pending} filer väntar`, icon: Clock, color: 'text-muted-foreground' };
      }
    };

    const batchStatus = getBatchStatus();
    const StatusIcon = batchStatus.icon;

    // Calculate total uploaded size
    const totalUploadedSize = files.reduce((sum, file) => sum + (file.bytesUploaded || 0), 0);
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    return (
      <Card
        ref={ref}
        className={cn(
          'transition-all duration-200',
          batchStatus.status === 'completed' && 'border-green-200 bg-green-50',
          batchStatus.status === 'error' && 'border-destructive/20 bg-destructive/5',
          batchStatus.status === 'uploading' && 'border-primary/20 bg-primary/5',
          className
        )}
        {...props}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon className={cn('h-5 w-5', batchStatus.color)} />
              <div>
                <CardTitle className="text-lg">
                  {swedishTexts.batch.totalFiles}: {batchStats.total}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {batchStatus.text}
                </p>
              </div>
            </div>

            {/* Batch controls */}
            {showBatchControls && (
              <div className="flex items-center gap-2">
                {batchStats.uploading > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPauseAll}
                    disabled={!onPauseAll}
                  >
                    <Pause className="h-3 w-3 mr-1" />
                    {swedishTexts.pauseAllText}
                  </Button>
                )}
                
                {batchStats.paused > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onResumeAll}
                    disabled={!onResumeAll}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    {swedishTexts.resumeAllText}
                  </Button>
                )}
                
                {batchStats.failed > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetryAll}
                    disabled={!onRetryAll}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Försök igen alla
                  </Button>
                )}
                
                {(batchStats.uploading > 0 || batchStats.pending > 0 || batchStats.paused > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancelAll}
                    disabled={!onCancelAll}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-3 w-3 mr-1" />
                    {swedishTexts.cancelAllText}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Overall progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Totalt framsteg: {batchStats.overallProgress}%
              </span>
              <span className="text-muted-foreground">
                {formatFileSize(totalUploadedSize)} / {formatFileSize(totalSize)}
              </span>
            </div>
            
            <Progress 
              value={batchStats.overallProgress} 
              className="h-3"
              aria-label={`Overall progress: ${batchStats.overallProgress}%`}
            />
          </div>

          {/* Statistics badges */}
          <div className="flex flex-wrap gap-2">
            {batchStats.completed > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {batchStats.completed} {swedishTexts.batch.completedFiles}
              </Badge>
            )}
            
            {batchStats.uploading > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <TrendingUp className="h-3 w-3 mr-1" />
                {batchStats.uploading} {swedishTexts.batch.uploadingFiles}
              </Badge>
            )}
            
            {batchStats.pending > 0 && (
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                {batchStats.pending} väntar
              </Badge>
            )}
            
            {batchStats.paused > 0 && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                <Pause className="h-3 w-3 mr-1" />
                {batchStats.paused} pausade
              </Badge>
            )}
            
            {batchStats.failed > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                <XCircle className="h-3 w-3 mr-1" />
                {batchStats.failed} {swedishTexts.batch.failedFiles}
              </Badge>
            )}
            
            {batchStats.cancelled > 0 && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                <X className="h-3 w-3 mr-1" />
                {batchStats.cancelled} {swedishTexts.batch.cancelledFiles}
              </Badge>
            )}
          </div>

          {/* Performance metrics */}
          {(batchStats.averageSpeed > 0 || batchStats.estimatedTimeRemaining > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
              {batchStats.averageSpeed > 0 && (
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Genomsnittlig hastighet</p>
                    <p className="text-sm font-medium">
                      {formatUploadSpeed(batchStats.averageSpeed)}
                    </p>
                  </div>
                </div>
              )}
              
              {batchStats.estimatedTimeRemaining > 0 && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Uppskattad återstående tid</p>
                    <p className="text-sm font-medium">
                      {formatTimeRemaining(batchStats.estimatedTimeRemaining)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Individual file progress */}
          {showIndividualProgress && files.length > 0 && (
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Individuell filframsteg ({files.length} filer)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {showDetails ? 'Dölj' : 'Visa'}
                    </span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent className="space-y-2 mt-2">
                <Separator />
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {files.map((file) => (
                    <ProgressTracker
                      key={file.id}
                      file={file}
                      compact
                      showDetails={false}
                      className="border-0 bg-background/50"
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    );
  }
);

BatchProgress.displayName = 'BatchProgress';

export default BatchProgress;