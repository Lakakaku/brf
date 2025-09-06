/**
 * Swedish Data Sources for Test Data Generation
 * 
 * Comprehensive collection of realistic Swedish data for generating
 * test data for BRF (Bostadsrättsförening) portal testing.
 * 
 * Includes names, addresses, companies, and other Swedish-specific data
 * patterns following GDPR compliance for test data usage.
 */

export interface SwedishName {
  first: string;
  last: string;
  gender?: 'male' | 'female' | 'neutral';
}

export interface SwedishAddress {
  street: string;
  postalCode: string;
  city: string;
  municipality: string;
  county: string;
}

export interface SwedishCompany {
  name: string;
  orgNumber: string;
  industry: string;
  vatNumber?: string;
}

// Common Swedish first names with gender indication
export const SWEDISH_FIRST_NAMES: SwedishName[] = [
  // Male names
  { first: 'Erik', last: '', gender: 'male' },
  { first: 'Lars', last: '', gender: 'male' },
  { first: 'Karl', last: '', gender: 'male' },
  { first: 'Anders', last: '', gender: 'male' },
  { first: 'Johan', last: '', gender: 'male' },
  { first: 'Nils', last: '', gender: 'male' },
  { first: 'Per', last: '', gender: 'male' },
  { first: 'Olof', last: '', gender: 'male' },
  { first: 'Magnus', last: '', gender: 'male' },
  { first: 'Mikael', last: '', gender: 'male' },
  { first: 'Daniel', last: '', gender: 'male' },
  { first: 'Fredrik', last: '', gender: 'male' },
  { first: 'Stefan', last: '', gender: 'male' },
  { first: 'Peter', last: '', gender: 'male' },
  { first: 'Mattias', last: '', gender: 'male' },
  { first: 'Jonas', last: '', gender: 'male' },
  { first: 'Henrik', last: '', gender: 'male' },
  { first: 'Andreas', last: '', gender: 'male' },
  { first: 'Martin', last: '', gender: 'male' },
  { first: 'Thomas', last: '', gender: 'male' },
  { first: 'Christian', last: '', gender: 'male' },
  { first: 'Alexander', last: '', gender: 'male' },
  { first: 'Gustav', last: '', gender: 'male' },
  { first: 'David', last: '', gender: 'male' },
  { first: 'Oscar', last: '', gender: 'male' },

  // Female names
  { first: 'Anna', last: '', gender: 'female' },
  { first: 'Maria', last: '', gender: 'female' },
  { first: 'Karin', last: '', gender: 'female' },
  { first: 'Eva', last: '', gender: 'female' },
  { first: 'Birgitta', last: '', gender: 'female' },
  { first: 'Margareta', last: '', gender: 'female' },
  { first: 'Elisabeth', last: '', gender: 'female' },
  { first: 'Lena', last: '', gender: 'female' },
  { first: 'Marie', last: '', gender: 'female' },
  { first: 'Ingrid', last: '', gender: 'female' },
  { first: 'Christina', last: '', gender: 'female' },
  { first: 'Cecilia', last: '', gender: 'female' },
  { first: 'Susanne', last: '', gender: 'female' },
  { first: 'Monica', last: '', gender: 'female' },
  { first: 'Barbro', last: '', gender: 'female' },
  { first: 'Inger', last: '', gender: 'female' },
  { first: 'Annika', last: '', gender: 'female' },
  { first: 'Marianne', last: '', gender: 'female' },
  { first: 'Gunnel', last: '', gender: 'female' },
  { first: 'Helena', last: '', gender: 'female' },
  { first: 'Åsa', last: '', gender: 'female' },
  { first: 'Gunilla', last: '', gender: 'female' },
  { first: 'Carina', last: '', gender: 'female' },
  { first: 'Ulrika', last: '', gender: 'female' },
  { first: 'Linda', last: '', gender: 'female' }
];

// Common Swedish last names
export const SWEDISH_LAST_NAMES: string[] = [
  'Andersson',
  'Johansson',
  'Karlsson',
  'Nilsson',
  'Eriksson',
  'Larsson',
  'Olsson',
  'Persson',
  'Svensson',
  'Gustafsson',
  'Pettersson',
  'Jonsson',
  'Jansson',
  'Hansson',
  'Bengtsson',
  'Jönsson',
  'Lindberg',
  'Jakobsson',
  'Magnusson',
  'Olofsson',
  'Lindström',
  'Lindqvist',
  'Lindgren',
  'Berg',
  'Axelsson',
  'Hedberg',
  'Hellström',
  'Lundberg',
  'Sjöberg',
  'Wallin',
  'Engström',
  'Eklund',
  'Danielsson',
  'Håkansson',
  'Lundin',
  'Björk',
  'Bergström',
  'Sandberg',
  'Lind',
  'Mattsson',
  'Forsberg',
  'Fredriksson',
  'Henriksson',
  'Nyström',
  'Sundberg',
  'Åberg',
  'Fransson',
  'Holmberg',
  'Samuelsson',
  'Blomqvist'
];

// Swedish cities and addresses
export const SWEDISH_CITIES_DATA: SwedishAddress[] = [
  // Stockholm area
  {
    street: 'Kungsgatan',
    postalCode: '111 43',
    city: 'Stockholm',
    municipality: 'Stockholm',
    county: 'Stockholm'
  },
  {
    street: 'Vasagatan',
    postalCode: '101 37',
    city: 'Stockholm',
    municipality: 'Stockholm',
    county: 'Stockholm'
  },
  {
    street: 'Sveavägen',
    postalCode: '113 46',
    city: 'Stockholm',
    municipality: 'Stockholm',
    county: 'Stockholm'
  },
  {
    street: 'Östermalmsplatsen',
    postalCode: '114 42',
    city: 'Stockholm',
    municipality: 'Stockholm',
    county: 'Stockholm'
  },
  {
    street: 'Södermalmsallén',
    postalCode: '118 28',
    city: 'Stockholm',
    municipality: 'Stockholm',
    county: 'Stockholm'
  },

  // Gothenburg area
  {
    street: 'Avenyn',
    postalCode: '411 36',
    city: 'Göteborg',
    municipality: 'Göteborg',
    county: 'Västra Götaland'
  },
  {
    street: 'Nordstan',
    postalCode: '411 05',
    city: 'Göteborg',
    municipality: 'Göteborg',
    county: 'Västra Götaland'
  },
  {
    street: 'Linnégatan',
    postalCode: '413 04',
    city: 'Göteborg',
    municipality: 'Göteborg',
    county: 'Västra Götaland'
  },

  // Malmö area
  {
    street: 'Södergatan',
    postalCode: '211 34',
    city: 'Malmö',
    municipality: 'Malmö',
    county: 'Skåne'
  },
  {
    street: 'Stortorget',
    postalCode: '211 22',
    city: 'Malmö',
    municipality: 'Malmö',
    county: 'Skåne'
  },
  {
    street: 'Värnhemstorget',
    postalCode: '211 16',
    city: 'Malmö',
    municipality: 'Malmö',
    county: 'Skåne'
  },

  // Uppsala
  {
    street: 'Kungsgatan',
    postalCode: '753 21',
    city: 'Uppsala',
    municipality: 'Uppsala',
    county: 'Uppsala'
  },
  {
    street: 'Sankt Eriks torg',
    postalCode: '753 10',
    city: 'Uppsala',
    municipality: 'Uppsala',
    county: 'Uppsala'
  },

  // Linköping
  {
    street: 'Stora torget',
    postalCode: '582 19',
    city: 'Linköping',
    municipality: 'Linköping',
    county: 'Östergötland'
  },

  // Västerås
  {
    street: 'Stora gatan',
    postalCode: '722 15',
    city: 'Västerås',
    municipality: 'Västerås',
    county: 'Västmanland'
  },

  // Örebro
  {
    street: 'Drottninggatan',
    postalCode: '701 45',
    city: 'Örebro',
    municipality: 'Örebro',
    county: 'Örebro'
  },

  // Helsingborg
  {
    street: 'Stortorget',
    postalCode: '252 20',
    city: 'Helsingborg',
    municipality: 'Helsingborg',
    county: 'Skåne'
  },

  // Norrköping
  {
    street: 'Drottninggatan',
    postalCode: '602 24',
    city: 'Norrköping',
    municipality: 'Norrköping',
    county: 'Östergötland'
  },

  // Lund
  {
    street: 'Stortorget',
    postalCode: '222 23',
    city: 'Lund',
    municipality: 'Lund',
    county: 'Skåne'
  }
];

// Street name variations for generating different addresses
export const SWEDISH_STREET_NAMES: string[] = [
  'Kungsgatan',
  'Drottninggatan',
  'Vasagatan',
  'Sveavägen',
  'Storgatan',
  'Järnvägsgatan',
  'Skolhultsvägen',
  'Ringvägen',
  'Västerlånggatan',
  'Östermalmsallén',
  'Södermalmsallén',
  'Norrmalmstorg',
  'Birger Jarlsgatan',
  'Hamngatan',
  'Regeringsgatan',
  'Upplandsgatan',
  'Odengatan',
  'Tulegatan',
  'Rådmansgatan',
  'Biblioteksgatan',
  'Nybrogatan',
  'Strandvägen',
  'Karlavägen',
  'Valhallavägen',
  'Sankt Eriksgatan',
  'Fleminggatan',
  'Hornsgatan',
  'Götgatan',
  'Folkungagatan',
  'Katarinavägen',
  'Södermannagatan',
  'Upplandsgatan',
  'Västmannagatan',
  'Hantverkargatan',
  'Scheelegatan',
  'Kungsholmsgatan',
  'Pontonjärgatan',
  'Sankt Göransgatan'
];

// Swedish companies commonly involved with BRF services
export const SWEDISH_BRF_COMPANIES: SwedishCompany[] = [
  // Property management companies
  {
    name: 'Stockholmshem AB',
    orgNumber: '556021-6034',
    industry: 'Property Management',
    vatNumber: 'SE556021603401'
  },
  {
    name: 'Svenska Bostäder AB',
    orgNumber: '556013-8607',
    industry: 'Property Management',
    vatNumber: 'SE556013860701'
  },
  {
    name: 'Fastighets AB Balder',
    orgNumber: '556035-6511',
    industry: 'Property Management',
    vatNumber: 'SE556035651101'
  },
  {
    name: 'Wallenstam AB',
    orgNumber: '556072-1523',
    industry: 'Property Management',
    vatNumber: 'SE556072152301'
  },

  // Cleaning companies
  {
    name: 'ISS Facility Services AB',
    orgNumber: '556073-2687',
    industry: 'Cleaning Services',
    vatNumber: 'SE556073268701'
  },
  {
    name: 'Coor Service Management AB',
    orgNumber: '556067-0806',
    industry: 'Cleaning Services',
    vatNumber: 'SE556067080601'
  },
  {
    name: 'Svensk Lokalvård AB',
    orgNumber: '556234-5678',
    industry: 'Cleaning Services',
    vatNumber: 'SE556234567801'
  },

  // Construction and maintenance
  {
    name: 'Skanska Sverige AB',
    orgNumber: '556000-4615',
    industry: 'Construction',
    vatNumber: 'SE556000461501'
  },
  {
    name: 'NCC Sverige AB',
    orgNumber: '556034-5174',
    industry: 'Construction',
    vatNumber: 'SE556034517401'
  },
  {
    name: 'Peab Sverige AB',
    orgNumber: '556061-4330',
    industry: 'Construction',
    vatNumber: 'SE556061433001'
  },
  {
    name: 'JM AB',
    orgNumber: '556058-6004',
    industry: 'Construction',
    vatNumber: 'SE556058600401'
  },

  // Energy and utilities
  {
    name: 'Vattenfall AB',
    orgNumber: '556036-2138',
    industry: 'Energy',
    vatNumber: 'SE556036213801'
  },
  {
    name: 'Stockholm Exergi AB',
    orgNumber: '556000-7213',
    industry: 'Energy',
    vatNumber: 'SE556000721301'
  },
  {
    name: 'Göteborg Energi AB',
    orgNumber: '556463-2481',
    industry: 'Energy',
    vatNumber: 'SE556463248101'
  },
  {
    name: 'E.ON Energilösningar AB',
    orgNumber: '556006-8420',
    industry: 'Energy',
    vatNumber: 'SE556006842001'
  },

  // Telecommunications
  {
    name: 'Telia Sverige AB',
    orgNumber: '556025-5916',
    industry: 'Telecommunications',
    vatNumber: 'SE556025591601'
  },
  {
    name: 'Telenor Sverige AB',
    orgNumber: '556421-0309',
    industry: 'Telecommunications',
    vatNumber: 'SE556421030901'
  },
  {
    name: 'Com Hem AB',
    orgNumber: '556858-6613',
    industry: 'Telecommunications',
    vatNumber: 'SE556858661301'
  },

  // Insurance
  {
    name: 'Länsförsäkringar AB',
    orgNumber: '556549-7020',
    industry: 'Insurance',
    vatNumber: 'SE556549702001'
  },
  {
    name: 'IF Skadeförsäkring AB',
    orgNumber: '516401-8102',
    industry: 'Insurance',
    vatNumber: 'SE516401810201'
  },
  {
    name: 'Trygg-Hansa Försäkring AB',
    orgNumber: '516401-7799',
    industry: 'Insurance',
    vatNumber: 'SE516401779901'
  },

  // Legal and accounting
  {
    name: 'Advokatfirman Vinge KB',
    orgNumber: '969606-0477',
    industry: 'Legal Services',
    vatNumber: 'SE969606047701'
  },
  {
    name: 'PwC Sverige AB',
    orgNumber: '556061-8797',
    industry: 'Accounting',
    vatNumber: 'SE556061879701'
  },
  {
    name: 'KPMG AB',
    orgNumber: '556043-4465',
    industry: 'Accounting',
    vatNumber: 'SE556043446501'
  }
];

// BRF-specific terminology and data patterns
export const BRF_TERMINOLOGY = {
  roles: ['member', 'board', 'chairman', 'treasurer', 'admin'] as const,
  meetingTypes: ['regular', 'extraordinary', 'annual', 'constituting'] as const,
  caseCategories: [
    'maintenance',
    'renovation',
    'complaint',
    'billing',
    'insurance',
    'legal',
    'energy',
    'security',
    'cleanliness',
    'noise',
    'parking',
    'storage',
    'common_areas',
    'laundry',
    'garden'
  ],
  casePriorities: ['urgent', 'high', 'normal', 'low'] as const,
  caseStatuses: ['open', 'in_progress', 'waiting', 'resolved', 'closed'] as const,
  paymentMethods: ['autogiro', 'invoice', 'swish', 'bank_transfer'] as const,
  paymentStatuses: ['pending', 'paid', 'overdue', 'cancelled'] as const,
  accountingStandards: ['K2', 'K3'] as const,
  energyCertificates: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
};

// Swedish personal number patterns for test data (fake but valid format)
export function generateSwedishPersonNumber(birthDate?: Date): string {
  const date = birthDate || new Date(
    1950 + Math.floor(Math.random() * 60), // Birth year 1950-2009
    Math.floor(Math.random() * 12), // Month 0-11
    1 + Math.floor(Math.random() * 28) // Day 1-28
  );
  
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Birth number (3 digits) + control digit (1 digit)
  const birthNumber = Math.floor(Math.random() * 999).toString().padStart(3, '0');
  const controlDigit = Math.floor(Math.random() * 10);
  
  return `${year}${month}${day}-${birthNumber}${controlDigit}`;
}

// Swedish organization number patterns for test data
export function generateSwedishOrgNumber(): string {
  // Swedish org numbers start with 2, 5, 6, 7, 8, or 9
  const firstDigit = [2, 5, 6, 7, 8, 9][Math.floor(Math.random() * 6)];
  const remainingDigits = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  const controlDigit = Math.floor(Math.random() * 10);
  
  return `${firstDigit}${remainingDigits.slice(0, 5)}-${remainingDigits.slice(5)}${controlDigit}`;
}

// Swedish postal code patterns
export function generateSwedishPostalCode(city?: string): string {
  // Realistic postal code ranges for major cities
  const cityRanges: { [key: string]: { min: number; max: number } } = {
    'Stockholm': { min: 10000, max: 19999 },
    'Göteborg': { min: 40000, max: 44999 },
    'Malmö': { min: 20000, max: 23999 },
    'Uppsala': { min: 75000, max: 75999 },
    'Linköping': { min: 58000, max: 58999 },
    'Västerås': { min: 72000, max: 72999 },
    'Örebro': { min: 70000, max: 70999 },
    'Helsingborg': { min: 25000, max: 25999 },
    'Norrköping': { min: 60000, max: 60999 },
    'Lund': { min: 22000, max: 22999 }
  };
  
  let min = 10000, max = 99999;
  if (city && cityRanges[city]) {
    min = cityRanges[city].min;
    max = cityRanges[city].max;
  }
  
  const code = min + Math.floor(Math.random() * (max - min));
  return `${Math.floor(code / 100)} ${(code % 100).toString().padStart(2, '0')}`;
}

// Generate realistic Swedish bank account numbers
export function generateSwedishBankAccount(): {
  clearingNumber: string;
  accountNumber: string;
  fullAccountNumber: string;
} {
  // Major Swedish bank clearing number ranges
  const bankRanges = [
    { min: 1100, max: 1199, name: 'Nordea' },
    { min: 1200, max: 1399, name: 'Danske Bank' },
    { min: 1400, max: 1499, name: 'Nordea' },
    { min: 1500, max: 1599, name: 'SEB' },
    { min: 1600, max: 1699, name: 'Swedbank' },
    { min: 1700, max: 1799, name: 'ICA Banken' },
    { min: 1800, max: 1899, name: 'Swedbank' },
    { min: 1900, max: 1999, name: 'Länsförsäkringar Bank' },
    { min: 2300, max: 2399, name: 'Ålandsbanken' },
    { min: 2400, max: 2499, name: 'Danske Bank' },
    { min: 3000, max: 3299, name: 'Nordea' },
    { min: 3300, max: 3399, name: 'Nordea' },
    { min: 3400, max: 3409, name: 'Länsförsäkringar Bank' },
    { min: 3410, max: 3781, name: 'Nordea' },
    { min: 4000, max: 4999, name: 'Nordea' },
    { min: 5000, max: 5999, name: 'SEB' },
    { min: 6000, max: 6999, name: 'Handelsbanken' },
    { min: 7000, max: 7999, name: 'Swedbank' },
    { min: 8000, max: 8999, name: 'Swedbank' },
    { min: 9000, max: 9999, name: 'Länsförsäkringar Bank' }
  ];
  
  const selectedBank = bankRanges[Math.floor(Math.random() * bankRanges.length)];
  const clearingNumber = (selectedBank.min + Math.floor(Math.random() * (selectedBank.max - selectedBank.min + 1))).toString();
  const accountNumber = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  
  return {
    clearingNumber,
    accountNumber,
    fullAccountNumber: `${clearingNumber}-${accountNumber}`
  };
}

// Generate Swedish Bankgiro numbers
export function generateSwedishBankgiro(): string {
  // Bankgiro numbers are 7-8 digits with specific patterns
  const length = Math.random() > 0.5 ? 7 : 8;
  const number = Math.floor(Math.random() * Math.pow(10, length - 1)) + Math.pow(10, length - 1);
  return number.toString();
}

// Generate Swedish Plusgiro numbers
export function generateSwedishPlusgiro(): string {
  // Plusgiro numbers can be 2-8 digits
  const length = 2 + Math.floor(Math.random() * 7);
  const number = Math.floor(Math.random() * Math.pow(10, length - 1)) + Math.pow(10, length - 1);
  return number.toString();
}

// Property designation patterns (fastighetsbeteckning)
export function generatePropertyDesignation(municipality: string): string {
  const blockNames = [
    'Björken', 'Eken', 'Granen', 'Linden', 'Lönnnen', 'Aspen', 'Almen',
    'Kastanjen', 'Poppeln', 'Viden', 'Hasselm', 'Oxeln', 'Järneken',
    'Silvern', 'Guldm', 'Koppar', 'Bronsn', 'Stålet', 'Järnet',
    'Kornet', 'Vetet', 'Rågen', 'Havren', 'Bygget', 'Malten'
  ];
  
  const blockName = blockNames[Math.floor(Math.random() * blockNames.length)];
  const blockNumber = 1 + Math.floor(Math.random() * 50);
  
  return `${municipality} ${blockName} ${blockNumber}`;
}

// Utility functions
export function getRandomSwedishName(): SwedishName {
  const firstName = SWEDISH_FIRST_NAMES[Math.floor(Math.random() * SWEDISH_FIRST_NAMES.length)];
  const lastName = SWEDISH_LAST_NAMES[Math.floor(Math.random() * SWEDISH_LAST_NAMES.length)];
  
  return {
    first: firstName.first,
    last: lastName,
    gender: firstName.gender
  };
}

export function getRandomSwedishAddress(): SwedishAddress {
  const baseAddress = SWEDISH_CITIES_DATA[Math.floor(Math.random() * SWEDISH_CITIES_DATA.length)];
  const streetName = SWEDISH_STREET_NAMES[Math.floor(Math.random() * SWEDISH_STREET_NAMES.length)];
  const streetNumber = 1 + Math.floor(Math.random() * 100);
  
  return {
    ...baseAddress,
    street: `${streetName} ${streetNumber}`,
    postalCode: generateSwedishPostalCode(baseAddress.city)
  };
}

export function getRandomSwedishCompany(): SwedishCompany {
  return SWEDISH_BRF_COMPANIES[Math.floor(Math.random() * SWEDISH_BRF_COMPANIES.length)];
}

export function generateRealisticEmail(firstName: string, lastName: string, domain?: string): string {
  const domains = domain ? [domain] : [
    'gmail.com', 'hotmail.com', 'yahoo.se', 'outlook.com', 'telia.com',
    'spray.se', 'bredband.net', 'bahnhof.se', 'comhem.se', 'tele2.se'
  ];
  
  const selectedDomain = domains[Math.floor(Math.random() * domains.length)];
  const patterns = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${Math.floor(Math.random() * 100)}`,
    `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}.${lastName.charAt(0).toLowerCase()}`
  ];
  
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  return `${pattern}@${selectedDomain}`;
}

export function generateSwedishPhoneNumber(): string {
  // Swedish mobile numbers start with 070, 072, 073, 076, 079
  const prefixes = ['070', '072', '073', '076', '079'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  
  return `${prefix}-${number.slice(0, 3)} ${number.slice(3)}`;
}