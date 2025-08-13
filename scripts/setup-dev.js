#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const readline = require('readline');

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

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
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
    skipDependencies: false,
    skipDatabase: false,
    skipEnv: false,
    skipGit: false,
    interactive: true,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--skip-deps':
        options.skipDependencies = true;
        break;
      case '--skip-db':
        options.skipDatabase = true;
        break;
      case '--skip-env':
        options.skipEnv = true;
        break;
      case '--skip-git':
        options.skipGit = true;
        break;
      case '--non-interactive':
      case '-y':
        options.interactive = false;
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
  logHeader('GeekSuitePro Development Setup');
  log('Usage: node scripts/setup-dev.js [options]\n');
  log('Options:');
  log('  --skip-deps              Skip installing dependencies');
  log('  --skip-db                Skip database setup');
  log('  --skip-env               Skip environment file creation');
  log('  --skip-git               Skip Git configuration');
  log('  -y, --non-interactive    Run in non-interactive mode');
  log('  -v, --verbose            Verbose output');
  log('  -h, --help               Show this help message\n');
  log('Examples:');
  log('  node scripts/setup-dev.js                    # Full interactive setup');
  log('  node scripts/setup-dev.js -y                 # Non-interactive setup');
  log('  node scripts/setup-dev.js --skip-db          # Skip database setup');
}

// Welcome message
function showWelcome() {
  logHeader('Welcome to GeekSuitePro Development Setup!');
  log('This script will help you set up your development environment.\n');
  log('What this script will do:', 'blue');
  log('• Check system prerequisites');
  log('• Install Node.js dependencies');
  log('• Set up environment configuration');
  log('• Configure database connections');
  log('• Set up Git hooks (optional)');
  log('• Create initial development data');
  log('• Start development servers\n');
}

// Check system prerequisites
async function checkPrerequisites(options) {
  logStep(1, 8, 'Checking System Prerequisites');

  const requirements = {
    'Node.js': { command: 'node', minVersion: '16.0.0' },
    'npm': { command: 'npm', minVersion: '8.0.0' },
    'Git': { command: 'git', required: true },
    'MongoDB': { command: 'mongod', required: false },
    'Redis': { command: 'redis-server', required: false },
    'Docker': { command: 'docker', required: false }
  };

  const results = {};

  for (const [name, config] of Object.entries(requirements)) {
    try {
      const { stdout } = await runCommand(config.command, ['--version'], { silent: true });
      const version = stdout.trim().split('\n')[0];
      results[name] = { installed: true, version };
      logSuccess(`${name}: ${version}`);
    } catch (error) {
      results[name] = { installed: false };
      if (config.required) {
        logError(`${name}: Not installed (Required)`);
      } else {
        logWarning(`${name}: Not installed (Optional)`);
      }
    }
  }

  // Check for required tools
  const missingRequired = Object.entries(results)
    .filter(([name, result]) => requirements[name].required && !result.installed)
    .map(([name]) => name);

  if (missingRequired.length > 0) {
    logError(`Missing required tools: ${missingRequired.join(', ')}`);
    logInfo('Please install the missing tools and run this script again.');
    process.exit(1);
  }

  // Warn about optional tools
  const missingOptional = Object.entries(results)
    .filter(([name, result]) => !requirements[name].required && !result.installed)
    .map(([name]) => name);

  if (missingOptional.length > 0) {
    logWarning(`Optional tools not installed: ${missingOptional.join(', ')}`);
    logInfo('Some features may not work without these tools.');
    
    if (options.interactive) {
      const proceed = await question('Do you want to continue anyway? (y/N): ');
      if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
        logInfo('Setup cancelled. Please install the missing tools and try again.');
        process.exit(0);
      }
    }
  }

  return results;
}

// Install dependencies
async function installDependencies(options) {
  if (options.skipDependencies) {
    logStep(2, 8, 'Skipping Dependencies Installation');
    return;
  }

  logStep(2, 8, 'Installing Dependencies');

  try {
    logInfo('Installing production dependencies...');
    await runCommand('npm', ['install', '--production=false']);
    logSuccess('Dependencies installed successfully');

    // Install global development tools
    const globalTools = ['nodemon', 'pm2'];
    
    if (options.interactive) {
      const installGlobal = await question('Install global development tools (nodemon, pm2)? (Y/n): ');
      if (installGlobal.toLowerCase() !== 'n' && installGlobal.toLowerCase() !== 'no') {
        for (const tool of globalTools) {
          try {
            logInfo(`Installing ${tool} globally...`);
            await runCommand('npm', ['install', '-g', tool]);
            logSuccess(`${tool} installed globally`);
          } catch (error) {
            logWarning(`Failed to install ${tool} globally: ${error.message}`);
          }
        }
      }
    }

  } catch (error) {
    logError(`Failed to install dependencies: ${error.message}`);
    throw error;
  }
}

// Create environment file
async function createEnvironmentFile(options) {
  if (options.skipEnv) {
    logStep(3, 8, 'Skipping Environment Configuration');
    return;
  }

  logStep(3, 8, 'Creating Environment Configuration');

  const envFile = '.env';
  const envExampleFile = '.env.example';

  if (fs.existsSync(envFile)) {
    logWarning('.env file already exists');
    
    if (options.interactive) {
      const overwrite = await question('Do you want to overwrite it? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        logInfo('Keeping existing .env file');
        return;
      }
    } else {
      logInfo('Keeping existing .env file');
      return;
    }
  }

  let envContent = '';

  if (fs.existsSync(envExampleFile)) {
    logInfo('Using .env.example as template');
    envContent = fs.readFileSync(envExampleFile, 'utf8');
  } else {
    logInfo('Creating basic .env file');
    envContent = `# GeekSuitePro Development Environment

# Application
NODE_ENV=development
PORT=5000
APP_NAME=GeekSuitePro
APP_URL=http://localhost:5000

# Database
MONGODB_URI=mongodb://localhost:27017/geeksuitepro_dev
MONGODB_TEST_URI=mongodb://localhost:27017/geeksuitepro_test

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
ENCRYPTION_KEY=your-32-character-encryption-key-here

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/app.log

# Email (Development - use Mailtrap or similar)
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
FROM_EMAIL=noreply@geeksuitepro.local
FROM_NAME=GeekSuitePro

# SMS (Development - use Twilio trial)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Payment (Development - use Stripe test keys)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret

# Social Media (Development)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Cloud Storage (Development)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_PUSH_NOTIFICATIONS=false
ENABLE_WHITE_LABELING=false

# Development
DEBUG=geeksuitepro:*
NODE_OPTIONS=--max-old-space-size=4096
`;
  }

  if (options.interactive) {
    logInfo('\nLet\'s configure some basic settings:');
    
    const appName = await question('Application name (GeekSuitePro): ') || 'GeekSuitePro';
    const port = await question('Port (5000): ') || '5000';
    const mongoUri = await question('MongoDB URI (mongodb://localhost:27017/geeksuitepro_dev): ') || 'mongodb://localhost:27017/geeksuitepro_dev';
    const redisUrl = await question('Redis URL (redis://localhost:6379): ') || 'redis://localhost:6379';
    
    // Replace placeholders
    envContent = envContent.replace(/APP_NAME=.*/, `APP_NAME=${appName}`);
    envContent = envContent.replace(/PORT=.*/, `PORT=${port}`);
    envContent = envContent.replace(/MONGODB_URI=.*/, `MONGODB_URI=${mongoUri}`);
    envContent = envContent.replace(/REDIS_URL=.*/, `REDIS_URL=${redisUrl}`);
    envContent = envContent.replace(/APP_URL=.*/, `APP_URL=http://localhost:${port}`);
  }

  fs.writeFileSync(envFile, envContent);
  logSuccess('.env file created successfully');
  logInfo('Please review and update the .env file with your actual configuration values');
}

// Setup database
async function setupDatabase(options, prerequisites) {
  if (options.skipDatabase) {
    logStep(4, 8, 'Skipping Database Setup');
    return;
  }

  logStep(4, 8, 'Setting Up Database');

  // Check if MongoDB is available
  if (!prerequisites.MongoDB?.installed) {
    logWarning('MongoDB is not installed locally');
    logInfo('You can:');
    logInfo('1. Install MongoDB locally');
    logInfo('2. Use MongoDB Atlas (cloud)');
    logInfo('3. Use Docker to run MongoDB');
    
    if (options.interactive) {
      const useDocker = await question('Do you want to start MongoDB using Docker? (y/N): ');
      if (useDocker.toLowerCase() === 'y' || useDocker.toLowerCase() === 'yes') {
        if (prerequisites.Docker?.installed) {
          try {
            logInfo('Starting MongoDB container...');
            await runCommand('docker', ['run', '-d', '--name', 'geeksuitepro-mongo', '-p', '27017:27017', 'mongo:latest']);
            logSuccess('MongoDB container started');
          } catch (error) {
            logWarning('Failed to start MongoDB container. It might already be running.');
          }
        } else {
          logError('Docker is not available');
        }
      }
    }
    return;
  }

  try {
    // Test MongoDB connection
    logInfo('Testing MongoDB connection...');
    const mongoose = require('mongoose');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/geeksuitepro_dev';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    logSuccess('MongoDB connection successful');
    
    // Run database initialization
    if (fs.existsSync('scripts/mongo-init.js')) {
      logInfo('Running database initialization...');
      await runCommand('node', ['scripts/mongo-init.js']);
      logSuccess('Database initialized');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    logWarning(`MongoDB connection failed: ${error.message}`);
    logInfo('Please ensure MongoDB is running and accessible');
  }

  // Setup Redis if available
  if (prerequisites.Redis?.installed) {
    try {
      logInfo('Testing Redis connection...');
      const redis = require('redis');
      const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      
      await client.connect();
      await client.ping();
      await client.disconnect();
      
      logSuccess('Redis connection successful');
    } catch (error) {
      logWarning(`Redis connection failed: ${error.message}`);
      logInfo('Please ensure Redis is running and accessible');
    }
  }
}

// Setup Git hooks
async function setupGitHooks(options) {
  if (options.skipGit) {
    logStep(5, 8, 'Skipping Git Configuration');
    return;
  }

  logStep(5, 8, 'Setting Up Git Hooks');

  try {
    // Check if we're in a git repository
    await runCommand('git', ['status'], { silent: true });
    
    // Install husky if available
    if (fs.existsSync('node_modules/husky')) {
      logInfo('Setting up Husky git hooks...');
      await runCommand('npx', ['husky', 'install']);
      logSuccess('Git hooks configured');
    } else {
      logInfo('Husky not found, skipping git hooks setup');
    }
    
  } catch (error) {
    logWarning('Not in a git repository or git hooks setup failed');
  }
}

// Create development data
async function createDevelopmentData(options) {
  logStep(6, 8, 'Creating Development Data');

  if (options.interactive) {
    const createData = await question('Create sample development data? (Y/n): ');
    if (createData.toLowerCase() === 'n' || createData.toLowerCase() === 'no') {
      logInfo('Skipping development data creation');
      return;
    }
  }

  try {
    // Create necessary directories
    const directories = ['logs', 'uploads', 'uploads/temp', 'uploads/avatars', 'uploads/documents'];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logInfo(`Created directory: ${dir}`);
      }
    });
    
    logSuccess('Development directories created');
    
    // Create sample data script if it exists
    if (fs.existsSync('scripts/create-sample-data.js')) {
      logInfo('Creating sample data...');
      await runCommand('node', ['scripts/create-sample-data.js']);
      logSuccess('Sample data created');
    }
    
  } catch (error) {
    logWarning(`Failed to create development data: ${error.message}`);
  }
}

// Setup development tools
async function setupDevelopmentTools(options) {
  logStep(7, 8, 'Setting Up Development Tools');

  try {
    // Create VS Code settings if not exists
    const vscodeDir = '.vscode';
    const settingsFile = path.join(vscodeDir, 'settings.json');
    
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir);
    }
    
    if (!fs.existsSync(settingsFile)) {
      const vscodeSettings = {
        "editor.tabSize": 2,
        "editor.insertSpaces": true,
        "editor.formatOnSave": true,
        "eslint.autoFixOnSave": true,
        "files.exclude": {
          "node_modules": true,
          "coverage": true,
          "logs": true
        },
        "search.exclude": {
          "node_modules": true,
          "coverage": true,
          "logs": true
        }
      };
      
      fs.writeFileSync(settingsFile, JSON.stringify(vscodeSettings, null, 2));
      logSuccess('VS Code settings created');
    }
    
    // Create launch configuration
    const launchFile = path.join(vscodeDir, 'launch.json');
    if (!fs.existsSync(launchFile)) {
      const launchConfig = {
        "version": "0.2.0",
        "configurations": [
          {
            "name": "Launch GeekSuitePro",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/app.js",
            "env": {
              "NODE_ENV": "development"
            },
            "console": "integratedTerminal",
            "restart": true,
            "runtimeExecutable": "nodemon",
            "skipFiles": ["<node_internals>/**"]
          }
        ]
      };
      
      fs.writeFileSync(launchFile, JSON.stringify(launchConfig, null, 2));
      logSuccess('VS Code launch configuration created');
    }
    
  } catch (error) {
    logWarning(`Failed to setup development tools: ${error.message}`);
  }
}

// Start development servers
async function startDevelopmentServers(options) {
  logStep(8, 8, 'Starting Development Servers');

  if (options.interactive) {
    const startServers = await question('Start development servers now? (Y/n): ');
    if (startServers.toLowerCase() === 'n' || startServers.toLowerCase() === 'no') {
      logInfo('Skipping server startup');
      showCompletionMessage();
      return;
    }
  }

  try {
    logInfo('Starting development server...');
    logInfo('The server will start in the background.');
    logInfo('Press Ctrl+C to stop the server when you\'re done.');
    
    // Start the development server
    const serverProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      shell: true,
      detached: false
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      logInfo('\nShutting down development server...');
      serverProcess.kill('SIGINT');
      process.exit(0);
    });
    
    logSuccess('Development server started!');
    logInfo('Access your application at: http://localhost:5000');
    
  } catch (error) {
    logError(`Failed to start development server: ${error.message}`);
    logInfo('You can start it manually with: npm run dev');
  }
}

// Show completion message
function showCompletionMessage() {
  logHeader('Setup Complete!');
  logSuccess('Your GeekSuitePro development environment is ready!');
  log('\nNext steps:', 'blue');
  log('1. Review and update your .env file with actual API keys');
  log('2. Start the development server: npm run dev');
  log('3. Access the application at: http://localhost:5000');
  log('4. Run tests: npm test');
  log('5. Check the README.md for more information\n');
  
  log('Useful commands:', 'blue');
  log('• npm run dev          - Start development server');
  log('• npm test             - Run tests');
  log('• npm run test:watch   - Run tests in watch mode');
  log('• npm run lint         - Run ESLint');
  log('• npm run format       - Format code with Prettier');
  log('• npm run build        - Build for production\n');
  
  log('Happy coding! 🚀', 'green');
}

// Main setup function
async function main() {
  try {
    const options = parseArgs();
    
    showWelcome();
    
    if (options.interactive) {
      const proceed = await question('Do you want to continue with the setup? (Y/n): ');
      if (proceed.toLowerCase() === 'n' || proceed.toLowerCase() === 'no') {
        logInfo('Setup cancelled.');
        process.exit(0);
      }
    }
    
    // Run setup steps
    const prerequisites = await checkPrerequisites(options);
    await installDependencies(options);
    await createEnvironmentFile(options);
    await setupDatabase(options, prerequisites);
    await setupGitHooks(options);
    await createDevelopmentData(options);
    await setupDevelopmentTools(options);
    await startDevelopmentServers(options);
    
    if (!options.interactive) {
      showCompletionMessage();
    }
    
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    logInfo('Please check the error above and try again.');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('\nSetup interrupted by user', 'yellow');
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\nSetup terminated', 'yellow');
  rl.close();
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  runCommand,
  parseArgs,
  checkPrerequisites,
  createEnvironmentFile,
  setupDatabase
};