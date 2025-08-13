#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');

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

// Test utilities class
class TestUtils {
  constructor() {
    this.projectRoot = process.cwd();
    this.testDir = path.join(this.projectRoot, 'tests');
    this.fixturesDir = path.join(this.testDir, 'fixtures');
    this.outputDir = path.join(this.projectRoot, 'test-results');
  }

  // Initialize test environment
  async initialize() {
    logHeader('Initializing Test Environment');
    
    // Create test directories
    this.createTestDirectories();
    
    // Setup test database
    await this.setupTestDatabase();
    
    // Create test fixtures
    this.createTestFixtures();
    
    // Setup test configuration
    this.setupTestConfiguration();
    
    logSuccess('Test environment initialized');
  }

  // Create test directory structure
  createTestDirectories() {
    const directories = [
      this.testDir,
      path.join(this.testDir, 'unit'),
      path.join(this.testDir, 'integration'),
      path.join(this.testDir, 'e2e'),
      path.join(this.testDir, 'api'),
      path.join(this.testDir, 'performance'),
      path.join(this.testDir, 'security'),
      this.fixturesDir,
      path.join(this.fixturesDir, 'data'),
      path.join(this.fixturesDir, 'files'),
      path.join(this.fixturesDir, 'uploads'),
      this.outputDir
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logInfo(`Created directory: ${path.relative(this.projectRoot, dir)}`);
      }
    });
  }

  // Setup test database
  async setupTestDatabase() {
    logInfo('Setting up test database...');
    
    try {
      const mongoose = require('mongoose');
      const testDbUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/geeksuitepro_test';
      
      // Connect to test database
      await mongoose.connect(testDbUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      
      // Clear existing test data
      const collections = await mongoose.connection.db.listCollections().toArray();
      for (const collection of collections) {
        await mongoose.connection.db.collection(collection.name).deleteMany({});
      }
      
      logSuccess('Test database setup complete');
      await mongoose.disconnect();
    } catch (error) {
      logWarning('Could not setup test database. Using in-memory database.');
    }
  }

  // Create test fixtures
  createTestFixtures() {
    logInfo('Creating test fixtures...');
    
    // Sample user data
    const sampleUsers = [
      {
        _id: '507f1f77bcf86cd799439011',
        email: 'admin@test.com',
        password: '$2b$10$hash', // bcrypt hash for 'password123'
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z')
      },
      {
        _id: '507f1f77bcf86cd799439012',
        email: 'user@test.com',
        password: '$2b$10$hash',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
        createdAt: new Date('2024-01-02T00:00:00.000Z')
      }
    ];

    // Sample contact data
    const sampleContacts = [
      {
        _id: '507f1f77bcf86cd799439013',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        tags: ['lead', 'interested'],
        source: 'website',
        createdAt: new Date('2024-01-01T00:00:00.000Z')
      },
      {
        _id: '507f1f77bcf86cd799439014',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+1234567891',
        tags: ['customer'],
        source: 'referral',
        createdAt: new Date('2024-01-02T00:00:00.000Z')
      }
    ];

    // Sample campaign data
    const sampleCampaigns = [
      {
        _id: '507f1f77bcf86cd799439015',
        name: 'Test Campaign',
        type: 'email',
        status: 'active',
        subject: 'Test Email Subject',
        content: 'Test email content',
        targetAudience: ['507f1f77bcf86cd799439013'],
        createdAt: new Date('2024-01-01T00:00:00.000Z')
      }
    ];

    // Write fixture files
    const fixtures = {
      'users.json': sampleUsers,
      'contacts.json': sampleContacts,
      'campaigns.json': sampleCampaigns
    };

    Object.entries(fixtures).forEach(([filename, data]) => {
      const filePath = path.join(this.fixturesDir, 'data', filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      logInfo(`Created fixture: ${filename}`);
    });

    // Create .gitkeep files
    const gitkeepDirs = [
      path.join(this.fixturesDir, 'files'),
      path.join(this.fixturesDir, 'uploads')
    ];

    gitkeepDirs.forEach(dir => {
      const gitkeepPath = path.join(dir, '.gitkeep');
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '');
      }
    });
  }

  // Setup test configuration
  setupTestConfiguration() {
    logInfo('Setting up test configuration...');
    
    // Create test helper file
    const testHelperContent = `// Test helper utilities
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

class TestHelper {
  constructor() {
    this.mongoServer = null;
  }

  // Setup in-memory MongoDB for testing
  async setupDatabase() {
    this.mongoServer = await MongoMemoryServer.create();
    const mongoUri = this.mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }

  // Cleanup database
  async cleanupDatabase() {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    if (this.mongoServer) {
      await this.mongoServer.stop();
    }
  }

  // Clear all collections
  async clearDatabase() {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }

  // Load fixtures
  async loadFixtures(fixtureName) {
    const fixturePath = require('path').join(__dirname, 'fixtures', 'data', \`\${fixtureName}.json\`);
    const fixtureData = require(fixturePath);
    
    // Determine collection name from fixture name
    const collectionName = fixtureName;
    const Model = mongoose.model(collectionName.charAt(0).toUpperCase() + collectionName.slice(1, -1));
    
    await Model.insertMany(fixtureData);
    return fixtureData;
  }

  // Create test user
  async createTestUser(userData = {}) {
    const User = mongoose.model('User');
    const defaultUser = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isActive: true
    };
    
    const user = new User({ ...defaultUser, ...userData });
    await user.save();
    return user;
  }

  // Generate JWT token for testing
  generateTestToken(userId) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  }

  // Mock external API responses
  mockExternalAPIs() {
    // Mock email service
    jest.mock('../services/emailService', () => ({
      sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      sendBulkEmail: jest.fn().mockResolvedValue({ sent: 10, failed: 0 })
    }));

    // Mock SMS service
    jest.mock('../services/smsService', () => ({
      sendSMS: jest.fn().mockResolvedValue({ sid: 'test-sms-id' })
    }));

    // Mock payment service
    jest.mock('../services/paymentService', () => ({
      createPayment: jest.fn().mockResolvedValue({ id: 'test-payment-id', status: 'succeeded' }),
      refundPayment: jest.fn().mockResolvedValue({ id: 'test-refund-id', status: 'succeeded' })
    }));
  }

  // Wait for async operations
  async waitFor(condition, timeout = 5000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for condition');
  }
}

module.exports = TestHelper;
`;

    const testHelperPath = path.join(this.testDir, 'testHelper.js');
    fs.writeFileSync(testHelperPath, testHelperContent);
    logInfo('Created test helper file');

    // Create Jest setup file
    const jestSetupContent = `// Jest setup file
const TestHelper = require('./testHelper');

// Global test helper instance
global.testHelper = new TestHelper();

// Setup before all tests
beforeAll(async () => {
  // Setup test database
  if (!process.env.USE_REAL_DB) {
    await global.testHelper.setupDatabase();
  }
  
  // Mock external APIs
  global.testHelper.mockExternalAPIs();
});

// Cleanup after all tests
afterAll(async () => {
  await global.testHelper.cleanupDatabase();
});

// Clear database before each test
beforeEach(async () => {
  if (global.testHelper.mongoServer) {
    await global.testHelper.clearDatabase();
  }
});

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console.log in tests unless verbose
if (!process.env.VERBOSE_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: console.warn,
    error: console.error
  };
}
`;

    const jestSetupPath = path.join(this.testDir, 'setup.js');
    fs.writeFileSync(jestSetupPath, jestSetupContent);
    logInfo('Created Jest setup file');
  }

  // Generate sample test files
  generateSampleTests() {
    logHeader('Generating Sample Test Files');
    
    // Unit test example
    const unitTestContent = `const { validateEmail, generateSlug } = require('../../utils/helpers');

describe('Helper Functions', () => {
  describe('validateEmail', () => {
    test('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
    });
  });

  describe('generateSlug', () => {
    test('should generate URL-friendly slugs', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('Test & Example')).toBe('test-example');
      expect(generateSlug('  Multiple   Spaces  ')).toBe('multiple-spaces');
    });

    test('should handle special characters', () => {
      expect(generateSlug('Café & Restaurant')).toBe('cafe-restaurant');
      expect(generateSlug('100% Success!')).toBe('100-success');
    });
  });
});
`;

    // Integration test example
    const integrationTestContent = `const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');

describe('User API Integration Tests', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    // Create test user
    testUser = await global.testHelper.createTestUser({
      email: 'test@example.com',
      role: 'admin'
    });
    
    // Generate auth token
    authToken = global.testHelper.generateTestToken(testUser._id);
  });

  describe('POST /api/users', () => {
    test('should create a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', \`Bearer \${authToken}\`)
        .send(userData)
        .expect(201);

      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.password).toBeUndefined();
    });

    test('should reject duplicate email', async () => {
      const userData = {
        email: testUser.email,
        password: 'password123',
        firstName: 'Duplicate',
        lastName: 'User'
      };

      await request(app)
        .post('/api/users')
        .set('Authorization', \`Bearer \${authToken}\`)
        .send(userData)
        .expect(400);
    });
  });

  describe('GET /api/users', () => {
    test('should return list of users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', \`Bearer \${authToken}\`)
        .expect(200);

      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/users')
        .expect(401);
    });
  });
});
`;

    // E2E test example
    const e2eTestContent = `const puppeteer = require('puppeteer');

describe('E2E Tests', () => {
  let browser;
  let page;
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Login Flow', () => {
    test('should login with valid credentials', async () => {
      await page.goto(\`\${baseUrl}/login\`);
      
      await page.type('#email', 'admin@test.com');
      await page.type('#password', 'password123');
      await page.click('button[type="submit"]');
      
      await page.waitForNavigation();
      
      const url = page.url();
      expect(url).toContain('/dashboard');
    });

    test('should show error for invalid credentials', async () => {
      await page.goto(\`\${baseUrl}/login\`);
      
      await page.type('#email', 'invalid@test.com');
      await page.type('#password', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      const errorMessage = await page.waitForSelector('.error-message');
      expect(errorMessage).toBeTruthy();
    });
  });

  describe('Dashboard', () => {
    beforeEach(async () => {
      // Login before each dashboard test
      await page.goto(\`\${baseUrl}/login\`);
      await page.type('#email', 'admin@test.com');
      await page.type('#password', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    });

    test('should display dashboard metrics', async () => {
      const metricsCards = await page.$$('.metric-card');
      expect(metricsCards.length).toBeGreaterThan(0);
    });

    test('should navigate to contacts page', async () => {
      await page.click('a[href="/contacts"]');
      await page.waitForNavigation();
      
      const url = page.url();
      expect(url).toContain('/contacts');
    });
  });
});
`;

    // Write sample test files
    const testFiles = {
      'unit/helpers.test.js': unitTestContent,
      'integration/users.test.js': integrationTestContent,
      'e2e/login.test.js': e2eTestContent
    };

    Object.entries(testFiles).forEach(([filePath, content]) => {
      const fullPath = path.join(this.testDir, filePath);
      const dir = path.dirname(fullPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, content);
      logInfo(`Created sample test: ${filePath}`);
    });
  }

  // Run test quality checks
  async runTestQualityChecks() {
    logHeader('Running Test Quality Checks');
    
    const checks = [
      this.checkTestCoverage.bind(this),
      this.checkTestNaming.bind(this),
      this.checkTestStructure.bind(this),
      this.checkTestDependencies.bind(this)
    ];

    for (const check of checks) {
      await check();
    }
  }

  // Check test coverage
  async checkTestCoverage() {
    logInfo('Checking test coverage...');
    
    try {
      const coverageDir = path.join(this.projectRoot, 'coverage');
      if (fs.existsSync(coverageDir)) {
        const coverageFile = path.join(coverageDir, 'coverage-summary.json');
        if (fs.existsSync(coverageFile)) {
          const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
          const totalCoverage = coverage.total;
          
          logInfo(`Lines: ${totalCoverage.lines.pct}%`);
          logInfo(`Functions: ${totalCoverage.functions.pct}%`);
          logInfo(`Branches: ${totalCoverage.branches.pct}%`);
          logInfo(`Statements: ${totalCoverage.statements.pct}%`);
          
          if (totalCoverage.lines.pct < 70) {
            logWarning('Line coverage is below 70%');
          } else {
            logSuccess('Test coverage looks good');
          }
        }
      } else {
        logWarning('No coverage report found. Run tests with --coverage flag.');
      }
    } catch (error) {
      logWarning('Could not check test coverage');
    }
  }

  // Check test naming conventions
  checkTestNaming() {
    logInfo('Checking test naming conventions...');
    
    const testFiles = this.findTestFiles();
    let issues = 0;

    testFiles.forEach(file => {
      const fileName = path.basename(file);
      
      // Check file naming
      if (!fileName.match(/\.(test|spec)\.js$/)) {
        logWarning(`Test file should end with .test.js or .spec.js: ${fileName}`);
        issues++;
      }
      
      // Check describe blocks
      const content = fs.readFileSync(file, 'utf8');
      const describeMatches = content.match(/describe\s*\(\s*['"`]([^'"\`]+)['"`]/g);
      
      if (describeMatches) {
        describeMatches.forEach(match => {
          const description = match.match(/['"`]([^'"\`]+)['"`]/)[1];
          if (!description || description.length < 3) {
            logWarning(`Describe block should have meaningful description: ${fileName}`);
            issues++;
          }
        });
      }
    });

    if (issues === 0) {
      logSuccess('Test naming conventions look good');
    } else {
      logWarning(`Found ${issues} naming convention issues`);
    }
  }

  // Check test structure
  checkTestStructure() {
    logInfo('Checking test structure...');
    
    const testFiles = this.findTestFiles();
    let issues = 0;

    testFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const fileName = path.basename(file);
      
      // Check for describe blocks
      if (!content.includes('describe(')) {
        logWarning(`Test file should have describe blocks: ${fileName}`);
        issues++;
      }
      
      // Check for test blocks
      if (!content.includes('test(') && !content.includes('it(')) {
        logWarning(`Test file should have test/it blocks: ${fileName}`);
        issues++;
      }
      
      // Check for assertions
      if (!content.includes('expect(')) {
        logWarning(`Test file should have assertions: ${fileName}`);
        issues++;
      }
    });

    if (issues === 0) {
      logSuccess('Test structure looks good');
    } else {
      logWarning(`Found ${issues} test structure issues`);
    }
  }

  // Check test dependencies
  checkTestDependencies() {
    logInfo('Checking test dependencies...');
    
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      logWarning('package.json not found');
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const devDeps = packageJson.devDependencies || {};
    
    const requiredDeps = {
      'jest': 'Testing framework',
      'supertest': 'HTTP testing',
      '@types/jest': 'Jest TypeScript support'
    };

    const optionalDeps = {
      'puppeteer': 'E2E testing',
      'mongodb-memory-server': 'In-memory MongoDB',
      'jest-html-reporters': 'HTML test reports',
      'jest-junit': 'JUnit test reports'
    };

    let missing = 0;
    
    Object.entries(requiredDeps).forEach(([dep, description]) => {
      if (!devDeps[dep]) {
        logWarning(`Missing required dependency: ${dep} (${description})`);
        missing++;
      }
    });

    Object.entries(optionalDeps).forEach(([dep, description]) => {
      if (!devDeps[dep]) {
        logInfo(`Optional dependency not installed: ${dep} (${description})`);
      }
    });

    if (missing === 0) {
      logSuccess('All required test dependencies are installed');
    }
  }

  // Find all test files
  findTestFiles() {
    const testFiles = [];
    
    const searchDirs = [
      this.testDir,
      path.join(this.projectRoot, '__tests__')
    ];

    searchDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.findTestFilesRecursive(dir, testFiles);
      }
    });

    return testFiles;
  }

  // Recursively find test files
  findTestFilesRecursive(dir, testFiles) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        this.findTestFilesRecursive(filePath, testFiles);
      } else if (file.match(/\.(test|spec)\.js$/)) {
        testFiles.push(filePath);
      }
    });
  }

  // Generate test report
  generateTestReport() {
    logHeader('Generating Test Report');
    
    const testFiles = this.findTestFiles();
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTestFiles: testFiles.length,
        testsByType: {
          unit: testFiles.filter(f => f.includes('/unit/')).length,
          integration: testFiles.filter(f => f.includes('/integration/')).length,
          e2e: testFiles.filter(f => f.includes('/e2e/')).length,
          api: testFiles.filter(f => f.includes('/api/')).length,
          performance: testFiles.filter(f => f.includes('/performance/')).length,
          security: testFiles.filter(f => f.includes('/security/')).length
        }
      },
      files: testFiles.map(file => ({
        path: path.relative(this.projectRoot, file),
        size: fs.statSync(file).size,
        modified: fs.statSync(file).mtime
      }))
    };

    const reportPath = path.join(this.outputDir, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    logInfo(`Test files by type:`);
    Object.entries(report.summary.testsByType).forEach(([type, count]) => {
      logInfo(`  ${type}: ${count} files`);
    });
    
    logSuccess(`Test report saved to: ${reportPath}`);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    action: 'help',
    generateSamples: false,
    runChecks: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case 'init':
      case 'initialize':
        options.action = 'init';
        break;
      case 'samples':
      case 'generate-samples':
        options.action = 'samples';
        break;
      case 'check':
      case 'quality-check':
        options.action = 'check';
        break;
      case 'report':
        options.action = 'report';
        break;
      case '--generate-samples':
        options.generateSamples = true;
        break;
      case '--run-checks':
        options.runChecks = true;
        break;
      case '--help':
      case '-h':
        options.action = 'help';
        break;
    }
  }

  return options;
}

// Show help
function showHelp() {
  logHeader('GeekSuitePro Test Utilities');
  log('Usage: node scripts/test-utils.js <action> [options]\n');
  log('Actions:');
  log('  init                        Initialize test environment');
  log('  samples                     Generate sample test files');
  log('  check                       Run test quality checks');
  log('  report                      Generate test report\n');
  log('Options:');
  log('  --generate-samples          Generate sample tests during init');
  log('  --run-checks                Run quality checks during init');
  log('  -h, --help                  Show this help message\n');
  log('Examples:');
  log('  node scripts/test-utils.js init                    # Initialize test environment');
  log('  node scripts/test-utils.js init --generate-samples # Init with sample tests');
  log('  node scripts/test-utils.js check                   # Run quality checks');
  log('  node scripts/test-utils.js report                  # Generate test report');
}

// Main function
async function main() {
  const options = parseArgs();
  const utils = new TestUtils();

  try {
    switch (options.action) {
      case 'init':
        await utils.initialize();
        if (options.generateSamples) {
          utils.generateSampleTests();
        }
        if (options.runChecks) {
          await utils.runTestQualityChecks();
        }
        break;
        
      case 'samples':
        utils.generateSampleTests();
        break;
        
      case 'check':
        await utils.runTestQualityChecks();
        break;
        
      case 'report':
        utils.generateTestReport();
        break;
        
      default:
        showHelp();
        break;
    }
  } catch (error) {
    logError(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  TestUtils,
  parseArgs
};