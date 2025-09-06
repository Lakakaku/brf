import { getDatabase } from '../database';
import { performanceCollector } from './collector';

/**
 * Swedish BRF-specific performance metrics collector
 * Focuses on cooperative housing management KPIs and regulatory requirements
 */

export interface BrfKpiMetrics {
  // Financial Health Metrics
  monthlyFeeCollectionRate: number; // Månadsavgift inbetalningsgrad (%)
  overduePaymentRatio: number; // Andel förfallna betalningar (%)
  averagePaymentDelay: number; // Genomsnittlig betalningsförsening (dagar)
  budgetVariance: number; // Budgetavvikelse (%)
  
  // Operational Efficiency Metrics
  caseResolutionTime: number; // Genomsnittlig ärendelösningstid (dagar)
  maintenanceBacklog: number; // Antal väntande underhållsärenden
  energyEfficiencyTrend: number; // Energieffektivitetstrend (kWh/kvm/år)
  memberSatisfactionScore: number; // Medlemsnöjdhetsindex (1-10)
  
  // Governance & Compliance Metrics
  boardMeetingAttendance: number; // Styrelsemötesnärvaro (%)
  annualReportCompliance: boolean; // Årsredovisning inlämnad i tid
  auditComplianceScore: number; // Revisionsnöjdhet (1-10)
  gdprComplianceScore: number; // GDPR-efterlevnad (%)
  
  // Digital Adoption Metrics
  memberPortalUsage: number; // Andel medlemmar som använder portalen (%)
  digitalDocumentAdoption: number; // Andel digitala dokument (%)
  averageResponseTime: number; // Genomsnittlig svarstid för förfrågningar (timmar)
  systemAvailability: number; // Systemtillgänglighet (%)
  
  // Property Management Metrics
  maintenanceCostPerSqm: number; // Underhållskostnad per kvm (SEK/år)
  energyCostPerSqm: number; // Energikostnad per kvm (SEK/år)
  occupancyRate: number; // Uthyrningsgrad (%)
  turnoverRate: number; // Omsättningshastighet lägenheter (%)
}

export interface BrfComplianceMetrics {
  // Swedish BRF Legal Requirements
  annualMeetingScheduled: boolean; // Stämma planerad
  boardMeetingsPerYear: number; // Antal styrelsemöten per år
  financialReportingCompliance: boolean; // Ekonomisk rapportering enligt lag
  insuranceCoverage: number; // Försäkringsskydd (%)
  
  // Energy Performance Compliance
  energyCertificateValid: boolean; // Energideklaration giltig
  energyEfficiencyRating: string; // Energiklass (A-G)
  co2EmissionsPerSqm: number; // CO2-utsläpp per kvm
  renewableEnergyRatio: number; // Andel förnybar energi (%)
  
  // Financial Transparency
  budgetApprovedByMembers: boolean; // Budget godkänd av medlemmar
  auditReportPublished: boolean; // Revisionsberättelse publicerad
  memberInformationAccess: number; // Medlemstillgång till information (%)
}

export class BrfMetricsCollector {
  private static instance: BrfMetricsCollector;
  
  private constructor() {}
  
  public static getInstance(): BrfMetricsCollector {
    if (!BrfMetricsCollector.instance) {
      BrfMetricsCollector.instance = new BrfMetricsCollector();
    }
    return BrfMetricsCollector.instance;
  }

  /**
   * Calculate comprehensive BRF KPI metrics
   */
  public async calculateKpiMetrics(cooperativeId: string): Promise<BrfKpiMetrics> {
    const db = getDatabase();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const lastYear = new Date(currentDate);
    lastYear.setFullYear(currentYear - 1);

    // Financial Health Metrics
    const monthlyFeeCollectionRate = await this.calculateMonthlyFeeCollectionRate(cooperativeId, currentYear, currentMonth);
    const overduePaymentRatio = await this.calculateOverduePaymentRatio(cooperativeId);
    const averagePaymentDelay = await this.calculateAveragePaymentDelay(cooperativeId);
    const budgetVariance = await this.calculateBudgetVariance(cooperativeId, currentYear);

    // Operational Efficiency Metrics
    const caseResolutionTime = await this.calculateCaseResolutionTime(cooperativeId);
    const maintenanceBacklog = await this.calculateMaintenanceBacklog(cooperativeId);
    const energyEfficiencyTrend = await this.calculateEnergyEfficiencyTrend(cooperativeId);
    const memberSatisfactionScore = await this.calculateMemberSatisfactionScore(cooperativeId);

    // Governance & Compliance Metrics
    const boardMeetingAttendance = await this.calculateBoardMeetingAttendance(cooperativeId, currentYear);
    const annualReportCompliance = await this.checkAnnualReportCompliance(cooperativeId, currentYear);
    const auditComplianceScore = await this.calculateAuditComplianceScore(cooperativeId);
    const gdprComplianceScore = await this.calculateGdprComplianceScore(cooperativeId);

    // Digital Adoption Metrics
    const memberPortalUsage = await this.calculateMemberPortalUsage(cooperativeId);
    const digitalDocumentAdoption = await this.calculateDigitalDocumentAdoption(cooperativeId);
    const averageResponseTime = await this.calculateAverageResponseTime(cooperativeId);
    const systemAvailability = await this.calculateSystemAvailability(cooperativeId);

    // Property Management Metrics
    const maintenanceCostPerSqm = await this.calculateMaintenanceCostPerSqm(cooperativeId, currentYear);
    const energyCostPerSqm = await this.calculateEnergyCostPerSqm(cooperativeId, currentYear);
    const occupancyRate = await this.calculateOccupancyRate(cooperativeId);
    const turnoverRate = await this.calculateTurnoverRate(cooperativeId, currentYear);

    const metrics: BrfKpiMetrics = {
      monthlyFeeCollectionRate,
      overduePaymentRatio,
      averagePaymentDelay,
      budgetVariance,
      caseResolutionTime,
      maintenanceBacklog,
      energyEfficiencyTrend,
      memberSatisfactionScore,
      boardMeetingAttendance,
      annualReportCompliance,
      auditComplianceScore,
      gdprComplianceScore,
      memberPortalUsage,
      digitalDocumentAdoption,
      averageResponseTime,
      systemAvailability,
      maintenanceCostPerSqm,
      energyCostPerSqm,
      occupancyRate,
      turnoverRate
    };

    // Record all metrics to performance collector
    this.recordBrfMetrics(cooperativeId, metrics);

    return metrics;
  }

  /**
   * Calculate compliance metrics for Swedish BRF regulations
   */
  public async calculateComplianceMetrics(cooperativeId: string): Promise<BrfComplianceMetrics> {
    const db = getDatabase();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();

    const cooperative = db.prepare(`
      SELECT * FROM cooperatives WHERE id = ?
    `).get(cooperativeId) as any;

    if (!cooperative) {
      throw new Error('Cooperative not found');
    }

    // Check annual meeting scheduling
    const annualMeetingScheduled = db.prepare(`
      SELECT COUNT(*) as count FROM board_meetings 
      WHERE cooperative_id = ? 
        AND meeting_type = 'annual' 
        AND scheduled_date BETWEEN ? AND ?
        AND status IN ('planned', 'completed')
    `).get(cooperativeId, `${currentYear}-01-01`, `${currentYear}-12-31`) as any;

    // Count board meetings per year
    const boardMeetingsCount = db.prepare(`
      SELECT COUNT(*) as count FROM board_meetings 
      WHERE cooperative_id = ? 
        AND meeting_type IN ('regular', 'extraordinary')
        AND scheduled_date BETWEEN ? AND ?
        AND status = 'completed'
    `).get(cooperativeId, `${currentYear}-01-01`, `${currentYear}-12-31`) as any;

    // Check energy certificate validity
    const energyCertificateValid = cooperative.energy_certificate_expires 
      ? new Date(cooperative.energy_certificate_expires) > currentDate
      : false;

    // Calculate CO2 emissions (estimate based on energy consumption)
    const co2Emissions = await this.calculateCo2EmissionsPerSqm(cooperativeId, currentYear);

    // Calculate renewable energy ratio
    const renewableEnergyRatio = await this.calculateRenewableEnergyRatio(cooperativeId, currentYear);

    const complianceMetrics: BrfComplianceMetrics = {
      annualMeetingScheduled: annualMeetingScheduled.count > 0,
      boardMeetingsPerYear: boardMeetingsCount.count,
      financialReportingCompliance: cooperative.annual_report_filed !== null,
      insuranceCoverage: 100, // Assume full coverage - would integrate with insurance API
      energyCertificateValid,
      energyEfficiencyRating: cooperative.energy_certificate || 'Unknown',
      co2EmissionsPerSqm: co2Emissions,
      renewableEnergyRatio,
      budgetApprovedByMembers: true, // Would track in board meeting protocols
      auditReportPublished: cooperative.annual_report_filed !== null,
      memberInformationAccess: await this.calculateMemberInformationAccess(cooperativeId)
    };

    return complianceMetrics;
  }

  /**
   * Record BRF metrics to performance collector
   */
  private recordBrfMetrics(cooperativeId: string, metrics: BrfKpiMetrics): void {
    const metricMappings = [
      { name: 'monthly_fee_collection_rate', value: metrics.monthlyFeeCollectionRate, unit: 'percent' },
      { name: 'overdue_payment_ratio', value: metrics.overduePaymentRatio, unit: 'percent' },
      { name: 'average_payment_delay', value: metrics.averagePaymentDelay, unit: 'days' },
      { name: 'budget_variance', value: metrics.budgetVariance, unit: 'percent' },
      { name: 'case_resolution_time', value: metrics.caseResolutionTime, unit: 'days' },
      { name: 'maintenance_backlog', value: metrics.maintenanceBacklog, unit: 'count' },
      { name: 'energy_efficiency_trend', value: metrics.energyEfficiencyTrend, unit: 'kwh_per_sqm' },
      { name: 'member_satisfaction_score', value: metrics.memberSatisfactionScore, unit: 'score' },
      { name: 'board_meeting_attendance', value: metrics.boardMeetingAttendance, unit: 'percent' },
      { name: 'member_portal_usage', value: metrics.memberPortalUsage, unit: 'percent' },
      { name: 'digital_document_adoption', value: metrics.digitalDocumentAdoption, unit: 'percent' },
      { name: 'average_response_time', value: metrics.averageResponseTime, unit: 'hours' },
      { name: 'system_availability', value: metrics.systemAvailability, unit: 'percent' },
      { name: 'maintenance_cost_per_sqm', value: metrics.maintenanceCostPerSqm, unit: 'sek_per_sqm' },
      { name: 'energy_cost_per_sqm', value: metrics.energyCostPerSqm, unit: 'sek_per_sqm' },
      { name: 'occupancy_rate', value: metrics.occupancyRate, unit: 'percent' },
      { name: 'turnover_rate', value: metrics.turnoverRate, unit: 'percent' }
    ];

    metricMappings.forEach(metric => {
      performanceCollector.recordMetric({
        name: metric.name,
        category: 'brf_operations',
        type: 'gauge',
        value: metric.value,
        unit: metric.unit,
        cooperativeId,
        tags: { 
          metric_type: 'kpi',
          measurement_period: 'current' 
        }
      });
    });
  }

  // Private calculation methods

  private async calculateMonthlyFeeCollectionRate(cooperativeId: string, year: number, month: number): Promise<number> {
    const db = getDatabase();
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_fees,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_fees
      FROM monthly_fees 
      WHERE cooperative_id = ? AND year = ? AND month = ?
    `).get(cooperativeId, year, month) as any;

    return stats.total_fees > 0 ? (stats.paid_fees / stats.total_fees) * 100 : 100;
  }

  private async calculateOverduePaymentRatio(cooperativeId: string): Promise<number> {
    const db = getDatabase();
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN payment_status = 'overdue' THEN 1 END) as overdue_payments
      FROM monthly_fees 
      WHERE cooperative_id = ? 
        AND created_at >= datetime('now', '-6 months')
    `).get(cooperativeId) as any;

    return stats.total_payments > 0 ? (stats.overdue_payments / stats.total_payments) * 100 : 0;
  }

  private async calculateAveragePaymentDelay(cooperativeId: string): Promise<number> {
    const db = getDatabase();
    
    const result = db.prepare(`
      SELECT AVG(
        CASE 
          WHEN paid_date IS NOT NULL 
          THEN julianday(paid_date) - julianday(created_at)
          ELSE NULL 
        END
      ) as avg_delay
      FROM monthly_fees 
      WHERE cooperative_id = ? 
        AND payment_status = 'paid'
        AND created_at >= datetime('now', '-3 months')
    `).get(cooperativeId) as any;

    return result?.avg_delay || 0;
  }

  private async calculateBudgetVariance(cooperativeId: string, year: number): Promise<number> {
    // This would integrate with budget/accounting system
    // For now, return a placeholder calculation
    return Math.random() * 10 - 5; // -5% to +5% variance
  }

  private async calculateCaseResolutionTime(cooperativeId: string): Promise<number> {
    const db = getDatabase();
    
    const result = db.prepare(`
      SELECT AVG(
        julianday(resolved_at) - julianday(reported_at)
      ) as avg_resolution_days
      FROM cases 
      WHERE cooperative_id = ? 
        AND status IN ('resolved', 'closed')
        AND resolved_at IS NOT NULL
        AND reported_at >= datetime('now', '-3 months')
    `).get(cooperativeId) as any;

    return result?.avg_resolution_days || 0;
  }

  private async calculateMaintenanceBacklog(cooperativeId: string): Promise<number> {
    const db = getDatabase();
    
    const result = db.prepare(`
      SELECT COUNT(*) as backlog_count
      FROM cases 
      WHERE cooperative_id = ? 
        AND category LIKE '%maintenance%'
        AND status IN ('open', 'in_progress')
    `).get(cooperativeId) as any;

    return result?.backlog_count || 0;
  }

  private async calculateEnergyEfficiencyTrend(cooperativeId: string): Promise<number> {
    const db = getDatabase();
    
    const result = db.prepare(`
      SELECT AVG(kwh_per_sqm) as avg_kwh_per_sqm
      FROM energy_consumption 
      WHERE cooperative_id = ? 
        AND created_at >= datetime('now', '-12 months')
    `).get(cooperativeId) as any;

    return result?.avg_kwh_per_sqm || 0;
  }

  private async calculateMemberSatisfactionScore(cooperativeId: string): Promise<number> {
    // This would integrate with survey/feedback system
    // For now, return a baseline score
    return 7.5; // Out of 10
  }

  private async calculateBoardMeetingAttendance(cooperativeId: string, year: number): Promise<number> {
    const db = getDatabase();
    
    // Calculate average attendance rate from meeting data
    const meetings = db.prepare(`
      SELECT attendees, absentees
      FROM board_meetings 
      WHERE cooperative_id = ? 
        AND status = 'completed'
        AND scheduled_date BETWEEN ? AND ?
    `).all(cooperativeId, `${year}-01-01`, `${year}-12-31`) as any[];

    let totalAttendance = 0;
    let totalPossibleAttendance = 0;

    meetings.forEach(meeting => {
      const attendees = JSON.parse(meeting.attendees || '[]').length;
      const absentees = JSON.parse(meeting.absentees || '[]').length;
      const total = attendees + absentees;
      
      if (total > 0) {
        totalAttendance += attendees;
        totalPossibleAttendance += total;
      }
    });

    return totalPossibleAttendance > 0 ? (totalAttendance / totalPossibleAttendance) * 100 : 0;
  }

  private async checkAnnualReportCompliance(cooperativeId: string, year: number): Promise<boolean> {
    const db = getDatabase();
    
    const cooperative = db.prepare(`
      SELECT annual_report_filed
      FROM cooperatives 
      WHERE id = ?
    `).get(cooperativeId) as any;

    if (!cooperative?.annual_report_filed) return false;

    const filedDate = new Date(cooperative.annual_report_filed);
    const requiredDate = new Date(year, 6, 31); // July 31st deadline for Swedish BRFs
    
    return filedDate <= requiredDate;
  }

  private async calculateAuditComplianceScore(cooperativeId: string): Promise<number> {
    // This would integrate with audit management system
    return 8.5; // Out of 10
  }

  private async calculateGdprComplianceScore(cooperativeId: string): Promise<number> {
    // Calculate GDPR compliance based on data processing activities
    const db = getDatabase();
    
    // Check if data retention policies are followed
    const oldDataCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM queue_positions 
      WHERE cooperative_id = ? 
        AND data_retention_date < datetime('now')
        AND status NOT IN ('active', 'offered')
    `).get(cooperativeId) as any;

    // Basic compliance score (would be more comprehensive in practice)
    const baseScore = 85;
    const penalty = oldDataCount.count * 2; // 2% penalty per violation
    
    return Math.max(baseScore - penalty, 0);
  }

  private async calculateMemberPortalUsage(cooperativeId: string): Promise<number> {
    const db = getDatabase();
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_members,
        COUNT(CASE WHEN last_login_at IS NOT NULL THEN 1 END) as active_members
      FROM members 
      WHERE cooperative_id = ? 
        AND is_active = 1 
        AND deleted_at IS NULL
    `).get(cooperativeId) as any;

    return stats.total_members > 0 ? (stats.active_members / stats.total_members) * 100 : 0;
  }

  private async calculateDigitalDocumentAdoption(cooperativeId: string): Promise<number> {
    const db = getDatabase();
    
    const stats = db.prepare(`
      SELECT COUNT(*) as digital_documents
      FROM documents 
      WHERE cooperative_id = ? 
        AND created_at >= datetime('now', '-12 months')
    `).get(cooperativeId) as any;

    // Calculate against total document volume (would include physical documents in practice)
    const estimatedTotalDocuments = stats.digital_documents * 1.5; // Assume 33% are still physical
    
    return estimatedTotalDocuments > 0 ? (stats.digital_documents / estimatedTotalDocuments) * 100 : 100;
  }

  private async calculateAverageResponseTime(cooperativeId: string): Promise<number> {
    // This would track response times to member queries
    // For now, return a baseline value
    return 24; // 24 hours average response time
  }

  private async calculateSystemAvailability(cooperativeId: string): Promise<number> {
    // This would integrate with uptime monitoring
    return 99.5; // 99.5% uptime
  }

  private async calculateMaintenanceCostPerSqm(cooperativeId: string, year: number): Promise<number> {
    const db = getDatabase();
    
    const cooperative = db.prepare(`
      SELECT total_area_sqm FROM cooperatives WHERE id = ?
    `).get(cooperativeId) as any;

    const maintenanceCosts = db.prepare(`
      SELECT SUM(total_amount) as total_cost
      FROM invoices 
      WHERE cooperative_id = ? 
        AND invoice_date BETWEEN ? AND ?
        AND (
          LOWER(supplier_name) LIKE '%underhåll%' 
          OR LOWER(supplier_name) LIKE '%service%'
          OR LOWER(supplier_name) LIKE '%reparation%'
        )
    `).get(cooperativeId, `${year}-01-01`, `${year}-12-31`) as any;

    if (!cooperative?.total_area_sqm || !maintenanceCosts?.total_cost) return 0;
    
    return maintenanceCosts.total_cost / cooperative.total_area_sqm;
  }

  private async calculateEnergyCostPerSqm(cooperativeId: string, year: number): Promise<number> {
    const db = getDatabase();
    
    const result = db.prepare(`
      SELECT AVG(cost_per_sqm) as avg_cost_per_sqm
      FROM energy_consumption 
      WHERE cooperative_id = ? 
        AND year = ?
    `).get(cooperativeId, year) as any;

    return result?.avg_cost_per_sqm || 0;
  }

  private async calculateOccupancyRate(cooperativeId: string): Promise<number> {
    const db = getDatabase();
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_apartments,
        COUNT(CASE WHEN owner_id IS NOT NULL THEN 1 END) as occupied_apartments
      FROM apartments 
      WHERE cooperative_id = ?
    `).get(cooperativeId) as any;

    return stats.total_apartments > 0 ? (stats.occupied_apartments / stats.total_apartments) * 100 : 100;
  }

  private async calculateTurnoverRate(cooperativeId: string, year: number): Promise<number> {
    const db = getDatabase();
    
    const totalApartments = db.prepare(`
      SELECT COUNT(*) as count FROM apartments WHERE cooperative_id = ?
    `).get(cooperativeId) as any;

    // Count ownership changes (would need ownership history table in practice)
    const ownershipChanges = db.prepare(`
      SELECT COUNT(*) as changes
      FROM apartments 
      WHERE cooperative_id = ? 
        AND ownership_date BETWEEN ? AND ?
    `).get(cooperativeId, `${year}-01-01`, `${year}-12-31`) as any;

    return totalApartments.count > 0 ? (ownershipChanges.changes / totalApartments.count) * 100 : 0;
  }

  private async calculateCo2EmissionsPerSqm(cooperativeId: string, year: number): Promise<number> {
    // Estimate CO2 emissions based on energy consumption
    // This would integrate with energy provider data in practice
    const db = getDatabase();
    
    const energyData = db.prepare(`
      SELECT AVG(electricity_kwh + heating_kwh) as avg_kwh
      FROM energy_consumption 
      WHERE cooperative_id = ? AND year = ?
    `).get(cooperativeId, year) as any;

    const cooperative = db.prepare(`
      SELECT total_area_sqm FROM cooperatives WHERE id = ?
    `).get(cooperativeId) as any;

    if (!energyData?.avg_kwh || !cooperative?.total_area_sqm) return 0;

    // Estimate: 0.4 kg CO2 per kWh for Swedish electricity mix
    const co2PerKwh = 0.4;
    const totalCo2 = (energyData.avg_kwh * 12) * co2PerKwh; // Annual CO2
    
    return totalCo2 / cooperative.total_area_sqm;
  }

  private async calculateRenewableEnergyRatio(cooperativeId: string, year: number): Promise<number> {
    // This would integrate with energy source data
    // Sweden has high renewable energy ratio, return baseline
    return 65; // 65% renewable energy
  }

  private async calculateMemberInformationAccess(cooperativeId: string): Promise<number> {
    // Calculate how accessible information is to members
    // This would track document access, portal usage, etc.
    return 85; // 85% information accessibility
  }
}

// Export singleton instance
export const brfMetricsCollector = BrfMetricsCollector.getInstance();