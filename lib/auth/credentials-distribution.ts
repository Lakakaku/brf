/**
 * Login Credentials Distribution System for BRF Portal
 * Manages bulk user onboarding and credential distribution
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import { 
  AuthUser, 
  AuthError, 
  AuthErrorType,
  MemberRole 
} from './types';
import { hashPassword } from './crypto';
import { 
  getEmailVerificationTemplate, 
  sendMockEmail,
  generateVerificationCode,
  generateVerificationUrl 
} from '@/lib/email/templates';

/**
 * Credential distribution configuration
 */
export const CREDENTIAL_CONFIG = {
  // Password generation
  TEMP_PASSWORD_LENGTH: 12,
  TEMP_PASSWORD_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%',
  PASSWORD_EXPIRY_DAYS: 7,
  
  // Invitation settings
  INVITATION_EXPIRY_DAYS: 30,
  MAX_RESEND_COUNT: 3,
  
  // Batch settings
  MAX_BATCH_SIZE: 100,
  
  // Security
  REQUIRE_PASSWORD_CHANGE: true,
  REQUIRE_EMAIL_VERIFICATION: true
};

/**
 * User credential data for distribution
 */
export interface UserCredential {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  apartmentNumber: string;
  role: MemberRole;
  phoneNumber?: string;
  temporaryPassword?: string;
  invitationToken?: string;
  invitationSentAt?: Date;
  invitationExpiresAt?: Date;
  passwordChangedAt?: Date;
  isPasswordTemporary?: boolean;
  resendCount?: number;
}

/**
 * Bulk import result
 */
export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    email: string;
    error: string;
  }>;
  users: UserCredential[];
}

/**
 * Database connection
 */
function getDatabase(): Database.Database {
  const dbPath = process.env.DATABASE_PATH || './database/brf.db';
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Initialize credential distribution tables
 */
export function initializeCredentialTables(): void {
  const db = getDatabase();
  
  try {
    // Create credential distribution table
    db.exec(`
      CREATE TABLE IF NOT EXISTS credential_distributions (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        user_id TEXT NOT NULL,
        cooperative_id TEXT NOT NULL,
        email TEXT NOT NULL,
        temporary_password_hash TEXT,
        invitation_token TEXT UNIQUE,
        invitation_sent_at TEXT,
        invitation_expires_at TEXT,
        password_changed_at TEXT,
        is_password_temporary INTEGER DEFAULT 1,
        resend_count INTEGER DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (user_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES members(id)
      );
    `);

    // Create distribution batches table for tracking bulk operations
    db.exec(`
      CREATE TABLE IF NOT EXISTS distribution_batches (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        cooperative_id TEXT NOT NULL,
        batch_name TEXT,
        total_users INTEGER NOT NULL,
        successful_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        error_log TEXT, -- JSON string
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        
        FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES members(id)
      );
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_credential_distributions_user ON credential_distributions(user_id);
      CREATE INDEX IF NOT EXISTS idx_credential_distributions_token ON credential_distributions(invitation_token);
      CREATE INDEX IF NOT EXISTS idx_credential_distributions_email ON credential_distributions(email);
      CREATE INDEX IF NOT EXISTS idx_distribution_batches_cooperative ON distribution_batches(cooperative_id);
      CREATE INDEX IF NOT EXISTS idx_distribution_batches_status ON distribution_batches(status);
    `);
    
    console.log('✅ Credential distribution tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize credential distribution tables:', error);
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Generate a secure temporary password
 */
export function generateTemporaryPassword(): string {
  const chars = CREDENTIAL_CONFIG.TEMP_PASSWORD_CHARS;
  let password = '';
  
  // Ensure at least one of each type
  const requirements = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ', // Uppercase
    'abcdefghjkmnpqrstuvwxyz',   // Lowercase
    '23456789',                   // Numbers
    '!@#$%'                       // Special chars
  ];
  
  // Add one from each requirement
  requirements.forEach(req => {
    const randomIndex = crypto.randomInt(0, req.length);
    password += req[randomIndex];
  });
  
  // Fill the rest randomly
  for (let i = password.length; i < CREDENTIAL_CONFIG.TEMP_PASSWORD_LENGTH; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    password += chars[randomIndex];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Generate invitation token
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create and distribute credentials for a single user
 */
export async function createUserCredentials(params: {
  email: string;
  firstName: string;
  lastName: string;
  apartmentNumber: string;
  role: MemberRole;
  phoneNumber?: string;
  cooperativeId: string;
  createdBy: string;
  sendEmail?: boolean;
}): Promise<UserCredential> {
  const db = getDatabase();
  
  try {
    // Check if user already exists
    const existingUserStmt = db.prepare(`
      SELECT id FROM members 
      WHERE email = ? AND cooperative_id = ?
    `);
    
    const existingUser = existingUserStmt.get(params.email, params.cooperativeId) as any;
    
    let userId: string;
    
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user
      const tempPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(tempPassword);
      
      const createUserStmt = db.prepare(`
        INSERT INTO members (
          email,
          password_hash,
          first_name,
          last_name,
          apartment_number,
          phone_number,
          role,
          cooperative_id,
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `);
      
      const result = createUserStmt.run(
        params.email,
        passwordHash,
        params.firstName,
        params.lastName,
        params.apartmentNumber,
        params.phoneNumber || null,
        params.role,
        params.cooperativeId
      );
      
      userId = result.lastInsertRowid?.toString() || '';
      
      // Store credential distribution record
      const invitationToken = generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CREDENTIAL_CONFIG.INVITATION_EXPIRY_DAYS);
      
      const storeCredentialStmt = db.prepare(`
        INSERT INTO credential_distributions (
          user_id,
          cooperative_id,
          email,
          temporary_password_hash,
          invitation_token,
          invitation_expires_at,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      storeCredentialStmt.run(
        userId,
        params.cooperativeId,
        params.email,
        passwordHash,
        invitationToken,
        expiresAt.toISOString(),
        params.createdBy
      );
      
      // Prepare credential object
      const credential: UserCredential = {
        id: userId,
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        apartmentNumber: params.apartmentNumber,
        role: params.role,
        phoneNumber: params.phoneNumber,
        temporaryPassword: tempPassword,
        invitationToken,
        invitationExpiresAt: expiresAt,
        isPasswordTemporary: true
      };
      
      // Send email if requested
      if (params.sendEmail !== false) {
        await sendCredentialEmail(credential, params.cooperativeId);
        
        // Update sent timestamp
        const updateSentStmt = db.prepare(`
          UPDATE credential_distributions 
          SET invitation_sent_at = datetime('now'),
              updated_at = datetime('now')
          WHERE user_id = ?
        `);
        
        updateSentStmt.run(userId);
        
        credential.invitationSentAt = new Date();
      }
      
      return credential;
    }
    
    throw new AuthError(
      AuthErrorType.DUPLICATE_EMAIL,
      'User already exists with this email',
      409
    );
    
  } finally {
    db.close();
  }
}

/**
 * Bulk import users from CSV data
 */
export async function bulkImportUsers(params: {
  csvData: string;
  cooperativeId: string;
  createdBy: string;
  sendEmails?: boolean;
  batchName?: string;
}): Promise<BulkImportResult> {
  const db = getDatabase();
  const result: BulkImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    users: []
  };
  
  try {
    // Parse CSV data
    const lines = params.csvData.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    // Validate headers
    const requiredHeaders = ['email', 'first_name', 'last_name', 'apartment_number', 'role'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new AuthError(
        AuthErrorType.VALIDATION_ERROR,
        `Missing required CSV headers: ${missingHeaders.join(', ')}`,
        400
      );
    }
    
    // Create batch record
    const createBatchStmt = db.prepare(`
      INSERT INTO distribution_batches (
        cooperative_id,
        batch_name,
        total_users,
        status,
        created_by
      ) VALUES (?, ?, ?, 'processing', ?)
    `);
    
    const batchResult = createBatchStmt.run(
      params.cooperativeId,
      params.batchName || `Import ${new Date().toISOString()}`,
      lines.length - 1,
      params.createdBy
    );
    
    const batchId = batchResult.lastInsertRowid?.toString();
    
    // Process each user row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const userData: any = {};
      
      headers.forEach((header, index) => {
        userData[header] = values[index] || '';
      });
      
      try {
        // Validate role
        const validRoles = ['member', 'board', 'chairman', 'treasurer', 'admin'];
        if (!validRoles.includes(userData.role)) {
          throw new Error(`Invalid role: ${userData.role}`);
        }
        
        // Create user credentials
        const credential = await createUserCredentials({
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          apartmentNumber: userData.apartment_number,
          role: userData.role as MemberRole,
          phoneNumber: userData.phone_number,
          cooperativeId: params.cooperativeId,
          createdBy: params.createdBy,
          sendEmail: params.sendEmails
        });
        
        result.users.push(credential);
        result.success++;
        
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          email: userData.email || 'unknown',
          error: error.message
        });
      }
    }
    
    // Update batch status
    const updateBatchStmt = db.prepare(`
      UPDATE distribution_batches 
      SET status = 'completed',
          successful_count = ?,
          failed_count = ?,
          error_log = ?,
          completed_at = datetime('now')
      WHERE id = ?
    `);
    
    updateBatchStmt.run(
      result.success,
      result.failed,
      JSON.stringify(result.errors),
      batchId
    );
    
    return result;
    
  } finally {
    db.close();
  }
}

/**
 * Export users to CSV format
 */
export async function exportUsersToCSV(
  cooperativeId: string,
  includePasswords: boolean = false
): Promise<string> {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      SELECT 
        m.email,
        m.first_name,
        m.last_name,
        m.apartment_number,
        m.role,
        m.phone_number,
        m.is_active,
        cd.invitation_token,
        cd.invitation_sent_at,
        cd.password_changed_at,
        cd.is_password_temporary
      FROM members m
      LEFT JOIN credential_distributions cd ON m.id = cd.user_id
      WHERE m.cooperative_id = ?
      ORDER BY m.apartment_number, m.last_name
    `);
    
    const users = stmt.all(cooperativeId) as any[];
    
    // Build CSV headers
    const headers = [
      'Email',
      'First Name',
      'Last Name',
      'Apartment',
      'Role',
      'Phone',
      'Active',
      'Invitation Sent',
      'Password Changed',
      'Temporary Password'
    ];
    
    if (includePasswords) {
      headers.push('Invitation Token');
    }
    
    // Build CSV rows
    const rows = [headers.join(',')];
    
    for (const user of users) {
      const row = [
        user.email,
        user.first_name,
        user.last_name,
        user.apartment_number,
        user.role,
        user.phone_number || '',
        user.is_active ? 'Yes' : 'No',
        user.invitation_sent_at || 'Not sent',
        user.password_changed_at || 'Not changed',
        user.is_password_temporary ? 'Yes' : 'No'
      ];
      
      if (includePasswords && user.invitation_token) {
        row.push(user.invitation_token);
      }
      
      rows.push(row.map(v => `"${v}"`).join(','));
    }
    
    return rows.join('\n');
    
  } finally {
    db.close();
  }
}

/**
 * Send credential email to user
 */
async function sendCredentialEmail(
  credential: UserCredential,
  cooperativeId: string
): Promise<void> {
  // Get cooperative info
  const db = getDatabase();
  
  try {
    const coopStmt = db.prepare(`
      SELECT name, org_number FROM cooperatives WHERE id = ?
    `);
    
    const coop = coopStmt.get(cooperativeId) as any;
    
    if (!coop) {
      throw new Error('Cooperative not found');
    }
    
    // Prepare email content
    const emailContent = `
      <h2>Välkommen till ${coop.name} BRF Portal!</h2>
      
      <p>Hej ${credential.firstName} ${credential.lastName},</p>
      
      <p>Ditt konto har skapats för BRF-portalen. Här är din inloggningsinformation:</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <strong>E-post:</strong> ${credential.email}<br>
        <strong>Tillfälligt lösenord:</strong> ${credential.temporaryPassword}<br>
        <strong>Roll:</strong> ${credential.role}<br>
        <strong>Lägenhetsnummer:</strong> ${credential.apartmentNumber}
      </div>
      
      <p><strong>Viktigt:</strong> Du måste ändra ditt lösenord vid första inloggningen.</p>
      
      <p>För att komma igång:</p>
      <ol>
        <li>Gå till portalen: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}</li>
        <li>Logga in med ovanstående uppgifter</li>
        <li>Följ instruktionerna för att skapa ett nytt lösenord</li>
      </ol>
      
      <p>Denna inbjudan är giltig i ${CREDENTIAL_CONFIG.INVITATION_EXPIRY_DAYS} dagar.</p>
      
      <p>Om du har några frågor, kontakta styrelsen.</p>
      
      <p>Med vänliga hälsningar,<br>
      ${coop.name} Styrelse</p>
    `;
    
    // Send mock email (would be real email service in production)
    await sendMockEmail({
      to: credential.email,
      subject: `Välkommen till ${coop.name} BRF Portal`,
      html: emailContent
    });
    
  } finally {
    db.close();
  }
}

/**
 * Resend credentials to a user
 */
export async function resendCredentials(
  userId: string,
  adminUserId: string
): Promise<void> {
  const db = getDatabase();
  
  try {
    // Get existing credential record
    const getCredentialStmt = db.prepare(`
      SELECT * FROM credential_distributions WHERE user_id = ?
    `);
    
    const credential = getCredentialStmt.get(userId) as any;
    
    if (!credential) {
      throw new AuthError(
        AuthErrorType.NOT_FOUND,
        'No credential distribution record found',
        404
      );
    }
    
    // Check resend count
    if (credential.resend_count >= CREDENTIAL_CONFIG.MAX_RESEND_COUNT) {
      throw new AuthError(
        AuthErrorType.RATE_LIMIT,
        'Maximum resend count exceeded',
        429
      );
    }
    
    // Get user details
    const getUserStmt = db.prepare(`
      SELECT * FROM members WHERE id = ?
    `);
    
    const user = getUserStmt.get(userId) as any;
    
    if (!user) {
      throw new AuthError(
        AuthErrorType.NOT_FOUND,
        'User not found',
        404
      );
    }
    
    // Generate new temporary password
    const newTempPassword = generateTemporaryPassword();
    const newPasswordHash = await hashPassword(newTempPassword);
    
    // Update user password
    const updatePasswordStmt = db.prepare(`
      UPDATE members 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    
    updatePasswordStmt.run(newPasswordHash, userId);
    
    // Update credential distribution record
    const updateCredentialStmt = db.prepare(`
      UPDATE credential_distributions 
      SET temporary_password_hash = ?,
          invitation_sent_at = datetime('now'),
          resend_count = resend_count + 1,
          updated_at = datetime('now')
      WHERE user_id = ?
    `);
    
    updateCredentialStmt.run(newPasswordHash, userId);
    
    // Prepare credential object for email
    const userCredential: UserCredential = {
      id: userId,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      apartmentNumber: user.apartment_number,
      role: user.role as MemberRole,
      phoneNumber: user.phone_number,
      temporaryPassword: newTempPassword,
      invitationToken: credential.invitation_token
    };
    
    // Send email
    await sendCredentialEmail(userCredential, user.cooperative_id);
    
  } finally {
    db.close();
  }
}

/**
 * Get credential distribution status for a cooperative
 */
export async function getCredentialDistributionStatus(
  cooperativeId: string
): Promise<{
  totalUsers: number;
  invitationsSent: number;
  passwordsChanged: number;
  pendingInvitations: number;
  expiredInvitations: number;
}> {
  const db = getDatabase();
  
  try {
    const statsStmt = db.prepare(`
      SELECT 
        COUNT(DISTINCT m.id) as total_users,
        COUNT(DISTINCT CASE WHEN cd.invitation_sent_at IS NOT NULL THEN cd.user_id END) as invitations_sent,
        COUNT(DISTINCT CASE WHEN cd.password_changed_at IS NOT NULL THEN cd.user_id END) as passwords_changed,
        COUNT(DISTINCT CASE 
          WHEN cd.invitation_sent_at IS NOT NULL 
            AND cd.password_changed_at IS NULL 
            AND datetime(cd.invitation_expires_at) > datetime('now') 
          THEN cd.user_id 
        END) as pending_invitations,
        COUNT(DISTINCT CASE 
          WHEN cd.invitation_sent_at IS NOT NULL 
            AND cd.password_changed_at IS NULL 
            AND datetime(cd.invitation_expires_at) <= datetime('now') 
          THEN cd.user_id 
        END) as expired_invitations
      FROM members m
      LEFT JOIN credential_distributions cd ON m.id = cd.user_id
      WHERE m.cooperative_id = ?
    `);
    
    const stats = statsStmt.get(cooperativeId) as any;
    
    return {
      totalUsers: stats.total_users || 0,
      invitationsSent: stats.invitations_sent || 0,
      passwordsChanged: stats.passwords_changed || 0,
      pendingInvitations: stats.pending_invitations || 0,
      expiredInvitations: stats.expired_invitations || 0
    };
    
  } finally {
    db.close();
  }
}