'use client';

import * as React from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  File, 
  X, 
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { FolderTreeProps, FolderStructure } from './types';
import { swedishTexts, formatFileSize } from './translations';
import { calculateFolderProgress } from './utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FolderItemProps {
  folder: FolderStructure;
  depth: number;
  showFileCounts?: boolean;
  showSizes?: boolean;
  selectable?: boolean;
  collapsible?: boolean;
  maxDepth?: number;
  onFolderSelect?: (folderId: string, selected: boolean) => void;
  onFolderToggle?: (folderId: string, expanded: boolean) => void;
  onFolderRemove?: (folderId: string) => void;
}

/**
 * Individual folder item component with recursive children
 */
const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  depth,
  showFileCounts = true,
  showSizes = true,
  selectable = false,
  collapsible = true,
  maxDepth = Infinity,
  onFolderSelect,
  onFolderToggle,
  onFolderRemove,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(folder.expanded ?? true);
  const [isSelected, setIsSelected] = React.useState(folder.selected ?? false);

  const hasChildren = folder.children.length > 0;
  const shouldShowChildren = hasChildren && isExpanded && depth < maxDepth;
  const indentLevel = depth * 20;

  // Calculate folder progress for visual feedback
  const progress = folder.status === 'uploading' ? calculateFolderProgress(folder) : folder.progress || 0;

  // Handle expand/collapse
  const handleToggle = () => {
    if (!collapsible || !hasChildren) return;
    
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onFolderToggle?.(folder.id, newExpanded);
  };

  // Handle selection
  const handleSelect = (checked: boolean) => {
    setIsSelected(checked);
    onFolderSelect?.(folder.id, checked);
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (folder.status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (folder.status) {
      case 'uploading':
        return `${swedishTexts.status.uploading} (${progress}%)`;
      case 'completed':
        return swedishTexts.status.completed;
      case 'error':
        return swedishTexts.status.error;
      case 'paused':
        return swedishTexts.status.paused;
      case 'cancelled':
        return swedishTexts.status.cancelled;
      default:
        return swedishTexts.status.pending;
    }
  };

  return (
    <div className="select-none">
      {/* Folder row */}
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors",
          isSelected && "bg-primary/10 border border-primary/20",
          folder.status === 'error' && "bg-destructive/5",
          folder.status === 'completed' && "bg-green-50"
        )}
        style={{ paddingLeft: `${indentLevel + 8}px` }}
      >
        {/* Expand/collapse button */}
        {hasChildren && collapsible ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-transparent"
            onClick={handleToggle}
            aria-label={isExpanded ? swedishTexts.folders.collapseFolder : swedishTexts.folders.expandFolder}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-6" /> // Spacer for alignment
        )}

        {/* Selection checkbox */}
        {selectable && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleSelect}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            aria-label={`${swedishTexts.folders.selectFolder} ${folder.name}`}
          />
        )}

        {/* Folder icon */}
        <div className="flex-shrink-0">
          {isExpanded && hasChildren ? (
            <FolderOpen className="h-5 w-5 text-blue-500" />
          ) : (
            <Folder className="h-5 w-5 text-blue-600" />
          )}
        </div>

        {/* Folder name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate" title={folder.name}>
              {folder.name}
            </span>
            
            {/* Status icon */}
            {getStatusIcon()}
            
            {/* File count badge */}
            {showFileCounts && folder.totalFiles > 0 && (
              <Badge variant="secondary" className="text-xs">
                {folder.totalFiles} {folder.totalFiles === 1 ? 'fil' : 'filer'}
              </Badge>
            )}
            
            {/* Size badge */}
            {showSizes && folder.totalSize > 0 && (
              <Badge variant="outline" className="text-xs">
                {formatFileSize(folder.totalSize)}
              </Badge>
            )}
          </div>

          {/* Progress bar for uploading folders */}
          {folder.status === 'uploading' && (
            <div className="mt-1">
              <Progress value={progress} className="h-1" />
            </div>
          )}

          {/* Status text */}
          {folder.status && folder.status !== 'pending' && (
            <div className="text-xs text-muted-foreground mt-1">
              {getStatusText()}
            </div>
          )}
        </div>

        {/* Remove button */}
        {onFolderRemove && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onFolderRemove(folder.id)}
                aria-label={`${swedishTexts.folders.removeFolder} ${folder.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {swedishTexts.folders.removeFolder}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Child folders */}
      {shouldShowChildren && (
        <div className="ml-2">
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              showFileCounts={showFileCounts}
              showSizes={showSizes}
              selectable={selectable}
              collapsible={collapsible}
              maxDepth={maxDepth}
              onFolderSelect={onFolderSelect}
              onFolderToggle={onFolderToggle}
              onFolderRemove={onFolderRemove}
            />
          ))}
        </div>
      )}

      {/* Files in folder (show count only if folder is expanded) */}
      {isExpanded && folder.files.length > 0 && (
        <div className="ml-2">
          <div
            className="flex items-center gap-2 p-1 text-xs text-muted-foreground"
            style={{ paddingLeft: `${indentLevel + 28}px` }}
          >
            <File className="h-3 w-3" />
            <span>
              {folder.files.length} {folder.files.length === 1 ? 'fil' : 'filer'} i denna mapp
            </span>
          </div>
        </div>
      )}

      {/* Maximum depth reached indicator */}
      {hasChildren && depth >= maxDepth && (
        <div
          className="text-xs text-muted-foreground p-1 italic"
          style={{ paddingLeft: `${indentLevel + 28}px` }}
        >
          ... och {folder.children.length} undermappar (max djup nått)
        </div>
      )}
    </div>
  );
};

/**
 * FolderTree component - displays hierarchical folder structure
 * with support for selection, expansion/collapse, and file counts
 */
export const FolderTree = React.forwardRef<HTMLDivElement, FolderTreeProps>(
  ({
    folders,
    showFileCounts = true,
    showSizes = true,
    selectable = false,
    collapsible = true,
    maxDepth = 10,
    className,
    onFolderSelect,
    onFolderToggle,
    onFolderRemove,
  }, ref) => {
    if (folders.length === 0) {
      return (
        <div 
          ref={ref}
          className={cn(
            "flex flex-col items-center justify-center p-8 text-center text-muted-foreground border-2 border-dashed border-muted rounded-lg",
            className
          )}
        >
          <Folder className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-sm">Inga mappar valda</p>
          <p className="text-xs mt-1">Dra och släpp mappar eller klicka för att välja</p>
        </div>
      );
    }

    return (
      <div 
        ref={ref}
        className={cn("space-y-1 max-h-96 overflow-y-auto border rounded-lg bg-background", className)}
        role="tree"
        aria-label={swedishTexts.folders.folderStructure}
      >
        <div className="p-2 border-b bg-muted/30">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Folder className="h-4 w-4" />
            {swedishTexts.folders.folderStructure}
            <Badge variant="secondary" className="text-xs">
              {folders.length} {folders.length === 1 ? 'mapp' : 'mappar'}
            </Badge>
          </h4>
        </div>
        
        <div className="p-2">
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              depth={0}
              showFileCounts={showFileCounts}
              showSizes={showSizes}
              selectable={selectable}
              collapsible={collapsible}
              maxDepth={maxDepth}
              onFolderSelect={onFolderSelect}
              onFolderToggle={onFolderToggle}
              onFolderRemove={onFolderRemove}
            />
          ))}
        </div>
      </div>
    );
  }
);

FolderTree.displayName = 'FolderTree';

export default FolderTree;