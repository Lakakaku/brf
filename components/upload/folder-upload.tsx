'use client';

import * as React from 'react';
import { 
  Upload, 
  FolderPlus, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  Archive,
  BarChart3
} from 'lucide-react';
import { FolderUploadProps, DropzoneState } from './types';
import { 
  hasFolders,
  hasFiles 
} from './utils';
import { swedishTexts } from './translations';
import { useFolderUpload } from './use-folder-upload';
import { FolderTree } from './folder-tree';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * FolderUpload component - comprehensive folder upload with directory support
 * Supports File System Access API with graceful fallback for older browsers
 */
export const FolderUpload = React.forwardRef<HTMLDivElement, FolderUploadProps>(
  ({
    accept,
    multiple = true,
    maxSize = 100 * 1024 * 1024, // 100MB default for folders
    maxFiles = 1000,
    disabled = false,
    className,
    enableFolderUpload = true,
    showFolderTree = true,
    enableCompression = false,
    maxFolderDepth = 10,
    maxFilesPerFolder = 500,
    brfTemplates = [],
    useFileSystemAccess = true,
    onFoldersSelect,
    onFolderRemove,
    onFolderStructureChange,
    folderUploadFunction,
    ...props
  }, ref) => {
    const [dropzoneState, setDropzoneState] = React.useState<DropzoneState>({
      isDragOver: false,
      isDragActive: false,
      isDragAccept: false,
      isDragReject: false,
    });

    const [preserveStructure, setPreserveStructure] = React.useState(true);
    const [compressBeforeUpload, setCompressBeforeUpload] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('folders');

    const dropzoneRef = React.useRef<HTMLDivElement>(null);
    const folderInputRef = React.useRef<HTMLInputElement>(null);

    // Use the folder upload hook
    const {
      folders,
      isSelecting,
      isUploading,
      errors,
      brfTemplates: templates,
      fileSystemAccessSupported,
      selectFoldersWithPicker,
      handleFolderDrop,
      handleFolderInputChange,
      removeFolder,
      clearFolders,
      validateFolders,
      uploadFolders,
      getStatistics,
    } = useFolderUpload({
      maxFolderDepth,
      maxFilesPerFolder,
      maxTotalFiles: maxFiles,
      maxTotalSize: maxSize,
      useFileSystemAccess,
      onFoldersSelect,
      folderUploadFunction,
    });

    const statistics = getStatistics();

    // Handle drag events
    const handleDragEnter = React.useCallback((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (disabled) return;
      
      const hasFoldersInEvent = hasFolders(e);
      const hasFilesInEvent = hasFiles(e);
      const hasValidContent = hasFoldersInEvent || hasFilesInEvent;
      
      setDropzoneState(prev => ({
        ...prev,
        isDragOver: true,
        isDragActive: hasValidContent,
        isDragAccept: hasValidContent && !disabled,
        isDragReject: !hasValidContent || disabled,
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

    const handleDrop = React.useCallback(async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      setDropzoneState({
        isDragOver: false,
        isDragActive: false,
        isDragAccept: false,
        isDragReject: false,
      });
      
      if (disabled) return;
      
      await handleFolderDrop(e);
    }, [disabled, handleFolderDrop]);

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

    // Handle folder input change (fallback)
    const handleFolderInputChangeEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        handleFolderInputChange(files);
      }
      
      // Reset input
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    };

    // Handle browse folders click
    const handleBrowseFolders = () => {
      if (disabled) return;
      
      if (fileSystemAccessSupported && useFileSystemAccess) {
        selectFoldersWithPicker();
      } else {
        folderInputRef.current?.click();
      }
    };

    // Handle upload
    const handleUpload = async () => {
      const validation = validateFolders();
      if (!validation.isValid) {
        return;
      }

      await uploadFolders({
        preserveStructure,
        compress: compressBeforeUpload,
        compressionFormat: 'zip',
        compressionLevel: 6,
      });
    };

    // Generate helper text
    const getHelperText = () => {
      const parts: string[] = [];
      
      if (maxFolderDepth) {
        parts.push(`Max djup: ${maxFolderDepth} nivåer`);
      }
      
      if (maxFilesPerFolder) {
        parts.push(`Max ${maxFilesPerFolder} filer per mapp`);
      }
      
      return parts.join(' • ');
    };

    return (
      <TooltipProvider>
        <div ref={ref} className={cn('space-y-4', className)} {...props}>
          {/* File System Access support indicator */}
          {useFileSystemAccess && (
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
              <div className="flex items-center gap-2 text-sm">
                {fileSystemAccessSupported ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span>Avancerat mappstöd aktivt</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                    <span>Grundläggande mappstöd (äldre webbläsare)</span>
                  </>
                )}
              </div>
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
            onClick={handleBrowseFolders}
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
                  {dropzoneState.isDragActive ? (
                    <FolderPlus className="h-8 w-8" />
                  ) : (
                    <Upload className="h-8 w-8" />
                  )}
                </div>
                
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    {enableFolderUpload 
                      ? swedishTexts.folders.dropFolders
                      : swedishTexts.dragDropText
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {swedishTexts.orText}{' '}
                    <span className="font-medium text-primary hover:underline">
                      {enableFolderUpload 
                        ? swedishTexts.folders.browseFolders.toLowerCase()
                        : swedishTexts.browseText.toLowerCase()
                      }
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

          {/* Hidden folder input (fallback) */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore - webkitdirectory is not in the TS types
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFolderInputChangeEvent}
            disabled={disabled}
            className="hidden"
            aria-describedby="folder-upload-description"
          />

          {/* Loading state */}
          {isSelecting && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Bearbetar mappar...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error messages */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {errors.map((error, index) => (
                    <p key={index} className="text-sm">
                      {error}
                    </p>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Folders content */}
          {folders.length > 0 && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="folders">
                    Mappar ({folders.length})
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    Inställningar
                  </TabsTrigger>
                  <TabsTrigger value="statistics">
                    <BarChart3 className="h-4 w-4" />
                    Statistik
                  </TabsTrigger>
                </TabsList>

                {/* Upload controls */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={clearFolders}
                    disabled={isUploading}
                  >
                    {swedishTexts.cancelText}
                  </Button>
                  
                  {folderUploadFunction && (
                    <Button
                      onClick={handleUpload}
                      disabled={isUploading || folders.length === 0}
                    >
                      {isUploading ? 'Laddar upp...' : swedishTexts.uploadText}
                    </Button>
                  )}
                </div>
              </div>

              <TabsContent value="folders" className="mt-4">
                {showFolderTree && (
                  <FolderTree
                    folders={folders}
                    showFileCounts={true}
                    showSizes={true}
                    collapsible={true}
                    maxDepth={maxFolderDepth}
                    onFolderRemove={removeFolder}
                  />
                )}
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Uppladdningsinställningar</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>
                          {swedishTexts.folders.preserveStructure}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Behåll mappstrukturen på servern
                        </p>
                      </div>
                      <Switch
                        checked={preserveStructure}
                        onCheckedChange={setPreserveStructure}
                      />
                    </div>

                    {enableCompression && (
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">
                            <Archive className="h-4 w-4" />
                            {swedishTexts.folders.compressFolders}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Komprimera mappar som ZIP-filer före uppladdning
                          </p>
                        </div>
                        <Switch
                          checked={compressBeforeUpload}
                          onCheckedChange={setCompressBeforeUpload}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="statistics" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{statistics.totalFolders}</div>
                      <p className="text-sm text-muted-foreground">
                        {statistics.totalFolders === 1 ? 'Mapp' : 'Mappar'}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{statistics.totalFiles}</div>
                      <p className="text-sm text-muted-foreground">
                        {statistics.totalFiles === 1 ? 'Fil' : 'Filer'}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">
                        {(statistics.totalSize / (1024 * 1024)).toFixed(1)} MB
                      </div>
                      <p className="text-sm text-muted-foreground">Total storlek</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{statistics.uploadProgress}%</div>
                      <p className="text-sm text-muted-foreground">Uppladdning klar</p>
                      <Progress value={statistics.uploadProgress} className="mt-2" />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </TooltipProvider>
    );
  }
);

FolderUpload.displayName = 'FolderUpload';

export default FolderUpload;