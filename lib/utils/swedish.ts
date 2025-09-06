/**
 * Swedish utility functions for BRF Portal
 * Handles personnummer validation, formatting, and Swedish-specific utilities
 */

/**
 * Swedish personnummer format validation and formatting
 * Supports both 10-digit (YYMMDD-NNNN) and 12-digit (YYYYMMDD-NNNN) formats
 */

export interface PersonnummerInfo {
  isValid: boolean;
  formatted: string;
  birthDate: Date | null;
  age: number | null;
  century: number | null;
  gender: 'male' | 'female' | null;
}

/**
 * Validates a Swedish personnummer (personal identity number)
 * @param personnummer - The personnummer to validate
 * @returns PersonnummerInfo object with validation results and parsed information
 */
export function validatePersonnummer(personnummer: string): PersonnummerInfo {
  const result: PersonnummerInfo = {
    isValid: false,
    formatted: '',
    birthDate: null,
    age: null,
    century: null,
    gender: null,
  };

  if (!personnummer) {
    return result;
  }

  // Remove all non-digit characters
  const cleaned = personnummer.replace(/\D/g, '');

  // Must be exactly 10 or 12 digits
  if (cleaned.length !== 10 && cleaned.length !== 12) {
    return result;
  }

  let year: number;
  let month: number;
  let day: number;
  let lastFour: string;

  if (cleaned.length === 12) {
    // YYYYMMDDNNNN format
    year = parseInt(cleaned.substring(0, 4));
    month = parseInt(cleaned.substring(4, 6));
    day = parseInt(cleaned.substring(6, 8));
    lastFour = cleaned.substring(8, 12);
  } else {
    // YYMMDDNNNN format
    const yy = parseInt(cleaned.substring(0, 2));
    month = parseInt(cleaned.substring(2, 4));
    day = parseInt(cleaned.substring(4, 6));
    lastFour = cleaned.substring(6, 10);

    // Determine century based on age
    const currentYear = new Date().getFullYear();
    const currentYearTwoDigit = currentYear % 100;
    
    // If YY is less than or equal to current year's last two digits, assume 2000s
    // Otherwise, assume 1900s
    if (yy <= currentYearTwoDigit + 10) {
      year = 2000 + yy;
    } else {
      year = 1900 + yy;
    }
  }

  // Validate date components
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return result;
  }

  // Check if the date is valid
  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return result;
  }

  // Check if birth date is not in the future
  if (birthDate > new Date()) {
    return result;
  }

  // Validate checksum using Luhn algorithm
  const digits = cleaned.slice(-10); // Always use last 10 digits for checksum
  let sum = 0;
  
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(digits[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit = digit - 9;
      }
    }
    sum += digit;
  }
  
  const checksumDigit = (10 - (sum % 10)) % 10;
  const providedChecksum = parseInt(digits[9]);
  
  if (checksumDigit !== providedChecksum) {
    return result;
  }

  // Calculate age
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // Determine gender (next-to-last digit)
  const genderDigit = parseInt(lastFour[2]);
  const gender = genderDigit % 2 === 0 ? 'female' : 'male';

  // Format the personnummer
  const formattedYear = cleaned.length === 12 ? cleaned.substring(0, 4) : cleaned.substring(0, 2);
  const formatted = `${formattedYear}${cleaned.substring(cleaned.length - 8, cleaned.length - 4)}-${lastFour}`;

  result.isValid = true;
  result.formatted = formatted;
  result.birthDate = birthDate;
  result.age = age;
  result.century = Math.floor(year / 100) + 1;
  result.gender = gender;

  return result;
}

/**
 * Formats a personnummer string with proper formatting
 * @param personnummer - Raw personnummer string
 * @returns Formatted personnummer or empty string if invalid
 */
export function formatPersonnummer(personnummer: string): string {
  const info = validatePersonnummer(personnummer);
  return info.isValid ? info.formatted : '';
}

/**
 * Strips formatting from a personnummer
 * @param personnummer - Formatted personnummer
 * @returns Unformatted personnummer digits only
 */
export function stripPersonnummerFormatting(personnummer: string): string {
  return personnummer.replace(/\D/g, '');
}

/**
 * Swedish organizational number (organisationsnummer) validation
 * @param orgNumber - Organization number to validate
 * @returns boolean indicating if the organization number is valid
 */
export function validateOrganizationNumber(orgNumber: string): boolean {
  if (!orgNumber) return false;

  // Remove all non-digit characters
  const cleaned = orgNumber.replace(/\D/g, '');

  // Must be exactly 10 digits
  if (cleaned.length !== 10) return false;

  // First digit must be >= 1 for organization numbers
  const firstDigit = parseInt(cleaned[0]);
  if (firstDigit < 1) return false;

  // Validate using Luhn algorithm (same as personnummer)
  let sum = 0;
  
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(cleaned[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit = digit - 9;
      }
    }
    sum += digit;
  }
  
  const checksumDigit = (10 - (sum % 10)) % 10;
  const providedChecksum = parseInt(cleaned[9]);
  
  return checksumDigit === providedChecksum;
}

/**
 * Formats a Swedish organization number
 * @param orgNumber - Raw organization number
 * @returns Formatted organization number (XXXXXX-XXXX)
 */
export function formatOrganizationNumber(orgNumber: string): string {
  if (!validateOrganizationNumber(orgNumber)) return '';
  
  const cleaned = orgNumber.replace(/\D/g, '');
  return `${cleaned.substring(0, 6)}-${cleaned.substring(6)}`;
}

/**
 * Swedish postal code validation
 * @param postalCode - Postal code to validate
 * @returns boolean indicating if postal code is valid
 */
export function validateSwedishPostalCode(postalCode: string): boolean {
  if (!postalCode) return false;
  
  // Remove spaces and validate format (5 digits with optional space after 3rd digit)
  const cleaned = postalCode.replace(/\s/g, '');
  return /^\d{5}$/.test(cleaned);
}

/**
 * Formats a Swedish postal code
 * @param postalCode - Raw postal code
 * @returns Formatted postal code (XXX XX)
 */
export function formatSwedishPostalCode(postalCode: string): string {
  if (!validateSwedishPostalCode(postalCode)) return '';
  
  const cleaned = postalCode.replace(/\s/g, '');
  return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
}

/**
 * Swedish phone number validation and formatting
 * @param phoneNumber - Phone number to validate
 * @returns Object with validation result and formatted number
 */
export interface SwedishPhoneInfo {
  isValid: boolean;
  formatted: string;
  type: 'mobile' | 'landline' | 'toll-free' | 'unknown';
}

export function validateSwedishPhoneNumber(phoneNumber: string): SwedishPhoneInfo {
  const result: SwedishPhoneInfo = {
    isValid: false,
    formatted: '',
    type: 'unknown',
  };

  if (!phoneNumber) return result;

  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Handle international format
  if (cleaned.startsWith('+46')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('46') && cleaned.length > 10) {
    cleaned = '0' + cleaned.substring(2);
  }

  // Must start with 0 and be 10 digits total
  if (!cleaned.startsWith('0') || cleaned.length !== 10) {
    return result;
  }

  // Determine phone type based on area code
  const areaCode = cleaned.substring(1, 3);
  let type: SwedishPhoneInfo['type'] = 'unknown';

  if (['70', '72', '73', '76', '79'].includes(areaCode)) {
    type = 'mobile';
  } else if (['20', '23', '31', '33', '40', '42', '44', '46', '54', '60', '63', '90', '99'].includes(areaCode)) {
    type = 'toll-free';
  } else {
    type = 'landline';
  }

  // Format the number
  let formatted: string;
  if (type === 'mobile') {
    formatted = `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)} ${cleaned.substring(6, 8)} ${cleaned.substring(8)}`;
  } else {
    formatted = `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)} ${cleaned.substring(6, 8)} ${cleaned.substring(8)}`;
  }

  result.isValid = true;
  result.formatted = formatted;
  result.type = type;

  return result;
}

/**
 * Swedish currency formatting
 * @param amount - Amount to format
 * @param showDecimals - Whether to show decimal places
 * @returns Formatted Swedish currency string
 */
export function formatSwedishCurrency(amount: number, showDecimals: boolean = true): string {
  const formatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return formatter.format(amount);
}

/**
 * Swedish date formatting
 * @param date - Date to format
 * @param format - Format type ('short', 'long', 'numeric')
 * @returns Formatted date string in Swedish
 */
export function formatSwedishDate(date: Date, format: 'short' | 'long' | 'numeric' = 'short'): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: format === 'long' ? 'long' : format === 'short' ? 'short' : '2-digit',
    day: 'numeric',
  });

  return formatter.format(date);
}

/**
 * Swedish time formatting
 * @param date - Date to format time from
 * @returns Formatted time string (HH:MM)
 */
export function formatSwedishTime(date: Date): string {
  return date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Swedish month names
 */
export const SWEDISH_MONTHS = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december'
];

/**
 * Swedish day names
 */
export const SWEDISH_DAYS = [
  'söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'
];

/**
 * Get Swedish month name by index
 * @param monthIndex - Month index (0-11)
 * @returns Swedish month name
 */
export function getSwedishMonthName(monthIndex: number): string {
  return SWEDISH_MONTHS[monthIndex] || '';
}

/**
 * Get Swedish day name by index
 * @param dayIndex - Day index (0-6, 0 = Sunday)
 * @returns Swedish day name
 */
export function getSwedishDayName(dayIndex: number): string {
  return SWEDISH_DAYS[dayIndex] || '';
}

/**
 * Convert a string to proper Swedish capitalization
 * @param text - Text to capitalize
 * @returns Properly capitalized Swedish text
 */
export function capitalizeSwedish(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .replace(/å/g, 'å')
    .replace(/ä/g, 'ä')
    .replace(/ö/g, 'ö')
    .replace(/^./, char => char.toUpperCase());
}

/**
 * Generate a mock Swedish BankID order reference
 * @returns Mock order reference string
 */
export function generateMockBankIDOrderRef(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a mock Swedish BankID QR code data
 * @param orderRef - Order reference
 * @returns Mock QR code data
 */
export function generateMockBankIDQR(orderRef: string): string {
  const timestamp = Date.now();
  return `bankid.${orderRef}.${timestamp}`;
}

/**
 * Validate Swedish apartment number format
 * @param apartmentNumber - Apartment number to validate
 * @returns boolean indicating if format is valid
 */
export function validateSwedishApartmentNumber(apartmentNumber: string): boolean {
  if (!apartmentNumber) return false;
  
  // Common Swedish apartment number formats:
  // - Simple number: "12", "1204"
  // - Floor + apartment: "1201" (floor 12, apartment 01)
  // - Building + apartment: "A12", "B205"
  // - Complex format: "1tr" (first floor), "2vån" (second floor)
  
  const patterns = [
    /^\d{1,4}$/, // Simple number
    /^[A-Z]\d{1,3}$/i, // Building + number
    /^\d{1,2}tr$/i, // Floor with "tr"
    /^\d{1,2}vån$/i, // Floor with "vån"
    /^\d{1,2}-\d{1,3}$/, // Building-apartment
  ];
  
  return patterns.some(pattern => pattern.test(apartmentNumber.trim()));
}

/**
 * Format Swedish apartment number consistently
 * @param apartmentNumber - Raw apartment number
 * @returns Formatted apartment number
 */
export function formatSwedishApartmentNumber(apartmentNumber: string): string {
  if (!validateSwedishApartmentNumber(apartmentNumber)) return '';
  
  return apartmentNumber.trim().toUpperCase();
}