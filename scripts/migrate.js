#!/usr/bin/env node

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

// Migration schema
const migrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  version: { type: String, required: true },
  description: { type: String },
  executedAt: { type: Date, default: Date.now },
  executionTime: { type: Number }, // milliseconds
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  error: { type: String },
  checksum: { type: String }
});

let Migration;

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    action: 'status', // status, up, down, create, reset, rollback
    target: null, // specific migration name or version
    force: false,
    dryRun: false,
    verbose: false,
    migrationsPath: './migrations',
    environment: process.env.NODE_ENV || 'development'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case 'status':
      case 'up':
      case 'down':
      case 'create':
      case 'reset':
      case 'rollback':
        options.action = arg;
        break;
      case '--target':
      case '-t':
        if (nextArg) {
          options.target = nextArg;
          i++;
        }
        break;
      case '--migrations-path':
      case '-p':
        if (nextArg) {
          options.migrationsPath = nextArg;
          i++;
        }
        break;
      case '--environment':
      case '-e':
        if (nextArg) {
          options.environment = nextArg;
          i++;
        }
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-') && !options.target) {
          options.target = arg;
        } else if (arg.startsWith('-')) {
          logWarning(`Unknown option: ${arg}`);
        }
        break;
    }
  }

  return options;
}

// Show help message
function showHelp() {
  logHeader('GeekSuitePro Database Migration Tool');
  log('Usage: node scripts/migrate.js <action> [options]\n');
  log('Actions:');
  log('  status                      Show migration status');
  log('  up [target]                 Run pending migrations (up to target)');
  log('  down [target]               Rollback migrations (down to target)');
  log('  create <name>               Create a new migration file');
  log('  reset                       Reset all migrations (dangerous!)');
  log('  rollback [steps]            Rollback last N migrations (default: 1)\n');
  log('Options:');
  log('  -t, --target <name>         Target migration name or version');
  log('  -p, --migrations-path <path> Path to migrations directory (default: ./migrations)');
  log('  -e, --environment <env>     Environment (default: development)');
  log('  -f, --force                 Force execution (skip confirmations)');
  log('  --dry-run                   Show what would be executed without running');
  log('  -v, --verbose               Verbose output');
  log('  -h, --help                  Show this help message\n');
  log('Examples:');
  log('  node scripts/migrate.js status                    # Show migration status');
  log('  node scripts/migrate.js up                        # Run all pending migrations');
  log('  node scripts/migrate.js up 001_initial_schema     # Run migrations up to specific one');
  log('  node scripts/migrate.js down 001_initial_schema   # Rollback to specific migration');
  log('  node scripts/migrate.js create add_user_roles     # Create new migration');
  log('  node scripts/migrate.js rollback 2                # Rollback last 2 migrations');
}

// Migration manager class
class MigrationManager {
  constructor(options) {
    this.options = options;
    this.migrationsPath = path.resolve(options.migrationsPath);
    this.migrations = [];
  }

  // Initialize migration system
  async initialize() {
    // Connect to database
    const mongoUri = this.getMongoUri();
    logInfo(`Connecting to database: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Initialize migration model
    Migration = mongoose.model('Migration', migrationSchema);
    
    // Ensure migrations directory exists
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
      logInfo(`Created migrations directory: ${this.migrationsPath}`);
    }
    
    // Load migration files
    await this.loadMigrations();
  }

  // Get MongoDB URI based on environment
  getMongoUri() {
    const envMap = {
      development: process.env.MONGODB_URI || 'mongodb://localhost:27017/geeksuitepro_dev',
      test: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/geeksuitepro_test',
      production: process.env.MONGODB_PROD_URI || process.env.MONGODB_URI
    };
    
    return envMap[this.options.environment] || envMap.development;
  }

  // Load migration files
  async loadMigrations() {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.js'))
      .sort();
    
    this.migrations = [];
    
    for (const file of files) {
      const filePath = path.join(this.migrationsPath, file);
      const migration = require(filePath);
      
      // Validate migration structure
      if (!migration.up || !migration.down) {
        logWarning(`Invalid migration file: ${file} (missing up/down functions)`);
        continue;
      }
      
      this.migrations.push({
        name: path.basename(file, '.js'),
        file: filePath,
        ...migration
      });
    }
    
    if (this.options.verbose) {
      logInfo(`Loaded ${this.migrations.length} migration files`);
    }
  }

  // Get migration status
  async getStatus() {
    const executedMigrations = await Migration.find({}).sort({ executedAt: 1 });
    const executedNames = new Set(executedMigrations.map(m => m.name));
    
    const status = this.migrations.map(migration => {
      const executed = executedNames.has(migration.name);
      const record = executedMigrations.find(m => m.name === migration.name);
      
      return {
        name: migration.name,
        description: migration.description || 'No description',
        status: executed ? 'executed' : 'pending',
        executedAt: record?.executedAt,
        executionTime: record?.executionTime,
        error: record?.error
      };
    });
    
    return {
      migrations: status,
      total: this.migrations.length,
      executed: status.filter(m => m.status === 'executed').length,
      pending: status.filter(m => m.status === 'pending').length
    };
  }

  // Display migration status
  async displayStatus() {
    logHeader('Migration Status');
    
    const status = await this.getStatus();
    
    logInfo(`Total migrations: ${status.total}`);
    logInfo(`Executed: ${status.executed}`);
    logInfo(`Pending: ${status.pending}`);
    
    if (status.migrations.length === 0) {
      logWarning('No migrations found');
      return;
    }
    
    log('\nMigrations:', 'blue');
    log('─'.repeat(80));
    log('Status   | Name                           | Executed At         | Time');
    log('─'.repeat(80));
    
    status.migrations.forEach(migration => {
      const statusIcon = migration.status === 'executed' ? '✅' : '⏳';
      const executedAt = migration.executedAt ? 
        migration.executedAt.toISOString().slice(0, 19).replace('T', ' ') : 
        'Not executed';
      const executionTime = migration.executionTime ? 
        `${migration.executionTime}ms` : 
        '-';
      
      const name = migration.name.padEnd(30);
      const time = executedAt.padEnd(19);
      
      log(`${statusIcon}      | ${name} | ${time} | ${executionTime}`);
      
      if (migration.error) {
        logError(`         Error: ${migration.error}`);
      }
    });
    
    log('─'.repeat(80));
  }

  // Run migrations up
  async runUp(targetMigration = null) {
    const status = await this.getStatus();
    const pendingMigrations = status.migrations.filter(m => m.status === 'pending');
    
    if (pendingMigrations.length === 0) {
      logSuccess('No pending migrations to run');
      return;
    }
    
    let migrationsToRun = pendingMigrations;
    
    if (targetMigration) {
      const targetIndex = pendingMigrations.findIndex(m => m.name === targetMigration);
      if (targetIndex === -1) {
        logError(`Target migration not found or already executed: ${targetMigration}`);
        return;
      }
      migrationsToRun = pendingMigrations.slice(0, targetIndex + 1);
    }
    
    logHeader(`Running ${migrationsToRun.length} Migration(s) Up`);
    
    if (this.options.dryRun) {
      logWarning('DRY RUN MODE - No changes will be made');
      migrationsToRun.forEach((migration, index) => {
        logInfo(`${index + 1}. ${migration.name}`);
      });
      return;
    }
    
    for (let i = 0; i < migrationsToRun.length; i++) {
      const migration = migrationsToRun[i];
      await this.executeMigration(migration, 'up', i + 1, migrationsToRun.length);
    }
    
    logSuccess('All migrations completed successfully!');
  }

  // Run migrations down
  async runDown(targetMigration = null) {
    const status = await this.getStatus();
    const executedMigrations = status.migrations
      .filter(m => m.status === 'executed')
      .reverse(); // Reverse order for rollback
    
    if (executedMigrations.length === 0) {
      logSuccess('No executed migrations to rollback');
      return;
    }
    
    let migrationsToRollback = [];
    
    if (targetMigration) {
      // Find target and rollback everything after it
      const targetIndex = status.migrations.findIndex(m => m.name === targetMigration);
      if (targetIndex === -1) {
        logError(`Target migration not found: ${targetMigration}`);
        return;
      }
      
      migrationsToRollback = status.migrations
        .slice(targetIndex + 1)
        .filter(m => m.status === 'executed')
        .reverse();
    } else {
      // Rollback the last migration
      migrationsToRollback = [executedMigrations[0]];
    }
    
    if (migrationsToRollback.length === 0) {
      logSuccess('No migrations to rollback');
      return;
    }
    
    logHeader(`Rolling Back ${migrationsToRollback.length} Migration(s)`);
    
    if (this.options.dryRun) {
      logWarning('DRY RUN MODE - No changes will be made');
      migrationsToRollback.forEach((migration, index) => {
        logInfo(`${index + 1}. ${migration.name}`);
      });
      return;
    }
    
    // Confirm rollback
    if (!this.options.force) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Are you sure you want to rollback these migrations? (y/N): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        logInfo('Rollback cancelled');
        return;
      }
    }
    
    for (let i = 0; i < migrationsToRollback.length; i++) {
      const migration = migrationsToRollback[i];
      await this.executeMigration(migration, 'down', i + 1, migrationsToRollback.length);
    }
    
    logSuccess('All rollbacks completed successfully!');
  }

  // Execute a single migration
  async executeMigration(migrationInfo, direction, step, total) {
    const migration = this.migrations.find(m => m.name === migrationInfo.name);
    if (!migration) {
      throw new Error(`Migration not found: ${migrationInfo.name}`);
    }
    
    logStep(step, total, `${direction.toUpperCase()}: ${migration.name}`);
    
    const startTime = Date.now();
    let migrationRecord;
    
    try {
      if (direction === 'up') {
        // Create migration record
        migrationRecord = new Migration({
          name: migration.name,
          version: migration.version || '1.0.0',
          description: migration.description,
          status: 'running'
        });
        await migrationRecord.save();
      }
      
      // Execute migration function
      const context = {
        db: mongoose.connection.db,
        mongoose,
        log: this.options.verbose ? log : () => {},
        logInfo: this.options.verbose ? logInfo : () => {},
        logWarning: this.options.verbose ? logWarning : () => {},
        logError: this.options.verbose ? logError : () => {}
      };
      
      await migration[direction](context);
      
      const executionTime = Date.now() - startTime;
      
      if (direction === 'up') {
        // Update migration record
        migrationRecord.status = 'completed';
        migrationRecord.executionTime = executionTime;
        await migrationRecord.save();
      } else {
        // Remove migration record for rollback
        await Migration.deleteOne({ name: migration.name });
      }
      
      logSuccess(`${migration.name} (${executionTime}ms)`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (direction === 'up' && migrationRecord) {
        migrationRecord.status = 'failed';
        migrationRecord.error = error.message;
        migrationRecord.executionTime = executionTime;
        await migrationRecord.save();
      }
      
      logError(`${migration.name} failed: ${error.message}`);
      throw error;
    }
  }

  // Create a new migration file
  async createMigration(name) {
    if (!name) {
      logError('Migration name is required');
      return;
    }
    
    // Generate timestamp prefix
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '_');
    
    const fileName = `${timestamp}_${name.replace(/[^a-zA-Z0-9_]/g, '_')}.js`;
    const filePath = path.join(this.migrationsPath, fileName);
    
    // Migration template
    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 * Description: Add description here
 */

module.exports = {
  version: '1.0.0',
  description: '${name}',
  
  /**
   * Run the migration
   * @param {Object} context - Migration context
   * @param {Object} context.db - MongoDB database instance
   * @param {Object} context.mongoose - Mongoose instance
   * @param {Function} context.log - Logging function
   */
  async up(context) {
    const { db, mongoose, log } = context;
    
    // Add your migration logic here
    // Example:
    // await db.collection('users').createIndex({ email: 1 }, { unique: true });
    // log('Created unique index on users.email');
    
    throw new Error('Migration not implemented');
  },
  
  /**
   * Rollback the migration
   * @param {Object} context - Migration context
   * @param {Object} context.db - MongoDB database instance
   * @param {Object} context.mongoose - Mongoose instance
   * @param {Function} context.log - Logging function
   */
  async down(context) {
    const { db, mongoose, log } = context;
    
    // Add your rollback logic here
    // Example:
    // await db.collection('users').dropIndex({ email: 1 });
    // log('Dropped index on users.email');
    
    throw new Error('Rollback not implemented');
  }
};
`;
    
    fs.writeFileSync(filePath, template);
    logSuccess(`Created migration: ${fileName}`);
    logInfo(`Edit the file: ${filePath}`);
  }

  // Reset all migrations
  async resetMigrations() {
    logWarning('This will remove all migration records from the database!');
    
    if (!this.options.force) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Are you sure you want to reset all migrations? (y/N): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        logInfo('Reset cancelled');
        return;
      }
    }
    
    if (this.options.dryRun) {
      logWarning('DRY RUN MODE - Would delete all migration records');
      return;
    }
    
    const result = await Migration.deleteMany({});
    logSuccess(`Reset complete. Removed ${result.deletedCount} migration records.`);
  }

  // Rollback last N migrations
  async rollbackMigrations(steps = 1) {
    const status = await this.getStatus();
    const executedMigrations = status.migrations
      .filter(m => m.status === 'executed')
      .reverse()
      .slice(0, steps);
    
    if (executedMigrations.length === 0) {
      logSuccess('No executed migrations to rollback');
      return;
    }
    
    logHeader(`Rolling Back Last ${executedMigrations.length} Migration(s)`);
    
    if (this.options.dryRun) {
      logWarning('DRY RUN MODE - No changes will be made');
      executedMigrations.forEach((migration, index) => {
        logInfo(`${index + 1}. ${migration.name}`);
      });
      return;
    }
    
    for (let i = 0; i < executedMigrations.length; i++) {
      const migration = executedMigrations[i];
      await this.executeMigration(migration, 'down', i + 1, executedMigrations.length);
    }
    
    logSuccess('Rollback completed successfully!');
  }

  // Cleanup
  async cleanup() {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

// Main function
async function main() {
  const options = parseArgs();
  const manager = new MigrationManager(options);
  
  try {
    await manager.initialize();
    
    switch (options.action) {
      case 'status':
        await manager.displayStatus();
        break;
        
      case 'up':
        await manager.runUp(options.target);
        break;
        
      case 'down':
        await manager.runDown(options.target);
        break;
        
      case 'create':
        if (!options.target) {
          logError('Migration name is required for create action');
          logInfo('Usage: node scripts/migrate.js create <migration_name>');
          process.exit(1);
        }
        await manager.createMigration(options.target);
        break;
        
      case 'reset':
        await manager.resetMigrations();
        break;
        
      case 'rollback':
        const steps = options.target ? parseInt(options.target) : 1;
        if (isNaN(steps) || steps < 1) {
          logError('Invalid number of steps for rollback');
          process.exit(1);
        }
        await manager.rollbackMigrations(steps);
        break;
        
      default:
        logError(`Unknown action: ${options.action}`);
        showHelp();
        process.exit(1);
    }
    
  } catch (error) {
    logError(`Migration failed: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await manager.cleanup();
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  log('\nMigration interrupted by user', 'yellow');
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('\nMigration terminated', 'yellow');
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  MigrationManager,
  parseArgs
};