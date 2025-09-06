/**
 * Comprehensive test and demonstration of the BRF file validation system
 * Shows how to use the enhanced validation with Swedish BRF document categorization
 */

import { 
  BRFFileValidator,
  createBRFValidator,
  validateBatchFiles,
  ValidationRuleBuilder,
  BRFValidators,
  createDevelopmentScanner,
  type BRFValidationRules,
  type BRFDocumentCategory
} from '@/lib/upload';

// Test file data
const testFiles = [
  {
    filename: 'styrelse-protokoll-2024-03.pdf',
    size: 2 * 1024 * 1024, // 2MB
    mimeType: 'application/pdf',
    contentType: 'application/pdf',
    tempPath: '/tmp/test-files/styrelse-protokoll-2024-03.pdf'
  },
  {
    filename: 'faktura-el-2024-februari.pdf',
    size: 500 * 1024, // 500KB
    mimeType: 'application/pdf',
    contentType: 'application/pdf',
    tempPath: '/tmp/test-files/faktura-el-2024-februari.pdf'
  },
  {
    filename: 'årsbokslut-2023.xlsx',
    size: 5 * 1024 * 1024, // 5MB
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    tempPath: '/tmp/test-files/årsbokslut-2023.xlsx'
  },
  {
    filename: 'besiktningsrapport-ventilation.doc',
    size: 3 * 1024 * 1024, // 3MB
    mimeType: 'application/msword',
    contentType: 'application/msword',
    tempPath: '/tmp/test-files/besiktningsrapport-ventilation.doc'
  },
  {
    filename: 'energy-certificate.pdf',
    size: 1 * 1024 * 1024, // 1MB
    mimeType: 'application/pdf',
    contentType: 'application/pdf',
    tempPath: '/tmp/test-files/energy-certificate.pdf'
  },
  {
    filename: 'suspicious-file.exe.pdf', // Suspicious filename
    size: 100 * 1024, // 100KB
    mimeType: 'application/pdf',
    contentType: 'application/pdf',
    tempPath: '/tmp/test-files/suspicious-file.exe.pdf'
  }
];

/**
 * Test basic validation functionality
 */
async function testBasicValidation() {
  console.log('\n=== Testing Basic BRF File Validation ===\n');

  const validator = createBRFValidator();
  
  for (const file of testFiles.slice(0, 3)) { // Test first 3 files
    console.log(`📄 Validating: ${file.filename}`);
    
    try {
      const result = await validator.validateBRFFile(file, 'test-cooperative-123');
      
      console.log(`   ✅ Valid: ${result.valid}`);
      console.log(`   📂 Category: ${result.category} (${result.confidence}% confidence)`);
      console.log(`   🇸🇪 Swedish content: ${result.swedish_content_detected}`);
      console.log(`   🔍 PII detected: ${Object.values(result.pii_detected).some(v => v) ? 'Yes' : 'No'}`);
      
      if (result.errors.length > 0) {
        console.log(`   ❌ Errors: ${result.errors.join(', ')}`);
      }
      
      if (result.warnings.length > 0) {
        console.log(`   ⚠️  Warnings: ${result.warnings.join(', ')}`);
      }

      if (result.virus_scan_result) {
        console.log(`   🛡️  Security scan: ${result.virus_scan_result.clean ? 'Clean' : 'Threats detected'}`);
      }
      
      console.log();
    } catch (error) {
      console.log(`   ❌ Validation failed: ${error instanceof Error ? error.message : error}`);
      console.log();
    }
  }
}

/**
 * Test batch validation
 */
async function testBatchValidation() {
  console.log('\n=== Testing Batch File Validation ===\n');

  try {
    const result = await validateBatchFiles(testFiles, {
      cooperativeId: 'test-cooperative-123',
      userId: 'test-user-456',
      logValidation: true
    });

    if (!result.success || !result.data) {
      console.log('❌ Batch validation failed:', result.error);
      return;
    }

    const { validFiles, invalidFiles, summary } = result.data;

    console.log('📊 Batch Validation Summary:');
    console.log(`   Total files: ${summary.total}`);
    console.log(`   Valid files: ${summary.valid}`);
    console.log(`   Invalid files: ${summary.invalid}`);
    console.log(`   Total size: ${(summary.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log();

    // Show category distribution
    console.log('📂 Document Categories:');
    Object.entries(summary.categories).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} files`);
    });
    console.log();

    // Show invalid files
    if (invalidFiles.length > 0) {
      console.log('❌ Invalid Files:');
      invalidFiles.forEach(file => {
        console.log(`   ${file.filename}:`);
        file.errors.forEach(error => console.log(`     - ${error}`));
      });
      console.log();
    }

    // Show valid files with details
    console.log('✅ Valid Files:');
    validFiles.forEach(file => {
      console.log(`   ${file.filename}:`);
      console.log(`     Category: ${file.validation.category} (${file.validation.confidence}% confidence)`);
      console.log(`     Security: ${file.validation.virus_scan_result?.clean ? 'Clean' : 'Needs review'}`);
      console.log(`     Manual review required: ${file.validation.metadata.requires_manual_review ? 'Yes' : 'No'}`);
    });

  } catch (error) {
    console.log('❌ Batch validation error:', error);
  }
}

/**
 * Test custom validation rules
 */
async function testCustomValidationRules() {
  console.log('\n=== Testing Custom Validation Rules ===\n');

  // Test strict validation for protocols
  console.log('🔒 Testing strict validation for board protocols:');
  const strictRules = BRFValidators.protocols();
  const strictValidator = createBRFValidator(strictRules);

  const protocolFile = testFiles.find(f => f.filename.includes('protokoll'));
  if (protocolFile) {
    const result = await strictValidator.validateBRFFile(protocolFile, 'test-cooperative-123');
    console.log(`   Protocol validation result: ${result.valid ? 'Valid' : 'Invalid'}`);
    if (!result.valid) {
      console.log(`   Errors: ${result.errors.join(', ')}`);
    }
  }

  // Test custom rule builder
  console.log('\n🛠️  Testing custom rule builder:');
  const customRules = new ValidationRuleBuilder()
    .category('invoice')
    .maxSize(1) // 1MB limit for invoices
    .requireVirusScan(true)
    .enablePIIDetection(false)
    .build();

  const customValidator = createBRFValidator(customRules);
  const invoiceFile = testFiles.find(f => f.filename.includes('faktura'));
  if (invoiceFile) {
    const result = await customValidator.validateBRFFile(invoiceFile, 'test-cooperative-123');
    console.log(`   Custom rules validation: ${result.valid ? 'Valid' : 'Invalid'}`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.join(', ')}`);
    }
  }
}

/**
 * Test document categorization
 */
async function testDocumentCategorization() {
  console.log('\n=== Testing Document Categorization ===\n');

  const testFilenames = [
    'styrelse-protokoll-mars-2024.pdf',
    'faktura-sophamtning-januari.pdf',
    'avtal-hisservice-2024.docx',
    'bokslut-2023-final.xlsx',
    'besiktning-tak-rapport.pdf',
    'forsäkringsbrev-fastighet.pdf',
    'dom-tingsratt-granntvist.pdf',
    'underhallsplan-2024-2026.doc',
    'energideklaration-2024.pdf',
    'hyreskontrakt-lokal-102.pdf',
    'kallelse-arsstamma-2024.pdf',
    'allmant-dokument.txt'
  ];

  const validator = createBRFValidator();

  for (const filename of testFilenames) {
    const testFile = {
      filename,
      size: 1024 * 1024, // 1MB
      mimeType: 'application/pdf'
    };

    try {
      const result = await validator.validateBRFFile(testFile, 'test-cooperative-123');
      console.log(`📄 ${filename.padEnd(35)} → ${result.category.padEnd(20)} (${result.confidence}%)`);
    } catch (error) {
      console.log(`📄 ${filename.padEnd(35)} → Error: ${error instanceof Error ? error.message : error}`);
    }
  }
}

/**
 * Test security scanning
 */
async function testSecurityScanning() {
  console.log('\n=== Testing Security Scanning ===\n');

  const scanner = createDevelopmentScanner();
  
  console.log('🔍 Testing security scan with mock threats...');
  
  for (let i = 0; i < 5; i++) {
    const testFile = `/tmp/test-scan-${i}.pdf`;
    const result = await scanner.scanFile(testFile, 'test-cooperative-123');
    
    console.log(`   Scan ${i + 1}: ${result.clean ? '✅ Clean' : '⚠️ Threats detected'}`);
    if (!result.clean) {
      result.threats.forEach(threat => {
        console.log(`     - ${threat.name} (${threat.severity}): ${threat.description}`);
      });
    }
  }
}

/**
 * Demonstrate error handling and Swedish messages
 */
async function testErrorHandlingAndMessages() {
  console.log('\n=== Testing Error Handling and Swedish Messages ===\n');

  const validator = createBRFValidator();

  // Test various error conditions
  const errorTestFiles = [
    {
      filename: '', // Empty filename
      size: 1024,
      mimeType: 'application/pdf'
    },
    {
      filename: 'too-large-file.pdf',
      size: 1000 * 1024 * 1024, // 1GB - too large
      mimeType: 'application/pdf'
    },
    {
      filename: 'invalid-extension.xyz',
      size: 1024,
      mimeType: 'application/unknown'
    },
    {
      filename: 'con.pdf', // Reserved Windows filename
      size: 1024,
      mimeType: 'application/pdf'
    }
  ];

  for (const file of errorTestFiles) {
    console.log(`📄 Testing error case: ${file.filename || 'Empty filename'}`);
    
    try {
      const result = await validator.validateBRFFile(file, 'test-cooperative-123');
      
      if (!result.valid) {
        console.log('   ❌ Validation errors (in Swedish):');
        result.errors.forEach(error => console.log(`     - ${error}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('   ⚠️ Validation warnings (in Swedish):');
        result.warnings.forEach(warning => console.log(`     - ${warning}`));
      }
    } catch (error) {
      console.log(`   💥 Exception: ${error instanceof Error ? error.message : error}`);
    }
    
    console.log();
  }
}

/**
 * Performance test
 */
async function testPerformance() {
  console.log('\n=== Testing Performance ===\n');

  const validator = createBRFValidator();
  const batchSize = 10;
  const testBatch = Array(batchSize).fill(null).map((_, i) => ({
    filename: `test-file-${i + 1}.pdf`,
    size: Math.random() * 10 * 1024 * 1024, // Random size up to 10MB
    mimeType: 'application/pdf'
  }));

  console.log(`⏱️ Validating batch of ${batchSize} files...`);
  const startTime = Date.now();

  const result = await validateBatchFiles(testBatch, {
    cooperativeId: 'test-cooperative-123',
    userId: 'test-user-456',
    logValidation: false // Disable logging for performance test
  });

  const endTime = Date.now();
  const duration = endTime - startTime;

  if (result.success && result.data) {
    console.log(`✅ Batch validation completed in ${duration}ms`);
    console.log(`   Average: ${(duration / batchSize).toFixed(2)}ms per file`);
    console.log(`   Valid files: ${result.data.validFiles.length}`);
    console.log(`   Invalid files: ${result.data.invalidFiles.length}`);
  } else {
    console.log(`❌ Batch validation failed: ${result.error}`);
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🧪 BRF File Validation System - Comprehensive Test Suite');
  console.log('='.repeat(60));

  try {
    await testBasicValidation();
    await testBatchValidation();
    await testCustomValidationRules();
    await testDocumentCategorization();
    await testSecurityScanning();
    await testErrorHandlingAndMessages();
    await testPerformance();

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Key Features Demonstrated:');
    console.log('   • BRF-specific document categorization');
    console.log('   • MIME type and file signature validation');
    console.log('   • Swedish language error messages');
    console.log('   • Security scanning with threat detection');
    console.log('   • PII detection for Swedish personal data');
    console.log('   • Custom validation rules per cooperative');
    console.log('   • Batch processing with comprehensive reporting');
    console.log('   • Performance optimization for bulk uploads');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export {
  runAllTests,
  testBasicValidation,
  testBatchValidation,
  testCustomValidationRules,
  testDocumentCategorization,
  testSecurityScanning,
  testErrorHandlingAndMessages,
  testPerformance
};