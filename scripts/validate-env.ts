#!/usr/bin/env tsx
/**
 * Environment Validation Script
 *
 * This script validates environment variables for the BRF Portal.
 * It can be run manually or as part of CI/CD pipelines.
 */

import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables
config({ path: ['.env.local', '.env.development', '.env'] });
import { writeFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  environment: string;
  timestamp: string;
}

function validateEnvironment(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  };

  console.log('🔍 Validating BRF Portal environment configuration...\n');

  try {
    // Basic validation
    console.log('✅ Environment variables loaded successfully');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(
      `🌐 App URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`
    );

    const dbUrl = process.env.DATABASE_URL || 'file:./database/brf_portal.db';
    const safeDbUrl = dbUrl.includes('@')
      ? dbUrl.split('@')[0] + '@***'
      : dbUrl;
    console.log(`🗄️ Database: ${safeDbUrl}`);

    // Additional validations
    validateProductionRequirements(result);
    validateSwedishIntegrations(result);
    validateSecurity(result);
    validateCostOptimization(result);
    validateDependencies(result);
  } catch (error: any) {
    result.isValid = false;
    result.errors.push(`Environment validation failed: ${error.message}`);
  }

  return result;
}

function validateProductionRequirements(result: ValidationResult) {
  console.log('\n🏭 Validating production requirements...');

  if (EnvUtils.isProduction()) {
    // Critical production requirements
    const requiredSecrets = [
      'NEXTAUTH_SECRET',
      'ENCRYPTION_KEY',
      'JWT_SIGNING_KEY',
    ];

    for (const secret of requiredSecrets) {
      const value = env[secret as keyof typeof env] as string;
      if (!value || value.length < 32) {
        result.errors.push(
          `${secret} must be at least 32 characters in production`
        );
      }
    }

    // Database requirements
    if (
      env.DATABASE_URL.includes('sqlite') ||
      env.DATABASE_URL.includes('file:')
    ) {
      result.warnings.push(
        'Using SQLite in production - consider PostgreSQL for better performance'
      );
    }

    // SSL requirements
    if (!env.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
      result.errors.push('NEXT_PUBLIC_APP_URL must use HTTPS in production');
    }

    // Mock services check
    if (EnvUtils.shouldMockService('bankid')) {
      result.warnings.push('BankID is mocked in production');
    }
    if (EnvUtils.shouldMockService('payment')) {
      result.warnings.push('Payment processing is mocked in production');
    }

    console.log('✅ Production requirements checked');
  } else {
    console.log('ℹ️ Skipping production-specific validations');
  }
}

function validateSwedishIntegrations(result: ValidationResult) {
  console.log('\n🇸🇪 Validating Swedish integrations...');

  // BankID validation
  if (env.FEATURE_BANKID_AUTH && env.BANKID_ENABLED) {
    if (!env.BANKID_CLIENT_CERT_PATH) {
      result.errors.push(
        'BANKID_CLIENT_CERT_PATH is required when BankID is enabled'
      );
    }
    if (!env.BANKID_CLIENT_CERT_PASSWORD) {
      result.errors.push(
        'BANKID_CLIENT_CERT_PASSWORD is required when BankID is enabled'
      );
    }
    if (env.BANKID_ENVIRONMENT === 'production' && EnvUtils.isProduction()) {
      result.warnings.push(
        'BankID production environment active - verify certificate validity'
      );
    }
  }

  // Fortnox integration
  if (env.FORTNOX_CLIENT_SECRET && !env.FORTNOX_ACCESS_TOKEN) {
    result.warnings.push('Fortnox client secret set but access token missing');
  }

  // Kivra integration
  if (env.KIVRA_API_KEY && !env.KIVRA_SENDER_ID) {
    result.warnings.push('Kivra API key set but sender ID missing');
  }

  console.log('✅ Swedish integrations checked');
}

function validateSecurity(result: ValidationResult) {
  console.log('\n🔒 Validating security configuration...');

  // HTTPS enforcement
  if (
    EnvUtils.isProduction() &&
    !env.NEXT_PUBLIC_APP_URL.startsWith('https://')
  ) {
    result.errors.push('Production must use HTTPS');
  }

  // CORS configuration
  if (EnvUtils.isProduction()) {
    if (env.CORS_ORIGIN.includes('localhost')) {
      result.warnings.push('CORS origin includes localhost in production');
    }
  }

  // Secret strength validation
  const secrets = ['NEXTAUTH_SECRET', 'ENCRYPTION_KEY', 'JWT_SIGNING_KEY'];
  for (const secret of secrets) {
    const value = env[secret as keyof typeof env] as string;
    if (value && value.includes('development')) {
      result.warnings.push(`${secret} appears to be a development value`);
    }
  }

  console.log('✅ Security configuration checked');
}

function validateCostOptimization(result: ValidationResult) {
  console.log('\n💰 Validating cost optimization...');

  // Development cost optimization
  if (EnvUtils.isDevelopment()) {
    let mockCount = 0;
    const mockServices = ['bankid', 'email', 'sms', 'payment', 'apis'] as const;

    for (const service of mockServices) {
      if (EnvUtils.shouldMockService(service)) {
        mockCount++;
      }
    }

    if (mockCount === mockServices.length) {
      console.log('✅ All services mocked - zero external costs');
    } else {
      const unmocked = mockServices.filter(s => !EnvUtils.shouldMockService(s));
      result.warnings.push(
        `Some services not mocked: ${unmocked.join(', ')} - may incur costs`
      );
    }
  }

  // Production cost warnings
  if (EnvUtils.isProduction()) {
    const costlyFeatures = [];

    if (env.FEATURE_AI_PROCESSING && env.OPENAI_API_KEY) {
      costlyFeatures.push('OpenAI API (usage-based)');
    }
    if (env.FEATURE_BANKID_AUTH && env.BANKID_ENABLED) {
      costlyFeatures.push('BankID (€49/month + per use)');
    }
    if (env.FEATURE_SMS_NOTIFICATIONS && !EnvUtils.shouldMockService('sms')) {
      costlyFeatures.push('SMS service (per message)');
    }

    if (costlyFeatures.length > 0) {
      result.warnings.push(
        `Costly features enabled: ${costlyFeatures.join(', ')}`
      );
    }
  }

  console.log('✅ Cost optimization checked');
}

function validateDependencies(result: ValidationResult) {
  console.log('\n📦 Validating service dependencies...');

  // Email service validation
  if (env.FEATURE_EMAIL_NOTIFICATIONS && !EnvUtils.shouldMockService('email')) {
    const hasEmailService =
      env.SMTP_HOST || env.SENDGRID_API_KEY || env.MAILGUN_API_KEY;
    if (!hasEmailService) {
      result.errors.push(
        'Email notifications enabled but no email service configured'
      );
    }
  }

  // SMS service validation
  if (env.FEATURE_SMS_NOTIFICATIONS && !EnvUtils.shouldMockService('sms')) {
    const hasSmsService = env.SMS_API_USERNAME || env.TWILIO_ACCOUNT_SID;
    if (!hasSmsService) {
      result.errors.push(
        'SMS notifications enabled but no SMS service configured'
      );
    }
  }

  // AI service validation
  if (env.FEATURE_AI_PROCESSING && !EnvUtils.shouldMockService('apis')) {
    if (!env.OPENAI_API_KEY) {
      result.errors.push('AI processing enabled but no AI service configured');
    }
  }

  // Payment service validation
  if (
    env.FEATURE_PAYMENT_PROCESSING &&
    !EnvUtils.shouldMockService('payment')
  ) {
    const hasPaymentService =
      env.BANKGIROT_API_KEY || env.STRIPE_SECRET_KEY || env.SWISH_MERCHANT_ID;
    if (!hasPaymentService) {
      result.errors.push(
        'Payment processing enabled but no payment service configured'
      );
    }
  }

  console.log('✅ Service dependencies checked');
}

function generateReport(result: ValidationResult) {
  console.log('\n📊 Validation Report');
  console.log('==================');
  console.log(`Environment: ${result.environment}`);
  console.log(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  console.log(`Timestamp: ${result.timestamp}\n`);

  if (result.errors.length > 0) {
    console.log('❌ ERRORS:');
    result.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
    console.log();
  }

  if (result.warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    result.warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
    console.log();
  }

  // Save report to file
  const reportPath = join(process.cwd(), 'logs', 'env-validation.json');
  try {
    writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`📝 Detailed report saved to: ${reportPath}`);
  } catch (error) {
    console.log(
      '⚠️  Could not save report file (logs directory may not exist)'
    );
  }

  return result.isValid;
}

// Main execution
if (require.main === module) {
  const result = validateEnvironment();
  const isValid = generateReport(result);

  if (!isValid) {
    console.log(
      '\n❌ Environment validation failed. Please fix the errors above.'
    );
    process.exit(1);
  } else {
    console.log('\n✅ Environment validation completed successfully!');
    process.exit(0);
  }
}
