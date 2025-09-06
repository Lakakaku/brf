/**
 * Member Data Generator
 * 
 * Generates realistic Swedish BRF member data with authentic names,
 * contact information, roles, and membership patterns typical of
 * Swedish cooperative housing organizations.
 */

import { BaseDataGenerator, DataConstraints, EntityValidator, ValidationResult } from './base-generator';
import { 
  getRandomSwedishName,
  generateRealisticEmail,
  generateSwedishPhoneNumber,
  BRF_TERMINOLOGY,
  SwedishName
} from '../data-sources/swedish-data';

export interface MemberData {
  id: string;
  user_id?: string; // Optional for SQLite
  cooperative_id: string;
  
  // Authentication
  email: string;
  password_hash?: string;
  
  // Personal information
  first_name: string;
  last_name: string;
  phone?: string;
  
  // Role and permissions
  role: 'member' | 'board' | 'chairman' | 'treasurer' | 'admin';
  permissions: string; // JSON
  
  // Status
  is_active: number; // Boolean as number
  
  // Metadata
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  deleted_at?: string;
}

export interface MemberGenerationOptions {
  cooperativeIds: string[]; // Required list of cooperative IDs
  
  // Role distribution
  roleDistribution?: {
    member: number;
    board: number;
    chairman: number;
    treasurer: number;
    admin: number;
  };
  
  // Activity patterns
  activityDistribution?: {
    active: number;
    inactive: number;
    occasional: number;
  };
  
  // Contact information completeness
  contactCompleteness?: {
    phone: number; // Percentage with phone numbers
    recentLogin: number; // Percentage with recent logins
  };
  
  // Email domain distribution
  emailDomains?: {
    personal: string[];
    weights?: number[];
  };
  
  // Authentication realism
  includePasswordHashes?: boolean;
  includeLastLogin?: boolean;
}

export class MemberValidator implements EntityValidator<MemberData> {
  validate(data: MemberData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!data.cooperative_id) errors.push('Cooperative ID is required');
    if (!data.email) errors.push('Email is required');
    if (!data.first_name) errors.push('First name is required');
    if (!data.last_name) errors.push('Last name is required');
    if (!data.role) errors.push('Role is required');
    
    // Email format validation
    if (data.email && !/^[^@]+@[^@]+\.[^@]+$/.test(data.email)) {
      errors.push('Invalid email format');
    }
    
    // Role validation
    const validRoles = ['member', 'board', 'chairman', 'treasurer', 'admin'];
    if (data.role && !validRoles.includes(data.role)) {
      errors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
    
    // Phone format validation (Swedish format)
    if (data.phone && !/^(07[0-9]|08|09[0-9])-?\d{3,4}\s?\d{2,4}$/.test(data.phone.replace(/\s|-/g, ''))) {
      warnings.push('Phone number format may not be valid Swedish format');
    }
    
    // Name validation
    if (data.first_name && data.first_name.length < 2) {
      warnings.push('First name seems very short');
    }
    if (data.last_name && data.last_name.length < 2) {
      warnings.push('Last name seems very short');
    }
    
    // JSON validation
    try {
      if (data.permissions) JSON.parse(data.permissions);
    } catch (e) {
      errors.push('Invalid JSON in permissions field');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  sanitize(data: MemberData): MemberData {
    return {
      ...data,
      email: data.email?.toLowerCase().trim(),
      first_name: data.first_name?.trim(),
      last_name: data.last_name?.trim(),
      phone: data.phone?.trim(),
      is_active: Number(data.is_active) || 1
    };
  }
}

export class MemberDataGenerator extends BaseDataGenerator<MemberData> {
  private options: MemberGenerationOptions;
  private emails: Set<string> = new Set();
  private cooperativeRoleCounts: Map<string, Map<string, number>> = new Map();

  constructor(
    cooperativeIds: string[],
    seed?: string,
    options: Partial<MemberGenerationOptions> = {},
    validator?: EntityValidator<MemberData>
  ) {
    if (!cooperativeIds || cooperativeIds.length === 0) {
      throw new Error('At least one cooperative ID is required');
    }

    const constraints: DataConstraints = {
      unique: ['email'],
      required: ['cooperative_id', 'email', 'first_name', 'last_name', 'role'],
      patterns: {
        email: /^[^@]+@[^@]+\.[^@]+$/,
        phone: /^(07[0-9]|08|09[0-9])-?\d{3,4}\s?\d{2,4}$/
      }
    };

    super(seed, constraints, validator || new MemberValidator());
    
    this.options = {
      cooperativeIds,
      roleDistribution: {
        member: 0.82,     // 82%
        board: 0.12,      // 12%
        chairman: 0.02,   // 2%
        treasurer: 0.02,  // 2%
        admin: 0.02       // 2%
      },
      activityDistribution: {
        active: 0.70,     // 70%
        inactive: 0.15,   // 15%
        occasional: 0.15  // 15%
      },
      contactCompleteness: {
        phone: 0.85,      // 85% have phone numbers
        recentLogin: 0.60 // 60% have logged in recently
      },
      emailDomains: {
        personal: [
          'gmail.com', 'hotmail.com', 'yahoo.se', 'outlook.com', 'telia.com',
          'spray.se', 'bredband.net', 'bahnhof.se', 'comhem.se', 'tele2.se'
        ]
      },
      includePasswordHashes: false,
      includeLastLogin: true,
      ...options
    };

    // Initialize role tracking for each cooperative
    for (const cooperativeId of this.options.cooperativeIds) {
      this.cooperativeRoleCounts.set(cooperativeId, new Map());
    }
  }

  generateSingle(context?: any): MemberData {
    const cooperativeId = this.selectCooperativeId(context);
    const name = getRandomSwedishName();
    const role = this.generateRole(cooperativeId);
    const email = this.generateUniqueEmail(name.first, name.last);
    const activityLevel = this.generateActivityLevel();

    const data: MemberData = {
      id: this.generateId(),
      cooperative_id: cooperativeId,
      
      // Authentication
      email,
      password_hash: this.options.includePasswordHashes ? this.generatePasswordHash() : undefined,
      
      // Personal information
      first_name: name.first,
      last_name: name.last,
      phone: this.generatePhone(),
      
      // Role and permissions
      role,
      permissions: this.generatePermissions(role),
      
      // Status
      is_active: activityLevel === 'inactive' ? 0 : 1,
      
      // Metadata
      created_at: this.generateCreatedDate(),
      updated_at: this.generateUpdatedDate(),
      last_login_at: this.generateLastLogin(activityLevel)
    };

    // Track role assignment
    this.trackRoleAssignment(cooperativeId, role);

    return data;
  }

  private selectCooperativeId(context?: any): string {
    if (context?.cooperativeId) {
      return context.cooperativeId;
    }
    
    // Distribute members across cooperatives
    return this.randomChoice(this.options.cooperativeIds);
  }

  private generateRole(cooperativeId: string): 'member' | 'board' | 'chairman' | 'treasurer' | 'admin' {
    const roleCount = this.cooperativeRoleCounts.get(cooperativeId)!;
    const dist = this.options.roleDistribution!;
    
    // Ensure each cooperative has required leadership roles
    if (!roleCount.has('chairman')) {
      roleCount.set('chairman', 0);
      return 'chairman';
    }
    
    // Limit special roles per cooperative
    const chairmanCount = roleCount.get('chairman') || 0;
    const treasurerCount = roleCount.get('treasurer') || 0;
    const adminCount = roleCount.get('admin') || 0;
    
    if (chairmanCount >= 1 && treasurerCount >= 1 && adminCount >= 1) {
      // All required roles filled, use normal distribution
      const rand = this.random();
      if (rand < dist.member) return 'member';
      if (rand < dist.member + dist.board) return 'board';
      return 'member'; // Fallback
    }
    
    // Fill missing required roles
    if (chairmanCount === 0) return 'chairman';
    if (treasurerCount === 0 && this.randomBoolean(0.8)) return 'treasurer';
    if (adminCount === 0 && this.randomBoolean(0.3)) return 'admin';
    
    // Normal distribution
    const rand = this.random();
    if (rand < dist.member) return 'member';
    if (rand < dist.member + dist.board) return 'board';
    if (rand < dist.member + dist.board + dist.chairman && chairmanCount === 0) return 'chairman';
    if (rand < dist.member + dist.board + dist.chairman + dist.treasurer && treasurerCount < 2) return 'treasurer';
    if (adminCount < 3) return 'admin';
    return 'member';
  }

  private trackRoleAssignment(cooperativeId: string, role: string): void {
    const roleCount = this.cooperativeRoleCounts.get(cooperativeId)!;
    roleCount.set(role, (roleCount.get(role) || 0) + 1);
  }

  private generateUniqueEmail(firstName: string, lastName: string): string {
    let attempts = 0;
    let email: string;
    
    do {
      const domain = this.options.emailDomains!.personal[
        Math.floor(this.random() * this.options.emailDomains!.personal.length)
      ];
      email = generateRealisticEmail(firstName, lastName, domain);
      
      // Add number suffix if needed
      if (this.emails.has(email) || attempts > 10) {
        const number = this.randomInt(1, 9999);
        const [localPart, domainPart] = email.split('@');
        email = `${localPart}${number}@${domainPart}`;
      }
      
      attempts++;
    } while (this.emails.has(email) && attempts < 50);
    
    this.emails.add(email);
    return email;
  }

  private generatePhone(): string | undefined {
    if (!this.randomBoolean(this.options.contactCompleteness!.phone)) {
      return undefined;
    }
    
    return generateSwedishPhoneNumber();
  }

  private generateActivityLevel(): 'active' | 'inactive' | 'occasional' {
    const rand = this.random();
    const dist = this.options.activityDistribution!;
    
    if (rand < dist.active) return 'active';
    if (rand < dist.active + dist.inactive) return 'inactive';
    return 'occasional';
  }

  private generatePermissions(role: string): string {
    const basePermissions = {
      read_own_data: true,
      update_own_profile: true,
      view_public_documents: true
    };

    switch (role) {
      case 'member':
        return JSON.stringify({
          ...basePermissions,
          vote_in_meetings: true,
          book_common_areas: true,
          submit_cases: true
        });

      case 'board':
        return JSON.stringify({
          ...basePermissions,
          vote_in_meetings: true,
          view_board_documents: true,
          manage_cases: true,
          approve_expenses: true,
          view_member_list: true
        });

      case 'chairman':
        return JSON.stringify({
          ...basePermissions,
          vote_in_meetings: true,
          view_board_documents: true,
          manage_cases: true,
          approve_expenses: true,
          manage_meetings: true,
          view_all_documents: true,
          manage_board: true,
          sign_contracts: true,
          view_financial_reports: true
        });

      case 'treasurer':
        return JSON.stringify({
          ...basePermissions,
          vote_in_meetings: true,
          view_board_documents: true,
          manage_finances: true,
          approve_expenses: true,
          view_all_invoices: true,
          manage_budgets: true,
          view_financial_reports: true,
          export_financial_data: true
        });

      case 'admin':
        return JSON.stringify({
          ...basePermissions,
          manage_members: true,
          manage_apartments: true,
          manage_documents: true,
          manage_cases: true,
          manage_bookings: true,
          manage_settings: true,
          view_audit_logs: true,
          manage_permissions: true,
          system_administration: true
        });

      default:
        return JSON.stringify(basePermissions);
    }
  }

  private generatePasswordHash(): string {
    // Generate a realistic bcrypt hash pattern for testing
    // Note: This is NOT a real hash and should not be used for actual authentication
    const saltRounds = this.randomChoice(['$2b$10$', '$2b$12$']);
    const salt = this.generateRandomString(22, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./');
    const hash = this.generateRandomString(31, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./');
    
    return `${saltRounds}${salt}${hash}`;
  }

  private generateRandomString(length: number, chars: string): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(this.random() * chars.length));
    }
    return result;
  }

  private generateCreatedDate(): string {
    const daysAgo = this.randomInt(30, 730); // 30 days to 2 years ago
    const created = new Date();
    created.setDate(created.getDate() - daysAgo);
    
    return created.toISOString().replace('T', ' ').split('.')[0];
  }

  private generateUpdatedDate(): string {
    const daysAgo = this.randomInt(0, 60); // Updated within last 60 days
    const updated = new Date();
    updated.setDate(updated.getDate() - daysAgo);
    
    return updated.toISOString().replace('T', ' ').split('.')[0];
  }

  private generateLastLogin(activityLevel: string): string | undefined {
    if (!this.options.includeLastLogin) return undefined;
    
    let maxDaysAgo: number;
    let probability: number;
    
    switch (activityLevel) {
      case 'active':
        maxDaysAgo = 7;
        probability = 0.95;
        break;
      case 'occasional':
        maxDaysAgo = 60;
        probability = 0.70;
        break;
      case 'inactive':
        maxDaysAgo = 365;
        probability = 0.30;
        break;
      default:
        return undefined;
    }
    
    if (!this.randomBoolean(probability)) return undefined;
    
    const daysAgo = this.randomInt(1, maxDaysAgo);
    const loginDate = new Date();
    loginDate.setDate(loginDate.getDate() - daysAgo);
    loginDate.setHours(this.randomInt(6, 23)); // Realistic login hours
    loginDate.setMinutes(this.randomInt(0, 59));
    
    return loginDate.toISOString().replace('T', ' ').split('.')[0];
  }

  /**
   * Get role statistics for generated members
   */
  getRoleStatistics(): { [cooperativeId: string]: { [role: string]: number } } {
    const stats: { [cooperativeId: string]: { [role: string]: number } } = {};
    
    for (const [cooperativeId, roleCounts] of this.cooperativeRoleCounts.entries()) {
      stats[cooperativeId] = {};
      for (const [role, count] of roleCounts.entries()) {
        stats[cooperativeId][role] = count;
      }
    }
    
    return stats;
  }

  /**
   * Generate members with specific role requirements
   */
  generateWithRoleRequirements(
    cooperativeId: string, 
    requirements: { [role: string]: number }
  ): MemberData[] {
    const members: MemberData[] = [];
    
    for (const [role, count] of Object.entries(requirements)) {
      for (let i = 0; i < count; i++) {
        const member = this.generateSingle({ 
          cooperativeId,
          forceRole: role
        });
        member.role = role as any; // Override generated role
        members.push(member);
      }
    }
    
    return members;
  }

  /**
   * Validate that all cooperatives have required leadership roles
   */
  validateLeadershipCoverage(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    for (const cooperativeId of this.options.cooperativeIds) {
      const roleCounts = this.cooperativeRoleCounts.get(cooperativeId);
      if (!roleCounts) continue;
      
      const chairmanCount = roleCounts.get('chairman') || 0;
      const treasurerCount = roleCounts.get('treasurer') || 0;
      const boardCount = roleCounts.get('board') || 0;
      
      if (chairmanCount === 0) {
        issues.push(`Cooperative ${cooperativeId} has no chairman`);
      }
      if (chairmanCount > 1) {
        issues.push(`Cooperative ${cooperativeId} has multiple chairmen (${chairmanCount})`);
      }
      if (treasurerCount === 0) {
        issues.push(`Cooperative ${cooperativeId} has no treasurer`);
      }
      if (boardCount + chairmanCount + treasurerCount < 3) {
        issues.push(`Cooperative ${cooperativeId} has insufficient board members (minimum 3 required)`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}