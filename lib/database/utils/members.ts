import Database from 'better-sqlite3';
import { getDatabase } from '../config';
import {
  Member,
  CreateMember,
  UpdateMember,
  MemberWithApartment,
  MemberFilters,
  PaginatedResult,
  DatabaseResult,
} from '../types';

export class MemberUtils {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Create a new member
   */
  create(data: CreateMember): DatabaseResult<Member> {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO members (
          id, user_id, cooperative_id, email, first_name, last_name, phone,
          role, permissions, is_active, password_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        id,
        data.user_id || null,
        data.cooperative_id,
        data.email,
        data.first_name,
        data.last_name,
        data.phone,
        data.role,
        data.permissions,
        data.is_active ? 1 : 0,
        data.password_hash || null,
        now,
        now
      );

      if (result.changes > 0) {
        const member = this.findById(id);
        return {
          success: true,
          data: member.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Failed to create member' };
    } catch (error) {
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return {
          success: false,
          error: 'Email already exists for this cooperative',
        };
      }
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find member by ID
   */
  findById(id: string): DatabaseResult<Member> {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM members WHERE id = ? AND deleted_at IS NULL'
      );
      const member = stmt.get(id) as Member | undefined;

      if (member) {
        // Convert is_active from integer to boolean
        member.is_active = Boolean(member.is_active);
        return { success: true, data: member };
      }

      return { success: false, error: 'Member not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find member by email within cooperative
   */
  findByEmail(email: string, cooperativeId: string): DatabaseResult<Member> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM members 
        WHERE email = ? AND cooperative_id = ? AND deleted_at IS NULL
      `);
      const member = stmt.get(email, cooperativeId) as Member | undefined;

      if (member) {
        member.is_active = Boolean(member.is_active);
        return { success: true, data: member };
      }

      return { success: false, error: 'Member not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find member with apartment information
   */
  findByIdWithApartment(id: string): DatabaseResult<MemberWithApartment> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          m.*,
          a.id as apartment_id,
          a.apartment_number,
          a.size_sqm,
          a.rooms,
          a.floor,
          a.building,
          a.monthly_fee,
          a.ownership_date
        FROM members m
        LEFT JOIN apartments a ON a.owner_id = m.id
        WHERE m.id = ? AND m.deleted_at IS NULL
      `);

      const result = stmt.get(id) as any;

      if (result) {
        const member: MemberWithApartment = {
          id: result.id,
          user_id: result.user_id,
          cooperative_id: result.cooperative_id,
          email: result.email,
          first_name: result.first_name,
          last_name: result.last_name,
          phone: result.phone,
          role: result.role,
          permissions: result.permissions,
          is_active: Boolean(result.is_active),
          password_hash: result.password_hash,
          created_at: result.created_at,
          updated_at: result.updated_at,
          last_login_at: result.last_login_at,
          deleted_at: result.deleted_at,
        };

        if (result.apartment_id) {
          member.apartment = {
            id: result.apartment_id,
            cooperative_id: result.cooperative_id,
            apartment_number: result.apartment_number,
            share_number: null,
            size_sqm: result.size_sqm,
            rooms: result.rooms,
            floor: result.floor,
            building: result.building,
            monthly_fee: result.monthly_fee,
            share_capital: null,
            owner_id: result.id,
            ownership_date: result.ownership_date,
            created_at: result.created_at,
            updated_at: result.updated_at,
          };
        }

        return { success: true, data: member };
      }

      return { success: false, error: 'Member not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update member
   */
  update(data: UpdateMember): DatabaseResult<Member> {
    try {
      const { id, ...updateData } = data;
      const now = new Date().toISOString();

      // Convert is_active boolean to integer if present
      if ('is_active' in updateData) {
        (updateData as any).is_active = updateData.is_active ? 1 : 0;
      }

      // Build dynamic UPDATE query
      const fields = Object.keys(updateData).filter(
        key => updateData[key as keyof typeof updateData] !== undefined
      );

      if (fields.length === 0) {
        return { success: false, error: 'No fields to update' };
      }

      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(
        field => updateData[field as keyof typeof updateData]
      );

      const stmt = this.db.prepare(`
        UPDATE members 
        SET ${setClause}, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `);

      const result = stmt.run(...values, now, id);

      if (result.changes > 0) {
        const member = this.findById(id);
        return {
          success: true,
          data: member.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Member not found or no changes made' };
    } catch (error) {
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return {
          success: false,
          error: 'Email already exists for this cooperative',
        };
      }
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin(id: string): DatabaseResult<void> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE members 
        SET last_login_at = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `);

      const result = stmt.run(now, now, id);

      if (result.changes > 0) {
        return { success: true, affected_rows: result.changes };
      }

      return { success: false, error: 'Member not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Soft delete member
   */
  delete(id: string): DatabaseResult<void> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE members 
        SET deleted_at = ?, updated_at = ?, is_active = 0
        WHERE id = ? AND deleted_at IS NULL
      `);

      const result = stmt.run(now, now, id);

      if (result.changes > 0) {
        return { success: true, affected_rows: result.changes };
      }

      return { success: false, error: 'Member not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * List members with filtering and pagination
   */
  list(
    filters: MemberFilters,
    pagination?: { page?: number; limit?: number }
  ): DatabaseResult<PaginatedResult<MemberWithApartment>> {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          m.*,
          a.id as apartment_id,
          a.apartment_number,
          a.size_sqm,
          a.rooms,
          a.floor,
          a.building,
          a.monthly_fee,
          a.ownership_date
        FROM members m
        LEFT JOIN apartments a ON a.owner_id = m.id
        WHERE m.cooperative_id = ? AND m.deleted_at IS NULL
      `;

      const params: any[] = [filters.cooperative_id];

      if (filters.role) {
        query += ' AND m.role = ?';
        params.push(filters.role);
      }

      if (filters.is_active !== undefined) {
        query += ' AND m.is_active = ?';
        params.push(filters.is_active ? 1 : 0);
      }

      if (filters.search) {
        query +=
          ' AND (m.first_name LIKE ? OR m.last_name LIKE ? OR m.email LIKE ? OR a.apartment_number LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // Count total records
      const countQuery = query.replace(
        /SELECT[\s\S]*?FROM/,
        'SELECT COUNT(DISTINCT m.id) as total FROM'
      );
      const countStmt = this.db.prepare(countQuery);
      const totalResult = countStmt.get(...params) as { total: number };
      const total = totalResult.total;

      // Add ordering and pagination
      query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = this.db.prepare(query);
      const results = stmt.all(...params) as any[];

      const members: MemberWithApartment[] = results.map(result => {
        const member: MemberWithApartment = {
          id: result.id,
          user_id: result.user_id,
          cooperative_id: result.cooperative_id,
          email: result.email,
          first_name: result.first_name,
          last_name: result.last_name,
          phone: result.phone,
          role: result.role,
          permissions: result.permissions,
          is_active: Boolean(result.is_active),
          password_hash: result.password_hash,
          created_at: result.created_at,
          updated_at: result.updated_at,
          last_login_at: result.last_login_at,
          deleted_at: result.deleted_at,
        };

        if (result.apartment_id) {
          member.apartment = {
            id: result.apartment_id,
            cooperative_id: result.cooperative_id,
            apartment_number: result.apartment_number,
            share_number: null,
            size_sqm: result.size_sqm,
            rooms: result.rooms,
            floor: result.floor,
            building: result.building,
            monthly_fee: result.monthly_fee,
            share_capital: null,
            owner_id: result.id,
            ownership_date: result.ownership_date,
            created_at: result.created_at,
            updated_at: result.updated_at,
          };
        }

        return member;
      });

      const totalPages = Math.ceil(total / limit);

      const paginatedResult: PaginatedResult<MemberWithApartment> = {
        data: members,
        total,
        page,
        limit,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      };

      return { success: true, data: paginatedResult };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get board members for a cooperative
   */
  getBoardMembers(cooperativeId: string): DatabaseResult<Member[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM members 
        WHERE cooperative_id = ? 
          AND role IN ('chairman', 'treasurer', 'board') 
          AND is_active = 1 
          AND deleted_at IS NULL
        ORDER BY 
          CASE role
            WHEN 'chairman' THEN 1
            WHEN 'treasurer' THEN 2
            WHEN 'board' THEN 3
            ELSE 4
          END,
          first_name, last_name
      `);

      const members = stmt.all(cooperativeId) as Member[];
      members.forEach(member => {
        member.is_active = Boolean(member.is_active);
      });

      return { success: true, data: members };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Check if email is available within cooperative
   */
  isEmailAvailable(
    email: string,
    cooperativeId: string,
    excludeId?: string
  ): boolean {
    try {
      let query = `
        SELECT COUNT(*) as count 
        FROM members 
        WHERE email = ? AND cooperative_id = ? AND deleted_at IS NULL
      `;
      const params: any[] = [email, cooperativeId];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };

      return result.count === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Activate or deactivate member
   */
  setActiveStatus(id: string, isActive: boolean): DatabaseResult<Member> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE members 
        SET is_active = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `);

      const result = stmt.run(isActive ? 1 : 0, now, id);

      if (result.changes > 0) {
        const member = this.findById(id);
        return {
          success: true,
          data: member.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Member not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update member role
   */
  updateRole(id: string, role: string): DatabaseResult<Member> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE members 
        SET role = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `);

      const result = stmt.run(role, now, id);

      if (result.changes > 0) {
        const member = this.findById(id);
        return {
          success: true,
          data: member.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Member not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get members without apartments (for assignment)
   */
  getMembersWithoutApartments(cooperativeId: string): DatabaseResult<Member[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT m.* FROM members m
        LEFT JOIN apartments a ON a.owner_id = m.id
        WHERE m.cooperative_id = ? 
          AND m.is_active = 1 
          AND m.deleted_at IS NULL
          AND a.id IS NULL
        ORDER BY m.first_name, m.last_name
      `);

      const members = stmt.all(cooperativeId) as Member[];
      members.forEach(member => {
        member.is_active = Boolean(member.is_active);
      });

      return { success: true, data: members };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private generateId(): string {
    const { randomBytes } = require('crypto');
    return randomBytes(16).toString('hex');
  }
}
