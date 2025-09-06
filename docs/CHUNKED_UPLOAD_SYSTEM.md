# Chunked Upload System - BRF Portal

## Overview

The Chunked Upload System provides robust, resumable file upload functionality for large BRF documents up to 500MB. It features chunked uploads with integrity verification, progress tracking, concurrent processing, and comprehensive error handling with Swedish language support.

## Features

### Core Functionality
- ✅ **Chunked Uploads**: Files are split into manageable chunks (default 2MB)
- ✅ **Resumable Uploads**: Sessions can be resumed across browser refreshes
- ✅ **Integrity Verification**: SHA-256 checksums ensure data integrity
- ✅ **Concurrent Processing**: Multiple chunks uploaded simultaneously (default 3)
- ✅ **Progress Tracking**: Real-time progress reporting per chunk and overall
- ✅ **Error Handling**: Automatic retry logic with exponential backoff
- ✅ **Large File Support**: Up to 500MB files for BRF documents
- ✅ **Swedish Language**: All messages and errors in Swedish

### Security & Validation
- ✅ **Authentication Integration**: Seamless integration with existing RLS system
- ✅ **File Type Validation**: BRF-specific document validation
- ✅ **Virus Scanning**: Optional integrated security scanning
- ✅ **Content Analysis**: Automatic document categorization
- ✅ **Cooperative Isolation**: Data isolation per cooperative

### Performance & Reliability
- ✅ **Automatic Cleanup**: Expired sessions and temporary files cleaned up
- ✅ **Storage Management**: Efficient chunk storage and assembly
- ✅ **Session Expiration**: 24-hour session timeout
- ✅ **Rate Limiting**: Integration with existing rate limiting
- ✅ **Monitoring**: Comprehensive event logging

## Architecture

### Database Schema

The system extends the existing database with three new tables:

```sql
-- Main session tracking
chunked_upload_sessions
  - id (Primary key)
  - cooperative_id (Foreign key to cooperatives)
  - upload_id (Unique client identifier)
  - original_filename, file_size, total_chunks
  - status, progress_percentage, chunks_uploaded
  - storage_path, final_file_path
  - expires_at, resumable settings
  - validation and security configuration

-- Individual chunk tracking  
chunked_upload_chunks
  - id (Primary key)
  - session_id (Foreign key)
  - chunk_number, chunk_size, chunk_hash
  - status, upload_attempts, retry_count
  - upload timing and speed metrics
  - storage_path, error_message

-- Event logging for monitoring
chunked_upload_events
  - Session and chunk event tracking
  - Performance metrics and error logging
  - Audit trail for security and compliance
```

### API Endpoints

```
POST   /api/upload/chunks/init                    - Initialize upload session
PUT    /api/upload/chunks/{sessionId}/{chunkNum}  - Upload specific chunk
GET    /api/upload/chunks/{sessionId}/{chunkNum}  - Get chunk status
DELETE /api/upload/chunks/{sessionId}/{chunkNum}  - Retry failed chunk
GET    /api/upload/chunks/{sessionId}             - Get session progress
POST   /api/upload/chunks/{sessionId}             - Resume session
DELETE /api/upload/chunks/{sessionId}             - Cancel session
```

### Class Structure

```typescript
ChunkedUploadManager         // Server-side session management
ChunkedUploadClient          // Client-side upload coordination  
ChunkedValidationMiddleware  // Validation and security
ChunkedUploadSchema          // Database schema management
```

## Usage Examples

### Basic Client Usage

```typescript
import { ChunkedUploadClient } from '@/lib/upload';

// Initialize client with file
const client = new ChunkedUploadClient(file, {
  chunkSize: 2 * 1024 * 1024, // 2MB chunks
  maxConcurrentChunks: 3,
  enableIntegrityVerification: true,
  onProgress: (progress) => {
    console.log(`Progress: ${progress.progressPercentage}%`);
  },
  onComplete: (result) => {
    console.log('Upload completed:', result.filename);
  },
  onError: (error) => {
    console.error('Upload failed:', error.message);
  }
});

// Initialize session
const session = await client.initialize({
  documentType: 'invoice',
  category: 'financial'
});

// Start upload
const result = await client.upload();
```

### Resume Existing Upload

```typescript
// Resume from existing session ID
const result = await client.resume(sessionId);
```

### Server-Side Usage

```typescript
import { ChunkedUploadManager } from '@/lib/upload';

const manager = new ChunkedUploadManager({
  database: db,
  maxFileSize: 500 * 1024 * 1024, // 500MB
  storageBasePath: '/uploads/chunked',
  enableIntegrityVerification: true
});

// Create session
const session = await manager.createSession({
  cooperativeId: 'coop-123',
  uploadedBy: 'user-456',
  filename: 'document.pdf',
  fileSize: 10485760, // 10MB
  fileHash: 'sha256-hash-here'
});

// Upload chunk
const result = await manager.uploadChunk({
  sessionId: session.sessionId,
  chunkNumber: 0,
  chunkData: buffer,
  chunkHash: 'chunk-hash'
});

// Get progress
const progress = manager.getProgress(sessionId);
```

### Integration with Existing Upload System

```typescript
// Check file size to determine upload method
const useChunkedUpload = file.size > 10 * 1024 * 1024; // 10MB threshold

if (useChunkedUpload) {
  // Use chunked upload for large files
  const client = new ChunkedUploadClient(file, config);
  await client.upload();
} else {
  // Use existing bulk upload for smaller files
  const bulkSystem = new BulkUploadSystem(config);
  await bulkSystem.createBatch({...});
}
```

## Configuration

### Environment Variables

```bash
# Storage paths
CHUNKED_UPLOAD_STORAGE="/uploads/chunked"      # Final file storage
CHUNKED_UPLOAD_TEMP="/tmp/chunked-uploads"     # Temporary chunk storage

# Limits
CHUNKED_UPLOAD_MAX_FILE_SIZE="524288000"       # 500MB in bytes
CHUNKED_UPLOAD_MAX_CHUNK_SIZE="10485760"       # 10MB in bytes
CHUNKED_UPLOAD_SESSION_HOURS="24"              # Session expiration

# Features
CHUNKED_UPLOAD_INTEGRITY_CHECK="true"          # Enable checksums
CHUNKED_UPLOAD_VIRUS_SCAN="true"               # Enable virus scanning
CHUNKED_UPLOAD_AUTO_CLEANUP="true"             # Auto cleanup expired
```

### Cooperative Settings

```json
{
  "chunked_upload": {
    "enabled": true,
    "max_file_size_mb": 500,
    "default_chunk_size_mb": 2,
    "max_concurrent_chunks": 3,
    "session_expiration_hours": 24,
    "allowed_file_types": ["pdf", "docx", "xlsx", "jpg", "png", "mp4"],
    "virus_scan_required": true,
    "integrity_verification_required": true,
    "auto_cleanup_enabled": true
  }
}
```

## Error Handling

### Automatic Retry Logic

```typescript
// Chunk-level retry configuration
const config = {
  maxRetriesPerChunk: 3,        // Max retries per failed chunk
  retryDelay: 1000,             // Base delay in ms
  retryBackoff: 'exponential'   // Exponential backoff strategy
};
```

### Error Categories

1. **Network Errors**: Automatic retry with backoff
2. **Validation Errors**: Immediate failure, no retry
3. **Server Errors**: Limited retry with exponential backoff  
4. **Client Errors**: Immediate failure with user notification

### Swedish Error Messages

```typescript
// Examples of Swedish error messages
SwedishMessages.errors.FILE_TOO_LARGE        // "Filen är för stor"
SwedishMessages.errors.UPLOAD_INTERRUPTED    // "Uppladdning avbruten"  
SwedishMessages.errors.CHUNK_RETRY_EXCEEDED  // "Max antal försök uppnått"
SwedishMessages.errors.SESSION_EXPIRED       // "Sessionen har löpt ut"
```

## Security Features

### Authentication & Authorization
- All endpoints require valid authentication
- Cooperative-level data isolation enforced
- Permission checks: `canUploadDocuments`, `canViewDocuments`

### Data Integrity
- SHA-256 checksums for file and chunk verification
- File signature validation
- MIME type verification against file content

### Virus Scanning
- Optional integration with security scanning
- Quarantine infected files
- Comprehensive threat detection

### Content Validation
- BRF-specific document categorization
- Swedish content detection
- Suspicious content pattern detection

## Monitoring & Logging

### Event Types
```typescript
'session_created' | 'session_started' | 'chunk_uploaded' | 
'chunk_failed' | 'chunk_retried' | 'session_completed' | 
'session_failed' | 'session_cancelled' | 'session_expired' |
'assembly_started' | 'assembly_completed' | 
'validation_started' | 'validation_completed'
```

### Metrics Tracked
- Upload speeds per chunk and overall
- Session completion rates
- Error rates by type
- Storage utilization
- Performance bottlenecks

### Health Monitoring
```typescript
// Example monitoring query
SELECT 
  COUNT(*) as active_sessions,
  AVG(progress_percentage) as avg_progress,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_sessions
FROM chunked_upload_sessions 
WHERE created_at > datetime('now', '-1 hour');
```

## Maintenance & Cleanup

### Automatic Cleanup
- Expired sessions cleaned up after 1 hour grace period
- Temporary chunk files removed after successful assembly
- Failed sessions cleaned up after 24 hours

### Manual Cleanup
```typescript
// Cleanup expired sessions
const manager = new ChunkedUploadManager(config);
const result = await manager.cleanupExpiredSessions();
console.log(`Cleaned up ${result.cleaned} expired sessions`);
```

### Storage Management
```bash
# Monitor storage usage
du -sh /uploads/chunked/
du -sh /tmp/chunked-uploads/

# Find large old files
find /tmp/chunked-uploads/ -type f -mtime +1 -size +10M
```

## Performance Tuning

### Chunk Size Optimization
- **Small files (< 10MB)**: Use standard upload
- **Medium files (10-100MB)**: 2MB chunks
- **Large files (100-500MB)**: 4-5MB chunks
- **Network considerations**: Adjust based on connection quality

### Concurrency Settings
- **Good connections**: 3-5 concurrent chunks
- **Limited bandwidth**: 1-2 concurrent chunks  
- **Mobile devices**: 1-2 concurrent chunks

### Storage Optimization
- Use SSD storage for chunk assembly
- Separate temporary and permanent storage
- Regular cleanup of expired data

## Troubleshooting

### Common Issues

1. **Upload Stalls**
   - Check network connectivity
   - Verify chunk size settings
   - Monitor concurrent upload limits

2. **Assembly Failures**
   - Check available disk space
   - Verify chunk integrity
   - Review file permissions

3. **Session Expiration**
   - Increase session timeout
   - Implement progress persistence
   - Add user notifications

4. **High Memory Usage**
   - Optimize chunk sizes
   - Implement streaming assembly
   - Monitor garbage collection

### Debug Commands
```bash
# Check active sessions
sqlite3 database.db "SELECT * FROM chunked_upload_sessions WHERE status != 'completed';"

# Monitor chunk progress  
sqlite3 database.db "SELECT session_id, COUNT(*) as chunks, 
  SUM(CASE WHEN status = 'uploaded' THEN 1 ELSE 0 END) as completed
  FROM chunked_upload_chunks GROUP BY session_id;"

# Check error patterns
sqlite3 database.db "SELECT error_message, COUNT(*) FROM chunked_upload_chunks 
  WHERE status = 'failed' GROUP BY error_message ORDER BY COUNT(*) DESC;"
```

## Integration Testing

### Test Scenarios
1. **Basic Upload**: Small file, single chunk
2. **Large File**: Multi-chunk upload with progress tracking
3. **Network Interruption**: Resume after connection loss
4. **Concurrent Uploads**: Multiple files simultaneously
5. **Error Recovery**: Failed chunks with retry logic
6. **Session Expiration**: Timeout handling
7. **File Validation**: Invalid file types and formats
8. **Security Scanning**: Virus detection and quarantine

### Load Testing
```bash
# Simulate concurrent uploads
for i in {1..10}; do
  curl -X POST /api/upload/chunks/init \
    -H "Content-Type: application/json" \
    -d '{"filename":"test'$i'.pdf","fileSize":10485760}' &
done
```

## Future Enhancements

### Planned Features
- [ ] **Parallel Assembly**: Assemble chunks as they arrive
- [ ] **Delta Sync**: Only upload changed chunks
- [ ] **Compression**: Optional chunk compression
- [ ] **CDN Integration**: Direct upload to CDN endpoints
- [ ] **Mobile Optimization**: Adaptive chunk sizing for mobile
- [ ] **Bandwidth Throttling**: Respect network conditions

### Performance Improvements
- [ ] **Streaming Assembly**: Reduce memory usage for large files
- [ ] **Background Processing**: Asynchronous validation and scanning
- [ ] **Caching**: Cache validation results and metadata
- [ ] **Database Optimization**: Partition large tables

## Support

For issues or questions about the Chunked Upload System:

1. Check the troubleshooting section above
2. Review system logs for error patterns  
3. Monitor database performance metrics
4. Test with smaller files first
5. Verify storage and network configurations

The system is designed to be robust and self-healing, with comprehensive error handling and automatic recovery mechanisms built-in.