#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
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

// Documentation generator class
class DocumentationGenerator {
  constructor(options = {}) {
    this.options = {
      outputDir: './docs',
      includeAPI: true,
      includeDatabase: true,
      includeDeployment: true,
      includeTesting: true,
      includeArchitecture: true,
      format: 'markdown', // markdown, html, pdf
      generateTOC: true,
      includeCodeExamples: true,
      ...options
    };
    
    this.projectRoot = process.cwd();
    this.docsDir = path.resolve(this.options.outputDir);
    this.packageJson = this.loadPackageJson();
    this.projectInfo = this.extractProjectInfo();
  }

  // Load package.json
  loadPackageJson() {
    const packagePath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packagePath)) {
      return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    }
    return {};
  }

  // Extract project information
  extractProjectInfo() {
    return {
      name: this.packageJson.name || 'GeekSuitePro',
      version: this.packageJson.version || '1.0.0',
      description: this.packageJson.description || 'A comprehensive CRM and marketing automation platform',
      author: this.packageJson.author || 'GeekSuitePro Team',
      license: this.packageJson.license || 'MIT',
      repository: this.packageJson.repository?.url || '',
      homepage: this.packageJson.homepage || '',
      keywords: this.packageJson.keywords || []
    };
  }

  // Initialize documentation structure
  async initialize() {
    logHeader('Initializing Documentation Generation');
    
    // Create docs directory
    if (!fs.existsSync(this.docsDir)) {
      fs.mkdirSync(this.docsDir, { recursive: true });
      logInfo(`Created documentation directory: ${this.docsDir}`);
    }

    // Create subdirectories
    const subdirs = ['api', 'database', 'deployment', 'testing', 'architecture', 'assets', 'examples'];
    subdirs.forEach(dir => {
      const dirPath = path.join(this.docsDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logInfo(`Created directory: ${dir}`);
      }
    });

    logSuccess('Documentation structure initialized');
  }

  // Generate main README
  generateMainReadme() {
    logInfo('Generating main README...');
    
    const content = `# ${this.projectInfo.name}

${this.projectInfo.description}

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Testing](#testing)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Overview

${this.projectInfo.name} is a comprehensive Customer Relationship Management (CRM) and marketing automation platform designed to help businesses manage their customer interactions, automate marketing campaigns, and drive growth.

### Key Features

- **Contact Management**: Organize and manage customer contacts with detailed profiles
- **Campaign Management**: Create and execute email and SMS marketing campaigns
- **Sales Funnels**: Build conversion-optimized sales funnels
- **Form Builder**: Create custom forms for lead generation
- **Appointment Scheduling**: Integrated calendar and booking system
- **Conversation Management**: Centralized communication hub
- **Review Management**: Monitor and respond to customer reviews
- **Website Builder**: Create landing pages and websites
- **Automation Workflows**: Automate repetitive marketing tasks
- **Pipeline Management**: Track deals through sales pipelines
- **Analytics & Reporting**: Comprehensive business insights
- **Multi-tenant Architecture**: Support for multiple organizations

## 🏃‍♂️ Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- Redis (v6 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone ${this.projectInfo.repository}
   cd ${this.projectInfo.name.toLowerCase()}
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Setup development environment**
   \`\`\`bash
   node scripts/setup-dev.js
   \`\`\`

4. **Start the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Open your browser**
   Navigate to \`http://localhost:3000\`

## ⚙️ Configuration

### Environment Variables

Copy \`.env.example\` to \`.env\` and configure the following variables:

\`\`\`env
# Application
APP_NAME=GeekSuitePro
APP_URL=http://localhost:3000
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/geeksuitepro
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-session-secret

# Email Service (choose one)
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain

# SMS Service
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token

# Payment Processing
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
\`\`\`

### Database Setup

1. **Start MongoDB**
   \`\`\`bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or using local installation
   mongod
   \`\`\`

2. **Run database migrations**
   \`\`\`bash
   node scripts/migrate.js up
   \`\`\`

3. **Seed sample data** (optional)
   \`\`\`bash
   node scripts/create-sample-data.js
   \`\`\`

## 📚 Documentation

- [API Documentation](./docs/api/README.md) - Complete API reference
- [Database Schema](./docs/database/README.md) - Database structure and relationships
- [Deployment Guide](./docs/deployment/README.md) - Production deployment instructions
- [Testing Guide](./docs/testing/README.md) - Testing strategies and examples
- [Architecture Overview](./docs/architecture/README.md) - System architecture and design patterns

## 🧪 Testing

### Run Tests

\`\`\`bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test types
node scripts/test.js unit
node scripts/test.js integration
node scripts/test.js e2e
\`\`\`

### Test Structure

\`\`\`
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
├── api/           # API tests
├── performance/   # Performance tests
└── fixtures/      # Test data
\`\`\`

## 🚀 Deployment

### Production Deployment

1. **Using Docker**
   \`\`\`bash
   docker-compose up -d
   \`\`\`

2. **Using PM2**
   \`\`\`bash
   node scripts/deploy.js --target=pm2 --env=production
   \`\`\`

3. **Using Heroku**
   \`\`\`bash
   node scripts/deploy.js --target=heroku --env=production
   \`\`\`

### Environment-specific Deployments

- **Development**: \`npm run dev\`
- **Staging**: \`node scripts/deploy.js --env=staging\`
- **Production**: \`node scripts/deploy.js --env=production\`

## 🏗️ Architecture

### Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Authentication**: JWT with bcrypt
- **File Storage**: Local filesystem / AWS S3 / Cloudinary
- **Email**: Mailgun / SendGrid / SMTP
- **SMS**: Twilio
- **Payments**: Stripe
- **Testing**: Jest, Supertest, Puppeteer
- **Deployment**: Docker, PM2, Heroku

### Project Structure

\`\`\`
${this.projectInfo.name.toLowerCase()}/
├── app.js                 # Application entry point
├── routes/               # API routes
├── models/               # Database models
├── middleware/           # Custom middleware
├── services/             # Business logic services
├── utils/                # Utility functions
├── config/               # Configuration files
├── public/               # Static assets
├── views/                # Template files
├── tests/                # Test files
├── scripts/              # Utility scripts
├── docs/                 # Documentation
└── docker-compose.yml    # Docker configuration
\`\`\`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: \`git checkout -b feature/amazing-feature\`
3. Commit your changes: \`git commit -m 'Add amazing feature'\`
4. Push to the branch: \`git push origin feature/amazing-feature\`
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Use meaningful commit messages
- Keep pull requests focused and small

### Code Style

- Use ESLint and Prettier for code formatting
- Follow JavaScript Standard Style
- Use meaningful variable and function names
- Add JSDoc comments for functions and classes

## 📄 License

This project is licensed under the ${this.projectInfo.license} License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](${this.projectInfo.repository}/issues)
- **Discussions**: [GitHub Discussions](${this.projectInfo.repository}/discussions)

## 🙏 Acknowledgments

- Thanks to all contributors who have helped build this project
- Inspired by modern CRM and marketing automation platforms
- Built with love by the GeekSuitePro team

---

**Version**: ${this.projectInfo.version}  
**Last Updated**: ${new Date().toISOString().split('T')[0]}
`;

    const readmePath = path.join(this.projectRoot, 'README.md');
    fs.writeFileSync(readmePath, content);
    logSuccess('Generated main README.md');
  }

  // Generate API documentation
  async generateAPIDocumentation() {
    if (!this.options.includeAPI) return;
    
    logInfo('Generating API documentation...');
    
    // Scan routes directory
    const routesDir = path.join(this.projectRoot, 'routes');
    const apiEndpoints = await this.scanAPIEndpoints(routesDir);
    
    const content = `# API Documentation

## Overview

This document provides comprehensive information about the ${this.projectInfo.name} REST API.

## Base URL

\`\`\`
Development: http://localhost:3000/api
Production: https://your-domain.com/api
\`\`\`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

### Getting a Token

\`\`\`http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
\`\`\`

## Response Format

All API responses follow a consistent format:

### Success Response
\`\`\`json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully"
}
\`\`\`

### Error Response
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  }
}
\`\`\`

## HTTP Status Codes

- \`200\` - OK: Request successful
- \`201\` - Created: Resource created successfully
- \`400\` - Bad Request: Invalid request data
- \`401\` - Unauthorized: Authentication required
- \`403\` - Forbidden: Insufficient permissions
- \`404\` - Not Found: Resource not found
- \`422\` - Unprocessable Entity: Validation errors
- \`500\` - Internal Server Error: Server error

## Rate Limiting

API requests are rate limited to prevent abuse:

- **Authenticated users**: 1000 requests per hour
- **Unauthenticated users**: 100 requests per hour

Rate limit headers are included in responses:
\`\`\`
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
\`\`\`

## Pagination

List endpoints support pagination using query parameters:

\`\`\`
GET /api/contacts?page=1&limit=20&sort=createdAt&order=desc
\`\`\`

**Parameters:**
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 20, max: 100)
- \`sort\`: Sort field (default: createdAt)
- \`order\`: Sort order (asc/desc, default: desc)

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
\`\`\`

## API Endpoints

${this.generateEndpointsDocumentation(apiEndpoints)}

## Error Codes

| Code | Description |
|------|-------------|
| \`AUTH_REQUIRED\` | Authentication is required |
| \`INVALID_TOKEN\` | JWT token is invalid or expired |
| \`INSUFFICIENT_PERMISSIONS\` | User lacks required permissions |
| \`VALIDATION_ERROR\` | Request data validation failed |
| \`RESOURCE_NOT_FOUND\` | Requested resource not found |
| \`DUPLICATE_RESOURCE\` | Resource already exists |
| \`RATE_LIMIT_EXCEEDED\` | Too many requests |
| \`INTERNAL_ERROR\` | Internal server error |

## SDKs and Libraries

### JavaScript/Node.js
\`\`\`javascript
const GeekSuiteAPI = require('geeksuite-api-client');

const client = new GeekSuiteAPI({
  baseURL: 'https://api.geeksuitepro.com',
  apiKey: 'your-api-key'
});

// Get contacts
const contacts = await client.contacts.list();

// Create contact
const contact = await client.contacts.create({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com'
});
\`\`\`

### Python
\`\`\`python
from geeksuite import GeekSuiteAPI

client = GeekSuiteAPI(
    base_url='https://api.geeksuitepro.com',
    api_key='your-api-key'
)

# Get contacts
contacts = client.contacts.list()

# Create contact
contact = client.contacts.create({
    'firstName': 'John',
    'lastName': 'Doe',
    'email': 'john@example.com'
})
\`\`\`

## Webhooks

Webhooks allow you to receive real-time notifications when events occur in your account.

### Supported Events

- \`contact.created\`
- \`contact.updated\`
- \`contact.deleted\`
- \`campaign.sent\`
- \`email.opened\`
- \`email.clicked\`
- \`form.submitted\`
- \`appointment.booked\`

### Webhook Payload
\`\`\`json
{
  "event": "contact.created",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  }
}
\`\`\`

### Webhook Security

Webhooks are signed using HMAC-SHA256. Verify the signature using the \`X-GeekSuite-Signature\` header.

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
`;

    const apiDocPath = path.join(this.docsDir, 'api', 'README.md');
    fs.writeFileSync(apiDocPath, content);
    logSuccess('Generated API documentation');
  }

  // Scan API endpoints from routes
  async scanAPIEndpoints(routesDir) {
    const endpoints = [];
    
    if (!fs.existsSync(routesDir)) {
      return endpoints;
    }

    const files = fs.readdirSync(routesDir);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = path.join(routesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract route definitions (basic parsing)
        const routeMatches = content.match(/router\.(get|post|put|patch|delete)\s*\(['"`]([^'"\`]+)['"`]/g);
        
        if (routeMatches) {
          routeMatches.forEach(match => {
            const [, method, path] = match.match(/router\.(\w+)\s*\(['"`]([^'"\`]+)['"`]/);
            const routeName = file.replace('.js', '');
            
            endpoints.push({
              method: method.toUpperCase(),
              path: `/api/${routeName}${path}`,
              file: file,
              description: this.extractRouteDescription(content, path)
            });
          });
        }
      }
    }

    return endpoints;
  }

  // Extract route description from comments
  extractRouteDescription(content, routePath) {
    const lines = content.split('\n');
    const routeIndex = lines.findIndex(line => line.includes(routePath));
    
    if (routeIndex > 0) {
      // Look for comment above the route
      for (let i = routeIndex - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('//') || line.startsWith('*')) {
          return line.replace(/^\/\/\s*|^\*\s*/, '').trim();
        }
        if (line && !line.startsWith('//') && !line.startsWith('*')) {
          break;
        }
      }
    }
    
    return 'No description available';
  }

  // Generate endpoints documentation
  generateEndpointsDocumentation(endpoints) {
    const groupedEndpoints = {};
    
    endpoints.forEach(endpoint => {
      const group = endpoint.file.replace('.js', '');
      if (!groupedEndpoints[group]) {
        groupedEndpoints[group] = [];
      }
      groupedEndpoints[group].push(endpoint);
    });

    let documentation = '';
    
    Object.entries(groupedEndpoints).forEach(([group, groupEndpoints]) => {
      documentation += `\n### ${group.charAt(0).toUpperCase() + group.slice(1)}\n\n`;
      
      groupEndpoints.forEach(endpoint => {
        documentation += `#### ${endpoint.method} ${endpoint.path}\n\n`;
        documentation += `${endpoint.description}\n\n`;
        documentation += `**Request:**\n\`\`\`http\n${endpoint.method} ${endpoint.path}\n\`\`\`\n\n`;
        documentation += `**Response:**\n\`\`\`json\n{\n  "success": true,\n  "data": {}\n}\n\`\`\`\n\n`;
      });
    });

    return documentation;
  }

  // Generate database documentation
  async generateDatabaseDocumentation() {
    if (!this.options.includeDatabase) return;
    
    logInfo('Generating database documentation...');
    
    const modelsDir = path.join(this.projectRoot, 'models');
    const schemas = await this.scanDatabaseSchemas(modelsDir);
    
    const content = `# Database Documentation

## Overview

${this.projectInfo.name} uses MongoDB as its primary database with Mongoose ODM for schema definition and validation.

## Connection

### Development
\`\`\`
mongodb://localhost:27017/geeksuitepro_dev
\`\`\`

### Test
\`\`\`
mongodb://localhost:27017/geeksuitepro_test
\`\`\`

### Production
\`\`\`
mongodb://your-mongodb-host:27017/geeksuitepro_prod
\`\`\`

## Database Schema

${this.generateSchemasDocumentation(schemas)}

## Indexes

### Performance Indexes

\`\`\`javascript
// Users collection
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ isActive: 1 });
db.users.createIndex({ createdAt: -1 });

// Contacts collection
db.contacts.createIndex({ email: 1 });
db.contacts.createIndex({ phone: 1 });
db.contacts.createIndex({ tags: 1 });
db.contacts.createIndex({ source: 1 });
db.contacts.createIndex({ createdAt: -1 });
db.contacts.createIndex({ updatedAt: -1 });

// Campaigns collection
db.campaigns.createIndex({ status: 1 });
db.campaigns.createIndex({ type: 1 });
db.campaigns.createIndex({ createdBy: 1 });
db.campaigns.createIndex({ scheduledAt: 1 });
db.campaigns.createIndex({ createdAt: -1 });
\`\`\`

### Text Search Indexes

\`\`\`javascript
// Full-text search on contacts
db.contacts.createIndex({
  firstName: "text",
  lastName: "text",
  email: "text",
  company: "text"
});

// Full-text search on campaigns
db.campaigns.createIndex({
  name: "text",
  subject: "text",
  content: "text"
});
\`\`\`

## Relationships

### Entity Relationship Diagram

\`\`\`
Users (1) -----> (N) Contacts
Users (1) -----> (N) Campaigns
Users (1) -----> (N) Funnels
Users (1) -----> (N) Forms
Users (1) -----> (N) Appointments
Users (1) -----> (N) Conversations
Users (1) -----> (N) Reviews
Users (1) -----> (N) Websites
Users (1) -----> (N) Automations
Users (1) -----> (N) Pipelines

Contacts (N) <----> (N) Campaigns (through targetAudience)
Contacts (1) -----> (N) Appointments
Contacts (1) -----> (N) Conversations
Contacts (1) -----> (N) Reviews

Funnels (1) -----> (N) Forms
Pipelines (1) -----> (N) Deals
\`\`\`

## Data Migration

### Running Migrations

\`\`\`bash
# Check migration status
node scripts/migrate.js status

# Run pending migrations
node scripts/migrate.js up

# Rollback last migration
node scripts/migrate.js down

# Create new migration
node scripts/migrate.js create add_new_field
\`\`\`

### Migration Example

\`\`\`javascript
// migrations/20240101120000_add_user_preferences.js
module.exports = {
  async up(context) {
    const { db } = context;
    
    await db.collection('users').updateMany(
      {},
      {
        $set: {
          preferences: {
            emailNotifications: true,
            smsNotifications: false,
            theme: 'light',
            language: 'en'
          }
        }
      }
    );
  },
  
  async down(context) {
    const { db } = context;
    
    await db.collection('users').updateMany(
      {},
      {
        $unset: {
          preferences: 1
        }
      }
    );
  }
};
\`\`\`

## Backup and Restore

### Creating Backups

\`\`\`bash
# Full backup
node scripts/backup.js --type=full

# Database only
node scripts/backup.js --type=database

# Automated daily backup
node scripts/backup.js --schedule
\`\`\`

### Restoring from Backup

\`\`\`bash
# Restore from backup file
mongorestore --db geeksuitepro_prod backup/database/

# Restore specific collection
mongorestore --db geeksuitepro_prod --collection users backup/database/users.bson
\`\`\`

## Performance Optimization

### Query Optimization

1. **Use appropriate indexes** for frequently queried fields
2. **Limit result sets** using pagination
3. **Project only needed fields** to reduce data transfer
4. **Use aggregation pipelines** for complex queries
5. **Monitor slow queries** using MongoDB profiler

### Example Optimized Queries

\`\`\`javascript
// Efficient contact search with pagination
const contacts = await Contact.find(
  { 
    $text: { $search: searchTerm },
    isActive: true 
  },
  { 
    firstName: 1, 
    lastName: 1, 
    email: 1, 
    phone: 1 
  }
)
.sort({ score: { $meta: 'textScore' } })
.limit(20)
.skip(page * 20);

// Aggregation for campaign analytics
const analytics = await Campaign.aggregate([
  { $match: { createdBy: userId, status: 'sent' } },
  {
    $group: {
      _id: '$type',
      totalSent: { $sum: '$stats.sent' },
      totalOpened: { $sum: '$stats.opened' },
      totalClicked: { $sum: '$stats.clicked' }
    }
  },
  {
    $project: {
      type: '$_id',
      totalSent: 1,
      totalOpened: 1,
      totalClicked: 1,
      openRate: { 
        $multiply: [
          { $divide: ['$totalOpened', '$totalSent'] }, 
          100
        ] 
      },
      clickRate: { 
        $multiply: [
          { $divide: ['$totalClicked', '$totalSent'] }, 
          100
        ] 
      }
    }
  }
]);
\`\`\`

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
`;

    const dbDocPath = path.join(this.docsDir, 'database', 'README.md');
    fs.writeFileSync(dbDocPath, content);
    logSuccess('Generated database documentation');
  }

  // Scan database schemas
  async scanDatabaseSchemas(modelsDir) {
    const schemas = [];
    
    if (!fs.existsSync(modelsDir)) {
      return schemas;
    }

    const files = fs.readdirSync(modelsDir);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = path.join(modelsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract schema definition (basic parsing)
        const schemaMatch = content.match(/new\s+mongoose\.Schema\s*\(\s*\{([^}]+)\}/s);
        
        if (schemaMatch) {
          const modelName = file.replace('.js', '');
          const schemaContent = schemaMatch[1];
          
          schemas.push({
            name: modelName,
            file: file,
            schema: this.parseSchemaFields(schemaContent)
          });
        }
      }
    }

    return schemas;
  }

  // Parse schema fields (basic implementation)
  parseSchemaFields(schemaContent) {
    const fields = [];
    const lines = schemaContent.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && trimmed.includes(':')) {
        const [fieldName] = trimmed.split(':');
        const cleanFieldName = fieldName.trim().replace(/['"`]/g, '');
        if (cleanFieldName && !cleanFieldName.includes('{')) {
          fields.push({
            name: cleanFieldName,
            definition: trimmed
          });
        }
      }
    });

    return fields;
  }

  // Generate schemas documentation
  generateSchemasDocumentation(schemas) {
    let documentation = '';
    
    schemas.forEach(schema => {
      documentation += `\n### ${schema.name}\n\n`;
      documentation += `**Collection**: \`${schema.name.toLowerCase()}s\`\n\n`;
      documentation += `**Fields**:\n\n`;
      documentation += `| Field | Type | Description |\n`;
      documentation += `|-------|------|-------------|\n`;
      
      schema.schema.forEach(field => {
        const type = this.extractFieldType(field.definition);
        documentation += `| \`${field.name}\` | ${type} | Auto-generated description |\n`;
      });
      
      documentation += `\n**Example Document**:\n\`\`\`json\n`;
      documentation += this.generateExampleDocument(schema);
      documentation += `\n\`\`\`\n\n`;
    });

    return documentation;
  }

  // Extract field type from definition
  extractFieldType(definition) {
    if (definition.includes('String')) return 'String';
    if (definition.includes('Number')) return 'Number';
    if (definition.includes('Date')) return 'Date';
    if (definition.includes('Boolean')) return 'Boolean';
    if (definition.includes('ObjectId')) return 'ObjectId';
    if (definition.includes('Array') || definition.includes('[')) return 'Array';
    if (definition.includes('Mixed')) return 'Mixed';
    return 'Unknown';
  }

  // Generate example document
  generateExampleDocument(schema) {
    const example = {};
    
    schema.schema.forEach(field => {
      const type = this.extractFieldType(field.definition);
      
      switch (type) {
        case 'String':
          example[field.name] = 'example string';
          break;
        case 'Number':
          example[field.name] = 123;
          break;
        case 'Date':
          example[field.name] = '2024-01-01T00:00:00.000Z';
          break;
        case 'Boolean':
          example[field.name] = true;
          break;
        case 'ObjectId':
          example[field.name] = '507f1f77bcf86cd799439011';
          break;
        case 'Array':
          example[field.name] = ['item1', 'item2'];
          break;
        default:
          example[field.name] = null;
      }
    });

    return JSON.stringify(example, null, 2);
  }

  // Generate deployment documentation
  generateDeploymentDocumentation() {
    if (!this.options.includeDeployment) return;
    
    logInfo('Generating deployment documentation...');
    
    const content = `# Deployment Guide

## Overview

This guide covers deploying ${this.projectInfo.name} to various environments including development, staging, and production.

## Prerequisites

### System Requirements

- **Node.js**: v16.0.0 or higher
- **MongoDB**: v4.4 or higher
- **Redis**: v6.0 or higher
- **Memory**: Minimum 2GB RAM (4GB+ recommended for production)
- **Storage**: Minimum 10GB free space
- **Network**: HTTPS support for production

### Required Services

- **Database**: MongoDB (local, MongoDB Atlas, or self-hosted)
- **Cache**: Redis (local, Redis Cloud, or self-hosted)
- **Email**: Mailgun, SendGrid, or SMTP server
- **SMS**: Twilio account (optional)
- **File Storage**: Local filesystem, AWS S3, or Cloudinary
- **Payment Processing**: Stripe account (optional)

## Environment Setup

### Development Environment

1. **Clone and Install**
   \`\`\`bash
   git clone ${this.projectInfo.repository}
   cd ${this.projectInfo.name.toLowerCase()}
   npm install
   \`\`\`

2. **Setup Environment**
   \`\`\`bash
   node scripts/setup-dev.js
   \`\`\`

3. **Start Development Server**
   \`\`\`bash
   npm run dev
   \`\`\`

### Staging Environment

1. **Server Setup**
   \`\`\`bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install nodejs npm mongodb redis-server nginx
   
   # CentOS/RHEL
   sudo yum install nodejs npm mongodb-server redis nginx
   \`\`\`

2. **Application Deployment**
   \`\`\`bash
   # Deploy to staging
   node scripts/deploy.js --env=staging --target=pm2
   \`\`\`

### Production Environment

1. **Server Preparation**
   \`\`\`bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js (using NodeSource repository)
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install MongoDB
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   
   # Install Redis
   sudo apt install redis-server
   
   # Install Nginx
   sudo apt install nginx
   
   # Install PM2 globally
   sudo npm install -g pm2
   \`\`\`

2. **Security Configuration**
   \`\`\`bash
   # Create application user
   sudo useradd -m -s /bin/bash geeksuite
   sudo usermod -aG sudo geeksuite
   
   # Setup firewall
   sudo ufw allow ssh
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   
   # Configure MongoDB security
   sudo systemctl enable mongod
   sudo systemctl start mongod
   
   # Configure Redis security
   sudo systemctl enable redis-server
   sudo systemctl start redis-server
   \`\`\`

## Deployment Methods

### Method 1: Docker Deployment

1. **Build and Run with Docker Compose**
   \`\`\`bash
   # Production deployment
   docker-compose -f docker-compose.prod.yml up -d
   
   # Or using deployment script
   node scripts/deploy.js --target=docker --env=production
   \`\`\`

2. **Docker Configuration**
   \`\`\`yaml
   # docker-compose.prod.yml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - MONGODB_URI=mongodb://mongo:27017/geeksuitepro
         - REDIS_URL=redis://redis:6379
       depends_on:
         - mongo
         - redis
     
     mongo:
       image: mongo:6.0
       volumes:
         - mongo_data:/data/db
       environment:
         - MONGO_INITDB_ROOT_USERNAME=admin
         - MONGO_INITDB_ROOT_PASSWORD=secure_password
     
     redis:
       image: redis:7-alpine
       volumes:
         - redis_data:/data
     
     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf
         - ./ssl:/etc/nginx/ssl
       depends_on:
         - app
   
   volumes:
     mongo_data:
     redis_data:
   \`\`\`

### Method 2: PM2 Deployment

1. **Deploy with PM2**
   \`\`\`bash
   # Deploy to production
   node scripts/deploy.js --target=pm2 --env=production
   
   # Or manually
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   \`\`\`

2. **PM2 Configuration**
   \`\`\`javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'geeksuitepro',
       script: './app.js',
       instances: 'max',
       exec_mode: 'cluster',
       env_production: {
         NODE_ENV: 'production',
         PORT: 3000,
         MONGODB_URI: 'mongodb://localhost:27017/geeksuitepro_prod',
         REDIS_URL: 'redis://localhost:6379'
       }
     }]
   };
   \`\`\`

### Method 3: Heroku Deployment

1. **Heroku Setup**
   \`\`\`bash
   # Install Heroku CLI
   npm install -g heroku
   
   # Login and create app
   heroku login
   heroku create your-app-name
   
   # Add MongoDB addon
   heroku addons:create mongolab:sandbox
   
   # Add Redis addon
   heroku addons:create heroku-redis:hobby-dev
   
   # Deploy
   node scripts/deploy.js --target=heroku --env=production
   \`\`\`

2. **Heroku Configuration**
   \`\`\`bash
   # Set environment variables
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your-jwt-secret
   heroku config:set SESSION_SECRET=your-session-secret
   \`\`\`

### Method 4: AWS Deployment

1. **EC2 Instance Setup**
   \`\`\`bash
   # Launch EC2 instance (Ubuntu 20.04 LTS)
   # Configure security groups (ports 22, 80, 443)
   # Connect via SSH
   
   # Install dependencies
   sudo apt update
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   \`\`\`

2. **RDS and ElastiCache Setup**
   \`\`\`bash
   # Create RDS MongoDB instance
   # Create ElastiCache Redis cluster
   # Update security groups for database access
   \`\`\`

3. **Application Deployment**
   \`\`\`bash
   # Deploy application
   node scripts/deploy.js --target=aws --env=production
   \`\`\`

## Nginx Configuration

### Basic Configuration

\`\`\`nginx
# /etc/nginx/sites-available/geeksuitepro
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /static/ {
        alias /var/www/geeksuitepro/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
\`\`\`

### Enable Configuration

\`\`\`bash
sudo ln -s /etc/nginx/sites-available/geeksuitepro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
\`\`\`

## SSL Certificate Setup

### Using Let's Encrypt (Certbot)

\`\`\`bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
\`\`\`

## Monitoring and Logging

### Application Monitoring

\`\`\`bash
# Monitor with PM2
pm2 monit

# View logs
pm2 logs

# Application health check
node scripts/monitor.js check
\`\`\`

### System Monitoring

\`\`\`bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Monitor system resources
htop
iotop
nethogs
\`\`\`

## Backup Strategy

### Automated Backups

\`\`\`bash
# Setup daily backups
node scripts/backup.js --schedule

# Manual backup
node scripts/backup.js --type=full
\`\`\`

### Backup Storage

- **Local**: Store on separate disk/partition
- **Cloud**: AWS S3, Google Cloud Storage, or Azure Blob
- **Offsite**: Remote server or backup service

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer**: Nginx, HAProxy, or cloud load balancer
2. **Multiple App Instances**: PM2 cluster mode or Docker Swarm
3. **Database Sharding**: MongoDB sharding for large datasets
4. **CDN**: CloudFlare, AWS CloudFront for static assets

### Vertical Scaling

1. **Increase Server Resources**: CPU, RAM, storage
2. **Database Optimization**: Indexes, query optimization
3. **Caching**: Redis, Memcached for frequently accessed data
4. **Code Optimization**: Profiling and performance tuning

## Troubleshooting

### Common Issues

1. **Application Won't Start**
   \`\`\`bash
   # Check logs
   pm2 logs
   
   # Check environment variables
   printenv | grep NODE
   
   # Check port availability
   sudo netstat -tlnp | grep :3000
   \`\`\`

2. **Database Connection Issues**
   \`\`\`bash
   # Check MongoDB status
   sudo systemctl status mongod
   
   # Check connection
   mongo --eval "db.adminCommand('ismaster')"
   \`\`\`

3. **High Memory Usage**
   \`\`\`bash
   # Check memory usage
   free -h
   
   # Check process memory
   ps aux --sort=-%mem | head
   
   # Restart application
   pm2 restart all
   \`\`\`

### Performance Optimization

1. **Enable Gzip Compression**
2. **Optimize Database Queries**
3. **Implement Caching Strategy**
4. **Use CDN for Static Assets**
5. **Monitor and Profile Application**

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
`;

    const deployDocPath = path.join(this.docsDir, 'deployment', 'README.md');
    fs.writeFileSync(deployDocPath, content);
    logSuccess('Generated deployment documentation');
  }

  // Generate testing documentation
  generateTestingDocumentation() {
    if (!this.options.includeTesting) return;
    
    logInfo('Generating testing documentation...');
    
    const content = `# Testing Guide

## Overview

${this.projectInfo.name} uses a comprehensive testing strategy including unit tests, integration tests, end-to-end tests, and performance tests.

## Testing Framework

- **Test Runner**: Jest
- **HTTP Testing**: Supertest
- **E2E Testing**: Puppeteer
- **Mocking**: Jest mocks
- **Coverage**: Jest coverage reports
- **Database**: MongoDB Memory Server for testing

## Test Structure

\`\`\`
tests/
├── unit/              # Unit tests
│   ├── models/        # Model tests
│   ├── services/      # Service tests
│   ├── utils/         # Utility function tests
│   └── middleware/    # Middleware tests
├── integration/       # Integration tests
│   ├── api/          # API endpoint tests
│   ├── database/     # Database integration tests
│   └── services/     # Service integration tests
├── e2e/              # End-to-end tests
│   ├── auth/         # Authentication flows
│   ├── dashboard/    # Dashboard functionality
│   └── campaigns/    # Campaign management
├── performance/      # Performance tests
├── security/         # Security tests
├── fixtures/         # Test data
│   ├── data/         # JSON fixtures
│   ├── files/        # File fixtures
│   └── uploads/      # Upload test files
├── setup.js          # Jest setup
└── testHelper.js     # Test utilities
\`\`\`

## Running Tests

### Basic Commands

\`\`\`bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- auth.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should create user"
\`\`\`

### Advanced Commands

\`\`\`bash
# Run specific test types
node scripts/test.js unit
node scripts/test.js integration
node scripts/test.js e2e

# Run tests with custom options
node scripts/test.js --coverage --verbose
node scripts/test.js --watch --pattern="*.spec.js"

# Run performance tests
node scripts/test.js performance

# Run security tests
node scripts/test.js security
\`\`\`

## Test Configuration

### Jest Configuration

\`\`\`javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'routes/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'app.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testTimeout: 30000
};
\`\`\`

### Test Environment Setup

\`\`\`javascript
// tests/setup.js
const TestHelper = require('./testHelper');

global.testHelper = new TestHelper();

beforeAll(async () => {
  await global.testHelper.setupDatabase();
  global.testHelper.mockExternalAPIs();
});

afterAll(async () => {
  await global.testHelper.cleanupDatabase();
});

beforeEach(async () => {
  await global.testHelper.clearDatabase();
});
\`\`\`

## Writing Tests

### Unit Tests

Unit tests focus on testing individual functions or methods in isolation.

\`\`\`javascript
// tests/unit/utils/helpers.test.js
const { validateEmail, generateSlug } = require('../../../utils/helpers');

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
    });
  });
});
\`\`\`

### Integration Tests

Integration tests verify that different parts of the application work together correctly.

\`\`\`javascript
// tests/integration/api/users.test.js
const request = require('supertest');
const app = require('../../../app');
const User = require('../../../models/User');

describe('User API Integration Tests', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    testUser = await global.testHelper.createTestUser({
      email: 'admin@test.com',
      role: 'admin'
    });
    
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
      
      // Verify user was created in database
      const createdUser = await User.findById(response.body.user.id);
      expect(createdUser).toBeTruthy();
      expect(createdUser.email).toBe(userData.email);
    });

    test('should reject duplicate email', async () => {
      // Create user with existing email
      await global.testHelper.createTestUser({
        email: 'existing@example.com'
      });

      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Duplicate',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(userData)
        .expect(422);

      expect(response.body.error.code).toBe('DUPLICATE_RESOURCE');
    });
  });

  describe('GET /api/users', () => {
    test('should return paginated users', async () => {
      // Create test users
      await global.testHelper.createTestUsers(25);

      const response = await request(app)
        .get('/api/users?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.items).toHaveLength(10);
      expect(response.body.data.pagination.total).toBe(26); // 25 + admin
      expect(response.body.data.pagination.pages).toBe(3);
    });
  });
});
```

### End-to-End Tests

E2E tests simulate real user interactions with the application.

```javascript
// tests/e2e/auth/login.test.js
const puppeteer = require('puppeteer');

describe('Login Flow E2E Tests', () => {
  let browser;
  let page;
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.env.CI === 'true',
      slowMo: 50
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    await page.close();
  });

  test('should login with valid credentials', async () => {
    // Create test user
    const testUser = await global.testHelper.createTestUser({
      email: 'test@example.com',
      password: 'password123'
    });

    // Navigate to login page
    await page.goto(`${baseURL}/login`);
    
    // Fill login form
    await page.type('#email', testUser.email);
    await page.type('#password', 'password123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForNavigation();
    
    // Verify successful login
    expect(page.url()).toBe(`${baseURL}/dashboard`);
    
    // Check for user menu
    const userMenu = await page.$('.user-menu');
    expect(userMenu).toBeTruthy();
  });

  test('should show error for invalid credentials', async () => {
    await page.goto(`${baseURL}/login`);
    
    await page.type('#email', 'invalid@example.com');
    await page.type('#password', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await page.waitForSelector('.error-message');
    
    const errorText = await page.$eval('.error-message', el => el.textContent);
    expect(errorText).toContain('Invalid credentials');
  });
});
```

## Test Data Management

### Fixtures

Use fixtures for consistent test data across tests.

```javascript
// tests/fixtures/data/users.json
[
  {
    "email": "admin@test.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin",
    "isActive": true
  },
  {
    "email": "user@test.com",
    "firstName": "Regular",
    "lastName": "User",
    "role": "user",
    "isActive": true
  }
]
```

### Test Helper Functions

```javascript
// tests/testHelper.js
class TestHelper {
  async createTestUser(userData = {}) {
    const defaultUser = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isActive: true
    };

    const user = new User({ ...defaultUser, ...userData });
    return await user.save();
  }

  async createTestUsers(count = 10) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser({
        email: `user${i}@test.com`,
        firstName: `User${i}`
      });
      users.push(user);
    }
    return users;
  }

  generateTestToken(userId) {
    return jwt.sign(
      { userId, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  }

  mockExternalAPIs() {
    // Mock email service
    jest.mock('../services/emailService', () => ({
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
      sendCampaign: jest.fn().mockResolvedValue({ success: true })
    }));

    // Mock SMS service
    jest.mock('../services/smsService', () => ({
      sendSMS: jest.fn().mockResolvedValue({ success: true })
    }));

    // Mock payment service
    jest.mock('../services/paymentService', () => ({
      createCharge: jest.fn().mockResolvedValue({ id: 'ch_test_123' }),
      createCustomer: jest.fn().mockResolvedValue({ id: 'cus_test_123' })
    }));
  }
}

module.exports = TestHelper;
```

## Performance Testing

### Load Testing with Artillery

```yaml
# tests/performance/load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 20
    - duration: 60
      arrivalRate: 10
  processor: './auth-processor.js'

scenarios:
  - name: 'User Authentication Flow'
    weight: 30
    flow:
      - post:
          url: '/api/auth/login'
          json:
            email: 'test@example.com'
            password: 'password123'
          capture:
            - json: '$.token'
              as: 'authToken'
      - get:
          url: '/api/dashboard'
          headers:
            Authorization: 'Bearer {{ authToken }}'

  - name: 'Contact Management'
    weight: 50
    flow:
      - function: 'authenticate'
      - post:
          url: '/api/contacts'
          headers:
            Authorization: 'Bearer {{ authToken }}'
          json:
            firstName: '{{ $randomFirstName() }}'
            lastName: '{{ $randomLastName() }}'
            email: '{{ $randomEmail() }}'
      - get:
          url: '/api/contacts'
          headers:
            Authorization: 'Bearer {{ authToken }}'

  - name: 'Campaign Creation'
    weight: 20
    flow:
      - function: 'authenticate'
      - post:
          url: '/api/campaigns'
          headers:
            Authorization: 'Bearer {{ authToken }}'
          json:
            name: 'Test Campaign {{ $randomString() }}'
            type: 'email'
            subject: 'Test Subject'
            content: 'Test content'
```

### Running Performance Tests

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run tests/performance/load-test.yml

# Generate HTML report
artillery run tests/performance/load-test.yml --output report.json
artillery report report.json
```

## Security Testing

### Automated Security Scans

```bash
# Run npm audit
npm audit

# Run ESLint security plugin
npx eslint . --ext .js --config .eslintrc.security.js

# Run Snyk security scan
npx snyk test

# Run OWASP dependency check
npx audit-ci --config audit-ci.json
```

### Security Test Cases

```javascript
// tests/security/auth.test.js
describe('Authentication Security Tests', () => {
  test('should prevent SQL injection in login', async () => {
    const maliciousPayload = {
      email: "admin@test.com'; DROP TABLE users; --",
      password: 'password'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(maliciousPayload)
      .expect(400);

    expect(response.body.error).toBeDefined();
  });

  test('should prevent XSS in user input', async () => {
    const xssPayload = {
      firstName: '<script>alert("XSS")</script>',
      lastName: 'User',
      email: 'xss@test.com',
      password: 'password123'
    };

    const response = await request(app)
      .post('/api/users')
      .send(xssPayload)
      .expect(422);

    expect(response.body.error.message).toContain('Invalid characters');
  });

  test('should rate limit login attempts', async () => {
    const loginData = {
      email: 'test@example.com',
      password: 'wrongpassword'
    };

    // Make multiple failed login attempts
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post('/api/auth/login')
        .send(loginData);
    }

    // Next attempt should be rate limited
    const response = await request(app)
      .post('/api/auth/login')
      .send(loginData)
      .expect(429);

    expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
```

## Coverage Reports

### Generating Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML coverage report
open coverage/lcov-report/index.html
```

### Coverage Thresholds

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './routes/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './models/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  }
};
```

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:6.0
        ports:
          - 27017:27017
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run unit tests
      run: npm run test:unit
      env:
        NODE_ENV: test
        MONGODB_URI: mongodb://localhost:27017/geeksuitepro_test
        REDIS_URL: redis://localhost:6379
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        NODE_ENV: test
        MONGODB_URI: mongodb://localhost:27017/geeksuitepro_test
        REDIS_URL: redis://localhost:6379
    
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        NODE_ENV: test
        MONGODB_URI: mongodb://localhost:27017/geeksuitepro_test
        REDIS_URL: redis://localhost:6379
    
    - name: Generate coverage
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
    
    - name: Run security audit
      run: npm audit --audit-level moderate
```

## Best Practices

### Test Organization

1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **Use Descriptive Names**: Test names should clearly describe what is being tested
3. **Keep Tests Independent**: Each test should be able to run in isolation
4. **Use Setup/Teardown**: Properly initialize and clean up test data
5. **Mock External Dependencies**: Don't rely on external services in tests

### Test Data

1. **Use Factories**: Create test data using factory functions
2. **Avoid Hard-coded Values**: Use variables and constants
3. **Clean Up**: Always clean up test data after tests
4. **Use Realistic Data**: Test data should resemble production data

### Performance

1. **Parallel Execution**: Run tests in parallel when possible
2. **Optimize Database Operations**: Use transactions and bulk operations
3. **Cache Test Data**: Reuse test data when appropriate
4. **Profile Slow Tests**: Identify and optimize slow-running tests

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
`;

    const testDocPath = path.join(this.docsDir, 'testing', 'README.md');
    fs.writeFileSync(testDocPath, content);
    logSuccess('Generated testing documentation');
  }

  // Generate architecture documentation
  generateArchitectureDocumentation() {
    if (!this.options.includeArchitecture) return;
    
    logInfo('Generating architecture documentation...');
    
    const content = `# Architecture Overview

## System Architecture

${this.projectInfo.name} follows a modular, scalable architecture designed for maintainability and performance.

### High-Level Architecture

\`\`\`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Load Balancer │    │   Web Servers   │
│                 │◄──►│                 │◄──►│                 │
│ • Web Browser   │    │ • Nginx/HAProxy │    │ • Node.js/Express│
│ • Mobile App    │    │ • SSL/TLS       │    │ • PM2 Cluster   │
│ • API Clients   │    │ • Rate Limiting │    │ • Health Checks │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   File Storage  │    │   Cache Layer   │    │   Application   │
│                 │    │                 │    │                 │
│ • Local FS      │◄──►│ • Redis         │◄──►│ • Business Logic│
│ • AWS S3        │    │ • Session Store │    │ • API Routes    │
│ • Cloudinary    │    │ • Query Cache   │    │ • Middleware    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  External APIs  │    │   Message Queue │    │    Database     │
│                 │    │                 │    │                 │
│ • Email Service │◄──►│ • Bull Queue    │◄──►│ • MongoDB       │
│ • SMS Service   │    │ • Job Scheduler │    │ • Mongoose ODM  │
│ • Payment APIs  │    │ • Background    │    │ • Replica Set   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
\`\`\`

## Technology Stack

### Backend Technologies

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Authentication**: JWT with bcrypt
- **File Upload**: Multer
- **Validation**: Joi
- **Logging**: Winston
- **Process Management**: PM2

### Frontend Technologies

- **Framework**: React.js / Vue.js (configurable)
- **State Management**: Redux / Vuex
- **UI Components**: Material-UI / Vuetify
- **Build Tool**: Webpack / Vite
- **CSS Framework**: Tailwind CSS

### DevOps & Infrastructure

- **Containerization**: Docker
- **Orchestration**: Docker Compose / Kubernetes
- **CI/CD**: GitHub Actions / GitLab CI
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Error Tracking**: Sentry

## Application Structure

### Directory Structure

\`\`\`
${this.projectInfo.name.toLowerCase()}/
├── app.js                 # Application entry point
├── server.js              # Server configuration
├── package.json           # Dependencies and scripts
├── ecosystem.config.js    # PM2 configuration
├── docker-compose.yml     # Docker services
├── Dockerfile             # Container definition
│
├── config/                # Configuration files
│   ├── database.js        # Database configuration
│   ├── redis.js           # Redis configuration
│   ├── email.js           # Email service config
│   ├── storage.js         # File storage config
│   └── index.js           # Main config loader
│
├── routes/                # API route definitions
│   ├── auth.js            # Authentication routes
│   ├── users.js           # User management
│   ├── contacts.js        # Contact management
│   ├── campaigns.js       # Campaign management
│   ├── funnels.js         # Sales funnel routes
│   ├── forms.js           # Form builder routes
│   ├── appointments.js    # Appointment scheduling
│   ├── conversations.js   # Communication hub
│   ├── reviews.js         # Review management
│   ├── websites.js        # Website builder
│   ├── automations.js     # Automation workflows
│   ├── pipelines.js       # Sales pipeline
│   └── index.js           # Route aggregator
│
├── models/                # Database models
│   ├── User.js            # User model
│   ├── Contact.js         # Contact model
│   ├── Campaign.js        # Campaign model
│   ├── Funnel.js          # Funnel model
│   ├── Form.js            # Form model
│   ├── Appointment.js     # Appointment model
│   ├── Conversation.js    # Conversation model
│   ├── Review.js          # Review model
│   ├── Website.js         # Website model
│   ├── Automation.js      # Automation model
│   └── Pipeline.js        # Pipeline model
│
├── middleware/            # Custom middleware
│   ├── auth.js            # Authentication middleware
│   ├── validation.js      # Input validation
│   ├── rateLimit.js       # Rate limiting
│   ├── cors.js            # CORS configuration
│   ├── security.js        # Security headers
│   ├── logging.js         # Request logging
│   └── errorHandler.js    # Error handling
│
├── services/              # Business logic services
│   ├── authService.js     # Authentication logic
│   ├── userService.js     # User operations
│   ├── contactService.js  # Contact operations
│   ├── campaignService.js # Campaign logic
│   ├── emailService.js    # Email sending
│   ├── smsService.js      # SMS sending
│   ├── paymentService.js  # Payment processing
│   ├── fileService.js     # File operations
│   ├── analyticsService.js# Analytics and reporting
│   └── notificationService.js # Notifications
│
├── utils/                 # Utility functions
│   ├── helpers.js         # General helpers
│   ├── validators.js      # Validation functions
│   ├── formatters.js      # Data formatters
│   ├── constants.js       # Application constants
│   ├── logger.js          # Logging utility
│   └── database.js        # Database utilities
│
├── jobs/                  # Background jobs
│   ├── emailJobs.js       # Email processing
│   ├── campaignJobs.js    # Campaign execution
│   ├── analyticsJobs.js   # Analytics processing
│   ├── cleanupJobs.js     # Data cleanup
│   └── index.js           # Job scheduler
│
├── public/                # Static assets
│   ├── css/               # Stylesheets
│   ├── js/                # Client-side scripts
│   ├── images/            # Images
│   ├── uploads/           # User uploads
│   └── assets/            # Other assets
│
├── views/                 # Template files
│   ├── layouts/           # Layout templates
│   ├── pages/             # Page templates
│   ├── components/        # Reusable components
│   └── emails/            # Email templates
│
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   ├── e2e/               # End-to-end tests
│   ├── fixtures/          # Test data
│   └── setup.js           # Test configuration
│
├── scripts/               # Utility scripts
│   ├── setup-dev.js       # Development setup
│   ├── deploy.js          # Deployment script
│   ├── backup.js          # Backup script
│   ├── migrate.js         # Database migrations
│   ├── create-sample-data.js # Sample data
│   ├── monitor.js         # Health monitoring
│   ├── test.js            # Test runner
│   └── generate-docs.js   # Documentation generator
│
├── docs/                  # Documentation
│   ├── api/               # API documentation
│   ├── database/          # Database documentation
│   ├── deployment/        # Deployment guides
│   ├── testing/           # Testing guides
│   └── architecture/      # Architecture docs
│
└── migrations/            # Database migrations
    ├── 20240101000000_initial_setup.js
    ├── 20240102000000_add_indexes.js
    └── 20240103000000_user_preferences.js
\`\`\`

## Design Patterns

### Model-View-Controller (MVC)

- **Models**: Database schemas and business logic
- **Views**: Template rendering and response formatting
- **Controllers**: Route handlers and request processing

### Service Layer Pattern

- **Services**: Encapsulate business logic
- **Controllers**: Handle HTTP requests/responses
- **Models**: Data access and validation

### Repository Pattern

- **Repositories**: Abstract data access layer
- **Models**: Define data structure
- **Services**: Use repositories for data operations

### Middleware Pattern

- **Authentication**: JWT token validation
- **Authorization**: Role-based access control
- **Validation**: Input data validation
- **Logging**: Request/response logging
- **Error Handling**: Centralized error processing

## Data Flow

### Request Processing Flow

\`\`\`
1. Client Request
   ↓
2. Load Balancer (Nginx)
   ↓
3. Express.js Server
   ↓
4. Middleware Stack
   ├── CORS
   ├── Security Headers
   ├── Rate Limiting
   ├── Authentication
   ├── Validation
   └── Logging
   ↓
5. Route Handler
   ↓
6. Service Layer
   ├── Business Logic
   ├── Data Validation
   └── External API Calls
   ↓
7. Data Access Layer
   ├── MongoDB (Primary Data)
   ├── Redis (Cache)
   └── File Storage
   ↓
8. Response Processing
   ├── Data Formatting
   ├── Error Handling
   └── Logging
   ↓
9. Client Response
\`\`\`

### Authentication Flow

\`\`\`
1. User Login Request
   ↓
2. Validate Credentials
   ↓
3. Generate JWT Token
   ↓
4. Store Session in Redis
   ↓
5. Return Token to Client
   ↓
6. Client Stores Token
   ↓
7. Subsequent Requests
   ├── Include Bearer Token
   ├── Validate Token
   ├── Check Session
   └── Extract User Info
\`\`\`

### Campaign Processing Flow

\`\`\`
1. Campaign Creation
   ↓
2. Audience Selection
   ↓
3. Content Preparation
   ↓
4. Schedule Campaign
   ↓
5. Queue Background Job
   ↓
6. Process Recipients
   ├── Email Service
   ├── SMS Service
   └── Push Notifications
   ↓
7. Track Delivery
   ↓
8. Monitor Engagement
   ├── Opens
   ├── Clicks
   └── Conversions
   ↓
9. Generate Analytics
\`\`\`

## Security Architecture

### Authentication & Authorization

- **JWT Tokens**: Stateless authentication
- **Role-Based Access Control**: User permissions
- **Session Management**: Redis-based sessions
- **Password Security**: bcrypt hashing
- **Multi-Factor Authentication**: TOTP support

### Data Protection

- **Encryption at Rest**: Database encryption
- **Encryption in Transit**: HTTPS/TLS
- **Input Validation**: Joi schemas
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content Security Policy

### Infrastructure Security

- **Firewall Rules**: Network access control
- **Rate Limiting**: DDoS protection
- **Security Headers**: OWASP recommendations
- **Dependency Scanning**: Automated vulnerability checks
- **Container Security**: Docker best practices

## Scalability Considerations

### Horizontal Scaling

- **Load Balancing**: Multiple app instances
- **Database Sharding**: Distribute data across shards
- **Microservices**: Service decomposition
- **CDN**: Static asset distribution
- **Caching**: Multi-level caching strategy

### Vertical Scaling

- **Resource Optimization**: CPU and memory tuning
- **Database Indexing**: Query optimization
- **Connection Pooling**: Database connections
- **Code Optimization**: Performance profiling

### Performance Optimization

- **Database Queries**: Efficient aggregations
- **Caching Strategy**: Redis for hot data
- **Asset Optimization**: Minification and compression
- **Lazy Loading**: On-demand resource loading
- **Background Processing**: Async job queues

## Monitoring & Observability

### Application Monitoring

- **Health Checks**: Endpoint monitoring
- **Performance Metrics**: Response times, throughput
- **Error Tracking**: Exception monitoring
- **User Analytics**: Behavior tracking

### Infrastructure Monitoring

- **System Metrics**: CPU, memory, disk usage
- **Network Monitoring**: Bandwidth and latency
- **Database Monitoring**: Query performance
- **Cache Monitoring**: Hit rates and memory usage

### Logging Strategy

- **Structured Logging**: JSON format
- **Log Levels**: Error, warn, info, debug
- **Log Aggregation**: Centralized logging
- **Log Retention**: Automated cleanup

## Deployment Architecture

### Development Environment

- **Local Development**: Docker Compose
- **Hot Reloading**: Nodemon for development
- **Database**: Local MongoDB instance
- **Cache**: Local Redis instance

### Staging Environment

- **Container Orchestration**: Docker Swarm
- **Database**: Managed MongoDB service
- **Cache**: Managed Redis service
- **Monitoring**: Basic health checks

### Production Environment

- **Container Orchestration**: Kubernetes
- **Database**: MongoDB Atlas / Replica Set
- **Cache**: Redis Cluster
- **Load Balancer**: AWS ALB / Nginx
- **CDN**: CloudFlare / AWS CloudFront
- **Monitoring**: Full observability stack

## API Design

### RESTful Principles

- **Resource-Based URLs**: `/api/users`, `/api/contacts`
- **HTTP Methods**: GET, POST, PUT, PATCH, DELETE
- **Status Codes**: Appropriate HTTP status codes
- **Content Negotiation**: JSON by default

### API Versioning

- **URL Versioning**: `/api/v1/users`
- **Header Versioning**: `Accept: application/vnd.api+json;version=1`
- **Backward Compatibility**: Maintain older versions

### Response Format

\`\`\`json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100
    }
  }
}
\`\`\`

## Error Handling

### Error Categories

- **Validation Errors**: Input validation failures
- **Authentication Errors**: Auth token issues
- **Authorization Errors**: Permission denied
- **Business Logic Errors**: Domain-specific errors
- **System Errors**: Infrastructure failures

### Error Response Format

\`\`\`json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    },
    "timestamp": "2024-01-01T12:00:00Z",
    "requestId": "req_123456789"
  }
}
\`\`\`

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
`;

    const archDocPath = path.join(this.docsDir, 'architecture', 'README.md');
    fs.writeFileSync(archDocPath, content);
    logSuccess('Generated architecture documentation');
  }

  // Generate table of contents
  generateTableOfContents() {
    if (!this.options.generateTOC) return '';
    
    const toc = [
      '## Table of Contents',
      '',
      '- [Overview](#overview)',
      '- [Quick Start](#quick-start)',
      '- [Installation](#installation)',
      '- [Configuration](#configuration)'
    ];

    if (this.options.includeAPI) {
      toc.push('- [API Documentation](./docs/api/README.md)');
    }

    if (this.options.includeDatabase) {
      toc.push('- [Database Schema](./docs/database/README.md)');
    }

    if (this.options.includeDeployment) {
      toc.push('- [Deployment Guide](./docs/deployment/README.md)');
    }

    if (this.options.includeTesting) {
      toc.push('- [Testing Guide](./docs/testing/README.md)');
    }

    if (this.options.includeArchitecture) {
      toc.push('- [Architecture Overview](./docs/architecture/README.md)');
    }

    toc.push(
      '- [Contributing](#contributing)',
      '- [License](#license)',
      ''
    );

    return toc.join('\n');
  }

  // Generate complete documentation
  async generate() {
    try {
      logHeader(`Generating Documentation for ${this.projectInfo.name}`);
      
      const steps = [
        'Initialize structure',
        'Generate main README',
        'Generate API documentation',
        'Generate database documentation', 
        'Generate deployment documentation',
        'Generate testing documentation',
        'Generate architecture documentation'
      ];
      
      let currentStep = 0;
      
      // Initialize
      logStep(++currentStep, steps.length, 'Initializing documentation structure');
      await this.initialize();
      
      // Generate main README
      logStep(++currentStep, steps.length, 'Generating main README');
      this.generateMainReadme();
      
      // Generate API documentation
      if (this.options.includeAPI) {
        logStep(++currentStep, steps.length, 'Generating API documentation');
        await this.generateAPIDocumentation();
      }
      
      // Generate database documentation
      if (this.options.includeDatabase) {
        logStep(++currentStep, steps.length, 'Generating database documentation');
        await this.generateDatabaseDocumentation();
      }
      
      // Generate deployment documentation
      if (this.options.includeDeployment) {
        logStep(++currentStep, steps.length, 'Generating deployment documentation');
        this.generateDeploymentDocumentation();
      }
      
      // Generate testing documentation
      if (this.options.includeTesting) {
        logStep(++currentStep, steps.length, 'Generating testing documentation');
        this.generateTestingDocumentation();
      }
      
      // Generate architecture documentation
      if (this.options.includeArchitecture) {
        logStep(++currentStep, steps.length, 'Generating architecture documentation');
        this.generateArchitectureDocumentation();
      }
      
      logSuccess('\n✨ Documentation generation completed successfully!');
      logInfo(`📁 Documentation available at: ${this.docsDir}`);
      logInfo(`📖 Main README updated: ${path.join(this.projectRoot, 'README.md')}`);
      
    } catch (error) {
      logError(`Documentation generation failed: ${error.message}`);
      throw error;
    }
  }
}

// Command line interface
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    outputDir: './docs',
    includeAPI: true,
    includeDatabase: true,
    includeDeployment: true,
    includeTesting: true,
    includeArchitecture: true,
    format: 'markdown',
    generateTOC: true,
    includeCodeExamples: true
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--output':
      case '-o':
        options.outputDir = args[++i];
        break;
      case '--no-api':
        options.includeAPI = false;
        break;
      case '--no-database':
        options.includeDatabase = false;
        break;
      case '--no-deployment':
        options.includeDeployment = false;
        break;
      case '--no-testing':
        options.includeTesting = false;
        break;
      case '--no-architecture':
        options.includeArchitecture = false;
        break;
      case '--format':
        options.format = args[++i];
        break;
      case '--no-toc':
        options.generateTOC = false;
        break;
      case '--no-examples':
        options.includeCodeExamples = false;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
${colors.bright}GeekSuitePro Documentation Generator${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node scripts/generate-docs.js [options]

${colors.cyan}Options:${colors.reset}
  -o, --output <dir>        Output directory (default: ./docs)
  --no-api                  Skip API documentation
  --no-database             Skip database documentation
  --no-deployment           Skip deployment documentation
  --no-testing              Skip testing documentation
  --no-architecture         Skip architecture documentation
  --format <format>         Output format: markdown, html, pdf (default: markdown)
  --no-toc                  Skip table of contents generation
  --no-examples             Skip code examples
  -h, --help                Show this help message

${colors.cyan}Examples:${colors.reset}
  # Generate complete documentation
  node scripts/generate-docs.js
  
  # Generate only API and database docs
  node scripts/generate-docs.js --no-deployment --no-testing --no-architecture
  
  # Custom output directory
  node scripts/generate-docs.js --output ./documentation
  
  # Generate without code examples
  node scripts/generate-docs.js --no-examples
`);
}

// Main execution
async function main() {
  try {
    const options = parseArguments();
    const generator = new DocumentationGenerator(options);
    await generator.generate();
  } catch (error) {
    logError(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  logWarning('\nDocumentation generation interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logWarning('\nDocumentation generation terminated');
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = DocumentationGenerator;