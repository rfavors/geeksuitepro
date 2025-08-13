# GeekSuitePro

🚀 **All-in-One Marketing & CRM Platform** - A powerful GoHighLevel alternative built with Node.js, Express, and PostgreSQL.

## 🌟 Features

### 📊 CRM & Contact Management
- **Contact Management**: Comprehensive contact database with custom fields, tags, and segmentation
- **Pipeline Management**: Visual sales pipelines with drag-and-drop functionality
- **Activity Tracking**: Automatic logging of emails, calls, SMS, and custom activities
- **Lead Scoring**: Intelligent lead scoring based on engagement and behavior

### 🎯 Marketing Automation
- **Email Campaigns**: Drag-and-drop email builder with templates and A/B testing
- **SMS Marketing**: Bulk SMS campaigns with personalization and scheduling
- **Automation Workflows**: Visual workflow builder with triggers, conditions, and actions
- **Drip Campaigns**: Automated nurture sequences based on user behavior

### 🌐 Website & Funnel Builder
- **Website Builder**: Drag-and-drop website builder with responsive templates
- **Sales Funnels**: High-converting funnel templates with A/B testing
- **Landing Pages**: Mobile-optimized landing pages with conversion tracking
- **Blog Management**: Built-in blog system with SEO optimization

### 📅 Appointment Scheduling
- **Calendar Integration**: Sync with Google Calendar, Outlook, and other providers
- **Booking Pages**: Customizable booking pages with availability management
- **Automated Reminders**: Email and SMS reminders for appointments
- **Team Scheduling**: Multi-user calendar management

### 📝 Form Builder
- **Drag-and-Drop Forms**: Create custom forms with conditional logic
- **Lead Capture**: Automatic lead capture and CRM integration
- **Payment Forms**: Stripe integration for payment collection
- **Survey Forms**: Customer feedback and survey collection

### 💬 Unified Inbox
- **Multi-Channel Messaging**: Email, SMS, Facebook Messenger in one inbox
- **Team Collaboration**: Assign conversations and internal notes
- **Auto-Responses**: AI-powered auto-responses and chatbots
- **Message Templates**: Quick replies and canned responses

### ⭐ Reputation Management
- **Review Monitoring**: Track reviews across Google, Facebook, Yelp, and more
- **Review Requests**: Automated review request campaigns
- **Response Management**: Respond to reviews from a central dashboard
- **Sentiment Analysis**: AI-powered sentiment analysis of reviews

### 📈 Analytics & Reporting
- **Campaign Analytics**: Track email opens, clicks, and conversions
- **Sales Reports**: Revenue tracking and sales performance metrics
- **Website Analytics**: Traffic, conversions, and user behavior tracking
- **Custom Dashboards**: Build custom reports and dashboards

### 🔧 Integrations
- **Payment Processing**: Stripe integration for payments and subscriptions
- **Email Services**: Mailgun, SendGrid, and SMTP support
- **SMS Providers**: Twilio integration for SMS and voice
- **Social Media**: Facebook, Google My Business integration
- **Webhooks**: Custom webhook support for third-party integrations

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (production), SQLite (development)
- **ORM**: Sequelize
- **Authentication**: JWT with bcrypt password hashing
- **File Storage**: Local storage with Multer, Sharp for image processing
- **Email**: Nodemailer with multiple provider support
- **SMS**: Twilio integration
- **Payments**: Stripe integration
- **Real-time**: Socket.io for live updates
- **Security**: Helmet, CORS, rate limiting, input validation
- **Caching**: Redis support for sessions and caching
- **Queue Management**: Bull for background job processing

## 🚀 Coolify Deployment Guide

### Prerequisites

- Coolify v4+ instance running
- PostgreSQL database (can be created in Coolify)
- Domain name (optional but recommended)

### Step 1: Create PostgreSQL Database

1. In Coolify, go to **Databases** → **New Database**
2. Select **PostgreSQL**
3. Configure:
   - **Name**: `geeksuitepro-db`
   - **Database Name**: `geeksuitepro`
   - **Username**: `geeksuitepro`
   - **Password**: Generate a secure password
4. Deploy the database
5. Note the connection details for later use

### Step 2: Deploy Application

1. In Coolify, go to **Applications** → **New Application**
2. Select **Docker Compose**
3. Configure:
   - **Name**: `geeksuitepro`
   - **Git Repository**: Your repository URL
   - **Branch**: `main` (or your preferred branch)
   - **Docker Compose File**: `docker-compose.coolify.yml`

### Step 3: Environment Variables

Set the following environment variables in Coolify:

#### Required Variables
```env
# Database
DATABASE_URL=postgresql://geeksuitepro:YOUR_DB_PASSWORD@geeksuitepro-db:5432/geeksuitepro

# Security
JWT_SECRET=your_super_secure_jwt_secret_key_here_min_32_chars
SESSION_SECRET=your_super_secure_session_secret_key_here

# Application
NODE_ENV=production
PORT=3000
```

#### Optional Variables (Configure as needed)
```env
# Email (Mailgun)
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Your App Name

# Email (SendGrid - Alternative)
SENDGRID_API_KEY=your_sendgrid_api_key

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Google Services
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook Integration
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# File Upload (Cloudinary)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# AI Services
OPENAI_API_KEY=your_openai_api_key

# Branding
DEFAULT_BRAND_NAME=Your Brand Name
DEFAULT_BRAND_LOGO=https://yourdomain.com/logo.png
```

### Step 4: Domain Configuration

1. In Coolify, go to your application settings
2. Add your domain in the **Domains** section
3. Enable **HTTPS** (Let's Encrypt will be configured automatically)
4. Set up any additional domains or subdomains as needed

### Step 5: Deploy

1. Click **Deploy** in Coolify
2. Monitor the deployment logs
3. Once deployed, access your application at your configured domain

### Step 6: Post-Deployment Setup

1. **Database Migration**: The application will automatically create tables on first run
2. **Admin User**: Create your first admin user through the API or admin interface
3. **Configure Integrations**: Set up your email, SMS, and payment providers
4. **Test Functionality**: Verify all features are working correctly

## 🔧 Local Development

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (for production-like testing) or SQLite (for quick development)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/geeksuitepro.git
   cd geeksuitepro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   DATABASE_URL=postgresql://username:password@localhost:5432/geeksuitepro
   JWT_SECRET=your-super-secret-jwt-key
   SESSION_SECRET=your-session-secret
   ```

4. **Database Setup**
   
   For PostgreSQL:
   ```bash
   # Create database
   createdb geeksuitepro
   ```
   
   For SQLite (development only):
   ```bash
   # Database file will be created automatically
   ```

5. **Start the application**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - API: http://localhost:3000
   - Health Check: http://localhost:3000/health
   - API Documentation: http://localhost:3000/api

## 📁 Project Structure

```
geeksuitepro/
├── app.js                 # Main application file
├── package.json           # Dependencies and scripts
├── .env.example          # Environment variables template
├── docker-compose.yml    # Local Docker setup
├── docker-compose.coolify.yml # Coolify deployment
├── Dockerfile            # Docker configuration
├── config/
│   └── database.js       # Database configuration
├── middleware/           # Custom middleware
│   ├── auth.js          # Authentication middleware
│   └── validation.js    # Input validation middleware
├── models/              # Sequelize models
│   ├── User.js         # User model
│   ├── Contact.js      # Contact model
│   ├── Campaign.js     # Campaign model
│   ├── Funnel.js       # Funnel model
│   ├── Form.js         # Form model
│   ├── Appointment.js  # Appointment model
│   ├── Conversation.js # Conversation model
│   ├── Review.js       # Review model
│   ├── Website.js      # Website model
│   ├── Automation.js   # Automation model
│   └── Pipeline.js     # Pipeline model
├── routes/             # API routes
│   ├── auth.js        # Authentication routes
│   ├── crm.js         # CRM routes
│   ├── campaigns.js   # Campaign routes
│   ├── funnels.js     # Funnel routes
│   ├── forms.js       # Form routes
│   ├── appointments.js # Appointment routes
│   ├── conversations.js # Messaging routes
│   ├── reputation.js  # Reputation routes
│   ├── websites.js    # Website routes
│   ├── automation.js  # Automation routes
│   └── webhooks.js    # Webhook routes
├── utils/             # Utility functions
│   ├── email.js      # Email utilities
│   └── adGrader.js   # Ad grading utilities
├── scripts/           # Utility scripts
├── tests/             # Test files
└── uploads/          # File uploads directory
```

## 🔒 Security Features

- **Authentication**: JWT-based authentication with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: Comprehensive input validation and sanitization
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS**: Configurable CORS policies
- **Helmet**: Security headers with Helmet.js
- **Encryption**: Sensitive data encryption at rest
- **Session Security**: Secure session management with PostgreSQL store
- **SQL Injection Protection**: Sequelize ORM prevents SQL injection
- **XSS Protection**: Input sanitization and CSP headers

## 📚 API Documentation

### Authentication

All API endpoints (except public ones) require authentication using JWT tokens.

```bash
# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# Register
POST /api/auth/register
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password"
}
```

### Core Endpoints

- **CRM**: `/api/crm/*` - Contact and pipeline management
- **Campaigns**: `/api/campaigns/*` - Email and SMS campaigns
- **Funnels**: `/api/funnels/*` - Sales funnel management
- **Forms**: `/api/forms/*` - Form builder and submissions
- **Appointments**: `/api/appointments/*` - Calendar and booking
- **Conversations**: `/api/conversations/*` - Unified messaging
- **Reputation**: `/api/reputation/*` - Review management
- **Websites**: `/api/websites/*` - Website and blog builder
- **Automation**: `/api/automation/*` - Marketing automation

### Webhooks

The platform supports webhooks for real-time integrations:

- **Twilio SMS**: `/webhooks/twilio/sms`
- **Mailgun Email**: `/webhooks/mailgun/email`
- **Facebook Messenger**: `/webhooks/facebook/messenger`
- **Stripe Payments**: `/webhooks/stripe/payments`
- **Generic**: `/webhooks/generic/:identifier`

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🚀 Alternative Deployment Options

### Docker Deployment

```bash
# Build Docker image
npm run docker:build

# Run Docker container
npm run docker:run

# Or use docker-compose
docker-compose up -d
```

### Traditional VPS Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=postgresql://user:pass@localhost:5432/geeksuitepro
   ```

2. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start app.js --name geeksuitepro
   pm2 startup
   pm2 save
   ```

3. **Reverse Proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
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
   }
   ```

## 🔧 Configuration

### Database Configuration

The application supports both SQLite (development) and PostgreSQL (production):

- **Development**: Uses SQLite for quick setup
- **Production**: Uses PostgreSQL for scalability and reliability
- **Configuration**: Automatically detected based on `NODE_ENV` and `DATABASE_URL`

### Environment-Specific Settings

- **Development**: Debug logging, SQLite database, relaxed security
- **Production**: Minimal logging, PostgreSQL, enhanced security, session store

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Use conventional commit messages
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.geeksuitepro.com](https://docs.geeksuitepro.com)
- **Email**: support@geeksuitepro.com
- **Discord**: [Join our community](https://discord.gg/geeksuitepro)
- **GitHub Issues**: [Report bugs](https://github.com/geeksuitepro/geeksuitepro/issues)

## 🗺️ Roadmap

- [ ] **Mobile App**: React Native mobile application
- [ ] **Advanced AI**: GPT integration for content generation
- [ ] **Video Calls**: WebRTC video calling functionality
- [ ] **Advanced Analytics**: Machine learning insights
- [ ] **Multi-language**: Full internationalization support
- [ ] **White Label**: Complete white-label solution
- [ ] **Marketplace**: Template and plugin marketplace

## 🙏 Acknowledgments

- Inspired by GoHighLevel and other marketing automation platforms
- Built with love by the GeekSuitePro team
- Special thanks to all contributors and the open-source community

---

**Made with ❤️ by GeekSuitePro Team**