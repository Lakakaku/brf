/**
 * File Compression Suggestions API
 * Provides compression analysis and suggestions for files
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { requireAuth } from '@/lib/auth/middleware';
import { logEvent } from '@/lib/monitoring/events';
import { z } from 'zod';

// Swedish messages
const SwedishMessages = {
  errors: {
    AUTHENTICATION_REQUIRED: 'Autentisering krävs',
    INSUFFICIENT_PERMISSIONS: 'Otillräckliga behörigheter',
    VALIDATION_FAILED: 'Valideringsfel',
    FILE_NOT_FOUND: 'Fil hittades inte',
    SYSTEM_ERROR: 'Systemfel uppstod'
  },
  success: {
    SUGGESTIONS_RETRIEVED: 'Komprimeringsförslag hämtade framgångsrikt',
    SUGGESTION_CREATED: 'Komprimeringsförslag skapat framgångsrikt',
    SUGGESTION_UPDATED: 'Komprimeringsförslag uppdaterat framgångsrikt'
  },
  compression: {
    high_potential: 'Hög komprimeringspotential',
    medium_potential: 'Medelhög komprimeringspotential',
    low_potential: 'Låg komprimeringspotential',
    minimal_potential: 'Minimal komprimeringspotential',
    not_recommended: 'Komprimering rekommenderas inte'
  }
};

// Validation schemas
const CompressionAnalysisSchema = z.object({
  filename: z.string().min(1),
  size_bytes: z.number().min(1),
  mime_type: z.string().optional(),
  document_type: z.string().optional()
});

const CompressionResponseSchema = z.object({
  suggestion_id: z.string(),
  user_response: z.enum(['accepted', 'declined', 'ignored']),
  feedback: z.string().optional(),
  compression_applied: z.boolean().optional(),
  actual_compressed_size: z.number().optional()
});

/**
 * GET /api/upload/limits/compression - Get compression suggestions
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request, {
      permissions: ['canUploadDocuments'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.AUTHENTICATION_REQUIRED,
          code: 'AUTHENTICATION_REQUIRED'
        },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const db = getDatabase();
    const url = new URL(request.url);
    
    // Query parameters
    const status = url.searchParams.get('status') || 'pending';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const userId = url.searchParams.get('user_id');

    let whereClause = 'WHERE cooperative_id = ?';
    const params: any[] = [user.cooperativeId];

    if (status !== 'all') {
      whereClause += ' AND suggestion_status = ?';
      params.push(status);
    }

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(userId);
    } else {
      whereClause += ' AND user_id = ?';
      params.push(user.id);
    }

    // Add expiration filter for pending suggestions
    if (status === 'pending') {
      whereClause += ' AND suggestion_expires_at > datetime("now")';
    }

    const suggestions = db.prepare(`
      SELECT 
        id, original_filename, original_size_bytes, original_mime_type,
        document_type, compression_potential, estimated_compressed_size_bytes,
        estimated_compression_ratio, recommended_quality, recommended_format,
        available_methods, recommended_method, suggestion_status, user_response_at,
        user_feedback, compression_applied, actual_compressed_size_bytes,
        actual_compression_ratio, compression_method_used, storage_saved_bytes,
        suggestion_title_sv, suggestion_message_sv, benefits_description_sv,
        suggestion_expires_at, created_at, updated_at
      FROM file_compression_suggestions 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `).all(...params, limit) as any[];

    // Parse JSON fields and add human-readable sizes
    const parsedSuggestions = suggestions.map(suggestion => ({
      ...suggestion,
      available_methods: JSON.parse(suggestion.available_methods || '[]'),
      original_size_mb: Math.round(suggestion.original_size_bytes / 1024 / 1024 * 100) / 100,
      estimated_compressed_size_mb: suggestion.estimated_compressed_size_bytes ? 
        Math.round(suggestion.estimated_compressed_size_bytes / 1024 / 1024 * 100) / 100 : null,
      actual_compressed_size_mb: suggestion.actual_compressed_size_bytes ?
        Math.round(suggestion.actual_compressed_size_bytes / 1024 / 1024 * 100) / 100 : null,
      storage_saved_mb: suggestion.storage_saved_bytes ?
        Math.round(suggestion.storage_saved_bytes / 1024 / 1024 * 100) / 100 : null,
      compression_potential_swedish: SwedishMessages.compression[suggestion.compression_potential as keyof typeof SwedishMessages.compression] || suggestion.compression_potential,
      days_until_expiry: suggestion.suggestion_expires_at ? 
        Math.ceil((new Date(suggestion.suggestion_expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
    }));

    // Get summary statistics
    const stats = getCompressionStats(db, user.cooperativeId, user.id);

    return NextResponse.json({
      success: true,
      data: {
        suggestions: parsedSuggestions,
        total_suggestions: parsedSuggestions.length,
        statistics: stats,
        filters_applied: {
          status,
          user_id: userId || user.id,
          limit
        }
      },
      message: SwedishMessages.success.SUGGESTIONS_RETRIEVED
    });

  } catch (error) {
    console.error('Get compression suggestions error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'GET_COMPRESSION_SUGGESTIONS_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload/limits/compression - Create compression suggestion
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request, {
      permissions: ['canUploadDocuments'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.AUTHENTICATION_REQUIRED,
          code: 'AUTHENTICATION_REQUIRED'
        },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const body = await request.json();
    
    // Validate request body
    const validationResult = CompressionAnalysisSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        {
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: errors,
          code: 'COMPRESSION_ANALYSIS_INVALID'
        },
        { status: 400 }
      );
    }

    const fileData = validationResult.data;
    const db = getDatabase();

    // Analyze compression potential
    const analysis = analyzeCompressionPotential(fileData);

    // Create suggestion record
    const suggestionId = `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    db.prepare(`
      INSERT INTO file_compression_suggestions (
        id, cooperative_id, original_filename, original_size_bytes, 
        original_mime_type, document_type, user_id, compression_potential,
        estimated_compressed_size_bytes, estimated_compression_ratio,
        recommended_quality, recommended_format, available_methods,
        recommended_method, suggestion_title_sv, suggestion_message_sv,
        benefits_description_sv
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      suggestionId, user.cooperativeId, fileData.filename, fileData.size_bytes,
      fileData.mime_type, fileData.document_type, user.id, analysis.potential,
      analysis.estimatedSize, analysis.compressionRatio, analysis.quality,
      analysis.format, JSON.stringify(analysis.availableMethods),
      analysis.recommendedMethod, analysis.titleSwedish, analysis.messageSwedish,
      analysis.benefitsSwedish
    );

    // Log suggestion creation
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'compression_suggestion_created',
      event_level: 'info',
      event_source: 'compression_api',
      event_message: `Compression suggestion created for ${fileData.filename}`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        suggestion_id: suggestionId,
        filename: fileData.filename,
        original_size_mb: Math.round(fileData.size_bytes / 1024 / 1024 * 100) / 100,
        compression_potential: analysis.potential,
        estimated_savings_mb: Math.round((fileData.size_bytes - analysis.estimatedSize) / 1024 / 1024 * 100) / 100
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        suggestion_id: suggestionId,
        filename: fileData.filename,
        original_size_mb: Math.round(fileData.size_bytes / 1024 / 1024 * 100) / 100,
        estimated_compressed_size_mb: Math.round(analysis.estimatedSize / 1024 / 1024 * 100) / 100,
        estimated_savings_mb: Math.round((fileData.size_bytes - analysis.estimatedSize) / 1024 / 1024 * 100) / 100,
        compression_ratio: analysis.compressionRatio,
        potential: analysis.potential,
        potential_swedish: SwedishMessages.compression[analysis.potential as keyof typeof SwedishMessages.compression],
        recommended_method: analysis.recommendedMethod,
        available_methods: analysis.availableMethods,
        message_swedish: analysis.messageSwedish
      },
      message: SwedishMessages.success.SUGGESTION_CREATED
    });

  } catch (error) {
    console.error('Create compression suggestion error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'CREATE_COMPRESSION_SUGGESTION_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/upload/limits/compression - Respond to compression suggestion
 */
export async function PUT(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request, {
      permissions: ['canUploadDocuments'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.AUTHENTICATION_REQUIRED,
          code: 'AUTHENTICATION_REQUIRED'
        },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const body = await request.json();
    
    // Validate request body
    const validationResult = CompressionResponseSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        {
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: errors,
          code: 'COMPRESSION_RESPONSE_INVALID'
        },
        { status: 400 }
      );
    }

    const responseData = validationResult.data;
    const db = getDatabase();

    // Check if suggestion exists and belongs to user
    const suggestion = db.prepare(`
      SELECT id, original_filename, original_size_bytes, estimated_compressed_size_bytes
      FROM file_compression_suggestions 
      WHERE id = ? AND cooperative_id = ? AND user_id = ?
    `).get(responseData.suggestion_id, user.cooperativeId, user.id) as any;

    if (!suggestion) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.FILE_NOT_FOUND,
          code: 'SUGGESTION_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Update suggestion with user response
    const updateFields = [
      'suggestion_status = ?',
      'user_response_at = datetime("now")',
      'updated_at = datetime("now")'
    ];
    const updateParams: any[] = [responseData.user_response];

    if (responseData.feedback) {
      updateFields.push('user_feedback = ?');
      updateParams.push(responseData.feedback);
    }

    if (responseData.compression_applied !== undefined) {
      updateFields.push('compression_applied = ?');
      updateParams.push(responseData.compression_applied ? 1 : 0);
    }

    if (responseData.actual_compressed_size) {
      updateFields.push('actual_compressed_size_bytes = ?');
      updateParams.push(responseData.actual_compressed_size);
      
      // Calculate actual compression ratio and savings
      const actualRatio = responseData.actual_compressed_size / suggestion.original_size_bytes;
      const savings = suggestion.original_size_bytes - responseData.actual_compressed_size;
      
      updateFields.push('actual_compression_ratio = ?', 'storage_saved_bytes = ?');
      updateParams.push(actualRatio, savings);
    }

    updateParams.push(responseData.suggestion_id);

    db.prepare(`
      UPDATE file_compression_suggestions 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...updateParams);

    // Log user response
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'compression_suggestion_response',
      event_level: 'info',
      event_source: 'compression_api',
      event_message: `User responded to compression suggestion for ${suggestion.original_filename}`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        suggestion_id: responseData.suggestion_id,
        response: responseData.user_response,
        compression_applied: responseData.compression_applied,
        actual_size_mb: responseData.actual_compressed_size ? 
          Math.round(responseData.actual_compressed_size / 1024 / 1024 * 100) / 100 : null,
        savings_mb: responseData.actual_compressed_size ?
          Math.round((suggestion.original_size_bytes - responseData.actual_compressed_size) / 1024 / 1024 * 100) / 100 : null
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        suggestion_id: responseData.suggestion_id,
        response: responseData.user_response,
        compression_applied: responseData.compression_applied,
        updated_at: new Date().toISOString()
      },
      message: SwedishMessages.success.SUGGESTION_UPDATED
    });

  } catch (error) {
    console.error('Update compression suggestion error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'UPDATE_COMPRESSION_SUGGESTION_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * Helper functions
 */
function analyzeCompressionPotential(fileData: {
  filename: string;
  size_bytes: number;
  mime_type?: string;
  document_type?: string;
}): {
  potential: string;
  estimatedSize: number;
  compressionRatio: number;
  quality: number;
  format: string;
  availableMethods: string[];
  recommendedMethod: string;
  titleSwedish: string;
  messageSwedish: string;
  benefitsSwedish: string;
} {
  const extension = fileData.filename.split('.').pop()?.toLowerCase();
  const mimeType = fileData.mime_type;
  
  let potential = 'medium_potential';
  let compressionRatio = 0.7;
  let quality = 85;
  let format = extension || 'original';
  let availableMethods = ['archive_compression'];
  let recommendedMethod = 'archive_compression';

  // Analyze based on file type
  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'webp'].includes(extension || '')) {
    if (['bmp', 'tiff', 'png'].includes(extension || '')) {
      potential = 'high_potential';
      compressionRatio = 0.3; // 70% compression
      quality = 80;
      format = 'jpeg';
      availableMethods = ['image_quality', 'format_conversion', 'resolution_reduction'];
      recommendedMethod = 'image_quality';
    } else if (['jpg', 'jpeg'].includes(extension || '')) {
      potential = 'medium_potential';
      compressionRatio = 0.6; // 40% compression
      quality = 75;
      availableMethods = ['image_quality', 'resolution_reduction'];
      recommendedMethod = 'image_quality';
    }
  } else if (mimeType === 'application/pdf' || extension === 'pdf') {
    if (fileData.size_bytes > 10 * 1024 * 1024) { // > 10MB
      potential = 'high_potential';
      compressionRatio = 0.5; // 50% compression
    } else {
      potential = 'medium_potential';
      compressionRatio = 0.8; // 20% compression
    }
    availableMethods = ['pdf_optimization', 'image_compression_in_pdf'];
    recommendedMethod = 'pdf_optimization';
  } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension || '')) {
    potential = 'medium_potential';
    compressionRatio = 0.75; // 25% compression
    availableMethods = ['archive_compression', 'document_optimization'];
    recommendedMethod = 'document_optimization';
  } else if (['zip', 'rar', '7z', 'gz', 'tar'].includes(extension || '')) {
    potential = 'minimal_potential';
    compressionRatio = 0.95; // 5% compression
    availableMethods = ['recompression'];
    recommendedMethod = 'recompression';
  } else if (['mp4', 'avi', 'mov', 'mkv'].includes(extension || '')) {
    potential = 'low_potential';
    compressionRatio = 0.9; // 10% compression
    availableMethods = ['video_compression'];
    recommendedMethod = 'video_compression';
  }

  // Adjust based on file size
  if (fileData.size_bytes < 1024 * 1024) { // < 1MB
    potential = 'minimal_potential';
    compressionRatio = Math.max(compressionRatio, 0.9);
  }

  const estimatedSize = Math.floor(fileData.size_bytes * compressionRatio);
  const savings = fileData.size_bytes - estimatedSize;
  const savingsMB = Math.round(savings / 1024 / 1024 * 100) / 100;

  // Generate Swedish messages
  const titleSwedish = `Komprimeringsförslag för ${fileData.filename}`;
  
  let messageSwedish = '';
  let benefitsSwedish = '';

  switch (potential) {
    case 'high_potential':
      messageSwedish = `Denna fil har hög komprimeringspotential och kan minska med upp till ${savingsMB} MB.`;
      benefitsSwedish = 'Betydande minskning av lagringsanvändning och snabbare uppladdning.';
      break;
    case 'medium_potential':
      messageSwedish = `Filen kan komprimeras för att spara cirka ${savingsMB} MB.`;
      benefitsSwedish = 'Minskad lagringsanvändning och något snabbare uppladdning.';
      break;
    case 'low_potential':
      messageSwedish = `Begränsad komprimeringspotential, kan spara cirka ${savingsMB} MB.`;
      benefitsSwedish = 'Liten förbättring av lagringseffektivitet.';
      break;
    case 'minimal_potential':
      messageSwedish = `Minimal komprimeringspotential för denna filtyp.`;
      benefitsSwedish = 'Mycket begränsade besparingar möjliga.';
      break;
    case 'not_recommended':
      messageSwedish = `Komprimering rekommenderas inte för denna filtyp.`;
      benefitsSwedish = 'Komprimering kan försämra kvaliteten utan betydande besparingar.';
      break;
  }

  return {
    potential,
    estimatedSize,
    compressionRatio,
    quality,
    format,
    availableMethods,
    recommendedMethod,
    titleSwedish,
    messageSwedish,
    benefitsSwedish
  };
}

function getCompressionStats(db: any, cooperativeId: string, userId: string): any {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_suggestions,
        COUNT(CASE WHEN suggestion_status = 'pending' THEN 1 END) as pending_suggestions,
        COUNT(CASE WHEN suggestion_status = 'accepted' THEN 1 END) as accepted_suggestions,
        COUNT(CASE WHEN suggestion_status = 'declined' THEN 1 END) as declined_suggestions,
        COUNT(CASE WHEN compression_applied = 1 THEN 1 END) as applied_compressions,
        AVG(estimated_compression_ratio) as avg_compression_ratio,
        SUM(storage_saved_bytes) as total_storage_saved_bytes,
        COUNT(CASE WHEN compression_potential = 'high_potential' THEN 1 END) as high_potential_count,
        COUNT(CASE WHEN compression_potential = 'medium_potential' THEN 1 END) as medium_potential_count
      FROM file_compression_suggestions 
      WHERE cooperative_id = ? AND user_id = ?
    `).get(cooperativeId, userId) as any;

    return {
      ...stats,
      total_storage_saved_mb: stats.total_storage_saved_bytes ? 
        Math.round(stats.total_storage_saved_bytes / 1024 / 1024 * 100) / 100 : 0,
      avg_compression_percentage: stats.avg_compression_ratio ? 
        Math.round((1 - stats.avg_compression_ratio) * 100) : 0,
      acceptance_rate: stats.total_suggestions > 0 ?
        Math.round((stats.accepted_suggestions / stats.total_suggestions) * 100) : 0
    };
  } catch (error) {
    console.error('Error getting compression stats:', error);
    return {
      total_suggestions: 0,
      pending_suggestions: 0,
      accepted_suggestions: 0,
      declined_suggestions: 0,
      applied_compressions: 0,
      total_storage_saved_mb: 0,
      avg_compression_percentage: 0,
      acceptance_rate: 0
    };
  }
}