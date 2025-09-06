'use client';

import { useState, useCallback, useRef } from 'react';
import { 
  FolderStructure, 
  FolderUploadFile, 
  FolderUploadOptions, 
  FolderValidationResult,
  BRFFolderTemplate 
} from './types';
import {
  isFileSystemAccessSupported,
  processDirectoryHandle,
  getFoldersFromDragEvent,
  createFolderStructureFromFiles,
  validateFolderStructure,
  flattenFolderStructure,
  updateFolder,
  removeFolderById,
  calculateFolderProgress,
  getBRFFolderTemplates,
} from './utils';
import { swedishTexts } from './translations';

export interface UseFolderUploadConfig {
  /** Maximum folder depth allowed */
  maxFolderDepth?: number;
  /** Maximum number of files per folder */
  maxFilesPerFolder?: number;
  /** Maximum total number of files */
  maxTotalFiles?: number;
  /** Maximum total size in bytes */
  maxTotalSize?: number;
  /** Enable File System Access API */
  useFileSystemAccess?: boolean;
  /** Callback when folders are selected */
  onFoldersSelect?: (folders: FolderStructure[]) => void;
  /** Callback when folder validation fails */
  onValidationError?: (result: FolderValidationResult) => void;
  /** Custom folder upload function */
  folderUploadFunction?: (folder: FolderStructure, options?: FolderUploadOptions) => Promise<any>;
}

export interface UseFolderUploadReturn {
  /** Current folder structures */
  folders: FolderStructure[];
  /** Whether folder selection is in progress */
  isSelecting: boolean;
  /** Whether any folder is currently uploading */
  isUploading: boolean;
  /** Validation errors */
  errors: string[];
  /** Available BRF templates */
  brfTemplates: BRFFolderTemplate[];
  /** File System Access API support */
  fileSystemAccessSupported: boolean;
  /** Select folders using File System Access API */
  selectFoldersWithPicker: () => Promise<void>;
  /** Handle folder drag and drop */
  handleFolderDrop: (event: DragEvent) => Promise<void>;
  /** Handle folder input change (fallback) */
  handleFolderInputChange: (files: FileList) => void;
  /** Add folders to the current list */
  addFolders: (newFolders: FolderStructure[]) => void;
  /** Remove folder by ID */
  removeFolder: (folderId: string) => void;
  /** Update folder */
  updateFolderState: (folderId: string, updates: Partial<FolderStructure>) => void;
  /** Clear all folders */
  clearFolders: () => void;
  /** Validate current folders */
  validateFolders: () => FolderValidationResult;
  /** Upload all folders */
  uploadFolders: (options?: FolderUploadOptions) => Promise<void>;
  /** Apply BRF template */
  applyTemplate: (template: BRFFolderTemplate) => void;
  /** Get flattened file list */
  getAllFiles: () => FolderUploadFile[];
  /** Get total folder statistics */
  getStatistics: () => {
    totalFolders: number;
    totalFiles: number;
    totalSize: number;
    uploadProgress: number;
  };
}

/**
 * Custom hook for folder upload functionality
 */
export function useFolderUpload(config: UseFolderUploadConfig = {}): UseFolderUploadReturn {
  const {
    maxFolderDepth = 10,
    maxFilesPerFolder = 1000,
    maxTotalFiles = 5000,
    maxTotalSize = 500 * 1024 * 1024, // 500MB
    useFileSystemAccess = true,
    onFoldersSelect,
    onValidationError,
    folderUploadFunction,
  } = config;

  const [folders, setFolders] = useState<FolderStructure[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const uploadControllers = useRef<Map<string, AbortController>>(new Map());
  const brfTemplates = getBRFFolderTemplates();
  const fileSystemAccessSupported = isFileSystemAccessSupported();

  /**
   * Validate folders and update errors
   */
  const validateFolders = useCallback((): FolderValidationResult => {
    const result = validateFolderStructure(folders, {
      maxDepth: maxFolderDepth,
      maxFilesPerFolder,
      maxTotalFiles,
      maxTotalSize,
    });

    setErrors(result.errors);
    
    if (!result.isValid && onValidationError) {
      onValidationError(result);
    }

    return result;
  }, [folders, maxFolderDepth, maxFilesPerFolder, maxTotalFiles, maxTotalSize, onValidationError]);

  /**
   * Add folders to the current list
   */
  const addFolders = useCallback((newFolders: FolderStructure[]) => {
    setFolders(prev => [...prev, ...newFolders]);
    onFoldersSelect?.(newFolders);
  }, [onFoldersSelect]);

  /**
   * Select folders using File System Access API
   */
  const selectFoldersWithPicker = useCallback(async () => {
    if (!fileSystemAccessSupported || !useFileSystemAccess) {
      setErrors([swedishTexts.folders.folderNotSupported]);
      return;
    }

    try {
      setIsSelecting(true);
      setErrors([]);

      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
        // @ts-ignore - startIn not in types yet
        startIn: 'documents',
      });

      const folderStructure = await processDirectoryHandle(dirHandle);
      addFolders([folderStructure]);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error selecting folder:', error);
        setErrors([error.message || swedishTexts.folders.fileSystemAccessDenied]);
      }
    } finally {
      setIsSelecting(false);
    }
  }, [fileSystemAccessSupported, useFileSystemAccess, addFolders]);

  /**
   * Handle folder drag and drop
   */
  const handleFolderDrop = useCallback(async (event: DragEvent) => {
    try {
      setIsSelecting(true);
      setErrors([]);

      const folderStructures = await getFoldersFromDragEvent(event);
      if (folderStructures.length > 0) {
        addFolders(folderStructures);
      }
    } catch (error: any) {
      console.error('Error processing dropped folders:', error);
      setErrors([error.message || swedishTexts.errors.uploadFailed]);
    } finally {
      setIsSelecting(false);
    }
  }, [addFolders]);

  /**
   * Handle folder input change (fallback for browsers without File System Access)
   */
  const handleFolderInputChange = useCallback((files: FileList) => {
    try {
      setIsSelecting(true);
      setErrors([]);

      const fileArray = Array.from(files);
      const folderStructures = createFolderStructureFromFiles(fileArray);
      
      if (folderStructures.length > 0) {
        addFolders(folderStructures);
      }
    } catch (error: any) {
      console.error('Error processing folder input:', error);
      setErrors([error.message || swedishTexts.errors.uploadFailed]);
    } finally {
      setIsSelecting(false);
    }
  }, [addFolders]);

  /**
   * Remove folder by ID
   */
  const removeFolder = useCallback((folderId: string) => {
    // Cancel any ongoing uploads for this folder
    const controller = uploadControllers.current.get(folderId);
    if (controller) {
      controller.abort();
      uploadControllers.current.delete(folderId);
    }

    setFolders(prev => removeFolderById(prev, folderId));
  }, []);

  /**
   * Update folder state
   */
  const updateFolderState = useCallback((folderId: string, updates: Partial<FolderStructure>) => {
    setFolders(prev => updateFolder(prev, folderId, updates));
  }, []);

  /**
   * Clear all folders
   */
  const clearFolders = useCallback(() => {
    // Cancel all uploads
    uploadControllers.current.forEach(controller => controller.abort());
    uploadControllers.current.clear();
    
    setFolders([]);
    setErrors([]);
  }, []);

  /**
   * Upload all folders
   */
  const uploadFolders = useCallback(async (options: FolderUploadOptions = {}) => {
    if (!folderUploadFunction) {
      setErrors([swedishTexts.errors.uploadFailed]);
      return;
    }

    // Validate first
    const validation = validateFolders();
    if (!validation.isValid) {
      return;
    }

    setIsUploading(true);

    try {
      for (const folder of folders) {
        if (folder.status !== 'pending') continue;

        const controller = new AbortController();
        uploadControllers.current.set(folder.id, controller);

        // Update folder status
        updateFolderState(folder.id, { 
          status: 'uploading', 
          progress: 0 
        });

        try {
          await folderUploadFunction(folder, {
            ...options,
            controller,
          });

          // Update to completed
          updateFolderState(folder.id, { 
            status: 'completed', 
            progress: 100 
          });
        } catch (error: any) {
          if (error.name === 'AbortError') {
            updateFolderState(folder.id, { 
              status: 'cancelled' 
            });
          } else {
            updateFolderState(folder.id, { 
              status: 'error',
              progress: 0 
            });
          }
          throw error;
        } finally {
          uploadControllers.current.delete(folder.id);
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      if (error.name !== 'AbortError') {
        setErrors([error.message || swedishTexts.folders.folderUploadFailed]);
      }
    } finally {
      setIsUploading(false);
    }
  }, [folders, folderUploadFunction, validateFolders, updateFolderState]);

  /**
   * Apply BRF template
   */
  const applyTemplate = useCallback((template: BRFFolderTemplate) => {
    // This would create a folder structure based on the template
    // For now, we'll just log the template
    console.log('Applying template:', template);
  }, []);

  /**
   * Get flattened file list from all folders
   */
  const getAllFiles = useCallback((): FolderUploadFile[] => {
    return flattenFolderStructure(folders);
  }, [folders]);

  /**
   * Get total statistics
   */
  const getStatistics = useCallback(() => {
    const totalFolders = folders.length;
    const totalFiles = folders.reduce((sum, folder) => sum + folder.totalFiles, 0);
    const totalSize = folders.reduce((sum, folder) => sum + folder.totalSize, 0);
    
    // Calculate overall upload progress
    let totalProgress = 0;
    let completedFolders = 0;
    
    folders.forEach(folder => {
      const folderProgress = calculateFolderProgress(folder);
      totalProgress += folderProgress;
      if (folder.status === 'completed') {
        completedFolders++;
      }
    });
    
    const uploadProgress = totalFolders > 0 ? Math.round(totalProgress / totalFolders) : 0;

    return {
      totalFolders,
      totalFiles,
      totalSize,
      uploadProgress,
    };
  }, [folders]);

  return {
    folders,
    isSelecting,
    isUploading,
    errors,
    brfTemplates,
    fileSystemAccessSupported,
    selectFoldersWithPicker,
    handleFolderDrop,
    handleFolderInputChange,
    addFolders,
    removeFolder,
    updateFolderState: updateFolderState,
    clearFolders,
    validateFolders,
    uploadFolders,
    applyTemplate,
    getAllFiles,
    getStatistics,
  };
}

export default useFolderUpload;