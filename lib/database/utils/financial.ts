import Database from 'better-sqlite3';
import { getDatabase } from '../config';
import {
  Invoice,
  CreateInvoice,
  UpdateInvoice,
  MonthlyFee,
  CreateMonthlyFee,
  UpdateMonthlyFee,
  InvoiceWithDocument,
  InvoiceFilters,
  FinancialSummary,
  DatabaseResult,
  PaginatedResult,
} from '../types';

export class FinancialUtils {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  // ========== INVOICES ==========

  /**
   * Create a new invoice
   */
  createInvoice(data: CreateInvoice): DatabaseResult<Invoice> {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO invoices (
          id, cooperative_id, invoice_number, supplier_name, supplier_org_number,
          amount_excl_vat, vat_amount, total_amount, currency, invoice_date,
          due_date, payment_date, payment_status, ocr_number, bankgiro, plusgiro,
          account_code, cost_center, project_code, document_id, approved_by,
          case_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        id,
        data.cooperative_id,
        data.invoice_number,
        data.supplier_name,
        data.supplier_org_number,
        data.amount_excl_vat,
        data.vat_amount,
        data.total_amount,
        data.currency,
        data.invoice_date,
        data.due_date,
        data.payment_date,
        data.payment_status,
        data.ocr_number,
        data.bankgiro,
        data.plusgiro,
        data.account_code,
        data.cost_center,
        data.project_code,
        data.document_id,
        data.approved_by,
        data.case_id,
        now,
        now
      );

      if (result.changes > 0) {
        const invoice = this.findInvoiceById(id);
        return {
          success: true,
          data: invoice.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Failed to create invoice' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find invoice by ID
   */
  findInvoiceById(id: string): DatabaseResult<Invoice> {
    try {
      const stmt = this.db.prepare('SELECT * FROM invoices WHERE id = ?');
      const invoice = stmt.get(id) as Invoice | undefined;

      if (invoice) {
        return { success: true, data: invoice };
      }

      return { success: false, error: 'Invoice not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find invoice with document information
   */
  findInvoiceByIdWithDocument(id: string): DatabaseResult<InvoiceWithDocument> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          i.*,
          d.id as document_id,
          d.filename as document_filename,
          d.file_path as document_file_path,
          d.mime_type as document_mime_type,
          d.size_bytes as document_size_bytes
        FROM invoices i
        LEFT JOIN documents d ON d.id = i.document_id
        WHERE i.id = ?
      `);

      const result = stmt.get(id) as any;

      if (result) {
        const invoice: InvoiceWithDocument = {
          id: result.id,
          cooperative_id: result.cooperative_id,
          invoice_number: result.invoice_number,
          supplier_name: result.supplier_name,
          supplier_org_number: result.supplier_org_number,
          amount_excl_vat: result.amount_excl_vat,
          vat_amount: result.vat_amount,
          total_amount: result.total_amount,
          currency: result.currency,
          invoice_date: result.invoice_date,
          due_date: result.due_date,
          payment_date: result.payment_date,
          payment_status: result.payment_status,
          ocr_number: result.ocr_number,
          bankgiro: result.bankgiro,
          plusgiro: result.plusgiro,
          account_code: result.account_code,
          cost_center: result.cost_center,
          project_code: result.project_code,
          document_id: result.document_id,
          approved_by: result.approved_by,
          case_id: result.case_id,
          created_at: result.created_at,
          updated_at: result.updated_at,
        };

        if (result.document_id) {
          invoice.document = {
            id: result.document_id,
            cooperative_id: result.cooperative_id,
            filename: result.document_filename,
            mime_type: result.document_mime_type,
            size_bytes: result.document_size_bytes,
            file_path: result.document_file_path,
            document_type: null,
            category: null,
            tags: '[]',
            status: 'completed',
            processed_at: null,
            processing_error: null,
            extracted_data: null,
            ocr_text: null,
            confidence_score: null,
            uploaded_by: null,
            related_case_id: null,
            related_invoice_id: result.id,
            created_at: result.created_at,
            updated_at: result.updated_at,
            deleted_at: null,
          };
        }

        return { success: true, data: invoice };
      }

      return { success: false, error: 'Invoice not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update invoice
   */
  updateInvoice(data: UpdateInvoice): DatabaseResult<Invoice> {
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
        UPDATE invoices 
        SET ${setClause}, updated_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(...values, now, id);

      if (result.changes > 0) {
        const invoice = this.findInvoiceById(id);
        return {
          success: true,
          data: invoice.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Invoice not found or no changes made' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * List invoices with filtering and pagination
   */
  listInvoices(
    filters: InvoiceFilters,
    pagination?: { page?: number; limit?: number }
  ): DatabaseResult<PaginatedResult<InvoiceWithDocument>> {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          i.*,
          d.filename as document_filename,
          d.file_path as document_file_path
        FROM invoices i
        LEFT JOIN documents d ON d.id = i.document_id
        WHERE i.cooperative_id = ?
      `;

      const params: any[] = [filters.cooperative_id];

      if (filters.payment_status) {
        query += ' AND i.payment_status = ?';
        params.push(filters.payment_status);
      }

      if (filters.from_date) {
        query += ' AND i.invoice_date >= ?';
        params.push(filters.from_date);
      }

      if (filters.to_date) {
        query += ' AND i.invoice_date <= ?';
        params.push(filters.to_date);
      }

      if (filters.min_amount) {
        query += ' AND i.total_amount >= ?';
        params.push(filters.min_amount);
      }

      if (filters.max_amount) {
        query += ' AND i.total_amount <= ?';
        params.push(filters.max_amount);
      }

      // Count total records
      const countQuery = query.replace(
        /SELECT[\s\S]*?FROM/,
        'SELECT COUNT(*) as total FROM'
      );
      const countStmt = this.db.prepare(countQuery);
      const totalResult = countStmt.get(...params) as { total: number };
      const total = totalResult.total;

      // Add ordering and pagination
      query +=
        ' ORDER BY i.invoice_date DESC, i.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = this.db.prepare(query);
      const results = stmt.all(...params) as any[];

      const invoices: InvoiceWithDocument[] = results.map(result => ({
        id: result.id,
        cooperative_id: result.cooperative_id,
        invoice_number: result.invoice_number,
        supplier_name: result.supplier_name,
        supplier_org_number: result.supplier_org_number,
        amount_excl_vat: result.amount_excl_vat,
        vat_amount: result.vat_amount,
        total_amount: result.total_amount,
        currency: result.currency,
        invoice_date: result.invoice_date,
        due_date: result.due_date,
        payment_date: result.payment_date,
        payment_status: result.payment_status,
        ocr_number: result.ocr_number,
        bankgiro: result.bankgiro,
        plusgiro: result.plusgiro,
        account_code: result.account_code,
        cost_center: result.cost_center,
        project_code: result.project_code,
        document_id: result.document_id,
        approved_by: result.approved_by,
        case_id: result.case_id,
        created_at: result.created_at,
        updated_at: result.updated_at,
        document: result.document_filename
          ? ({
              filename: result.document_filename,
              file_path: result.document_file_path,
            } as any)
          : undefined,
      }));

      const totalPages = Math.ceil(total / limit);

      const paginatedResult: PaginatedResult<InvoiceWithDocument> = {
        data: invoices,
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
   * Mark invoice as paid
   */
  markInvoiceAsPaid(id: string, paymentDate?: string): DatabaseResult<Invoice> {
    try {
      const now = new Date().toISOString();
      const paidDate = paymentDate || now.split('T')[0]; // Use current date if not provided

      const stmt = this.db.prepare(`
        UPDATE invoices 
        SET payment_status = 'paid', payment_date = ?, updated_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(paidDate, now, id);

      if (result.changes > 0) {
        const invoice = this.findInvoiceById(id);
        return {
          success: true,
          data: invoice.data,
          affected_rows: result.changes,
        };
      }

      return { success: false, error: 'Invoice not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ========== MONTHLY FEES ==========

  /**
   * Create monthly fee record
   */
  createMonthlyFee(data: CreateMonthlyFee): DatabaseResult<MonthlyFee> {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO monthly_fees (
          id, cooperative_id, apartment_id, year, month, base_fee, parking_fee,
          storage_fee, other_fees, total_amount, payment_status, paid_date,
          payment_method, ocr_number, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        id,
        data.cooperative_id,
        data.apartment_id,
        data.year,
        data.month,
        data.base_fee,
        data.parking_fee,
        data.storage_fee,
        data.other_fees,
        data.total_amount,
        data.payment_status,
        data.paid_date,
        data.payment_method,
        data.ocr_number,
        now,
        now
      );

      if (result.changes > 0) {
        const fee = this.findMonthlyFeeById(id);
        return { success: true, data: fee.data, affected_rows: result.changes };
      }

      return { success: false, error: 'Failed to create monthly fee' };
    } catch (error) {
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return {
          success: false,
          error: 'Monthly fee already exists for this apartment and period',
        };
      }
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Find monthly fee by ID
   */
  findMonthlyFeeById(id: string): DatabaseResult<MonthlyFee> {
    try {
      const stmt = this.db.prepare('SELECT * FROM monthly_fees WHERE id = ?');
      const fee = stmt.get(id) as MonthlyFee | undefined;

      if (fee) {
        return { success: true, data: fee };
      }

      return { success: false, error: 'Monthly fee not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update monthly fee
   */
  updateMonthlyFee(data: UpdateMonthlyFee): DatabaseResult<MonthlyFee> {
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
        UPDATE monthly_fees 
        SET ${setClause}, updated_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(...values, now, id);

      if (result.changes > 0) {
        const fee = this.findMonthlyFeeById(id);
        return { success: true, data: fee.data, affected_rows: result.changes };
      }

      return {
        success: false,
        error: 'Monthly fee not found or no changes made',
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Generate monthly fees for all apartments in a cooperative
   */
  generateMonthlyFeesForPeriod(
    cooperativeId: string,
    year: number,
    month: number
  ): DatabaseResult<{ created: number; skipped: number }> {
    try {
      const result = this.db.transaction(() => {
        // Get all apartments with monthly fees
        const apartments = this.db
          .prepare(
            `
          SELECT id, apartment_number, monthly_fee 
          FROM apartments 
          WHERE cooperative_id = ? AND monthly_fee IS NOT NULL
        `
          )
          .all(cooperativeId) as {
          id: string;
          apartment_number: string;
          monthly_fee: number;
        }[];

        let created = 0;
        let skipped = 0;

        for (const apartment of apartments) {
          // Check if fee already exists
          const existing = this.db
            .prepare(
              `
            SELECT COUNT(*) as count 
            FROM monthly_fees 
            WHERE apartment_id = ? AND year = ? AND month = ?
          `
            )
            .get(apartment.id, year, month) as { count: number };

          if (existing.count > 0) {
            skipped++;
            continue;
          }

          // Generate OCR number
          const apartmentNum =
            parseInt(apartment.apartment_number.replace(/[A-Z]/g, '')) || 1;
          const ocrNumber = this.generateOcrNumber(apartmentNum, year, month);

          // Create monthly fee record
          const feeId = this.generateId();
          const now = new Date().toISOString();
          const baseFee = apartment.monthly_fee * 0.8; // Assume 80% is base fee
          const parkingFee = 0; // Can be customized
          const storageFee = 0; // Can be customized

          this.db
            .prepare(
              `
            INSERT INTO monthly_fees (
              id, cooperative_id, apartment_id, year, month, base_fee,
              parking_fee, storage_fee, other_fees, total_amount,
              payment_status, ocr_number, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
            )
            .run(
              feeId,
              cooperativeId,
              apartment.id,
              year,
              month,
              baseFee,
              parkingFee,
              storageFee,
              '{}',
              apartment.monthly_fee,
              'pending',
              ocrNumber,
              now,
              now
            );

          created++;
        }

        return { created, skipped };
      })();

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Mark monthly fee as paid
   */
  markMonthlyFeeAsPaid(
    id: string,
    paymentDate?: string,
    paymentMethod?: string
  ): DatabaseResult<MonthlyFee> {
    try {
      const now = new Date().toISOString();
      const paidDate = paymentDate || now.split('T')[0];

      const stmt = this.db.prepare(`
        UPDATE monthly_fees 
        SET payment_status = 'paid', paid_date = ?, payment_method = ?, updated_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(paidDate, paymentMethod || 'manual', now, id);

      if (result.changes > 0) {
        const fee = this.findMonthlyFeeById(id);
        return { success: true, data: fee.data, affected_rows: result.changes };
      }

      return { success: false, error: 'Monthly fee not found' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ========== FINANCIAL REPORTS ==========

  /**
   * Get financial summary for a period
   */
  getFinancialSummary(
    cooperativeId: string,
    year: number,
    month?: number
  ): DatabaseResult<FinancialSummary> {
    try {
      const summary = this.db.transaction(() => {
        let periodFilter = 'strftime("%Y", i.invoice_date) = ?';
        let monthlyFeeFilter = 'mf.year = ?';
        const params = [cooperativeId, year.toString()];

        if (month !== undefined) {
          periodFilter += ' AND strftime("%m", i.invoice_date) = ?';
          monthlyFeeFilter += ' AND mf.month = ?';
          params.push(month.toString().padStart(2, '0'));
          params.push(month);
        }

        // Total income (paid monthly fees)
        const incomeResult = this.db
          .prepare(
            `
          SELECT COALESCE(SUM(total_amount), 0) as total_income
          FROM monthly_fees mf
          WHERE mf.cooperative_id = ? AND ${monthlyFeeFilter} AND mf.payment_status = 'paid'
        `
          )
          .get(...params.slice(0, month !== undefined ? 3 : 2)) as {
          total_income: number;
        };

        // Total expenses (paid invoices)
        const expenseResult = this.db
          .prepare(
            `
          SELECT COALESCE(SUM(total_amount), 0) as total_expenses
          FROM invoices i
          WHERE i.cooperative_id = ? AND ${periodFilter} AND i.payment_status = 'paid'
        `
          )
          .get(...params.slice(0, month !== undefined ? 3 : 2)) as {
          total_expenses: number;
        };

        // Outstanding fees (unpaid monthly fees)
        const outstandingResult = this.db
          .prepare(
            `
          SELECT COALESCE(SUM(total_amount), 0) as outstanding
          FROM monthly_fees mf
          WHERE mf.cooperative_id = ? AND ${monthlyFeeFilter} AND mf.payment_status IN ('pending', 'overdue')
        `
          )
          .get(...params.slice(0, month !== undefined ? 3 : 2)) as {
          outstanding: number;
        };

        // Overdue amount (only overdue fees)
        const overdueResult = this.db
          .prepare(
            `
          SELECT COALESCE(SUM(total_amount), 0) as overdue
          FROM monthly_fees mf
          WHERE mf.cooperative_id = ? AND ${monthlyFeeFilter} AND mf.payment_status = 'overdue'
        `
          )
          .get(...params.slice(0, month !== undefined ? 3 : 2)) as {
          overdue: number;
        };

        const period =
          month !== undefined
            ? `${year}-${month.toString().padStart(2, '0')}`
            : year.toString();

        return {
          period,
          total_income: Math.round(incomeResult.total_income),
          total_expenses: Math.round(expenseResult.total_expenses),
          net_result: Math.round(
            incomeResult.total_income - expenseResult.total_expenses
          ),
          outstanding_fees: Math.round(outstandingResult.outstanding),
          overdue_amount: Math.round(overdueResult.overdue),
        };
      })();

      return { success: true, data: summary };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get overdue monthly fees
   */
  getOverdueMonthlyFees(cooperativeId: string): DatabaseResult<MonthlyFee[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT mf.*, a.apartment_number, m.first_name, m.last_name, m.email
        FROM monthly_fees mf
        LEFT JOIN apartments a ON a.id = mf.apartment_id
        LEFT JOIN members m ON m.id = a.owner_id
        WHERE mf.cooperative_id = ? AND mf.payment_status = 'overdue'
        ORDER BY mf.year DESC, mf.month DESC
      `);

      const fees = stmt.all(cooperativeId) as any[];
      return { success: true, data: fees };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private generateId(): string {
    const { randomBytes } = require('crypto');
    return randomBytes(16).toString('hex');
  }

  private generateOcrNumber(
    apartmentNum: number,
    year: number,
    month: number
  ): string {
    const base = `1001${String(apartmentNum).padStart(4, '0')}${year}${String(month).padStart(2, '0')}`;
    // Simple checksum (not real Luhn algorithm, but good enough for demo)
    const checksum = (parseInt(base) % 10).toString();
    return base + checksum;
  }
}
