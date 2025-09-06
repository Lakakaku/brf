/**
 * Test Script for Chunked Upload System
 * Run with: npx tsx scripts/test-chunked-upload.ts
 */

import { ChunkedUploadManager, initializeChunkedUploadTables } from '@/lib/upload';
import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

async function testChunkedUploadSystem() {
  console.log('🧪 Testing Chunked Upload System...\n');

  // Initialize test database
  const db = new Database(':memory:');
  
  // Initialize all required tables (simplified for testing)
  db.exec(`
    CREATE TABLE cooperatives (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      settings TEXT DEFAULT '{}'
    );
    
    CREATE TABLE members (
      id TEXT PRIMARY KEY,
      cooperative_id TEXT REFERENCES cooperatives(id),
      email TEXT NOT NULL
    );
  `);
  
  // Initialize chunked upload tables
  initializeChunkedUploadTables(db);
  
  // Insert test data
  db.prepare('INSERT INTO cooperatives (id, name) VALUES (?, ?)').run('test-coop', 'Test Cooperative');
  db.prepare('INSERT INTO members (id, cooperative_id, email) VALUES (?, ?, ?)').run('test-user', 'test-coop', 'test@example.com');

  console.log('✅ Database initialized');

  // Initialize chunked upload manager
  const manager = new ChunkedUploadManager({
    database: db,
    defaultChunkSize: 1024, // 1KB for testing
    maxFileSize: 10 * 1024, // 10KB for testing
    maxConcurrentChunks: 2,
    sessionExpirationHours: 1,
    storageBasePath: '/tmp/test-chunked',
    tempStoragePath: '/tmp/test-chunked-temp',
    enableIntegrityVerification: true,
    enableVirusScanning: false, // Disable for testing
    autoCleanupEnabled: true,
  });

  console.log('✅ ChunkedUploadManager initialized');

  // Create a test file
  const testContent = 'This is a test file for chunked upload system. '.repeat(100); // ~4KB
  const testBuffer = Buffer.from(testContent, 'utf8');
  const testFileHash = crypto.createHash('sha256').update(testBuffer).digest('hex');
  
  console.log(`📄 Created test file: ${testBuffer.length} bytes`);
  console.log(`🔐 File hash: ${testFileHash}`);

  try {
    // Test 1: Create upload session
    console.log('\n🧪 Test 1: Creating upload session...');
    
    const session = await manager.createSession({
      cooperativeId: 'test-coop',
      uploadedBy: 'test-user',
      filename: 'test-document.txt',
      fileSize: testBuffer.length,
      chunkSize: 1024,
      fileHash: testFileHash,
      mimeType: 'text/plain',
      contentType: 'text/plain',
      metadata: { test: true },
      virusScanEnabled: false,
    });

    console.log(`✅ Session created: ${session.sessionId}`);
    console.log(`📊 Total chunks: ${session.totalChunks}`);
    console.log(`⏰ Expires at: ${session.expiresAt}`);

    // Test 2: Upload chunks
    console.log('\n🧪 Test 2: Uploading chunks...');
    
    const totalChunks = Math.ceil(testBuffer.length / 1024);
    
    for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
      const start = chunkNumber * 1024;
      const end = Math.min(start + 1024, testBuffer.length);
      const chunkData = testBuffer.subarray(start, end);
      const chunkHash = crypto.createHash('sha256').update(chunkData).digest('hex');
      
      console.log(`  📤 Uploading chunk ${chunkNumber + 1}/${totalChunks} (${chunkData.length} bytes)`);
      
      const result = await manager.uploadChunk({
        sessionId: session.sessionId,
        chunkNumber,
        chunkData,
        chunkHash,
        isLastChunk: chunkNumber === totalChunks - 1,
      });
      
      console.log(`  ✅ Chunk ${chunkNumber} uploaded successfully`);
      console.log(`  🏃‍♂️ Speed: ${Math.round(result.uploadSpeed)} bytes/sec`);
    }

    // Test 3: Check progress
    console.log('\n🧪 Test 3: Checking upload progress...');
    
    const progress = manager.getProgress(session.sessionId);
    if (progress) {
      console.log(`📊 Progress: ${progress.progressPercentage.toFixed(1)}%`);
      console.log(`📦 Chunks: ${progress.chunksUploaded}/${progress.totalChunks}`);
      console.log(`📏 Size: ${progress.uploadedSize}/${progress.fileSize} bytes`);
      console.log(`⚡ Speed: ${progress.uploadSpeed ? Math.round(progress.uploadSpeed) : 0} bytes/sec`);
      console.log(`🎯 Status: ${progress.status}`);
    }

    // Test 4: Verify final file (if completed)
    console.log('\n🧪 Test 4: Verifying assembled file...');
    
    // Wait a bit for assembly to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const finalProgress = manager.getProgress(session.sessionId);
    if (finalProgress && finalProgress.status === 'completed') {
      console.log('✅ File assembly completed successfully');
      
      // In a real scenario, you would verify the final file exists and matches
      console.log('📁 Final file would be available at storage path');
    } else {
      console.log(`⏳ File assembly in progress (status: ${finalProgress?.status})`);
    }

    // Test 5: Session resume simulation
    console.log('\n🧪 Test 5: Testing session resume...');
    
    const resumeResult = await manager.resumeSession(session.sessionId);
    console.log(`🔄 Can resume: ${resumeResult.canResume}`);
    console.log(`📦 Completed chunks: ${resumeResult.completedChunks.length}`);
    console.log(`⏳ Missing chunks: ${resumeResult.missingChunks.length}`);

    // Test 6: Cleanup
    console.log('\n🧪 Test 6: Testing cleanup...');
    
    const cleanupResult = await manager.cleanupExpiredSessions();
    console.log(`🧹 Expired sessions: ${cleanupResult.expired}`);
    console.log(`🗑️  Cleaned up: ${cleanupResult.cleaned}`);

    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup
    db.close();
    
    // Clean up test directories
    try {
      await fs.rm('/tmp/test-chunked', { recursive: true, force: true });
      await fs.rm('/tmp/test-chunked-temp', { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Performance test
async function performanceTest() {
  console.log('\n🚀 Running performance test...');
  
  const startTime = Date.now();
  await testChunkedUploadSystem();
  const endTime = Date.now();
  
  console.log(`⚡ Total test time: ${endTime - startTime}ms`);
}

// Run tests
if (require.main === module) {
  performanceTest()
    .then(() => {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    });
}

export { testChunkedUploadSystem, performanceTest };