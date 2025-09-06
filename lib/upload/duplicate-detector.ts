/**
 * Advanced Duplicate Detection System for BRF Portal
 * Multi-algorithm duplicate detection with BRF-specific intelligence
 */

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { logEvent } from '../monitoring/events';
import { SwedishMessages } from './messages';

export type DetectionAlgorithm = 'md5' | 'sha256' | 'perceptual' | 'content' | 'metadata' | 'fuzzy';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type ResolutionAction = 'keep_original' | 'keep_duplicate' | 'keep_both' | 'merge' | 'delete_original' | 'delete_duplicate';
export type RecommendedAction = 'keep_original' | 'keep_duplicate' | 'keep_both' | 'merge' | 'manual_review';

export interface FileReference {
  id: string;
  type: 'document' | 'upload_file';
  filename: string;
  file_path?: string;
  size_bytes: number;
  mime_type?: string;
  hash_md5?: string;
  hash_sha256?: string;
  document_type?: string;
  created_at: string;
}

export interface DetectionResult {
  duplicate_id: string;
  original_file: FileReference;
  duplicate_file: FileReference;
  algorithm: DetectionAlgorithm;
  similarity_score: number;
  confidence_level: ConfidenceLevel;
  recommended_action: RecommendedAction;
  detection_details: Record<string, any>;
  comparison_metrics: Record<string, any>;
  brf_metadata_comparison?: BRFMetadataComparison;
}

export interface BRFMetadataComparison {
  invoice_number_match?: boolean;
  meeting_date_match?: boolean;
  contractor_match?: boolean;
  apartment_reference_match?: boolean;
  content_similarity?: number;
  metadata_similarity?: number;
}

export interface DuplicateGroup {
  id: string;
  group_name: string;
  group_type: 'exact' | 'similar' | 'related' | 'fuzzy';
  master_file: FileReference;
  member_files: FileReference[];
  total_files: number;
  total_size_bytes: number;
  recommended_master_id: string;
  resolution_strategy: string;
  auto_resolvable: boolean;
  group_quality_score: number;
  confidence_score: number;
}

export interface DetectionRules {
  id: string;
  cooperative_id: string;
  rule_name: string;
  is_active: boolean;
  priority: number;
  algorithms: DetectionAlgorithm[];
  similarity_threshold: number;
  confidence_threshold: ConfidenceLevel;
  file_types: string[];
  document_types: string[];
  min_file_size_bytes: number;
  max_file_size_bytes: number;
  brf_specific_checks: {
    check_invoice_numbers: boolean;
    check_meeting_dates: boolean;
    check_contractor_names: boolean;
    check_apartment_references: boolean;
  };
  auto_resolve: boolean;
  auto_resolution_action: ResolutionAction;
}

export interface DetectionSession {
  id: string;
  cooperative_id: string;
  batch_id?: string;
  session_type: 'batch' | 'scheduled' | 'manual' | 'realtime';
  session_status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_files_scanned: number;
  duplicate_groups_found: number;
  total_duplicates_found: number;
  false_positives_found: number;
  algorithms_used: DetectionAlgorithm[];
  processing_time_seconds: number;
  started_at: string;
  completed_at?: string;
}

export class DuplicateDetector {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  /**
   * Start a duplicate detection session
   */
  async startDetectionSession(params: {
    cooperative_id: string;
    batch_id?: string;
    session_type?: 'batch' | 'scheduled' | 'manual' | 'realtime';
    file_ids?: string[];
    algorithms?: DetectionAlgorithm[];
    started_by?: string;
  }): Promise<DetectionSession> {
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    // Get detection rules for this cooperative
    const rules = this.getActiveDetectionRules(params.cooperative_id);
    const algorithms = params.algorithms || this.getDefaultAlgorithms(rules);

    const stmt = this.db.prepare(`
      INSERT INTO duplicate_detection_sessions (
        id, cooperative_id, batch_id, session_type, algorithms_used,
        started_by, detection_config, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      params.cooperative_id,
      params.batch_id,
      params.session_type || 'manual',
      JSON.stringify(algorithms),
      params.started_by,
      JSON.stringify({
        file_ids: params.file_ids,
        algorithms: algorithms,
        rules_applied: rules.map(r => ({ id: r.id, name: r.rule_name }))
      }),
      now,
      now
    );

    await logEvent({
      cooperative_id: params.cooperative_id,
      event_type: 'duplicate_detection_started',
      event_level: 'info',
      event_source: 'duplicate_detector',
      event_message: 'Duplicate detection session started',
      event_data: { session_id: sessionId, algorithms, file_count: params.file_ids?.length || 0 },
    });

    return {
      id: sessionId,
      cooperative_id: params.cooperative_id,
      batch_id: params.batch_id,
      session_type: params.session_type || 'manual',
      session_status: 'pending',
      total_files_scanned: 0,
      duplicate_groups_found: 0,
      total_duplicates_found: 0,
      false_positives_found: 0,
      algorithms_used: algorithms,
      processing_time_seconds: 0,
      started_at: now,
    };
  }

  /**
   * Run duplicate detection for a batch of files
   */
  async detectDuplicates(sessionId: string): Promise<DetectionResult[]> {
    const session = this.getDetectionSession(sessionId);
    if (!session) {
      throw new Error('Detection session not found');
    }

    // Update session status
    this.updateSessionStatus(sessionId, 'running');
    
    const startTime = Date.now();
    const results: DetectionResult[] = [];

    try {
      // Get files to scan
      const files = await this.getFilesForDetection(session);
      
      // Update session with file count
      this.updateSessionProgress(sessionId, { total_files_scanned: files.length });

      // Get detection rules
      const rules = this.getActiveDetectionRules(session.cooperative_id);

      // Process files in pairs for duplicate detection
      for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
          const file1 = files[i];
          const file2 = files[j];

          // Apply detection rules to determine if we should compare these files
          if (!this.shouldCompareFiles(file1, file2, rules)) {
            continue;
          }

          // Run each algorithm specified in the session
          for (const algorithm of session.algorithms_used) {
            try {
              const result = await this.runDetectionAlgorithm(file1, file2, algorithm, rules);
              if (result) {
                results.push(result);
                await this.saveDuplicateResult(result);
              }
            } catch (error) {
              console.error(`Algorithm ${algorithm} failed for files ${file1.id}, ${file2.id}:`, error);
            }
          }
        }
      }

      // Group duplicates
      const groups = await this.createDuplicateGroups(sessionId, results);

      // Calculate processing time
      const processingTime = (Date.now() - startTime) / 1000;

      // Update session with results
      this.updateSessionProgress(sessionId, {
        duplicate_groups_found: groups.length,
        total_duplicates_found: results.length,
        processing_time_seconds: processingTime,
      });

      // Mark session as completed
      this.updateSessionStatus(sessionId, 'completed', new Date().toISOString());

      await logEvent({
        cooperative_id: session.cooperative_id,
        event_type: 'duplicate_detection_completed',
        event_level: 'info',
        event_source: 'duplicate_detector',
        event_message: `Duplicate detection completed: ${results.length} duplicates found in ${groups.length} groups`,
        event_data: {
          session_id: sessionId,
          duplicates_found: results.length,
          groups_created: groups.length,
          processing_time_seconds: processingTime,
        },
      });

      return results;

    } catch (error) {
      // Mark session as failed
      this.updateSessionStatus(sessionId, 'failed');
      
      await logEvent({
        cooperative_id: session.cooperative_id,
        event_type: 'duplicate_detection_failed',
        event_level: 'error',
        event_source: 'duplicate_detector',
        event_message: `Duplicate detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        event_data: { session_id: sessionId },
      });

      throw error;
    }
  }

  /**
   * Run a specific detection algorithm on two files
   */
  private async runDetectionAlgorithm(
    file1: FileReference,
    file2: FileReference,
    algorithm: DetectionAlgorithm,
    rules: DetectionRules[]
  ): Promise<DetectionResult | null> {
    let similarityScore = 0;
    let confidenceLevel: ConfidenceLevel = 'low';
    let detectionDetails: Record<string, any> = {};
    let comparisonMetrics: Record<string, any> = {};
    let brfMetadataComparison: BRFMetadataComparison | undefined;

    switch (algorithm) {
      case 'md5':
        return await this.runHashComparison(file1, file2, 'md5', rules);
        
      case 'sha256':
        return await this.runHashComparison(file1, file2, 'sha256', rules);
        
      case 'perceptual':
        return await this.runPerceptualComparison(file1, file2, rules);
        
      case 'content':
        return await this.runContentComparison(file1, file2, rules);
        
      case 'metadata':
        return await this.runMetadataComparison(file1, file2, rules);
        
      case 'fuzzy':
        return await this.runFuzzyComparison(file1, file2, rules);
        
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  /**
   * Hash-based duplicate detection (MD5/SHA256)
   */
  private async runHashComparison(
    file1: FileReference,
    file2: FileReference,
    hashType: 'md5' | 'sha256',
    rules: DetectionRules[]
  ): Promise<DetectionResult | null> {
    // Get or calculate hashes
    const hash1 = hashType === 'md5' ? 
      (file1.hash_md5 || await this.calculateFileHash(file1.file_path!, 'md5')) :
      (file1.hash_sha256 || await this.calculateFileHash(file1.file_path!, 'sha256'));
      
    const hash2 = hashType === 'md5' ? 
      (file2.hash_md5 || await this.calculateFileHash(file2.file_path!, 'md5')) :
      (file2.hash_sha256 || await this.calculateFileHash(file2.file_path!, 'sha256'));

    if (hash1 === hash2) {
      // Exact match - run BRF-specific checks
      const brfComparison = await this.runBRFSpecificChecks(file1, file2, rules);
      
      return {
        duplicate_id: uuidv4(),
        original_file: file1,
        duplicate_file: file2,
        algorithm: hashType,
        similarity_score: 1.0,
        confidence_level: 'high',
        recommended_action: this.determineRecommendedAction(file1, file2, 1.0, brfComparison),
        detection_details: {
          hash_type: hashType,
          hash1,
          hash2,
          exact_match: true,
        },
        comparison_metrics: {
          file_size_diff: Math.abs(file1.size_bytes - file2.size_bytes),
          filename_similarity: this.calculateFilenameSimilarity(file1.filename, file2.filename),
        },
        brf_metadata_comparison: brfComparison,
      };
    }

    return null;
  }

  /**
   * Perceptual hash comparison (for images)
   */
  private async runPerceptualComparison(
    file1: FileReference,
    file2: FileReference,
    rules: DetectionRules[]
  ): Promise<DetectionResult | null> {
    // Only run on image files
    if (!this.isImageFile(file1.mime_type) || !this.isImageFile(file2.mime_type)) {
      return null;
    }

    // This would integrate with an image processing library like sharp
    // For now, return a placeholder implementation
    const perceptualSimilarity = await this.calculatePerceptualHash(file1, file2);
    
    if (perceptualSimilarity >= 0.9) {
      const brfComparison = await this.runBRFSpecificChecks(file1, file2, rules);
      
      return {
        duplicate_id: uuidv4(),
        original_file: file1,
        duplicate_file: file2,
        algorithm: 'perceptual',
        similarity_score: perceptualSimilarity,
        confidence_level: perceptualSimilarity >= 0.95 ? 'high' : 'medium',
        recommended_action: this.determineRecommendedAction(file1, file2, perceptualSimilarity, brfComparison),
        detection_details: {
          perceptual_hash_similarity: perceptualSimilarity,
          image_dimensions_match: true, // Placeholder
        },
        comparison_metrics: {
          file_size_diff: Math.abs(file1.size_bytes - file2.size_bytes),
          filename_similarity: this.calculateFilenameSimilarity(file1.filename, file2.filename),
        },
        brf_metadata_comparison: brfComparison,
      };
    }

    return null;
  }

  /**
   * Content-based comparison (OCR text, PDF content)
   */
  private async runContentComparison(
    file1: FileReference,
    file2: FileReference,
    rules: DetectionRules[]
  ): Promise<DetectionResult | null> {
    // Extract text content from files
    const content1 = await this.extractTextContent(file1);
    const content2 = await this.extractTextContent(file2);

    if (!content1 || !content2) {
      return null;
    }

    // Calculate content similarity
    const contentSimilarity = this.calculateTextSimilarity(content1, content2);
    
    if (contentSimilarity >= 0.85) {
      const brfComparison = await this.runBRFSpecificChecks(file1, file2, rules);
      
      return {
        duplicate_id: uuidv4(),
        original_file: file1,
        duplicate_file: file2,
        algorithm: 'content',
        similarity_score: contentSimilarity,
        confidence_level: contentSimilarity >= 0.95 ? 'high' : 'medium',
        recommended_action: this.determineRecommendedAction(file1, file2, contentSimilarity, brfComparison),
        detection_details: {
          content_length_1: content1.length,
          content_length_2: content2.length,
          text_similarity: contentSimilarity,
        },
        comparison_metrics: {
          content_similarity: contentSimilarity,
          filename_similarity: this.calculateFilenameSimilarity(file1.filename, file2.filename),
        },
        brf_metadata_comparison: brfComparison,
      };
    }

    return null;
  }

  /**
   * Metadata-based comparison
   */
  private async runMetadataComparison(
    file1: FileReference,
    file2: FileReference,
    rules: DetectionRules[]
  ): Promise<DetectionResult | null> {
    const metadata1 = await this.extractFileMetadata(file1);
    const metadata2 = await this.extractFileMetadata(file2);

    const metadataSimilarity = this.calculateMetadataSimilarity(metadata1, metadata2);
    
    if (metadataSimilarity >= 0.8) {
      const brfComparison = await this.runBRFSpecificChecks(file1, file2, rules);
      
      return {
        duplicate_id: uuidv4(),
        original_file: file1,
        duplicate_file: file2,
        algorithm: 'metadata',
        similarity_score: metadataSimilarity,
        confidence_level: metadataSimilarity >= 0.9 ? 'high' : 'medium',
        recommended_action: this.determineRecommendedAction(file1, file2, metadataSimilarity, brfComparison),
        detection_details: {
          metadata_fields_compared: Object.keys(metadata1).length,
          matching_fields: this.countMatchingMetadataFields(metadata1, metadata2),
        },
        comparison_metrics: {
          metadata_similarity: metadataSimilarity,
          filename_similarity: this.calculateFilenameSimilarity(file1.filename, file2.filename),
        },
        brf_metadata_comparison: brfComparison,
      };
    }

    return null;
  }

  /**
   * Fuzzy matching (filename, approximate content)
   */
  private async runFuzzyComparison(
    file1: FileReference,
    file2: FileReference,
    rules: DetectionRules[]
  ): Promise<DetectionResult | null> {
    // Calculate fuzzy filename similarity
    const filenameSimilarity = this.calculateFuzzyFilenameSimilarity(file1.filename, file2.filename);
    const sizeSimilarity = this.calculateSizeSimilarity(file1.size_bytes, file2.size_bytes);
    
    // Combine metrics for overall fuzzy score
    const fuzzyScore = (filenameSimilarity * 0.6) + (sizeSimilarity * 0.4);
    
    if (fuzzyScore >= 0.8) {
      const brfComparison = await this.runBRFSpecificChecks(file1, file2, rules);
      
      return {
        duplicate_id: uuidv4(),
        original_file: file1,
        duplicate_file: file2,
        algorithm: 'fuzzy',
        similarity_score: fuzzyScore,
        confidence_level: fuzzyScore >= 0.9 ? 'medium' : 'low',
        recommended_action: this.determineRecommendedAction(file1, file2, fuzzyScore, brfComparison),
        detection_details: {
          filename_similarity: filenameSimilarity,
          size_similarity: sizeSimilarity,
          fuzzy_score: fuzzyScore,
        },
        comparison_metrics: {
          filename_similarity: filenameSimilarity,
          size_difference_bytes: Math.abs(file1.size_bytes - file2.size_bytes),
        },
        brf_metadata_comparison: brfComparison,
      };
    }

    return null;
  }

  /**
   * Run BRF-specific duplicate checks
   */
  private async runBRFSpecificChecks(
    file1: FileReference,
    file2: FileReference,
    rules: DetectionRules[]
  ): Promise<BRFMetadataComparison> {
    const comparison: BRFMetadataComparison = {};

    // Get BRF-specific metadata
    const metadata1 = await this.extractBRFMetadata(file1);
    const metadata2 = await this.extractBRFMetadata(file2);

    // Check invoice numbers
    if (this.shouldCheckBRFField('check_invoice_numbers', rules)) {
      comparison.invoice_number_match = metadata1.invoice_number === metadata2.invoice_number;
    }

    // Check meeting dates
    if (this.shouldCheckBRFField('check_meeting_dates', rules)) {
      comparison.meeting_date_match = metadata1.meeting_date === metadata2.meeting_date;
    }

    // Check contractor names
    if (this.shouldCheckBRFField('check_contractor_names', rules)) {
      comparison.contractor_match = this.fuzzyMatchContractorNames(
        metadata1.contractor_name,
        metadata2.contractor_name
      );
    }

    // Check apartment references
    if (this.shouldCheckBRFField('check_apartment_references', rules)) {
      comparison.apartment_reference_match = metadata1.apartment_reference === metadata2.apartment_reference;
    }

    return comparison;
  }

  /**
   * Create duplicate groups from detection results
   */
  private async createDuplicateGroups(sessionId: string, results: DetectionResult[]): Promise<DuplicateGroup[]> {
    if (results.length === 0) return [];

    // Group files by similarity clusters
    const fileGroups = new Map<string, Set<string>>();
    const fileReferences = new Map<string, FileReference>();

    for (const result of results) {
      const originalId = result.original_file.id;
      const duplicateId = result.duplicate_file.id;
      
      fileReferences.set(originalId, result.original_file);
      fileReferences.set(duplicateId, result.duplicate_file);

      // Find existing group or create new one
      let groupKey = originalId;
      for (const [key, group] of fileGroups) {
        if (group.has(originalId) || group.has(duplicateId)) {
          groupKey = key;
          break;
        }
      }

      if (!fileGroups.has(groupKey)) {
        fileGroups.set(groupKey, new Set([originalId]));
      }
      
      fileGroups.get(groupKey)!.add(duplicateId);
    }

    // Create database entries for groups
    const groups: DuplicateGroup[] = [];
    for (const [masterFileId, memberIds] of fileGroups) {
      if (memberIds.size < 2) continue; // Need at least 2 files for a group

      const groupId = uuidv4();
      const masterFile = fileReferences.get(masterFileId)!;
      const memberFiles = Array.from(memberIds).map(id => fileReferences.get(id)!);
      
      const totalSize = memberFiles.reduce((sum, file) => sum + file.size_bytes, 0);
      const groupType = this.determineGroupType(results.filter(r => 
        memberIds.has(r.original_file.id) && memberIds.has(r.duplicate_file.id)
      ));

      // Determine best master file
      const recommendedMasterId = this.selectBestMasterFile(memberFiles);
      const resolutionStrategy = this.determineResolutionStrategy(memberFiles);
      
      const group: DuplicateGroup = {
        id: groupId,
        group_name: `Duplicate Group - ${masterFile.filename}`,
        group_type: groupType,
        master_file: masterFile,
        member_files: memberFiles,
        total_files: memberFiles.length,
        total_size_bytes: totalSize,
        recommended_master_id: recommendedMasterId,
        resolution_strategy: resolutionStrategy,
        auto_resolvable: this.isAutoResolvable(memberFiles, resolutionStrategy),
        group_quality_score: this.calculateGroupQualityScore(memberFiles),
        confidence_score: this.calculateGroupConfidenceScore(results, memberIds),
      };

      // Save group to database
      await this.saveDuplicateGroup(sessionId, group);
      groups.push(group);
    }

    return groups;
  }

  /**
   * Helper methods for file operations
   */
  private async calculateFileHash(filePath: string, algorithm: 'md5' | 'sha256'): Promise<string> {
    try {
      const fileBuffer = await readFile(filePath);
      const hash = createHash(algorithm);
      hash.update(fileBuffer);
      return hash.digest('hex');
    } catch (error) {
      console.error(`Failed to calculate ${algorithm} hash for ${filePath}:`, error);
      return '';
    }
  }

  private async calculatePerceptualHash(file1: FileReference, file2: FileReference): Promise<number> {
    // Placeholder implementation - would use image processing library
    // For now, return a random similarity for demonstration
    return Math.random() * 0.3 + 0.7; // Random value between 0.7-1.0
  }

  private async extractTextContent(file: FileReference): Promise<string | null> {
    // Placeholder - would integrate with OCR service or PDF text extraction
    return null;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple implementation using Levenshtein distance
    const maxLength = Math.max(text1.length, text2.length);
    if (maxLength === 0) return 1.0;
    
    const distance = this.levenshteinDistance(text1, text2);
    return 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateFilenameSimilarity(filename1: string, filename2: string): number {
    // Remove extensions and normalize
    const name1 = filename1.toLowerCase().replace(/\.[^/.]+$/, '');
    const name2 = filename2.toLowerCase().replace(/\.[^/.]+$/, '');
    
    return this.calculateTextSimilarity(name1, name2);
  }

  private calculateFuzzyFilenameSimilarity(filename1: string, filename2: string): number {
    // More sophisticated fuzzy matching
    const similarity = this.calculateFilenameSimilarity(filename1, filename2);
    
    // Bonus for same extensions
    const ext1 = filename1.split('.').pop() || '';
    const ext2 = filename2.split('.').pop() || '';
    const extBonus = ext1 === ext2 ? 0.1 : 0;
    
    return Math.min(1.0, similarity + extBonus);
  }

  private calculateSizeSimilarity(size1: number, size2: number): number {
    const larger = Math.max(size1, size2);
    const smaller = Math.min(size1, size2);
    
    if (larger === 0) return 1.0;
    return smaller / larger;
  }

  private async extractFileMetadata(file: FileReference): Promise<Record<string, any>> {
    // Placeholder - would extract EXIF, PDF metadata, etc.
    return {
      filename: file.filename,
      size: file.size_bytes,
      mime_type: file.mime_type,
      created_at: file.created_at,
    };
  }

  private calculateMetadataSimilarity(metadata1: Record<string, any>, metadata2: Record<string, any>): number {
    const keys1 = Object.keys(metadata1);
    const keys2 = Object.keys(metadata2);
    const allKeys = new Set([...keys1, ...keys2]);
    
    let matches = 0;
    for (const key of allKeys) {
      if (metadata1[key] === metadata2[key]) {
        matches++;
      }
    }
    
    return matches / allKeys.size;
  }

  private countMatchingMetadataFields(metadata1: Record<string, any>, metadata2: Record<string, any>): number {
    const keys1 = Object.keys(metadata1);
    const keys2 = Object.keys(metadata2);
    const commonKeys = keys1.filter(key => keys2.includes(key));
    
    return commonKeys.filter(key => metadata1[key] === metadata2[key]).length;
  }

  private isImageFile(mimeType?: string): boolean {
    return mimeType?.startsWith('image/') || false;
  }

  private async extractBRFMetadata(file: FileReference): Promise<{
    invoice_number?: string;
    meeting_date?: string;
    contractor_name?: string;
    apartment_reference?: string;
  }> {
    // Placeholder - would extract BRF-specific metadata from documents
    return {};
  }

  private shouldCheckBRFField(field: keyof DetectionRules['brf_specific_checks'], rules: DetectionRules[]): boolean {
    return rules.some(rule => rule.is_active && rule.brf_specific_checks[field]);
  }

  private fuzzyMatchContractorNames(name1?: string, name2?: string): boolean {
    if (!name1 || !name2) return false;
    
    // Normalize names
    const normalized1 = name1.toLowerCase().trim();
    const normalized2 = name2.toLowerCase().trim();
    
    // Exact match
    if (normalized1 === normalized2) return true;
    
    // Fuzzy match with threshold
    const similarity = this.calculateTextSimilarity(normalized1, normalized2);
    return similarity >= 0.8;
  }

  private determineRecommendedAction(
    file1: FileReference,
    file2: FileReference,
    similarityScore: number,
    brfComparison?: BRFMetadataComparison
  ): RecommendedAction {
    // Keep newest if creation dates differ significantly
    const date1 = new Date(file1.created_at);
    const date2 = new Date(file2.created_at);
    const daysDiff = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 1) {
      return date1 > date2 ? 'keep_original' : 'keep_duplicate';
    }
    
    // Keep larger file if size differs significantly
    const sizeDiff = Math.abs(file1.size_bytes - file2.size_bytes);
    if (sizeDiff > file1.size_bytes * 0.1) { // 10% difference
      return file1.size_bytes > file2.size_bytes ? 'keep_original' : 'keep_duplicate';
    }
    
    // If very high similarity, keep original
    if (similarityScore >= 0.99) {
      return 'keep_original';
    }
    
    // Default to manual review for complex cases
    return 'manual_review';
  }

  private shouldCompareFiles(file1: FileReference, file2: FileReference, rules: DetectionRules[]): boolean {
    for (const rule of rules) {
      if (!rule.is_active) continue;
      
      // Check file type filters
      if (rule.file_types.length > 0) {
        const ext1 = file1.filename.split('.').pop()?.toLowerCase() || '';
        const ext2 = file2.filename.split('.').pop()?.toLowerCase() || '';
        
        if (!rule.file_types.includes(ext1) || !rule.file_types.includes(ext2)) {
          continue;
        }
      }
      
      // Check size filters
      if (rule.min_file_size_bytes > 0 && (file1.size_bytes < rule.min_file_size_bytes || file2.size_bytes < rule.min_file_size_bytes)) {
        continue;
      }
      
      if (rule.max_file_size_bytes > 0 && (file1.size_bytes > rule.max_file_size_bytes || file2.size_bytes > rule.max_file_size_bytes)) {
        continue;
      }
      
      // At least one rule allows this comparison
      return true;
    }
    
    return rules.length === 0; // If no rules, allow all comparisons
  }

  private getActiveDetectionRules(cooperativeId: string): DetectionRules[] {
    const stmt = this.db.prepare(`
      SELECT * FROM duplicate_detection_rules 
      WHERE cooperative_id = ? AND is_active = 1 
      ORDER BY priority DESC
    `);
    
    const rows = stmt.all(cooperativeId);
    
    return rows.map(row => ({
      id: row.id,
      cooperative_id: row.cooperative_id,
      rule_name: row.rule_name,
      is_active: row.is_active === 1,
      priority: row.priority,
      algorithms: JSON.parse(row.algorithms || '["md5", "sha256"]'),
      similarity_threshold: row.similarity_threshold,
      confidence_threshold: row.confidence_threshold,
      file_types: JSON.parse(row.file_types || '[]'),
      document_types: JSON.parse(row.document_types || '[]'),
      min_file_size_bytes: row.min_file_size_bytes,
      max_file_size_bytes: row.max_file_size_bytes,
      brf_specific_checks: {
        check_invoice_numbers: row.check_invoice_numbers === 1,
        check_meeting_dates: row.check_meeting_dates === 1,
        check_contractor_names: row.check_contractor_names === 1,
        check_apartment_references: row.check_apartment_references === 1,
      },
      auto_resolve: row.auto_resolve === 1,
      auto_resolution_action: row.auto_resolution_action,
    }));
  }

  private getDefaultAlgorithms(rules: DetectionRules[]): DetectionAlgorithm[] {
    if (rules.length === 0) {
      return ['md5', 'sha256'];
    }
    
    // Combine algorithms from all active rules
    const algorithms = new Set<DetectionAlgorithm>();
    for (const rule of rules) {
      rule.algorithms.forEach(alg => algorithms.add(alg));
    }
    
    return Array.from(algorithms);
  }

  private async getFilesForDetection(session: DetectionSession): Promise<FileReference[]> {
    let query = '';
    const params: any[] = [session.cooperative_id];
    
    if (session.batch_id) {
      // Get files from a specific batch
      query = `
        SELECT 
          bf.id, 'upload_file' as type, bf.original_filename as filename,
          bf.temp_file_path as file_path, bf.file_size_bytes as size_bytes,
          bf.mime_type, bf.file_hash_md5 as hash_md5, bf.file_hash_sha256 as hash_sha256,
          NULL as document_type, bf.created_at
        FROM bulk_upload_files bf
        WHERE bf.cooperative_id = ? AND bf.batch_id = ?
      `;
      params.push(session.batch_id);
    } else {
      // Get all documents for the cooperative
      query = `
        SELECT 
          d.id, 'document' as type, d.filename, d.file_path,
          d.size_bytes, d.mime_type, NULL as hash_md5, NULL as hash_sha256,
          d.document_type, d.created_at
        FROM documents d
        WHERE d.cooperative_id = ?
        UNION ALL
        SELECT 
          bf.id, 'upload_file' as type, bf.original_filename as filename,
          bf.temp_file_path as file_path, bf.file_size_bytes as size_bytes,
          bf.mime_type, bf.file_hash_md5 as hash_md5, bf.file_hash_sha256 as hash_sha256,
          NULL as document_type, bf.created_at
        FROM bulk_upload_files bf
        WHERE bf.cooperative_id = ?
      `;
      params.push(session.cooperative_id);
    }
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    
    return rows.map(row => ({
      id: row.id,
      type: row.type as 'document' | 'upload_file',
      filename: row.filename,
      file_path: row.file_path,
      size_bytes: row.size_bytes,
      mime_type: row.mime_type,
      hash_md5: row.hash_md5,
      hash_sha256: row.hash_sha256,
      document_type: row.document_type,
      created_at: row.created_at,
    }));
  }

  private getDetectionSession(sessionId: string): DetectionSession | null {
    const stmt = this.db.prepare('SELECT * FROM duplicate_detection_sessions WHERE id = ?');
    const row = stmt.get(sessionId);
    
    if (!row) return null;
    
    return {
      id: row.id,
      cooperative_id: row.cooperative_id,
      batch_id: row.batch_id,
      session_type: row.session_type,
      session_status: row.session_status,
      total_files_scanned: row.total_files_scanned,
      duplicate_groups_found: row.duplicate_groups_found,
      total_duplicates_found: row.total_duplicates_found,
      false_positives_found: row.false_positives_found,
      algorithms_used: JSON.parse(row.algorithms_used || '[]'),
      processing_time_seconds: row.processing_time_seconds,
      started_at: row.started_at,
      completed_at: row.completed_at,
    };
  }

  private updateSessionStatus(sessionId: string, status: DetectionSession['session_status'], completedAt?: string): void {
    const stmt = this.db.prepare(`
      UPDATE duplicate_detection_sessions 
      SET session_status = ?, completed_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    
    stmt.run(status, completedAt, sessionId);
  }

  private updateSessionProgress(sessionId: string, progress: Partial<DetectionSession>): void {
    const updates = [];
    const params = [];
    
    if (progress.total_files_scanned !== undefined) {
      updates.push('total_files_scanned = ?');
      params.push(progress.total_files_scanned);
    }
    
    if (progress.duplicate_groups_found !== undefined) {
      updates.push('duplicate_groups_found = ?');
      params.push(progress.duplicate_groups_found);
    }
    
    if (progress.total_duplicates_found !== undefined) {
      updates.push('total_duplicates_found = ?');
      params.push(progress.total_duplicates_found);
    }
    
    if (progress.processing_time_seconds !== undefined) {
      updates.push('processing_time_seconds = ?');
      params.push(progress.processing_time_seconds);
    }
    
    if (updates.length === 0) return;
    
    params.push(sessionId);
    
    const stmt = this.db.prepare(`
      UPDATE duplicate_detection_sessions 
      SET ${updates.join(', ')}, updated_at = datetime('now')
      WHERE id = ?
    `);
    
    stmt.run(...params);
  }

  private async saveDuplicateResult(result: DetectionResult): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO file_duplicates (
        id, cooperative_id, original_file_id, duplicate_file_id,
        original_file_type, duplicate_file_type, detection_algorithm,
        similarity_score, confidence_level, original_hash_md5, duplicate_hash_md5,
        original_hash_sha256, duplicate_hash_sha256, original_size_bytes, duplicate_size_bytes,
        original_filename, duplicate_filename, original_document_type, duplicate_document_type,
        metadata_similarity, content_similarity, recommended_action,
        detection_details, comparison_metrics, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const brfComparison = result.brf_metadata_comparison;
    
    stmt.run(
      result.duplicate_id,
      result.original_file.type === 'document' ? 
        await this.getCooperativeIdFromDocument(result.original_file.id) :
        await this.getCooperativeIdFromUploadFile(result.original_file.id),
      result.original_file.id,
      result.duplicate_file.id,
      result.original_file.type,
      result.duplicate_file.type,
      result.algorithm,
      result.similarity_score,
      result.confidence_level,
      result.original_file.hash_md5,
      result.duplicate_file.hash_md5,
      result.original_file.hash_sha256,
      result.duplicate_file.hash_sha256,
      result.original_file.size_bytes,
      result.duplicate_file.size_bytes,
      result.original_file.filename,
      result.duplicate_file.filename,
      result.original_file.document_type,
      result.duplicate_file.document_type,
      brfComparison?.metadata_similarity || 0.0,
      brfComparison?.content_similarity || 0.0,
      result.recommended_action,
      JSON.stringify(result.detection_details),
      JSON.stringify(result.comparison_metrics),
      new Date().toISOString(),
      new Date().toISOString()
    );
  }

  private async saveDuplicateGroup(sessionId: string, group: DuplicateGroup): Promise<void> {
    const cooperativeId = group.master_file.type === 'document' ? 
      await this.getCooperativeIdFromDocument(group.master_file.id) :
      await this.getCooperativeIdFromUploadFile(group.master_file.id);
    
    // Save group
    const groupStmt = this.db.prepare(`
      INSERT INTO duplicate_groups (
        id, cooperative_id, detection_session_id, group_name, group_type,
        master_file_id, master_file_type, total_files, total_size_bytes,
        oldest_file_date, newest_file_date, recommended_master_id,
        resolution_strategy, auto_resolvable, group_quality_score,
        confidence_score, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const dates = group.member_files.map(f => new Date(f.created_at));
    const oldestDate = new Date(Math.min(...dates.map(d => d.getTime()))).toISOString();
    const newestDate = new Date(Math.max(...dates.map(d => d.getTime()))).toISOString();

    groupStmt.run(
      group.id,
      cooperativeId,
      sessionId,
      group.group_name,
      group.group_type,
      group.master_file.id,
      group.master_file.type,
      group.total_files,
      group.total_size_bytes,
      oldestDate,
      newestDate,
      group.recommended_master_id,
      group.resolution_strategy,
      group.auto_resolvable ? 1 : 0,
      group.group_quality_score,
      group.confidence_score,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Save group members
    const memberStmt = this.db.prepare(`
      INSERT INTO duplicate_group_members (
        id, group_id, cooperative_id, file_id, file_type, filename,
        file_size_bytes, file_hash_md5, file_hash_sha256, mime_type,
        quality_score, is_master, document_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const file of group.member_files) {
      memberStmt.run(
        uuidv4(),
        group.id,
        cooperativeId,
        file.id,
        file.type,
        file.filename,
        file.size_bytes,
        file.hash_md5,
        file.hash_sha256,
        file.mime_type,
        this.calculateFileQualityScore(file),
        file.id === group.master_file.id ? 1 : 0,
        file.document_type,
        new Date().toISOString(),
        new Date().toISOString()
      );
    }
  }

  private async getCooperativeIdFromDocument(documentId: string): Promise<string> {
    const stmt = this.db.prepare('SELECT cooperative_id FROM documents WHERE id = ?');
    const row = stmt.get(documentId);
    return row?.cooperative_id || '';
  }

  private async getCooperativeIdFromUploadFile(fileId: string): Promise<string> {
    const stmt = this.db.prepare('SELECT cooperative_id FROM bulk_upload_files WHERE id = ?');
    const row = stmt.get(fileId);
    return row?.cooperative_id || '';
  }

  private determineGroupType(results: DetectionResult[]): DuplicateGroup['group_type'] {
    if (results.some(r => r.similarity_score === 1.0 && r.algorithm === 'md5')) {
      return 'exact';
    }
    
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity_score, 0) / results.length;
    if (avgSimilarity >= 0.95) return 'similar';
    if (avgSimilarity >= 0.8) return 'related';
    return 'fuzzy';
  }

  private selectBestMasterFile(files: FileReference[]): string {
    // Prefer larger files, newer files, and better filenames
    let bestFile = files[0];
    let bestScore = this.calculateFileQualityScore(bestFile);

    for (const file of files.slice(1)) {
      const score = this.calculateFileQualityScore(file);
      if (score > bestScore) {
        bestScore = score;
        bestFile = file;
      }
    }

    return bestFile.id;
  }

  private calculateFileQualityScore(file: FileReference): number {
    let score = 0;
    
    // Size factor (larger is better)
    score += Math.log(file.size_bytes + 1) / 20;
    
    // Filename quality (prefer descriptive names)
    const filenameLength = file.filename.replace(/\.[^/.]+$/, '').length;
    score += Math.min(filenameLength / 50, 1);
    
    // Recency factor (newer is better)
    const ageMs = Date.now() - new Date(file.created_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    score += Math.max(0, 1 - (ageDays / 365)); // Decay over a year
    
    return Math.min(score, 10); // Cap at 10
  }

  private determineResolutionStrategy(files: FileReference[]): string {
    if (files.length === 2) {
      const sizeDiff = Math.abs(files[0].size_bytes - files[1].size_bytes);
      const avgSize = (files[0].size_bytes + files[1].size_bytes) / 2;
      
      if (sizeDiff > avgSize * 0.1) {
        return 'keep_largest';
      }
      
      const timeDiff = Math.abs(new Date(files[0].created_at).getTime() - new Date(files[1].created_at).getTime());
      if (timeDiff > 1000 * 60 * 60 * 24) { // 1 day
        return 'keep_newest';
      }
    }
    
    return 'keep_master';
  }

  private isAutoResolvable(files: FileReference[], strategy: string): boolean {
    // Only auto-resolve if files are very similar and strategy is clear
    return strategy !== 'manual' && files.length <= 3;
  }

  private calculateGroupQualityScore(files: FileReference[]): number {
    return files.reduce((sum, file) => sum + this.calculateFileQualityScore(file), 0) / files.length;
  }

  private calculateGroupConfidenceScore(results: DetectionResult[], memberIds: Set<string>): number {
    const relevantResults = results.filter(r => 
      memberIds.has(r.original_file.id) && memberIds.has(r.duplicate_file.id)
    );
    
    if (relevantResults.length === 0) return 0;
    
    const avgSimilarity = relevantResults.reduce((sum, r) => sum + r.similarity_score, 0) / relevantResults.length;
    const highConfidenceCount = relevantResults.filter(r => r.confidence_level === 'high').length;
    const confidenceBonus = highConfidenceCount / relevantResults.length * 0.2;
    
    return Math.min(1.0, avgSimilarity + confidenceBonus);
  }

  /**
   * Get duplicate detection results for a cooperative
   */
  getDuplicatesForCooperative(
    cooperativeId: string,
    options?: {
      status?: string;
      algorithm?: DetectionAlgorithm;
      confidence_level?: ConfidenceLevel;
      limit?: number;
      offset?: number;
    }
  ): DetectionResult[] {
    let whereClause = 'WHERE fd.cooperative_id = ?';
    const params: any[] = [cooperativeId];
    
    if (options?.status) {
      whereClause += ' AND fd.status = ?';
      params.push(options.status);
    }
    
    if (options?.algorithm) {
      whereClause += ' AND fd.detection_algorithm = ?';
      params.push(options.algorithm);
    }
    
    if (options?.confidence_level) {
      whereClause += ' AND fd.confidence_level = ?';
      params.push(options.confidence_level);
    }
    
    const stmt = this.db.prepare(`
      SELECT fd.* FROM file_duplicates fd
      ${whereClause}
      ORDER BY fd.similarity_score DESC, fd.created_at DESC
      LIMIT ${options?.limit || 50} OFFSET ${options?.offset || 0}
    `);
    
    const rows = stmt.all(...params);
    
    // Convert to DetectionResult format (simplified)
    return rows.map(row => ({
      duplicate_id: row.id,
      original_file: {
        id: row.original_file_id,
        type: row.original_file_type,
        filename: row.original_filename,
        size_bytes: row.original_size_bytes,
        hash_md5: row.original_hash_md5,
        hash_sha256: row.original_hash_sha256,
        document_type: row.original_document_type,
        created_at: row.created_at,
      } as FileReference,
      duplicate_file: {
        id: row.duplicate_file_id,
        type: row.duplicate_file_type,
        filename: row.duplicate_filename,
        size_bytes: row.duplicate_size_bytes,
        hash_md5: row.duplicate_hash_md5,
        hash_sha256: row.duplicate_hash_sha256,
        document_type: row.duplicate_document_type,
        created_at: row.created_at,
      } as FileReference,
      algorithm: row.detection_algorithm,
      similarity_score: row.similarity_score,
      confidence_level: row.confidence_level,
      recommended_action: row.recommended_action,
      detection_details: JSON.parse(row.detection_details || '{}'),
      comparison_metrics: JSON.parse(row.comparison_metrics || '{}'),
      brf_metadata_comparison: {
        metadata_similarity: row.metadata_similarity,
        content_similarity: row.content_similarity,
      },
    }));
  }

  /**
   * Get duplicate groups for a cooperative
   */
  getDuplicateGroups(
    cooperativeId: string,
    options?: {
      resolution_status?: string;
      group_type?: string;
      limit?: number;
      offset?: number;
    }
  ): DuplicateGroup[] {
    let whereClause = 'WHERE dg.cooperative_id = ?';
    const params: any[] = [cooperativeId];
    
    if (options?.resolution_status) {
      whereClause += ' AND dg.resolution_status = ?';
      params.push(options.resolution_status);
    }
    
    if (options?.group_type) {
      whereClause += ' AND dg.group_type = ?';
      params.push(options.group_type);
    }
    
    const stmt = this.db.prepare(`
      SELECT dg.* FROM duplicate_groups dg
      ${whereClause}
      ORDER BY dg.confidence_score DESC, dg.created_at DESC
      LIMIT ${options?.limit || 50} OFFSET ${options?.offset || 0}
    `);
    
    const rows = stmt.all(...params);
    
    // Get group members
    return rows.map(row => {
      const membersStmt = this.db.prepare(`
        SELECT * FROM duplicate_group_members 
        WHERE group_id = ? 
        ORDER BY is_master DESC, quality_score DESC
      `);
      
      const memberRows = membersStmt.all(row.id);
      const members = memberRows.map(member => ({
        id: member.file_id,
        type: member.file_type,
        filename: member.filename,
        size_bytes: member.file_size_bytes,
        hash_md5: member.file_hash_md5,
        hash_sha256: member.file_hash_sha256,
        mime_type: member.mime_type,
        document_type: member.document_type,
        created_at: member.created_at,
      } as FileReference));
      
      const masterFile = members.find(m => m.id === row.master_file_id) || members[0];
      
      return {
        id: row.id,
        group_name: row.group_name,
        group_type: row.group_type,
        master_file: masterFile,
        member_files: members,
        total_files: row.total_files,
        total_size_bytes: row.total_size_bytes,
        recommended_master_id: row.recommended_master_id,
        resolution_strategy: row.resolution_strategy,
        auto_resolvable: row.auto_resolvable === 1,
        group_quality_score: row.group_quality_score,
        confidence_score: row.confidence_score,
      };
    });
  }

  /**
   * Resolve a duplicate by taking an action
   */
  async resolveDuplicate(
    duplicateId: string,
    action: ResolutionAction,
    resolvedBy?: string,
    reason?: string
  ): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE file_duplicates 
      SET status = 'resolved', resolution_action = ?, resolution_reason = ?,
          resolved_by = ?, resolved_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `);
    
    const result = stmt.run(action, reason, resolvedBy, duplicateId);
    
    if (result.changes > 0) {
      // Get duplicate info for logging
      const duplicate = this.db.prepare('SELECT * FROM file_duplicates WHERE id = ?').get(duplicateId);
      if (duplicate) {
        await logEvent({
          cooperative_id: duplicate.cooperative_id,
          event_type: 'duplicate_resolved',
          event_level: 'info',
          event_source: 'duplicate_detector',
          event_message: `Duplicate resolved with action: ${action}`,
          user_id: resolvedBy,
          event_data: { duplicate_id: duplicateId, action, reason },
        });
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Create or update detection rules for a cooperative
   */
  async saveDetectionRules(rules: Omit<DetectionRules, 'id'>): Promise<string> {
    const ruleId = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO duplicate_detection_rules (
        id, cooperative_id, rule_name, rule_description, is_active, priority,
        algorithms, similarity_threshold, confidence_threshold, file_types, document_types,
        min_file_size_bytes, max_file_size_bytes, check_invoice_numbers, check_meeting_dates,
        check_contractor_names, check_apartment_references, auto_resolve, auto_resolution_action,
        auto_resolution_conditions, notify_on_detection, notify_users, notification_threshold,
        created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      ruleId,
      rules.cooperative_id,
      rules.rule_name,
      '', // rule_description
      rules.is_active ? 1 : 0,
      rules.priority,
      JSON.stringify(rules.algorithms),
      rules.similarity_threshold,
      rules.confidence_threshold,
      JSON.stringify(rules.file_types),
      JSON.stringify(rules.document_types),
      rules.min_file_size_bytes,
      rules.max_file_size_bytes,
      rules.brf_specific_checks.check_invoice_numbers ? 1 : 0,
      rules.brf_specific_checks.check_meeting_dates ? 1 : 0,
      rules.brf_specific_checks.check_contractor_names ? 1 : 0,
      rules.brf_specific_checks.check_apartment_references ? 1 : 0,
      rules.auto_resolve ? 1 : 0,
      rules.auto_resolution_action,
      '{}', // auto_resolution_conditions
      true, // notify_on_detection
      '[]', // notify_users
      1, // notification_threshold
      now,
      now,
      null // created_by
    );
    
    return ruleId;
  }

  /**
   * Get detection statistics for a cooperative
   */
  getDetectionStats(cooperativeId: string, dateFrom?: string, dateTo?: string): {
    total_files_scanned: number;
    duplicates_detected: number;
    duplicate_groups_created: number;
    false_positives: number;
    auto_resolved: number;
    manually_resolved: number;
    storage_saved_bytes: number;
    most_effective_algorithm: string;
    average_similarity_score: number;
  } {
    let whereClause = 'WHERE cooperative_id = ?';
    const params: any[] = [cooperativeId];
    
    if (dateFrom) {
      whereClause += ' AND stats_date >= ?';
      params.push(dateFrom);
    }
    
    if (dateTo) {
      whereClause += ' AND stats_date <= ?';
      params.push(dateTo);
    }
    
    const stmt = this.db.prepare(`
      SELECT 
        SUM(files_scanned) as total_files_scanned,
        SUM(duplicates_detected) as duplicates_detected,
        SUM(duplicate_groups_created) as duplicate_groups_created,
        SUM(false_positives) as false_positives,
        SUM(auto_resolved) as auto_resolved,
        SUM(manually_resolved) as manually_resolved,
        SUM(storage_saved_bytes) as storage_saved_bytes,
        AVG(average_similarity_score) as average_similarity_score,
        most_effective_algorithm
      FROM duplicate_detection_stats
      ${whereClause}
    `);
    
    const result = stmt.get(...params);
    
    return {
      total_files_scanned: result?.total_files_scanned || 0,
      duplicates_detected: result?.duplicates_detected || 0,
      duplicate_groups_created: result?.duplicate_groups_created || 0,
      false_positives: result?.false_positives || 0,
      auto_resolved: result?.auto_resolved || 0,
      manually_resolved: result?.manually_resolved || 0,
      storage_saved_bytes: result?.storage_saved_bytes || 0,
      most_effective_algorithm: result?.most_effective_algorithm || 'md5',
      average_similarity_score: result?.average_similarity_score || 0,
    };
  }
}

export default DuplicateDetector;