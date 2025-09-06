import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Time Travel Scenarios API
 * 
 * Pre-configured scenarios for testing Swedish BRF time-sensitive features
 */

const scenarioSchema = z.object({
  scenario: z.enum([
    'month_end_payment_due',
    'fiscal_year_end',
    'overdue_payments',
    'board_meeting_season',
    'energy_reporting_period',
    'annual_report_deadline',
    'summer_maintenance_season',
    'winter_heating_season',
    'new_fiscal_year_start',
    'payment_reminder_cycle',
    'contract_renewal_period',
    'heating_season_start',
    'heating_season_end'
  ]),
  cooperative_id: z.string().optional(),
});

interface TimeScenario {
  name: string;
  description: string;
  targetDate: string;
  context: {
    fiscalYear: string;
    season: string;
    paymentContext: string;
    regulatoryContext: string;
    businessContext: string;
  };
  suggestedTests: string[];
}

/**
 * GET /api/time-travel/scenarios
 * Returns available time travel scenarios for Swedish BRF testing
 */
export async function GET() {
  try {
    const scenarios = {
      month_end_payment_due: {
        name: "Month-End Payment Due",
        description: "Test monthly fee payment deadlines and overdue calculations",
        context: {
          season: "Any",
          paymentContext: "Monthly fees due at month end",
          regulatoryContext: "Standard payment terms apply",
          businessContext: "Peak payment processing period",
        },
        suggestedTests: [
          "Monthly fee generation and calculation",
          "Payment deadline enforcement",
          "Overdue payment detection",
          "Automatic payment reminder generation",
          "Late fee calculations",
          "Payment status updates",
        ]
      },
      fiscal_year_end: {
        name: "Fiscal Year End (June 30)",
        description: "Test end-of-fiscal-year processes for Swedish BRFs",
        context: {
          season: "Summer",
          paymentContext: "Final quarter payments and settlements",
          regulatoryContext: "Annual reporting preparation required",
          businessContext: "Financial year closure and audit preparation",
        },
        suggestedTests: [
          "Annual financial report generation",
          "Year-end payment reconciliation",
          "Audit trail preparation",
          "Annual meeting scheduling",
          "Budget preparation for next fiscal year",
          "Tax reporting data compilation",
        ]
      },
      overdue_payments: {
        name: "Overdue Payments Crisis",
        description: "Test handling of multiple overdue payments and collection processes",
        context: {
          season: "Any",
          paymentContext: "Multiple overdue payments requiring action",
          regulatoryContext: "Debt collection regulations apply",
          businessContext: "Cash flow impact and collection procedures",
        },
        suggestedTests: [
          "Overdue payment identification and categorization",
          "Automated reminder escalation",
          "Debt collection fee calculations",
          "Payment plan creation and management",
          "Legal action preparation workflows",
          "Impact on apartment ownership status",
        ]
      },
      board_meeting_season: {
        name: "Board Meeting Season (September-November)",
        description: "Test annual meeting and board election processes",
        context: {
          season: "Autumn",
          paymentContext: "Regular monthly fees",
          regulatoryContext: "Annual meeting requirements per BrfL",
          businessContext: "Governance and decision-making peak period",
        },
        suggestedTests: [
          "Annual meeting scheduling and notifications",
          "Board member election processes",
          "Meeting protocol generation and approval",
          "Member notification requirements (7+ days notice)",
          "Voting and quorum management",
          "Post-meeting document distribution",
        ]
      },
      energy_reporting_period: {
        name: "Energy Reporting Period",
        description: "Test energy consumption tracking and environmental reporting",
        context: {
          season: "Any",
          paymentContext: "Energy cost allocations",
          regulatoryContext: "Environmental reporting requirements",
          businessContext: "Energy efficiency monitoring and cost management",
        },
        suggestedTests: [
          "Monthly energy consumption data collection",
          "Energy cost allocation across apartments",
          "Environmental reporting data compilation",
          "Energy certificate renewal tracking",
          "District heating cost calculations",
          "Energy efficiency trend analysis",
        ]
      },
      annual_report_deadline: {
        name: "Annual Report Deadline (December 31)",
        description: "Test annual report filing and regulatory compliance",
        context: {
          season: "Winter",
          paymentContext: "Year-end financial settlements",
          regulatoryContext: "Mandatory annual report filing deadline",
          businessContext: "Regulatory compliance and governance documentation",
        },
        suggestedTests: [
          "Annual report data compilation",
          "Financial statement preparation",
          "Board activity documentation",
          "Member register updates",
          "Regulatory filing workflows",
          "Compliance deadline tracking",
        ]
      },
      summer_maintenance_season: {
        name: "Summer Maintenance Season",
        description: "Test maintenance planning and contractor management during peak season",
        context: {
          season: "Summer",
          paymentContext: "Maintenance and renovation expenses",
          regulatoryContext: "Building safety and maintenance standards",
          businessContext: "Peak maintenance and improvement period",
        },
        suggestedTests: [
          "Maintenance project planning and scheduling",
          "Contractor bidding and selection processes",
          "Work permit and approval workflows",
          "Maintenance cost allocation and budgeting",
          "Quality control and completion tracking",
          "Resident notification and access coordination",
        ]
      },
      winter_heating_season: {
        name: "Winter Heating Season",
        description: "Test heating system management and energy cost tracking",
        context: {
          season: "Winter",
          paymentContext: "Peak heating costs and allocations",
          regulatoryContext: "Heating safety and efficiency requirements",
          businessContext: "Energy cost management and resident comfort",
        },
        suggestedTests: [
          "Heating cost calculation and allocation",
          "Energy consumption monitoring and alerts",
          "Heating system maintenance scheduling",
          "Temperature and comfort complaint handling",
          "Energy efficiency optimization",
          "Winter emergency procedures",
        ]
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        scenarios: Object.keys(scenarios),
        details: scenarios,
        brfContext: {
          fiscalYear: "Swedish BRFs typically have fiscal year ending June 30",
          paymentSchedule: "Monthly fees usually due at month end",
          regulatoryFramework: "Governed by Bostadsrättslagen (BrfL)",
          annualCycle: "Annual meetings typically held September-November",
        }
      }
    });
  } catch (error) {
    console.error('Scenarios GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get scenarios' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/time-travel/scenarios
 * Activates a specific time travel scenario
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = scenarioSchema.parse(body);
    
    const targetDate = generateScenarioDate(validatedData.scenario);
    const scenario = getScenarioDetails(validatedData.scenario, targetDate);

    // Call the time travel API to set the time
    const timeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/time-travel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'set',
        date: targetDate,
        timezone: 'Europe/Stockholm',
      }),
    });

    if (!timeResponse.ok) {
      throw new Error('Failed to set scenario time');
    }

    const timeData = await timeResponse.json();

    return NextResponse.json({
      success: true,
      data: {
        scenario: validatedData.scenario,
        ...scenario,
        targetDate,
        timeTravel: timeData.data,
        instructions: [
          "Time has been set to the scenario date",
          "Run your tests for the suggested features",
          "Use the time travel API to advance time as needed",
          "Reset time travel when testing is complete",
        ]
      }
    });
  } catch (error) {
    console.error('Scenarios POST error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid scenario request', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to activate scenario' },
      { status: 500 }
    );
  }
}

function generateScenarioDate(scenario: string): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  switch (scenario) {
    case 'month_end_payment_due':
      // Last day of current month at 23:59
      return new Date(currentYear, now.getMonth() + 1, 0, 23, 59).toISOString();
      
    case 'fiscal_year_end':
      // June 30th at 17:00
      return new Date(currentYear, 5, 30, 17, 0).toISOString();
      
    case 'overdue_payments':
      // 15 days after month end
      const overdue = new Date(currentYear, now.getMonth() + 1, 0);
      overdue.setDate(overdue.getDate() + 15);
      return overdue.toISOString();
      
    case 'board_meeting_season':
      // October 15th at 19:00 (typical board meeting time)
      return new Date(currentYear, 9, 15, 19, 0).toISOString();
      
    case 'energy_reporting_period':
      // First day of month at 09:00
      return new Date(currentYear, now.getMonth(), 1, 9, 0).toISOString();
      
    case 'annual_report_deadline':
      // December 20th (approaching deadline)
      return new Date(currentYear, 11, 20, 10, 0).toISOString();
      
    case 'summer_maintenance_season':
      // July 1st at 08:00
      return new Date(currentYear, 6, 1, 8, 0).toISOString();
      
    case 'winter_heating_season':
      // January 15th at 10:00
      return new Date(currentYear, 0, 15, 10, 0).toISOString();
      
    case 'new_fiscal_year_start':
      // July 1st at 00:00
      return new Date(currentYear, 6, 1, 0, 0).toISOString();
      
    case 'payment_reminder_cycle':
      // 7 days after month end
      const reminder = new Date(currentYear, now.getMonth() + 1, 0);
      reminder.setDate(reminder.getDate() + 7);
      return reminder.toISOString();
      
    case 'contract_renewal_period':
      // December 1st at 09:00
      return new Date(currentYear, 11, 1, 9, 0).toISOString();
      
    case 'heating_season_start':
      // October 1st at 06:00
      return new Date(currentYear, 9, 1, 6, 0).toISOString();
      
    case 'heating_season_end':
      // April 30th at 18:00
      return new Date(currentYear, 3, 30, 18, 0).toISOString();
      
    default:
      return now.toISOString();
  }
}

function getScenarioDetails(scenario: string, targetDate: string): TimeScenario {
  const date = new Date(targetDate);
  const month = date.toLocaleDateString('sv-SE', { month: 'long' });
  const fiscalYear = date.getMonth() >= 6 ? 
    `${date.getFullYear()}/${date.getFullYear() + 1}` : 
    `${date.getFullYear() - 1}/${date.getFullYear()}`;

  const scenarios: Record<string, Omit<TimeScenario, 'targetDate'>> = {
    month_end_payment_due: {
      name: "Month-End Payment Due",
      description: `Testing payment deadlines for ${month} ${date.getFullYear()}`,
      context: {
        fiscalYear,
        season: getSeason(date),
        paymentContext: `Monthly fees for ${month} are due`,
        regulatoryContext: "Standard payment terms and late fee calculations",
        businessContext: "Peak payment processing and deadline enforcement",
      },
      suggestedTests: [
        "Generate monthly fees for all apartments",
        "Test payment deadline calculations",
        "Verify overdue payment detection",
        "Check automatic reminder generation",
        "Test late fee calculations and application",
        "Validate payment status updates and tracking",
      ]
    },
    fiscal_year_end: {
      name: "Fiscal Year End",
      description: `Testing year-end processes for fiscal year ${fiscalYear}`,
      context: {
        fiscalYear,
        season: "Summer",
        paymentContext: "Final quarter settlements and year-end reconciliation",
        regulatoryContext: "Annual reporting and audit preparation requirements",
        businessContext: "Financial closure and next year budget preparation",
      },
      suggestedTests: [
        "Generate annual financial reports",
        "Test year-end payment reconciliation",
        "Prepare audit trails and documentation",
        "Schedule annual member meetings",
        "Compile budget data for next fiscal year",
        "Generate tax reporting documentation",
      ]
    },
    overdue_payments: {
      name: "Overdue Payments Management",
      description: "Testing debt collection and overdue payment processes",
      context: {
        fiscalYear,
        season: getSeason(date),
        paymentContext: "Multiple overdue payments requiring immediate action",
        regulatoryContext: "Swedish debt collection regulations and procedures",
        businessContext: "Cash flow impact and member communication",
      },
      suggestedTests: [
        "Identify and categorize overdue payments",
        "Generate escalating reminder sequences",
        "Calculate debt collection fees and interest",
        "Create payment plan proposals",
        "Prepare legal action documentation",
        "Test member notification workflows",
      ]
    },
    board_meeting_season: {
      name: "Annual Board Meeting Season",
      description: `Testing governance processes for ${month} ${date.getFullYear()}`,
      context: {
        fiscalYear,
        season: "Autumn",
        paymentContext: "Regular monthly fee collection",
        regulatoryContext: "Annual meeting requirements per Bostadsrättslagen",
        businessContext: "Democratic governance and board elections",
      },
      suggestedTests: [
        "Schedule annual member meetings",
        "Generate meeting notices and agendas",
        "Test board member election processes",
        "Validate quorum and voting procedures",
        "Generate meeting protocols automatically",
        "Distribute post-meeting documentation",
      ]
    },
    energy_reporting_period: {
      name: "Energy Reporting Period",
      description: `Testing energy tracking for ${month} ${date.getFullYear()}`,
      context: {
        fiscalYear,
        season: getSeason(date),
        paymentContext: "Energy cost allocation and billing",
        regulatoryContext: "Environmental reporting and energy efficiency requirements",
        businessContext: "Cost management and sustainability tracking",
      },
      suggestedTests: [
        "Collect monthly energy consumption data",
        "Calculate energy cost allocations",
        "Generate environmental impact reports",
        "Track energy certificate compliance",
        "Process district heating cost distributions",
        "Analyze energy efficiency trends",
      ]
    },
    annual_report_deadline: {
      name: "Annual Report Filing Deadline",
      description: `Approaching deadline for ${date.getFullYear()} annual report`,
      context: {
        fiscalYear,
        season: "Winter",
        paymentContext: "Year-end financial statement finalization",
        regulatoryContext: "Mandatory December 31st filing deadline",
        businessContext: "Regulatory compliance and transparency",
      },
      suggestedTests: [
        "Compile annual report data and financials",
        "Generate required regulatory documentation",
        "Validate board activity summaries",
        "Update member registers and ownership records",
        "Test filing workflow and deadline tracking",
        "Generate compliance certificates",
      ]
    },
  };

  const defaultScenario: Omit<TimeScenario, 'targetDate'> = {
    name: "Generic Test Scenario",
    description: `Testing Swedish BRF features for ${month} ${date.getFullYear()}`,
    context: {
      fiscalYear,
      season: getSeason(date),
      paymentContext: "Standard monthly operations",
      regulatoryContext: "General BRF compliance requirements",
      businessContext: "Normal cooperative operations",
    },
    suggestedTests: [
      "Test time-dependent feature calculations",
      "Validate date-based business logic",
      "Check regulatory compliance timing",
      "Test automated scheduling processes",
    ]
  };

  return {
    ...(scenarios[scenario] || defaultScenario),
    targetDate,
  };
}

function getSeason(date: Date): string {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Autumn";
  return "Winter";
}