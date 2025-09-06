'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from './mobile-slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  RotateCw, 
  Crop, 
  Sun, 
  Contrast, 
  Palette, 
  Undo, 
  Redo, 
  RotateCcw,
  X,
  Check,
  Reset,
  Maximize
} from 'lucide-react';
import { 
  MobilePhotoUploadFile, 
  ImageProcessingOperation, 
  CropArea,
  ImageEnhancementSettings,
  MobileTexts 
} from './mobile-types';
import { 
  rotateImage, 
  cropImage, 
  enhanceImage, 
  processMobilePhoto,
  createCanvasFromImage,
  loadImage
} from './image-processing';
import { swedishMobileTexts } from './mobile-translations';

export interface MobilePhotoEditorProps {
  /** Photo to edit */
  photo: MobilePhotoUploadFile;
  /** Swedish translations */
  texts?: Partial<MobileTexts>;
  /** Custom class name */
  className?: string;
  /** Show advanced controls */
  showAdvanced?: boolean;
  /** Enable crop functionality */
  enableCrop?: boolean;
  /** Enable rotation */
  enableRotation?: boolean;
  /** Enable enhancement controls */
  enableEnhancement?: boolean;
  /** Callback when editing is complete */
  onSave?: (editedPhoto: MobilePhotoUploadFile) => void;
  /** Callback when editing is cancelled */
  onCancel?: () => void;
  /** Callback for processing updates */
  onProcessing?: (isProcessing: boolean) => void;
}

export default function MobilePhotoEditor({
  photo,
  texts = {},
  className = '',
  showAdvanced = true,
  enableCrop = true,
  enableRotation = true,
  enableEnhancement = true,
  onSave,
  onCancel,
  onProcessing,
}: MobilePhotoEditorProps) {
  const mergedTexts = { ...swedishMobileTexts, ...texts };
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropOverlayRef = useRef<HTMLDivElement>(null);
  
  const [currentImage, setCurrentImage] = useState(photo.preview || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('rotate');
  const [dimensions, setDimensions] = useState(photo.currentDimensions || { width: 0, height: 0 });
  
  // Processing history and undo/redo
  const [history, setHistory] = useState<ImageProcessingOperation[]>([...photo.processingHistory]);
  const [historyIndex, setHistoryIndex] = useState(history.length);
  
  // Transform states
  const [rotation, setRotation] = useState(0);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [enhancements, setEnhancements] = useState<ImageEnhancementSettings>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 0,
  });
  
  // Touch and gesture states
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  /**
   * Apply processing operation
   */
  const applyOperation = useCallback(async (operation: ImageProcessingOperation) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    onProcessing?.(true);
    
    try {
      let result;
      
      switch (operation.type) {
        case 'rotate':
          result = await rotateImage(currentImage, operation.value as number);
          setCurrentImage(result.dataUrl);
          setDimensions({ width: result.canvas.width, height: result.canvas.height });
          setRotation(prev => prev + (operation.value as number));
          break;
          
        case 'crop':
          if (cropArea) {
            result = await cropImage(currentImage, cropArea);
            setCurrentImage(result.dataUrl);
            setDimensions({ width: result.canvas.width, height: result.canvas.height });
            setCropArea(null);
            setIsCropping(false);
          }
          break;
          
        case 'brightness':
        case 'contrast':
        case 'saturation':
          const newEnhancements = { ...enhancements, [operation.type]: operation.value };
          result = await enhanceImage(currentImage, newEnhancements as ImageEnhancementSettings);
          setCurrentImage(result.dataUrl);
          setEnhancements(newEnhancements);
          break;
      }
      
      // Add to history
      const newHistory = [...history.slice(0, historyIndex), operation];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length);
      
    } catch (error) {
      console.error('Processing error:', error);
    } finally {
      setIsProcessing(false);
      onProcessing?.(false);
    }
  }, [currentImage, isProcessing, cropArea, enhancements, history, historyIndex, onProcessing]);

  /**
   * Handle rotation
   */
  const handleRotate = useCallback((degrees: number) => {
    const operation: ImageProcessingOperation = {
      type: 'rotate',
      value: degrees,
      timestamp: Date.now(),
    };
    applyOperation(operation);
  }, [applyOperation]);

  /**
   * Handle crop start
   */
  const handleCropStart = useCallback(() => {
    setIsCropping(true);
    setCropArea({
      x: dimensions.width * 0.1,
      y: dimensions.height * 0.1,
      width: dimensions.width * 0.8,
      height: dimensions.height * 0.8,
    });
  }, [dimensions]);

  /**
   * Handle crop apply
   */
  const handleCropApply = useCallback(() => {
    if (cropArea) {
      const operation: ImageProcessingOperation = {
        type: 'crop',
        value: cropArea,
        timestamp: Date.now(),
      };
      applyOperation(operation);
    }
  }, [cropArea, applyOperation]);

  /**
   * Handle enhancement change
   */
  const handleEnhancementChange = useCallback((type: keyof ImageEnhancementSettings, value: number) => {
    const operation: ImageProcessingOperation = {
      type,
      value,
      timestamp: Date.now(),
    };
    applyOperation(operation);
  }, [applyOperation]);

  /**
   * Handle undo
   */
  const handleUndo = useCallback(async () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      // Reapply all operations up to the new index
      await replayHistory(history.slice(0, historyIndex - 1));
    }
  }, [history, historyIndex]);

  /**
   * Handle redo
   */
  const handleRedo = useCallback(async () => {
    if (historyIndex < history.length) {
      setHistoryIndex(historyIndex + 1);
      // Reapply all operations up to the new index
      await replayHistory(history.slice(0, historyIndex + 1));
    }
  }, [history, historyIndex]);

  /**
   * Replay processing history
   */
  const replayHistory = useCallback(async (operations: ImageProcessingOperation[]) => {
    setIsProcessing(true);
    onProcessing?.(true);
    
    try {
      const reprocessedPhoto = await processMobilePhoto(photo, operations);
      setCurrentImage(reprocessedPhoto.preview || '');
      setDimensions(reprocessedPhoto.currentDimensions || { width: 0, height: 0 });
    } catch (error) {
      console.error('History replay error:', error);
    } finally {
      setIsProcessing(false);
      onProcessing?.(false);
    }
  }, [photo, onProcessing]);

  /**
   * Handle reset
   */
  const handleReset = useCallback(() => {
    setCurrentImage(photo.preview || '');
    setDimensions(photo.originalDimensions || { width: 0, height: 0 });
    setHistory([]);
    setHistoryIndex(0);
    setRotation(0);
    setCropArea(null);
    setIsCropping(false);
    setEnhancements({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
    });
  }, [photo]);

  /**
   * Handle save
   */
  const handleSave = useCallback(async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    onProcessing?.(true);
    
    try {
      const editedPhoto = await processMobilePhoto(photo, history);
      onSave?.(editedPhoto);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsProcessing(false);
      onProcessing?.(false);
    }
  }, [photo, history, isProcessing, onSave, onProcessing]);

  /**
   * Touch event handlers for crop area
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isCropping) return;
    
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
    e.preventDefault();
  }, [isCropping]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !cropArea || !isCropping) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;
    
    setCropArea(prev => prev ? {
      ...prev,
      x: Math.max(0, Math.min(dimensions.width - prev.width, prev.x + deltaX)),
      y: Math.max(0, Math.min(dimensions.height - prev.height, prev.y + deltaY)),
    } : null);
    
    setDragStart({ x: touch.clientX, y: touch.clientY });
    e.preventDefault();
  }, [isDragging, cropArea, isCropping, dragStart, dimensions]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length;
  const hasChanges = history.length > photo.processingHistory.length;

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="text-lg font-semibold">{mergedTexts.editor.title}</h3>
        <div className="flex gap-2">
          <Button
            onClick={handleUndo}
            disabled={!canUndo || isProcessing}
            variant="ghost"
            size="icon"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleRedo}
            disabled={!canRedo || isProcessing}
            variant="ghost"
            size="icon"
          >
            <Redo className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleReset}
            disabled={!hasChanges || isProcessing}
            variant="ghost"
            size="icon"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image Preview */}
      <div className="relative bg-black">
        <img
          src={currentImage}
          alt="Editing preview"
          className="w-full h-auto"
          style={{ maxHeight: '400px', objectFit: 'contain' }}
        />
        
        {/* Crop overlay */}
        {isCropping && cropArea && (
          <div
            ref={cropOverlayRef}
            className="absolute border-2 border-white border-dashed bg-transparent"
            style={{
              left: `${(cropArea.x / dimensions.width) * 100}%`,
              top: `${(cropArea.y / dimensions.height) * 100}%`,
              width: `${(cropArea.width / dimensions.width) * 100}%`,
              height: `${(cropArea.height / dimensions.height) * 100}%`,
              cursor: 'move',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="absolute inset-0 bg-white bg-opacity-20" />
          </div>
        )}
        
        {isProcessing && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
              <p>{mergedTexts.accessibility.processingIndicator}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rotate" className="text-xs">
              <RotateCw className="h-4 w-4 mr-1" />
              {mergedTexts.editor.rotate}
            </TabsTrigger>
            <TabsTrigger value="crop" disabled={!enableCrop} className="text-xs">
              <Crop className="h-4 w-4 mr-1" />
              {mergedTexts.editor.crop}
            </TabsTrigger>
            <TabsTrigger value="enhance" disabled={!enableEnhancement} className="text-xs">
              <Sun className="h-4 w-4 mr-1" />
              Förbättra
            </TabsTrigger>
          </TabsList>
          
          {/* Rotation Controls */}
          <TabsContent value="rotate" className="mt-4 space-y-4">
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => handleRotate(-90)}
                disabled={isProcessing}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                -90°
              </Button>
              <Button
                onClick={() => handleRotate(90)}
                disabled={isProcessing}
                variant="outline"
                size="sm"
              >
                <RotateCw className="h-4 w-4 mr-1" />
                90°
              </Button>
              <Button
                onClick={() => handleRotate(180)}
                disabled={isProcessing}
                variant="outline"
                size="sm"
              >
                180°
              </Button>
            </div>
          </TabsContent>
          
          {/* Crop Controls */}
          <TabsContent value="crop" className="mt-4 space-y-4">
            {!isCropping ? (
              <Button
                onClick={handleCropStart}
                disabled={isProcessing}
                className="w-full"
              >
                <Crop className="h-4 w-4 mr-2" />
                {mergedTexts.editor.crop}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleCropApply}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {mergedTexts.editor.apply}
                </Button>
                <Button
                  onClick={() => {
                    setIsCropping(false);
                    setCropArea(null);
                  }}
                  disabled={isProcessing}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  {mergedTexts.editor.cancel}
                </Button>
              </div>
            )}
          </TabsContent>
          
          {/* Enhancement Controls */}
          <TabsContent value="enhance" className="mt-4 space-y-4">
            {/* Brightness */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm flex items-center">
                  <Sun className="h-4 w-4 mr-1" />
                  {mergedTexts.editor.brightness}
                </label>
                <Badge variant="outline">{enhancements.brightness}</Badge>
              </div>
              <Slider
                value={[enhancements.brightness]}
                onValueChange={([value]) => handleEnhancementChange('brightness', value)}
                min={-100}
                max={100}
                step={5}
                disabled={isProcessing}
              />
            </div>
            
            {/* Contrast */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm flex items-center">
                  <Contrast className="h-4 w-4 mr-1" />
                  {mergedTexts.editor.contrast}
                </label>
                <Badge variant="outline">{enhancements.contrast}</Badge>
              </div>
              <Slider
                value={[enhancements.contrast]}
                onValueChange={([value]) => handleEnhancementChange('contrast', value)}
                min={-100}
                max={100}
                step={5}
                disabled={isProcessing}
              />
            </div>
            
            {/* Saturation */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm flex items-center">
                  <Palette className="h-4 w-4 mr-1" />
                  {mergedTexts.editor.saturation}
                </label>
                <Badge variant="outline">{enhancements.saturation}</Badge>
              </div>
              <Slider
                value={[enhancements.saturation]}
                onValueChange={([value]) => handleEnhancementChange('saturation', value)}
                min={-100}
                max={100}
                step={5}
                disabled={isProcessing}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 p-4 border-t">
        <Button
          onClick={onCancel}
          disabled={isProcessing}
          variant="outline"
          className="flex-1"
        >
          <X className="h-4 w-4 mr-2" />
          {mergedTexts.editor.cancel}
        </Button>
        <Button
          onClick={handleSave}
          disabled={isProcessing || !hasChanges}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-2" />
          {mergedTexts.editor.save}
        </Button>
      </div>
      
      {/* Processing History (Debug) */}
      {showAdvanced && history.length > 0 && (
        <div className="p-4 border-t bg-muted/50">
          <p className="text-xs text-muted-foreground mb-2">Bearbetningshistorik:</p>
          <div className="flex flex-wrap gap-1">
            {history.map((op, index) => (
              <Badge
                key={index}
                variant={index < historyIndex ? "default" : "outline"}
                className="text-xs"
              >
                {op.type}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}