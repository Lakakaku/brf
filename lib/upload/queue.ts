/**
 * Bulk Upload Queue Management System
 * Handles queue operations, prioritization, and worker assignment for the BRF Portal
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logEvent } from '../monitoring/events';

export interface QueueItem {
  id: string;
  cooperative_id: string;
  batch_id: string;
  queue_type: 'upload' | 'processing' | 'retry' | 'cleanup';
  priority: number; // 1=highest, 10=lowest
  queue_position: number;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'expired';
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
  worker_id?: string;
  worker_type: 'default' | 'heavy' | 'fast' | 'specialized';
  max_processing_time_minutes: number;
  dependencies: string[]; // batch IDs that must complete first
  prerequisite_checks: Record<string, any>;
  required_memory_mb: number;
  required_cpu_cores: number;
  required_disk_space_mb: number;
  progress_details: Record<string, any>;
  error_message?: string;
  error_details?: Record<string, any>;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Worker {
  id: string;
  worker_name: string;
  worker_type: 'default' | 'heavy' | 'fast' | 'specialized';
  status: 'idle' | 'busy' | 'maintenance' | 'offline' | 'error';
  health_status: 'healthy' | 'degraded' | 'unhealthy';
  max_concurrent_batches: number;
  max_concurrent_files: number;
  current_batches: number;
  current_files: number;
  supported_file_types: string[];
  max_file_size_mb: number;
  memory_limit_mb: number;
  cpu_cores: number;
  last_heartbeat_at?: string;
}

export class BulkUploadQueue {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
    this.initializeQueue();
  }

  /**
   * Initialize queue system and clean up stale entries
   */
  private initializeQueue(): void {
    // Clean up expired queue items
    this.cleanupExpiredItems();
    
    // Reset stuck items
    this.resetStuckItems();
    
    // Update queue positions
    this.reorderQueue();
  }

  /**
   * Add a new item to the queue
   */
  async addToQueue(params: {
    cooperative_id: string;
    batch_id: string;
    queue_type?: 'upload' | 'processing' | 'retry' | 'cleanup';
    priority?: number;
    worker_type?: 'default' | 'heavy' | 'fast' | 'specialized';
    scheduled_at?: Date;
    expires_at?: Date;
    max_processing_time_minutes?: number;
    dependencies?: string[];
    required_memory_mb?: number;
    required_cpu_cores?: number;
    required_disk_space_mb?: number;
  }): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Calculate queue position
    const position = this.getNextQueuePosition(params.priority || 5);
    
    const stmt = this.db.prepare(`
      INSERT INTO bulk_upload_queue (
        id, cooperative_id, batch_id, queue_type, priority, queue_position,
        scheduled_at, expires_at, worker_type, max_processing_time_minutes,
        dependencies, required_memory_mb, required_cpu_cores, 
        required_disk_space_mb, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.cooperative_id,
      params.batch_id,
      params.queue_type || 'upload',
      params.priority || 5,
      position,
      params.scheduled_at?.toISOString() || now,
      params.expires_at?.toISOString(),
      params.worker_type || 'default',
      params.max_processing_time_minutes || 60,
      JSON.stringify(params.dependencies || []),
      params.required_memory_mb || 512,
      params.required_cpu_cores || 1,
      params.required_disk_space_mb || 1024,
      now,
      now
    );

    // Log queue addition
    await logEvent({
      cooperative_id: params.cooperative_id,
      event_type: 'bulk_upload_queued',
      event_level: 'info',
      event_source: 'queue_manager',
      event_message: `Bulk upload batch ${params.batch_id} added to ${params.queue_type} queue`,
      batch_id: params.batch_id,
      event_data: {
        queue_item_id: id,
        priority: params.priority,
        worker_type: params.worker_type,
        position,
      },
    });

    // Reorder queue to maintain priority order
    this.reorderQueue();

    return id;
  }

  /**
   * Get next available queue item for processing
   */
  getNextQueueItem(worker_type?: string, cooperative_id?: string): QueueItem | null {
    let whereClause = `
      WHERE status = 'queued' 
      AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    `;
    
    const params: any[] = [];
    
    if (worker_type) {
      whereClause += ' AND worker_type = ?';
      params.push(worker_type);
    }
    
    if (cooperative_id) {
      whereClause += ' AND cooperative_id = ?';
      params.push(cooperative_id);
    }

    // Check dependencies are met
    const stmt = this.db.prepare(`
      SELECT q.* FROM bulk_upload_queue q
      ${whereClause}
      AND NOT EXISTS (
        SELECT 1 FROM json_each(q.dependencies) dep
        JOIN bulk_upload_queue dep_q ON dep_q.batch_id = dep.value
        WHERE dep_q.status NOT IN ('completed', 'cancelled')
      )
      ORDER BY priority ASC, queue_position ASC
      LIMIT 1
    `);

    const result = stmt.get(...params);
    
    if (result) {
      return {
        ...result,
        dependencies: JSON.parse(result.dependencies || '[]'),
        prerequisite_checks: JSON.parse(result.prerequisite_checks || '{}'),
        progress_details: JSON.parse(result.progress_details || '{}'),
        error_details: result.error_details ? JSON.parse(result.error_details) : undefined,
      };
    }
    
    return null;
  }

  /**
   * Assign queue item to a worker
   */
  async assignToWorker(queueItemId: string, workerId: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_queue 
      SET status = 'running', worker_id = ?, started_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status = 'queued'
    `);

    const result = stmt.run(workerId, queueItemId);
    
    if (result.changes > 0) {
      // Get queue item details for logging
      const queueItem = this.getQueueItemById(queueItemId);
      if (queueItem) {
        await logEvent({
          cooperative_id: queueItem.cooperative_id,
          event_type: 'worker_assigned',
          event_level: 'info',
          event_source: 'queue_manager',
          event_message: `Worker ${workerId} assigned to process batch ${queueItem.batch_id}`,
          batch_id: queueItem.batch_id,
          worker_id: workerId,
          event_data: { queue_item_id: queueItemId },
        });
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Mark queue item as completed
   */
  async completeQueueItem(queueItemId: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_queue 
      SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status = 'running'
    `);

    const result = stmt.run(queueItemId);
    
    if (result.changes > 0) {
      const queueItem = this.getQueueItemById(queueItemId);
      if (queueItem) {
        await logEvent({
          cooperative_id: queueItem.cooperative_id,
          event_type: 'worker_completed',
          event_level: 'info',
          event_source: 'queue_manager',
          event_message: `Batch ${queueItem.batch_id} processing completed`,
          batch_id: queueItem.batch_id,
          worker_id: queueItem.worker_id,
          event_data: { queue_item_id: queueItemId },
        });
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Mark queue item as failed and handle retry logic
   */
  async failQueueItem(
    queueItemId: string, 
    errorMessage: string, 
    errorDetails?: Record<string, any>
  ): Promise<boolean> {
    const queueItem = this.getQueueItemById(queueItemId);
    if (!queueItem) return false;

    const shouldRetry = queueItem.retry_count < queueItem.max_retries;
    
    if (shouldRetry) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, queueItem.retry_count) * 60000; // Start with 1 minute
      const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
      
      const stmt = this.db.prepare(`
        UPDATE bulk_upload_queue 
        SET status = 'queued', retry_count = retry_count + 1, next_retry_at = ?, 
            error_message = ?, error_details = ?, updated_at = datetime('now')
        WHERE id = ?
      `);

      stmt.run(nextRetryAt, errorMessage, JSON.stringify(errorDetails || {}), queueItemId);

      await logEvent({
        cooperative_id: queueItem.cooperative_id,
        event_type: 'retry_attempted',
        event_level: 'warning',
        event_source: 'queue_manager',
        event_message: `Batch ${queueItem.batch_id} scheduled for retry (attempt ${queueItem.retry_count + 1}/${queueItem.max_retries})`,
        batch_id: queueItem.batch_id,
        worker_id: queueItem.worker_id,
        error_message: errorMessage,
        event_data: { 
          queue_item_id: queueItemId, 
          retry_count: queueItem.retry_count + 1,
          next_retry_at: nextRetryAt,
        },
      });
    } else {
      // Max retries reached, mark as permanently failed
      const stmt = this.db.prepare(`
        UPDATE bulk_upload_queue 
        SET status = 'failed', error_message = ?, error_details = ?, updated_at = datetime('now')
        WHERE id = ?
      `);

      stmt.run(errorMessage, JSON.stringify(errorDetails || {}), queueItemId);

      await logEvent({
        cooperative_id: queueItem.cooperative_id,
        event_type: 'worker_failed',
        event_level: 'error',
        event_source: 'queue_manager',
        event_message: `Batch ${queueItem.batch_id} permanently failed after ${queueItem.max_retries} retries`,
        batch_id: queueItem.batch_id,
        worker_id: queueItem.worker_id,
        error_message: errorMessage,
        event_data: { 
          queue_item_id: queueItemId, 
          retry_count: queueItem.retry_count,
          error_details: errorDetails,
        },
      });
    }

    return true;
  }

  /**
   * Cancel a queue item
   */
  async cancelQueueItem(queueItemId: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_queue 
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ? AND status IN ('queued', 'running')
    `);

    const result = stmt.run(queueItemId);
    
    if (result.changes > 0) {
      const queueItem = this.getQueueItemById(queueItemId);
      if (queueItem) {
        await logEvent({
          cooperative_id: queueItem.cooperative_id,
          event_type: 'batch_cancelled',
          event_level: 'info',
          event_source: 'queue_manager',
          event_message: `Batch ${queueItem.batch_id} processing cancelled`,
          batch_id: queueItem.batch_id,
          event_data: { queue_item_id: queueItemId },
        });
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Update queue item progress
   */
  updateProgress(queueItemId: string, progressDetails: Record<string, any>): boolean {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_queue 
      SET progress_details = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(JSON.stringify(progressDetails), queueItemId);
    return result.changes > 0;
  }

  /**
   * Get queue item by ID
   */
  private getQueueItemById(queueItemId: string): QueueItem | null {
    const stmt = this.db.prepare('SELECT * FROM bulk_upload_queue WHERE id = ?');
    const result = stmt.get(queueItemId);
    
    if (result) {
      return {
        ...result,
        dependencies: JSON.parse(result.dependencies || '[]'),
        prerequisite_checks: JSON.parse(result.prerequisite_checks || '{}'),
        progress_details: JSON.parse(result.progress_details || '{}'),
        error_details: result.error_details ? JSON.parse(result.error_details) : undefined,
      };
    }
    
    return null;
  }

  /**
   * Get next available queue position for a priority level
   */
  private getNextQueuePosition(priority: number): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(MAX(queue_position), 0) + 1 as next_position
      FROM bulk_upload_queue 
      WHERE priority <= ? AND status IN ('queued', 'running')
    `);

    const result = stmt.get(priority);
    return result?.next_position || 1;
  }

  /**
   * Reorder queue maintaining priority and creation order
   */
  private reorderQueue(): void {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_queue 
      SET queue_position = (
        SELECT ROW_NUMBER() OVER (ORDER BY priority ASC, created_at ASC)
        FROM bulk_upload_queue q2 
        WHERE q2.status IN ('queued', 'running') 
        AND q2.id = bulk_upload_queue.id
      )
      WHERE status IN ('queued', 'running')
    `);

    stmt.run();
  }

  /**
   * Clean up expired queue items
   */
  private cleanupExpiredItems(): void {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_queue 
      SET status = 'expired', updated_at = datetime('now')
      WHERE status = 'queued' AND expires_at <= datetime('now')
    `);

    const result = stmt.run();
    
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired queue items`);
    }
  }

  /**
   * Reset items that have been running too long
   */
  private resetStuckItems(): void {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_queue 
      SET status = 'queued', worker_id = NULL, started_at = NULL, updated_at = datetime('now')
      WHERE status = 'running' 
      AND started_at <= datetime('now', '-' || max_processing_time_minutes || ' minutes')
    `);

    const result = stmt.run();
    
    if (result.changes > 0) {
      console.log(`Reset ${result.changes} stuck queue items`);
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(cooperative_id?: string): {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
  } {
    let whereClause = '';
    const params: any[] = [];
    
    if (cooperative_id) {
      whereClause = 'WHERE cooperative_id = ?';
      params.push(cooperative_id);
    }

    const stmt = this.db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM bulk_upload_queue 
      ${whereClause}
      GROUP BY status
    `);

    const results = stmt.all(...params);
    
    const stats = {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    for (const row of results) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
      stats.total += row.count;
    }

    return stats;
  }

  /**
   * Get queue items for a cooperative
   */
  getQueueItems(cooperative_id: string, status?: string): QueueItem[] {
    let whereClause = 'WHERE cooperative_id = ?';
    const params: any[] = [cooperative_id];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM bulk_upload_queue 
      ${whereClause}
      ORDER BY priority ASC, queue_position ASC
    `);

    const results = stmt.all(...params);
    
    return results.map(row => ({
      ...row,
      dependencies: JSON.parse(row.dependencies || '[]'),
      prerequisite_checks: JSON.parse(row.prerequisite_checks || '{}'),
      progress_details: JSON.parse(row.progress_details || '{}'),
      error_details: row.error_details ? JSON.parse(row.error_details) : undefined,
    }));
  }
}

/**
 * Worker Management System
 */
export class WorkerManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  /**
   * Register a new worker
   */
  registerWorker(params: {
    worker_name: string;
    worker_type?: 'default' | 'heavy' | 'fast' | 'specialized';
    worker_version?: string;
    process_id?: number;
    hostname?: string;
    max_concurrent_batches?: number;
    max_concurrent_files?: number;
    supported_file_types?: string[];
    max_file_size_mb?: number;
    memory_limit_mb?: number;
    cpu_cores?: number;
    configuration?: Record<string, any>;
  }): string {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO bulk_upload_workers (
        id, worker_name, worker_type, worker_version, process_id, hostname,
        max_concurrent_batches, max_concurrent_files, supported_file_types,
        max_file_size_mb, memory_limit_mb, cpu_cores, configuration,
        started_at, last_heartbeat_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.worker_name,
      params.worker_type || 'default',
      params.worker_version || '1.0.0',
      params.process_id,
      params.hostname,
      params.max_concurrent_batches || 1,
      params.max_concurrent_files || 10,
      JSON.stringify(params.supported_file_types || []),
      params.max_file_size_mb || 100,
      params.memory_limit_mb || 1024,
      params.cpu_cores || 1,
      JSON.stringify(params.configuration || {}),
      now,
      now,
      now,
      now
    );

    return id;
  }

  /**
   * Update worker heartbeat
   */
  updateHeartbeat(workerId: string, metrics?: {
    current_batches?: number;
    current_files?: number;
    current_memory_usage_mb?: number;
    current_cpu_usage_percentage?: number;
  }): boolean {
    let updateClause = 'last_heartbeat_at = datetime(\'now\'), updated_at = datetime(\'now\')';
    const params: any[] = [workerId];

    if (metrics) {
      if (metrics.current_batches !== undefined) {
        updateClause += ', current_batches = ?';
        params.unshift(metrics.current_batches);
      }
      if (metrics.current_files !== undefined) {
        updateClause += ', current_files = ?';
        params.unshift(metrics.current_files);
      }
      if (metrics.current_memory_usage_mb !== undefined) {
        updateClause += ', current_memory_usage_mb = ?';
        params.unshift(metrics.current_memory_usage_mb);
      }
      if (metrics.current_cpu_usage_percentage !== undefined) {
        updateClause += ', current_cpu_usage_percentage = ?';
        params.unshift(metrics.current_cpu_usage_percentage);
      }
    }

    const stmt = this.db.prepare(`
      UPDATE bulk_upload_workers 
      SET ${updateClause}
      WHERE id = ?
    `);

    const result = stmt.run(...params);
    return result.changes > 0;
  }

  /**
   * Find best available worker for a queue item
   */
  findBestWorker(queueItem: QueueItem): Worker | null {
    const stmt = this.db.prepare(`
      SELECT * FROM bulk_upload_workers
      WHERE status = 'idle'
      AND health_status = 'healthy'
      AND worker_type = ?
      AND current_batches < max_concurrent_batches
      AND memory_limit_mb >= ?
      AND cpu_cores >= ?
      AND last_heartbeat_at > datetime('now', '-5 minutes')
      ORDER BY 
        (max_concurrent_batches - current_batches) DESC,
        current_memory_usage_mb ASC,
        current_cpu_usage_percentage ASC
      LIMIT 1
    `);

    const result = stmt.get(
      queueItem.worker_type,
      queueItem.required_memory_mb,
      queueItem.required_cpu_cores
    );

    if (result) {
      return {
        ...result,
        supported_file_types: JSON.parse(result.supported_file_types || '[]'),
      };
    }

    return null;
  }

  /**
   * Mark worker as busy
   */
  markWorkerBusy(workerId: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_workers 
      SET status = 'busy', current_batches = current_batches + 1, updated_at = datetime('now')
      WHERE id = ? AND status = 'idle'
    `);

    const result = stmt.run(workerId);
    return result.changes > 0;
  }

  /**
   * Mark worker as idle
   */
  markWorkerIdle(workerId: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_workers 
      SET status = 'idle', current_batches = CASE 
        WHEN current_batches > 0 THEN current_batches - 1 
        ELSE 0 
      END, updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(workerId);
    return result.changes > 0;
  }

  /**
   * Get all active workers
   */
  getActiveWorkers(): Worker[] {
    const stmt = this.db.prepare(`
      SELECT * FROM bulk_upload_workers
      WHERE status != 'offline'
      AND last_heartbeat_at > datetime('now', '-5 minutes')
      ORDER BY worker_name
    `);

    const results = stmt.all();
    
    return results.map(row => ({
      ...row,
      supported_file_types: JSON.parse(row.supported_file_types || '[]'),
    }));
  }

  /**
   * Clean up offline workers
   */
  cleanupOfflineWorkers(): number {
    const stmt = this.db.prepare(`
      UPDATE bulk_upload_workers 
      SET status = 'offline', updated_at = datetime('now')
      WHERE status != 'offline' 
      AND last_heartbeat_at <= datetime('now', '-10 minutes')
    `);

    const result = stmt.run();
    return result.changes;
  }
}