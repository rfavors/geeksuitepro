#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    environment: 'production',
    skipTests: false,
    skipBuild: false,
    skipBackup: false,
    force: false,
    dryRun: false,
    verbose: false,
    target: 'docker', // docker, pm2, heroku, aws
    branch: 'main'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--env':
      case '-e':
        options.environment = args[++i];
        break;
      case '--target':
      case '-t':
        options.target = args[++i];
        break;
      case '--branch':
      case '-b':
        options.branch = args[++i];
        break;
      case '--skip-tests':
        options.skipTests = true;
        break;
      case '--skip-build':
        options.skipBuild = true;
        break;
      case '--skip-backup':
        options.skipBackup = true;
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
  logHeader('GeekSuitePro Deployment Script');
  log('Usage: node scripts/deploy.js [options]\n');
  log('Options:');
  log('  -e, --env <env>          Target environment (production, staging, development)');
  log('  -t, --target <target>    Deployment target (docker, pm2, heroku, aws)');
  log('  -b, --branch <branch>    Git branch to deploy (default: main)');
  log('  --skip-tests             Skip running tests before deployment');
  log('  --skip-build             Skip building the application');
  log('  --skip-backup            Skip creating backup before deployment');
  log('  -f, --force              Force deployment even if checks fail');
  log('  --dry-run                Show what would be deployed without actually deploying');
  log('  -v, --verbose            Verbose output');
  log('  -h, --help               Show this help message\n');
  log('Examples:');
  log('  node scripts/deploy.js                           # Deploy to production using Docker');
  log('  node scripts/deploy.js --env staging             # Deploy to staging environment');
  log('  node scripts/deploy.js --target pm2              # Deploy using PM2');
  log('  node scripts/deploy.js --dry-run                 # Preview deployment without executing');
}

// Check prerequisites
async function checkPrerequisites(options) {
  logStep(1, 10, 'Checking Prerequisites');

  // Check if git is available
  try {
    await runCommand('git', ['--version'], { silent: true });
    logSuccess('Git is available');
  } catch (error) {
    logError('Git is not available');
    throw new Error('Git is required for deployment');
  }

  // Check if Node.js is available
  try {
    const { stdout } = await runCommand('node', ['--version'], { silent: true });
    logSuccess(`Node.js version: ${stdout.trim()}`);
  } catch (error) {
    logError('Node.js is not available');
    throw new Error('Node.js is required for deployment');
  }

  // Check if npm is available
  try {
    const { stdout } = await runCommand('npm', ['--version'], { silent: true });
    logSuccess(`npm version: ${stdout.trim()}`);
  } catch (error) {
    logError('npm is not available');
    throw new Error('npm is required for deployment');
  }

  // Check target-specific prerequisites
  if (options.target === 'docker') {
    try {
      await runCommand('docker', ['--version'], { silent: true });
      logSuccess('Docker is available');
    } catch (error) {
      logError('Docker is not available');
      throw new Error('Docker is required for Docker deployment');
    }

    try {
      await runCommand('docker-compose', ['--version'], { silent: true });
      logSuccess('Docker Compose is available');
    } catch (error) {
      logWarning('Docker Compose is not available - using docker compose instead');
    }
  }

  if (options.target === 'pm2') {
    try {
      await runCommand('pm2', ['--version'], { silent: true });
      logSuccess('PM2 is available');
    } catch (error) {
      logError('PM2 is not available');
      throw new Error('PM2 is required for PM2 deployment');
    }
  }
}

// Check git status
async function checkGitStatus(options) {
  logStep(2, 10, 'Checking Git Status');

  try {
    // Check if we're in a git repository
    await runCommand('git', ['status'], { silent: true });
    logSuccess('Git repository detected');

    // Check current branch
    const { stdout: currentBranch } = await runCommand('git', ['branch', '--show-current'], { silent: true });
    logInfo(`Current branch: ${currentBranch.trim()}`);

    if (currentBranch.trim() !== options.branch && !options.force) {
      logWarning(`Current branch (${currentBranch.trim()}) does not match target branch (${options.branch})`);
      logInfo('Use --force to deploy from current branch or switch to the target branch');
      throw new Error('Branch mismatch');
    }

    // Check for uncommitted changes
    const { stdout: status } = await runCommand('git', ['status', '--porcelain'], { silent: true });
    if (status.trim() && !options.force) {
      logWarning('There are uncommitted changes in the repository');
      logInfo('Commit your changes or use --force to deploy with uncommitted changes');
      throw new Error('Uncommitted changes detected');
    }

    if (status.trim()) {
      logWarning('Deploying with uncommitted changes (--force used)');
    } else {
      logSuccess('No uncommitted changes detected');
    }

    // Pull latest changes
    if (!options.dryRun) {
      logInfo('Pulling latest changes from remote...');
      await runCommand('git', ['pull', 'origin', options.branch]);
      logSuccess('Latest changes pulled');
    }

  } catch (error) {
    if (!options.force) {
      throw error;
    }
    logWarning(`Git check failed but continuing due to --force: ${error.message}`);
  }
}

// Install dependencies
async function installDependencies(options) {
  logStep(3, 10, 'Installing Dependencies');

  if (options.dryRun) {
    logInfo('Would install dependencies with: npm ci');
    return;
  }

  try {
    logInfo('Installing production dependencies...');
    await runCommand('npm', ['ci', '--only=production']);
    logSuccess('Dependencies installed successfully');
  } catch (error) {
    logError('Failed to install dependencies');
    throw error;
  }
}

// Run tests
async function runTests(options) {
  if (options.skipTests) {
    logStep(4, 10, 'Skipping Tests');
    logWarning('Tests skipped as requested');
    return;
  }

  logStep(4, 10, 'Running Tests');

  if (options.dryRun) {
    logInfo('Would run tests with: npm test');
    return;
  }

  try {
    logInfo('Running test suite...');
    await runCommand('npm', ['test']);
    logSuccess('All tests passed');
  } catch (error) {
    logError('Tests failed');
    if (!options.force) {
      throw new Error('Tests must pass before deployment. Use --force to override.');
    }
    logWarning('Continuing deployment despite test failures (--force used)');
  }
}

// Build application
async function buildApplication(options) {
  if (options.skipBuild) {
    logStep(5, 10, 'Skipping Build');
    logWarning('Build skipped as requested');
    return;
  }

  logStep(5, 10, 'Building Application');

  if (options.dryRun) {
    logInfo('Would build application');
    return;
  }

  try {
    // Check if there's a build script
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (packageJson.scripts && packageJson.scripts.build) {
      logInfo('Running build script...');
      await runCommand('npm', ['run', 'build']);
      logSuccess('Application built successfully');
    } else {
      logInfo('No build script found, skipping build step');
    }
  } catch (error) {
    logError('Build failed');
    throw error;
  }
}

// Create backup
async function createBackup(options) {
  if (options.skipBackup) {
    logStep(6, 10, 'Skipping Backup');
    logWarning('Backup skipped as requested');
    return;
  }

  logStep(6, 10, 'Creating Backup');

  if (options.dryRun) {
    logInfo('Would create backup of current deployment');
    return;
  }

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `backups/backup-${timestamp}`;
    
    // Create backup directory
    if (!fs.existsSync('backups')) {
      fs.mkdirSync('backups', { recursive: true });
    }

    // For Docker deployments, backup docker-compose and env files
    if (options.target === 'docker') {
      logInfo('Creating Docker deployment backup...');
      fs.mkdirSync(backupDir, { recursive: true });
      
      if (fs.existsSync('docker-compose.yml')) {
        fs.copyFileSync('docker-compose.yml', `${backupDir}/docker-compose.yml`);
      }
      if (fs.existsSync('.env')) {
        fs.copyFileSync('.env', `${backupDir}/.env`);
      }
    }

    logSuccess(`Backup created at: ${backupDir}`);
  } catch (error) {
    logWarning(`Backup creation failed: ${error.message}`);
    if (!options.force) {
      throw error;
    }
  }
}

// Deploy with Docker
async function deployDocker(options) {
  logStep(7, 10, 'Deploying with Docker');

  if (options.dryRun) {
    logInfo('Would build and deploy Docker containers');
    return;
  }

  try {
    logInfo('Building Docker images...');
    await runCommand('docker-compose', ['build', '--no-cache']);
    logSuccess('Docker images built');

    logInfo('Stopping existing containers...');
    await runCommand('docker-compose', ['down']);
    logSuccess('Existing containers stopped');

    logInfo('Starting new containers...');
    await runCommand('docker-compose', ['up', '-d']);
    logSuccess('New containers started');

    // Wait for health checks
    logInfo('Waiting for services to be healthy...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Check container status
    const { stdout } = await runCommand('docker-compose', ['ps'], { silent: true });
    logInfo('Container status:');
    console.log(stdout);

  } catch (error) {
    logError('Docker deployment failed');
    throw error;
  }
}

// Deploy with PM2
async function deployPM2(options) {
  logStep(7, 10, 'Deploying with PM2');

  if (options.dryRun) {
    logInfo('Would deploy application with PM2');
    return;
  }

  try {
    // Check if ecosystem file exists
    const ecosystemFile = fs.existsSync('ecosystem.config.js') ? 'ecosystem.config.js' : null;
    
    if (ecosystemFile) {
      logInfo('Using PM2 ecosystem file...');
      await runCommand('pm2', ['reload', ecosystemFile, '--env', options.environment]);
    } else {
      logInfo('Starting application with PM2...');
      await runCommand('pm2', ['restart', 'geeksuitepro', '--update-env']);
    }

    logSuccess('Application deployed with PM2');

    // Show PM2 status
    const { stdout } = await runCommand('pm2', ['status'], { silent: true });
    logInfo('PM2 status:');
    console.log(stdout);

  } catch (error) {
    logError('PM2 deployment failed');
    throw error;
  }
}

// Deploy application
async function deployApplication(options) {
  switch (options.target) {
    case 'docker':
      await deployDocker(options);
      break;
    case 'pm2':
      await deployPM2(options);
      break;
    case 'heroku':
      logStep(7, 10, 'Deploying to Heroku');
      if (options.dryRun) {
        logInfo('Would deploy to Heroku');
      } else {
        await runCommand('git', ['push', 'heroku', options.branch]);
        logSuccess('Deployed to Heroku');
      }
      break;
    case 'aws':
      logStep(7, 10, 'Deploying to AWS');
      logWarning('AWS deployment not implemented yet');
      break;
    default:
      throw new Error(`Unknown deployment target: ${options.target}`);
  }
}

// Run health checks
async function runHealthChecks(options) {
  logStep(8, 10, 'Running Health Checks');

  if (options.dryRun) {
    logInfo('Would run health checks');
    return;
  }

  try {
    // Wait a bit for services to start
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check application health endpoint
    const healthUrl = options.environment === 'production' 
      ? 'http://localhost:5000/health'
      : 'http://localhost:5000/health';

    logInfo(`Checking health endpoint: ${healthUrl}`);
    
    // Use curl to check health endpoint
    try {
      const { stdout } = await runCommand('curl', ['-f', '-s', healthUrl], { silent: true });
      const healthData = JSON.parse(stdout);
      
      if (healthData.status === 'healthy') {
        logSuccess('Application health check passed');
      } else {
        throw new Error(`Health check failed: ${healthData.message}`);
      }
    } catch (error) {
      logWarning('Health check endpoint not accessible yet');
      if (!options.force) {
        throw new Error('Health checks failed');
      }
    }

  } catch (error) {
    logError(`Health checks failed: ${error.message}`);
    if (!options.force) {
      throw error;
    }
    logWarning('Continuing despite health check failures (--force used)');
  }
}

// Update deployment status
async function updateDeploymentStatus(options) {
  logStep(9, 10, 'Updating Deployment Status');

  if (options.dryRun) {
    logInfo('Would update deployment status');
    return;
  }

  try {
    const deploymentInfo = {
      timestamp: new Date().toISOString(),
      environment: options.environment,
      target: options.target,
      branch: options.branch,
      version: process.env.npm_package_version || '1.0.0',
      deployedBy: process.env.USER || process.env.USERNAME || 'unknown'
    };

    // Save deployment info
    const deploymentFile = 'deployment-info.json';
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    logSuccess(`Deployment info saved to ${deploymentFile}`);

    // Tag the deployment in git
    const tag = `deploy-${options.environment}-${Date.now()}`;
    await runCommand('git', ['tag', tag]);
    logSuccess(`Git tag created: ${tag}`);

  } catch (error) {
    logWarning(`Failed to update deployment status: ${error.message}`);
  }
}

// Cleanup
async function cleanup(options) {
  logStep(10, 10, 'Cleanup');

  if (options.dryRun) {
    logInfo('Would perform cleanup tasks');
    return;
  }

  try {
    // Clean up old Docker images if using Docker
    if (options.target === 'docker') {
      logInfo('Cleaning up old Docker images...');
      await runCommand('docker', ['image', 'prune', '-f'], { silent: true });
      logSuccess('Old Docker images cleaned up');
    }

    // Clean up old backups (keep last 5)
    if (fs.existsSync('backups')) {
      const backups = fs.readdirSync('backups')
        .filter(dir => dir.startsWith('backup-'))
        .sort()
        .reverse();
      
      if (backups.length > 5) {
        const toDelete = backups.slice(5);
        toDelete.forEach(backup => {
          fs.rmSync(`backups/${backup}`, { recursive: true, force: true });
        });
        logSuccess(`Cleaned up ${toDelete.length} old backups`);
      }
    }

  } catch (error) {
    logWarning(`Cleanup failed: ${error.message}`);
  }
}

// Main deployment function
async function main() {
  const startTime = Date.now();
  
  try {
    const options = parseArgs();
    
    logHeader(`GeekSuitePro Deployment - ${options.environment.toUpperCase()}`);
    
    if (options.dryRun) {
      logWarning('DRY RUN MODE - No actual changes will be made');
    }
    
    logInfo(`Target: ${options.target}`);
    logInfo(`Environment: ${options.environment}`);
    logInfo(`Branch: ${options.branch}`);
    
    // Run deployment steps
    await checkPrerequisites(options);
    await checkGitStatus(options);
    await installDependencies(options);
    await runTests(options);
    await buildApplication(options);
    await createBackup(options);
    await deployApplication(options);
    await runHealthChecks(options);
    await updateDeploymentStatus(options);
    await cleanup(options);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    logHeader('Deployment Completed Successfully!');
    logSuccess(`Total deployment time: ${duration} seconds`);
    logSuccess(`Application deployed to ${options.environment} environment using ${options.target}`);
    
    if (options.target === 'docker') {
      logInfo('Access your application at: http://localhost (or your configured domain)');
    }
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    logHeader('Deployment Failed!');
    logError(`Error: ${error.message}`);
    logError(`Deployment failed after ${duration} seconds`);
    
    if (!options.force) {
      logInfo('Use --force to override certain checks and continue deployment');
    }
    
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('\nDeployment interrupted by user', 'yellow');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('\nDeployment terminated', 'yellow');
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  runCommand,
  parseArgs,
  checkPrerequisites,
  deployDocker,
  deployPM2
};