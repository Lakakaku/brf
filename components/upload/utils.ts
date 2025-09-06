import { 
  UploadFile, 
  FileValidationResult, 
  FileUploadConfig, 
  FolderStructure, 
  FolderUploadFile,
  FolderValidationResult,
  BRFFolderTemplate 
} from './types';

/**
 * Utility functions for file upload handling
 */

/**
 * Generate a unique ID for a file
 */
export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert File object to UploadFile
 */
export function createUploadFile(file: File): UploadFile {
  return {
    id: generateFileId(),
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    progress: 0,
    status: 'pending',
  };
}

/**
 * Validate a file against upload configuration
 */
export function validateFile(
  file: File,
  config: Partial<FileUploadConfig>
): FileValidationResult {
  // Check file size
  if (config.maxFileSize && file.size > config.maxFileSize) {
    return {
      isValid: false,
      error: `File size ${formatBytes(file.size)} exceeds maximum allowed size of ${formatBytes(config.maxFileSize)}`,
    };
  }

  // Check file type
  if (config.acceptedTypes && config.acceptedTypes.length > 0) {
    const isAccepted = config.acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        // Extension check
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      } else {
        // MIME type check
        return file.type.toLowerCase().includes(type.toLowerCase()) || 
               file.type === type;
      }
    });

    if (!isAccepted) {
      return {
        isValid: false,
        error: `File type "${file.type}" is not accepted`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Validate multiple files
 */
export function validateFiles(
  files: File[],
  config: Partial<FileUploadConfig>,
  existingFiles: UploadFile[] = []
): { validFiles: File[]; errors: string[] } {
  const validFiles: File[] = [];
  const errors: string[] = [];

  // Check total file count
  if (config.maxFiles && existingFiles.length + files.length > config.maxFiles) {
    errors.push(`Cannot upload more than ${config.maxFiles} files total`);
    return { validFiles: [], errors };
  }

  files.forEach(file => {
    const validation = validateFile(file, config);
    if (validation.isValid) {
      validFiles.push(file);
    } else {
      errors.push(`${file.name}: ${validation.error}`);
    }
  });

  return { validFiles, errors };
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Create a preview URL for an image file
 */
export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      reject(new Error('File is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Get file icon based on file type
 */
export function getFileIcon(file: File): string {
  const extension = getFileExtension(file.name).toLowerCase();
  
  // Image files
  if (file.type.startsWith('image/')) {
    return '🖼️';
  }
  
  // Document files
  if (file.type.includes('pdf')) {
    return '📄';
  }
  
  if (file.type.includes('word') || extension === 'doc' || extension === 'docx') {
    return '📝';
  }
  
  if (file.type.includes('excel') || file.type.includes('spreadsheet') || 
      extension === 'xls' || extension === 'xlsx') {
    return '📊';
  }
  
  if (file.type.includes('powerpoint') || file.type.includes('presentation') || 
      extension === 'ppt' || extension === 'pptx') {
    return '📊';
  }
  
  // Archive files
  if (file.type.includes('zip') || file.type.includes('rar') || 
      file.type.includes('archive')) {
    return '🗜️';
  }
  
  // Video files
  if (file.type.startsWith('video/')) {
    return '🎥';
  }
  
  // Audio files
  if (file.type.startsWith('audio/')) {
    return '🎵';
  }
  
  // Text files
  if (file.type.startsWith('text/') || extension === 'txt') {
    return '📃';
  }
  
  // Default
  return '📎';
}

/**
 * Parse accept string to array of accepted types
 */
export function parseAcceptString(accept: string): string[] {
  return accept
    .split(',')
    .map(type => type.trim())
    .filter(type => type.length > 0);
}

/**
 * Check if drag event contains files
 */
export function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}

/**
 * Get files from drag event
 */
export function getFilesFromDragEvent(event: DragEvent): File[] {
  const files: File[] = [];
  
  if (event.dataTransfer?.files) {
    for (let i = 0; i < event.dataTransfer.files.length; i++) {
      const file = event.dataTransfer.files[i];
      if (file) {
        files.push(file);
      }
    }
  }
  
  return files;
}

/**
 * Remove file from array by ID
 */
export function removeFileById(files: UploadFile[], fileId: string): UploadFile[] {
  return files.filter(file => file.id !== fileId);
}

/**
 * Update file in array
 */
export function updateFile(
  files: UploadFile[], 
  fileId: string, 
  updates: Partial<UploadFile>
): UploadFile[] {
  return files.map(file => 
    file.id === fileId ? { ...file, ...updates } : file
  );
}

/**
 * Folder-specific utility functions
 */

/**
 * Generate a unique ID for a folder
 */
export function generateFolderId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create folder structure from File array with webkitRelativePath
 */
export function createFolderStructureFromFiles(files: File[]): FolderStructure[] {
  const folderMap = new Map<string, FolderStructure>();
  const rootFolders: FolderStructure[] = [];

  // First pass: create folder structures
  files.forEach(file => {
    if (!file.webkitRelativePath) return;

    const pathParts = file.webkitRelativePath.split('/').filter(part => part.length > 0);
    if (pathParts.length === 0) return;

    let currentPath = '';
    let parentId: string | null = null;

    // Create folder hierarchy
    for (let i = 0; i < pathParts.length - 1; i++) {
      const folderName = pathParts[i];
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

      if (!folderMap.has(currentPath)) {
        const folder: FolderStructure = {
          id: generateFolderId(),
          name: folderName,
          path: currentPath,
          parentId,
          children: [],
          files: [],
          totalFiles: 0,
          totalSize: 0,
          created: new Date(),
          status: 'pending',
          progress: 0,
          completedFiles: 0,
          failedFiles: 0,
        };

        folderMap.set(currentPath, folder);

        if (parentId) {
          const parentFolder = Array.from(folderMap.values()).find(f => f.id === parentId);
          if (parentFolder) {
            parentFolder.children.push(folder);
          }
        } else {
          rootFolders.push(folder);
        }
      }

      parentId = folderMap.get(currentPath)!.id;
    }
  });

  // Second pass: add files to folders
  files.forEach(file => {
    if (!file.webkitRelativePath) return;

    const pathParts = file.webkitRelativePath.split('/').filter(part => part.length > 0);
    if (pathParts.length === 0) return;

    const folderPath = pathParts.slice(0, -1).join('/');
    const folder = folderMap.get(folderPath);

    if (folder) {
      const uploadFile: FolderUploadFile = {
        ...createUploadFile(file),
        relativePath: file.webkitRelativePath,
        folderId: folder.id,
      };

      folder.files.push(uploadFile);
    }
  });

  // Third pass: calculate totals
  const calculateTotals = (folder: FolderStructure): void => {
    folder.totalFiles = folder.files.length;
    folder.totalSize = folder.files.reduce((total, file) => total + file.size, 0);

    folder.children.forEach(child => {
      calculateTotals(child);
      folder.totalFiles += child.totalFiles;
      folder.totalSize += child.totalSize;
    });
  };

  rootFolders.forEach(calculateTotals);

  return rootFolders;
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Process directory handle using File System Access API
 */
export async function processDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  parentPath = '',
  parentId: string | null = null
): Promise<FolderStructure> {
  const folder: FolderStructure = {
    id: generateFolderId(),
    name: dirHandle.name,
    path: parentPath ? `${parentPath}/${dirHandle.name}` : dirHandle.name,
    parentId,
    children: [],
    files: [],
    totalFiles: 0,
    totalSize: 0,
    created: new Date(),
    status: 'pending',
    progress: 0,
    completedFiles: 0,
    failedFiles: 0,
  };

  const entries = [];
  for await (const [name, handle] of dirHandle.entries()) {
    entries.push({ name, handle });
  }

  // Process subdirectories
  for (const { handle } of entries) {
    if (handle.kind === 'directory') {
      const childFolder = await processDirectoryHandle(
        handle as FileSystemDirectoryHandle,
        folder.path,
        folder.id
      );
      folder.children.push(childFolder);
    }
  }

  // Process files
  for (const { handle } of entries) {
    if (handle.kind === 'file') {
      const fileHandle = handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      
      const uploadFile: FolderUploadFile = {
        ...createUploadFile(file),
        relativePath: `${folder.path}/${file.name}`,
        folderId: folder.id,
        fileHandle,
        directoryHandle: dirHandle,
      };

      folder.files.push(uploadFile);
    }
  }

  // Calculate totals
  folder.totalFiles = folder.files.length + 
    folder.children.reduce((total, child) => total + child.totalFiles, 0);
  folder.totalSize = folder.files.reduce((total, file) => total + file.size, 0) +
    folder.children.reduce((total, child) => total + child.totalSize, 0);

  return folder;
}

/**
 * Check if drag event contains folders
 */
export function hasFolders(event: DragEvent): boolean {
  if (!event.dataTransfer?.items) return false;
  
  for (let i = 0; i < event.dataTransfer.items.length; i++) {
    const item = event.dataTransfer.items[i];
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry();
      if (entry?.isDirectory) return true;
    }
  }
  
  return false;
}

/**
 * Get folders from drag event using webkit entries
 */
export async function getFoldersFromDragEvent(event: DragEvent): Promise<FolderStructure[]> {
  const folders: FolderStructure[] = [];
  
  if (!event.dataTransfer?.items) return folders;

  const processEntry = async (entry: any, parentPath = ''): Promise<FolderStructure | null> => {
    if (entry.isDirectory) {
      const folder: FolderStructure = {
        id: generateFolderId(),
        name: entry.name,
        path: parentPath ? `${parentPath}/${entry.name}` : entry.name,
        parentId: null,
        children: [],
        files: [],
        totalFiles: 0,
        totalSize: 0,
        created: new Date(),
        status: 'pending',
        progress: 0,
        completedFiles: 0,
        failedFiles: 0,
      };

      const reader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        reader.readEntries(resolve);
      });

      for (const childEntry of entries) {
        if (childEntry.isDirectory) {
          const childFolder = await processEntry(childEntry, folder.path);
          if (childFolder) {
            childFolder.parentId = folder.id;
            folder.children.push(childFolder);
          }
        } else if (childEntry.isFile) {
          const file = await new Promise<File>((resolve) => {
            childEntry.file(resolve);
          });

          const uploadFile: FolderUploadFile = {
            ...createUploadFile(file),
            relativePath: `${folder.path}/${file.name}`,
            folderId: folder.id,
          };

          folder.files.push(uploadFile);
        }
      }

      // Calculate totals
      folder.totalFiles = folder.files.length + 
        folder.children.reduce((total, child) => total + child.totalFiles, 0);
      folder.totalSize = folder.files.reduce((total, file) => total + file.size, 0) +
        folder.children.reduce((total, child) => total + child.totalSize, 0);

      return folder;
    }
    
    return null;
  };

  for (let i = 0; i < event.dataTransfer.items.length; i++) {
    const item = event.dataTransfer.items[i];
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        const folder = await processEntry(entry);
        if (folder) {
          folders.push(folder);
        }
      }
    }
  }

  return folders;
}

/**
 * Flatten folder structure to get all files
 */
export function flattenFolderStructure(folders: FolderStructure[]): FolderUploadFile[] {
  const files: FolderUploadFile[] = [];

  const processFolder = (folder: FolderStructure) => {
    files.push(...(folder.files as FolderUploadFile[]));
    folder.children.forEach(processFolder);
  };

  folders.forEach(processFolder);
  return files;
}

/**
 * Validate folder structure
 */
export function validateFolderStructure(
  folders: FolderStructure[],
  config: {
    maxDepth?: number;
    maxFilesPerFolder?: number;
    maxTotalFiles?: number;
    maxTotalSize?: number;
  }
): FolderValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalFolders = 0;
  let totalFiles = 0;
  let totalSize = 0;
  let maxDepth = 0;
  const duplicateFiles: string[] = [];
  const emptyFolders: string[] = [];
  const fileNames = new Set<string>();

  const processFolder = (folder: FolderStructure, depth: number) => {
    totalFolders++;
    totalFiles += folder.files.length;
    totalSize += folder.files.reduce((sum, file) => sum + file.size, 0);
    maxDepth = Math.max(maxDepth, depth);

    // Check folder depth
    if (config.maxDepth && depth > config.maxDepth) {
      errors.push(`Folder "${folder.name}" exceeds maximum depth of ${config.maxDepth}`);
    }

    // Check files per folder
    if (config.maxFilesPerFolder && folder.files.length > config.maxFilesPerFolder) {
      errors.push(`Folder "${folder.name}" contains ${folder.files.length} files, maximum ${config.maxFilesPerFolder} allowed`);
    }

    // Check empty folders
    if (folder.files.length === 0 && folder.children.length === 0) {
      emptyFolders.push(folder.path);
      warnings.push(`Empty folder: ${folder.path}`);
    }

    // Check for duplicate files
    folder.files.forEach(file => {
      const fileName = file.relativePath;
      if (fileNames.has(fileName)) {
        duplicateFiles.push(fileName);
      } else {
        fileNames.add(fileName);
      }
    });

    folder.children.forEach(child => processFolder(child, depth + 1));
  };

  folders.forEach(folder => processFolder(folder, 1));

  // Check total limits
  if (config.maxTotalFiles && totalFiles > config.maxTotalFiles) {
    errors.push(`Total files ${totalFiles} exceeds maximum ${config.maxTotalFiles}`);
  }

  if (config.maxTotalSize && totalSize > config.maxTotalSize) {
    errors.push(`Total size ${formatBytes(totalSize)} exceeds maximum ${formatBytes(config.maxTotalSize)}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalFolders,
      totalFiles,
      totalSize,
      maxDepth,
      duplicateFiles: Array.from(new Set(duplicateFiles)),
      emptyFolders,
    },
  };
}

/**
 * Update folder in array
 */
export function updateFolder(
  folders: FolderStructure[],
  folderId: string,
  updates: Partial<FolderStructure>
): FolderStructure[] {
  const updateFolderRecursive = (folder: FolderStructure): FolderStructure => {
    if (folder.id === folderId) {
      return { ...folder, ...updates };
    }
    
    return {
      ...folder,
      children: folder.children.map(updateFolderRecursive),
    };
  };

  return folders.map(updateFolderRecursive);
}

/**
 * Remove folder from array
 */
export function removeFolderById(folders: FolderStructure[], folderId: string): FolderStructure[] {
  const removeFolderRecursive = (folder: FolderStructure): FolderStructure | null => {
    if (folder.id === folderId) {
      return null;
    }
    
    return {
      ...folder,
      children: folder.children
        .map(removeFolderRecursive)
        .filter((child): child is FolderStructure => child !== null),
    };
  };

  return folders
    .map(removeFolderRecursive)
    .filter((folder): folder is FolderStructure => folder !== null);
}

/**
 * Find folder by ID
 */
export function findFolderById(folders: FolderStructure[], folderId: string): FolderStructure | null {
  for (const folder of folders) {
    if (folder.id === folderId) {
      return folder;
    }
    
    const found = findFolderById(folder.children, folderId);
    if (found) {
      return found;
    }
  }
  
  return null;
}

/**
 * Calculate folder upload progress
 */
export function calculateFolderProgress(folder: FolderStructure): number {
  const totalFiles = folder.totalFiles;
  if (totalFiles === 0) return 100;

  let completedFiles = 0;
  let totalProgress = 0;

  const countProgress = (f: FolderStructure) => {
    f.files.forEach(file => {
      if (file.status === 'completed') {
        completedFiles++;
        totalProgress += 100;
      } else if (file.status === 'uploading') {
        totalProgress += file.progress;
      }
    });

    f.children.forEach(countProgress);
  };

  countProgress(folder);

  return Math.round(totalProgress / totalFiles);
}

/**
 * Get BRF folder templates
 */
export function getBRFFolderTemplates(): BRFFolderTemplate[] {
  return [
    {
      name: 'Efter år',
      description: 'Organisera dokument efter år',
      structure: [
        { path: '2024', description: 'Aktuellt år', required: true },
        { path: '2024/Protokoll', description: 'Styrelseprotokoll', required: true, fileTypes: ['.pdf', '.doc', '.docx'] },
        { path: '2024/Ekonomi', description: 'Ekonomiska handlingar', required: true, fileTypes: ['.pdf', '.xls', '.xlsx'] },
        { path: '2024/Underhåll', description: 'Underhållsrapporter', required: false, fileTypes: ['.pdf', '.jpg', '.png'] },
        { path: '2024/Fakturor', description: 'Inkommande fakturor', required: false, fileTypes: ['.pdf'] },
      ],
    },
    {
      name: 'Efter kategori',
      description: 'Organisera dokument efter typ',
      structure: [
        { path: 'Protokoll', description: 'Alla styrelseprotokoll', required: true, fileTypes: ['.pdf', '.doc', '.docx'] },
        { path: 'Ekonomi', description: 'Ekonomiska handlingar', required: true, fileTypes: ['.pdf', '.xls', '.xlsx'] },
        { path: 'Ekonomi/Budgetar', description: 'Budgetdokument', required: false, fileTypes: ['.xls', '.xlsx', '.pdf'] },
        { path: 'Ekonomi/Bokslut', description: 'Årsbokslut', required: false, fileTypes: ['.pdf'] },
        { path: 'Juridik', description: 'Juridiska dokument', required: false, fileTypes: ['.pdf', '.doc', '.docx'] },
        { path: 'Underhåll', description: 'Underhållsrapporter och bilder', required: false, fileTypes: ['.pdf', '.jpg', '.png'] },
      ],
    },
    {
      name: 'Komplett BRF-struktur',
      description: 'Fullständig mappstruktur för BRF-dokument',
      structure: [
        { path: 'Styrelsemöten', description: 'Styrelseprotokoll och handlingar', required: true },
        { path: 'Styrelsemöten/Protokoll', description: 'Protokoll från styrelsemöten', required: true, fileTypes: ['.pdf', '.doc', '.docx'] },
        { path: 'Styrelsemöten/Kallelser', description: 'Kallelser till möten', required: false, fileTypes: ['.pdf', '.doc', '.docx'] },
        { path: 'Årsmöten', description: 'Årsmöteshandlingar', required: true },
        { path: 'Årsmöten/Protokoll', description: 'Årsmötesprotokoll', required: true, fileTypes: ['.pdf', '.doc', '.docx'] },
        { path: 'Ekonomi', description: 'Ekonomiska handlingar', required: true },
        { path: 'Ekonomi/Bokföring', description: 'Löpande bokföring', required: true, fileTypes: ['.xls', '.xlsx', '.pdf'] },
        { path: 'Ekonomi/Budgetar', description: 'Budgetdokument', required: true, fileTypes: ['.xls', '.xlsx', '.pdf'] },
        { path: 'Ekonomi/Bokslut', description: 'Årsbokslut', required: true, fileTypes: ['.pdf'] },
        { path: 'Ekonomi/Revisionsberättelser', description: 'Revisionsrapporter', required: false, fileTypes: ['.pdf'] },
        { path: 'Underhåll', description: 'Underhållsplanering och rapporter', required: true },
        { path: 'Underhåll/Planer', description: 'Underhållsplaner', required: false, fileTypes: ['.pdf', '.xls', '.xlsx'] },
        { path: 'Underhåll/Rapporter', description: 'Underhållsrapporter', required: false, fileTypes: ['.pdf', '.jpg', '.png'] },
        { path: 'Juridik', description: 'Juridiska dokument', required: false },
        { path: 'Juridik/Stadgar', description: 'Föreningsstadgar', required: false, fileTypes: ['.pdf', '.doc', '.docx'] },
        { path: 'Juridik/Avtal', description: 'Kontrakt och avtal', required: false, fileTypes: ['.pdf', '.doc', '.docx'] },
      ],
    },
  ];
}