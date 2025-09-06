/**
 * Client-side Chunked Upload Manager
 * Handles chunked uploads from the browser with progress tracking and retry logic
 */

import crypto from 'crypto';

export interface ChunkedUploadConfig {
  chunkSize?: number; // Default 2MB
  maxConcurrentChunks?: number; // Default 3
  maxRetriesPerChunk?: number; // Default 3
  retryDelay?: number; // Default 1000ms
  enableIntegrityVerification?: boolean;
  onProgress?: (progress: ChunkedUploadProgress) => void;
  onChunkProgress?: (chunkNumber: number, progress: number) => void;
  onChunkComplete?: (chunkNumber: number, result: ChunkUploadResult) => void;
  onChunkError?: (chunkNumber: number, error: Error) => void;
  onComplete?: (result: UploadCompleteResult) => void;
  onError?: (error: Error) => void;
}

export interface ChunkedUploadProgress {
  sessionId: string;
  uploadId: string;
  filename: string;
  fileSize: number;
  chunksUploaded: number;
  totalChunks: number;
  progressPercentage: number;
  uploadedBytes: number;
  remainingBytes: number;
  uploadSpeed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
  currentChunks: Array<{
    chunkNumber: number;
    status: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'retrying';
    progress: number;
    error?: string;
  }>;
  errors: string[];
  warnings: string[];
  status: 'initializing' | 'uploading' | 'assembling' | 'completed' | 'failed' | 'cancelled';
}

export interface ChunkUploadResult {
  chunkId: string;
  chunkNumber: number;
  chunkHash: string;
  uploadSpeed: number;
  nextChunkNumber?: number;
}

export interface UploadCompleteResult {
  sessionId: string;
  uploadId: string;
  filename: string;
  fileSize: number;
  finalFilePath: string;
  totalUploadTime: number;
  averageSpeed: number;
}

export interface ChunkedUploadSession {
  sessionId: string;
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  expiresAt: string;
  maxConcurrentChunks: number;
  resumable: boolean;
}

export class ChunkedUploadClient {
  private config: Required<ChunkedUploadConfig>;
  private file: File;
  private session: ChunkedUploadSession | null = null;
  private chunks: Map<number, { data: ArrayBuffer; hash: string }> = new Map();
  private chunkStates: Map<number, {
    status: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'retrying';
    progress: number;
    retryCount: number;
    error?: string;
    uploadController?: AbortController;
  }> = new Map();
  
  private uploadStartTime: number = 0;
  private uploadedBytes: number = 0;
  private activeUploads: Set<number> = new Set();
  private cancelled: boolean = false;

  constructor(file: File, config: ChunkedUploadConfig = {}) {
    this.file = file;
    this.config = {
      chunkSize: config.chunkSize || 2 * 1024 * 1024, // 2MB
      maxConcurrentChunks: config.maxConcurrentChunks || 3,
      maxRetriesPerChunk: config.maxRetriesPerChunk || 3,
      retryDelay: config.retryDelay || 1000,
      enableIntegrityVerification: config.enableIntegrityVerification !== false,
      onProgress: config.onProgress || (() => {}),
      onChunkProgress: config.onChunkProgress || (() => {}),
      onChunkComplete: config.onChunkComplete || (() => {}),
      onChunkError: config.onChunkError || (() => {}),
      onComplete: config.onComplete || (() => {}),
      onError: config.onError || (() => {}),
    };
  }

  /**
   * Initialize the upload session
   */
  async initialize(metadata?: Record<string, any>): Promise<ChunkedUploadSession> {
    try {
      // Calculate file hash if integrity verification is enabled
      let fileHash: string | undefined;
      if (this.config.enableIntegrityVerification) {
        fileHash = await this.calculateFileHash(this.file);
      }

      // Prepare chunks
      await this.prepareChunks();

      // Initialize session via API
      const response = await fetch('/api/upload/chunks/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: this.file.name,
          fileSize: this.file.size,
          chunkSize: this.config.chunkSize,
          fileHash,
          mimeType: this.file.type,
          contentType: this.file.type,
          metadata,
          maxRetriesPerChunk: this.config.maxRetriesPerChunk,
          concurrentChunksAllowed: this.config.maxConcurrentChunks,
          virusScanEnabled: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initialize upload session');
      }

      const result = await response.json();
      this.session = result.data;

      // Initialize chunk states
      const totalChunks = Math.ceil(this.file.size / this.config.chunkSize);
      for (let i = 0; i < totalChunks; i++) {
        this.chunkStates.set(i, {
          status: 'pending',
          progress: 0,
          retryCount: 0,
        });
      }

      this.uploadStartTime = Date.now();
      this.notifyProgress();

      return this.session;
    } catch (error) {
      this.config.onError(error instanceof Error ? error : new Error('Initialization failed'));
      throw error;
    }
  }

  /**
   * Start the chunked upload
   */
  async upload(): Promise<UploadCompleteResult> {
    if (!this.session) {
      throw new Error('Session not initialized. Call initialize() first.');
    }

    if (this.cancelled) {
      throw new Error('Upload was cancelled');
    }

    try {
      this.uploadStartTime = Date.now();
      
      // Start uploading chunks concurrently
      await this.uploadChunksConcurrently();

      // Wait for completion or failure
      return await this.waitForCompletion();

    } catch (error) {
      this.config.onError(error instanceof Error ? error : new Error('Upload failed'));
      throw error;
    }
  }

  /**
   * Resume an existing upload session
   */
  async resume(sessionId: string): Promise<UploadCompleteResult> {
    try {
      // Get session info and resume
      const response = await fetch(`/api/upload/chunks/${sessionId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resume session');
      }

      const result = await response.json();
      const resumeData = result.data;

      if (!resumeData.canResume) {
        // Already complete
        if (resumeData.progress?.progressPercentage === 100) {
          return {
            sessionId,
            uploadId: resumeData.progress.uploadId || sessionId,
            filename: this.file.name,
            fileSize: this.file.size,
            finalFilePath: '',
            totalUploadTime: 0,
            averageSpeed: 0,
          };
        }
        throw new Error('Session cannot be resumed');
      }

      // Update session info
      this.session = {
        sessionId,
        uploadId: sessionId, // Use sessionId as uploadId for now
        chunkSize: this.config.chunkSize,
        totalChunks: resumeData.progress?.totalChunks || Math.ceil(this.file.size / this.config.chunkSize),
        expiresAt: '',
        maxConcurrentChunks: this.config.maxConcurrentChunks,
        resumable: true,
      };

      // Update chunk states based on resume data
      this.chunkStates.clear();
      const totalChunks = this.session.totalChunks;
      
      for (let i = 0; i < totalChunks; i++) {
        const isCompleted = resumeData.completedChunks.includes(i);
        const isMissing = resumeData.missingChunks.includes(i);
        
        this.chunkStates.set(i, {
          status: isCompleted ? 'uploaded' : 'pending',
          progress: isCompleted ? 100 : 0,
          retryCount: 0,
        });

        if (isCompleted) {
          this.uploadedBytes += this.getChunkSize(i);
        }
      }

      // Prepare missing chunks
      await this.prepareChunks(resumeData.missingChunks);

      this.uploadStartTime = Date.now();
      this.notifyProgress();

      // Continue upload
      await this.uploadChunksConcurrently(resumeData.missingChunks);
      return await this.waitForCompletion();

    } catch (error) {
      this.config.onError(error instanceof Error ? error : new Error('Resume failed'));
      throw error;
    }
  }

  /**
   * Cancel the upload
   */
  async cancel(): Promise<void> {
    this.cancelled = true;

    // Cancel all active uploads
    for (const chunkNumber of this.activeUploads) {
      const chunkState = this.chunkStates.get(chunkNumber);
      if (chunkState?.uploadController) {
        chunkState.uploadController.abort();
      }
    }

    // Cancel session via API
    if (this.session) {
      try {
        await fetch(`/api/upload/chunks/${this.session.sessionId}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Failed to cancel session via API:', error);
      }
    }
  }

  /**
   * Get current upload progress
   */
  getProgress(): ChunkedUploadProgress {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    const totalChunks = this.session.totalChunks;
    const chunksUploaded = Array.from(this.chunkStates.values())
      .filter(state => state.status === 'uploaded').length;
    
    const progressPercentage = (chunksUploaded / totalChunks) * 100;
    const remainingBytes = this.file.size - this.uploadedBytes;
    
    // Calculate upload speed
    const elapsedTime = (Date.now() - this.uploadStartTime) / 1000; // seconds
    const uploadSpeed = elapsedTime > 0 ? this.uploadedBytes / elapsedTime : 0;
    
    // Estimate time remaining
    const estimatedTimeRemaining = uploadSpeed > 0 ? remainingBytes / uploadSpeed : 0;

    const currentChunks = Array.from(this.chunkStates.entries()).map(([chunkNumber, state]) => ({
      chunkNumber,
      status: state.status,
      progress: state.progress,
      error: state.error,
    }));

    const errors = Array.from(this.chunkStates.values())
      .filter(state => state.error)
      .map(state => state.error!)
      .filter((error, index, arr) => arr.indexOf(error) === index); // unique errors

    return {
      sessionId: this.session.sessionId,
      uploadId: this.session.uploadId,
      filename: this.file.name,
      fileSize: this.file.size,
      chunksUploaded,
      totalChunks,
      progressPercentage,
      uploadedBytes: this.uploadedBytes,
      remainingBytes,
      uploadSpeed,
      estimatedTimeRemaining,
      currentChunks,
      errors,
      warnings: [],
      status: this.getUploadStatus(),
    };
  }

  /**
   * Prepare chunks from the file
   */
  private async prepareChunks(specificChunks?: number[]): Promise<void> {
    const totalChunks = Math.ceil(this.file.size / this.config.chunkSize);
    const chunksToProcess = specificChunks || Array.from({ length: totalChunks }, (_, i) => i);

    for (const chunkNumber of chunksToProcess) {
      if (this.chunks.has(chunkNumber)) continue; // Already prepared

      const start = chunkNumber * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, this.file.size);
      const chunkBlob = this.file.slice(start, end);
      const chunkData = await chunkBlob.arrayBuffer();

      let chunkHash = '';
      if (this.config.enableIntegrityVerification) {
        chunkHash = await this.calculateChunkHash(chunkData);
      }

      this.chunks.set(chunkNumber, { data: chunkData, hash: chunkHash });
    }
  }

  /**
   * Upload chunks concurrently
   */
  private async uploadChunksConcurrently(specificChunks?: number[]): Promise<void> {
    const totalChunks = this.session!.totalChunks;
    const chunksToUpload = specificChunks || Array.from({ length: totalChunks }, (_, i) => i)
      .filter(i => this.chunkStates.get(i)?.status === 'pending');

    const uploadPromises: Promise<void>[] = [];
    let chunkIndex = 0;

    // Create a function to process the next chunk
    const processNextChunk = async (): Promise<void> => {
      while (chunkIndex < chunksToUpload.length && !this.cancelled) {
        const chunkNumber = chunksToUpload[chunkIndex++];
        const chunkState = this.chunkStates.get(chunkNumber);
        
        if (!chunkState || chunkState.status !== 'pending') continue;
        
        await this.uploadChunk(chunkNumber);
      }
    };

    // Start concurrent uploads
    const concurrency = Math.min(this.config.maxConcurrentChunks, chunksToUpload.length);
    for (let i = 0; i < concurrency; i++) {
      uploadPromises.push(processNextChunk());
    }

    await Promise.all(uploadPromises);
  }

  /**
   * Upload a single chunk
   */
  private async uploadChunk(chunkNumber: number): Promise<void> {
    const chunkData = this.chunks.get(chunkNumber);
    const chunkState = this.chunkStates.get(chunkNumber);
    
    if (!chunkData || !chunkState || !this.session) {
      throw new Error(`Chunk ${chunkNumber} not found or invalid state`);
    }

    if (this.cancelled) return;

    const controller = new AbortController();
    chunkState.uploadController = controller;
    
    try {
      this.activeUploads.add(chunkNumber);
      chunkState.status = 'uploading';
      chunkState.progress = 0;
      
      this.config.onChunkProgress(chunkNumber, 0);
      this.notifyProgress();

      const response = await fetch(`/api/upload/chunks/${this.session.sessionId}/${chunkNumber}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': chunkData.data.byteLength.toString(),
          'X-Chunk-Hash': chunkData.hash,
          'X-Is-Last-Chunk': (chunkNumber === this.session.totalChunks - 1).toString(),
        },
        body: chunkData.data,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to upload chunk ${chunkNumber}`);
      }

      const result = await response.json();
      
      // Update state
      chunkState.status = 'uploaded';
      chunkState.progress = 100;
      chunkState.error = undefined;
      
      this.uploadedBytes += chunkData.data.byteLength;
      this.activeUploads.delete(chunkNumber);

      this.config.onChunkComplete(chunkNumber, {
        chunkId: result.data.chunkId,
        chunkNumber,
        chunkHash: result.data.chunkHash,
        uploadSpeed: result.data.uploadSpeed || 0,
        nextChunkNumber: result.data.nextChunkNumber,
      });

      this.config.onChunkProgress(chunkNumber, 100);
      this.notifyProgress();

    } catch (error) {
      this.activeUploads.delete(chunkNumber);
      
      if (controller.signal.aborted) {
        chunkState.status = 'pending';
        return; // Upload was cancelled
      }

      chunkState.retryCount++;
      chunkState.error = error instanceof Error ? error.message : 'Unknown error';

      if (chunkState.retryCount < this.config.maxRetriesPerChunk) {
        chunkState.status = 'retrying';
        this.config.onChunkError(chunkNumber, error instanceof Error ? error : new Error('Upload failed'));
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * chunkState.retryCount));
        
        // Retry if not cancelled
        if (!this.cancelled) {
          chunkState.status = 'pending';
          await this.uploadChunk(chunkNumber);
        }
      } else {
        chunkState.status = 'failed';
        this.config.onChunkError(chunkNumber, error instanceof Error ? error : new Error('Max retries exceeded'));
        this.notifyProgress();
        throw error;
      }
    }
  }

  /**
   * Wait for upload completion
   */
  private async waitForCompletion(): Promise<UploadCompleteResult> {
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        if (this.cancelled) {
          reject(new Error('Upload cancelled'));
          return;
        }

        const progress = this.getProgress();
        
        if (progress.status === 'completed') {
          const totalUploadTime = (Date.now() - this.uploadStartTime) / 1000;
          const averageSpeed = this.file.size / totalUploadTime;

          const result: UploadCompleteResult = {
            sessionId: this.session!.sessionId,
            uploadId: this.session!.uploadId,
            filename: this.file.name,
            fileSize: this.file.size,
            finalFilePath: '', // Will be set by server
            totalUploadTime,
            averageSpeed,
          };

          this.config.onComplete(result);
          resolve(result);
          return;
        }

        if (progress.status === 'failed') {
          reject(new Error('Upload failed with errors: ' + progress.errors.join(', ')));
          return;
        }

        // Check again in 1 second
        setTimeout(checkCompletion, 1000);
      };

      checkCompletion();
    });
  }

  /**
   * Calculate file hash for integrity verification
   */
  private async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Calculate chunk hash
   */
  private async calculateChunkHash(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get chunk size for a specific chunk number
   */
  private getChunkSize(chunkNumber: number): number {
    const start = chunkNumber * this.config.chunkSize;
    const end = Math.min(start + this.config.chunkSize, this.file.size);
    return end - start;
  }

  /**
   * Get current upload status
   */
  private getUploadStatus(): ChunkedUploadProgress['status'] {
    if (this.cancelled) return 'cancelled';
    if (!this.session) return 'initializing';

    const states = Array.from(this.chunkStates.values());
    const hasFailed = states.some(state => state.status === 'failed');
    const hasUploading = states.some(state => state.status === 'uploading' || state.status === 'retrying');
    const allUploaded = states.every(state => state.status === 'uploaded');

    if (hasFailed) return 'failed';
    if (allUploaded) return 'completed';
    if (hasUploading) return 'uploading';
    return 'uploading';
  }

  /**
   * Notify progress callback
   */
  private notifyProgress(): void {
    const progress = this.getProgress();
    this.config.onProgress(progress);
  }
}