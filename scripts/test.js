#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

// Check if required dependencies are installed
function checkDependencies() {
  logHeader('Checking Dependencies');
  
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    logError('package.json not found!');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const devDependencies = packageJson.devDependencies || {};
  
  const requiredDeps = ['jest', 'supertest', '@types/jest'];
  const missingDeps = requiredDeps.filter(dep => !devDependencies[dep]);
  
  if (missingDeps.length > 0) {
    logError(`Missing required dependencies: ${missingDeps.join(', ')}`);
    logInfo('Run: npm install --save-dev jest supertest @types/jest');
    process.exit(1);
  }
  
  logSuccess('All required dependencies are installed');
}

// Run a command and return a promise
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    coverage: false,
    watch: false,
    verbose: false,
    testFile: null,
    updateSnapshots: false,
    silent: false,
    detectOpenHandles: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--coverage':
      case '-c':
        options.coverage = true;
        break;
      case '--watch':
      case '-w':
        options.watch = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--file':
      case '-f':
        options.testFile = args[++i];
        break;
      case '--update-snapshots':
      case '-u':
        options.updateSnapshots = true;
        break;
      case '--silent':
      case '-s':
        options.silent = true;
        break;
      case '--detect-open-handles':
        options.detectOpenHandles = true;
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
  logHeader('GeekSuitePro Test Runner');
  log('Usage: node scripts/test.js [options]\n');
  log('Options:');
  log('  -c, --coverage           Generate test coverage report');
  log('  -w, --watch              Watch files for changes and rerun tests');
  log('  -v, --verbose            Verbose output');
  log('  -f, --file <file>        Run specific test file');
  log('  -u, --update-snapshots   Update test snapshots');
  log('  -s, --silent             Silent mode (less output)');
  log('  --detect-open-handles    Detect open handles that prevent Jest from exiting');
  log('  -h, --help               Show this help message\n');
  log('Examples:');
  log('  node scripts/test.js                    # Run all tests');
  log('  node scripts/test.js --coverage         # Run tests with coverage');
  log('  node scripts/test.js --watch            # Run tests in watch mode');
  log('  node scripts/test.js --file auth.test   # Run specific test file');
}

// Build Jest command arguments
function buildJestArgs(options) {
  const args = [];

  if (options.coverage) {
    args.push('--coverage');
    args.push('--coverageDirectory=coverage');
    args.push('--coverageReporters=text');
    args.push('--coverageReporters=lcov');
    args.push('--coverageReporters=html');
  }

  if (options.watch) {
    args.push('--watch');
  }

  if (options.verbose) {
    args.push('--verbose');
  }

  if (options.testFile) {
    args.push(options.testFile);
  }

  if (options.updateSnapshots) {
    args.push('--updateSnapshot');
  }

  if (options.silent) {
    args.push('--silent');
  }

  if (options.detectOpenHandles) {
    args.push('--detectOpenHandles');
  }

  // Add default Jest options
  args.push('--testTimeout=30000');
  args.push('--forceExit');
  args.push('--maxWorkers=1'); // Use single worker for database tests

  return args;
}

// Check if MongoDB is running (for integration tests)
async function checkMongoDB() {
  logHeader('Checking MongoDB Connection');
  
  try {
    const mongoose = require('mongoose');
    const testUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/geeksuitepro_test';
    
    await mongoose.connect(testUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    await mongoose.disconnect();
    logSuccess('MongoDB connection successful');
  } catch (error) {
    logWarning('MongoDB connection failed - using in-memory database for tests');
    logInfo('Install and start MongoDB for full integration testing');
  }
}

// Setup test environment
function setupTestEnvironment() {
  logHeader('Setting up Test Environment');
  
  // Set NODE_ENV to test
  process.env.NODE_ENV = 'test';
  
  // Set test database URI if not already set
  if (!process.env.MONGODB_TEST_URI) {
    process.env.MONGODB_TEST_URI = 'mongodb://localhost:27017/geeksuitepro_test';
  }
  
  // Disable external API calls in tests
  process.env.DISABLE_EXTERNAL_APIS = 'true';
  
  // Set JWT secret for tests
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret-key';
  }
  
  logSuccess('Test environment configured');
}

// Clean up test artifacts
function cleanupTestArtifacts() {
  logHeader('Cleaning up Test Artifacts');
  
  const artifactsToClean = [
    path.join(__dirname, '..', 'coverage'),
    path.join(__dirname, '..', 'test-results.xml'),
    path.join(__dirname, '..', '.nyc_output')
  ];
  
  artifactsToClean.forEach(artifact => {
    if (fs.existsSync(artifact)) {
      if (fs.lstatSync(artifact).isDirectory()) {
        fs.rmSync(artifact, { recursive: true, force: true });
      } else {
        fs.unlinkSync(artifact);
      }
      logInfo(`Removed: ${path.basename(artifact)}`);
    }
  });
  
  logSuccess('Test artifacts cleaned up');
}

// Generate test summary
function generateTestSummary(options) {
  logHeader('Test Configuration Summary');
  
  log(`Test Mode: ${options.watch ? 'Watch' : 'Single Run'}`, 'blue');
  log(`Coverage: ${options.coverage ? 'Enabled' : 'Disabled'}`, 'blue');
  log(`Verbose: ${options.verbose ? 'Enabled' : 'Disabled'}`, 'blue');
  
  if (options.testFile) {
    log(`Test File: ${options.testFile}`, 'blue');
  } else {
    log('Test Scope: All Tests', 'blue');
  }
  
  log(`Environment: ${process.env.NODE_ENV}`, 'blue');
  log(`Database: ${process.env.MONGODB_TEST_URI}`, 'blue');
}

// Main function
async function main() {
  try {
    const options = parseArgs();
    
    logHeader('GeekSuitePro Test Runner');
    
    // Setup
    checkDependencies();
    setupTestEnvironment();
    generateTestSummary(options);
    
    // Check MongoDB if not using in-memory database
    if (!process.env.USE_MEMORY_DB) {
      await checkMongoDB();
    }
    
    // Clean up previous test artifacts if not in watch mode
    if (!options.watch) {
      cleanupTestArtifacts();
    }
    
    // Build Jest command
    const jestArgs = buildJestArgs(options);
    
    logHeader('Running Tests');
    logInfo(`Command: npx jest ${jestArgs.join(' ')}`);
    
    // Run tests
    await runCommand('npx', ['jest', ...jestArgs], {
      cwd: path.join(__dirname, '..')
    });
    
    logSuccess('All tests completed successfully!');
    
    // Show coverage report location if generated
    if (options.coverage) {
      const coverageDir = path.join(__dirname, '..', 'coverage');
      if (fs.existsSync(coverageDir)) {
        logInfo(`Coverage report generated at: ${coverageDir}/index.html`);
      }
    }
    
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('\nTest execution interrupted by user', 'yellow');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\nTest execution terminated', 'yellow');
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  runCommand,
  parseArgs,
  buildJestArgs,
  setupTestEnvironment
};