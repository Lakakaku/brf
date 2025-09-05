#!/usr/bin/env tsx

/**
 * Database backup script for BRF Portal
 */

import {
  backupDatabase,
  restoreDatabase,
  MigrationManager,
} from '../lib/database/migrations';
import fs from 'fs';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];

  console.log('💾 BRF Portal Database Backup');
  console.log('=============================\n');

  try {
    const manager = new MigrationManager();

    switch (command) {
      case 'create':
      case undefined:
        const backupPath = manager.backup(filePath);
        console.log(`✅ Backup created successfully: ${backupPath}`);

        // Show backup info
        const stats = fs.statSync(backupPath);
        console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Date: ${stats.ctime.toISOString()}`);
        break;

      case 'restore':
        if (!filePath) {
          console.error('❌ Backup file path is required for restore');
          console.log('Usage: npm run db:backup restore /path/to/backup.db');
          process.exit(1);
        }

        if (!fs.existsSync(filePath)) {
          console.error(`❌ Backup file not found: ${filePath}`);
          process.exit(1);
        }

        console.log(`🔄 Restoring from backup: ${filePath}`);
        manager.restore(filePath);
        console.log('✅ Database restored successfully');
        break;

      case 'list':
        console.log('📋 Available backups:');
        const backupDir = path.join(process.cwd(), 'database');

        if (!fs.existsSync(backupDir)) {
          console.log('   No backups found');
          break;
        }

        const backups = fs
          .readdirSync(backupDir)
          .filter(file => file.startsWith('backup_') && file.endsWith('.db'))
          .map(file => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            return {
              name: file,
              path: filePath,
              size: stats.size,
              date: stats.ctime,
            };
          })
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        if (backups.length === 0) {
          console.log('   No backups found');
        } else {
          backups.forEach(backup => {
            console.log(`   ${backup.name}`);
            console.log(
              `     Size: ${(backup.size / 1024 / 1024).toFixed(2)} MB`
            );
            console.log(`     Date: ${backup.date.toISOString()}`);
            console.log(`     Path: ${backup.path}`);
            console.log('');
          });
        }
        break;

      default:
        console.log('Usage:');
        console.log('  npm run db:backup              - Create backup');
        console.log('  npm run db:backup create       - Create backup');
        console.log(
          '  npm run db:backup create <path> - Create backup at specific path'
        );
        console.log('  npm run db:backup restore <path> - Restore from backup');
        console.log(
          '  npm run db:backup list         - List available backups'
        );
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Backup operation failed:', error);
    process.exit(1);
  }
}

main();
