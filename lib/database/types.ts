// Base types
export type UUID = string;
export type Timestamp = string; // ISO 8601 string
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

// Enum types (SQLite doesn't have native enums, so we use string unions)
export type UserRole = 'member' | 'board' | 'chairman' | 'treasurer' | 'admin';
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type CasePriority = 'urgent' | 'high' | 'normal' | 'low';
export type CaseStatus =
  | 'open'
  | 'in_progress'
  | 'waiting'
  | 'resolved'
  | 'closed';

// Database table interfaces
export interface Cooperative {
  id: UUID;
  org_number: string;
  name: string;
  subdomain: string;
  street_address?: string;
  postal_code?: string;
  city?: string;
  settings: JSONValue;
  features: JSONValue;
  subscription_tier: string;
  subscription_status: string;
  trial_ends_at?: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at?: Timestamp;
}

export interface Member {
  id: UUID;
  user_id?: UUID; // Optional for SQLite (no Supabase auth)
  cooperative_id: UUID;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: UserRole;
  permissions: JSONValue;
  is_active: boolean;
  password_hash?: string; // For local auth
  created_at: Timestamp;
  updated_at: Timestamp;
  last_login_at?: Timestamp;
  deleted_at?: Timestamp;
}

export interface Apartment {
  id: UUID;
  cooperative_id: UUID;
  apartment_number: string;
  share_number?: string;
  size_sqm?: number;
  rooms?: number;
  floor?: number;
  building?: string;
  monthly_fee?: number;
  share_capital?: number;
  owner_id?: UUID;
  ownership_date?: string; // DATE string
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Document {
  id: UUID;
  cooperative_id: UUID;
  filename: string;
  mime_type?: string;
  size_bytes?: number;
  file_path: string; // Local file path instead of S3 key
  document_type?: string;
  category?: string;
  tags?: string; // JSON array as string for SQLite
  status: DocumentStatus;
  processed_at?: Timestamp;
  processing_error?: string;
  extracted_data?: JSONValue;
  ocr_text?: string;
  confidence_score?: number;
  uploaded_by?: UUID;
  related_case_id?: UUID;
  related_invoice_id?: UUID;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at?: Timestamp;
}

export interface Invoice {
  id: UUID;
  cooperative_id: UUID;
  invoice_number?: string;
  supplier_name?: string;
  supplier_org_number?: string;
  amount_excl_vat?: number;
  vat_amount?: number;
  total_amount: number;
  currency: string;
  invoice_date?: string; // DATE string
  due_date?: string; // DATE string
  payment_date?: string; // DATE string
  payment_status: PaymentStatus;
  ocr_number?: string;
  bankgiro?: string;
  plusgiro?: string;
  account_code?: string;
  cost_center?: string;
  project_code?: string;
  document_id?: UUID;
  approved_by?: UUID;
  case_id?: UUID;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface MonthlyFee {
  id: UUID;
  cooperative_id: UUID;
  apartment_id?: UUID;
  year: number;
  month: number;
  base_fee?: number;
  parking_fee?: number;
  storage_fee?: number;
  other_fees: JSONValue;
  total_amount: number;
  payment_status: PaymentStatus;
  paid_date?: string; // DATE string
  payment_method?: string;
  ocr_number?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Case {
  id: UUID;
  cooperative_id: UUID;
  case_number: number;
  title: string;
  description?: string;
  category?: string;
  priority: CasePriority;
  status: CaseStatus;
  location?: string;
  apartment_id?: UUID;
  reported_by?: UUID;
  assigned_to?: UUID;
  contractor_id?: UUID;
  reported_at: Timestamp;
  started_at?: Timestamp;
  resolved_at?: Timestamp;
  closed_at?: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Notification {
  id: UUID;
  cooperative_id: UUID;
  member_id?: UUID;
  type: string;
  title?: string;
  message?: string;
  data?: JSONValue;
  channels?: string; // JSON array as string for SQLite
  is_read: boolean;
  read_at?: Timestamp;
  created_at: Timestamp;
}

export interface AuditLog {
  id: number; // SERIAL/INTEGER PRIMARY KEY for SQLite
  cooperative_id: UUID;
  user_id?: UUID;
  user_role?: string;
  ip_address?: string;
  user_agent?: string;
  action: string;
  entity_type: string;
  entity_id?: UUID;
  old_values?: JSONValue;
  new_values?: JSONValue;
  created_at: Timestamp;
}

export interface Migration {
  id: number;
  name: string;
  executed_at: Timestamp;
}

// Input types for creating records (omitting auto-generated fields)
export type CreateCooperative = Omit<
  Cooperative,
  'id' | 'created_at' | 'updated_at'
>;
export type CreateMember = Omit<
  Member,
  'id' | 'created_at' | 'updated_at' | 'last_login_at'
>;
export type CreateApartment = Omit<
  Apartment,
  'id' | 'created_at' | 'updated_at'
>;
export type CreateDocument = Omit<
  Document,
  'id' | 'created_at' | 'updated_at' | 'processed_at'
>;
export type CreateInvoice = Omit<Invoice, 'id' | 'created_at' | 'updated_at'>;
export type CreateMonthlyFee = Omit<
  MonthlyFee,
  'id' | 'created_at' | 'updated_at'
>;
export type CreateCase = Omit<
  Case,
  'id' | 'created_at' | 'updated_at' | 'case_number' | 'reported_at'
>;
export type CreateNotification = Omit<Notification, 'id' | 'created_at'>;
export type CreateAuditLog = Omit<AuditLog, 'id' | 'created_at'>;

// Update types (all fields optional except id)
export type UpdateCooperative = Partial<
  Omit<Cooperative, 'id' | 'created_at'>
> & { id: UUID };
export type UpdateMember = Partial<Omit<Member, 'id' | 'created_at'>> & {
  id: UUID;
};
export type UpdateApartment = Partial<Omit<Apartment, 'id' | 'created_at'>> & {
  id: UUID;
};
export type UpdateDocument = Partial<Omit<Document, 'id' | 'created_at'>> & {
  id: UUID;
};
export type UpdateInvoice = Partial<Omit<Invoice, 'id' | 'created_at'>> & {
  id: UUID;
};
export type UpdateMonthlyFee = Partial<
  Omit<MonthlyFee, 'id' | 'created_at'>
> & { id: UUID };
export type UpdateCase = Partial<
  Omit<Case, 'id' | 'created_at' | 'case_number'>
> & { id: UUID };
export type UpdateNotification = Partial<
  Omit<Notification, 'id' | 'created_at'>
> & { id: UUID };

// Query result types with relations
export interface MemberWithApartment extends Member {
  apartment?: Apartment;
}

export interface ApartmentWithOwner extends Apartment {
  owner?: Member;
}

export interface InvoiceWithDocument extends Invoice {
  document?: Document;
}

export interface CaseWithDetails extends Case {
  apartment?: Apartment;
  reported_by_member?: Member;
  assigned_to_member?: Member;
}

export interface DocumentWithRelations extends Document {
  uploaded_by_member?: Member;
  related_case?: Case;
  related_invoice?: Invoice;
}

// Dashboard statistics
export interface CooperativeStats {
  cooperative_id: UUID;
  total_apartments: number;
  total_members: number;
  board_members: number;
  avg_monthly_fee: number;
  total_revenue_current_month: number;
  outstanding_invoices: number;
  overdue_fees: number;
  open_cases: number;
}

// Financial summary types
export interface FinancialSummary {
  period: string;
  total_income: number;
  total_expenses: number;
  net_result: number;
  outstanding_fees: number;
  overdue_amount: number;
}

// Search and filter types
export interface MemberFilters {
  cooperative_id: UUID;
  role?: UserRole;
  is_active?: boolean;
  search?: string;
}

export interface DocumentFilters {
  cooperative_id: UUID;
  document_type?: string;
  status?: DocumentStatus;
  search?: string;
  from_date?: string;
  to_date?: string;
}

export interface InvoiceFilters {
  cooperative_id: UUID;
  payment_status?: PaymentStatus;
  from_date?: string;
  to_date?: string;
  min_amount?: number;
  max_amount?: number;
}

export interface CaseFilters {
  cooperative_id: UUID;
  status?: CaseStatus;
  priority?: CasePriority;
  assigned_to?: UUID;
  apartment_id?: UUID;
}

// Pagination
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Database operation result types
export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  affected_rows?: number;
}

export interface BulkInsertResult {
  success: boolean;
  inserted_count: number;
  failed_count: number;
  errors?: string[];
}

// OCR and document processing types
export interface OCRResult {
  text: string;
  confidence: number;
  extracted_data?: {
    invoice_number?: string;
    amount?: number;
    due_date?: string;
    supplier?: string;
    [key: string]: any;
  };
}

// Notification types
export interface NotificationTemplate {
  type: string;
  title_template: string;
  message_template: string;
  default_channels: string[];
}

// Export utility type for database schema validation
export type TableNames =
  | 'cooperatives'
  | 'members'
  | 'apartments'
  | 'documents'
  | 'invoices'
  | 'monthly_fees'
  | 'cases'
  | 'notifications'
  | 'audit_log'
  | 'migrations';

export type DatabaseTables = {
  cooperatives: Cooperative;
  members: Member;
  apartments: Apartment;
  documents: Document;
  invoices: Invoice;
  monthly_fees: MonthlyFee;
  cases: Case;
  notifications: Notification;
  audit_log: AuditLog;
  migrations: Migration;
};
