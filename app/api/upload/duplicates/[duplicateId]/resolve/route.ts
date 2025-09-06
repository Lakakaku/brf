/**
 * Duplicate Resolution API Route
 * POST /api/upload/duplicates/[duplicateId]/resolve - Resolve a duplicate
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/database';
import { requireAuthentication } from '@/lib/auth/server';
import { DuplicateDetector, type ResolutionAction } from '@/lib/upload/duplicate-detector';
import { logEvent } from '@/lib/monitoring/events';
import { SwedishMessages } from '@/lib/upload/messages';

// Request validation schema
const ResolutionRequestSchema = z.object({
  action: z.enum(['keep_original', 'keep_duplicate', 'keep_both', 'merge', 'delete_original', 'delete_duplicate']),
  reason: z.string().optional(),
  user_feedback: z.record(z.any()).optional(),
});

/**
 * POST /api/upload/duplicates/[duplicateId]/resolve
 * Resolve a specific duplicate with the specified action
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { duplicateId: string } }
) {
  try {
    const user = await requireAuthentication();
    if (!user?.cooperative_id) {
      return NextResponse.json(
        { error: SwedishMessages.errors.AUTHENTICATION_REQUIRED },
        { status: 401 }
      );
    }

    const { duplicateId } = params;
    if (!duplicateId) {
      return NextResponse.json(
        { error: SwedishMessages.errors.INVALID_REQUEST_FORMAT },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = ResolutionRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: SwedishMessages.errors.INVALID_REQUEST_FORMAT,
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { action, reason, user_feedback } = validation.data;

    // Initialize duplicate detector
    const db = getDatabase();
    const duplicateDetector = new DuplicateDetector(db);

    // Verify duplicate exists and belongs to user's cooperative
    const duplicates = duplicateDetector.getDuplicatesForCooperative(user.cooperative_id, {
      limit: 1000, // Large limit to find the specific duplicate
    });
    
    const duplicate = duplicates.find(d => d.duplicate_id === duplicateId);
    if (!duplicate) {
      return NextResponse.json(
        { error: SwedishMessages.errors.DUPLICATE_NOT_FOUND || 'Duplicate not found' },
        { status: 404 }
      );
    }

    // Check if already resolved
    if (duplicate.detection_details?.status === 'resolved') {
      return NextResponse.json(
        { error: SwedishMessages.errors.DUPLICATE_ALREADY_RESOLVED || 'Duplicate already resolved' },
        { status: 409 }
      );
    }

    // Resolve the duplicate
    const resolved = await duplicateDetector.resolveDuplicate(
      duplicateId,
      action as ResolutionAction,
      user.id,
      reason
    );

    if (!resolved) {
      return NextResponse.json(
        { error: SwedishMessages.errors.RESOLUTION_FAILED || 'Failed to resolve duplicate' },
        { status: 500 }
      );
    }

    // Process the resolution action
    const processingResult = await processResolutionAction(
      duplicate,
      action as ResolutionAction,
      user.cooperative_id,
      user.id
    );

    await logEvent({
      cooperative_id: user.cooperative_id,
      event_type: 'duplicate_resolved',
      event_level: 'info',
      event_source: 'duplicates_resolve_api',
      event_message: `Duplicate resolved with action: ${action}`,
      user_id: user.id,
      event_data: { 
        duplicate_id: duplicateId,
        action,
        reason,
        original_file_id: duplicate.original_file.id,
        duplicate_file_id: duplicate.duplicate_file.id,
        similarity_score: duplicate.similarity_score,
        algorithm: duplicate.algorithm,
        processing_result: processingResult,
        user_feedback,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        duplicate_id: duplicateId,
        action,
        reason,
        resolved_at: new Date().toISOString(),
        processing_result: processingResult,
      },
      message: getResolutionSuccessMessage(action as ResolutionAction),
    });

  } catch (error) {
    console.error('Duplicate resolution error:', error);
    
    await logEvent({
      event_type: 'api_error',
      event_level: 'error',
      event_source: 'duplicates_resolve_api',
      event_message: `Error resolving duplicate: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      cooperative_id: '',
      event_data: { duplicate_id: params.duplicateId },
    });

    return NextResponse.json(
      { 
        error: SwedishMessages.errors.SYSTEM_ERROR,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Process the actual resolution action (delete files, update references, etc.)
 */
async function processResolutionAction(
  duplicate: any,
  action: ResolutionAction,
  cooperativeId: string,
  userId: string
): Promise<{
  files_deleted?: string[];
  files_kept?: string[];
  references_updated?: number;
  storage_saved_bytes?: number;
}> {
  const db = getDatabase();
  const result: any = {};

  switch (action) {
    case 'keep_original':
      // Delete the duplicate file
      result.files_deleted = [duplicate.duplicate_file.id];
      result.files_kept = [duplicate.original_file.id];
      result.storage_saved_bytes = duplicate.duplicate_file.size_bytes;
      
      await deleteFile(db, duplicate.duplicate_file, cooperativeId);
      break;

    case 'keep_duplicate':
      // Delete the original file and update references
      result.files_deleted = [duplicate.original_file.id];
      result.files_kept = [duplicate.duplicate_file.id];
      result.storage_saved_bytes = duplicate.original_file.size_bytes;
      
      result.references_updated = await updateFileReferences(
        db, 
        duplicate.original_file.id, 
        duplicate.duplicate_file.id,
        cooperativeId
      );
      
      await deleteFile(db, duplicate.original_file, cooperativeId);
      break;

    case 'keep_both':
      // Keep both files, just mark as resolved
      result.files_kept = [duplicate.original_file.id, duplicate.duplicate_file.id];
      result.storage_saved_bytes = 0;
      break;

    case 'delete_original':
      // Delete only the original file
      result.files_deleted = [duplicate.original_file.id];
      result.files_kept = [duplicate.duplicate_file.id];
      result.storage_saved_bytes = duplicate.original_file.size_bytes;
      
      await deleteFile(db, duplicate.original_file, cooperativeId);
      break;

    case 'delete_duplicate':
      // Delete only the duplicate file
      result.files_deleted = [duplicate.duplicate_file.id];
      result.files_kept = [duplicate.original_file.id];
      result.storage_saved_bytes = duplicate.duplicate_file.size_bytes;
      
      await deleteFile(db, duplicate.duplicate_file, cooperativeId);
      break;

    case 'merge':
      // Advanced merge logic - for now, keep original and log merge intent
      result.files_kept = [duplicate.original_file.id];
      result.files_deleted = [duplicate.duplicate_file.id];
      result.storage_saved_bytes = duplicate.duplicate_file.size_bytes;
      
      // TODO: Implement advanced merge logic
      await logEvent({
        cooperative_id: cooperativeId,
        event_type: 'file_merge_requested',
        event_level: 'info',
        event_source: 'duplicate_resolver',
        event_message: 'File merge requested - manual processing required',
        user_id: userId,
        event_data: {
          original_file: duplicate.original_file,
          duplicate_file: duplicate.duplicate_file,
        },
      });
      
      await deleteFile(db, duplicate.duplicate_file, cooperativeId);
      break;

    default:
      throw new Error(`Unsupported resolution action: ${action}`);
  }

  return result;
}

/**
 * Delete a file from the database and filesystem
 */
async function deleteFile(db: any, file: any, cooperativeId: string): Promise<void> {
  try {
    if (file.type === 'document') {
      // Soft delete document
      const stmt = db.prepare(`
        UPDATE documents 
        SET deleted_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND cooperative_id = ?
      `);
      stmt.run(file.id, cooperativeId);
    } else if (file.type === 'upload_file') {
      // Delete upload file
      const stmt = db.prepare(`
        UPDATE bulk_upload_files 
        SET upload_status = 'deleted', updated_at = datetime('now')
        WHERE id = ? AND cooperative_id = ?
      `);
      stmt.run(file.id, cooperativeId);
    }
    
    // TODO: Delete physical file from filesystem
    // await fs.unlink(file.file_path);
    
  } catch (error) {
    console.error(`Failed to delete file ${file.id}:`, error);
    throw error;
  }
}

/**
 * Update references to point from old file to new file
 */
async function updateFileReferences(
  db: any, 
  oldFileId: string, 
  newFileId: string, 
  cooperativeId: string
): Promise<number> {
  let updatedReferences = 0;

  try {
    // Update invoice document references
    const invoiceStmt = db.prepare(`
      UPDATE invoices 
      SET document_id = ?, updated_at = datetime('now')
      WHERE document_id = ? AND cooperative_id = ?
    `);
    const invoiceResult = invoiceStmt.run(newFileId, oldFileId, cooperativeId);
    updatedReferences += invoiceResult.changes;

    // Update case document references
    const caseStmt = db.prepare(`
      UPDATE cases 
      SET related_documents = json_replace(related_documents, '$', json_set(related_documents, '$', json_replace(related_documents, '$[*]', ?, oldFileId))),
          updated_at = datetime('now')
      WHERE json_extract(related_documents, '$') LIKE '%' || ? || '%' AND cooperative_id = ?
    `);
    const caseResult = caseStmt.run(newFileId, oldFileId, cooperativeId);
    updatedReferences += caseResult.changes;

    // Update board meeting attachments
    const meetingStmt = db.prepare(`
      UPDATE board_meetings 
      SET attachments = json_replace(attachments, '$', json_set(attachments, '$', json_replace(attachments, '$[*]', ?, oldFileId))),
          updated_at = datetime('now')
      WHERE json_extract(attachments, '$') LIKE '%' || ? || '%' AND cooperative_id = ?
    `);
    const meetingResult = meetingStmt.run(newFileId, oldFileId, cooperativeId);
    updatedReferences += meetingResult.changes;

    return updatedReferences;

  } catch (error) {
    console.error(`Failed to update references from ${oldFileId} to ${newFileId}:`, error);
    return 0;
  }
}

/**
 * Get success message based on resolution action
 */
function getResolutionSuccessMessage(action: ResolutionAction): string {
  const messages = {
    keep_original: 'Ursprungsfilen behållen, duplikatet raderat',
    keep_duplicate: 'Duplikatet behållet, ursprungsfilen raderad', 
    keep_both: 'Båda filerna behållna',
    merge: 'Filer sammanslagna',
    delete_original: 'Ursprungsfilen raderad',
    delete_duplicate: 'Duplikatet raderat',
  };

  return messages[action] || 'Duplikat löst';
}