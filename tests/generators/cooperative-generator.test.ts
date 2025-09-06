/**
 * Cooperative Data Generator Tests
 * 
 * Comprehensive tests for Swedish BRF cooperative data generation,
 * validating realistic data patterns, regulatory compliance,
 * and authentic Swedish business information.
 */

import {
  CooperativeDataGenerator,
  CooperativeValidator,
  CooperativeData,
  CooperativeGenerationOptions
} from '@/lib/testing/generators/cooperative-generator';
import { GenerationOptions } from '@/lib/testing/generators/base-generator';
import { SWEDISH_CITIES_DATA, BRF_TERMINOLOGY } from '@/lib/testing/data-sources/swedish-data';

describe('CooperativeDataGenerator', () => {
  let generator: CooperativeDataGenerator;
  let validator: CooperativeValidator;

  beforeEach(() => {
    validator = new CooperativeValidator();
    generator = new CooperativeDataGenerator('test-seed', {}, validator);
  });

  describe('Single Cooperative Generation', () => {
    it('should generate valid cooperative data', () => {
      const cooperative = generator.generateSingle();
      
      // Basic structure
      expect(cooperative).toHaveProperty('id');
      expect(cooperative).toHaveProperty('org_number');
      expect(cooperative).toHaveProperty('name');
      expect(cooperative).toHaveProperty('subdomain');
      
      // Address fields
      expect(cooperative).toHaveProperty('street_address');
      expect(cooperative).toHaveProperty('postal_code');
      expect(cooperative).toHaveProperty('city');
      
      // Swedish legal fields
      expect(cooperative).toHaveProperty('registration_date');
      expect(cooperative).toHaveProperty('fiscal_year_end');
      expect(cooperative).toHaveProperty('accounting_standard');
      expect(cooperative).toHaveProperty('tax_number');
      
      // Building information
      expect(cooperative).toHaveProperty('building_year');
      expect(cooperative).toHaveProperty('total_apartments');
      expect(cooperative).toHaveProperty('total_area_sqm');
      expect(cooperative).toHaveProperty('property_designation');
      
      // Financial configuration
      expect(cooperative).toHaveProperty('bank_account_number');
      expect(cooperative).toHaveProperty('bankgiro_number');
      expect(cooperative).toHaveProperty('plusgiro_number');
      
      // Validate data types
      expect(typeof cooperative.id).toBe('string');
      expect(typeof cooperative.name).toBe('string');
      expect(typeof cooperative.org_number).toBe('string');
      expect(typeof cooperative.building_year).toBe('number');
      expect(typeof cooperative.total_apartments).toBe('number');
    });

    it('should generate Swedish-compliant organization numbers', () => {
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        
        // Format: XXXXXX-XXXX
        expect(cooperative.org_number).toMatch(/^\d{6}-\d{4}$/);
        
        // First digit should be valid for Swedish org numbers
        const firstDigit = parseInt(cooperative.org_number.charAt(0));
        expect([2, 5, 6, 7, 8, 9]).toContain(firstDigit);
      }
    });

    it('should generate realistic cooperative names', () => {
      const names = Array.from({ length: 50 }, () => 
        generator.generateSingle().name
      );
      
      // Should contain BRF-related terms
      const brfTerms = ['Bostadsrättsföreningen', 'BRF', 'Bostadsföreningen', 'HSB', 'Riksbyggen'];
      const hasValidPrefix = names.every(name => 
        brfTerms.some(term => name.includes(term))
      );
      expect(hasValidPrefix).toBe(true);
      
      // Should have variety
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBeGreaterThan(names.length * 0.8); // At least 80% unique
    });

    it('should generate valid subdomains', () => {
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        
        // Should be lowercase alphanumeric with hyphens
        expect(cooperative.subdomain).toMatch(/^[a-z0-9-]+$/);
        expect(cooperative.subdomain.length).toBeGreaterThan(2);
        expect(cooperative.subdomain.length).toBeLessThan(30);
        
        // Should not start or end with hyphen
        expect(cooperative.subdomain.charAt(0)).not.toBe('-');
        expect(cooperative.subdomain.charAt(cooperative.subdomain.length - 1)).not.toBe('-');
      }
    });

    it('should generate realistic building information', () => {
      for (let i = 0; i < 100; i++) {
        const cooperative = generator.generateSingle();
        
        // Building year should be reasonable
        const currentYear = new Date().getFullYear();
        expect(cooperative.building_year).toBeGreaterThanOrEqual(1920);
        expect(cooperative.building_year).toBeLessThanOrEqual(currentYear);
        
        // Apartments count should be reasonable
        expect(cooperative.total_apartments).toBeGreaterThanOrEqual(6);
        expect(cooperative.total_apartments).toBeLessThanOrEqual(300);
        
        // Area should correlate with apartment count
        const avgAreaPerApartment = cooperative.total_area_sqm / cooperative.total_apartments;
        expect(avgAreaPerApartment).toBeGreaterThan(30); // At least 30 sqm per apartment (including common areas)
        expect(avgAreaPerApartment).toBeLessThan(150); // Not more than 150 sqm per apartment
      }
    });

    it('should generate valid Swedish addresses', () => {
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        
        // Postal code format
        expect(cooperative.postal_code).toMatch(/^\d{3} \d{2}$/);
        
        // City should be from known Swedish cities
        expect(SWEDISH_CITIES_DATA.some(c => c.city === cooperative.city)).toBe(true);
        
        // Street address should have number
        expect(cooperative.street_address).toMatch(/\d+/);
      }
    });

    it('should generate valid Swedish financial information', () => {
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        
        // Bank account format: XXXX-XXXXXXX
        expect(cooperative.bank_account_number).toMatch(/^\d{4}-\d{7}$/);
        
        // Bankgiro: 7-8 digits
        expect(cooperative.bankgiro_number).toMatch(/^\d{7,8}$/);
        
        // Plusgiro: 2-8 digits
        expect(cooperative.plusgiro_number).toMatch(/^\d{2,8}$/);
        
        // Interest rate should be reasonable
        expect(cooperative.default_interest_rate).toBeGreaterThanOrEqual(0);
        expect(cooperative.default_interest_rate).toBeLessThanOrEqual(20);
        
        // Fees should be reasonable
        expect(cooperative.payment_reminder_fee).toBeGreaterThan(0);
        expect(cooperative.debt_collection_fee).toBeGreaterThan(cooperative.payment_reminder_fee);
      }
    });

    it('should generate valid accounting standards', () => {
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        
        expect(['K2', 'K3']).toContain(cooperative.accounting_standard);
      }
    });

    it('should generate valid fiscal year end dates', () => {
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        
        // Should be valid date format MM-DD
        expect(cooperative.fiscal_year_end).toMatch(/^\d{2}-\d{2}$/);
        
        // Should be common fiscal year end dates
        const commonDates = ['12-31', '06-30', '04-30', '03-31'];
        expect(commonDates).toContain(cooperative.fiscal_year_end);
      }
    });

    it('should generate valid energy certificates', () => {
      const cooperatives = Array.from({ length: 100 }, () => 
        generator.generateSingle()
      );
      
      const withCertificates = cooperatives.filter(c => c.energy_certificate);
      expect(withCertificates.length).toBeGreaterThan(cooperatives.length * 0.8); // Most should have certificates
      
      for (const cooperative of withCertificates) {
        expect(['A', 'B', 'C', 'D', 'E', 'F', 'G']).toContain(cooperative.energy_certificate);
        
        // Should have expiry date if certificate exists
        if (cooperative.energy_certificate) {
          expect(cooperative.energy_certificate_expires).toBeTruthy();
          expect(cooperative.energy_certificate_expires).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    });

    it('should generate valid JSON configuration fields', () => {
      for (let i = 0; i < 20; i++) {
        const cooperative = generator.generateSingle();
        
        // Should be valid JSON
        expect(() => JSON.parse(cooperative.settings)).not.toThrow();
        expect(() => JSON.parse(cooperative.features)).not.toThrow();
        expect(() => JSON.parse(cooperative.board_structure)).not.toThrow();
        
        // Settings should have reasonable keys
        const settings = JSON.parse(cooperative.settings);
        expect(settings).toHaveProperty('notifications_enabled');
        expect(settings).toHaveProperty('language');
        expect(settings.language).toBe('sv');
        expect(settings.currency).toBe('SEK');
        
        // Features should match size category
        const features = JSON.parse(cooperative.features);
        expect(features).toHaveProperty('standard');
        expect(features.standard).toBe(true);
        
        // Board structure should have positions
        const board = JSON.parse(cooperative.board_structure);
        expect(board).toHaveProperty('Ordförande');
        expect(board['Ordförande']).toBe(1); // Should have one chairman
      }
    });
  });

  describe('Generation Options', () => {
    it('should respect preferred cities', () => {
      const options: CooperativeGenerationOptions = {
        preferredCities: ['Stockholm', 'Göteborg']
      };
      
      const generator = new CooperativeDataGenerator('seed', options);
      
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        expect(['Stockholm', 'Göteborg']).toContain(cooperative.city);
      }
    });

    it('should respect size distribution', () => {
      const options: CooperativeGenerationOptions = {
        sizeDistribution: {
          small: 1.0, // 100% small
          medium: 0.0,
          large: 0.0,
          extraLarge: 0.0
        }
      };
      
      const generator = new CooperativeDataGenerator('seed', options);
      
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        expect(cooperative.total_apartments).toBeLessThanOrEqual(20); // Small size
      }
    });

    it('should respect age distribution', () => {
      const options: CooperativeGenerationOptions = {
        ageDistribution: {
          new: 1.0, // 100% new buildings
          modern: 0.0,
          classic: 0.0,
          vintage: 0.0
        }
      };
      
      const generator = new CooperativeDataGenerator('seed', options);
      
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        expect(cooperative.building_year).toBeGreaterThanOrEqual(2010); // New buildings
      }
    });

    it('should include regulatory information when requested', () => {
      const options: CooperativeGenerationOptions = {
        includeRegulatory: true,
        includeEnergyData: true,
        includeBoardStructure: true
      };
      
      const generator = new CooperativeDataGenerator('seed', options);
      
      for (let i = 0; i < 20; i++) {
        const cooperative = generator.generateSingle();
        
        // Should have regulatory fields populated
        expect(cooperative.registration_date).toBeTruthy();
        expect(cooperative.annual_report_filed).toBeTruthy();
        expect(cooperative.tax_number).toBeTruthy();
        
        // Should have energy data
        expect(cooperative.energy_certificate).toBeTruthy();
        expect(cooperative.district_heating).toBeOneOf([0, 1]);
        
        // Should have board structure
        const board = JSON.parse(cooperative.board_structure);
        expect(Object.keys(board).length).toBeGreaterThan(1);
      }
    });
  });

  describe('Bulk Generation', () => {
    it('should generate bulk cooperatives efficiently', async () => {
      const options: GenerationOptions = {
        count: 500,
        batchSize: 100,
        validateData: true
      };
      
      const result = await generator.generate(options);
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(500);
      expect(result.errors.length).toBe(0);
      expect(result.statistics.averageGenerationTimeMs).toBeLessThan(10); // Should be fast
    });

    it('should maintain uniqueness across bulk generation', async () => {
      const options: GenerationOptions = {
        count: 1000,
        skipDuplicates: true
      };
      
      const result = await generator.generate(options);
      
      expect(result.success).toBe(true);
      
      // Check uniqueness of key fields
      const orgNumbers = new Set(result.data.map(c => c.org_number));
      const subdomains = new Set(result.data.map(c => c.subdomain));
      const names = new Set(result.data.map(c => c.name));
      
      expect(orgNumbers.size).toBe(result.data.length);
      expect(subdomains.size).toBe(result.data.length);
      expect(names.size).toBe(result.data.length);
    });

    it('should provide meaningful progress updates', async () => {
      const progressUpdates: any[] = [];
      
      const options: GenerationOptions = {
        count: 200,
        batchSize: 50,
        progressCallback: (progress) => {
          progressUpdates.push({ ...progress });
        }
      };
      
      const result = await generator.generate(options);
      
      expect(result.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Should have meaningful phase names
      const phases = progressUpdates.map(p => p.phase);
      expect(phases.some(p => p.includes('Generating'))).toBe(true);
    });
  });

  describe('Data Relationships and Realism', () => {
    it('should maintain realistic data relationships', () => {
      for (let i = 0; i < 100; i++) {
        const cooperative = generator.generateSingle();
        
        // Building year should influence energy certificate
        if (cooperative.energy_certificate && cooperative.building_year >= 2010) {
          expect(['A', 'B', 'C']).toContain(cooperative.energy_certificate);
        }
        
        // District heating should be more common in larger cities
        if (cooperative.city === 'Stockholm' || cooperative.city === 'Göteborg') {
          // Stockholm and Göteborg have high district heating rates
          // This is probabilistic, so we can't guarantee it, but we can check patterns
        }
        
        // Property designation should include municipality
        expect(cooperative.property_designation).toContain(cooperative.city);
        
        // Subscription tier should correlate with size
        if (cooperative.total_apartments <= 20 && cooperative.subscription_tier !== 'basic') {
          // Small cooperatives are more likely to have basic tier
          expect(['basic', 'standard']).toContain(cooperative.subscription_tier);
        }
      }
    });

    it('should generate realistic financial patterns', () => {
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        
        // Fees should follow realistic patterns
        expect(cooperative.debt_collection_fee).toBeGreaterThan(cooperative.payment_reminder_fee);
        expect(cooperative.payment_reminder_fee).toBeGreaterThanOrEqual(50);
        expect(cooperative.debt_collection_fee).toBeGreaterThanOrEqual(300);
        
        // Interest rate should be reasonable
        expect(cooperative.default_interest_rate).toBeGreaterThanOrEqual(6);
        expect(cooperative.default_interest_rate).toBeLessThanOrEqual(12);
      }
    });

    it('should generate Swedish cultural patterns', () => {
      const cooperatives = Array.from({ length: 100 }, () => 
        generator.generateSingle()
      );
      
      // Should have good distribution of city types
      const cities = cooperatives.map(c => c.city);
      const uniqueCities = new Set(cities);
      expect(uniqueCities.size).toBeGreaterThan(3);
      
      // Should use Swedish legal structures
      const accountingStandards = cooperatives.map(c => c.accounting_standard);
      expect(accountingStandards.every(std => ['K2', 'K3'].includes(std))).toBe(true);
      
      // Should have reasonable land lease distribution (minority should have land lease)
      const landLeaseCount = cooperatives.filter(c => c.land_lease === 1).length;
      expect(landLeaseCount).toBeLessThan(cooperatives.length * 0.3); // Less than 30%
    });
  });

  describe('Validation Integration', () => {
    it('should validate generated cooperatives', () => {
      const validator = new CooperativeValidator();
      
      for (let i = 0; i < 50; i++) {
        const cooperative = generator.generateSingle();
        const validation = validator.validate(cooperative);
        
        if (!validation.isValid) {
          console.log('Validation errors:', validation.errors);
          console.log('Problematic data:', cooperative);
        }
        
        expect(validation.isValid).toBe(true);
        expect(validation.errors.length).toBe(0);
      }
    });

    it('should sanitize data when needed', () => {
      const validator = new CooperativeValidator();
      
      // Create cooperative with data that needs sanitization
      const messyCooperative: CooperativeData = {
        id: 'test-id',
        org_number: '123456-7890',
        name: '  BRF Test  ', // Needs trimming
        subdomain: '  TEST-SUBDOMAIN  ', // Needs trimming and lowercasing
        street_address: '  Test Street 123  ',
        postal_code: '123 45',
        city: '  Stockholm  ',
        registration_date: '2020-01-01',
        board_structure: '{}',
        fiscal_year_end: '12-31',
        accounting_standard: 'K2',
        annual_report_filed: '2023-05-15',
        tax_number: '123456-7890',
        building_year: 1990.7, // Should be integer
        total_apartments: 25.8, // Should be integer
        total_area_sqm: 1500.123,
        property_designation: 'Stockholm Test 1',
        land_lease: 1,
        energy_certificate: 'C',
        energy_certificate_expires: '2030-12-31',
        district_heating: 1,
        default_interest_rate: 8.5,
        payment_reminder_fee: 60.0,
        debt_collection_fee: 350.0,
        bank_account_number: '1234-1234567',
        bankgiro_number: '12345678',
        plusgiro_number: '12345',
        settings: '{}',
        features: '{}',
        subscription_tier: 'standard',
        subscription_status: 'active',
        created_at: '2023-01-01 10:00:00',
        updated_at: '2023-01-01 10:00:00'
      };
      
      const sanitized = validator.sanitize(messyCooperative);
      
      expect(sanitized.name).toBe('BRF Test');
      expect(sanitized.subdomain).toBe('test-subdomain');
      expect(sanitized.city).toBe('Stockholm');
      expect(sanitized.building_year).toBe(1990);
      expect(sanitized.total_apartments).toBe(25);
    });
  });

  describe('Reproducibility', () => {
    it('should generate same data with same seed', () => {
      const generator1 = new CooperativeDataGenerator('same-seed');
      const generator2 = new CooperativeDataGenerator('same-seed');
      
      const coop1 = generator1.generateSingle();
      const coop2 = generator2.generateSingle();
      
      // Should be identical with same seed
      expect(coop1.name).toBe(coop2.name);
      expect(coop1.org_number).toBe(coop2.org_number);
      expect(coop1.total_apartments).toBe(coop2.total_apartments);
      expect(coop1.building_year).toBe(coop2.building_year);
    });

    it('should generate different data with different seeds', () => {
      const generator1 = new CooperativeDataGenerator('seed-1');
      const generator2 = new CooperativeDataGenerator('seed-2');
      
      const coops1 = Array.from({ length: 10 }, () => generator1.generateSingle());
      const coops2 = Array.from({ length: 10 }, () => generator2.generateSingle());
      
      // Should have some differences
      const identicalCount = coops1.filter((c1, i) => 
        c1.name === coops2[i].name && c1.org_number === coops2[i].org_number
      ).length;
      
      expect(identicalCount).toBeLessThan(10); // Shouldn't all be identical
    });
  });
});