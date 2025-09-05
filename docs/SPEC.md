# BRF Portal - Complete Project Specification

## Executive Summary

**BRF Portal** is an AI-driven digital assistant platform for Swedish housing cooperatives (bostadsrättsföreningar). Starting as an affordable, easily-implemented solution for small to medium-sized BRFs (20-100 apartments), it will gradually expand to a complete ecosystem solution.

**Core Value Proposition**: Offer 80% of the value at 20% of the cost compared to traditional property managers (SBC/HSB).

**Target Market**: Sweden's 30,750 active BRFs, initially focusing on 20-60 apartments
**Market Potential**: 4 billion SEK annually
**Key Differentiator**: AI automation + low cost + simple implementation + BankID from start

## Development Philosophy

### Zero-Cost Development Phase

During initial development and until launch-ready:

- **NO PAID SERVICES**: No BankID, AI APIs (GPT-4), Scrive, or other paid integrations
- **USE FREE ALTERNATIVES**:
  - Mock authentication instead of BankID
  - Local AI models or rule-based systems instead of GPT-4
  - Simple file signatures instead of Scrive
  - SQLite instead of paid databases initially
- **FOCUS ON**: Core functionality that can be built without external costs
- **PREPARE FOR**: Easy integration of paid services when funding available

## 1. Market Position & Growth Strategy

### Phase 1: Digital Assistant (MVP)

**Position**: "The smartest help for your BRF - at a fraction of the cost"

**Core Functions**:

- Intelligent document management with AI
- Automated procurement and case management
- PERFECT integration with Fortnox/Visma
- BankID integration (prepared but not active until launch)

**Target Group**: BRFs with 20-60 apartments currently using:

- Excel + WhatsApp + manual work
- Fragmented solutions (Boappa + Fortnox + own website)
- Paying 50-150k/year total for various services

**Free Analysis Tool for Lead Generation**:

- "BRF Health Check" - analyzes public annual reports
- Generates improvement report
- 22,000+ potential leads

### Phase 2: Complementary Partner

**Position**: "We fill the gaps property managers miss - or become their AI engine"

- "Intel Inside" strategy for smaller property managers
- White-label solution for regional actors and accounting firms
- Partner with small property managers for digitalization
- Complement for associations with SBC/HSB

### Unique Selling Points (USPs)

1. **Real AI Integration from Day 1**
   - Automatic document understanding
   - Predictive maintenance based on crowdsourced data
   - Intelligent matching: problem → solution → contractor

2. **Radical Pricing**
   - Base: 500-1500 kr/month (compare: SBC 3000-5000, Boappa 325-1150)
   - All-inclusive: No setup fee, no hidden costs
   - ROI guarantee: "Save 10x license cost or money back"

3. **7-Day Implementation with BankID**
   - BankID integration from start (optional but recommended)
   - No IT knowledge required
   - AI reads 5 years of history automatically
   - Parallel operation with existing systems

## 2. Core Functionality - Detailed Implementation

### 2.1 AI Document Management - "Bomb Us With Everything"

#### Upload Process - REALLY Bomb Us With EVERYTHING

**No Real Limit - Upload EVERYTHING You Have**:

- Drag & drop 500, 1000, even 5000+ documents at once
- 20 years of paper archives? Photograph everything and upload
- 10 binders of old protocols? Upload them all
- Receipts from 1998? Yes, even those

**How to Upload**:

- Web: Drag & drop entire folders with thousands of files
- Mobile: Photograph every paper (AI fixes skewed images)
- Email: Forward to dokument@brfportalen.se
- Scanner: Scan as PDF and bulk upload

**File Formats**: Everything works!

- PDF, JPG, PNG, Word, Excel, TXT
- Even blurry mobile photos of handwritten notes
- Old fax copies, receipts, post-it notes

#### AI-Driven Deep Analysis

**Invoice Processing (95% accuracy)**:

- OCR reads all text including handwritten
- Extracts: Organization number → Supplier name via Bolagsverket
- Identifies: Invoice number, date, due date, amount, VAT
- Interprets description → Categorizes (electricity, heating, maintenance, cleaning)
- Links to project if project number exists
- Creates reminder 7 days before due date

**Protocol Processing (92% accuracy)**:

- Identifies meeting type through keywords
- Extracts date, present, absent
- Finds all decisions through phrases like "decided to", "approved", "rejected"
- Creates action list with responsible persons
- Links to related documents mentioned

**Inspection Processing (98% accuracy)**:

- Recognizes format from all major inspection companies
- Categorizes: OVK, electrical, elevator, roof, energy declaration
- Extracts status: Approved/Failed/Remarks
- Creates automatic follow-up tasks for each remark
- Sets deadline based on severity

**Contract Processing (94% accuracy)**:

- Identifies contracting party via organization number
- Extracts: Start date, end date, notice period
- Calculates termination date and creates reminder 3 months before
- Finds cost/month or year
- Flags auto-renewal clauses

#### Intelligent Organization

**Automatic Folder Structure**:

```
/Ekonomi
  /Fakturor
    /2024
      /El
      /Värme
      /Underhåll
  /Kvitton
  /Bokslut
/Fastighet
  /Besiktningar
  /Ritningar
  /Underhållsplaner
/Styrelse
  /Protokoll
  /Avtal
  /Stadgar
```

**Smart Tagging**:

- Each document gets 5-10 relevant tags
- Example invoice: [2024, december, electricity, Vattenfall, paid, 45000kr]
- Full-text search + tag filtering

### 2.2 Automation Engine

#### Meeting Minutes via AI

- Input: 2-hour meeting recording (audio or video)
- Output: Minutes in both long format and summary
- Automatically published for all members to read
- Time saving: 95% (2 hours → 5 minutes)

#### Smart Invoice Handling - Detailed Implementation

**How Invoices Enter the System**:

1. **Board Photographs/Uploads**:
   - Invoice arrives by mail or email
   - Treasurer/chairman takes photo with mobile
   - Or uploads PDF from email
   - AI reads and interprets automatically

2. **After Case Handling**:
   - Instructions to contractor: "Send invoice to: styrelsen@brfblomman.se, Mark with: Water leak apt 23"
   - Board receives invoice
   - Uploads PDF/photographs in app
   - AI automatically links to correct case

3. **Bulk Upload at Month End**:
   - Treasurer collects month's invoices
   - Drags in 20-50 invoices simultaneously
   - AI sorts and categorizes all in 2 minutes

**AI Extraction and Understanding**:

- Supplier name and organization number
- Invoice number and date
- Amount (net, VAT, gross)
- Due date
- What invoice concerns (interpreted from description)
- OCR/bank giro/plus giro for payment

**Automatic Booking and Approval**:

```
┌─────────────────────────────────────┐
│ INVOICES TO APPROVE (5 pcs)         │
├─────────────────────────────────────┤
│ □ Vattenfall - Electricity November  │
│   8,453 kr | Due: Dec 15            │
│   AI: Account 5020 (Electricity) ✓  │
│                                      │
│ □ Plumber Jansson - Leak apt 23     │
│   4,200 kr | Due: Dec 20            │
│   AI: Account 4110 (Urgent maint.) ✓│
│                                      │
│ [Approve all] [Review individually] │
└─────────────────────────────────────┘
```

### 2.3 Purchase and Procurement - "NEW" Button

**Board's "NEW" Button**:

```
┌─────────────────────────────────────┐
│         [+ NEW]                      │
│   Describe what's needed            │
└─────────────────────────────────────┘
```

Board clicks and writes freely:

- "Lawn mower is broken"
- "We need to renovate the stairwell"
- "New code lock for garbage room"
- "Roof inspection"

#### Scenario 1: Product to Purchase (e.g., lawn mower)

**Board writes**: "Lawn mower broken, need new one"

**AI Understands and Prepares**:

1. Analyzes need based on association data:
   - Lawn area: 2000 sqm (from drawings)
   - Budget: Checks maintenance budget
   - History: Previous mower bought 2018

2. Finds suitable alternatives:

```
┌─────────────────────────────────────┐
│ LAWN MOWERS - 3 ALTERNATIVES:       │
├─────────────────────────────────────┤
│ ROBOT MOWER (recommended):          │
│ Husqvarna Automower 315X            │
│ Price: 18,995 kr incl VAT           │
│ • Handles 1600 sqm                  │
│ • App controlled                    │
│ [Link: Byggmax] [Link: Bauhaus]     │
│                                      │
│ RIDING MOWER:                       │
│ Stiga Collector 548 S               │
│ Price: 7,995 kr incl VAT            │
│ • Gasoline, 48cm cutting width      │
│ [Link: Jula] [Link: Biltema]        │
└─────────────────────────────────────┘
```

3. Board orders manually through provided links
4. Case created and awaits invoice
5. When invoice arrives: AI matches automatically

#### Scenario 2: Service Needed (e.g., stairwell renovation)

**Board writes**: "We need to renovate the stairwell"

**AI Understands and Prepares**:

1. Creates procurement basis:
   - Stairwell: 4 floors, ~200 sqm wall area
   - Last painted: 2015 (from document history)
   - Budget: 150,000 kr (from maintenance plan)

2. Finds suitable contractors:

```
┌─────────────────────────────────────┐
│ PAINTING COMPANIES IN AREA:         │
├─────────────────────────────────────┤
│ 1. Stockholm Måleri AB              │
│    4.5★ from 23 BRFs                │
│    Reference: BRF Eken (150k, 2023) │
│    Contact: 08-123 45 67            │
└─────────────────────────────────────┘
```

3. Prepares quote request email template
4. Board sends requests to selected contractors
5. Registers in app: "Quote requested from 3 companies"

### 2.4 Critical Base Functions - Phase 1 (Must Have from Start)

#### A. Complete Member and Apartment Registry

**Legal Requirements per Housing Cooperative Act**:

- Complete apartment directory with all mandatory information
- Share numbers, deposit, annual fee per apartment
- Pledges with dates and pledge holders
- Transfer history
- Current member information with personal identity numbers

**Initial Setup (Day 1)**:

1. Import from existing system (Excel/CSV from HSB/SBC)
2. AI validates personal identity numbers against population registry
3. Automatic linking apartment ↔ member
4. History imported from old protocols

**Ongoing Updates**:

- Automatic update on transfer
- Pledge notes registered digitally
- Export to annual report automatically
- Always current for authority reporting

#### B. Fee Invoicing with Direct Debit and OCR

**Monthly Process (automatic)**:
The 20th of each month:

1. Generate fee invoices for all apartments
2. Send via:
   - Kivra (digital mailbox)
   - E-invoice to internet banking
   - PDF via email
   - Paper invoice (via partner)

**Payment Options**:

- Direct debit (via Bankgirot)
- E-invoice
- OCR payment
- Swish for additions

#### C. Basic Transfer Handling

**Digital Process for Buy/Sell**:

1. Member initiates sale in app
2. Automatic request for information:
   - Buyer (personal ID, contact)
   - Transfer agreement (upload)
   - Desired access date

3. Board review:
   - Financial assessment buyer
   - Check against statutes
   - Digital signature approval

4. Automatic on approval:
   - Update member registry
   - Create new fee invoice
   - Notify broker/bank
   - Archive documents

#### D. Pledge Registration

**Complete Pledge Handling**:

1. Bank sends pledge application digitally
2. Automatic check:
   - Member owns apartment
   - No obstacles per statutes
3. Digital pledge note:
   - Register in apartment directory
   - Timestamp and amount
   - Pledge holder details
4. Confirmation:
   - Digital pledge letter to bank
   - Copy to member
   - Update registry

### 2.5 Critical Base Functions - Phase 2

#### Tax and Authority Reporting

**Annual Process**:

1. **Ongoing Collection**:
   - All income categorized
   - Costs coded for tax
   - VAT separated automatically

2. **Declaration Generation (March)**:
   - Automatic INK2 form
   - All attachments created
   - Tax optimization suggestions

3. **Digital Submission**:
   - Integration Tax Agency API
   - Board signature with BankID
   - Receipt and archiving

**Control Statement Handling**:

- Board fees (KU10)
- Interest on loans (KU20)
- Dividends (KU31)
- Rent from premises (KU40)

**Fee Administration with Tax**:
Monthly/Quarterly Process:

1. Register fees per board member
2. Calculate tax deduction
3. Payment: net to member, tax to tax account
4. Reporting: Monthly AGI to Tax Agency

**Loan Registry with Monitoring**:

- Lender and loan number
- Capital, interest, fixed period
- Amortization plan
- Securities/pledges
- Automatic monitoring: 6 months before fixed period ends

## 3. Board Functionality

### 3.1 Executive Dashboard - Real-time Overview

#### Economy Panel

**Liquidity - Account Balances**:

```
┌─────────────────────────────────────┐
│ LIQUIDITY RIGHT NOW                 │
│                                      │
│ Transaction account: 145,230 kr     │
│ Savings account:     520,000 kr     │
│ Fixed rate account:  300,000 kr     │
│ ─────────────────────────────       │
│ TOTAL:               965,230 kr     │
│                                      │
│ Trend: ↑ +45,000 kr last 30 days   │
│ Forecast: 4.2 months operations     │
└─────────────────────────────────────┘
```

**Data Sources**:

- Option A: Bank API (modern banks) - Automatic nightly update
- Option B: CSV export (all banks) - Manual upload, AI interprets

**Cashflow - 30-day Forecast**:

- All uploaded invoices with due dates
- Recurring costs (electricity, heating, cleaning)
- Expected fee payments
- Planned projects from maintenance plan

**Budget Follow-up**:

- Synced from Fortnox/Visma
- Each cost accounted to category
- AI compares outcome vs budget
- Warnings for deviations

#### Property Panel

**Active Cases**:

```
┌─────────────────────────────────────┐
│ ACTIVE CASES (8 pcs)                │
├─────────────────────────────────────┤
│ 🔴 URGENT (1)                       │
│ Water leak laundry - 2 hrs          │
│ Responsible: Plumber X (contacted)  │
│                                      │
│ 🟡 HIGH PRIORITY (3)                │
│ Elevator stops floor 3 - 2 days     │
│ Broken entrance door - 4 days       │
│ Damp wall basement - 5 days         │
│                                      │
│ 🟢 NORMAL (4)                       │
│ Graffiti facade, Lamp change...     │
└─────────────────────────────────────┘
```

**AI Calculates Priority Based On**:

- Safety risk (highest priority)
- Impact on residents (many or few)
- Cost risk (water damage = urgent)
- Legal requirements (elevator, fire safety prioritized)

**Maintenance Status**:

- AI has created 50-year plan broken down
- This year: All planned measures
- This month: What to do now
- Delayed: Red marked

**Energy Consumption**:

- Monthly or hourly from electricity grid company
- Manual reading + photo
- AI reads kWh from invoices
- Comparison with same month last year
- Alarm on deviation

### 3.2 Economy Module - Smart Integration

#### PERFECT Fortnox/Visma Connection

**Initial Setup (30 min with finance manager)**:

1. **Preparation (5 min)**:
   - Login to Fortnox/Visma
   - Navigate to "Connections" or "API settings"
   - Generate API key for BRF Portal

2. **Connection (10 min)**:
   - Paste API key in BRF Portal
   - Select correct accounting year
   - Test connection (fetch account plan)
   - Approve read/write permissions

3. **Mapping (10 min)**:
   - AI suggests automatic mapping
   - Finance manager adjusts if needed
   - Save as "BRF standard"

4. **Sync Settings (5 min)**:
   - Choose sync frequency: Daily at 23:00
   - Enable: Automatic invoice matching
   - Enable: Deviation warnings

**Daily Synchronization Process**:
Every night at 23:00:

1. Fetch new data from Fortnox/Visma
2. Intelligent matching of invoices
3. Automatic categorization
4. Report to board at 07:00

#### BRF-Specific Additions

**Fee Monitoring with AI Warnings**:

- AI reads OCR files from bank daily
- Identifies fee payments per apartment
- Matches against member registry

**Intelligent Warnings**:

- Day 1-5: Green status (normal)
- Day 6-25: Yellow warning internal
- Day 26-30: Orange warning to treasurer
- Day 31+: Red warning, automatic reminder created

**Budget Simulations ("What if...")**:
Interactive budget planning:

- "What if we raise fees 2%?" → Increased income: +240,000 kr/year
- "What if interest rises 1%?" → Increased cost: +165,000 kr/year
- "What if we switch electricity supplier?" → Based on consumption: -32,000 kr/year

**Cost Barometer Against Other BRFs**:
Anonymous benchmarking:

```
Electricity: You: 125 kr/sqm | Average: 110 kr/sqm
→ "You pay 14% more than average"
→ "Check electricity contract and consumption"

Heating: You: 195 kr/sqm | Average: 205 kr/sqm
→ "Good! 5% below average"
→ "Your additional insulation 2019 shows results"
```

### 3.3 Property Management

#### 50-Year Maintenance Plan with AI

**Critical Data Sources Required**:

1. **Mandatory Initial Data Collection**:
   - Exact construction year and technical description
   - All maintenance invoices at least 10 years back
   - All inspection protocols
   - Photo documentation of property status
   - Supplier warranties and product sheets

2. **Verified Database for Comparison**:
   - 10,000+ Swedish BRFs with documented maintenance history
   - Supplier data: Technical lifespan from manufacturers
   - Insurance statistics: Damage frequency per component
   - Boverket BBR: Legal requirements and recommendations

3. **AI Analysis Based ONLY on Verified Data**:

Example roof replacement:

```
INPUT DATA:
- Current roof: Installed 1998 (invoice exists)
- Material: Concrete tiles Benders Palema (product sheet)
- Inspection 2023: "40% of tiles have cracks"
- Database: 847 similar roofs replaced after 28-35 years
- Supplier warranty: 30 years technical lifespan

AI CALCULATION:
- Age: 27 years (2025)
- Inspection status: Significant deterioration
- Statistical probability replacement within 3 years: 89%
- Recommendation: Plan replacement 2027
- Cost forecast: 850,000 kr (based on 43 similar projects 2023-2024, adjusted for inflation)
```

#### Intelligent Case Management with Contractor Ratings

**Step 1: Error Report Comes In - AI Analyzes but Board Verifies**

Member reports:

- Photographs problem in app
- Describes briefly what happened
- Indicates if urgent

AI analyzes:

- Categorizes: Plumbing/Electrical/Construction/Other
- Assesses priority: Urgent/High/Normal/Low
- Confidence level: High (95%+) / Medium (70-95%) / Low (<70%)

**Step 2: AI Prepares Action - Uses Association Preferences**

AI searches contractors:

1. First: Association's preselected contractors
2. Then: Others in area with good ratings
3. Last: New contractors without ratings

Association settings (filled once):

```
┌─────────────────────────────────────┐
│ OUR PREFERRED CONTRACTORS:          │
│                                      │
│ Plumbing: Plumber Jansson ⭐⭐⭐⭐⭐    │
│          ABC Rör (backup)            │
│ Electrical: Electric Company ⭐⭐⭐⭐   │
│ Construction: Builder Svensson ⭐⭐⭐  │
│                                      │
│ [+ Add contractor]                   │
└─────────────────────────────────────┘
```

**Step 3: Board Approves and Contacts**

Ready contact templates:

- Email (prefilled, ready to send)
- SMS template (copy and send)
- Call points (if they call)

**Step 4: Follow-up and Documentation**

AI reminds:

- After 2 hours: "Has Plumber Jansson responded?"
- After 24 hours: "Contact alternative 2?"

When contractor confirmed:

- Member gets automatic notice
- Calendar booking created
- Case updated

### 3.4 Meeting Management and Legal Support

#### Digital Assembly with BankID

- BankID login from day 1 (industry standard)
- Alternative: username/password for those without BankID
- Digital voting in app with real-time results
- AI-generated protocol with separate list of approved proposals
- Board can edit protocol before publication

#### Board Work - Detailed Implementation

**Annual Planning with All Deadlines**:
Automatic calendar showing everything board MUST do by law

Example annual wheel:

- JANUARY: Begin annual report work, inventory
- FEBRUARY: Closing complete, contact auditor
- MARCH: Audit report ready, AGM notice (2 weeks before)
- APRIL: AGM conducted, constituting board meeting
- MAY-AUGUST: Quarterly financial follow-up
- SEPTEMBER: Budget work begins
- OCTOBER: Next year's budget established
- NOVEMBER: Maintenance plan follow-up
- DECEMBER: Evaluation of board year

**Automatic Reminders of Legal Requirements**:

- 14 days before: "Reminder: AGM notice must go out by April 1"
- 7 days before: "NOTE! Notice must go out this week"
- 1 day before: "CRITICAL: Notice must go out tomorrow"

**Digital Signing of Documents**:

1. Document created/uploaded
2. Choose signing method (BankID or internal verification)
3. Send for signature
4. Automatic reminders
5. Archiving with timestamp

**Board Library - Practical Legal Help**:

Templates (200+ pieces):

- Subletting - decision
- Suspension from laundry room
- Building permit - statement from association
- Sale - consent/refusal
- Renovation - permit with conditions
- Disturbance - warning letter level 1-3
- Termination of membership

Guides (150+ pieces):
"How to handle disturbing neighbor - Step by step"

Checklists (100+ pieces):
"Water damage - Emergency checklist"

## 4. Member Functionality

### 4.1 Personal AI Assistant - Intelligent Chatbot

**What It Is**: An intelligent chatbot that automatically answers members' questions based on:

- Association's statutes (from initial document bomb)
- Rules of order (from initial document bomb)
- Swedish law (Housing Cooperative Act, Land Code, etc.)
- Board decisions and protocols (from initial document bomb + ongoing)
- All uploaded documents from "Bomb us with everything" function

**How It Works Technically**:

At startup (Day 1):

- BRF "bombs" all documents into system
- Same documents used for document management
- No separate upload required
- AI processes EVERYTHING automatically

AI creates knowledge base automatically from:

- Statutes → rules about pets, renovation, subletting
- Protocols → all board decisions
- Contracts → which suppliers, prices, terms
- Inspections → property status
- Rules of order → laundry room, disturbances, parking
- Finance → fees, funds, loans

Continuous update:

- Every new document uploaded → AI learns
- New board decisions → chatbot updated automatically
- Changed rules → members always get correct answer
- No manual update needed

**Example Conversations**:

PETS:

```
Member: "Can I have a Rottweiler?"

AI: "According to your statutes §15, pets are allowed under the following conditions:
- The animal must not disturb neighbors
- Walking must be done outside association property
- The animal must be leashed in common areas

Rottweiler is allowed. In board protocol from 2023-05-15 it was decided that all dogs must be registered with the association.

Would you like to register your dog now?"
```

RENOVATION:

```
Member: "Can I tear down the wall between kitchen and living room?"

AI: "According to your renovation policy and Housing Cooperative Act:

REQUIRES BOARD PERMISSION:
✓ Demolition of non-load-bearing wall - YES
✓ You must apply for permission before work begins

PROCESS:
1. Fill in application in app [Start application]
2. Attach drawing of change
3. Board response time: max 4 weeks
4. Load-bearing wall? Also requires building permit

NOTE! According to your statutes §22:
- Work only weekdays 08-17, Saturdays 10-16
- No disturbing renovation on Sundays
- Inform neighbors at least 1 week before

Shall I help you start the application?"
```

### 4.2 My Apartment - Digital Implementation

**Apartment Information**:

- From board: Excel export from current member registry
- From historical documents: Building permits and renovation applications
- Energy data: Modern meters via API, older meters photographed quarterly
- Ongoing update: Every approved renovation added automatically

**Automatic Broker Report - NEW FUNCTION**:
When someone is selling, automatically generated:

- Association's financial status
- Planned maintenance next 5 years
- Fee development historical and forecast
- Energy consumption for apartment
- Price: 500 kr per report
- Directly available to broker via secure link

### 4.3 Smart Booking

**Laundry Room 3.0**:

- Simple calendar view with available times
- Automatic reminder 1 hour before
- Exchange market with neighbors
- Max 3 bookings per week for fair distribution

**Common Premises with Image Display and Verification**:
Booking process:

1. Choose premises - Images of all premises shown
2. Choose time - Calendar view with available times
3. Confirmation - Rules and cleaning instructions shown
4. After use - REQUIREMENT: Upload 3 images showing:
   - Overview image of premises
   - Kitchen/pantry (if exists)
   - Toilet (if exists)

Verification system:

- Images saved for 30 days
- On complaints board can review
- Repeated problems = temporary booking block

### 4.4 Communication and Community

**News Feed (not personalized)**:

- Everyone gets same information - democratic and fair
- Push notifications for critical messages (water shut off, etc.)
- Automatic translation to 15 languages
- Simple Swedish for elderly/newly arrived

**BRF SOCIAL - Instagram-like feed for cohesion**:

```
┌─────────────────────────────────────┐
│ 📷 BRF BLOMMAN - Neighborhood Feed  │
├─────────────────────────────────────┤
│ Anna Apt 23                         │
│ [Image: Blooming apple tree]        │
│ "Our apple tree is finally blooming!│
│ Come pick apples in autumn 🍎"      │
│ ❤️ 12  💬 3                        │
│                                      │
│ Board                               │
│ [Image: Newly painted stairwell]    │
│ "Stairwell complete! Thanks for     │
│ patience during renovation"         │
│ ❤️ 34  💬 8                        │
└─────────────────────────────────────┘
```

Functions:

- Upload images from courtyard/common areas
- Share positive events and initiatives
- Comment and like (only positive feedback)
- NO POINTS for posts (keeps focus on community)

Content rules (automatic AI moderation):

- ✅ ALLOWED: Images from common spaces, neighbor initiatives, positive updates
- ❌ NOT ALLOWED: Complaints (referred to error reporting), personal attacks, politics

**Marketplace and Collaboration**:

- Buy/Sell/Trade between neighbors
- Carpooling: "Going to IKEA Saturday, room for 2"
- Sharing: "Have drill to lend"
- Help: "Need help carrying sofa upstairs"

**Event Calendar - Board Creates, Members Register**:

```
┌─────────────────────────────────────┐
│ UPCOMING EVENTS                      │
├─────────────────────────────────────┤
│ Sat 14/12: Courtyard party 15:00    │
│ Organizer: Board                     │
│ Registered: 23/50 people             │
│ [Register me] [Info]                 │
└─────────────────────────────────────┘
```

## 5. Premium Features

### 5.1 Gamification - Simplified

**Simple Point System for Problem Reporting with Board Approval**:

Process for point distribution:

1. Member reports problem/compost bag
2. Board gets weekly summary
3. Review interface shows all reports
4. Quick buttons for efficiency

Earn points by reporting:

- Water leak/moisture - 50 points (after approval)
- Safety problems - 30 points (after approval)
- General problems - 20 points (after approval)
- Composting (WEEKLY) - 10 points/week (after approval)

Use points for:

- Free night in guest apartment - 100 points
- Book party room with discount - 50 points

### 5.2 Sustainability Platform

#### CO2 Measurement - Practical Implementation

**How carbon dioxide emissions are measured**:

1. **Electricity emissions (Automatic via electricity supplier)**:
   - Fetches kWh consumption monthly
   - Multiplies with Swedish electricity mix: 40g CO2/kWh
   - If renewable electricity contract: 0g CO2/kWh

2. **District heating emissions (Semi-automatic)**:
   - Board logs in quarterly
   - Downloads consumption data (MWh)
   - AI fetches local emission factor

3. **Waste measurement (Manual with simplification)**:
   - Number of bins × emptying frequency × weight per bin
   - Standard value: 4.5 kg waste/person/week
   - CO2: 21 kg CO2 per ton residual waste

**Automation that ACTUALLY works**:
When board uploads invoices (which they do anyway):

- Electricity invoice → AI reads kWh → Calculates CO2 automatically
- District heating invoice → AI reads MWh → Calculates CO2
- Water invoice → AI reads m³ → Calculates environmental impact
- Waste invoice → AI reads bin size → Estimates CO2

Everything happens automatically - board doesn't need to think about environmental reporting

## 6. Technical Architecture

### 6.1 Backend Architecture

**Development Phase (Zero Cost)**:

- SQLite for all data storage
- Local file system for document storage
- Node.js/Python backend
- Mock authentication system
- Rule-based "AI" using regular expressions and templates

**Production Phase**:

- AWS Lambda: Pay only for usage
- PostgreSQL on Supabase: Free up to 500MB
- MongoDB for documents: Atlas free tier
- Redis for caching: Upstash serverless
- Total cost <500 kr/month for 50 associations

**AI/ML Stack**:

- Development: Open source models (Llama, BERT)
- Production: GPT-4 for natural language understanding
- Custom ML models for prediction
- Computer Vision for image analysis
- TensorFlow for time series forecasts

### 6.2 Frontend

**Web Platform**:

- Next.js for server-side rendering
- React for interactive components
- Tailwind CSS for responsive design
- WebSocket for real-time updates

**Mobile Apps**:

- React Native for iOS/Android
- Offline-first architecture
- Push notifications
- Biometric login as alternative

### 6.3 Security & Compliance

**Development Phase**:

- Basic password authentication
- Local data storage
- No personal data in development

**Production Phase**:

- End-to-end encryption
- GDPR-compliant from day 1
- BankID integration
- Role-based access control
- Audit logs for all critical operations
- 99.9% SLA guarantee
- Automatic backup every 6 hours
- Disaster recovery within 4 hours

## 7. Integrations

### 7.1 Basic Integrations

**Development Phase**:

- Mock integrations with test data
- File-based import/export
- Simulated API responses

**Production Phase**:

**Financial Systems (PERFECT INTEGRATION)**:

- Fortnox - REST API with complete sync
- Visma eEkonomi - API via Visma Connect
- SIE files - Manual import for all systems

**Banks - CSV Solution**:

- SEB/Nordea/Handelsbanken: CSV export
- AI matches transactions automatically

**BankID**:

- Integration from day 1 (when funded)
- Secure authentication for all users

### 7.2 Extended Integrations

**Property Systems**:

- Electricity meters: Via grid company portal
- District heating: CSV export monthly

**Access Systems**:

- Parakey: OAuth integration
- ASSA ABLOY: Partner agreement

**Energy Optimization**:

- Sally R: API integration
- Eliq: Data partnership

## 8. Pricing Strategy

**Important Note**: All pricing and packaging is preliminary and will be optimized based on real usage, customer value, and competitive situation.

### BRF STANDARD - Smart Member Platform

For associations keeping their financial management (HSB/SBC/own)

**Price**: 999-1999 kr/month depending on size

**Includes**:

- ✅ "Bomb us with everything" - AI document management
- ✅ AI Chatbot for members
- ✅ Intelligent case management
- ✅ Smart booking system
- ✅ 50-year maintenance plan with AI
- ✅ Energy optimization
- ✅ BRF Social - Instagram-like neighborhood feed
- ✅ Marketplace
- ✅ Event calendar
- ✅ Board work tools
- ✅ Digital AGM - 1 per year included
- ✅ Gamification
- ✅ Mobile app for all members
- ✅ Support via email and chat
- ✅ "NEW" button - from need to invoice in the app (kept there for users), but the standard version does not match Swedish law's financial requirements.

**Add-ons**:

- Extra digital meetings with voting (+199 kr/meeting)
- Green Premium - CO2/CSRD reports (+399 kr/month)
- Broker reports (499 kr/piece)

### BRF PREMIUM - Complete Management Platform

Replaces HSB Ekonomi Bas and similar systems completely

**Price**: 1999-3999 kr/month depending on size

**PREMIUM includes EVERYTHING in Standard PLUS**:

- ✅ COMPLETE FINANCIAL MANAGEMENT
- ✅ "NEW" button - From need to paid invoice
- ✅ Smart invoice handling with AI matching
- ✅ Fortnox/Visma PERFECT integration
- ✅ Payment files to bank
- ✅ Fee invoicing with direct debit and OCR
- ✅ Collection process
- ✅ Budget tool with AI forecasts
- ✅ Annual report - Automatic generation
- ✅ Digital signing - 20 signatures/month with BankID
- ✅ Contractor matching with ratings
- ✅ Delivery confirmation and warranty monitoring
- ✅ 10 years invoice archive
- ✅ Advanced economics with simulations
- ✅ Unlimited digital meetings
- ✅ Green Premium included
- ✅ 4 broker reports/year included
- ✅ Priority phone support
- ✅ Dedicated success manager

**Pricing Tiers**:

STANDARD (Member Platform):

- 10-30 apartments: 999 kr/month
- 31-60 apartments: 1299 kr/month
- 61-100 apartments: 1599 kr/month
- 100-200 apartments: 1999 kr/month
- 200+ apartments: Quote

PREMIUM (Complete Management):

- 10-30 apartments: 1999 kr/month
- 31-60 apartments: 2499 kr/month
- 61-100 apartments: 2999 kr/month
- 100-200 apartments: 3999 kr/month
- 200+ apartments: Quote

## 9. Implementation Timeline

### Phase 0: Zero-Cost Development (Months 1-6)

- Core document management system
- Basic member portal
- Mock authentication system
- Rule-based "AI" assistant
- Simple booking system
- Basic case management
- SQLite database setup

### Phase 1: MVP with Basic Paid Services (Months 7-9)

- BankID integration
- Basic GPT integration for document understanding
- Fortnox/Visma API connection
- Payment processing
- Basic mobile apps

### Phase 2: Full Launch (Months 10-12)

- Complete AI integration
- All premium features
- Scrive e-signing
- Partner integrations
- Marketing campaign launch

### Phase 3: Scale and Optimize (Year 2+)

- White-label partnerships
- Advanced AI features
- International expansion preparation
- Enterprise features

## 10. Success Metrics

### Key Performance Indicators (KPIs)

- User activation rate: >80% of members using app monthly
- Case resolution time: <24 hours average
- Document processing accuracy: >95%
- Customer satisfaction: >4.5/5
- Churn rate: <5% annually
- ROI for customers: >10x license cost

### Growth Targets

- Year 1: 50 BRFs (1,500 apartments)
- Year 2: 250 BRFs (7,500 apartments)
- Year 3: 1,000 BRFs (30,000 apartments)
- Year 5: 5,000 BRFs (150,000 apartments)

## Appendix: Competitive Analysis

| Feature                | Our Solution            | SBC        | HSB        | Boappa     | Nabo    |
| ---------------------- | ----------------------- | ---------- | ---------- | ---------- | ------- |
| Price/month (50 apts)  | 1299-2499               | 3000-5000  | 4000-6000  | 650        | 3500    |
| Free tier              | ✅ <10 apts             | ❌         | ❌         | ⚠️ 60 days | ❌      |
| BankID                 | ✅ From day 1           | ✅         | ✅         | ❌         | ✅      |
| AI automation          | ✅ Complete             | ❌         | ⚠️ Some    | ❌         | ⚠️      |
| Financial management   | ✅ Perfect integration  | ✅         | ✅         | ❌         | ✅      |
| Predictive maintenance | ✅                      | ❌         | ❌         | ❌         | ❌      |
| AI chatbot             | ✅ Trained on your docs | ❌         | ❌         | ❌         | ❌      |
| Broker report          | ✅ 500 kr               | ❌         | ❌         | ❌         | ❌      |
| Implementation         | 7 days                  | 2-3 months | 2-3 months | 1 week     | 1 month |

**Our Unique Position**: "Klarna for BRFs" - we're not best at everything, but we're the only one combining AI, low cost, BankID from day 1, and fast implementation in a way that actually works for smaller BRFs.
