/**
 * Image processing utilities for mobile photo uploads
 * Handles rotation, compression, optimization and BRF document processing
 */

import { 
  MobilePhotoUploadFile, 
  ImageProcessingOperation, 
  MobileUploadConfig 
} from './mobile-types';

export interface ImageProcessingOptions {
  /** Target quality (0-1) */
  quality?: number;
  /** Maximum dimensions */
  maxDimensions?: {
    width: number;
    height: number;
  };
  /** Compression format */
  format?: 'jpeg' | 'webp' | 'png';
  /** Preserve EXIF data */
  preserveExif?: boolean;
  /** Auto orientation correction */
  autoOrient?: boolean;
  /** Enable progressive JPEG */
  progressive?: boolean;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageEnhancementSettings {
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
  saturation: number; // -100 to 100
  sharpness: number;  // -100 to 100
}

/**
 * Load image from various sources
 */
export async function loadImage(source: string | File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Kunde inte ladda bild'));
    
    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Create canvas from image
 */
export function createCanvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context inte tillgänglig');
  }
  
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  
  return canvas;
}

/**
 * Rotate image by degrees
 */
export async function rotateImage(
  source: string | HTMLImageElement | HTMLCanvasElement, 
  degrees: number
): Promise<{ canvas: HTMLCanvasElement; dataUrl: string }> {
  const img = typeof source === 'string' ? await loadImage(source) : source;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context inte tillgänglig');
  }
  
  const radian = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radian));
  const sin = Math.abs(Math.sin(radian));
  
  const originalWidth = img.width;
  const originalHeight = img.height;
  
  canvas.width = originalHeight * sin + originalWidth * cos;
  canvas.height = originalHeight * cos + originalWidth * sin;
  
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radian);
  ctx.drawImage(img, -originalWidth / 2, -originalHeight / 2);
  
  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
  };
}

/**
 * Crop image to specified area
 */
export async function cropImage(
  source: string | HTMLImageElement | HTMLCanvasElement,
  cropArea: CropArea
): Promise<{ canvas: HTMLCanvasElement; dataUrl: string }> {
  const img = typeof source === 'string' ? await loadImage(source) : source;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context inte tillgänglig');
  }
  
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;
  
  ctx.drawImage(
    img,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height
  );
  
  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
  };
}

/**
 * Resize image to fit within max dimensions while preserving aspect ratio
 */
export async function resizeImage(
  source: string | HTMLImageElement | HTMLCanvasElement,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.9
): Promise<{ canvas: HTMLCanvasElement; dataUrl: string; dimensions: { width: number; height: number } }> {
  const img = typeof source === 'string' ? await loadImage(source) : source;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context inte tillgänglig');
  }
  
  // Calculate new dimensions while preserving aspect ratio
  let { width, height } = img;
  
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  
  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }
  
  canvas.width = width;
  canvas.height = height;
  
  // Use better image scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.drawImage(img, 0, 0, width, height);
  
  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    dimensions: { width, height },
  };
}

/**
 * Apply image enhancements (brightness, contrast, saturation)
 */
export async function enhanceImage(
  source: string | HTMLImageElement | HTMLCanvasElement,
  settings: ImageEnhancementSettings
): Promise<{ canvas: HTMLCanvasElement; dataUrl: string }> {
  const img = typeof source === 'string' ? await loadImage(source) : source;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context inte tillgänglig');
  }
  
  canvas.width = img.width;
  canvas.height = img.height;
  
  // Apply filter CSS properties
  const filters: string[] = [];
  
  if (settings.brightness !== 0) {
    const brightness = 100 + settings.brightness;
    filters.push(`brightness(${brightness}%)`);
  }
  
  if (settings.contrast !== 0) {
    const contrast = 100 + settings.contrast;
    filters.push(`contrast(${contrast}%)`);
  }
  
  if (settings.saturation !== 0) {
    const saturation = 100 + settings.saturation;
    filters.push(`saturate(${saturation}%)`);
  }
  
  ctx.filter = filters.join(' ');
  ctx.drawImage(img, 0, 0);
  
  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
  };
}

/**
 * Compress image with specific quality and format
 */
export async function compressImage(
  source: string | File | Blob,
  options: ImageProcessingOptions = {}
): Promise<{ 
  blob: Blob; 
  dataUrl: string; 
  originalSize: number; 
  compressedSize: number;
  compressionRatio: number;
}> {
  const {
    quality = 0.8,
    maxDimensions = { width: 1920, height: 1080 },
    format = 'jpeg',
    progressive = true,
  } = options;
  
  const img = await loadImage(source);
  const originalSize = source instanceof File ? source.size : 0;
  
  // Resize if needed
  const { canvas } = await resizeImage(img, maxDimensions.width, maxDimensions.height, quality);
  
  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Kunde inte komprimera bild'));
      },
      `image/${format}`,
      quality
    );
  });
  
  const dataUrl = canvas.toDataURL(`image/${format}`, quality);
  const compressionRatio = originalSize > 0 ? (originalSize - blob.size) / originalSize : 0;
  
  return {
    blob,
    dataUrl,
    originalSize,
    compressedSize: blob.size,
    compressionRatio,
  };
}

/**
 * Auto-correct image orientation based on EXIF data
 */
export async function autoCorrectOrientation(
  source: string | HTMLImageElement | HTMLCanvasElement,
  orientation: number
): Promise<{ canvas: HTMLCanvasElement; dataUrl: string }> {
  if (orientation === 1) {
    // No rotation needed
    const img = typeof source === 'string' ? await loadImage(source) : source;
    const canvas = createCanvasFromImage(img as HTMLImageElement);
    return {
      canvas,
      dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    };
  }
  
  // Apply rotation based on EXIF orientation
  let degrees = 0;
  switch (orientation) {
    case 3:
      degrees = 180;
      break;
    case 6:
      degrees = 90;
      break;
    case 8:
      degrees = -90;
      break;
  }
  
  return rotateImage(source, degrees);
}

/**
 * Optimize image for BRF document use cases
 */
export async function optimizeForBRF(
  source: string | File | Blob,
  category: string,
  config: Partial<MobileUploadConfig> = {}
): Promise<{
  blob: Blob;
  dataUrl: string;
  optimizations: ImageProcessingOperation[];
}> {
  const optimizations: ImageProcessingOperation[] = [];
  
  // Category-specific optimization settings
  const categorySettings = getBRFCategorySettings(category);
  
  const options: ImageProcessingOptions = {
    quality: categorySettings.quality,
    maxDimensions: categorySettings.maxDimensions,
    format: categorySettings.format,
    progressive: true,
  };
  
  const compressed = await compressImage(source, options);
  
  optimizations.push({
    type: 'compression',
    value: options.quality || 0.8,
    timestamp: Date.now(),
  });
  
  if (categorySettings.autoEnhance) {
    const img = await loadImage(compressed.dataUrl);
    const enhanced = await enhanceImage(img, categorySettings.enhancements);
    
    const enhancedBlob = await new Promise<Blob>((resolve, reject) => {
      enhanced.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Kunde inte förbättra bild'));
        },
        `image/${options.format}`,
        options.quality
      );
    });
    
    optimizations.push({
      type: 'brightness',
      value: categorySettings.enhancements.brightness,
      timestamp: Date.now(),
    });
    
    return {
      blob: enhancedBlob,
      dataUrl: enhanced.dataUrl,
      optimizations,
    };
  }
  
  return {
    blob: compressed.blob,
    dataUrl: compressed.dataUrl,
    optimizations,
  };
}

/**
 * Get optimization settings for BRF document categories
 */
function getBRFCategorySettings(category: string) {
  const defaultSettings = {
    quality: 0.8,
    maxDimensions: { width: 1920, height: 1080 },
    format: 'jpeg' as const,
    autoEnhance: false,
    enhancements: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
    },
  };
  
  const categorySettings: Record<string, typeof defaultSettings> = {
    damage_report: {
      ...defaultSettings,
      quality: 0.9, // Higher quality for damage documentation
      autoEnhance: true,
      enhancements: {
        brightness: 10,
        contrast: 15,
        saturation: 0,
        sharpness: 5,
      },
    },
    invoice: {
      ...defaultSettings,
      quality: 0.85, // Good quality for text readability
      autoEnhance: true,
      enhancements: {
        brightness: 5,
        contrast: 20,
        saturation: -10,
        sharpness: 10,
      },
    },
    maintenance: {
      ...defaultSettings,
      quality: 0.8,
      autoEnhance: true,
      enhancements: {
        brightness: 5,
        contrast: 10,
        saturation: 0,
        sharpness: 0,
      },
    },
    protocol: {
      ...defaultSettings,
      quality: 0.75, // Lower size for document storage
      maxDimensions: { width: 1600, height: 1200 },
    },
    property_exterior: {
      ...defaultSettings,
      quality: 0.85,
      maxDimensions: { width: 2048, height: 1536 },
    },
    property_interior: {
      ...defaultSettings,
      quality: 0.85,
      maxDimensions: { width: 2048, height: 1536 },
    },
  };
  
  return categorySettings[category] || defaultSettings;
}

/**
 * Process mobile photo upload file
 */
export async function processMobilePhoto(
  file: MobilePhotoUploadFile,
  operations: ImageProcessingOperation[]
): Promise<MobilePhotoUploadFile> {
  let currentImage = file.preview || URL.createObjectURL(file.file);
  let currentCanvas: HTMLCanvasElement | null = null;
  
  for (const operation of operations) {
    switch (operation.type) {
      case 'rotate':
        const rotated = await rotateImage(currentImage, operation.value as number);
        currentCanvas = rotated.canvas;
        currentImage = rotated.dataUrl;
        break;
        
      case 'crop':
        const cropped = await cropImage(currentImage, operation.value as CropArea);
        currentCanvas = cropped.canvas;
        currentImage = cropped.dataUrl;
        break;
        
      case 'brightness':
      case 'contrast':
        const enhanced = await enhanceImage(currentImage, {
          brightness: operation.type === 'brightness' ? operation.value as number : 0,
          contrast: operation.type === 'contrast' ? operation.value as number : 0,
          saturation: 0,
          sharpness: 0,
        });
        currentCanvas = enhanced.canvas;
        currentImage = enhanced.dataUrl;
        break;
        
      case 'compression':
        const compressed = await compressImage(currentImage, {
          quality: operation.value as number,
        });
        currentImage = compressed.dataUrl;
        break;
        
      case 'resize':
        const resized = await resizeImage(
          currentImage,
          (operation.value as any).width,
          (operation.value as any).height
        );
        currentCanvas = resized.canvas;
        currentImage = resized.dataUrl;
        break;
    }
  }
  
  // Create new blob from processed image
  const blob = await new Promise<Blob>((resolve, reject) => {
    if (currentCanvas) {
      currentCanvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Kunde inte skapa bearbetad bild'));
        },
        file.type,
        file.qualityLevel || 0.8
      );
    } else {
      // Fallback to original file
      resolve(file.file);
    }
  });
  
  // Create new file
  const newFile = new File([blob], file.name, { type: file.type });
  
  // Update file properties
  const updatedFile: MobilePhotoUploadFile = {
    ...file,
    file: newFile,
    size: blob.size,
    preview: currentImage,
    processingHistory: [...file.processingHistory, ...operations],
    isEdited: true,
    currentDimensions: currentCanvas ? {
      width: currentCanvas.width,
      height: currentCanvas.height,
    } : file.currentDimensions,
  };
  
  return updatedFile;
}

/**
 * Get image dimensions from file or data URL
 */
export async function getImageDimensions(source: string | File): Promise<{ width: number; height: number }> {
  const img = await loadImage(source);
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  };
}

/**
 * Calculate optimal compression settings based on image content
 */
export function calculateOptimalCompression(
  dimensions: { width: number; height: number },
  fileSize: number,
  targetSize: number = 2 * 1024 * 1024 // 2MB default
): { quality: number; maxDimensions: { width: number; height: number } } {
  const pixelCount = dimensions.width * dimensions.height;
  const compressionNeeded = fileSize > targetSize;
  
  if (!compressionNeeded) {
    return {
      quality: 0.9,
      maxDimensions: dimensions,
    };
  }
  
  // Calculate quality based on file size ratio
  const sizeRatio = targetSize / fileSize;
  let quality = Math.max(0.5, Math.min(0.9, sizeRatio));
  
  // Calculate max dimensions based on pixel count
  let scaleFactor = 1;
  if (pixelCount > 4000000) { // > 4MP
    scaleFactor = 0.7;
  } else if (pixelCount > 2000000) { // > 2MP
    scaleFactor = 0.8;
  } else if (pixelCount > 1000000) { // > 1MP
    scaleFactor = 0.9;
  }
  
  return {
    quality,
    maxDimensions: {
      width: Math.round(dimensions.width * scaleFactor),
      height: Math.round(dimensions.height * scaleFactor),
    },
  };
}