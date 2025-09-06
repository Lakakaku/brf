import { MobileTexts } from './mobile-types';

/**
 * Swedish translations for mobile photo upload functionality
 * Follows Swedish BRF terminology and mobile UX conventions
 */
export const swedishMobileTexts: MobileTexts = {
  camera: {
    title: 'Kamera',
    switchCamera: 'Växla kamera',
    capturePhoto: 'Ta foto',
    retakePhoto: 'Ta om foto',
    usePhoto: 'Använd foto',
    enableFlash: 'Sätt på blixt',
    disableFlash: 'Stäng av blixt',
    focusHere: 'Fokusera här',
    cameraError: 'Kamerafel uppstod',
    permissionDenied: 'Kameratillstånd nekades',
    permissionRequest: 'Appen behöver tillgång till kameran för att ta foton',
  },
  gallery: {
    title: 'Fotogalleri',
    selectPhotos: 'Välj foton',
    selectAll: 'Välj alla',
    deselectAll: 'Avmarkera alla',
    selectedCount: '{count} valda',
    noPhotos: 'Inga foton tillgängliga',
    loading: 'Laddar foton...',
  },
  editor: {
    title: 'Redigera foto',
    rotate: 'Rotera',
    crop: 'Beskär',
    brightness: 'Ljusstyrka',
    contrast: 'Kontrast',
    saturation: 'Mättnad',
    enhance: 'Förbättra',
    undo: 'Ångra',
    redo: 'Gör om',
    reset: 'Återställ',
    apply: 'Tillämpa',
    cancel: 'Avbryt',
    save: 'Spara',
  },
  batch: {
    title: 'Fotobatch',
    selectedPhotos: '{count} foton valda',
    uploadAll: 'Ladda upp alla',
    removeAll: 'Ta bort alla',
    sortBy: 'Sortera efter',
    sortByDate: 'Datum',
    sortBySize: 'Storlek',
    sortByName: 'Namn',
    gridView: 'Rutnätsvy',
    listView: 'Listvy',
  },
  offline: {
    title: 'Offline-uppsättning',
    queuedUploads: 'Köade uppladdningar',
    syncWhenOnline: 'Synka när online',
    syncNow: 'Synka nu',
    clearQueue: 'Rensa kö',
    storageUsed: 'Använt lagringsutrymme',
    storageAvailable: 'Tillgängligt utrymme',
  },
  gps: {
    extractingLocation: 'Hämtar platsdata...',
    locationExtracted: 'Platsdata extraherad',
    locationFailed: 'Kunde inte hämta platsdata',
    permissionRequired: 'Platstillstånd krävs',
    accuracy: 'Noggrannhet: {accuracy}m',
    coordinates: 'Koordinater: {lat}, {lng}',
  },
  categories: {
    damage_report: 'Skaderapport',
    maintenance: 'Underhåll',
    invoice: 'Faktura',
    protocol: 'Protokoll',
    inspection: 'Besiktning',
    renovation: 'Renovering',
    property_exterior: 'Fastighetens utsida',
    property_interior: 'Fastighetens insida',
    common_areas: 'Gemensamma utrymmen',
    parking: 'Parkering',
    other: 'Övrigt',
  },
  gestures: {
    pinchToZoom: 'Nyp för att zooma',
    doubleTapToZoom: 'Dubbeltryck för att zooma',
    panToMove: 'Panorera för att flytta',
    longPressForMenu: 'Långtryck för meny',
    swipeToDelete: 'Svep för att ta bort',
    swipeToEdit: 'Svep för att redigera',
  },
  pwa: {
    installApp: 'Installera appen',
    offlineReady: 'Appen är redo för offline-användning',
    updateAvailable: 'Uppdatering tillgänglig',
    updateNow: 'Uppdatera nu',
    installInstructions: 'Tryck på dela-knappen och välj "Lägg till på hemskärm"',
  },
  accessibility: {
    cameraButton: 'Öppna kamera för att ta foto',
    galleryButton: 'Öppna fotogalleri för att välja foton',
    editButton: 'Redigera vald bild',
    deleteButton: 'Ta bort vald bild',
    shareButton: 'Dela vald bild',
    photoThumbnail: 'Miniatyrbild av foto taget {date}',
    processingIndicator: 'Bearbetar bild, vänligen vänta',
    uploadProgress: 'Uppladdning pågår, {progress}% klar',
  },
};

/**
 * Format mobile file size for Swedish locale
 */
export function formatMobileFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  
  // Use Swedish number formatting (comma as decimal separator)
  const formattedSize = size.toString().replace('.', ',');
  return `${formattedSize} ${sizes[i]}`;
}

/**
 * Format coordinates for Swedish display
 */
export function formatCoordinates(lat: number, lng: number): string {
  const formatCoord = (coord: number) => coord.toFixed(6).replace('.', ',');
  return `${formatCoord(lat)}, ${formatCoord(lng)}`;
}

/**
 * Format GPS accuracy in Swedish
 */
export function formatAccuracy(accuracy: number): string {
  if (accuracy < 10) {
    return 'Mycket hög noggrannhet';
  } else if (accuracy < 50) {
    return 'Hög noggrannhet';
  } else if (accuracy < 100) {
    return 'Medelhög noggrannhet';
  } else {
    return 'Låg noggrannhet';
  }
}

/**
 * Format time ago in Swedish for mobile
 */
export function formatMobileTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just nu';
  } else if (minutes < 60) {
    return `${minutes} min sedan`;
  } else if (hours < 24) {
    return `${hours} tim sedan`;
  } else if (days === 1) {
    return 'I går';
  } else if (days < 7) {
    return `${days} dagar sedan`;
  } else {
    return new Intl.DateTimeFormat('sv-SE', {
      day: 'numeric',
      month: 'short'
    }).format(new Date(timestamp));
  }
}

/**
 * Format photo dimensions for display
 */
export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height}`;
}

/**
 * Get BRF category display name
 */
export function getBRFCategoryName(category: string): string {
  return swedishMobileTexts.categories[category as keyof typeof swedishMobileTexts.categories] || category;
}

/**
 * Format compression level for display
 */
export function formatCompressionLevel(level: number): string {
  const percentage = Math.round(level * 100);
  return `${percentage}%`;
}

/**
 * Format image quality for display
 */
export function formatImageQuality(quality: number): string {
  const percentage = Math.round(quality * 100);
  if (percentage >= 90) {
    return `Hög kvalitet (${percentage}%)`;
  } else if (percentage >= 70) {
    return `Medelhög kvalitet (${percentage}%)`;
  } else if (percentage >= 50) {
    return `Grundkvalitet (${percentage}%)`;
  } else {
    return `Låg kvalitet (${percentage}%)`;
  }
}

/**
 * Get device orientation in Swedish
 */
export function getOrientationText(orientation: number): string {
  switch (orientation) {
    case 1:
      return 'Normal';
    case 3:
      return 'Roterad 180°';
    case 6:
      return 'Roterad 90° medurs';
    case 8:
      return 'Roterad 90° moturs';
    default:
      return 'Okänd orientering';
  }
}

/**
 * Format storage quota in Swedish
 */
export function formatStorageQuota(used: number, total: number): string {
  const usedFormatted = formatMobileFileSize(used);
  const totalFormatted = formatMobileFileSize(total);
  const percentage = Math.round((used / total) * 100);
  
  return `${usedFormatted} av ${totalFormatted} använt (${percentage}%)`;
}

/**
 * Get network type display text in Swedish
 */
export function getNetworkTypeText(type: string): string {
  const networkTypes: Record<string, string> = {
    'slow-2g': 'Långsam anslutning',
    '2g': '2G anslutning',
    '3g': '3G anslutning',
    '4g': '4G anslutning',
    '5g': '5G anslutning',
    'wifi': 'WiFi-anslutning',
    'none': 'Ingen anslutning',
    'unknown': 'Okänd anslutning',
  };
  
  return networkTypes[type] || type;
}

/**
 * Format processing operation for display
 */
export function formatProcessingOperation(operation: { type: string; value: any }): string {
  switch (operation.type) {
    case 'rotate':
      return `Roterad ${operation.value}°`;
    case 'crop':
      return 'Beskuren';
    case 'brightness':
      return `Ljusstyrka ${operation.value > 0 ? '+' : ''}${operation.value}%`;
    case 'contrast':
      return `Kontrast ${operation.value > 0 ? '+' : ''}${operation.value}%`;
    case 'compression':
      return `Komprimerad (${formatCompressionLevel(operation.value)})`;
    case 'resize':
      return `Storleksändrad`;
    default:
      return operation.type;
  }
}