import Database from 'better-sqlite3';
import { getDatabase } from '../config';
import {
  Apartment,
  CreateApartment,
  UpdateApartment,
  ApartmentWithOwner,
  DatabaseResult,
} from '../types';

export class ApartmentUtils {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Create a new apartment
   */
  create(data: CreateApartment): DatabaseResult<Apartment> {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO apartments (
          id, cooperative_id, apartment_number, share_number, size_sqm, rooms,
          floor, building, monthly_fee, share_capital, owner_id, ownership_date,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        id,
        data.cooperative_id,
        data.apartment_number,
        data.share_number,
        data.size_sqm,
        data.rooms,
        data.floor,
        data.building,
        data.monthly_fee,
        data.share_capital,
        data.owner_id,
        data.ownership_date,
        now,
        now
      );

      if (result.changes > 0) {
        const apartment = this.findById(id);
        return {
          success: true,
          data: apartment.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Failed to create apartment' };
    } catch (error) {
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return {
          success: false,
          error: 'Apartment number already exists for this cooperative',
        };
      }
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find apartment by ID
   */
  findById(id: string): DatabaseResult<Apartment> {
    try {
      const stmt = this.db.prepare('SELECT * FROM apartments WHERE id = ?');
      const apartment = stmt.get(id) as Apartment | undefined;

      if (apartment) {
        return { success: true, data: apartment };
      }

      return { success: false, error: 'Apartment not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find apartment by number within cooperative
   */
  findByNumber(
    apartmentNumber: string,
    cooperativeId: string
  ): DatabaseResult<Apartment> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM apartments 
        WHERE apartment_number = ? AND cooperative_id = ?
      `);
      const apartment = stmt.get(apartmentNumber, cooperativeId) as
        | Apartment
        | undefined;

      if (apartment) {
        return { success: true, data: apartment };
      }

      return { success: false, error: 'Apartment not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find apartment with owner information
   */
  findByIdWithOwner(id: string): DatabaseResult<ApartmentWithOwner> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          a.*,
          m.id as owner_id,
          m.email as owner_email,
          m.first_name as owner_first_name,
          m.last_name as owner_last_name,
          m.phone as owner_phone,
          m.role as owner_role,
          m.is_active as owner_is_active
        FROM apartments a
        LEFT JOIN members m ON m.id = a.owner_id AND m.deleted_at IS NULL
        WHERE a.id = ?
      `);

      const result = stmt.get(id) as any;

      if (result) {
        const apartment: ApartmentWithOwner = {
          id: result.id,
          cooperative_id: result.cooperative_id,
          apartment_number: result.apartment_number,
          share_number: result.share_number,
          size_sqm: result.size_sqm,
          rooms: result.rooms,
          floor: result.floor,
          building: result.building,
          monthly_fee: result.monthly_fee,
          share_capital: result.share_capital,
          owner_id: result.owner_id,
          ownership_date: result.ownership_date,
          created_at: result.created_at,
          updated_at: result.updated_at,
        };

        if (result.owner_id) {
          apartment.owner = {
            id: result.owner_id,
            user_id: null,
            cooperative_id: result.cooperative_id,
            email: result.owner_email,
            first_name: result.owner_first_name,
            last_name: result.owner_last_name,
            phone: result.owner_phone,
            role: result.owner_role,
            permissions: '{}',
            is_active: Boolean(result.owner_is_active),
            password_hash: null,
            created_at: result.created_at,
            updated_at: result.updated_at,
            last_login_at: null,
            deleted_at: null,
          };
        }

        return { success: true, data: apartment };
      }

      return { success: false, error: 'Apartment not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update apartment
   */
  update(data: UpdateApartment): DatabaseResult<Apartment> {
    try {
      const { id, ...updateData } = data;
      const now = new Date().toISOString();

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
        UPDATE apartments 
        SET ${setClause}, updated_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(...values, now, id);

      if (result.changes > 0) {
        const apartment = this.findById(id);
        return {
          success: true,
          data: apartment.data,
          affected_rows: result.changes,
        };
      }

      return {
        success: false,
        error: 'Apartment not found or no changes made',
      };
    } catch (error) {
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return {
          success: false,
          error: 'Apartment number already exists for this cooperative',
        };
      }
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete apartment
   */
  delete(id: string): DatabaseResult<void> {
    try {
      const stmt = this.db.prepare('DELETE FROM apartments WHERE id = ?');
      const result = stmt.run(id);

      if (result.changes > 0) {
        return { success: true, affected_rows: result.changes };
      }

      return { success: false, error: 'Apartment not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * List apartments for a cooperative
   */
  list(
    cooperativeId: string,
    filters?: {
      has_owner?: boolean;
      owner_id?: string;
      building?: string;
      floor?: number;
      min_size?: number;
      max_size?: number;
      search?: string;
    }
  ): DatabaseResult<ApartmentWithOwner[]> {
    try {
      let query = `
        SELECT 
          a.*,
          m.id as owner_id,
          m.email as owner_email,
          m.first_name as owner_first_name,
          m.last_name as owner_last_name,
          m.phone as owner_phone,
          m.role as owner_role,
          m.is_active as owner_is_active
        FROM apartments a
        LEFT JOIN members m ON m.id = a.owner_id AND m.deleted_at IS NULL
        WHERE a.cooperative_id = ?
      `;

      const params: any[] = [cooperativeId];

      if (filters) {
        if (filters.has_owner !== undefined) {
          if (filters.has_owner) {
            query += ' AND a.owner_id IS NOT NULL';
          } else {
            query += ' AND a.owner_id IS NULL';
          }
        }

        if (filters.owner_id) {
          query += ' AND a.owner_id = ?';
          params.push(filters.owner_id);
        }

        if (filters.building) {
          query += ' AND a.building = ?';
          params.push(filters.building);
        }

        if (filters.floor !== undefined) {
          query += ' AND a.floor = ?';
          params.push(filters.floor);
        }

        if (filters.min_size) {
          query += ' AND a.size_sqm >= ?';
          params.push(filters.min_size);
        }

        if (filters.max_size) {
          query += ' AND a.size_sqm <= ?';
          params.push(filters.max_size);
        }

        if (filters.search) {
          query +=
            ' AND (a.apartment_number LIKE ? OR a.share_number LIKE ? OR a.building LIKE ?)';
          const searchTerm = `%${filters.search}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }
      }

      query += ' ORDER BY a.building, a.floor, a.apartment_number';

      const stmt = this.db.prepare(query);
      const results = stmt.all(...params) as any[];

      const apartments: ApartmentWithOwner[] = results.map(result => {
        const apartment: ApartmentWithOwner = {
          id: result.id,
          cooperative_id: result.cooperative_id,
          apartment_number: result.apartment_number,
          share_number: result.share_number,
          size_sqm: result.size_sqm,
          rooms: result.rooms,
          floor: result.floor,
          building: result.building,
          monthly_fee: result.monthly_fee,
          share_capital: result.share_capital,
          owner_id: result.owner_id,
          ownership_date: result.ownership_date,
          created_at: result.created_at,
          updated_at: result.updated_at,
        };

        if (result.owner_id) {
          apartment.owner = {
            id: result.owner_id,
            user_id: null,
            cooperative_id: result.cooperative_id,
            email: result.owner_email,
            first_name: result.owner_first_name,
            last_name: result.owner_last_name,
            phone: result.owner_phone,
            role: result.owner_role,
            permissions: '{}',
            is_active: Boolean(result.owner_is_active),
            password_hash: null,
            created_at: result.created_at,
            updated_at: result.updated_at,
            last_login_at: null,
            deleted_at: null,
          };
        }

        return apartment;
      });

      return { success: true, data: apartments };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Assign owner to apartment
   */
  assignOwner(
    apartmentId: string,
    memberId: string
  ): DatabaseResult<Apartment> {
    try {
      const now = new Date().toISOString();

      // First, remove the member from any other apartment
      const removeStmt = this.db.prepare(`
        UPDATE apartments 
        SET owner_id = NULL, ownership_date = NULL, updated_at = ?
        WHERE owner_id = ?
      `);
      removeStmt.run(now, memberId);

      // Then assign to the new apartment
      const assignStmt = this.db.prepare(`
        UPDATE apartments 
        SET owner_id = ?, ownership_date = ?, updated_at = ?
        WHERE id = ?
      `);

      const result = assignStmt.run(memberId, now, now, apartmentId);

      if (result.changes > 0) {
        const apartment = this.findById(apartmentId);
        return {
          success: true,
          data: apartment.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Apartment not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Remove owner from apartment
   */
  removeOwner(apartmentId: string): DatabaseResult<Apartment> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE apartments 
        SET owner_id = NULL, ownership_date = NULL, updated_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(now, apartmentId);

      if (result.changes > 0) {
        const apartment = this.findById(apartmentId);
        return {
          success: true,
          data: apartment.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Apartment not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get vacant apartments (without owners)
   */
  getVacantApartments(cooperativeId: string): DatabaseResult<Apartment[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM apartments 
        WHERE cooperative_id = ? AND owner_id IS NULL
        ORDER BY building, floor, apartment_number
      `);

      const apartments = stmt.all(cooperativeId) as Apartment[];
      return { success: true, data: apartments };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get apartments by building
   */
  getByBuilding(
    cooperativeId: string,
    building: string
  ): DatabaseResult<ApartmentWithOwner[]> {
    try {
      return this.list(cooperativeId, { building });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get apartments by floor
   */
  getByFloor(
    cooperativeId: string,
    floor: number
  ): DatabaseResult<ApartmentWithOwner[]> {
    try {
      return this.list(cooperativeId, { floor });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Calculate total monthly fees for cooperative
   */
  getTotalMonthlyFees(
    cooperativeId: string
  ): DatabaseResult<{ total: number; count: number }> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COALESCE(SUM(monthly_fee), 0) as total,
          COUNT(*) as count
        FROM apartments 
        WHERE cooperative_id = ? AND monthly_fee IS NOT NULL
      `);

      const result = stmt.get(cooperativeId) as {
        total: number;
        count: number;
      };
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get apartment statistics for cooperative
   */
  getStatistics(cooperativeId: string): DatabaseResult<{
    total_apartments: number;
    occupied_apartments: number;
    vacant_apartments: number;
    avg_size: number;
    avg_monthly_fee: number;
    buildings: string[];
  }> {
    try {
      const stats = this.db.transaction(() => {
        // Basic counts
        const countResult = this.db
          .prepare(
            `
          SELECT 
            COUNT(*) as total,
            COUNT(owner_id) as occupied,
            COUNT(*) - COUNT(owner_id) as vacant
          FROM apartments 
          WHERE cooperative_id = ?
        `
          )
          .get(cooperativeId) as {
          total: number;
          occupied: number;
          vacant: number;
        };

        // Averages
        const avgResult = this.db
          .prepare(
            `
          SELECT 
            AVG(size_sqm) as avg_size,
            AVG(monthly_fee) as avg_fee
          FROM apartments 
          WHERE cooperative_id = ? 
            AND size_sqm IS NOT NULL 
            AND monthly_fee IS NOT NULL
        `
          )
          .get(cooperativeId) as { avg_size: number; avg_fee: number };

        // Buildings
        const buildingResult = this.db
          .prepare(
            `
          SELECT DISTINCT building 
          FROM apartments 
          WHERE cooperative_id = ? AND building IS NOT NULL
          ORDER BY building
        `
          )
          .all(cooperativeId) as { building: string }[];

        return {
          total_apartments: countResult.total,
          occupied_apartments: countResult.occupied,
          vacant_apartments: countResult.vacant,
          avg_size: Math.round(avgResult.avg_size || 0),
          avg_monthly_fee: Math.round(avgResult.avg_fee || 0),
          buildings: buildingResult.map(r => r.building),
        };
      })();

      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Check if apartment number is available
   */
  isApartmentNumberAvailable(
    apartmentNumber: string,
    cooperativeId: string,
    excludeId?: string
  ): boolean {
    try {
      let query = `
        SELECT COUNT(*) as count 
        FROM apartments 
        WHERE apartment_number = ? AND cooperative_id = ?
      `;
      const params: any[] = [apartmentNumber, cooperativeId];

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

  private generateId(): string {
    const { randomBytes } = require('crypto');
    return randomBytes(16).toString('hex');
  }
}
