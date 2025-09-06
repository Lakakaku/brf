'use client';

import * as React from 'react';
import { Eye, File, X, BarChart } from 'lucide-react';
import { FolderPreviewProps } from './types';
import { swedishTexts, formatFileSize, getFileTypeDisplayName } from './translations';
import { getFileIcon } from './utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * FolderPreview component - detailed preview of folder contents before upload
 */
export const FolderPreview = React.forwardRef<HTMLDivElement, FolderPreviewProps>(
  ({
    folder,
    showFileDetails = true,
    showStatistics = true,
    allowFileRemoval = false,
    className,
    onFileRemove,
    onFolderChange,
  }, ref) => {
    
    // Calculate folder statistics
    const statistics = React.useMemo(() => {
      const fileTypes = new Map<string, number>();
      const fileSizes = new Map<string, number>();
      let totalSize = 0;

      const processFolder = (f: typeof folder) => {
        f.files.forEach(file => {
          const type = file.type || 'unknown';
          fileTypes.set(type, (fileTypes.get(type) || 0) + 1);
          fileSizes.set(type, (fileSizes.get(type) || 0) + file.size);
          totalSize += file.size;
        });

        f.children.forEach(processFolder);
      };

      processFolder(folder);

      return {
        totalFiles: folder.totalFiles,
        totalSize,
        fileTypes: Array.from(fileTypes.entries()).map(([type, count]) => ({
          type,
          count,
          size: fileSizes.get(type) || 0,
          displayName: getFileTypeDisplayName(type),
        })),
        averageFileSize: folder.totalFiles > 0 ? totalSize / folder.totalFiles : 0,
      };
    }, [folder]);

    // Handle file removal
    const handleFileRemove = (fileId: string) => {
      if (!allowFileRemoval || !onFileRemove) return;
      onFileRemove(fileId);
    };

    // Render file list for a folder
    const renderFileList = (files: typeof folder.files, depth = 0) => {
      if (files.length === 0) return null;

      return (
        <div className={cn('space-y-1', depth > 0 && 'ml-4')}>
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="text-lg">{getFileIcon(file.file)}</div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={file.name}>
                  {file.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(file.size)}</span>
                  <Separator orientation="vertical" className="h-3" />
                  <span>{getFileTypeDisplayName(file.type)}</span>
                </div>
              </div>

              {allowFileRemoval && onFileRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleFileRemove(file.id)}
                  aria-label={`Ta bort ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      );
    };

    // Render folder structure recursively
    const renderFolderStructure = (f: typeof folder, depth = 0) => {
      return (
        <div key={f.id} className="space-y-2">
          <div className={cn('font-medium text-sm', depth > 0 && 'ml-4')}>
            📁 {f.name}
            {f.files.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {f.files.length} {f.files.length === 1 ? 'fil' : 'filer'}
              </Badge>
            )}
          </div>
          
          {renderFileList(f.files, depth)}
          
          {f.children.map(child => renderFolderStructure(child, depth + 1))}
        </div>
      );
    };

    return (
      <Card ref={ref} className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" />
            {swedishTexts.folders.folderPreview}: {folder.name}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Quick statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">{statistics.totalFiles}</div>
              <p className="text-xs text-muted-foreground">
                {statistics.totalFiles === 1 ? 'Fil' : 'Filer'}
              </p>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">{formatFileSize(statistics.totalSize)}</div>
              <p className="text-xs text-muted-foreground">Total storlek</p>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">{folder.children.length + 1}</div>
              <p className="text-xs text-muted-foreground">
                {folder.children.length === 0 ? 'Mapp' : 'Mappar'}
              </p>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">{formatFileSize(statistics.averageFileSize)}</div>
              <p className="text-xs text-muted-foreground">Genomsnittsstorlek</p>
            </div>
          </div>

          {/* File type breakdown */}
          {showStatistics && statistics.fileTypes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <BarChart className="h-4 w-4" />
                Filtyper
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead className="text-right">Antal</TableHead>
                    <TableHead className="text-right">Storlek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statistics.fileTypes
                    .sort((a, b) => b.count - a.count)
                    .map((typeInfo) => (
                      <TableRow key={typeInfo.type}>
                        <TableCell className="font-medium">
                          {typeInfo.displayName}
                        </TableCell>
                        <TableCell className="text-right">{typeInfo.count}</TableCell>
                        <TableCell className="text-right">
                          {formatFileSize(typeInfo.size)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Detailed file list */}
          {showFileDetails && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <File className="h-4 w-4" />
                Fildetaljer
              </h4>
              
              <ScrollArea className="h-64 w-full border rounded-md p-2">
                {renderFolderStructure(folder)}
              </ScrollArea>
            </div>
          )}

          {/* Empty folder message */}
          {folder.totalFiles === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{swedishTexts.folders.emptyFolder}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

FolderPreview.displayName = 'FolderPreview';

export default FolderPreview;