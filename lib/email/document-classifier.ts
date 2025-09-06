/**
 * BRF Document Classification System
 * Intelligently categorizes documents based on filename, content, and email context
 * Specialized for Swedish BRF (Bostadsrättsförening) document types
 */

import path from 'path';
import { promises as fs } from 'fs';

export interface ClassificationContext {
  filename: string;
  contentType: string;
  size: number;
  tempPath: string;
  email_context: {
    from: string;
    subject: string;
    body: string;
  };
  cooperative_id: string;
}

export interface ClassificationResult {
  category: string;
  subcategory?: string;
  confidence: number;
  reasoning: string[];
  metadata: {
    requires_manual_review: boolean;
    estimated_processing_time_seconds: number;
    tags: string[];
  };
}

export class BRFDocumentClassifier {
  private static readonly BRF_CATEGORIES = {
    invoice: {
      keywords: [
        'faktura', 'invoice', 'räkning', 'betalning', 'kostnad',
        'hyra', 'avgift', 'reparation', 'underhåll', 'el', 'värme',
        'städning', 'snöröjning', 'hiss', 'fastighetsskötsel'
      ],
      sender_patterns: [
        'vattenfall', 'eon', 'fortum', 'skanska', 'ncc',
        'städ', 'renhållning', 'hissar', 'schindler', 'otis'
      ],
      confidence_weights: {
        filename: 0.3,
        sender: 0.4,
        subject: 0.2,
        content: 0.1
      }
    },
    protocol: {
      keywords: [
        'protokoll', 'styrelseprotokoll', 'årsmöte', 'föreningsstämma',
        'beslut', 'dagordning', 'mötesprotokoll', 'stämmoprotokoll'
      ],
      sender_patterns: [
        'styrelse', 'ordförande', 'sekreterare', 'förvaltare'
      ],
      confidence_weights: {
        filename: 0.4,
        sender: 0.3,
        subject: 0.3
      }
    },
    contract: {
      keywords: [
        'avtal', 'kontrakt', 'överenskommelse', 'entreprenad',
        'servicekontrakt', 'försäkring', 'garantibevis'
      ],
      sender_patterns: [
        'försäkring', 'trygg-hansa', 'folksam', 'länsförsäkringar',
        'if', 'moderna', 'advokat', 'juridik'
      ],
      confidence_weights: {
        filename: 0.4,
        sender: 0.3,
        subject: 0.2,
        content: 0.1
      }
    },
    report: {
      keywords: [
        'rapport', 'besiktning', 'inspektion', 'energideklaration',
        'årsredovisning', 'revision', 'ekonomisk', 'bokslut',
        'budget', 'prognos', 'analys'
      ],
      sender_patterns: [
        'revisor', 'besiktning', 'energi', 'konsult',
        'redovisning', 'ekonomi', 'pwc', 'deloitte', 'kpmg', 'ey'
      ],
      confidence_weights: {
        filename: 0.4,
        sender: 0.3,
        subject: 0.3
      }
    },
    maintenance: {
      keywords: [
        'underhåll', 'reparation', 'service', 'besiktning',
        'renovation', 'målning', 'takarbeten', 'rörmokeri',
        'ventilation', 'hiss', 'brand', 'säkerhet'
      ],
      sender_patterns: [
        'måleri', 'tak', 'rör', 'ventilation', 'hiss',
        'brand', 'säkerhet', 'lås', 'el', 'elektriker'
      ],
      confidence_weights: {
        filename: 0.3,
        sender: 0.4,
        subject: 0.2,
        content: 0.1
      }
    },
    legal: {
      keywords: [
        'juridik', 'tvist', 'ärende', 'anmälan', 'klagomål',
        'domstol', 'kronofogden', 'inkasso', 'skuld'
      ],
      sender_patterns: [
        'advokat', 'juridik', 'domstol', 'kronofogden',
        'inkasso', 'rättshjälp'
      ],
      confidence_weights: {
        filename: 0.3,
        sender: 0.5,
        subject: 0.2
      }
    },
    member: {
      keywords: [
        'medlem', 'andelsägare', 'lägenhet', 'flytt', 'uthyrning',
        'anmälan', 'ansökan', 'tillstånd'
      ],
      sender_patterns: [],
      confidence_weights: {
        filename: 0.3,
        sender: 0.2,
        subject: 0.3,
        content: 0.2
      }
    },
    general: {
      keywords: [],
      sender_patterns: [],
      confidence_weights: {
        filename: 1.0
      }
    }
  };

  private static readonly FILE_TYPE_INDICATORS = {
    pdf: { score: 0.8, reason: 'PDF ofta används för officiella dokument' },
    docx: { score: 0.7, reason: 'Word-dokument vanligt för protokoll och rapporter' },
    xlsx: { score: 0.6, reason: 'Excel ofta används för ekonomiska rapporter' },
    jpg: { score: 0.4, reason: 'Bild kan vara skannad faktura eller skaderapport' },
    png: { score: 0.4, reason: 'Bild kan vara skärmdump eller diagram' },
  };

  /**
   * Classify a document based on various context clues
   */
  async classifyDocument(context: ClassificationContext): Promise<ClassificationResult> {
    const reasoning: string[] = [];
    let bestCategory = 'general';
    let maxScore = 0;
    let confidence = 0;

    // Analyze file extension
    const fileExt = path.extname(context.filename).toLowerCase().slice(1);
    const fileTypeScore = BRFDocumentClassifier.FILE_TYPE_INDICATORS[fileExt]?.score || 0.3;
    if (BRFDocumentClassifier.FILE_TYPE_INDICATORS[fileExt]) {
      reasoning.push(BRFDocumentClassifier.FILE_TYPE_INDICATORS[fileExt].reason);
    }

    // Test each category
    for (const [categoryName, categoryData] of Object.entries(BRFDocumentClassifier.BRF_CATEGORIES)) {
      const score = this.calculateCategoryScore(context, categoryData, reasoning);
      
      if (score > maxScore) {
        maxScore = score;
        bestCategory = categoryName;
        confidence = Math.min(score * fileTypeScore, 1.0);
      }
    }

    // Determine subcategory for specific categories
    let subcategory: string | undefined;
    if (bestCategory === 'invoice') {
      subcategory = this.determineInvoiceSubcategory(context);
    } else if (bestCategory === 'report') {
      subcategory = this.determineReportSubcategory(context);
    }

    // Determine if manual review is needed
    const requiresManualReview = this.shouldRequireManualReview(
      bestCategory,
      confidence,
      context
    );

    // Estimate processing time
    const processingTime = this.estimateProcessingTime(
      bestCategory,
      context.size,
      requiresManualReview
    );

    // Generate tags
    const tags = this.generateTags(bestCategory, subcategory, context);

    return {
      category: bestCategory,
      subcategory,
      confidence,
      reasoning,
      metadata: {
        requires_manual_review: requiresManualReview,
        estimated_processing_time_seconds: processingTime,
        tags,
      },
    };
  }

  /**
   * Calculate score for a specific category
   */
  private calculateCategoryScore(
    context: ClassificationContext,
    categoryData: any,
    reasoning: string[]
  ): number {
    let totalScore = 0;
    const weights = categoryData.confidence_weights;

    // Filename analysis
    if (weights.filename) {
      const filenameScore = this.analyzeFilename(context.filename, categoryData.keywords);
      totalScore += filenameScore * weights.filename;
      if (filenameScore > 0.5) {
        reasoning.push(`Filnamnet "${context.filename}" matchar kategorinyckkelord`);
      }
    }

    // Sender analysis
    if (weights.sender) {
      const senderScore = this.analyzeSender(context.email_context.from, categoryData.sender_patterns);
      totalScore += senderScore * weights.sender;
      if (senderScore > 0.5) {
        reasoning.push(`Avsändaren "${context.email_context.from}" matchar kategorimönster`);
      }
    }

    // Subject analysis
    if (weights.subject) {
      const subjectScore = this.analyzeText(context.email_context.subject, categoryData.keywords);
      totalScore += subjectScore * weights.subject;
      if (subjectScore > 0.5) {
        reasoning.push(`Ämnesraden matchar kategorinyckkelord`);
      }
    }

    // Content analysis (limited for performance)
    if (weights.content) {
      const contentScore = this.analyzeText(context.email_context.body, categoryData.keywords);
      totalScore += contentScore * weights.content;
      if (contentScore > 0.3) {
        reasoning.push(`E-postinnehållet matchar kategorinyckkelord`);
      }
    }

    return totalScore;
  }

  /**
   * Analyze filename for category keywords
   */
  private analyzeFilename(filename: string, keywords: string[]): number {
    const lowerFilename = filename.toLowerCase();
    let matches = 0;

    for (const keyword of keywords) {
      if (lowerFilename.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return Math.min(matches / Math.max(keywords.length * 0.3, 1), 1);
  }

  /**
   * Analyze sender email for category patterns
   */
  private analyzeSender(sender: string, patterns: string[]): number {
    const lowerSender = sender.toLowerCase();
    let matches = 0;

    for (const pattern of patterns) {
      if (lowerSender.includes(pattern.toLowerCase())) {
        matches++;
      }
    }

    return Math.min(matches / Math.max(patterns.length * 0.5, 1), 1);
  }

  /**
   * Analyze text content for keywords
   */
  private analyzeText(text: string, keywords: string[]): number {
    if (!text || keywords.length === 0) return 0;

    const lowerText = text.toLowerCase();
    let matches = 0;

    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return Math.min(matches / Math.max(keywords.length * 0.2, 1), 1);
  }

  /**
   * Determine invoice subcategory
   */
  private determineInvoiceSubcategory(context: ClassificationContext): string {
    const filename = context.filename.toLowerCase();
    const subject = context.email_context.subject.toLowerCase();
    const sender = context.email_context.from.toLowerCase();

    if (filename.includes('el') || subject.includes('el') || sender.includes('vattenfall') || sender.includes('eon')) {
      return 'electricity';
    }
    if (filename.includes('värme') || subject.includes('värme') || subject.includes('heating')) {
      return 'heating';
    }
    if (filename.includes('städ') || subject.includes('städ') || sender.includes('städ')) {
      return 'cleaning';
    }
    if (filename.includes('hiss') || subject.includes('hiss') || sender.includes('schindler') || sender.includes('otis')) {
      return 'elevator';
    }
    if (filename.includes('snö') || subject.includes('snöröjning')) {
      return 'snow_removal';
    }

    return 'general';
  }

  /**
   * Determine report subcategory
   */
  private determineReportSubcategory(context: ClassificationContext): string {
    const filename = context.filename.toLowerCase();
    const subject = context.email_context.subject.toLowerCase();

    if (filename.includes('årsredovisning') || subject.includes('årsredovisning')) {
      return 'annual_report';
    }
    if (filename.includes('budget') || subject.includes('budget')) {
      return 'budget';
    }
    if (filename.includes('besiktning') || subject.includes('besiktning')) {
      return 'inspection';
    }
    if (filename.includes('energi') || subject.includes('energideklaration')) {
      return 'energy_declaration';
    }
    if (filename.includes('revision') || subject.includes('revision')) {
      return 'audit';
    }

    return 'general';
  }

  /**
   * Determine if document should require manual review
   */
  private shouldRequireManualReview(
    category: string,
    confidence: number,
    context: ClassificationContext
  ): boolean {
    // Low confidence requires review
    if (confidence < 0.6) return true;

    // Large files might need review
    if (context.size > 10 * 1024 * 1024) return true; // > 10MB

    // Certain categories always need review
    if (['legal', 'contract'].includes(category)) return true;

    // Suspicious file types
    const fileExt = path.extname(context.filename).toLowerCase();
    if (['.zip', '.rar', '.7z'].includes(fileExt)) return true;

    return false;
  }

  /**
   * Estimate processing time based on document characteristics
   */
  private estimateProcessingTime(
    category: string,
    fileSize: number,
    requiresManualReview: boolean
  ): number {
    let baseTime = 30; // 30 seconds base processing

    // Add time based on file size
    const sizeMB = fileSize / (1024 * 1024);
    baseTime += sizeMB * 2; // 2 seconds per MB

    // Add time based on category
    const categoryMultipliers: Record<string, number> = {
      invoice: 1.2,
      protocol: 1.5,
      contract: 2.0,
      report: 1.8,
      legal: 2.5,
      maintenance: 1.3,
      member: 1.1,
      general: 1.0,
    };

    baseTime *= categoryMultipliers[category] || 1.0;

    // Manual review adds significant time
    if (requiresManualReview) {
      baseTime *= 3;
    }

    return Math.round(baseTime);
  }

  /**
   * Generate tags for the document
   */
  private generateTags(
    category: string,
    subcategory: string | undefined,
    context: ClassificationContext
  ): string[] {
    const tags = [category];

    if (subcategory) {
      tags.push(subcategory);
    }

    // Add file type tag
    const fileExt = path.extname(context.filename).toLowerCase().slice(1);
    if (fileExt) {
      tags.push(fileExt);
    }

    // Add year tag if detectable
    const currentYear = new Date().getFullYear();
    const yearMatch = context.filename.match(/20\d{2}/);
    if (yearMatch) {
      tags.push(`year_${yearMatch[0]}`);
    } else {
      tags.push(`year_${currentYear}`);
    }

    // Add size category
    const sizeMB = context.size / (1024 * 1024);
    if (sizeMB < 1) {
      tags.push('small_file');
    } else if (sizeMB < 10) {
      tags.push('medium_file');
    } else {
      tags.push('large_file');
    }

    return tags;
  }
}