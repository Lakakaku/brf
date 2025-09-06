/**
 * Swedish BRF-Specific Query Templates and Analysis
 * 
 * This module provides pre-defined query templates and analysis patterns
 * specifically designed for Swedish BRF (Bostadsrättsförening) operations,
 * ensuring compliance with Swedish regulations and optimal performance.
 */

import { getDatabase } from '../config';
import { RLSContext } from '../rls';

export interface BRFQueryTemplate {
  id: string;
  name: string;
  description: string;
  category: BRFQueryCategory;
  sqlTemplate: string;
  parameters: QueryParameter[];
  expectedPerformance: PerformanceExpectations;
  complianceNotes: ComplianceRequirements;
  usageScenarios: string[];
  optimizationTips: string[];
  swedishLegalContext: SwedishLegalContext;
  exampleUsage: string;
}

export interface QueryParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  description: string;
  required: boolean;
  validationRules?: string[];
  defaultValue?: any;
  swedishContext?: string;
}

export interface PerformanceExpectations {
  maxExecutionTimeMs: number;
  expectedRowCount: number;
  memoryUsageMB: number;
  indexUsageRequired: boolean;
  cacheRecommended: boolean;
  scalabilityNotes: string;
}

export interface ComplianceRequirements {
  gdprRelevant: boolean;
  personalDataFields: string[];
  legalBasis: string[];
  retentionPeriod: string;
  auditRequired: boolean;
  k2k3Relevant: boolean;
  brlCompliance: string[];
}

export interface SwedishLegalContext {
  applicableLaws: string[];
  complianceNotes: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dataProtectionImpact: string;
  memberRights: string[];
}

export type BRFQueryCategory = 
  | 'medlemshantering'           // Member management
  | 'ekonomi_k2k3'              // Finance & K2/K3 accounting
  | 'styrelsearbete'            // Board governance
  | 'lägenhetsförvaltning'      // Apartment administration
  | 'ärendehantering'           // Case management
  | 'bokningssystem'            // Booking system
  | 'energiuppföljning'         // Energy monitoring
  | 'kö_hantering'              // Queue management
  | 'dokumenthantering'         // Document management
  | 'revision_compliance'        // Audit & compliance
  | 'kontraktshantering'        // Contract management
  | 'underhållsplanering';      // Maintenance planning

/**
 * Swedish BRF Query Template Manager
 */
export class BRFQueryTemplateManager {
  private templates: Map<string, BRFQueryTemplate> = new Map();
  
  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    const templates: BRFQueryTemplate[] = [
      // Member Management Templates
      {
        id: 'member_profile_lookup',
        name: 'Medlemsprofil uppslag',
        description: 'Hämta grundläggande medlemsinformation med integritetsskydd',
        category: 'medlemshantering',
        sqlTemplate: `
          SELECT 
            m.id,
            m.first_name,
            m.last_name,
            m.email,
            m.phone,
            m.role,
            m.is_active,
            m.created_at,
            a.apartment_number,
            a.size_sqm
          FROM members m
          LEFT JOIN apartments a ON m.id = a.owner_id
          WHERE m.cooperative_id = :cooperative_id
            AND m.id = :member_id
            AND m.deleted_at IS NULL
        `,
        parameters: [
          {
            name: 'cooperative_id',
            type: 'string',
            description: 'BRF:s unika identifierare',
            required: true,
            swedishContext: 'Säkerställer dataisolering mellan BRF:er'
          },
          {
            name: 'member_id',
            type: 'string',
            description: 'Medlemmens unika identifierare',
            required: true
          }
        ],
        expectedPerformance: {
          maxExecutionTimeMs: 10,
          expectedRowCount: 1,
          memoryUsageMB: 0.1,
          indexUsageRequired: true,
          cacheRecommended: true,
          scalabilityNotes: 'Använder primärnyckel och cooperative_id index'
        },
        complianceNotes: {
          gdprRelevant: true,
          personalDataFields: ['first_name', 'last_name', 'email', 'phone'],
          legalBasis: ['Legitimate interests for housing cooperative operations'],
          retentionPeriod: '2 år efter medlemskap upphör',
          auditRequired: true,
          k2k3Relevant: false,
          brlCompliance: ['Medlemsregister enligt BRL']
        },
        usageScenarios: [
          'Medlemsprofil i självbetjäning',
          'Kontaktinformation för styrelse',
          'Lägenhetskoppling för avgifter'
        ],
        optimizationTips: [
          'Använd covering index på (cooperative_id, id)',
          'Cachea ofta använda profiler',
          'Begränsa kolumner baserat på användarroll'
        ],
        swedishLegalContext: {
          applicableLaws: ['GDPR', 'PUL', 'Bostadsrättslagen'],
          complianceNotes: [
            'Medlemsdata är personuppgifter enligt GDPR',
            'BRF har berättigat intresse för medlemshantering',
            'Minimera dataexponering baserat på syfte'
          ],
          riskLevel: 'medium',
          dataProtectionImpact: 'Exponerar personuppgifter för legitima BRF-operationer',
          memberRights: ['Rätt till information', 'Rätt till rättelse', 'Rätt till radering']
        },
        exampleUsage: `
          // Hämta medlemsprofil för inloggad användare
          const member = await brfQuery('member_profile_lookup', {
            cooperative_id: user.cooperative_id,
            member_id: user.id
          });
        `
      },

      // Financial K2/K3 Templates
      {
        id: 'monthly_financial_summary',
        name: 'Månatlig ekonomisk sammanställning',
        description: 'Generera månatlig finansiell rapport enligt K2/K3 standard',
        category: 'ekonomi_k2k3',
        sqlTemplate: `
          SELECT 
            'Månadsavgifter' as category,
            SUM(CASE WHEN mf.payment_status = 'paid' THEN mf.total_amount ELSE 0 END) as paid_amount,
            SUM(CASE WHEN mf.payment_status = 'pending' THEN mf.total_amount ELSE 0 END) as pending_amount,
            SUM(CASE WHEN mf.payment_status = 'overdue' THEN mf.total_amount ELSE 0 END) as overdue_amount,
            COUNT(*) as total_invoices
          FROM monthly_fees mf
          WHERE mf.cooperative_id = :cooperative_id
            AND mf.year = :year
            AND mf.month = :month
          
          UNION ALL
          
          SELECT 
            'Fakturor' as category,
            SUM(CASE WHEN i.payment_status = 'paid' THEN i.total_amount ELSE 0 END) as paid_amount,
            SUM(CASE WHEN i.payment_status = 'pending' THEN i.total_amount ELSE 0 END) as pending_amount,
            SUM(CASE WHEN i.payment_status = 'overdue' THEN i.total_amount ELSE 0 END) as overdue_amount,
            COUNT(*) as total_invoices
          FROM invoices i
          WHERE i.cooperative_id = :cooperative_id
            AND strftime('%Y', i.invoice_date) = CAST(:year AS TEXT)
            AND strftime('%m', i.invoice_date) = printf('%02d', :month)
          
          UNION ALL
          
          SELECT 
            'Lån' as category,
            SUM(lp.amortization_amount + lp.interest_amount) as paid_amount,
            0 as pending_amount,
            0 as overdue_amount,
            COUNT(*) as total_invoices
          FROM loan_payments lp
          JOIN loans l ON lp.loan_id = l.id
          WHERE l.cooperative_id = :cooperative_id
            AND strftime('%Y', lp.payment_date) = CAST(:year AS TEXT)
            AND strftime('%m', lp.payment_date) = printf('%02d', :month)
            AND lp.status = 'completed'
        `,
        parameters: [
          {
            name: 'cooperative_id',
            type: 'string',
            description: 'BRF:s unika identifierare',
            required: true
          },
          {
            name: 'year',
            type: 'number',
            description: 'År för rapporten',
            required: true,
            validationRules: ['year >= 2000', 'year <= current_year'],
            swedishContext: 'Bokföringsår enligt svensk redovisningsstandard'
          },
          {
            name: 'month',
            type: 'number',
            description: 'Månad för rapporten (1-12)',
            required: true,
            validationRules: ['month >= 1', 'month <= 12']
          }
        ],
        expectedPerformance: {
          maxExecutionTimeMs: 100,
          expectedRowCount: 3,
          memoryUsageMB: 1,
          indexUsageRequired: true,
          cacheRecommended: false,
          scalabilityNotes: 'Kräver index på datum-kolumner för prestanda'
        },
        complianceNotes: {
          gdprRelevant: false,
          personalDataFields: [],
          legalBasis: ['Legal obligation for accounting records'],
          retentionPeriod: '7 år enligt Bokföringslagen',
          auditRequired: true,
          k2k3Relevant: true,
          brlCompliance: ['Ekonomisk redovisning enligt BRL']
        },
        usageScenarios: [
          'Månatlig ekonomisk rapport till styrelsen',
          'Underlag för årsbokslut',
          'Budgetuppföljning'
        ],
        optimizationTips: [
          'Skapa index på (cooperative_id, year, month)',
          'Överväg materialiserad vy för ofta körda rapporter',
          'Partitionera stora tabeller på år/månad'
        ],
        swedishLegalContext: {
          applicableLaws: ['Bokföringslagen', 'Årsredovisningslagen', 'K2/K3'],
          complianceNotes: [
            'Måste följa K2 eller K3 redovisningsstandard',
            'Revisionsspår krävs för alla finansiella transaktioner',
            'Månadsrapporter ska arkiveras i 7 år'
          ],
          riskLevel: 'high',
          dataProtectionImpact: 'Finansiella data kräver extra säkerhet',
          memberRights: ['Rätt till insyn i ekonomisk förvaltning']
        },
        exampleUsage: `
          // Generera månatlig rapport
          const report = await brfQuery('monthly_financial_summary', {
            cooperative_id: coop.id,
            year: 2024,
            month: 1
          });
        `
      },

      // Board Governance Templates  
      {
        id: 'board_meeting_agenda_items',
        name: 'Styrelseärenden för nästa möte',
        description: 'Hämta öppna ärenden och förslag för kommande styrelsemöte',
        category: 'styrelsearbete',
        sqlTemplate: `
          SELECT 
            'Öppet ärende' as item_type,
            c.id,
            c.case_number,
            c.title,
            c.description,
            c.priority,
            c.status,
            c.reported_at,
            m_reported.first_name || ' ' || m_reported.last_name as reported_by_name,
            m_assigned.first_name || ' ' || m_assigned.last_name as assigned_to_name,
            CASE 
              WHEN c.priority = 'urgent' THEN 1
              WHEN c.priority = 'high' THEN 2
              WHEN c.priority = 'normal' THEN 3
              ELSE 4
            END as sort_order
          FROM cases c
          LEFT JOIN members m_reported ON c.reported_by = m_reported.id
          LEFT JOIN members m_assigned ON c.assigned_to = m_assigned.id
          WHERE c.cooperative_id = :cooperative_id
            AND c.status IN ('open', 'in_progress')
            AND (c.category = 'board_decision' OR c.priority IN ('urgent', 'high'))
          
          UNION ALL
          
          SELECT 
            'Finansiell granskning' as item_type,
            'fin_' || i.id as id,
            NULL as case_number,
            'Faktura: ' || i.supplier_name || ' - ' || i.total_amount || ' SEK' as title,
            i.description as description,
            CASE WHEN i.total_amount > 50000 THEN 'high' ELSE 'normal' END as priority,
            i.payment_status as status,
            i.invoice_date as reported_at,
            'Ekonomiansvarig' as reported_by_name,
            NULL as assigned_to_name,
            CASE WHEN i.total_amount > 50000 THEN 1 ELSE 3 END as sort_order
          FROM invoices i
          WHERE i.cooperative_id = :cooperative_id
            AND i.payment_status = 'pending'
            AND i.total_amount > :approval_threshold
          
          ORDER BY sort_order, reported_at DESC
          LIMIT :max_items
        `,
        parameters: [
          {
            name: 'cooperative_id',
            type: 'string',
            description: 'BRF:s unika identifierare',
            required: true
          },
          {
            name: 'approval_threshold',
            type: 'number',
            description: 'Beloppsgräns för styrelsegodkännande (SEK)',
            required: false,
            defaultValue: 25000,
            swedishContext: 'Enligt BRL krävs styrelsebeslut för större utgifter'
          },
          {
            name: 'max_items',
            type: 'number',
            description: 'Max antal ärenden att visa',
            required: false,
            defaultValue: 20
          }
        ],
        expectedPerformance: {
          maxExecutionTimeMs: 50,
          expectedRowCount: 15,
          memoryUsageMB: 0.5,
          indexUsageRequired: true,
          cacheRecommended: true,
          scalabilityNotes: 'UNION fråga kräver optimering av båda delfrågorna'
        },
        complianceNotes: {
          gdprRelevant: true,
          personalDataFields: ['reported_by_name', 'assigned_to_name'],
          legalBasis: ['Legitimate interests for board governance'],
          retentionPeriod: 'Permanent för protokoll, 7 år för ärenden',
          auditRequired: true,
          k2k3Relevant: true,
          brlCompliance: ['Styrelseprotokoll enligt BRL', 'Beslutsdokumentation']
        },
        usageScenarios: [
          'Förberedelse av styrelsemöte',
          'Ärendeuppföljning',
          'Prioritering av beslut'
        ],
        optimizationTips: [
          'Index på (cooperative_id, status, priority)',
          'Cachea mellan möten',
          'Separata frågor för stora dataset'
        ],
        swedishLegalContext: {
          applicableLaws: ['Bostadsrättslagen', 'Aktiebolagslagen', 'GDPR'],
          complianceNotes: [
            'Styrelsen har beslutanderätt enligt BRL',
            'Protokollföring krävs för alla beslut',
            'Medlemmar har rätt till insyn i styrelsebeslut'
          ],
          riskLevel: 'medium',
          dataProtectionImpact: 'Innehåller namn på medlemmar och känsliga beslut',
          memberRights: ['Rätt till insyn', 'Rätt att överklaga beslut']
        },
        exampleUsage: `
          // Förbered dagordning för styrelsemöte
          const agenda = await brfQuery('board_meeting_agenda_items', {
            cooperative_id: coop.id,
            approval_threshold: 30000,
            max_items: 25
          });
        `
      },

      // Apartment Administration Templates
      {
        id: 'apartment_ownership_transfer',
        name: 'Ägarskifte för lägenhet',
        description: 'Hantera ägarskifte med alla nödvändiga kontroller',
        category: 'lägenhetsförvaltning',
        sqlTemplate: `
          WITH apartment_details AS (
            SELECT 
              a.id,
              a.apartment_number,
              a.size_sqm,
              a.monthly_fee,
              a.share_capital,
              a.owner_id as current_owner_id,
              m.first_name || ' ' || m.last_name as current_owner_name,
              m.email as current_owner_email
            FROM apartments a
            LEFT JOIN members m ON a.owner_id = m.id
            WHERE a.cooperative_id = :cooperative_id
              AND a.id = :apartment_id
          ),
          outstanding_fees AS (
            SELECT 
              COUNT(*) as unpaid_count,
              COALESCE(SUM(total_amount), 0) as unpaid_amount
            FROM monthly_fees mf
            WHERE mf.apartment_id = :apartment_id
              AND mf.payment_status IN ('pending', 'overdue')
          ),
          member_validation AS (
            SELECT 
              m.id,
              m.first_name || ' ' || m.last_name as new_owner_name,
              m.email,
              m.is_active,
              m.role
            FROM members m
            WHERE m.cooperative_id = :cooperative_id
              AND m.id = :new_owner_id
              AND m.is_active = 1
              AND m.deleted_at IS NULL
          )
          SELECT 
            ad.*,
            of.unpaid_count,
            of.unpaid_amount,
            mv.new_owner_name,
            mv.email as new_owner_email,
            mv.is_active as new_owner_active,
            CASE 
              WHEN ad.current_owner_id IS NULL THEN 'Ledig lägenhet'
              WHEN of.unpaid_count > 0 THEN 'Utestående avgifter'
              WHEN mv.id IS NULL THEN 'Ogiltig ny ägare'
              WHEN mv.is_active = 0 THEN 'Inaktiv medlem'
              ELSE 'OK för ägarskifte'
            END as transfer_status,
            CASE 
              WHEN ad.current_owner_id IS NULL THEN 1
              WHEN of.unpaid_count = 0 AND mv.id IS NOT NULL AND mv.is_active = 1 THEN 1
              ELSE 0
            END as transfer_allowed
          FROM apartment_details ad
          CROSS JOIN outstanding_fees of
          LEFT JOIN member_validation mv ON 1=1
        `,
        parameters: [
          {
            name: 'cooperative_id',
            type: 'string',
            description: 'BRF:s unika identifierare',
            required: true
          },
          {
            name: 'apartment_id',
            type: 'string',
            description: 'Lägenhets unika identifierare',
            required: true
          },
          {
            name: 'new_owner_id',
            type: 'string',
            description: 'Ny ägares medlems-ID',
            required: true,
            swedishContext: 'Måste vara registrerad medlem enligt BRL'
          }
        ],
        expectedPerformance: {
          maxExecutionTimeMs: 25,
          expectedRowCount: 1,
          memoryUsageMB: 0.2,
          indexUsageRequired: true,
          cacheRecommended: false,
          scalabilityNotes: 'CTE optimeras av SQLite query planner'
        },
        complianceNotes: {
          gdprRelevant: true,
          personalDataFields: ['current_owner_name', 'new_owner_name', 'email'],
          legalBasis: ['Contract fulfillment', 'Legal obligations'],
          retentionPeriod: 'Permanent för ägarhistorik',
          auditRequired: true,
          k2k3Relevant: false,
          brlCompliance: ['Ägarregister enligt BRL', 'Överlåtelseregler']
        },
        usageScenarios: [
          'Kontrollera ägarskifte innan genomförande',
          'Validera nya medlemmar',
          'Upptäcka utestående skulder'
        ],
        optimizationTips: [
          'Index på apartment_id och owner_id',
          'Pre-validera member_id innan query',
          'Använd transaktioner för atomicitet'
        ],
        swedishLegalContext: {
          applicableLaws: ['Bostadsrättslagen', 'Jordabalken'],
          complianceNotes: [
            'Ägarskifte kräver styrelsens godkännande',
            'Alla avgifter måste vara betalda',
            'Överlåtelseregister måste uppdateras'
          ],
          riskLevel: 'high',
          dataProtectionImpact: 'Känslig information om ägarskifte och ekonomi',
          memberRights: ['Rätt till korrekt ägarregistrering']
        },
        exampleUsage: `
          // Kontrollera ägarskifte
          const transferCheck = await brfQuery('apartment_ownership_transfer', {
            cooperative_id: coop.id,
            apartment_id: apt.id,
            new_owner_id: newMember.id
          });
        `
      }
    ];

    // Add all templates to the map
    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Get all available BRF query templates
   */
  getTemplates(): BRFQueryTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: BRFQueryCategory): BRFQueryTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(id: string): BRFQueryTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Execute a BRF query template with parameters
   */
  async executeTemplate(
    templateId: string,
    parameters: Record<string, any>,
    context: RLSContext
  ): Promise<{
    results: any[];
    executionTime: number;
    complianceCheck: {
      gdprCompliant: boolean;
      auditLogged: boolean;
      dataMinimized: boolean;
      warnings: string[];
    };
  }> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate parameters
    this.validateParameters(template, parameters);

    // Ensure cooperative_id matches context
    if (parameters.cooperative_id !== context.cooperative_id) {
      throw new Error('Parameter cooperative_id must match context cooperative_id');
    }

    const db = getDatabase();
    const startTime = Date.now();

    try {
      // Replace named parameters in SQL template
      let sql = template.sqlTemplate;
      for (const [key, value] of Object.entries(parameters)) {
        sql = sql.replace(new RegExp(`:${key}\\b`, 'g'), '?');
      }

      // Prepare and execute query
      const stmt = db.prepare(sql);
      const parameterValues = template.parameters
        .filter(p => p.required || parameters[p.name] !== undefined)
        .map(p => parameters[p.name]);

      const results = stmt.all(...parameterValues);
      const executionTime = Date.now() - startTime;

      // Perform compliance check
      const complianceCheck = await this.performComplianceCheck(
        template,
        parameters,
        context,
        results,
        executionTime
      );

      // Log GDPR access if relevant
      if (template.complianceNotes.gdprRelevant) {
        await this.logGDPRAccess(template, context, results);
      }

      return {
        results,
        executionTime,
        complianceCheck
      };

    } catch (error) {
      // Log error and security implications
      console.error(`BRF template execution failed: ${templateId}`, error);
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate optimized query suggestions for a template
   */
  generateOptimizationSuggestions(templateId: string): {
    indexRecommendations: string[];
    queryOptimizations: string[];
    cacheStrategies: string[];
    brfSpecificTips: string[];
  } {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return {
      indexRecommendations: this.generateIndexRecommendations(template),
      queryOptimizations: this.generateQueryOptimizations(template),
      cacheStrategies: this.generateCacheStrategies(template),
      brfSpecificTips: template.optimizationTips
    };
  }

  /**
   * Validate template parameters
   */
  private validateParameters(template: BRFQueryTemplate, parameters: Record<string, any>): void {
    for (const param of template.parameters) {
      if (param.required && parameters[param.name] === undefined) {
        throw new Error(`Required parameter missing: ${param.name}`);
      }

      if (parameters[param.name] !== undefined) {
        // Type validation
        const value = parameters[param.name];
        if (param.type === 'number' && typeof value !== 'number') {
          throw new Error(`Parameter ${param.name} must be a number`);
        }
        if (param.type === 'string' && typeof value !== 'string') {
          throw new Error(`Parameter ${param.name} must be a string`);
        }
        if (param.type === 'boolean' && typeof value !== 'boolean') {
          throw new Error(`Parameter ${param.name} must be a boolean`);
        }

        // Validation rules
        if (param.validationRules) {
          for (const rule of param.validationRules) {
            if (!this.validateRule(value, rule)) {
              throw new Error(`Parameter ${param.name} failed validation: ${rule}`);
            }
          }
        }
      }
    }
  }

  private validateRule(value: any, rule: string): boolean {
    // Simple rule validation - would be more sophisticated in production
    if (rule.includes('>=')) {
      const [_, threshold] = rule.split('>=').map(s => s.trim());
      return value >= parseFloat(threshold);
    }
    if (rule.includes('<=')) {
      const [_, threshold] = rule.split('<=').map(s => s.trim());
      return value <= parseFloat(threshold);
    }
    return true;
  }

  private async performComplianceCheck(
    template: BRFQueryTemplate,
    parameters: Record<string, any>,
    context: RLSContext,
    results: any[],
    executionTime: number
  ): Promise<{
    gdprCompliant: boolean;
    auditLogged: boolean;
    dataMinimized: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    
    // GDPR compliance check
    let gdprCompliant = true;
    if (template.complianceNotes.gdprRelevant) {
      if (!context.user_id) {
        gdprCompliant = false;
        warnings.push('GDPR-relevant query without authenticated user');
      }
      
      if (template.complianceNotes.personalDataFields.length > 0 && results.length > 100) {
        warnings.push('Large result set with personal data - consider pagination');
      }
    }

    // Performance compliance
    if (executionTime > template.expectedPerformance.maxExecutionTimeMs) {
      warnings.push(`Query exceeded expected execution time (${executionTime}ms > ${template.expectedPerformance.maxExecutionTimeMs}ms)`);
    }

    // Data minimization check
    const dataMinimized = results.length <= template.expectedPerformance.expectedRowCount * 2;
    if (!dataMinimized) {
      warnings.push('Result set larger than expected - review data minimization');
    }

    // Audit logging for sensitive templates
    const auditLogged = template.complianceNotes.auditRequired;

    return {
      gdprCompliant,
      auditLogged,
      dataMinimized,
      warnings
    };
  }

  private async logGDPRAccess(
    template: BRFQueryTemplate,
    context: RLSContext,
    results: any[]
  ): Promise<void> {
    const db = getDatabase();
    
    try {
      db.prepare(`
        INSERT INTO gdpr_data_access_log (
          cooperative_id, data_category, user_id, user_role,
          access_purpose, legal_basis, pii_fields_accessed,
          sensitive_data_accessed, automated_processing
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        context.cooperative_id,
        this.mapCategoryToGDPR(template.category),
        context.user_id,
        context.user_role,
        'service_provision',
        template.complianceNotes.legalBasis[0] || 'legitimate_interests',
        JSON.stringify(template.complianceNotes.personalDataFields),
        template.swedishLegalContext.riskLevel === 'critical' ? 1 : 0,
        1 // automated_processing
      );
    } catch (error) {
      console.warn('Failed to log GDPR access:', error);
    }
  }

  private mapCategoryToGDPR(category: BRFQueryCategory): string {
    const mapping: Record<BRFQueryCategory, string> = {
      'medlemshantering': 'personal_identification',
      'ekonomi_k2k3': 'financial_records',
      'styrelsearbete': 'communication_history',
      'lägenhetsförvaltning': 'housing_details',
      'ärendehantering': 'service_usage',
      'bokningssystem': 'service_usage',
      'energiuppföljning': 'housing_details',
      'kö_hantering': 'housing_details',
      'dokumenthantering': 'communication_history',
      'revision_compliance': 'financial_records',
      'kontraktshantering': 'housing_details',
      'underhållsplanering': 'service_usage'
    };
    
    return mapping[category] || 'service_usage';
  }

  private generateIndexRecommendations(template: BRFQueryTemplate): string[] {
    const recommendations: string[] = [];
    
    // Basic cooperative_id index
    recommendations.push('CREATE INDEX IF NOT EXISTS idx_cooperative_filter ON {table}(cooperative_id)');
    
    // Template-specific recommendations
    if (template.category === 'medlemshantering') {
      recommendations.push('CREATE INDEX IF NOT EXISTS idx_members_email ON members(cooperative_id, email)');
      recommendations.push('CREATE INDEX IF NOT EXISTS idx_members_active ON members(cooperative_id, is_active)');
    }
    
    if (template.category === 'ekonomi_k2k3') {
      recommendations.push('CREATE INDEX IF NOT EXISTS idx_financial_date ON {table}(cooperative_id, date)');
      recommendations.push('CREATE INDEX IF NOT EXISTS idx_payment_status ON {table}(cooperative_id, payment_status)');
    }
    
    return recommendations;
  }

  private generateQueryOptimizations(template: BRFQueryTemplate): string[] {
    const optimizations: string[] = [];
    
    if (template.sqlTemplate.includes('UNION')) {
      optimizations.push('Consider splitting UNION queries for better performance');
    }
    
    if (template.sqlTemplate.includes('LEFT JOIN')) {
      optimizations.push('Ensure JOIN conditions use indexed columns');
    }
    
    if (template.expectedPerformance.expectedRowCount > 100) {
      optimizations.push('Add LIMIT clause to prevent large result sets');
    }
    
    return optimizations;
  }

  private generateCacheStrategies(template: BRFQueryTemplate): string[] {
    const strategies: string[] = [];
    
    if (template.expectedPerformance.cacheRecommended) {
      strategies.push(`Cache results for ${template.complianceNotes.retentionPeriod}`);
    }
    
    if (template.category === 'medlemshantering') {
      strategies.push('Use session-scoped cache for member data');
    }
    
    if (template.category === 'ekonomi_k2k3') {
      strategies.push('Cache monthly reports until next update');
    }
    
    return strategies;
  }

  /**
   * Get categories with Swedish descriptions
   */
  getCategoriesWithDescriptions(): Record<BRFQueryCategory, string> {
    return {
      'medlemshantering': 'Medlemsregister och personuppgifter',
      'ekonomi_k2k3': 'Ekonomisk redovisning enligt K2/K3',
      'styrelsearbete': 'Styrelsebeslut och protokoll',
      'lägenhetsförvaltning': 'Lägenhetsregister och ägarskifte',
      'ärendehantering': 'Ärenden och servicebegäran',
      'bokningssystem': 'Lokalbokning och resurser',
      'energiuppföljning': 'Energiförbrukning och miljödata',
      'kö_hantering': 'Bostadskö och köhantering',
      'dokumenthantering': 'Dokumentarkiv och protokoll',
      'revision_compliance': 'Revision och regelefterlevnad',
      'kontraktshantering': 'Avtal och leverantörer',
      'underhållsplanering': 'Underhållsplan och drift'
    };
  }
}

/**
 * Factory function to create BRF template manager
 */
export function createBRFTemplateManager(): BRFQueryTemplateManager {
  return new BRFQueryTemplateManager();
}

/**
 * Global BRF template manager instance
 */
export const brfTemplateManager = createBRFTemplateManager();