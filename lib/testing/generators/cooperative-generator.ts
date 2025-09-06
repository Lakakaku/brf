/**
 * Cooperative Data Generator
 * 
 * Generates realistic Swedish BRF (Bostadsrättsförening) cooperative data
 * with authentic Swedish addresses, organization numbers, financial data,
 * and regulatory compliance information.
 */

import { BaseDataGenerator, DataConstraints, EntityValidator, ValidationResult } from './base-generator';
import { 
  getRandomSwedishAddress, 
  generateSwedishOrgNumber,
  generateSwedishBankAccount,
  generateSwedishBankgiro,
  generateSwedishPlusgiro,
  generatePropertyDesignation,
  BRF_TERMINOLOGY,
  SWEDISH_CITIES_DATA,
  SwedishAddress 
} from '../data-sources/swedish-data';

export interface CooperativeData {
  id: string;
  org_number: string;
  name: string;
  subdomain: string;
  
  // Address
  street_address: string;
  postal_code: string;
  city: string;
  
  // Swedish Legal & Regulatory
  registration_date: string;
  board_structure: string; // JSON
  fiscal_year_end: string;
  accounting_standard: 'K2' | 'K3';
  annual_report_filed?: string;
  tax_number: string;
  
  // Building & Property
  building_year: number;
  total_apartments: number;
  total_area_sqm: number;
  property_designation: string;
  land_lease: number; // Boolean as number
  
  // Energy & Environmental
  energy_certificate?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  energy_certificate_expires?: string;
  district_heating: number; // Boolean as number
  green_certification?: string;
  
  // Financial Configuration
  default_interest_rate: number;
  payment_reminder_fee: number;
  debt_collection_fee: number;
  bank_account_number: string;
  bankgiro_number: string;
  plusgiro_number: string;
  
  // Configuration
  settings: string; // JSON
  features: string; // JSON
  
  // Subscription
  subscription_tier: string;
  subscription_status: string;
  trial_ends_at?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CooperativeGenerationOptions {
  // Geographic distribution
  preferredCities?: string[];
  addressRealism?: 'high' | 'medium' | 'low';
  
  // Size distribution
  sizeDistribution?: {
    small: number; // <= 20 apartments
    medium: number; // 21-50 apartments
    large: number; // 51-100 apartments
    extraLarge: number; // > 100 apartments
  };
  
  // Age distribution
  ageDistribution?: {
    new: number; // Built after 2010
    modern: number; // Built 1990-2010
    classic: number; // Built 1960-1989
    vintage: number; // Built before 1960
  };
  
  // Energy efficiency distribution
  energyEfficiencyBias?: 'modern' | 'mixed' | 'realistic';
  
  // Financial realism
  financialRealism?: 'high' | 'medium' | 'low';
  
  // Legal compliance
  includeRegulatory?: boolean;
  includeEnergyData?: boolean;
  includeBoardStructure?: boolean;
}

export class CooperativeValidator implements EntityValidator<CooperativeData> {
  validate(data: CooperativeData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!data.name) errors.push('Name is required');
    if (!data.org_number) errors.push('Organization number is required');
    if (!data.subdomain) errors.push('Subdomain is required');
    
    // Organization number format validation
    if (data.org_number && !/^\d{6}-\d{4}$/.test(data.org_number)) {
      errors.push('Organization number must be in format XXXXXX-XXXX');
    }
    
    // Email format in subdomain
    if (data.subdomain && !/^[a-z0-9-]+$/.test(data.subdomain)) {
      errors.push('Subdomain must contain only lowercase letters, numbers, and hyphens');
    }
    
    // Postal code format
    if (data.postal_code && !/^\d{3} \d{2}$/.test(data.postal_code)) {
      warnings.push('Postal code should be in format "XXX XX"');
    }
    
    // Building year validation
    const currentYear = new Date().getFullYear();
    if (data.building_year && (data.building_year < 1800 || data.building_year > currentYear)) {
      errors.push(`Building year must be between 1800 and ${currentYear}`);
    }
    
    // Apartments count validation
    if (data.total_apartments && data.total_apartments < 1) {
      errors.push('Total apartments must be at least 1');
    }
    
    // Area validation
    if (data.total_area_sqm && data.total_area_sqm < 100) {
      warnings.push('Total area seems very small for a cooperative building');
    }
    
    // Interest rate validation
    if (data.default_interest_rate && (data.default_interest_rate < 0 || data.default_interest_rate > 50)) {
      errors.push('Default interest rate must be between 0% and 50%');
    }
    
    // Energy certificate expiration
    if (data.energy_certificate_expires) {
      const expiryDate = new Date(data.energy_certificate_expires);
      const now = new Date();
      if (expiryDate < now) {
        warnings.push('Energy certificate has expired');
      }
    }
    
    // JSON field validation
    try {
      if (data.settings) JSON.parse(data.settings);
      if (data.features) JSON.parse(data.features);
      if (data.board_structure) JSON.parse(data.board_structure);
    } catch (e) {
      errors.push('Invalid JSON in configuration fields');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  sanitize(data: CooperativeData): CooperativeData {
    return {
      ...data,
      name: data.name?.trim(),
      subdomain: data.subdomain?.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      city: data.city?.trim(),
      street_address: data.street_address?.trim(),
      // Ensure numeric fields are properly typed
      building_year: Math.floor(Number(data.building_year) || 0),
      total_apartments: Math.floor(Number(data.total_apartments) || 0),
      total_area_sqm: Number(data.total_area_sqm) || 0,
      default_interest_rate: Number(data.default_interest_rate) || 8.0,
      payment_reminder_fee: Number(data.payment_reminder_fee) || 60.0,
      debt_collection_fee: Number(data.debt_collection_fee) || 350.0,
      land_lease: Number(data.land_lease) || 0,
      district_heating: Number(data.district_heating) || 0
    };
  }
}

export class CooperativeDataGenerator extends BaseDataGenerator<CooperativeData> {
  private options: CooperativeGenerationOptions;
  private cooperativeNames: Set<string> = new Set();
  private subdomains: Set<string> = new Set();

  constructor(
    seed?: string, 
    options: CooperativeGenerationOptions = {},
    validator?: EntityValidator<CooperativeData>
  ) {
    const constraints: DataConstraints = {
      unique: ['org_number', 'subdomain', 'name'],
      required: ['name', 'org_number', 'subdomain', 'total_apartments'],
      patterns: {
        org_number: /^\d{6}-\d{4}$/,
        subdomain: /^[a-z0-9-]+$/,
        postal_code: /^\d{3} \d{2}$/,
        email: /^[^@]+@[^@]+\.[^@]+$/
      },
      ranges: {
        building_year: { min: 1800, max: new Date().getFullYear() },
        total_apartments: { min: 1, max: 500 },
        total_area_sqm: { min: 100, max: 50000 },
        default_interest_rate: { min: 0, max: 50 }
      }
    };

    super(seed, constraints, validator || new CooperativeValidator());
    this.options = {
      preferredCities: ['Stockholm', 'Göteborg', 'Malmö'],
      addressRealism: 'high',
      sizeDistribution: {
        small: 0.4,      // 40%
        medium: 0.35,    // 35%
        large: 0.20,     // 20%
        extraLarge: 0.05 // 5%
      },
      ageDistribution: {
        new: 0.15,       // 15%
        modern: 0.30,    // 30%
        classic: 0.45,   // 45%
        vintage: 0.10    // 10%
      },
      energyEfficiencyBias: 'realistic',
      financialRealism: 'high',
      includeRegulatory: true,
      includeEnergyData: true,
      includeBoardStructure: true,
      ...options
    };
  }

  generateSingle(context?: any): CooperativeData {
    const address = this.generateAddress();
    const sizeCategory = this.generateSizeCategory();
    const apartments = this.generateApartmentCount(sizeCategory);
    const buildingYear = this.generateBuildingYear();
    const name = this.generateCooperativeName(address.city);
    const subdomain = this.generateSubdomain(name);
    const bankAccount = generateSwedishBankAccount();

    const data: CooperativeData = {
      id: this.generateId(),
      org_number: generateSwedishOrgNumber(),
      name,
      subdomain,
      
      // Address
      street_address: address.street,
      postal_code: address.postalCode,
      city: address.city,
      
      // Swedish Legal & Regulatory
      registration_date: this.generateRegistrationDate(buildingYear),
      board_structure: this.generateBoardStructure(),
      fiscal_year_end: this.generateFiscalYearEnd(),
      accounting_standard: this.randomChoice(BRF_TERMINOLOGY.accountingStandards),
      annual_report_filed: this.generateAnnualReportDate(),
      tax_number: this.generateTaxNumber(),
      
      // Building & Property
      building_year: buildingYear,
      total_apartments: apartments,
      total_area_sqm: this.generateTotalArea(apartments, buildingYear),
      property_designation: generatePropertyDesignation(address.municipality),
      land_lease: this.randomBoolean(0.15) ? 1 : 0, // 15% are on leased land
      
      // Energy & Environmental
      energy_certificate: this.generateEnergyCertificate(buildingYear),
      energy_certificate_expires: this.generateCertificateExpiry(),
      district_heating: this.generateDistrictHeating(address.city),
      green_certification: this.generateGreenCertification(),
      
      // Financial Configuration
      default_interest_rate: this.randomFloat(6.0, 12.0, 1),
      payment_reminder_fee: this.randomChoice([50, 60, 75, 100]),
      debt_collection_fee: this.randomChoice([300, 350, 400, 450]),
      bank_account_number: bankAccount.fullAccountNumber,
      bankgiro_number: generateSwedishBankgiro(),
      plusgiro_number: generateSwedishPlusgiro(),
      
      // Configuration
      settings: this.generateSettings(),
      features: this.generateFeatures(sizeCategory),
      
      // Subscription
      subscription_tier: this.generateSubscriptionTier(apartments),
      subscription_status: this.randomChoice(['active', 'trial', 'suspended']),
      trial_ends_at: this.generateTrialEndDate(),
      
      // Metadata
      created_at: this.generateCreatedDate(),
      updated_at: this.generateUpdatedDate()
    };

    return data;
  }

  private generateAddress(): SwedishAddress {
    if (this.options.preferredCities && this.options.preferredCities.length > 0) {
      const availableAddresses = SWEDISH_CITIES_DATA.filter(addr => 
        this.options.preferredCities!.includes(addr.city)
      );
      if (availableAddresses.length > 0) {
        const baseAddress = this.randomChoice(availableAddresses);
        return {
          ...baseAddress,
          street: `${baseAddress.street} ${this.randomInt(1, 200)}`
        };
      }
    }
    
    return getRandomSwedishAddress();
  }

  private generateSizeCategory(): 'small' | 'medium' | 'large' | 'extraLarge' {
    const rand = this.random();
    const dist = this.options.sizeDistribution!;
    
    if (rand < dist.small) return 'small';
    if (rand < dist.small + dist.medium) return 'medium';
    if (rand < dist.small + dist.medium + dist.large) return 'large';
    return 'extraLarge';
  }

  private generateApartmentCount(category: 'small' | 'medium' | 'large' | 'extraLarge'): number {
    switch (category) {
      case 'small': return this.randomInt(6, 20);
      case 'medium': return this.randomInt(21, 50);
      case 'large': return this.randomInt(51, 100);
      case 'extraLarge': return this.randomInt(101, 300);
    }
  }

  private generateBuildingYear(): number {
    const rand = this.random();
    const dist = this.options.ageDistribution!;
    const currentYear = new Date().getFullYear();
    
    if (rand < dist.new) {
      return this.randomInt(2010, currentYear);
    } else if (rand < dist.new + dist.modern) {
      return this.randomInt(1990, 2009);
    } else if (rand < dist.new + dist.modern + dist.classic) {
      return this.randomInt(1960, 1989);
    } else {
      return this.randomInt(1920, 1959);
    }
  }

  private generateCooperativeName(city: string): string {
    const prefixes = [
      'Bostadsrättsföreningen',
      'BRF',
      'Bostadsföreningen',
      'HSB',
      'Riksbyggen'
    ];
    
    const themes = [
      'Björken', 'Eken', 'Linden', 'Lönnnen', 'Kastanjen', 'Granen',
      'Rosenhöjd', 'Solbacken', 'Hagalund', 'Erikslund', 'Dalsland',
      'Västanvind', 'Östermalm', 'Söderås', 'Norrgård', 'Centralen',
      'Parkstaden', 'Villan', 'Torget', 'Stationen', 'Hamnen',
      'Klippan', 'Ängen', 'Dalen', 'Backen', 'Höjden', 'Udden',
      'Strand', 'Bryggan', 'Kajen', 'Piren', 'Viken', 'Holmen'
    ];
    
    const numbers = ['', ' 1', ' 2', ' 3', ' I', ' II', ' III'];
    
    let attempts = 0;
    let name: string;
    
    do {
      const prefix = this.randomChoice(prefixes);
      const theme = this.randomChoice(themes);
      const number = this.randomChoice(numbers);
      name = `${prefix} ${theme}${number}`;
      attempts++;
    } while (this.cooperativeNames.has(name) && attempts < 50);
    
    this.cooperativeNames.add(name);
    return name;
  }

  private generateSubdomain(name: string): string {
    // Extract meaningful parts from the name
    const cleanName = name
      .toLowerCase()
      .replace(/bostadsrättsföreningen|bostadsföreningen|brf|hsb|riksbyggen/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    
    const suffixes = ['', 'brf', 'coop', 'hem', 'bo'];
    
    let attempts = 0;
    let subdomain: string;
    
    do {
      const suffix = this.randomChoice(suffixes);
      const base = cleanName.substring(0, 12); // Keep reasonable length
      subdomain = suffix ? `${base}-${suffix}` : base;
      
      // Add number if needed
      if (this.subdomains.has(subdomain) || subdomain.length < 3) {
        subdomain = `${base}${this.randomInt(1, 999)}`;
      }
      
      attempts++;
    } while (this.subdomains.has(subdomain) && attempts < 50);
    
    this.subdomains.add(subdomain);
    return subdomain;
  }

  private generateTotalArea(apartments: number, buildingYear: number): number {
    // Average apartment size varies by building year and type
    let avgApartmentSize: number;
    
    if (buildingYear >= 2000) {
      avgApartmentSize = this.randomFloat(65, 85); // Modern apartments
    } else if (buildingYear >= 1980) {
      avgApartmentSize = this.randomFloat(55, 75); // 80s-90s apartments
    } else if (buildingYear >= 1960) {
      avgApartmentSize = this.randomFloat(45, 65); // Million program era
    } else {
      avgApartmentSize = this.randomFloat(70, 90); // Older, larger apartments
    }
    
    const totalApartmentArea = apartments * avgApartmentSize;
    const commonArea = totalApartmentArea * this.randomFloat(0.15, 0.35); // 15-35% common areas
    
    return Math.round(totalApartmentArea + commonArea);
  }

  private generateRegistrationDate(buildingYear: number): string {
    // Registration usually happens close to building completion
    const regYear = buildingYear + this.randomInt(-1, 2);
    const regMonth = this.randomInt(1, 12);
    const regDay = this.randomInt(1, 28);
    
    return `${regYear}-${regMonth.toString().padStart(2, '0')}-${regDay.toString().padStart(2, '0')}`;
  }

  private generateBoardStructure(): string {
    const positions = [
      'Ordförande', 'Vice ordförande', 'Sekreterare', 'Kassör', 
      'Ledamot', 'Suppleant'
    ];
    
    const boardSize = this.randomInt(3, 7);
    const board: any = {};
    
    // Always include mandatory positions
    board['Ordförande'] = 1;
    board['Sekreterare'] = this.randomBoolean(0.8) ? 1 : 0;
    board['Kassör'] = this.randomBoolean(0.6) ? 1 : 0;
    
    // Add additional members
    const remainingPositions = boardSize - Object.values(board).reduce((a: any, b: any) => a + b, 0);
    if (remainingPositions > 0) {
      board['Ledamot'] = Math.max(remainingPositions - 2, 0);
      board['Suppleant'] = Math.min(2, remainingPositions);
    }
    
    return JSON.stringify(board);
  }

  private generateFiscalYearEnd(): string {
    // Most BRFs use calendar year (12-31) or June 30
    const dates = ['12-31', '06-30', '04-30', '03-31'];
    return this.randomChoice(dates);
  }

  private generateAnnualReportDate(): string {
    const currentYear = new Date().getFullYear();
    const reportYear = currentYear - this.randomInt(0, 2);
    const month = this.randomInt(4, 8); // Usually filed in spring/summer
    const day = this.randomInt(1, 28);
    
    return `${reportYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  private generateTaxNumber(): string {
    return generateSwedishOrgNumber();
  }

  private generateEnergyCertificate(buildingYear: number): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | undefined {
    if (this.randomBoolean(0.1)) return undefined; // 10% don't have certificates yet
    
    // Energy efficiency correlates with building year
    if (buildingYear >= 2010) {
      return this.randomChoice(['A', 'B', 'C'] as const);
    } else if (buildingYear >= 1990) {
      return this.randomChoice(['B', 'C', 'D'] as const);
    } else if (buildingYear >= 1960) {
      return this.randomChoice(['C', 'D', 'E'] as const);
    } else {
      return this.randomChoice(['D', 'E', 'F', 'G'] as const);
    }
  }

  private generateCertificateExpiry(): string | undefined {
    if (this.randomBoolean(0.1)) return undefined;
    
    // Certificates are valid for 10 years
    const issueYear = new Date().getFullYear() - this.randomInt(0, 8);
    const expiryYear = issueYear + 10;
    const month = this.randomInt(1, 12);
    const day = this.randomInt(1, 28);
    
    return `${expiryYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  private generateDistrictHeating(city: string): number {
    // District heating is more common in larger cities
    const districtHeatingChance = {
      'Stockholm': 0.85,
      'Göteborg': 0.70,
      'Malmö': 0.60,
      'Uppsala': 0.75,
      'Linköping': 0.65,
      'default': 0.45
    };
    
    const chance = (districtHeatingChance as any)[city] || districtHeatingChance.default;
    return this.randomBoolean(chance) ? 1 : 0;
  }

  private generateGreenCertification(): string | undefined {
    if (this.randomBoolean(0.7)) return undefined; // 70% don't have green cert
    
    const certifications = [
      'Miljöbyggnad Silver',
      'Miljöbyggnad Guld', 
      'BREEAM Good',
      'BREEAM Very Good',
      'LEED Silver',
      'Svanen'
    ];
    
    return this.randomChoice(certifications);
  }

  private generateSettings(): string {
    const settings = {
      notifications_enabled: true,
      auto_reminders: this.randomBoolean(0.8),
      digital_signatures: this.randomBoolean(0.6),
      member_portal_enabled: this.randomBoolean(0.9),
      document_storage_gb: this.randomChoice([5, 10, 25, 50]),
      backup_frequency: this.randomChoice(['daily', 'weekly']),
      language: 'sv',
      timezone: 'Europe/Stockholm',
      currency: 'SEK',
      date_format: 'YYYY-MM-DD'
    };
    
    return JSON.stringify(settings);
  }

  private generateFeatures(sizeCategory: string): string {
    const baseFeatures = {
      standard: true,
      member_management: true,
      apartment_management: true,
      financial_management: true,
      document_management: true
    };
    
    // Premium features for larger cooperatives
    if (sizeCategory === 'large' || sizeCategory === 'extraLarge') {
      return JSON.stringify({
        ...baseFeatures,
        premium: true,
        booking_system: this.randomBoolean(0.8),
        case_management: true,
        board_portal: true,
        energy_monitoring: this.randomBoolean(0.6),
        contractor_ratings: true,
        advanced_reporting: true
      });
    } else if (sizeCategory === 'medium') {
      return JSON.stringify({
        ...baseFeatures,
        plus: this.randomBoolean(0.6),
        booking_system: this.randomBoolean(0.5),
        case_management: this.randomBoolean(0.7)
      });
    }
    
    return JSON.stringify(baseFeatures);
  }

  private generateSubscriptionTier(apartments: number): string {
    if (apartments <= 20) return 'basic';
    if (apartments <= 50) return this.randomChoice(['standard', 'plus']);
    if (apartments <= 100) return this.randomChoice(['plus', 'premium']);
    return 'enterprise';
  }

  private generateTrialEndDate(): string | undefined {
    if (this.randomBoolean(0.8)) return undefined; // 80% are not on trial
    
    const trialDays = this.randomInt(7, 30);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDays);
    
    return trialEnd.toISOString().split('T')[0];
  }

  private generateCreatedDate(): string {
    const daysAgo = this.randomInt(30, 1095); // 30 days to 3 years ago
    const created = new Date();
    created.setDate(created.getDate() - daysAgo);
    
    return created.toISOString().replace('T', ' ').split('.')[0];
  }

  private generateUpdatedDate(): string {
    const daysAgo = this.randomInt(0, 30); // Updated within last 30 days
    const updated = new Date();
    updated.setDate(updated.getDate() - daysAgo);
    
    return updated.toISOString().replace('T', ' ').split('.')[0];
  }
}