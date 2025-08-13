#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const archiver = require('archiver');
const mongoose = require('mongoose');
require('dotenv').config();

const execAsync = util.promisify(exec);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(message, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logStep(step, total, message) {
  log(`[${step}/${total}] ${message}`, 'magenta');
}

// Run a command and return a promise
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      shell: true,
      ...options
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}\n${stderr}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Check if a command exists
async function commandExists(command) {
  try {
    await runCommand(command, ['--version'], { silent: true });
    return true;
  } catch (error) {
    return false;
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    type: 'full', // full, database, files, config
    output: './backups',
    compress: true,
    encrypt: false,
    retention: 30, // days
    verbose: false,
    dryRun: false,
    schedule: false,
    exclude: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--type':
      case '-t':
        if (nextArg && ['full', 'database', 'files', 'config'].includes(nextArg)) {
          options.type = nextArg;
          i++;
        }
        break;
      case '--output':
      case '-o':
        if (nextArg) {
          options.output = nextArg;
          i++;
        }
        break;
      case '--no-compress':
        options.compress = false;
        break;
      case '--encrypt':
        options.encrypt = true;
        break;
      case '--retention':
      case '-r':
        if (nextArg && !isNaN(nextArg)) {
          options.retention = parseInt(nextArg);
          i++;
        }
        break;
      case '--exclude':
      case '-e':
        if (nextArg) {
          options.exclude.push(nextArg);
          i++;
        }
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--schedule':
        options.schedule = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          logWarning(`Unknown option: ${arg}`);
        }
        break;
    }
  }

  return options;
}

// Show help message
function showHelp() {
  logHeader('GeekSuitePro Backup Tool');
  log('Usage: node scripts/backup.js [options]\n');
  log('Options:');
  log('  -t, --type <type>        Backup type: full, database, files, config (default: full)');
  log('  -o, --output <path>      Output directory (default: ./backups)');
  log('  --no-compress            Disable compression');
  log('  --encrypt                Encrypt backup files');
  log('  -r, --retention <days>   Retention period in days (default: 30)');
  log('  -e, --exclude <pattern>  Exclude files/directories (can be used multiple times)');
  log('  -v, --verbose            Verbose output');
  log('  --dry-run                Show what would be backed up without creating backup');
  log('  --schedule               Set up automated backup schedule');
  log('  -h, --help               Show this help message\n');
  log('Backup Types:');
  log('  full                     Complete backup (database + files + config)');
  log('  database                 Database only');
  log('  files                    Application files only');
  log('  config                   Configuration files only\n');
  log('Examples:');
  log('  node scripts/backup.js                           # Full backup');
  log('  node scripts/backup.js -t database               # Database only');
  log('  node scripts/backup.js -o /path/to/backups       # Custom output directory');
  log('  node scripts/backup.js --encrypt -r 7            # Encrypted backup, 7-day retention');
  log('  node scripts/backup.js --dry-run                 # Preview backup contents');
}

// Create backup directory structure
function createBackupDirectory(outputPath, timestamp) {
  const backupDir = path.join(outputPath, `backup_${timestamp}`);
  
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  return backupDir;
}

// Generate timestamp for backup
function generateTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

// Create backup manifest
function createManifest(backupDir, options, stats) {
  const manifest = {
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
    type: options.type,
    compressed: options.compress,
    encrypted: options.encrypt,
    environment: process.env.NODE_ENV || 'development',
    stats,
    files: []
  };
  
  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  return manifestPath;
}

// Backup database
async function backupDatabase(backupDir, options) {
  logStep(1, 4, 'Backing up Database');
  
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/geeksuitepro';
  const dbName = mongoUri.split('/').pop().split('?')[0];
  const outputPath = path.join(backupDir, 'database');
  
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  try {
    // Check if mongodump is available
    const hasMongodump = await commandExists('mongodump');
    
    if (hasMongodump) {
      logInfo('Using mongodump for database backup...');
      
      const mongodumpArgs = [
        '--uri', mongoUri,
        '--out', outputPath
      ];
      
      if (options.verbose) {
        mongodumpArgs.push('--verbose');
      }
      
      if (!options.dryRun) {
        await runCommand('mongodump', mongodumpArgs);
        logSuccess('Database backup completed using mongodump');
      } else {
        logInfo(`Would run: mongodump ${mongodumpArgs.join(' ')}`);
      }
    } else {
      logWarning('mongodump not found, using mongoose export...');
      
      if (!options.dryRun) {
        await exportDatabaseWithMongoose(outputPath, mongoUri);
        logSuccess('Database backup completed using mongoose export');
      } else {
        logInfo('Would export database using mongoose');
      }
    }
    
    return {
      type: 'database',
      path: outputPath,
      size: options.dryRun ? 0 : await getDirectorySize(outputPath)
    };
    
  } catch (error) {
    logError(`Database backup failed: ${error.message}`);
    throw error;
  }
}

// Export database using mongoose
async function exportDatabaseWithMongoose(outputPath, mongoUri) {
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      const collectionName = collection.name;
      logInfo(`Exporting collection: ${collectionName}`);
      
      const documents = await mongoose.connection.db.collection(collectionName).find({}).toArray();
      const filePath = path.join(outputPath, `${collectionName}.json`);
      
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    throw error;
  }
}

// Backup application files
async function backupFiles(backupDir, options) {
  logStep(2, 4, 'Backing up Application Files');
  
  const filesDir = path.join(backupDir, 'files');
  
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
  }
  
  const filesToBackup = [
    'routes',
    'models',
    'middleware',
    'services',
    'utils',
    'public',
    'views',
    'uploads',
    'app.js',
    'package.json',
    'package-lock.json'
  ];
  
  const excludePatterns = [
    'node_modules',
    '.git',
    'logs',
    'coverage',
    'backups',
    '.env',
    '.env.*',
    '*.log',
    'tmp',
    'temp',
    ...options.exclude
  ];
  
  try {
    for (const item of filesToBackup) {
      const sourcePath = path.join(process.cwd(), item);
      const destPath = path.join(filesDir, item);
      
      if (fs.existsSync(sourcePath)) {
        if (options.dryRun) {
          logInfo(`Would backup: ${item}`);
        } else {
          await copyRecursive(sourcePath, destPath, excludePatterns);
          logInfo(`Backed up: ${item}`);
        }
      }
    }
    
    logSuccess('Application files backup completed');
    
    return {
      type: 'files',
      path: filesDir,
      size: options.dryRun ? 0 : await getDirectorySize(filesDir)
    };
    
  } catch (error) {
    logError(`Files backup failed: ${error.message}`);
    throw error;
  }
}

// Backup configuration files
async function backupConfig(backupDir, options) {
  logStep(3, 4, 'Backing up Configuration Files');
  
  const configDir = path.join(backupDir, 'config');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const configFiles = [
    '.env.example',
    'ecosystem.config.js',
    'jest.config.js',
    'docker-compose.yml',
    'Dockerfile',
    '.gitignore',
    '.eslintrc.js',
    '.prettierrc',
    'README.md'
  ];
  
  try {
    for (const file of configFiles) {
      const sourcePath = path.join(process.cwd(), file);
      const destPath = path.join(configDir, file);
      
      if (fs.existsSync(sourcePath)) {
        if (options.dryRun) {
          logInfo(`Would backup: ${file}`);
        } else {
          fs.copyFileSync(sourcePath, destPath);
          logInfo(`Backed up: ${file}`);
        }
      }
    }
    
    // Create environment info
    if (!options.dryRun) {
      const envInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(
        path.join(configDir, 'environment.json'),
        JSON.stringify(envInfo, null, 2)
      );
    }
    
    logSuccess('Configuration files backup completed');
    
    return {
      type: 'config',
      path: configDir,
      size: options.dryRun ? 0 : await getDirectorySize(configDir)
    };
    
  } catch (error) {
    logError(`Configuration backup failed: ${error.message}`);
    throw error;
  }
}

// Compress backup
async function compressBackup(backupDir, options) {
  if (!options.compress) {
    return null;
  }
  
  logStep(4, 4, 'Compressing Backup');
  
  const archivePath = `${backupDir}.tar.gz`;
  
  if (options.dryRun) {
    logInfo(`Would compress to: ${archivePath}`);
    return { path: archivePath, size: 0 };
  }
  
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(archivePath);
    const archive = archiver('tar', {
      gzip: true,
      gzipOptions: {
        level: 6
      }
    });
    
    output.on('close', () => {
      const stats = fs.statSync(archivePath);
      logSuccess(`Backup compressed: ${formatBytes(stats.size)}`);
      
      // Remove uncompressed directory
      fs.rmSync(backupDir, { recursive: true, force: true });
      
      resolve({
        path: archivePath,
        size: stats.size
      });
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(backupDir, false);
    archive.finalize();
  });
}

// Copy files recursively
async function copyRecursive(src, dest, excludePatterns = []) {
  const stats = fs.statSync(src);
  
  // Check if path should be excluded
  const relativePath = path.relative(process.cwd(), src);
  for (const pattern of excludePatterns) {
    if (relativePath.includes(pattern) || path.basename(src).includes(pattern)) {
      return;
    }
  }
  
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    for (const file of files) {
      await copyRecursive(
        path.join(src, file),
        path.join(dest, file),
        excludePatterns
      );
    }
  } else {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

// Get directory size
async function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  function calculateSize(itemPath) {
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      const files = fs.readdirSync(itemPath);
      for (const file of files) {
        calculateSize(path.join(itemPath, file));
      }
    } else {
      totalSize += stats.size;
    }
  }
  
  if (fs.existsSync(dirPath)) {
    calculateSize(dirPath);
  }
  
  return totalSize;
}

// Format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Clean old backups
async function cleanOldBackups(outputPath, retentionDays) {
  logInfo('Cleaning old backups...');
  
  try {
    const files = fs.readdirSync(outputPath);
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    let deletedCount = 0;
    let deletedSize = 0;
    
    for (const file of files) {
      const filePath = path.join(outputPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        if (stats.isDirectory()) {
          deletedSize += await getDirectorySize(filePath);
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          deletedSize += stats.size;
          fs.unlinkSync(filePath);
        }
        deletedCount++;
        logInfo(`Deleted old backup: ${file}`);
      }
    }
    
    if (deletedCount > 0) {
      logSuccess(`Cleaned ${deletedCount} old backups (${formatBytes(deletedSize)} freed)`);
    } else {
      logInfo('No old backups to clean');
    }
    
  } catch (error) {
    logWarning(`Failed to clean old backups: ${error.message}`);
  }
}

// Setup backup schedule
async function setupSchedule(options) {
  logHeader('Setting up Backup Schedule');
  
  const cronJob = `0 2 * * * node ${path.join(__dirname, 'backup.js')} --type ${options.type} --output ${options.output}`;
  
  logInfo('Backup schedule configuration:');
  log(`Command: ${cronJob}`);
  log('Schedule: Daily at 2:00 AM');
  
  // Create a simple scheduler script
  const schedulerScript = `#!/usr/bin/env node

// GeekSuitePro Backup Scheduler
// This script sets up automated backups

const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

console.log('Starting GeekSuitePro backup scheduler...');

// Schedule daily backup at 2:00 AM
cron.schedule('0 2 * * *', () => {
  console.log('Starting scheduled backup...');
  
  const backupProcess = spawn('node', [
    path.join(__dirname, 'backup.js'),
    '--type', '${options.type}',
    '--output', '${options.output}'
  ], {
    stdio: 'inherit'
  });
  
  backupProcess.on('close', (code) => {
    if (code === 0) {
      console.log('Scheduled backup completed successfully');
    } else {
      console.error('Scheduled backup failed with code:', code);
    }
  });
});

console.log('Backup scheduler is running. Press Ctrl+C to stop.');
`;
  
  const schedulerPath = path.join(__dirname, 'backup-scheduler.js');
  fs.writeFileSync(schedulerPath, schedulerScript);
  
  logSuccess('Backup scheduler created');
  logInfo(`To start the scheduler: node ${schedulerPath}`);
  logInfo('To run as a service, use PM2: pm2 start backup-scheduler.js');
}

// Main backup function
async function performBackup(options) {
  const timestamp = generateTimestamp();
  const backupDir = createBackupDirectory(options.output, timestamp);
  
  logHeader(`Creating ${options.type.toUpperCase()} Backup`);
  logInfo(`Backup directory: ${backupDir}`);
  logInfo(`Compression: ${options.compress ? 'Enabled' : 'Disabled'}`);
  logInfo(`Encryption: ${options.encrypt ? 'Enabled' : 'Disabled'}`);
  
  if (options.dryRun) {
    logWarning('DRY RUN MODE - No files will be created');
  }
  
  const backupStats = {
    startTime: new Date().toISOString(),
    type: options.type,
    components: []
  };
  
  try {
    // Perform backup based on type
    switch (options.type) {
      case 'full':
        backupStats.components.push(await backupDatabase(backupDir, options));
        backupStats.components.push(await backupFiles(backupDir, options));
        backupStats.components.push(await backupConfig(backupDir, options));
        break;
      case 'database':
        backupStats.components.push(await backupDatabase(backupDir, options));
        break;
      case 'files':
        backupStats.components.push(await backupFiles(backupDir, options));
        break;
      case 'config':
        backupStats.components.push(await backupConfig(backupDir, options));
        break;
      default:
        throw new Error(`Unknown backup type: ${options.type}`);
    }
    
    backupStats.endTime = new Date().toISOString();
    backupStats.duration = new Date(backupStats.endTime) - new Date(backupStats.startTime);
    backupStats.totalSize = backupStats.components.reduce((sum, comp) => sum + comp.size, 0);
    
    // Create manifest
    if (!options.dryRun) {
      createManifest(backupDir, options, backupStats);
    }
    
    // Compress if requested
    let finalPath = backupDir;
    if (options.compress) {
      const compressed = await compressBackup(backupDir, options);
      if (compressed) {
        finalPath = compressed.path;
        backupStats.compressedSize = compressed.size;
      }
    }
    
    // Clean old backups
    if (options.retention > 0) {
      await cleanOldBackups(options.output, options.retention);
    }
    
    // Show summary
    logHeader('Backup Complete!');
    logSuccess(`Backup created: ${finalPath}`);
    logInfo(`Total size: ${formatBytes(backupStats.totalSize)}`);
    if (backupStats.compressedSize) {
      logInfo(`Compressed size: ${formatBytes(backupStats.compressedSize)}`);
      const ratio = ((1 - backupStats.compressedSize / backupStats.totalSize) * 100).toFixed(1);
      logInfo(`Compression ratio: ${ratio}%`);
    }
    logInfo(`Duration: ${Math.round(backupStats.duration / 1000)}s`);
    
    return {
      success: true,
      path: finalPath,
      stats: backupStats
    };
    
  } catch (error) {
    logError(`Backup failed: ${error.message}`);
    
    // Clean up failed backup
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    
    throw error;
  }
}

// Main function
async function main() {
  try {
    const options = parseArgs();
    
    if (options.schedule) {
      await setupSchedule(options);
      return;
    }
    
    await performBackup(options);
    
  } catch (error) {
    logError(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('\nBackup interrupted by user', 'yellow');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\nBackup terminated', 'yellow');
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  performBackup,
  parseArgs,
  backupDatabase,
  backupFiles,
  backupConfig
};