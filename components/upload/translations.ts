import { FolderUploadTexts } from './types';

/**
 * Swedish translations for the file upload component
 * Following Swedish BRF terminology and conventions
 */
export const swedishTexts: FolderUploadTexts = {
  dragDropText: 'Dra och släpp filer här',
  browseText: 'Bläddra bland filer',
  orText: 'eller',
  fileTypesText: 'Accepterade filtyper',
  maxSizeText: 'Max filstorlek',
  removeText: 'Ta bort',
  uploadText: 'Ladda upp',
  cancelText: 'Avbryt',
  pauseText: 'Pausa',
  resumeText: 'Återuppta',
  retryText: 'Försök igen',
  cancelAllText: 'Avbryt alla',
  pauseAllText: 'Pausa alla',
  resumeAllText: 'Återuppta alla',
  timeRemainingText: 'Återstående tid',
  uploadSpeedText: 'Uppladdningshastighet',
  errors: {
    fileTooLarge: 'Filen är för stor',
    fileTypeNotAccepted: 'Filtypen stöds inte',
    tooManyFiles: 'För många filer valda',
    uploadFailed: 'Uppladdning misslyckades',
    networkError: 'Nätverksfel, försök igen',
    uploadCancelled: 'Uppladdningen avbröts',
    connectionLost: 'Anslutningen förlorades',
    serverError: 'Serverfel uppstod',
    chunkUploadFailed: 'Blockuppladdning misslyckades',
  },
  status: {
    pending: 'Väntar',
    uploading: 'Laddar upp',
    completed: 'Klar',
    error: 'Fel',
    cancelled: 'Avbruten',
    paused: 'Pausad',
    retrying: 'Försöker igen',
  },
  progress: {
    preparing: 'Förbereder',
    uploading: 'Laddar upp',
    processing: 'Bearbetar',
    finalizing: 'Slutför',
    complete: 'Slutförd',
  },
  batch: {
    uploadingFiles: 'filer laddas upp',
    completedFiles: 'filer slutförda',
    failedFiles: 'filer misslyckades',
    cancelledFiles: 'filer avbrutna',
    totalFiles: 'totalt filer',
    allComplete: 'Alla filer slutförda',
    someErrors: 'Vissa filer misslyckades',
    allCancelled: 'Alla filer avbrutna',
  },
  folders: {
    selectFolder: 'Välj mapp',
    selectFolders: 'Välj mappar',
    folderSelected: 'mapp vald',
    foldersSelected: 'mappar valda',
    dropFolders: 'Dra och släpp mappar här',
    browseFolder: 'Bläddra bland mappar',
    browseFolders: 'Bläddra bland mappar',
    folderStructure: 'Mappstruktur',
    preserveStructure: 'Bevara struktur',
    compressFolder: 'Komprimera mapp',
    compressFolders: 'Komprimera mappar',
    folderPreview: 'Förhandsgranskning av mapp',
    expandFolder: 'Expandera mapp',
    collapseFolder: 'Kollaps mapp',
    removeFolder: 'Ta bort mapp',
    emptyFolder: 'Tom mapp',
    folderSize: 'Mappstorlek',
    fileCount: 'Antal filer',
    folderDepth: 'Mappdjup',
    applyTemplate: 'Tillämpa mall',
    createFromTemplate: 'Skapa från mall',
    folderNotSupported: 'Mappuppladdning stöds inte av denna webbläsare',
    fileSystemAccessDenied: 'Åtkomst till filsystemet nekad',
    folderTooDeep: 'Mappen är för djup (max {maxDepth} nivåer)',
    tooManyFilesInFolder: 'För många filer i mappen (max {maxFiles})',
    duplicateFilesFound: 'Dubbletter av filer hittades',
    compressingFolder: 'Komprimerar mapp',
    extractingFolder: 'Extraherar mapp',
    folderUploadComplete: 'Mappuppladdning slutförd',
    folderUploadFailed: 'Mappuppladdning misslyckades',
  },
  brfTemplates: {
    byYear: 'Efter år',
    byCategory: 'Efter kategori',
    financial: 'Ekonomi',
    maintenance: 'Underhåll',
    protocols: 'Protokoll',
    contracts: 'Kontrakt',
    invoices: 'Fakturor',
    reports: 'Rapporter',
    documentation: 'Dokumentation',
    legal: 'Juridik',
  },
};

/**
 * Format file size to Swedish format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get file type display name in Swedish
 */
export function getFileTypeDisplayName(mimeType: string): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'JPEG-bild',
    'image/jpg': 'JPG-bild',
    'image/png': 'PNG-bild',
    'image/gif': 'GIF-bild',
    'image/webp': 'WebP-bild',
    'image/svg+xml': 'SVG-bild',
    'application/pdf': 'PDF-dokument',
    'application/msword': 'Word-dokument',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word-dokument',
    'application/vnd.ms-excel': 'Excel-kalkylblad',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel-kalkylblad',
    'text/plain': 'Textfil',
    'text/csv': 'CSV-fil',
    'application/zip': 'ZIP-arkiv',
    'application/x-rar-compressed': 'RAR-arkiv',
    'application/json': 'JSON-fil',
    'video/mp4': 'MP4-video',
    'video/quicktime': 'QuickTime-video',
    'audio/mpeg': 'MP3-ljud',
    'audio/wav': 'WAV-ljud',
  };
  
  return typeMap[mimeType] || 'Okänd filtyp';
}

/**
 * Format upload speed to Swedish format
 */
export function formatUploadSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s';
  
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  
  return `${parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format time remaining in Swedish
 */
export function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return '0 sek';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} dag${days !== 1 ? 'ar' : ''} ${hours % 24} tim`;
  } else if (hours > 0) {
    return `${hours} tim ${minutes % 60} min`;
  } else if (minutes > 0) {
    return `${minutes} min ${seconds % 60} sek`;
  } else {
    return `${seconds} sek`;
  }
}

/**
 * Get status display text in Swedish
 */
export function getStatusDisplayText(status: string): string {
  return swedishTexts.status[status as keyof typeof swedishTexts.status] || status;
}

/**
 * Get progress phase display text in Swedish
 */
export function getProgressPhaseText(phase: string): string {
  return swedishTexts.progress[phase as keyof typeof swedishTexts.progress] || phase;
}

/**
 * Calculate upload progress percentage
 */
export function calculateProgress(loaded: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((loaded / total) * 100);
}

/**
 * Calculate estimated time remaining
 */
export function calculateTimeRemaining(
  loaded: number, 
  total: number, 
  speed: number
): number {
  if (speed === 0 || loaded >= total) return 0;
  const remaining = total - loaded;
  return (remaining / speed) * 1000; // Convert to milliseconds
}