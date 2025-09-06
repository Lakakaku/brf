/**
 * Storage Quota Monitoring API
 * Provides comprehensive quota monitoring and reporting for BRF Portal
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
    COOPERATIVE_NOT_FOUND: 'Kooperativ hittades inte',
    SYSTEM_ERROR: 'Systemfel uppstod'
  },
  success: {
    QUOTA_INFO_RETRIEVED: 'Kvotinformation hämtad framgångsrikt',
    QUOTA_UPDATED: 'Kvot uppdaterad framgångsrikt',
    QUOTA_RECALCULATED: 'Kvot omberäknad framgångsrikt'
  },
  status: {
    NORMAL: 'Normal',
    WARNING: 'Varning',
    CRITICAL: 'Kritisk',
    EXCEEDED: 'Överskriden'
  }
};

// Validation schemas
const QuotaUpdateSchema = z.object({
  usage_scope: z.enum(['cooperative', 'user', 'document_type', 'monthly', 'daily']),
  scope_identifier: z.string().optional(),
  soft_limit_bytes: z.number().min(0).optional(),
  hard_limit_bytes: z.number().min(0).optional(),
  quota_limit_bytes: z.number().min(0).optional(),
  period_type: z.enum(['day', 'week', 'month', 'year', 'unlimited']).optional(),
  alert_settings: z.object({
    enable_warnings: z.boolean().optional(),
    warning_threshold_percentage: z.number().min(0).max(100).optional(),
    enable_email_alerts: z.boolean().optional(),
    alert_recipients: z.array(z.string()).optional()
  }).optional()
});

/**
 * GET /api/upload/limits/quota - Get storage quota information
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request, {
      permissions: ['canViewSettings'],
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
    const scope = url.searchParams.get('scope') || 'all';
    const period = url.searchParams.get('period') || 'month';
    const includeHistory = url.searchParams.get('include_history') === 'true';
    const userId = url.searchParams.get('user_id');

    // Get current quota usage
    const quotaData = await getQuotaUsage(db, user.cooperativeId, scope, period, userId);
    
    // Get quota history if requested
    let quotaHistory = null;
    if (includeHistory) {
      quotaHistory = await getQuotaHistory(db, user.cooperativeId, scope, 30); // Last 30 days
    }

    // Get quota predictions
    const predictions = await getQuotaPredictions(db, user.cooperativeId);

    // Get storage breakdown
    const breakdown = await getStorageBreakdown(db, user.cooperativeId);

    // Calculate quota health score
    const healthScore = calculateQuotaHealthScore(quotaData);

    return NextResponse.json({
      success: true,
      data: {
        cooperative_id: user.cooperativeId,
        quota_usage: quotaData,
        quota_history: quotaHistory,
        predictions,
        breakdown,
        health_score: healthScore,
        recommendations: generateQuotaRecommendations(quotaData, breakdown)
      },
      message: SwedishMessages.success.QUOTA_INFO_RETRIEVED
    });

  } catch (error) {
    console.error('Get quota information error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'GET_QUOTA_INFO_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload/limits/quota - Update quota limits
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication (requires admin permissions)
    const authResult = await requireAuth(request, {
      permissions: ['canManageSettings'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.INSUFFICIENT_PERMISSIONS,
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    const { user } = authResult;
    const body = await request.json();
    
    // Validate request body
    const validationResult = QuotaUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        {
          error: SwedishMessages.errors.VALIDATION_FAILED,
          details: errors,
          code: 'QUOTA_VALIDATION_FAILED'
        },
        { status: 400 }
      );
    }

    const quotaData = validationResult.data;
    const db = getDatabase();

    // Update or insert quota usage record
    const existingQuota = db.prepare(`
      SELECT id FROM storage_quota_usage 
      WHERE cooperative_id = ? AND usage_scope = ? AND scope_identifier = ?
    `).get(user.cooperativeId, quotaData.usage_scope, quotaData.scope_identifier || null) as any;

    if (existingQuota) {
      // Update existing quota
      db.prepare(`
        UPDATE storage_quota_usage 
        SET soft_limit_bytes = COALESCE(?, soft_limit_bytes),
            hard_limit_bytes = COALESCE(?, hard_limit_bytes),
            quota_limit_bytes = COALESCE(?, quota_limit_bytes),
            period_type = COALESCE(?, period_type),
            alert_settings = COALESCE(?, alert_settings),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        quotaData.soft_limit_bytes,
        quotaData.hard_limit_bytes,
        quotaData.quota_limit_bytes,
        quotaData.period_type,
        JSON.stringify(quotaData.alert_settings || {}),
        existingQuota.id
      );
    } else {
      // Insert new quota
      const quotaId = `sq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      db.prepare(`
        INSERT INTO storage_quota_usage (
          id, cooperative_id, usage_scope, scope_identifier,
          soft_limit_bytes, hard_limit_bytes, quota_limit_bytes,
          period_type, alert_settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quotaId, user.cooperativeId, quotaData.usage_scope,
        quotaData.scope_identifier, quotaData.soft_limit_bytes,
        quotaData.hard_limit_bytes, quotaData.quota_limit_bytes,
        quotaData.period_type, JSON.stringify(quotaData.alert_settings || {})
      );
    }

    // Log quota update
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'storage_quota_updated',
      event_level: 'info',
      event_source: 'quota_api',
      event_message: `Storage quota updated for ${quotaData.usage_scope}`,
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      event_data: {
        usage_scope: quotaData.usage_scope,
        scope_identifier: quotaData.scope_identifier,
        soft_limit_mb: quotaData.soft_limit_bytes ? Math.round(quotaData.soft_limit_bytes / 1024 / 1024) : null,
        hard_limit_mb: quotaData.hard_limit_bytes ? Math.round(quotaData.hard_limit_bytes / 1024 / 1024) : null,
        quota_limit_mb: quotaData.quota_limit_bytes ? Math.round(quotaData.quota_limit_bytes / 1024 / 1024) : null
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        usage_scope: quotaData.usage_scope,
        scope_identifier: quotaData.scope_identifier,
        updated_limits: {
          soft_limit_mb: quotaData.soft_limit_bytes ? Math.round(quotaData.soft_limit_bytes / 1024 / 1024) : null,
          hard_limit_mb: quotaData.hard_limit_bytes ? Math.round(quotaData.hard_limit_bytes / 1024 / 1024) : null,
          quota_limit_mb: quotaData.quota_limit_bytes ? Math.round(quotaData.quota_limit_bytes / 1024 / 1024) : null
        }
      },
      message: SwedishMessages.success.QUOTA_UPDATED
    });

  } catch (error) {
    console.error('Update quota error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'UPDATE_QUOTA_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/upload/limits/quota - Recalculate quota usage
 */
export async function PUT(request: NextRequest) {
  try {
    // Authentication (requires admin permissions)
    const authResult = await requireAuth(request, {
      permissions: ['canManageSettings'],
    });

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: SwedishMessages.errors.INSUFFICIENT_PERMISSIONS,
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    const { user } = authResult;
    const db = getDatabase();

    // Recalculate quota usage from actual document sizes
    await recalculateQuotaUsage(db, user.cooperativeId);

    // Log recalculation
    await logEvent({
      cooperative_id: user.cooperativeId,
      event_type: 'storage_quota_recalculated',
      event_level: 'info',
      event_source: 'quota_api',
      event_message: 'Storage quota usage recalculated from actual documents',
      user_id: user.id,
      request_ip: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    });

    // Get updated quota data
    const updatedQuota = await getQuotaUsage(db, user.cooperativeId, 'all', 'month');

    return NextResponse.json({
      success: true,
      data: {
        cooperative_id: user.cooperativeId,
        recalculated_quota: updatedQuota,
        recalculation_timestamp: new Date().toISOString()
      },
      message: SwedishMessages.success.QUOTA_RECALCULATED
    });

  } catch (error) {
    console.error('Recalculate quota error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : SwedishMessages.errors.SYSTEM_ERROR,
        code: 'RECALCULATE_QUOTA_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * Helper functions
 */
async function getQuotaUsage(db: any, cooperativeId: string, scope: string, period: string, userId?: string): Promise<any> {
  let whereClause = 'WHERE cooperative_id = ?';
  const params: any[] = [cooperativeId];

  if (scope !== 'all') {
    whereClause += ' AND usage_scope = ?';
    params.push(scope);
  }

  if (userId) {
    whereClause += ' AND scope_identifier = ?';
    params.push(userId);
  }

  const quotas = db.prepare(`
    SELECT 
      usage_scope, scope_identifier, current_usage_bytes, peak_usage_bytes,
      total_files_count, total_uploads_count, soft_limit_bytes, hard_limit_bytes,
      quota_limit_bytes, period_type, period_start, period_end, status,
      last_warning_sent, warning_count, document_type_breakdown, 
      mime_type_breakdown, last_calculated
    FROM storage_quota_usage 
    ${whereClause}
  `).all(...params) as any[];

  return quotas.map(quota => ({
    ...quota,
    current_usage_mb: Math.round(quota.current_usage_bytes / 1024 / 1024 * 100) / 100,
    peak_usage_mb: Math.round(quota.peak_usage_bytes / 1024 / 1024 * 100) / 100,
    soft_limit_mb: quota.soft_limit_bytes ? Math.round(quota.soft_limit_bytes / 1024 / 1024) : null,
    hard_limit_mb: quota.hard_limit_bytes ? Math.round(quota.hard_limit_bytes / 1024 / 1024) : null,
    quota_limit_mb: quota.quota_limit_bytes ? Math.round(quota.quota_limit_bytes / 1024 / 1024) : null,
    usage_percentage: quota.quota_limit_bytes ? Math.round((quota.current_usage_bytes / quota.quota_limit_bytes) * 100) : 0,
    status_swedish: SwedishMessages.status[quota.status as keyof typeof SwedishMessages.status] || quota.status,
    document_type_breakdown: JSON.parse(quota.document_type_breakdown || '{}'),
    mime_type_breakdown: JSON.parse(quota.mime_type_breakdown || '{}')
  }));
}

async function getQuotaHistory(db: any, cooperativeId: string, scope: string, days: number): Promise<any[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // For now, return mock history data since we don't have historical tracking yet
  // In a real implementation, you'd have a quota_usage_history table
  return [
    {
      date: cutoffDate.toISOString().split('T')[0],
      usage_bytes: 1000000000,
      usage_mb: 953.67,
      files_count: 1500,
      uploads_count: 150
    }
  ];
}

async function getQuotaPredictions(db: any, cooperativeId: string): Promise<any> {
  // Get recent usage trends
  const recentDocuments = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as files_count,
      SUM(size_bytes) as total_size_bytes
    FROM documents 
    WHERE cooperative_id = ? 
    AND created_at >= datetime('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `).all(cooperativeId) as any[];

  if (recentDocuments.length === 0) {
    return {
      daily_average_mb: 0,
      projected_monthly_usage_mb: 0,
      projected_yearly_usage_mb: 0,
      days_until_full: null,
      trend: 'stable'
    };
  }

  const totalSize = recentDocuments.reduce((sum, day) => sum + (day.total_size_bytes || 0), 0);
  const averageDaily = totalSize / recentDocuments.length;
  const averageDailyMb = Math.round(averageDaily / 1024 / 1024 * 100) / 100;

  return {
    daily_average_mb: averageDailyMb,
    projected_monthly_usage_mb: Math.round(averageDailyMb * 30 * 100) / 100,
    projected_yearly_usage_mb: Math.round(averageDailyMb * 365 * 100) / 100,
    days_until_full: null, // Would calculate based on current quota
    trend: 'stable' // Would analyze growth trend
  };
}

async function getStorageBreakdown(db: any, cooperativeId: string): Promise<any> {
  const breakdown = db.prepare(`
    SELECT 
      document_type,
      COUNT(*) as file_count,
      SUM(size_bytes) as total_size_bytes,
      AVG(size_bytes) as avg_size_bytes,
      MAX(size_bytes) as largest_file_bytes,
      MIN(size_bytes) as smallest_file_bytes
    FROM documents 
    WHERE cooperative_id = ?
    GROUP BY document_type
    ORDER BY total_size_bytes DESC
  `).all(cooperativeId) as any[];

  return breakdown.map(item => ({
    ...item,
    total_size_mb: Math.round(item.total_size_bytes / 1024 / 1024 * 100) / 100,
    avg_size_mb: Math.round(item.avg_size_bytes / 1024 / 1024 * 100) / 100,
    largest_file_mb: Math.round(item.largest_file_bytes / 1024 / 1024 * 100) / 100,
    smallest_file_mb: Math.round(item.smallest_file_bytes / 1024 / 1024 * 100) / 100
  }));
}

function calculateQuotaHealthScore(quotaData: any[]): {
  score: number;
  level: 'excellent' | 'good' | 'warning' | 'critical';
  level_swedish: string;
} {
  if (quotaData.length === 0) {
    return {
      score: 100,
      level: 'excellent',
      level_swedish: 'Utmärkt'
    };
  }

  let totalScore = 0;
  let scoreCount = 0;

  for (const quota of quotaData) {
    if (quota.quota_limit_bytes && quota.quota_limit_bytes > 0) {
      const usagePercentage = (quota.current_usage_bytes / quota.quota_limit_bytes) * 100;
      let score = 100;
      
      if (usagePercentage > 95) score = 0;
      else if (usagePercentage > 85) score = 20;
      else if (usagePercentage > 70) score = 50;
      else if (usagePercentage > 50) score = 80;
      
      totalScore += score;
      scoreCount++;
    }
  }

  const averageScore = scoreCount > 0 ? totalScore / scoreCount : 100;
  
  let level: 'excellent' | 'good' | 'warning' | 'critical';
  let levelSwedish: string;

  if (averageScore >= 80) {
    level = 'excellent';
    levelSwedish = 'Utmärkt';
  } else if (averageScore >= 60) {
    level = 'good';
    levelSwedish = 'Bra';
  } else if (averageScore >= 30) {
    level = 'warning';
    levelSwedish = 'Varning';
  } else {
    level = 'critical';
    levelSwedish = 'Kritisk';
  }

  return {
    score: Math.round(averageScore),
    level,
    level_swedish: levelSwedish
  };
}

function generateQuotaRecommendations(quotaData: any[], breakdown: any[]): Array<{
  type: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  message_swedish: string;
  action: string;
  action_swedish: string;
}> {
  const recommendations = [];

  // Check for high usage
  for (const quota of quotaData) {
    if (quota.usage_percentage > 85) {
      recommendations.push({
        type: 'high_usage',
        priority: 'high' as const,
        message: `${quota.usage_scope} usage is at ${quota.usage_percentage}%`,
        message_swedish: `${quota.usage_scope} användning är ${quota.usage_percentage}%`,
        action: 'Consider increasing quota or cleaning up old files',
        action_swedish: 'Överväg att öka kvoten eller rensa gamla filer'
      });
    }
  }

  // Check for document type imbalances
  const totalSize = breakdown.reduce((sum, item) => sum + item.total_size_bytes, 0);
  for (const item of breakdown) {
    const percentage = (item.total_size_bytes / totalSize) * 100;
    if (percentage > 50) {
      recommendations.push({
        type: 'document_type_imbalance',
        priority: 'medium' as const,
        message: `${item.document_type} files consume ${Math.round(percentage)}% of storage`,
        message_swedish: `${item.document_type} filer förbrukar ${Math.round(percentage)}% av lagringen`,
        action: 'Review retention policies for this document type',
        action_swedish: 'Granska bevarandepolicyer för denna dokumenttyp'
      });
    }
  }

  return recommendations;
}

async function recalculateQuotaUsage(db: any, cooperativeId: string): Promise<void> {
  // Get actual usage from documents table
  const actualUsage = db.prepare(`
    SELECT 
      COUNT(*) as total_files,
      SUM(size_bytes) as total_size_bytes,
      MAX(size_bytes) as peak_file_size,
      document_type,
      mime_type
    FROM documents 
    WHERE cooperative_id = ?
    GROUP BY document_type, mime_type
  `).all(cooperativeId) as any[];

  // Update cooperative-level usage
  const cooperativeTotal = actualUsage.reduce((sum, item) => sum + (item.total_size_bytes || 0), 0);
  const cooperativeTotalFiles = actualUsage.reduce((sum, item) => sum + (item.total_files || 0), 0);

  db.prepare(`
    INSERT OR REPLACE INTO storage_quota_usage (
      cooperative_id, usage_scope, scope_identifier, current_usage_bytes,
      peak_usage_bytes, total_files_count, last_calculated
    ) VALUES (?, 'cooperative', NULL, ?, ?, ?, datetime('now'))
  `).run(cooperativeId, cooperativeTotal, cooperativeTotal, cooperativeTotalFiles);

  // Update document type breakdowns
  for (const usage of actualUsage) {
    if (usage.document_type) {
      db.prepare(`
        INSERT OR REPLACE INTO storage_quota_usage (
          cooperative_id, usage_scope, scope_identifier, current_usage_bytes,
          peak_usage_bytes, total_files_count, last_calculated
        ) VALUES (?, 'document_type', ?, ?, ?, ?, datetime('now'))
      `).run(cooperativeId, usage.document_type, usage.total_size_bytes, usage.total_size_bytes, usage.total_files);
    }
  }
}