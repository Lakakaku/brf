#!/usr/bin/env tsx
/**
 * Environment Setup Script
 *
 * Interactive script to help set up environment variables for BRF Portal.
 * Guides users through the configuration process with safe defaults.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { randomBytes } from 'crypto';

interface SetupOptions {
  environment: 'development' | 'staging' | 'production';
  interactive: boolean;
  force: boolean;
}

class EnvironmentSetup {
  private rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  constructor(private options: SetupOptions) {}

  async run(): Promise<void> {
    console.log('🚀 BRF Portal Environment Setup');
    console.log('================================\n');

    try {
      await this.setupEnvironment();
      console.log('\n✅ Environment setup completed successfully!');
    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  private async setupEnvironment(): Promise<void> {
    const { environment } = this.options;

    console.log(`Setting up ${environment} environment...\n`);

    switch (environment) {
      case 'development':
        await this.setupDevelopment();
        break;
      case 'staging':
        await this.setupStaging();
        break;
      case 'production':
        await this.setupProduction();
        break;
    }
  }

  private async setupDevelopment(): Promise<void> {
    console.log('🔧 Development Setup (Zero Cost)');
    console.log(
      'This setup enables full local development without external costs.\n'
    );

    const envPath = '.env.local';

    if (existsSync(envPath) && !this.options.force) {
      const overwrite = await this.ask(
        `${envPath} already exists. Overwrite? (y/N): `
      );
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        return;
      }
    }

    // Generate development secrets
    const secrets = {
      NEXTAUTH_SECRET: this.generateSecret(32),
      ENCRYPTION_KEY: this.generateSecret(32),
      JWT_SIGNING_KEY: this.generateSecret(32),
      CSRF_SECRET: this.generateSecret(16),
    };

    // Create development configuration
    const config = this.createDevelopmentConfig(secrets);

    writeFileSync(envPath, config);
    console.log(`✅ Created ${envPath}`);

    // Setup database directory
    this.ensureDirectory('database');
    this.ensureDirectory('logs');
    this.ensureDirectory('storage/uploads');

    console.log('\n📋 Development Environment Ready!');
    console.log('Next steps:');
    console.log('1. Run: npm run db:init');
    console.log('2. Run: npm run dev');
    console.log('3. Visit: http://localhost:3000');

    if (this.options.interactive) {
      await this.offerOptionalIntegrations();
    }
  }

  private async setupStaging(): Promise<void> {
    console.log('🧪 Staging Setup');
    console.log(
      'This setup configures a production-like environment for testing.\n'
    );

    const envPath = '.env.staging';

    if (!this.options.force) {
      const proceed = await this.ask('Continue with staging setup? (y/N): ');
      if (proceed.toLowerCase() !== 'y') return;
    }

    const config = await this.createStagingConfig();
    writeFileSync(envPath, config);

    console.log(`✅ Created ${envPath}`);
    console.log("\n⚠️  Don't forget to:");
    console.log('1. Set up staging database');
    console.log('2. Configure staging domain');
    console.log('3. Upload to staging environment');
  }

  private async setupProduction(): Promise<void> {
    console.log('🏭 Production Setup');
    console.log('⚠️  This will create production configuration templates.\n');

    const envPath = '.env.production';

    if (existsSync(envPath) && !this.options.force) {
      console.log('❌ .env.production already exists!');
      console.log(
        'For security, this script will not overwrite production configs.'
      );
      console.log('Delete the file manually if you want to recreate it.');
      return;
    }

    const proceed = await this.ask(
      'This will create production templates. Continue? (y/N): '
    );
    if (proceed.toLowerCase() !== 'y') return;

    await this.createProductionTemplate();
    console.log('\n🔐 IMPORTANT SECURITY REMINDERS:');
    console.log('1. Replace all FROM_SECRETS_MANAGER placeholders');
    console.log('2. Use a secrets management system');
    console.log('3. Never commit .env.production to version control');
    console.log('4. Verify all Swedish integrations are configured');
  }

  private createDevelopmentConfig(secrets: Record<string, string>): string {
    return `# =============================================================================
# BRF Portal - Development Environment (Auto-generated)
# =============================================================================
# Generated on: ${new Date().toISOString()}
# This file contains safe development defaults with zero external costs.
# =============================================================================

# Environment
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEBUG=true

# Database (SQLite - no setup required)
DATABASE_URL=file:./database/brf_portal_dev.db
TEST_DATABASE_URL=file:./database/test.db
DATABASE_LOG_QUERIES=true

# Authentication (Generated secrets - safe for development)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${secrets.NEXTAUTH_SECRET}
ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}
JWT_SIGNING_KEY=${secrets.JWT_SIGNING_KEY}
CSRF_SECRET=${secrets.CSRF_SECRET}

# Mock Services (Zero cost - all external services mocked)
MOCK_BANKID=true
MOCK_EMAIL=true
MOCK_SMS=true
MOCK_PAYMENT=true
MOCK_EXTERNAL_APIS=true

# Feature Flags (Safe defaults for development)
FEATURE_BANKID_AUTH=false
FEATURE_AI_PROCESSING=false
FEATURE_PAYMENT_PROCESSING=false
FEATURE_EMAIL_NOTIFICATIONS=true
FEATURE_SMS_NOTIFICATIONS=false

# Local Storage
LOCAL_STORAGE_PATH=./storage/uploads
MAX_FILE_SIZE=10MB

# Development Tools
STORYBOOK_ENABLED=true
API_DOCS_ENABLED=true
DEBUG_TOOLBAR_ENABLED=true
SEED_TEST_USERS=true

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty
LOG_FILE_ENABLED=true
LOG_FILE_PATH=./logs/development.log

# Security (Development-friendly)
PASSWORD_MIN_LENGTH=6
PASSWORD_REQUIRE_UPPERCASE=false
PASSWORD_REQUIRE_LOWERCASE=false
PASSWORD_REQUIRE_NUMBERS=false
PASSWORD_REQUIRE_SYMBOLS=false

# =============================================================================
# Optional API Keys for Testing Specific Features
# =============================================================================
# Uncomment and add real API keys only if you want to test specific integrations:
#
# OPENAI_API_KEY=sk-your-openai-key-for-ai-testing
# SENDGRID_API_KEY=your-sendgrid-key-for-email-testing
# SMS_API_USERNAME=your-46elks-username-for-sms-testing
#
# =============================================================================
`;
  }

  private async createStagingConfig(): Promise<string> {
    const stagingUrl =
      (await this.ask('Staging URL (https://staging.brfportal.se): ')) ||
      'https://staging.brfportal.se';
    const dbUrl =
      (await this.ask('Staging database URL: ')) ||
      'postgresql://staging:password@staging-db:5432/brf_staging';

    return `# Staging Environment Configuration
NODE_ENV=staging
NEXT_PUBLIC_APP_URL=${stagingUrl}
DATABASE_URL=${dbUrl}
# ... rest of staging configuration
`;
  }

  private async createProductionTemplate(): Promise<void> {
    const templateContent = readFileSync('.env.production.example', 'utf-8');
    writeFileSync('.env.production.template', templateContent);

    console.log('✅ Created .env.production.template');
    console.log('📝 Copy this file to .env.production and fill in real values');
  }

  private async offerOptionalIntegrations(): Promise<void> {
    console.log('\n🔌 Optional Integrations');
    console.log('You can add real API keys to test specific features:\n');

    const integrations = [
      {
        name: 'OpenAI (AI document processing)',
        env: 'OPENAI_API_KEY',
        description: 'Test real AI features (costs apply)',
      },
      {
        name: 'SendGrid (Email sending)',
        env: 'SENDGRID_API_KEY',
        description: 'Test real email delivery',
      },
      {
        name: '46elks (SMS sending)',
        env: 'SMS_API_USERNAME',
        description: 'Test real SMS delivery (Swedish service)',
      },
    ];

    for (const integration of integrations) {
      const add = await this.ask(`Add ${integration.name}? (y/N): `);
      if (add.toLowerCase() === 'y') {
        const apiKey = await this.ask(`Enter ${integration.env}: `);
        if (apiKey) {
          this.appendToEnv(integration.env, apiKey);
          console.log(`✅ Added ${integration.name}`);
        }
      }
    }
  }

  private appendToEnv(key: string, value: string): void {
    const envPath = '.env.local';
    const content = `\n# Added by setup script\n${key}=${value}\n`;
    writeFileSync(envPath, content, { flag: 'a' });
  }

  private generateSecret(length: number): string {
    return randomBytes(length).toString('base64').slice(0, length);
  }

  private ensureDirectory(path: string): void {
    const fullPath = join(process.cwd(), path);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created directory: ${path}`);
    }
  }

  private ask(question: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }
}

// CLI Interface
function parseArgs(): SetupOptions {
  const args = process.argv.slice(2);

  const options: SetupOptions = {
    environment: 'development',
    interactive: true,
    force: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--env':
      case '-e':
        const env = args[++i] as SetupOptions['environment'];
        if (['development', 'staging', 'production'].includes(env)) {
          options.environment = env;
        }
        break;
      case '--non-interactive':
      case '-n':
        options.interactive = false;
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
🚀 BRF Portal Environment Setup

Usage: tsx scripts/setup-env.ts [options]

Options:
  -e, --env <env>        Environment: development, staging, production (default: development)
  -n, --non-interactive  Run without prompts (use defaults)
  -f, --force            Overwrite existing files
  -h, --help            Show this help

Examples:
  tsx scripts/setup-env.ts                    # Interactive development setup
  tsx scripts/setup-env.ts -e staging         # Staging setup
  tsx scripts/setup-env.ts -e development -f  # Force overwrite development config

Environments:
  development  - Zero-cost local development with mocked services
  staging      - Production-like testing environment  
  production   - Production configuration templates
  `);
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const setup = new EnvironmentSetup(options);
  setup.run().catch(console.error);
}
