/**
 * Two-Factor Authentication (2FA) utilities for BRF Portal
 * Implements TOTP (Time-based One-Time Password) and backup code functionality
 * Following RFC 6238 standard with Swedish localization
 */

import crypto from 'crypto';
import Database from 'better-sqlite3';
import { AuthError, AuthErrorType } from './types';

/**
 * TOTP configuration constants
 */
export const TOTP_CONFIG = {
  // Standard TOTP configuration
  SECRET_LENGTH: 32, // 32 bytes = 256 bits
  DIGITS: 6, // 6-digit codes
  PERIOD: 30, // 30-second time windows
  ALGORITHM: 'SHA1' as const, // SHA1 for compatibility
  WINDOW_SIZE: 1, // Allow 1 time step tolerance for clock drift
  
  // Backup codes configuration
  BACKUP_CODE_LENGTH: 8, // 8 characters
  BACKUP_CODE_COUNT: 10, // 10 backup codes
  BACKUP_CODE_CHARS: 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789', // Excluding ambiguous chars
  
  // Rate limiting
  MAX_ATTEMPTS_PER_15MIN: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  
  // Setup timeouts
  SETUP_TOKEN_VALIDITY_MINUTES: 10,
};

/**
 * Encryption configuration for storing secrets
 */
const ENCRYPTION_CONFIG = {
  ALGORITHM: 'aes-256-gcm',
  IV_LENGTH: 16,
  TAG_LENGTH: 16,
  KEY_LENGTH: 32,
};

/**
 * Database connection singleton
 */
let db: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || './database/brf.db';
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key) {
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'TOTP_ENCRYPTION_KEY environment variable is required',
      500
    );
  }
  
  if (key.length < 64) { // 32 bytes in hex = 64 characters
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'TOTP_ENCRYPTION_KEY must be at least 64 hex characters (32 bytes)',
      500
    );
  }
  
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
function encryptData(data: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);
  const cipher = crypto.createCipher(ENCRYPTION_CONFIG.ALGORITHM, key);
  cipher.setAAD(Buffer.from('totp-secret')); // Additional authenticated data
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt sensitive data using AES-256-GCM
 */
function decryptData(encrypted: string, ivHex: string, tagHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipher(ENCRYPTION_CONFIG.ALGORITHM, key);
  decipher.setAAD(Buffer.from('totp-secret'));
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate a cryptographically secure TOTP secret
 */
export function generateTOTPSecret(): string {
  return crypto.randomBytes(TOTP_CONFIG.SECRET_LENGTH).toString('base32');
}

/**
 * Generate TOTP URI for QR code generation
 */
export function generateTOTPUri(
  secret: string,
  userEmail: string,
  cooperativeName: string,
  issuer: string = 'BRF Portal'
): string {
  const encodedEmail = encodeURIComponent(userEmail);
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedCooperative = encodeURIComponent(cooperativeName);
  
  const label = `${encodedIssuer}:${encodedEmail} (${encodedCooperative})`;
  
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodedIssuer}&algorithm=${TOTP_CONFIG.ALGORITHM}&digits=${TOTP_CONFIG.DIGITS}&period=${TOTP_CONFIG.PERIOD}`;
}

/**
 * Calculate TOTP code for a given secret and timestamp
 */
function calculateTOTP(secret: string, timestamp?: number): string {
  const time = Math.floor((timestamp || Date.now()) / 1000);
  const timeCounter = Math.floor(time / TOTP_CONFIG.PERIOD);
  
  // Convert base32 secret to buffer
  const secretBuffer = Buffer.from(secret, 'base32');
  
  // Create time counter as 8-byte big-endian buffer
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(0, 0);
  counterBuffer.writeUInt32BE(timeCounter, 4);
  
  // Generate HMAC
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(counterBuffer);
  const digest = hmac.digest();
  
  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0xf;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % Math.pow(10, TOTP_CONFIG.DIGITS);
  
  // Pad with leading zeros
  return code.toString().padStart(TOTP_CONFIG.DIGITS, '0');
}

/**
 * Verify TOTP code with time window tolerance
 */
export function verifyTOTP(secret: string, providedCode: string, timestamp?: number): boolean {
  const time = timestamp || Date.now();
  
  // Check current time window and adjacent windows for clock drift tolerance
  for (let i = -TOTP_CONFIG.WINDOW_SIZE; i <= TOTP_CONFIG.WINDOW_SIZE; i++) {
    const windowTime = time + (i * TOTP_CONFIG.PERIOD * 1000);
    const expectedCode = calculateTOTP(secret, windowTime);
    
    if (crypto.timingSafeEqual(
      Buffer.from(expectedCode, 'utf8'),
      Buffer.from(providedCode.padStart(TOTP_CONFIG.DIGITS, '0'), 'utf8')
    )) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < TOTP_CONFIG.BACKUP_CODE_COUNT; i++) {
    let code = '';
    for (let j = 0; j < TOTP_CONFIG.BACKUP_CODE_LENGTH; j++) {
      const randomIndex = crypto.randomInt(0, TOTP_CONFIG.BACKUP_CODE_CHARS.length);
      code += TOTP_CONFIG.BACKUP_CODE_CHARS[randomIndex];
    }
    codes.push(code);
  }
  
  return codes;
}

/**
 * Hash backup code for secure storage
 */
function hashBackupCode(code: string, salt: string): string {
  return crypto.pbkdf2Sync(code.toUpperCase(), salt, 100000, 32, 'sha256').toString('hex');
}

/**
 * Generate salt for backup code hashing
 */
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Check if user has rate limit for 2FA attempts
 */
async function checkRateLimit(userId: string, ip: string, attemptType: string): Promise<boolean> {
  const database = getDatabase();
  const fifteenMinutesAgo = new Date(Date.now() - (15 * 60 * 1000)).toISOString();
  
  const attempts = database.prepare(`
    SELECT COUNT(*) as count
    FROM two_factor_attempts 
    WHERE (user_id = ? OR request_ip = ?)
      AND attempt_type = ?
      AND created_at > ?
      AND is_successful = 0
  `).get(userId, ip, attemptType) as { count: number };
  
  return attempts.count >= TOTP_CONFIG.MAX_ATTEMPTS_PER_15MIN;
}

/**
 * Log 2FA attempt
 */
async function logTwoFactorAttempt(
  cooperativeId: string,
  userId: string | null,
  attemptType: string,
  ip: string,
  userAgent: string | null,
  providedCode: string,
  isSuccessful: boolean,
  failureReason?: string
): Promise<void> {
  const database = getDatabase();
  
  // Hash the provided code for audit purposes (never store plaintext)
  const codeHash = crypto.createHash('sha256').update(providedCode).digest('hex');
  
  database.prepare(`
    INSERT INTO two_factor_attempts (
      cooperative_id, user_id, attempt_type, request_ip, user_agent,
      provided_code, is_successful, failure_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cooperativeId,
    userId,
    attemptType,
    ip,
    userAgent,
    codeHash,
    isSuccessful ? 1 : 0,
    failureReason || null
  );
}

/**
 * Log 2FA audit event
 */
export async function logTwoFactorAudit(
  cooperativeId: string,
  userId: string | null,
  eventType: string,
  eventDescription: string,
  ip?: string,
  userAgent?: string,
  eventData: Record<string, any> = {},
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
): Promise<void> {
  const database = getDatabase();
  
  // Set GDPR retention period (typically 2 years for security logs)
  const retentionUntil = new Date();
  retentionUntil.setFullYear(retentionUntil.getFullYear() + 2);
  
  database.prepare(`
    INSERT INTO two_factor_audit_log (
      cooperative_id, user_id, event_type, event_description,
      ip_address, user_agent, event_data, risk_level,
      gdpr_category, retention_until
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cooperativeId,
    userId,
    eventType,
    eventDescription,
    ip || null,
    userAgent || null,
    JSON.stringify(eventData),
    riskLevel,
    'security_logs',
    retentionUntil.toISOString()
  );
}

/**
 * Initialize 2FA setup for a user
 */
export interface TwoFactorSetup {
  secret: string;
  qrCodeUri: string;
  setupToken: string;
  backupCodes: string[];
  expiresAt: Date;
}

export async function initializeTwoFactorSetup(
  userId: string,
  cooperativeId: string,
  userEmail: string,
  cooperativeName: string
): Promise<TwoFactorSetup> {
  const database = getDatabase();
  
  // Check if user already has 2FA enabled
  const existing = database.prepare(`
    SELECT is_verified FROM two_factor_secrets WHERE user_id = ?
  `).get(userId) as { is_verified: number } | undefined;
  
  if (existing && existing.is_verified) {
    throw new AuthError(
      AuthErrorType.VALIDATION_ERROR,
      'Tvåfaktorsautentisering är redan aktiverad för detta konto',
      400
    );
  }
  
  // Generate new secret and setup token
  const secret = generateTOTPSecret();
  const setupToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + (TOTP_CONFIG.SETUP_TOKEN_VALIDITY_MINUTES * 60 * 1000));
  
  // Encrypt the secret for storage
  const { encrypted, iv, tag } = encryptData(secret);
  const encryptedData = `${encrypted}:${tag}`; // Combine encrypted data and auth tag
  
  // Generate backup codes
  const backupCodes = generateBackupCodes();
  const generationBatch = crypto.randomUUID();
  
  // Start transaction
  database.exec('BEGIN TRANSACTION');
  
  try {
    // Store or update 2FA secret (unverified)
    database.prepare(`
      INSERT OR REPLACE INTO two_factor_secrets (
        cooperative_id, user_id, secret_encrypted, encryption_iv,
        algorithm, digits, period, is_verified, setup_token, setup_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cooperativeId,
      userId,
      encryptedData,
      iv,
      TOTP_CONFIG.ALGORITHM,
      TOTP_CONFIG.DIGITS,
      TOTP_CONFIG.PERIOD,
      0, // Not verified yet
      setupToken,
      expiresAt.toISOString()
    );
    
    // Clear any existing backup codes
    database.prepare(`
      DELETE FROM two_factor_backup_codes WHERE user_id = ?
    `).run(userId);
    
    // Store new backup codes
    const stmt = database.prepare(`
      INSERT INTO two_factor_backup_codes (
        cooperative_id, user_id, code_hash, code_salt,
        generation_batch, sequence_number
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    backupCodes.forEach((code, index) => {
      const salt = generateSalt();
      const hash = hashBackupCode(code, salt);
      
      stmt.run(
        cooperativeId,
        userId,
        hash,
        salt,
        generationBatch,
        index + 1
      );
    });
    
    database.exec('COMMIT');
    
    // Generate QR code URI
    const qrCodeUri = generateTOTPUri(secret, userEmail, cooperativeName);
    
    // Log audit event
    await logTwoFactorAudit(
      cooperativeId,
      userId,
      'setup_initiated',
      'Tvåfaktorsautentisering setup påbörjad',
      undefined,
      undefined,
      { setupToken, algorithm: TOTP_CONFIG.ALGORITHM },
      'medium'
    );
    
    return {
      secret,
      qrCodeUri,
      setupToken,
      backupCodes,
      expiresAt,
    };
    
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Verify and complete 2FA setup
 */
export async function completeTwoFactorSetup(
  setupToken: string,
  providedCode: string,
  ip: string,
  userAgent?: string
): Promise<{ success: boolean; userId?: string; cooperativeId?: string }> {
  const database = getDatabase();
  
  // Find setup record
  const setup = database.prepare(`
    SELECT 
      s.user_id, s.cooperative_id, s.secret_encrypted, s.encryption_iv,
      s.setup_expires_at, m.email
    FROM two_factor_secrets s
    JOIN members m ON s.user_id = m.id
    WHERE s.setup_token = ? 
      AND s.is_verified = 0
      AND s.setup_expires_at > datetime('now')
  `).get(setupToken) as {
    user_id: string;
    cooperative_id: string;
    secret_encrypted: string;
    encryption_iv: string;
    setup_expires_at: string;
    email: string;
  } | undefined;
  
  if (!setup) {
    await logTwoFactorAttempt(
      'unknown',
      null,
      'setup_verify',
      ip,
      userAgent,
      providedCode,
      false,
      'Invalid or expired setup token'
    );
    
    throw new AuthError(
      AuthErrorType.INVALID_TOKEN,
      'Ogiltigt eller utgånget setup-token',
      400
    );
  }
  
  // Check rate limiting
  if (await checkRateLimit(setup.user_id, ip, 'setup_verify')) {
    await logTwoFactorAttempt(
      setup.cooperative_id,
      setup.user_id,
      'setup_verify',
      ip,
      userAgent,
      providedCode,
      false,
      'Rate limit exceeded'
    );
    
    throw new AuthError(
      AuthErrorType.RATE_LIMIT_EXCEEDED,
      'För många försök. Vänta 15 minuter innan du försöker igen.',
      429
    );
  }
  
  try {
    // Decrypt secret
    const [encrypted, tag] = setup.secret_encrypted.split(':');
    const secret = decryptData(encrypted, setup.encryption_iv, tag);
    
    // Verify TOTP code
    if (!verifyTOTP(secret, providedCode)) {
      await logTwoFactorAttempt(
        setup.cooperative_id,
        setup.user_id,
        'setup_verify',
        ip,
        userAgent,
        providedCode,
        false,
        'Invalid TOTP code'
      );
      
      throw new AuthError(
        AuthErrorType.INVALID_CREDENTIALS,
        'Fel verifieringskod. Kontrollera att klockan på din enhet är korrekt.',
        400
      );
    }
    
    // Mark as verified
    database.prepare(`
      UPDATE two_factor_secrets 
      SET is_verified = 1, 
          verified_at = datetime('now'),
          setup_token = NULL,
          setup_expires_at = NULL,
          last_used_at = datetime('now'),
          usage_count = 1
      WHERE user_id = ?
    `).run(setup.user_id);
    
    // Log successful attempt
    await logTwoFactorAttempt(
      setup.cooperative_id,
      setup.user_id,
      'setup_verify',
      ip,
      userAgent,
      providedCode,
      true
    );
    
    // Log audit event
    await logTwoFactorAudit(
      setup.cooperative_id,
      setup.user_id,
      'setup_completed',
      'Tvåfaktorsautentisering aktiverad',
      ip,
      userAgent,
      { algorithm: TOTP_CONFIG.ALGORITHM },
      'medium'
    );
    
    return {
      success: true,
      userId: setup.user_id,
      cooperativeId: setup.cooperative_id,
    };
    
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    
    await logTwoFactorAttempt(
      setup.cooperative_id,
      setup.user_id,
      'setup_verify',
      ip,
      userAgent,
      providedCode,
      false,
      'Internal error during verification'
    );
    
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Ett fel uppstod vid verifiering av tvåfaktorsautentisering',
      500
    );
  }
}

/**
 * Verify 2FA code during login
 */
export async function verifyTwoFactorCode(
  userId: string,
  providedCode: string,
  ip: string,
  userAgent?: string
): Promise<{ success: boolean; isBackupCode?: boolean }> {
  const database = getDatabase();
  
  // Get user's 2FA configuration
  const config = database.prepare(`
    SELECT 
      s.cooperative_id, s.secret_encrypted, s.encryption_iv,
      s.is_verified, s.last_verified_code
    FROM two_factor_secrets s
    WHERE s.user_id = ? AND s.is_verified = 1
  `).get(userId) as {
    cooperative_id: string;
    secret_encrypted: string;
    encryption_iv: string;
    is_verified: number;
    last_verified_code: string | null;
  } | undefined;
  
  if (!config) {
    throw new AuthError(
      AuthErrorType.VALIDATION_ERROR,
      'Tvåfaktorsautentisering är inte aktiverad för detta konto',
      400
    );
  }
  
  // Check rate limiting
  if (await checkRateLimit(userId, ip, 'totp')) {
    await logTwoFactorAttempt(
      config.cooperative_id,
      userId,
      'totp',
      ip,
      userAgent,
      providedCode,
      false,
      'Rate limit exceeded'
    );
    
    throw new AuthError(
      AuthErrorType.RATE_LIMIT_EXCEEDED,
      'För många försök. Vänta 15 minuter innan du försöker igen.',
      429
    );
  }
  
  // Check if it's a backup code first
  const backupCodeResult = await verifyBackupCode(userId, providedCode, ip, userAgent);
  if (backupCodeResult.success) {
    return { success: true, isBackupCode: true };
  }
  
  try {
    // Decrypt TOTP secret
    const [encrypted, tag] = config.secret_encrypted.split(':');
    const secret = decryptData(encrypted, config.encryption_iv, tag);
    
    // Prevent code replay attack
    const codeHash = crypto.createHash('sha256').update(providedCode).digest('hex');
    if (config.last_verified_code === codeHash) {
      await logTwoFactorAttempt(
        config.cooperative_id,
        userId,
        'totp',
        ip,
        userAgent,
        providedCode,
        false,
        'Code replay attempt'
      );
      
      throw new AuthError(
        AuthErrorType.INVALID_CREDENTIALS,
        'Denna kod har redan använts. Vänta på nästa kod.',
        400
      );
    }
    
    // Verify TOTP code
    if (!verifyTOTP(secret, providedCode)) {
      await logTwoFactorAttempt(
        config.cooperative_id,
        userId,
        'totp',
        ip,
        userAgent,
        providedCode,
        false,
        'Invalid TOTP code'
      );
      
      throw new AuthError(
        AuthErrorType.INVALID_CREDENTIALS,
        'Fel verifieringskod. Kontrollera att klockan på din enhet är korrekt.',
        400
      );
    }
    
    // Update last verified code and usage
    database.prepare(`
      UPDATE two_factor_secrets 
      SET last_used_at = datetime('now'),
          usage_count = usage_count + 1,
          last_verified_code = ?
      WHERE user_id = ?
    `).run(codeHash, userId);
    
    // Log successful attempt
    await logTwoFactorAttempt(
      config.cooperative_id,
      userId,
      'totp',
      ip,
      userAgent,
      providedCode,
      true
    );
    
    // Log audit event
    await logTwoFactorAudit(
      config.cooperative_id,
      userId,
      'totp_verified',
      'TOTP-kod verifierad vid inloggning',
      ip,
      userAgent,
      {},
      'low'
    );
    
    return { success: true, isBackupCode: false };
    
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    
    await logTwoFactorAttempt(
      config.cooperative_id,
      userId,
      'totp',
      ip,
      userAgent,
      providedCode,
      false,
      'Internal error during verification'
    );
    
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Ett fel uppstod vid verifiering av tvåfaktorsautentisering',
      500
    );
  }
}

/**
 * Verify backup code
 */
export async function verifyBackupCode(
  userId: string,
  providedCode: string,
  ip: string,
  userAgent?: string
): Promise<{ success: boolean }> {
  const database = getDatabase();
  
  // Normalize code (uppercase, remove spaces)
  const normalizedCode = providedCode.toUpperCase().replace(/\s/g, '');
  
  if (normalizedCode.length !== TOTP_CONFIG.BACKUP_CODE_LENGTH) {
    return { success: false };
  }
  
  // Check rate limiting
  if (await checkRateLimit(userId, ip, 'backup_code')) {
    throw new AuthError(
      AuthErrorType.RATE_LIMIT_EXCEEDED,
      'För många försök. Vänta 15 minuter innan du försöker igen.',
      429
    );
  }
  
  // Get all unused backup codes for user
  const backupCodes = database.prepare(`
    SELECT 
      bc.id, bc.cooperative_id, bc.code_hash, bc.code_salt, bc.sequence_number
    FROM two_factor_backup_codes bc
    JOIN two_factor_secrets s ON bc.user_id = s.user_id
    WHERE bc.user_id = ? 
      AND bc.is_used = 0
      AND s.is_verified = 1
  `).all(userId) as Array<{
    id: string;
    cooperative_id: string;
    code_hash: string;
    code_salt: string;
    sequence_number: number;
  }>;
  
  if (backupCodes.length === 0) {
    return { success: false };
  }
  
  // Check each backup code
  for (const backupCode of backupCodes) {
    const expectedHash = hashBackupCode(normalizedCode, backupCode.code_salt);
    
    if (crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(backupCode.code_hash, 'hex')
    )) {
      // Mark backup code as used
      database.prepare(`
        UPDATE two_factor_backup_codes 
        SET is_used = 1, 
            used_at = datetime('now'),
            used_ip = ?,
            used_user_agent = ?
        WHERE id = ?
      `).run(ip, userAgent, backupCode.id);
      
      // Log successful attempt
      await logTwoFactorAttempt(
        backupCode.cooperative_id,
        userId,
        'backup_code',
        ip,
        userAgent,
        providedCode,
        true
      );
      
      // Log audit event
      await logTwoFactorAudit(
        backupCode.cooperative_id,
        userId,
        'backup_code_used',
        `Backup-kod #${backupCode.sequence_number} använd vid inloggning`,
        ip,
        userAgent,
        { sequenceNumber: backupCode.sequence_number },
        'medium'
      );
      
      return { success: true };
    }
  }
  
  // No matching backup code found
  await logTwoFactorAttempt(
    backupCodes[0]?.cooperative_id || 'unknown',
    userId,
    'backup_code',
    ip,
    userAgent,
    providedCode,
    false,
    'Invalid backup code'
  );
  
  return { success: false };
}

/**
 * Generate new backup codes (regenerate)
 */
export async function regenerateBackupCodes(
  userId: string,
  cooperativeId: string
): Promise<string[]> {
  const database = getDatabase();
  
  // Check if 2FA is enabled
  const config = database.prepare(`
    SELECT is_verified FROM two_factor_secrets 
    WHERE user_id = ? AND is_verified = 1
  `).get(userId) as { is_verified: number } | undefined;
  
  if (!config) {
    throw new AuthError(
      AuthErrorType.VALIDATION_ERROR,
      'Tvåfaktorsautentisering är inte aktiverad för detta konto',
      400
    );
  }
  
  // Generate new backup codes
  const backupCodes = generateBackupCodes();
  const generationBatch = crypto.randomUUID();
  
  // Start transaction
  database.exec('BEGIN TRANSACTION');
  
  try {
    // Delete old backup codes
    database.prepare(`
      DELETE FROM two_factor_backup_codes WHERE user_id = ?
    `).run(userId);
    
    // Store new backup codes
    const stmt = database.prepare(`
      INSERT INTO two_factor_backup_codes (
        cooperative_id, user_id, code_hash, code_salt,
        generation_batch, sequence_number
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    backupCodes.forEach((code, index) => {
      const salt = generateSalt();
      const hash = hashBackupCode(code, salt);
      
      stmt.run(
        cooperativeId,
        userId,
        hash,
        salt,
        generationBatch,
        index + 1
      );
    });
    
    database.exec('COMMIT');
    
    // Log audit event
    await logTwoFactorAudit(
      cooperativeId,
      userId,
      'backup_codes_regenerated',
      'Backup-koder regenererade',
      undefined,
      undefined,
      { generationBatch, count: backupCodes.length },
      'medium'
    );
    
    return backupCodes;
    
  } catch (error) {
    database.exec('ROLLBACK');
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Ett fel uppstod vid generering av backup-koder',
      500
    );
  }
}

/**
 * Disable 2FA for a user
 */
export async function disableTwoFactor(
  userId: string,
  cooperativeId: string,
  ip: string,
  userAgent?: string,
  reason: string = 'User requested'
): Promise<void> {
  const database = getDatabase();
  
  // Start transaction
  database.exec('BEGIN TRANSACTION');
  
  try {
    // Delete 2FA secret
    database.prepare(`
      DELETE FROM two_factor_secrets WHERE user_id = ?
    `).run(userId);
    
    // Delete backup codes
    database.prepare(`
      DELETE FROM two_factor_backup_codes WHERE user_id = ?
    `).run(userId);
    
    database.exec('COMMIT');
    
    // Log audit event
    await logTwoFactorAudit(
      cooperativeId,
      userId,
      'disabled',
      'Tvåfaktorsautentisering inaktiverad',
      ip,
      userAgent,
      { reason },
      'high'
    );
    
  } catch (error) {
    database.exec('ROLLBACK');
    throw new AuthError(
      AuthErrorType.INTERNAL_ERROR,
      'Ett fel uppstod vid inaktivering av tvåfaktorsautentisering',
      500
    );
  }
}

/**
 * Check if user has 2FA enabled
 */
export async function hasTwoFactorEnabled(userId: string): Promise<boolean> {
  const database = getDatabase();
  
  const result = database.prepare(`
    SELECT is_verified FROM two_factor_secrets 
    WHERE user_id = ? AND is_verified = 1
  `).get(userId) as { is_verified: number } | undefined;
  
  return Boolean(result?.is_verified);
}

/**
 * Get 2FA status for user
 */
export interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining: number;
  lastUsed?: Date;
  usageCount: number;
}

export async function getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const database = getDatabase();
  
  const config = database.prepare(`
    SELECT is_verified, last_used_at, usage_count
    FROM two_factor_secrets 
    WHERE user_id = ?
  `).get(userId) as {
    is_verified: number;
    last_used_at: string | null;
    usage_count: number;
  } | undefined;
  
  if (!config || !config.is_verified) {
    return {
      enabled: false,
      backupCodesRemaining: 0,
      usageCount: 0,
    };
  }
  
  const backupCodes = database.prepare(`
    SELECT COUNT(*) as count
    FROM two_factor_backup_codes 
    WHERE user_id = ? AND is_used = 0
  `).get(userId) as { count: number };
  
  return {
    enabled: true,
    backupCodesRemaining: backupCodes.count,
    lastUsed: config.last_used_at ? new Date(config.last_used_at) : undefined,
    usageCount: config.usage_count || 0,
  };
}

/**
 * Cleanup expired setup tokens
 */
export async function cleanupExpiredSetupTokens(): Promise<number> {
  const database = getDatabase();
  
  const result = database.prepare(`
    DELETE FROM two_factor_secrets 
    WHERE is_verified = 0 
      AND setup_expires_at < datetime('now')
  `).run();
  
  return result.changes;
}

/**
 * Swedish error messages for 2FA
 */
export const TwoFactorErrors = {
  SETUP_ALREADY_ENABLED: 'Tvåfaktorsautentisering är redan aktiverad för detta konto',
  SETUP_TOKEN_INVALID: 'Ogiltigt eller utgånget setup-token',
  CODE_INVALID: 'Fel verifieringskod. Kontrollera att klockan på din enhet är korrekt.',
  CODE_ALREADY_USED: 'Denna kod har redan använts. Vänta på nästa kod.',
  RATE_LIMIT_EXCEEDED: 'För många försök. Vänta 15 minuter innan du försöker igen.',
  NOT_ENABLED: 'Tvåfaktorsautentisering är inte aktiverad för detta konto',
  BACKUP_CODE_INVALID: 'Ogiltig backup-kod',
  INTERNAL_ERROR: 'Ett fel uppstod vid verifiering av tvåfaktorsautentisering',
} as const;