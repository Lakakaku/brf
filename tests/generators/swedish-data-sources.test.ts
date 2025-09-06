/**
 * Swedish Data Sources Tests
 * 
 * Comprehensive tests for Swedish data generation utilities,
 * validating authenticity, format compliance, and data quality.
 */

import {
  getRandomSwedishName,
  getRandomSwedishAddress,
  getRandomSwedishCompany,
  generateSwedishOrgNumber,
  generateSwedishPersonNumber,
  generateSwedishPostalCode,
  generateSwedishBankAccount,
  generateSwedishBankgiro,
  generateSwedishPlusgiro,
  generatePropertyDesignation,
  generateRealisticEmail,
  generateSwedishPhoneNumber,
  SWEDISH_FIRST_NAMES,
  SWEDISH_LAST_NAMES,
  SWEDISH_CITIES_DATA,
  SWEDISH_BRF_COMPANIES,
  BRF_TERMINOLOGY
} from '@/lib/testing/data-sources/swedish-data';

describe('Swedish Data Sources', () => {
  describe('Names', () => {
    it('should generate valid Swedish names', () => {
      for (let i = 0; i < 100; i++) {
        const name = getRandomSwedishName();
        
        expect(name).toHaveProperty('first');
        expect(name).toHaveProperty('last');
        expect(name).toHaveProperty('gender');
        
        expect(typeof name.first).toBe('string');
        expect(typeof name.last).toBe('string');
        expect(name.first.length).toBeGreaterThan(1);
        expect(name.last.length).toBeGreaterThan(1);
        
        // Should be from known Swedish names
        expect(SWEDISH_FIRST_NAMES.some(n => n.first === name.first)).toBe(true);
        expect(SWEDISH_LAST_NAMES.includes(name.last)).toBe(true);
        
        // Gender should be valid
        expect(['male', 'female', 'neutral']).toContain(name.gender);
      }
    });

    it('should maintain gender consistency', () => {
      const samples = Array.from({ length: 1000 }, () => getRandomSwedishName());
      
      // Check that gender distribution is reasonable (not all same gender)
      const genders = samples.map(n => n.gender);
      const uniqueGenders = new Set(genders);
      expect(uniqueGenders.size).toBeGreaterThan(1);
      
      // Verify gender matches known data
      for (const sample of samples) {
        const knownName = SWEDISH_FIRST_NAMES.find(n => n.first === sample.first);
        expect(knownName?.gender).toBe(sample.gender);
      }
    });
  });

  describe('Addresses', () => {
    it('should generate valid Swedish addresses', () => {
      for (let i = 0; i < 100; i++) {
        const address = getRandomSwedishAddress();
        
        expect(address).toHaveProperty('street');
        expect(address).toHaveProperty('postalCode');
        expect(address).toHaveProperty('city');
        expect(address).toHaveProperty('municipality');
        expect(address).toHaveProperty('county');
        
        // Street should have number
        expect(address.street).toMatch(/\d+$/);
        
        // Postal code format: "XXX XX"
        expect(address.postalCode).toMatch(/^\d{3} \d{2}$/);
        
        // Should be from known Swedish cities
        expect(SWEDISH_CITIES_DATA.some(c => c.city === address.city)).toBe(true);
        
        expect(typeof address.municipality).toBe('string');
        expect(typeof address.county).toBe('string');
        expect(address.city.length).toBeGreaterThan(0);
      }
    });

    it('should generate postal codes with correct city patterns', () => {
      const stockholmCodes = Array.from({ length: 50 }, () => 
        generateSwedishPostalCode('Stockholm')
      );
      
      // Stockholm codes should be in 100-199 range
      for (const code of stockholmCodes) {
        const numericCode = parseInt(code.replace(' ', ''));
        expect(numericCode).toBeGreaterThanOrEqual(10000);
        expect(numericCode).toBeLessThanOrEqual(19999);
      }
    });
  });

  describe('Companies', () => {
    it('should return valid Swedish BRF companies', () => {
      for (let i = 0; i < 50; i++) {
        const company = getRandomSwedishCompany();
        
        expect(company).toHaveProperty('name');
        expect(company).toHaveProperty('orgNumber');
        expect(company).toHaveProperty('industry');
        
        // Should be from known companies
        expect(SWEDISH_BRF_COMPANIES).toContain(company);
        
        // Org number format: "XXXXXX-XXXX"
        expect(company.orgNumber).toMatch(/^\d{6}-\d{4}$/);
        
        // VAT number format if present
        if (company.vatNumber) {
          expect(company.vatNumber).toMatch(/^SE\d{12}$/);
        }
      }
    });

    it('should cover different industries', () => {
      const samples = Array.from({ length: 100 }, () => getRandomSwedishCompany());
      const industries = new Set(samples.map(c => c.industry));
      
      // Should have multiple industries represented
      expect(industries.size).toBeGreaterThan(3);
      
      // Check known industries
      const expectedIndustries = [
        'Property Management', 'Cleaning Services', 'Construction',
        'Energy', 'Telecommunications', 'Insurance', 'Legal Services', 'Accounting'
      ];
      
      for (const industry of industries) {
        expect(expectedIndustries).toContain(industry);
      }
    });
  });

  describe('Organization Numbers', () => {
    it('should generate valid Swedish organization numbers', () => {
      for (let i = 0; i < 100; i++) {
        const orgNumber = generateSwedishOrgNumber();
        
        // Format: "XXXXXX-XXXX"
        expect(orgNumber).toMatch(/^\d{6}-\d{4}$/);
        
        // First digit should be valid (2, 5, 6, 7, 8, or 9)
        const firstDigit = parseInt(orgNumber.charAt(0));
        expect([2, 5, 6, 7, 8, 9]).toContain(firstDigit);
      }
    });

    it('should generate unique organization numbers', () => {
      const orgNumbers = new Set();
      
      for (let i = 0; i < 1000; i++) {
        const orgNumber = generateSwedishOrgNumber();
        expect(orgNumbers.has(orgNumber)).toBe(false);
        orgNumbers.add(orgNumber);
      }
      
      expect(orgNumbers.size).toBe(1000);
    });
  });

  describe('Personal Numbers', () => {
    it('should generate valid Swedish personal numbers', () => {
      for (let i = 0; i < 100; i++) {
        const personalNumber = generateSwedishPersonNumber();
        
        // Format: "YYMMDD-XXXX"
        expect(personalNumber).toMatch(/^\d{6}-\d{4}$/);
        
        const [datePart, numberPart] = personalNumber.split('-');
        
        // Date validation
        const year = parseInt(datePart.substring(0, 2));
        const month = parseInt(datePart.substring(2, 4));
        const day = parseInt(datePart.substring(4, 6));
        
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(31); // Simplified validation
        
        // Number part should be 4 digits
        expect(numberPart.length).toBe(4);
        expect(/^\d{4}$/.test(numberPart)).toBe(true);
      }
    });

    it('should respect provided birth dates', () => {
      const birthDate = new Date(1985, 5, 15); // June 15, 1985
      const personalNumber = generateSwedishPersonNumber(birthDate);
      
      expect(personalNumber).toMatch(/^85061[5-9]-\d{4}$/);
    });
  });

  describe('Bank Information', () => {
    it('should generate valid Swedish bank accounts', () => {
      for (let i = 0; i < 100; i++) {
        const account = generateSwedishBankAccount();
        
        expect(account).toHaveProperty('clearingNumber');
        expect(account).toHaveProperty('accountNumber');
        expect(account).toHaveProperty('fullAccountNumber');
        
        // Clearing number should be 4 digits
        expect(account.clearingNumber).toMatch(/^\d{4}$/);
        
        // Account number should be 7 digits
        expect(account.accountNumber).toMatch(/^\d{7}$/);
        
        // Full account number format
        expect(account.fullAccountNumber).toBe(
          `${account.clearingNumber}-${account.accountNumber}`
        );
        
        // Clearing number should be in valid bank ranges
        const clearingNum = parseInt(account.clearingNumber);
        const validRanges = [
          [1100, 1199], [1200, 1399], [1400, 1499], [1500, 1599],
          [1600, 1699], [1700, 1799], [1800, 1899], [1900, 1999],
          [2300, 2399], [2400, 2499], [3000, 3299], [3300, 3399],
          [3400, 3409], [3410, 3781], [4000, 4999], [5000, 5999],
          [6000, 6999], [7000, 7999], [8000, 8999], [9000, 9999]
        ];
        
        const isValidRange = validRanges.some(([min, max]) => 
          clearingNum >= min && clearingNum <= max
        );
        expect(isValidRange).toBe(true);
      }
    });

    it('should generate valid Bankgiro numbers', () => {
      for (let i = 0; i < 100; i++) {
        const bankgiro = generateSwedishBankgiro();
        
        expect(bankgiro).toMatch(/^\d{7,8}$/);
        expect(parseInt(bankgiro)).toBeGreaterThan(0);
      }
    });

    it('should generate valid Plusgiro numbers', () => {
      for (let i = 0; i < 100; i++) {
        const plusgiro = generateSwedishPlusgiro();
        
        expect(plusgiro).toMatch(/^\d{2,8}$/);
        expect(parseInt(plusgiro)).toBeGreaterThan(0);
      }
    });
  });

  describe('Property Designations', () => {
    it('should generate valid property designations', () => {
      for (let i = 0; i < 100; i++) {
        const designation = generatePropertyDesignation('Stockholm');
        
        expect(designation).toMatch(/^Stockholm .+ \d+$/);
        expect(designation.length).toBeGreaterThan(10);
      }
    });

    it('should include municipality name', () => {
      const municipalities = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala'];
      
      for (const municipality of municipalities) {
        const designation = generatePropertyDesignation(municipality);
        expect(designation).toContain(municipality);
      }
    });
  });

  describe('Email Generation', () => {
    it('should generate realistic email addresses', () => {
      for (let i = 0; i < 100; i++) {
        const email = generateRealisticEmail('Erik', 'Andersson');
        
        expect(email).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
        expect(email.toLowerCase()).toBe(email); // Should be lowercase
        expect(email).toContain('erik');
        expect(email).toContain('andersson');
      }
    });

    it('should use specified domain when provided', () => {
      const email = generateRealisticEmail('Anna', 'Svensson', 'example.com');
      expect(email).toContain('@example.com');
    });

    it('should handle Swedish characters correctly', () => {
      const email = generateRealisticEmail('Åsa', 'Björk');
      
      expect(email).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
      // Swedish characters might be transliterated
      expect(email.length).toBeGreaterThan(5);
    });
  });

  describe('Phone Numbers', () => {
    it('should generate valid Swedish mobile phone numbers', () => {
      for (let i = 0; i < 100; i++) {
        const phone = generateSwedishPhoneNumber();
        
        // Format: "07X-XXX XXX" or similar
        expect(phone).toMatch(/^07[0-9]-\d{3} \d{3}$/);
        
        // Should start with valid prefixes
        const prefix = phone.substring(0, 3);
        expect(['070', '072', '073', '076', '079']).toContain(prefix);
      }
    });

    it('should generate properly formatted numbers', () => {
      for (let i = 0; i < 50; i++) {
        const phone = generateSwedishPhoneNumber();
        
        // Remove formatting and check length
        const digitsOnly = phone.replace(/[-\s]/g, '');
        expect(digitsOnly.length).toBe(10);
        expect(/^\d{10}$/.test(digitsOnly)).toBe(true);
      }
    });
  });

  describe('BRF Terminology', () => {
    it('should contain valid role options', () => {
      expect(BRF_TERMINOLOGY.roles).toContain('member');
      expect(BRF_TERMINOLOGY.roles).toContain('board');
      expect(BRF_TERMINOLOGY.roles).toContain('chairman');
      expect(BRF_TERMINOLOGY.roles).toContain('treasurer');
      expect(BRF_TERMINOLOGY.roles).toContain('admin');
    });

    it('should contain valid meeting types', () => {
      expect(BRF_TERMINOLOGY.meetingTypes).toContain('regular');
      expect(BRF_TERMINOLOGY.meetingTypes).toContain('extraordinary');
      expect(BRF_TERMINOLOGY.meetingTypes).toContain('annual');
    });

    it('should contain Swedish accounting standards', () => {
      expect(BRF_TERMINOLOGY.accountingStandards).toContain('K2');
      expect(BRF_TERMINOLOGY.accountingStandards).toContain('K3');
    });

    it('should contain energy certificates', () => {
      const expectedCerts = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      for (const cert of expectedCerts) {
        expect(BRF_TERMINOLOGY.energyCertificates).toContain(cert);
      }
    });

    it('should contain realistic case categories', () => {
      expect(BRF_TERMINOLOGY.caseCategories).toContain('maintenance');
      expect(BRF_TERMINOLOGY.caseCategories).toContain('renovation');
      expect(BRF_TERMINOLOGY.caseCategories).toContain('noise');
      expect(BRF_TERMINOLOGY.caseCategories).toContain('parking');
    });
  });

  describe('Data Quality and Realism', () => {
    it('should maintain consistent data relationships', () => {
      // Test that multiple generations maintain relationships
      for (let i = 0; i < 50; i++) {
        const address = getRandomSwedishAddress();
        const postalCode = generateSwedishPostalCode(address.city);
        
        // Postal code should be reasonable for the city
        const numericCode = parseInt(postalCode.replace(' ', ''));
        
        if (address.city === 'Stockholm') {
          expect(numericCode).toBeGreaterThanOrEqual(10000);
          expect(numericCode).toBeLessThanOrEqual(19999);
        }
        
        expect(address.municipality).toBeTruthy();
        expect(address.county).toBeTruthy();
      }
    });

    it('should generate diverse but realistic data', () => {
      const companies = Array.from({ length: 100 }, () => getRandomSwedishCompany());
      const names = Array.from({ length: 100 }, () => getRandomSwedishName());
      const addresses = Array.from({ length: 100 }, () => getRandomSwedishAddress());
      
      // Should have good diversity
      const uniqueCompanies = new Set(companies.map(c => c.name));
      const uniqueNames = new Set(names.map(n => `${n.first} ${n.last}`));
      const uniqueCities = new Set(addresses.map(a => a.city));
      
      expect(uniqueCompanies.size).toBeGreaterThan(10);
      expect(uniqueNames.size).toBeGreaterThan(80); // Should be mostly unique
      expect(uniqueCities.size).toBeGreaterThan(3);
    });

    it('should respect Swedish cultural patterns', () => {
      // Test that generated data follows Swedish conventions
      for (let i = 0; i < 100; i++) {
        const name = getRandomSwedishName();
        const email = generateRealisticEmail(name.first, name.last);
        
        // Email should be reasonable length
        expect(email.length).toBeGreaterThan(8);
        expect(email.length).toBeLessThan(50);
        
        // Should contain recognizable Swedish name parts
        const emailLocal = email.split('@')[0];
        const nameChars = (name.first + name.last).toLowerCase();
        
        // Should have some overlap with the name
        let overlap = 0;
        for (const char of emailLocal) {
          if (nameChars.includes(char)) overlap++;
        }
        expect(overlap).toBeGreaterThan(emailLocal.length * 0.3); // At least 30% overlap
      }
    });
  });
});