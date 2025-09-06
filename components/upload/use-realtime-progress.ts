'use client';

import * as React from 'react';
import { useEffect, useRef, useCallback, useState } from 'react';
import { UploadFile, RealtimeProgressConfig, UploadProgressInfo } from './types';

interface ProgressUpdate {
  fileId: string;
  progress: number;
  status: UploadFile['status'];
  uploadInfo?: UploadProgressInfo;
  error?: string;
  bytesUploaded?: number;
  uploadSpeed?: number;
  estimatedTimeRemaining?: number;
  chunks?: {
    total: number;
    uploaded: number;
    failed: number[];
  };
}

interface UseRealtimeProgressProps {
  config: RealtimeProgressConfig;
  onProgressUpdate: (update: ProgressUpdate) => void;
  onConnectionStateChange?: (connected: boolean) => void;
}

/**
 * Custom hook for real-time upload progress tracking using Server-Sent Events
 * Provides automatic reconnection and connection state management
 */
export function useRealtimeProgress({
  config,
  onProgressUpdate,
  onConnectionStateChange,
}: UseRealtimeProgressProps) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);

  const maxReconnectAttempts = config.maxReconnectAttempts || 10;
  const reconnectDelay = config.reconnectDelay || 1000;

  // Handle connection state changes
  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
    onConnectionStateChange?.(connected);
  }, [onConnectionStateChange]);

  // Process progress update
  const processProgressUpdate = useCallback((data: any) => {
    try {
      const update: ProgressUpdate = typeof data === 'string' ? JSON.parse(data) : data;
      onProgressUpdate(update);
    } catch (error) {
      console.error('Failed to parse progress update:', error);
    }
  }, [onProgressUpdate]);

  // Setup Server-Sent Events connection
  const setupSSE = useCallback(() => {
    if (!config.useSSE || !config.sseUrl) return;

    try {
      const eventSource = new EventSource(config.sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection opened');
        handleConnectionChange(true);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        processProgressUpdate(event.data);
      };

      // Handle specific event types
      eventSource.addEventListener('progress', (event) => {
        processProgressUpdate(event.data);
      });

      eventSource.addEventListener('error', (event) => {
        console.warn('SSE progress error:', event);
      });

      eventSource.addEventListener('complete', (event) => {
        processProgressUpdate(event.data);
      });

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        handleConnectionChange(false);
        
        if (config.autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            setupSSE();
          }, delay);
        }
      };

    } catch (error) {
      console.error('Failed to setup SSE connection:', error);
      handleConnectionChange(false);
    }
  }, [config, handleConnectionChange, processProgressUpdate, maxReconnectAttempts, reconnectDelay]);

  // Setup WebSocket connection
  const setupWebSocket = useCallback(() => {
    if (!config.useWebSocket || !config.wsUrl) return;

    try {
      const websocket = new WebSocket(config.wsUrl);
      websocketRef.current = websocket;

      websocket.onopen = () => {
        console.log('WebSocket connection opened');
        handleConnectionChange(true);
        reconnectAttemptsRef.current = 0;
      };

      websocket.onmessage = (event) => {
        processProgressUpdate(event.data);
      };

      websocket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        handleConnectionChange(false);
        
        if (config.autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            setupWebSocket();
          }, delay);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        handleConnectionChange(false);
      };

    } catch (error) {
      console.error('Failed to setup WebSocket connection:', error);
      handleConnectionChange(false);
    }
  }, [config, handleConnectionChange, processProgressUpdate, maxReconnectAttempts, reconnectDelay]);

  // Initialize connections
  useEffect(() => {
    if (config.useSSE) {
      setupSSE();
    }
    
    if (config.useWebSocket) {
      setupWebSocket();
    }

    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      handleConnectionChange(false);
    };
  }, [config, setupSSE, setupWebSocket, handleConnectionChange]);

  // Manual reconnection function
  const reconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectAttemptsRef.current = 0;
    
    if (config.useSSE) {
      setupSSE();
    }
    
    if (config.useWebSocket) {
      setupWebSocket();
    }
  }, [config, setupSSE, setupWebSocket]);

  // Send message (WebSocket only)
  const sendMessage = useCallback((message: any) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  return {
    isConnected,
    reconnect,
    sendMessage,
    reconnectAttempts: reconnectAttemptsRef.current,
  };
}

/**
 * Hook for progress persistence across page refreshes
 * Stores upload progress in localStorage with automatic cleanup
 */
export function useProgressPersistence(storageKey: string = 'brf-upload-progress') {
  const saveProgress = useCallback((files: UploadFile[]) => {
    try {
      const progressData = files.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: file.progress,
        status: file.status,
        error: file.error,
        bytesUploaded: file.bytesUploaded,
        startTime: file.startTime,
        retryCount: file.retryCount,
        canRetry: file.canRetry,
        chunks: file.chunks,
      }));
      
      localStorage.setItem(storageKey, JSON.stringify({
        timestamp: Date.now(),
        files: progressData,
      }));
    } catch (error) {
      console.error('Failed to save progress to localStorage:', error);
    }
  }, [storageKey]);

  const loadProgress = useCallback((): Partial<UploadFile>[] => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return [];
      
      const data = JSON.parse(stored);
      
      // Clean up old data (older than 24 hours)
      if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(storageKey);
        return [];
      }
      
      return data.files || [];
    } catch (error) {
      console.error('Failed to load progress from localStorage:', error);
      return [];
    }
  }, [storageKey]);

  const clearProgress = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear progress from localStorage:', error);
    }
  }, [storageKey]);

  return {
    saveProgress,
    loadProgress,
    clearProgress,
  };
}

/**
 * Hook for upload progress calculations and statistics
 */
export function useUploadStatistics(files: UploadFile[]) {
  return React.useMemo(() => {
    const total = files.length;
    const completed = files.filter(f => f.status === 'completed').length;
    const uploading = files.filter(f => f.status === 'uploading').length;
    const pending = files.filter(f => f.status === 'pending').length;
    const failed = files.filter(f => f.status === 'error').length;
    const cancelled = files.filter(f => f.status === 'cancelled').length;
    const paused = files.filter(f => f.status === 'paused').length;

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const uploadedSize = files.reduce((sum, file) => sum + (file.bytesUploaded || 0), 0);
    const remainingSize = totalSize - uploadedSize;

    const activeUploads = files.filter(f => f.status === 'uploading' && f.uploadSpeed);
    const averageSpeed = activeUploads.length > 0 
      ? activeUploads.reduce((sum, file) => sum + (file.uploadSpeed || 0), 0) / activeUploads.length
      : 0;

    const estimatedTimeRemaining = averageSpeed > 0 ? (remainingSize / averageSpeed) * 1000 : 0;

    const overallProgress = total > 0 
      ? Math.round((uploadedSize / totalSize) * 100)
      : 0;

    return {
      total,
      completed,
      uploading,
      pending,
      failed,
      cancelled,
      paused,
      totalSize,
      uploadedSize,
      remainingSize,
      averageSpeed,
      estimatedTimeRemaining,
      overallProgress,
    };
  }, [files]);
}