import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import {
  Cooperative,
  Member,
  Apartment,
  Document,
  Invoice,
  MonthlyFee,
  Case,
  CreateCooperative,
  CreateMember,
  CreateApartment,
  CreateDocument,
  CreateInvoice,
  CreateMonthlyFee,
  CreateCase,
} from '../types';

// Helper function to generate UUID-like string
function generateId(): string {
  return randomBytes(16).toString('hex');
}

// Helper function to generate Swedish organization number
function generateOrgNumber(): string {
  const base = Math.floor(Math.random() * 900000) + 100000; // 6 digits
  return `16${base}-0001`;
}

// Helper function to generate random date in the past year
function randomDateInPast(days: number = 365): string {
  const now = new Date();
  const past = new Date(
    now.getTime() - Math.random() * days * 24 * 60 * 60 * 1000
  );
  return past.toISOString();
}

// Helper function to generate OCR number
function generateOcrNumber(
  cooperativeIndex: number,
  apartmentNum: number,
  year: number,
  month: number
): string {
  const coopId = String(cooperativeIndex + 1).padStart(2, '0');
  const base = `${coopId}${String(apartmentNum).padStart(4, '0')}${year}${String(month).padStart(2, '0')}`;
  // Simple checksum (not real Luhn algorithm, but good enough for demo)
  const checksum = (parseInt(base) % 10).toString();
  return base + checksum;
}

export async function seedDevelopmentData(
  db: Database.Database
): Promise<void> {
  console.log('🌱 Seeding development data...');

  try {
    // Start transaction
    const transaction = db.transaction(() => {
      seedCooperatives(db);
      seedMembers(db);
      seedApartments(db);
      seedDocuments(db);
      seedInvoices(db);
      seedMonthlyFees(db);
      seedCases(db);
    });

    transaction();
    console.log('✅ Development data seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed development data:', error);
    throw error;
  }
}

function seedCooperatives(db: Database.Database): void {
  console.log('👥 Seeding cooperatives...');

  const cooperatives: CreateCooperative[] = [
    {
      org_number: generateOrgNumber(),
      name: 'Brf Blommans Väg 12',
      subdomain: 'blommans-vag-12',
      street_address: 'Blommans Väg 12',
      postal_code: '123 45',
      city: 'Stockholm',
      settings: JSON.stringify({
        currency: 'SEK',
        language: 'sv',
        timezone: 'Europe/Stockholm',
        monthly_fee_due_day: 25,
        late_payment_fee: 100,
      }),
      features: JSON.stringify({
        standard: true,
        document_scanning: true,
        case_management: true,
        financial_reports: true,
      }),
      subscription_tier: 'premium',
      subscription_status: 'active',
    },
    {
      org_number: generateOrgNumber(),
      name: 'Brf Rosengården',
      subdomain: 'rosengarden',
      street_address: 'Rosengatan 5-7',
      postal_code: '456 78',
      city: 'Göteborg',
      settings: JSON.stringify({
        currency: 'SEK',
        language: 'sv',
        timezone: 'Europe/Stockholm',
        monthly_fee_due_day: 28,
        late_payment_fee: 150,
      }),
      features: JSON.stringify({
        standard: true,
        document_scanning: false,
        case_management: true,
        financial_reports: false,
      }),
      subscription_tier: 'standard',
      subscription_status: 'active',
    },
    {
      org_number: generateOrgNumber(),
      name: 'Brf Strandpromenaden',
      subdomain: 'strandpromenaden',
      street_address: 'Strandpromenaden 15',
      postal_code: '789 12',
      city: 'Malmö',
      settings: JSON.stringify({
        currency: 'SEK',
        language: 'sv',
        timezone: 'Europe/Stockholm',
        monthly_fee_due_day: 30,
        late_payment_fee: 75,
      }),
      features: JSON.stringify({
        standard: true,
        document_scanning: true,
        case_management: true,
        financial_reports: true,
      }),
      subscription_tier: 'premium',
      subscription_status: 'trial',
      trial_ends_at: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    },
  ];

  const insertCooperative = db.prepare(`
    INSERT INTO cooperatives (
      id, org_number, name, subdomain, street_address, postal_code, city,
      settings, features, subscription_tier, subscription_status, trial_ends_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  cooperatives.forEach(coop => {
    const id = generateId();
    insertCooperative.run(
      id,
      coop.org_number,
      coop.name,
      coop.subdomain,
      coop.street_address,
      coop.postal_code,
      coop.city,
      coop.settings,
      coop.features,
      coop.subscription_tier,
      coop.subscription_status,
      coop.trial_ends_at || null
    );
  });

  console.log(`✅ Seeded ${cooperatives.length} cooperatives`);
}

function seedMembers(db: Database.Database): void {
  console.log('👤 Seeding members...');

  // Get cooperative IDs
  const cooperatives = db.prepare('SELECT id FROM cooperatives').all() as {
    id: string;
  }[];

  const memberTemplates = [
    {
      first_name: 'Anna',
      last_name: 'Andersson',
      email: 'anna.andersson@example.com',
      role: 'chairman' as const,
    },
    {
      first_name: 'Erik',
      last_name: 'Eriksson',
      email: 'erik.eriksson@example.com',
      role: 'treasurer' as const,
    },
    {
      first_name: 'Maria',
      last_name: 'Nilsson',
      email: 'maria.nilsson@example.com',
      role: 'board' as const,
    },
    {
      first_name: 'Johan',
      last_name: 'Johansson',
      email: 'johan.johansson@example.com',
      role: 'board' as const,
    },
    {
      first_name: 'Lisa',
      last_name: 'Larsson',
      email: 'lisa.larsson@example.com',
      role: 'member' as const,
    },
    {
      first_name: 'Per',
      last_name: 'Persson',
      email: 'per.persson@example.com',
      role: 'member' as const,
    },
    {
      first_name: 'Karin',
      last_name: 'Karlsson',
      email: 'karin.karlsson@example.com',
      role: 'member' as const,
    },
    {
      first_name: 'Mikael',
      last_name: 'Svensson',
      email: 'mikael.svensson@example.com',
      role: 'member' as const,
    },
    {
      first_name: 'Helena',
      last_name: 'Gustafsson',
      email: 'helena.gustafsson@example.com',
      role: 'member' as const,
    },
    {
      first_name: 'Lars',
      last_name: 'Lindberg',
      email: 'lars.lindberg@example.com',
      role: 'member' as const,
    },
  ];

  const insertMember = db.prepare(`
    INSERT INTO members (
      id, cooperative_id, email, first_name, last_name, phone, role, 
      permissions, is_active, password_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  cooperatives.forEach(coop => {
    memberTemplates.forEach((template, index) => {
      const id = generateId();
      const email = template.email.replace(
        '@example.com',
        `+${coop.id.slice(-4)}@example.com`
      );
      const phone = `070-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 90) + 10}`;

      const permissions = JSON.stringify({
        view_financial_reports: ['chairman', 'treasurer', 'board'].includes(
          template.role
        ),
        manage_members: ['chairman'].includes(template.role),
        approve_invoices: ['chairman', 'treasurer'].includes(template.role),
        manage_cases: ['chairman', 'board'].includes(template.role),
        view_documents: true,
      });

      // Simple password hash for demo (in real app, use proper hashing)
      const passwordHash =
        'demo-password-hash-' + template.first_name.toLowerCase();

      insertMember.run(
        id,
        coop.id,
        email,
        template.first_name,
        template.last_name,
        phone,
        template.role,
        permissions,
        1,
        passwordHash
      );
    });
  });

  const totalMembers = cooperatives.length * memberTemplates.length;
  console.log(`✅ Seeded ${totalMembers} members`);
}

function seedApartments(db: Database.Database): void {
  console.log('🏠 Seeding apartments...');

  // Get cooperative and member data
  const cooperatives = db.prepare('SELECT id FROM cooperatives').all() as {
    id: string;
  }[];

  const insertApartment = db.prepare(`
    INSERT INTO apartments (
      id, cooperative_id, apartment_number, share_number, size_sqm, rooms,
      floor, building, monthly_fee, share_capital, owner_id, ownership_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  cooperatives.forEach(coop => {
    // Get members for this cooperative
    const members = db
      .prepare('SELECT id FROM members WHERE cooperative_id = ?')
      .all(coop.id) as { id: string }[];

    // Create apartments (more apartments than members to simulate some vacant units)
    for (let i = 1; i <= 15; i++) {
      const id = generateId();
      const apartmentNumber = `${Math.floor(i / 10) + 1}${String(i).padStart(3, '0')}`;
      const shareNumber = `A${String(i).padStart(3, '0')}`;
      const sizeSqm = 30 + Math.random() * 80; // 30-110 sqm
      const rooms = Math.ceil(sizeSqm / 30); // Rough calculation
      const floor = Math.floor((i - 1) / 5) + 1; // 5 apartments per floor
      const building = i <= 10 ? 'A' : 'B';
      const monthlyFee = Math.round(sizeSqm * 45 + Math.random() * 500); // ~45 SEK/sqm + variation
      const shareCapital = Math.round(sizeSqm * 8000 + Math.random() * 100000); // Rough estimate

      // Assign owner (some apartments might be vacant)
      const ownerId = i <= members.length ? members[i - 1].id : null;
      const ownershipDate = ownerId ? randomDateInPast(365 * 3) : null; // Within 3 years

      insertApartment.run(
        id,
        coop.id,
        apartmentNumber,
        shareNumber,
        sizeSqm,
        rooms,
        floor,
        building,
        monthlyFee,
        shareCapital,
        ownerId,
        ownershipDate
      );
    }
  });

  const totalApartments = cooperatives.length * 15;
  console.log(`✅ Seeded ${totalApartments} apartments`);
}

function seedDocuments(db: Database.Database): void {
  console.log('📄 Seeding documents...');

  const cooperatives = db.prepare('SELECT id FROM cooperatives').all() as {
    id: string;
  }[];

  const documentTypes = [
    {
      type: 'invoice',
      filename: 'vattenfall_invoice_202401.pdf',
      category: 'utilities',
    },
    {
      type: 'protocol',
      filename: 'board_meeting_202401.pdf',
      category: 'meetings',
    },
    {
      type: 'contract',
      filename: 'cleaning_contract_2024.pdf',
      category: 'contracts',
    },
    {
      type: 'invoice',
      filename: 'repair_invoice_bathroom.pdf',
      category: 'maintenance',
    },
    {
      type: 'receipt',
      filename: 'paint_receipt_hallway.pdf',
      category: 'maintenance',
    },
    {
      type: 'insurance',
      filename: 'building_insurance_2024.pdf',
      category: 'insurance',
    },
    { type: 'audit', filename: 'annual_audit_2023.pdf', category: 'financial' },
    {
      type: 'invoice',
      filename: 'heating_invoice_winter.pdf',
      category: 'utilities',
    },
  ];

  const insertDocument = db.prepare(`
    INSERT INTO documents (
      id, cooperative_id, filename, mime_type, size_bytes, file_path,
      document_type, category, tags, status, processed_at, ocr_text,
      confidence_score, uploaded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  cooperatives.forEach(coop => {
    // Get members for this cooperative
    const members = db
      .prepare('SELECT id FROM members WHERE cooperative_id = ?')
      .all(coop.id) as { id: string }[];

    documentTypes.forEach(docTemplate => {
      const id = generateId();
      const sizeBytes = Math.floor(Math.random() * 5000000) + 100000; // 100KB - 5MB
      const filePath = `/uploads/${coop.id}/${id}_${docTemplate.filename}`;
      const tags = JSON.stringify([
        docTemplate.category,
        docTemplate.type,
        '2024',
      ]);
      const status = Math.random() > 0.2 ? 'completed' : 'pending'; // 80% completed
      const processedAt = status === 'completed' ? randomDateInPast(30) : null;

      // Mock OCR text for completed documents
      const ocrText =
        status === 'completed'
          ? `Mock OCR text for ${docTemplate.filename}. Invoice amount: ${Math.floor(Math.random() * 50000)} SEK. Due date: 2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}.`
          : null;

      const confidenceScore = ocrText ? Math.random() * 0.3 + 0.7 : null; // 70-100%
      const uploadedBy =
        members[Math.floor(Math.random() * Math.min(3, members.length))].id; // Usually board members upload

      insertDocument.run(
        id,
        coop.id,
        docTemplate.filename,
        'application/pdf',
        sizeBytes,
        filePath,
        docTemplate.type,
        docTemplate.category,
        tags,
        status,
        processedAt,
        ocrText,
        confidenceScore,
        uploadedBy
      );
    });
  });

  const totalDocuments = cooperatives.length * documentTypes.length;
  console.log(`✅ Seeded ${totalDocuments} documents`);
}

function seedInvoices(db: Database.Database): void {
  console.log('💰 Seeding invoices...');

  const cooperatives = db.prepare('SELECT id FROM cooperatives').all() as {
    id: string;
  }[];

  const invoiceTemplates = [
    {
      supplier: 'Vattenfall AB',
      org_number: '556036-2138',
      type: 'electricity',
      base_amount: 15000,
    },
    {
      supplier: 'Fortum Värme AB',
      org_number: '556224-6715',
      type: 'heating',
      base_amount: 25000,
    },
    {
      supplier: 'Renhållning Stockholm',
      org_number: '556188-0149',
      type: 'waste',
      base_amount: 3500,
    },
    {
      supplier: 'Städservice Nordic AB',
      org_number: '556789-1234',
      type: 'cleaning',
      base_amount: 8000,
    },
    {
      supplier: 'Trygg-Hansa Försäkring',
      org_number: '516401-8102',
      type: 'insurance',
      base_amount: 12000,
    },
    {
      supplier: 'VVS Service Stockholm',
      org_number: '556456-7890',
      type: 'maintenance',
      base_amount: 4500,
    },
  ];

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      id, cooperative_id, invoice_number, supplier_name, supplier_org_number,
      amount_excl_vat, vat_amount, total_amount, currency, invoice_date,
      due_date, payment_date, payment_status, ocr_number, account_code,
      cost_center, approved_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  cooperatives.forEach(coop => {
    // Get board members who can approve invoices
    const boardMembers = db
      .prepare(
        `
      SELECT id FROM members 
      WHERE cooperative_id = ? AND role IN ('chairman', 'treasurer', 'board')
    `
      )
      .all(coop.id) as { id: string }[];

    invoiceTemplates.forEach(template => {
      // Create 2-3 invoices per template (different months)
      for (let month = 1; month <= 3; month++) {
        const id = generateId();
        const invoiceNumber = `INV-${template.supplier.split(' ')[0].toUpperCase()}-2024${String(month).padStart(2, '0')}-${Math.floor(Math.random() * 999) + 1}`;

        const amountExclVat =
          template.base_amount +
          (Math.random() * 0.2 - 0.1) * template.base_amount; // ±10% variation
        const vatAmount = amountExclVat * 0.25; // 25% VAT
        const totalAmount = amountExclVat + vatAmount;

        const invoiceDate = new Date(
          2024,
          month - 1,
          Math.floor(Math.random() * 28) + 1
        )
          .toISOString()
          .split('T')[0];
        const dueDate = new Date(
          new Date(invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split('T')[0];

        // Payment status distribution
        const rand = Math.random();
        let paymentStatus: 'paid' | 'pending' | 'overdue';
        let paymentDate: string | null = null;

        if (rand < 0.7) {
          // 70% paid
          paymentStatus = 'paid';
          paymentDate = new Date(
            new Date(dueDate).getTime() -
              Math.random() * 10 * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split('T')[0];
        } else if (rand < 0.9) {
          // 20% pending
          paymentStatus = 'pending';
        } else {
          // 10% overdue
          paymentStatus = 'overdue';
        }

        const ocrNumber = `${Math.floor(Math.random() * 90000) + 10000}${Math.floor(Math.random() * 90) + 10}`;
        const accountCode =
          template.type === 'electricity'
            ? '5410'
            : template.type === 'heating'
              ? '5420'
              : template.type === 'cleaning'
                ? '5460'
                : template.type === 'insurance'
                  ? '6310'
                  : '5490';

        const costCenter = `CC-${Math.floor(Math.random() * 9) + 1}${String(Math.floor(Math.random() * 99) + 1).padStart(2, '0')}`;
        const approvedBy =
          paymentStatus === 'paid'
            ? boardMembers[Math.floor(Math.random() * boardMembers.length)]?.id
            : null;

        insertInvoice.run(
          id,
          coop.id,
          invoiceNumber,
          template.supplier,
          template.org_number,
          Math.round(amountExclVat),
          Math.round(vatAmount),
          Math.round(totalAmount),
          'SEK',
          invoiceDate,
          dueDate,
          paymentDate,
          paymentStatus,
          ocrNumber,
          accountCode,
          costCenter,
          approvedBy
        );
      }
    });
  });

  const totalInvoices = cooperatives.length * invoiceTemplates.length * 3;
  console.log(`✅ Seeded ${totalInvoices} invoices`);
}

function seedMonthlyFees(db: Database.Database): void {
  console.log('🏦 Seeding monthly fees...');

  const cooperatives = db.prepare('SELECT id FROM cooperatives').all() as {
    id: string;
  }[];

  cooperatives.forEach((coop, coopIndex) => {
    // Get apartments for this cooperative
    const apartments = db
      .prepare(
        'SELECT id, apartment_number, monthly_fee FROM apartments WHERE cooperative_id = ?'
      )
      .all(coop.id) as {
      id: string;
      apartment_number: string;
      monthly_fee: number;
    }[];

    // Create fees for the last 6 months
    for (let monthsAgo = 0; monthsAgo < 6; monthsAgo++) {
      const date = new Date();
      date.setMonth(date.getMonth() - monthsAgo);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      apartments.forEach(apartment => {
        if (apartment.monthly_fee) {
          const id = generateId();
          const baseFee = apartment.monthly_fee * 0.8; // Base fee is 80% of total
          const parkingFee = Math.random() > 0.6 ? 500 : 0; // 40% have parking
          const storageFee = Math.random() > 0.7 ? 200 : 0; // 30% have storage
          const totalAmount = baseFee + parkingFee + storageFee;

          // Payment status - current month more likely to be pending
          const rand = Math.random();
          let paymentStatus: 'paid' | 'pending' | 'overdue';
          let paidDate: string | null = null;

          if (monthsAgo === 0) {
            // Current month
            paymentStatus =
              rand < 0.3 ? 'paid' : rand < 0.8 ? 'pending' : 'overdue';
          } else if (monthsAgo === 1) {
            // Last month
            paymentStatus =
              rand < 0.8 ? 'paid' : rand < 0.95 ? 'pending' : 'overdue';
          } else {
            // Older months
            paymentStatus = rand < 0.95 ? 'paid' : 'overdue';
          }

          if (paymentStatus === 'paid') {
            const paymentDay = Math.floor(Math.random() * 28) + 1;
            paidDate = new Date(year, month - 1, paymentDay)
              .toISOString()
              .split('T')[0];
          }

          const apartmentNum =
            parseInt(apartment.apartment_number.replace(/[A-Z]/g, '')) || 1;
          const ocrNumber = generateOcrNumber(
            coopIndex,
            apartmentNum,
            year,
            month
          );
          const paymentMethod =
            paymentStatus === 'paid'
              ? Math.random() > 0.8
                ? 'swish'
                : Math.random() > 0.5
                  ? 'autogiro'
                  : 'invoice'
              : null;

          const insertMonthlyFee = db.prepare(`
            INSERT INTO monthly_fees (
              id, cooperative_id, apartment_id, year, month, base_fee,
              parking_fee, storage_fee, other_fees, total_amount,
              payment_status, paid_date, payment_method, ocr_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          insertMonthlyFee.run(
            id,
            coop.id,
            apartment.id,
            year,
            month,
            Math.round(baseFee),
            parkingFee,
            storageFee,
            '{}',
            Math.round(totalAmount),
            paymentStatus,
            paidDate,
            paymentMethod,
            ocrNumber
          );
        }
      });
    }
  });

  const totalApartments = cooperatives.reduce((sum, coop) => {
    const count = db
      .prepare(
        'SELECT COUNT(*) as count FROM apartments WHERE cooperative_id = ?'
      )
      .get(coop.id) as { count: number };
    return sum + count.count;
  }, 0);

  console.log(`✅ Seeded ${totalApartments * 6} monthly fee records`);
}

function seedCases(db: Database.Database): void {
  console.log('📋 Seeding cases...');

  const cooperatives = db.prepare('SELECT id FROM cooperatives').all() as {
    id: string;
  }[];

  const caseTemplates = [
    {
      title: 'Vattenläcka i tvättstuga',
      category: 'maintenance',
      priority: 'urgent',
      location: 'tvättstuga',
    },
    {
      title: 'Trasig belysning i trapphus',
      category: 'maintenance',
      priority: 'high',
      location: 'trapphus',
    },
    {
      title: 'Buller från grannen',
      category: 'neighbor_dispute',
      priority: 'normal',
      location: null,
    },
    {
      title: 'Rengöring av gård behövs',
      category: 'cleaning',
      priority: 'normal',
      location: 'gård',
    },
    {
      title: 'Cykelställ fullt - behöver utökning',
      category: 'improvement',
      priority: 'low',
      location: 'cykelrum',
    },
    {
      title: 'Hiss har stannat mellan våningar',
      category: 'maintenance',
      priority: 'urgent',
      location: 'hiss',
    },
    {
      title: 'Förslag på ny lekplats',
      category: 'improvement',
      priority: 'low',
      location: 'gård',
    },
    {
      title: 'Skadegörelse på entré',
      category: 'vandalism',
      priority: 'high',
      location: 'entré',
    },
    {
      title: 'Värmeproblem i källaren',
      category: 'maintenance',
      priority: 'high',
      location: 'källare',
    },
    {
      title: 'Parkering på fel plats',
      category: 'parking',
      priority: 'normal',
      location: 'parkering',
    },
  ];

  const insertCase = db.prepare(`
    INSERT INTO cases (
      id, cooperative_id, case_number, title, description, category,
      priority, status, location, apartment_id, reported_by, assigned_to,
      reported_at, started_at, resolved_at, closed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  cooperatives.forEach(coop => {
    // Get members and apartments for this cooperative
    const members = db
      .prepare('SELECT id FROM members WHERE cooperative_id = ?')
      .all(coop.id) as { id: string }[];
    const apartments = db
      .prepare('SELECT id FROM apartments WHERE cooperative_id = ?')
      .all(coop.id) as { id: string }[];
    const boardMembers = db
      .prepare(
        `
      SELECT id FROM members 
      WHERE cooperative_id = ? AND role IN ('chairman', 'treasurer', 'board')
    `
      )
      .all(coop.id) as { id: string }[];

    // Get current max case number for this cooperative
    const maxCaseResult = db
      .prepare(
        'SELECT MAX(case_number) as max_num FROM cases WHERE cooperative_id = ?'
      )
      .get(coop.id) as { max_num: number };
    let currentCaseNumber = (maxCaseResult?.max_num || 0) + 1;

    caseTemplates.forEach(template => {
      const id = generateId();
      const description = `Detaljerad beskrivning av: ${template.title}. Detta ärende behöver åtgärdas enligt de rutiner som finns för ${template.category}.`;

      // Status distribution
      const rand = Math.random();
      let status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
      let startedAt: string | null = null;
      let resolvedAt: string | null = null;
      let closedAt: string | null = null;

      if (rand < 0.2) {
        // 20% open
        status = 'open';
      } else if (rand < 0.4) {
        // 20% in progress
        status = 'in_progress';
        startedAt = randomDateInPast(30);
      } else if (rand < 0.5) {
        // 10% waiting
        status = 'waiting';
        startedAt = randomDateInPast(45);
      } else if (rand < 0.7) {
        // 20% resolved
        status = 'resolved';
        startedAt = randomDateInPast(60);
        resolvedAt = randomDateInPast(15);
      } else {
        // 30% closed
        status = 'closed';
        startedAt = randomDateInPast(90);
        resolvedAt = randomDateInPast(30);
        closedAt = randomDateInPast(15);
      }

      const reportedAt = randomDateInPast(120);
      const reportedBy = members[Math.floor(Math.random() * members.length)].id;
      const assignedTo = [
        'in_progress',
        'waiting',
        'resolved',
        'closed',
      ].includes(status)
        ? boardMembers[Math.floor(Math.random() * boardMembers.length)]?.id
        : null;

      // Some cases are related to specific apartments
      const apartmentId =
        Math.random() > 0.5 && apartments.length > 0
          ? apartments[Math.floor(Math.random() * apartments.length)].id
          : null;

      insertCase.run(
        id,
        coop.id,
        currentCaseNumber++,
        template.title,
        description,
        template.category,
        template.priority,
        status,
        template.location,
        apartmentId,
        reportedBy,
        assignedTo,
        reportedAt,
        startedAt,
        resolvedAt,
        closedAt
      );
    });
  });

  const totalCases = cooperatives.length * caseTemplates.length;
  console.log(`✅ Seeded ${totalCases} cases`);
}

// Helper function to clear all data (for re-seeding)
export function clearAllData(db: Database.Database): void {
  console.log('🧹 Clearing all existing data...');

  const tables = [
    'audit_log',
    'notifications',
    'cases',
    'monthly_fees',
    'invoices',
    'documents',
    'apartments',
    'members',
    'cooperatives',
  ];

  tables.forEach(table => {
    db.exec(`DELETE FROM ${table}`);
  });

  console.log('✅ All data cleared');
}

// Utility function to seed specific data type
export async function seedSpecificData(
  db: Database.Database,
  type: string
): Promise<void> {
  console.log(`🌱 Seeding ${type} data...`);

  switch (type.toLowerCase()) {
    case 'cooperatives':
      seedCooperatives(db);
      break;
    case 'members':
      seedMembers(db);
      break;
    case 'apartments':
      seedApartments(db);
      break;
    case 'documents':
      seedDocuments(db);
      break;
    case 'invoices':
      seedInvoices(db);
      break;
    case 'monthly_fees':
      seedMonthlyFees(db);
      break;
    case 'cases':
      seedCases(db);
      break;
    default:
      console.error(`❌ Unknown data type: ${type}`);
      return;
  }

  console.log(`✅ ${type} data seeded successfully`);
}
