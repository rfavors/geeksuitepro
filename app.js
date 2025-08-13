const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const path = require('path');
const { sequelize, connectDB } = require('./config/database');
// Import models to ensure they are registered with Sequelize
require('./models');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const crmRoutes = require('./routes/crm');
const funnelRoutes = require('./routes/funnels');
const automationRoutes = require('./routes/automation');
const campaignRoutes = require('./routes/campaigns');
const formRoutes = require('./routes/forms');
const appointmentRoutes = require('./routes/appointments');
const reputationRoutes = require('./routes/reputation');
const conversationRoutes = require('./routes/conversations');
const websiteRoutes = require('./routes/websites');
const adGraderRoutes = require('./routes/adGrader');
const keywordRoutes = require('./routes/keywords');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://www.google-analytics.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.geeksuitepro.com']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://app.geeksuitepro.com',
      'https://geeksuitepro.com',
      'https://www.geeksuitepro.com'
    ];
    
    // Allow subdomains for white-label
    const isSubdomain = /^https:\/\/[a-z0-9-]+\.geeksuitepro\.com$/.test(origin);
    
    if (allowedOrigins.includes(origin) || isSubdomain) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
let sessionConfig = {
  secret: process.env.SESSION_SECRET || 'geeksuitepro-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Use PostgreSQL session store only in production
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  const pgSession = require('connect-pg-simple')(session);
  sessionConfig.store = new pgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session'
  });
}

app.use(session(sessionConfig));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Ad Grader page
app.get('/ad-grader', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ad-grader.html'));
});

// Keyword Builder page
app.get('/keyword-builder', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'keyword-builder.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/funnels', funnelRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reputation', reputationRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/ad-grader', adGraderRoutes);
app.use('/api/keywords', keywordRoutes);

// Root landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GeekSuitePro - Interactive Testing Dashboard</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root {
                --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                --secondary-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                --accent-gradient: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
                --glass-bg: rgba(255, 255, 255, 0.1);
                --glass-hover: rgba(255, 255, 255, 0.15);
                --glass-border: rgba(255, 255, 255, 0.2);
                --shadow-sm: 0 4px 15px rgba(0, 0, 0, 0.1);
                --shadow-md: 0 8px 25px rgba(0, 0, 0, 0.15);
                --shadow-lg: 0 15px 35px rgba(0, 0, 0, 0.2);
                --border-radius-sm: 16px;
                --border-radius-md: 20px;
                --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                background: var(--primary-gradient);
                min-height: 100vh; 
                color: white;
                line-height: 1.6;
                font-weight: 400;
            }
            
            .container { 
                max-width: 1400px; 
                margin: 0 auto; 
                padding: 2rem; 
            }
            
            .header { 
                text-align: center; 
                margin-bottom: 3rem;
                padding: 2rem 0;
            }
            
            .logo { 
                font-size: 3.5rem; 
                font-weight: 800; 
                margin-bottom: 1rem;
                background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                text-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
            }
            
            .subtitle { 
                font-size: 1.2rem; 
                opacity: 0.9;
                font-weight: 500;
                letter-spacing: 0.5px;
            }
            .nav-tabs { 
                display: flex; 
                justify-content: center; 
                margin-bottom: 3rem; 
                flex-wrap: wrap; 
                gap: 1rem; 
            }
            
            .nav-tab { 
                background: var(--glass-bg); 
                backdrop-filter: blur(20px);
                padding: 1rem 2rem; 
                border-radius: var(--border-radius-md); 
                cursor: pointer; 
                transition: var(--transition); 
                border: 2px solid var(--glass-border);
                font-weight: 600;
                font-size: 1rem;
                box-shadow: var(--shadow-sm);
                position: relative;
                overflow: hidden;
            }
            
            .nav-tab::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                transition: left 0.5s ease;
            }
            
            .nav-tab:hover::before {
                left: 100%;
            }
            
            .nav-tab:hover, .nav-tab.active { 
                background: var(--glass-hover); 
                border-color: #ffd700;
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }
            
            .section { 
                display: none; 
                background: var(--glass-bg); 
                backdrop-filter: blur(20px);
                padding: 3rem; 
                border-radius: var(--border-radius-md); 
                border: 2px solid var(--glass-border);
                box-shadow: var(--shadow-lg);
            }
            
            .section.active { display: block; }
            
            .form-group { margin-bottom: 2rem; }
            
            .form-group label { 
                display: block; 
                margin-bottom: 0.75rem; 
                font-weight: 600; 
                color: #ffd700;
                font-size: 1rem;
                letter-spacing: 0.5px;
            }
            
            .form-group input, .form-group textarea, .form-group select { 
                width: 100%; 
                padding: 1rem; 
                border: 2px solid rgba(255,255,255,0.2); 
                border-radius: var(--border-radius-sm); 
                background: rgba(255,255,255,0.95); 
                color: #333;
                font-size: 1rem;
                transition: var(--transition);
                backdrop-filter: blur(10px);
            }
            
            .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
                outline: none;
                border-color: #ffd700;
                box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
                transform: translateY(-1px);
            }
            
            .form-group textarea { min-height: 120px; resize: vertical; }
            
            .btn { 
                background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); 
                color: #333; 
                padding: 1rem 2rem; 
                border: none; 
                border-radius: var(--border-radius-sm); 
                cursor: pointer; 
                font-weight: 700; 
                transition: var(--transition); 
                margin: 0.5rem;
                font-size: 1rem;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                box-shadow: var(--shadow-sm);
                position: relative;
                overflow: hidden;
            }
            
            .btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                transition: left 0.5s ease;
            }
            
            .btn:hover::before {
                left: 100%;
            }
            
            .btn:hover { 
                transform: translateY(-3px); 
                box-shadow: var(--shadow-md);
            }
            
            .btn-secondary { 
                background: var(--secondary-gradient); 
                color: white; 
            }
            
            .btn-secondary:hover { 
                transform: translateY(-3px);
                box-shadow: var(--shadow-md);
            }
            
            .btn-danger { 
                background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); 
                color: white; 
            }
            
            .btn-danger:hover { 
                transform: translateY(-3px);
                box-shadow: var(--shadow-md);
            }
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); 
                gap: 2rem; 
            }
            
            .card { 
                background: var(--glass-bg); 
                backdrop-filter: blur(20px);
                padding: 2rem; 
                border-radius: var(--border-radius-md); 
                border: 2px solid var(--glass-border);
                box-shadow: var(--shadow-sm);
                transition: var(--transition);
                position: relative;
                overflow: hidden;
            }
            
            .card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: var(--accent-gradient);
                transform: scaleX(0);
                transition: transform 0.4s ease;
            }
            
            .card:hover {
                transform: translateY(-5px);
                box-shadow: var(--shadow-md);
                background: var(--glass-hover);
            }
            
            .card:hover::before {
                transform: scaleX(1);
            }
            
            .card h3 { 
                color: #ffd700; 
                margin-bottom: 1.5rem;
                font-size: 1.5rem;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            
            .data-list { 
                max-height: 350px; 
                overflow-y: auto;
                padding-right: 0.5rem;
            }
            
            .data-list::-webkit-scrollbar {
                width: 6px;
            }
            
            .data-list::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.1);
                border-radius: 3px;
            }
            
            .data-list::-webkit-scrollbar-thumb {
                background: rgba(255,215,0,0.5);
                border-radius: 3px;
            }
            
            .data-item { 
                background: rgba(0,0,0,0.4); 
                backdrop-filter: blur(10px);
                padding: 1.5rem; 
                margin-bottom: 1rem; 
                border-radius: var(--border-radius-sm); 
                border-left: 4px solid #ffd700;
                transition: var(--transition);
                box-shadow: var(--shadow-sm);
            }
            
            .data-item:hover {
                transform: translateX(5px);
                background: rgba(0,0,0,0.5);
                box-shadow: var(--shadow-md);
            }
            
            .status-badge { 
                display: inline-block; 
                padding: 0.5rem 1rem; 
                border-radius: 25px; 
                font-size: 0.85rem; 
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                box-shadow: var(--shadow-sm);
            }
            
            .status-active { 
                background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                color: white;
            }
            
            .status-pending { 
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
                color: white;
            }
            
            .status-inactive { 
                background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); 
                color: white;
            }
            
            .response-area { 
                background: rgba(0,0,0,0.6); 
                backdrop-filter: blur(10px);
                padding: 1.5rem; 
                border-radius: var(--border-radius-sm); 
                font-family: 'Fira Code', 'Consolas', monospace; 
                font-size: 0.9rem; 
                max-height: 250px; 
                overflow-y: auto; 
                white-space: pre-wrap;
                border: 2px solid rgba(255,255,255,0.1);
                box-shadow: inset 0 2px 10px rgba(0,0,0,0.3);
            }
            
            .response-area::-webkit-scrollbar {
                width: 6px;
            }
            
            .response-area::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.1);
                border-radius: 3px;
            }
            
            .response-area::-webkit-scrollbar-thumb {
                background: rgba(255,215,0,0.5);
                border-radius: 3px;
            }
            
            .flex { 
                display: flex; 
                gap: 1.5rem; 
                align-items: center; 
                flex-wrap: wrap; 
            }
            
            .flex-col { 
                flex-direction: column; 
                align-items: stretch; 
            }
            
            .mt-1 { margin-top: 1.5rem; }
            .mb-1 { margin-bottom: 1.5rem; }
            .text-center { text-align: center; }
            .hidden { display: none; }
            
            h2 {
                font-size: 2rem;
                font-weight: 700;
                margin-bottom: 2rem;
                color: #ffd700;
                text-align: center;
                letter-spacing: 0.5px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🚀 GeekSuitePro</div>
                <div class="subtitle">Interactive Testing Dashboard - Test Every Feature</div>
                
                <!-- Quick Access Links -->
                <div style="margin-top: 2rem; display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
                    <a href="/ad-grader" class="btn btn-secondary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-chart-line"></i> Ad Grader
                    </a>
                    <a href="/keyword-builder" class="btn btn-secondary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-key"></i> Keyword Builder
                    </a>
                </div>
            </div>
            
            <div class="nav-tabs">
                <div class="nav-tab active" onclick="showSection('crm', this)">📊 CRM</div>
                <div class="nav-tab" onclick="showSection('campaigns', this)">📧 Campaigns</div>
                <div class="nav-tab" onclick="showSection('funnels', this)">🎯 Funnels</div>
                <div class="nav-tab" onclick="showSection('automation', this)">📱 Automation</div>
                <div class="nav-tab" onclick="showSection('appointments', this)">📅 Appointments</div>
                <div class="nav-tab" onclick="showSection('websites', this)">🌐 Websites</div>
                <div class="nav-tab" onclick="showSection('api', this)">🔧 API Tester</div>
            </div>
            
            <!-- CRM Section -->
            <div id="crm-section" class="section active">
                <h2>📊 CRM Management</h2>
                <div class="grid">
                    <div class="card">
                        <h3>Add New Contact</h3>
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" id="contact-name" placeholder="Enter contact name">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="contact-email" placeholder="Enter email address">
                        </div>
                        <div class="form-group">
                            <label>Phone</label>
                            <input type="tel" id="contact-phone" placeholder="Enter phone number">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="contact-status">
                                <option value="lead">Lead</option>
                                <option value="prospect">Prospect</option>
                                <option value="customer">Customer</option>
                            </select>
                        </div>
                        <button class="btn" onclick="addContact()">Add Contact</button>
                        <button class="btn btn-secondary" onclick="loadContacts()">Refresh List</button>
                    </div>
                    <div class="card">
                        <h3>Contact List</h3>
                        <div id="contacts-list" class="data-list">
                            <div class="text-center">Click "Refresh List" to load contacts</div>
                        </div>
                    </div>
                </div>
                <div class="mt-1">
                    <div class="card">
                        <h3>API Response</h3>
                        <div id="crm-response" class="response-area">Ready to test CRM operations...</div>
                    </div>
                </div>
            </div>
            
            <!-- Campaigns Section -->
            <div id="campaigns-section" class="section">
                <h2>📧 Email Campaigns</h2>
                <div class="grid">
                    <div class="card">
                        <h3>Create Campaign</h3>
                        <div class="form-group">
                            <label>Campaign Name</label>
                            <input type="text" id="campaign-name" placeholder="Enter campaign name">
                        </div>
                        <div class="form-group">
                            <label>Subject Line</label>
                            <input type="text" id="campaign-subject" placeholder="Enter email subject">
                        </div>
                        <div class="form-group">
                            <label>Email Content</label>
                            <textarea id="campaign-content" placeholder="Enter email content..."></textarea>
                        </div>
                        <div class="form-group">
                            <label>Target Audience</label>
                            <select id="campaign-audience">
                                <option value="all">All Contacts</option>
                                <option value="leads">Leads Only</option>
                                <option value="customers">Customers Only</option>
                            </select>
                        </div>
                        <button class="btn" onclick="createCampaign()">Create Campaign</button>
                        <button class="btn btn-secondary" onclick="loadCampaigns()">Refresh List</button>
                    </div>
                    <div class="card">
                        <h3>Active Campaigns</h3>
                        <div id="campaigns-list" class="data-list">
                            <div class="text-center">Click "Refresh List" to load campaigns</div>
                        </div>
                    </div>
                </div>
                <div class="mt-1">
                    <div class="card">
                        <h3>API Response</h3>
                        <div id="campaigns-response" class="response-area">Ready to test campaign operations...</div>
                    </div>
                </div>
            </div>
            
            <!-- Funnels Section -->
            <div id="funnels-section" class="section">
                <h2>🎯 Sales Funnels</h2>
                <div class="grid">
                    <div class="card">
                        <h3>Create Funnel</h3>
                        <div class="form-group">
                            <label>Funnel Name</label>
                            <input type="text" id="funnel-name" placeholder="Enter funnel name">
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="funnel-description" placeholder="Describe your funnel..."></textarea>
                        </div>
                        <div class="form-group">
                            <label>Funnel Type</label>
                            <select id="funnel-type">
                                <option value="lead-generation">Lead Generation</option>
                                <option value="sales">Sales</option>
                                <option value="webinar">Webinar</option>
                                <option value="product-launch">Product Launch</option>
                            </select>
                        </div>
                        <button class="btn" onclick="createFunnel()">Create Funnel</button>
                        <button class="btn btn-secondary" onclick="loadFunnels()">Refresh List</button>
                    </div>
                    <div class="card">
                        <h3>Active Funnels</h3>
                        <div id="funnels-list" class="data-list">
                            <div class="text-center">Click "Refresh List" to load funnels</div>
                        </div>
                    </div>
                </div>
                <div class="mt-1">
                    <div class="card">
                        <h3>API Response</h3>
                        <div id="funnels-response" class="response-area">Ready to test funnel operations...</div>
                    </div>
                </div>
            </div>
            
            <!-- Automation Section -->
            <div id="automation-section" class="section">
                <h2>📱 SMS & Automation</h2>
                <div class="grid">
                    <div class="card">
                        <h3>Create Automation</h3>
                        <div class="form-group">
                            <label>Automation Name</label>
                            <input type="text" id="automation-name" placeholder="Enter automation name">
                        </div>
                        <div class="form-group">
                            <label>Trigger Event</label>
                            <select id="automation-trigger">
                                <option value="contact-added">New Contact Added</option>
                                <option value="email-opened">Email Opened</option>
                                <option value="link-clicked">Link Clicked</option>
                                <option value="form-submitted">Form Submitted</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Action Type</label>
                            <select id="automation-action">
                                <option value="send-email">Send Email</option>
                                <option value="send-sms">Send SMS</option>
                                <option value="add-tag">Add Tag</option>
                                <option value="move-pipeline">Move in Pipeline</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Message Content</label>
                            <textarea id="automation-message" placeholder="Enter message content..."></textarea>
                        </div>
                        <button class="btn" onclick="createAutomation()">Create Automation</button>
                        <button class="btn btn-secondary" onclick="loadAutomations()">Refresh List</button>
                    </div>
                    <div class="card">
                        <h3>Active Automations</h3>
                        <div id="automations-list" class="data-list">
                            <div class="text-center">Click "Refresh List" to load automations</div>
                        </div>
                    </div>
                </div>
                <div class="mt-1">
                    <div class="card">
                        <h3>API Response</h3>
                        <div id="automation-response" class="response-area">Ready to test automation operations...</div>
                    </div>
                </div>
            </div>
            
            <!-- Appointments Section -->
            <div id="appointments-section" class="section">
                <h2>📅 Appointment Scheduling</h2>
                <div class="grid">
                    <div class="card">
                        <h3>Schedule Appointment</h3>
                        <div class="form-group">
                            <label>Client Name</label>
                            <input type="text" id="appointment-client" placeholder="Enter client name">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="appointment-email" placeholder="Enter client email">
                        </div>
                        <div class="form-group">
                            <label>Date & Time</label>
                            <input type="datetime-local" id="appointment-datetime">
                        </div>
                        <div class="form-group">
                            <label>Service Type</label>
                            <select id="appointment-service">
                                <option value="consultation">Consultation</option>
                                <option value="demo">Product Demo</option>
                                <option value="support">Support Call</option>
                                <option value="training">Training Session</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea id="appointment-notes" placeholder="Additional notes..."></textarea>
                        </div>
                        <button class="btn" onclick="scheduleAppointment()">Schedule Appointment</button>
                        <button class="btn btn-secondary" onclick="loadAppointments()">Refresh List</button>
                    </div>
                    <div class="card">
                        <h3>Upcoming Appointments</h3>
                        <div id="appointments-list" class="data-list">
                            <div class="text-center">Click "Refresh List" to load appointments</div>
                        </div>
                    </div>
                </div>
                <div class="mt-1">
                    <div class="card">
                        <h3>API Response</h3>
                        <div id="appointments-response" class="response-area">Ready to test appointment operations...</div>
                    </div>
                </div>
            </div>
            
            <!-- Websites Section -->
            <div id="websites-section" class="section">
                <h2>🌐 Website Builder</h2>
                <div class="grid">
                    <div class="card">
                        <h3>Create Website</h3>
                        <div class="form-group">
                            <label>Website Name</label>
                            <input type="text" id="website-name" placeholder="Enter website name">
                        </div>
                        <div class="form-group">
                            <label>Domain</label>
                            <input type="text" id="website-domain" placeholder="Enter domain (e.g., mysite.com)">
                        </div>
                        <div class="form-group">
                            <label>Template</label>
                            <select id="website-template">
                                <option value="business">Business</option>
                                <option value="ecommerce">E-commerce</option>
                                <option value="portfolio">Portfolio</option>
                                <option value="blog">Blog</option>
                                <option value="landing">Landing Page</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="website-description" placeholder="Describe your website..."></textarea>
                        </div>
                        <button class="btn" onclick="createWebsite()">Create Website</button>
                        <button class="btn btn-secondary" onclick="loadWebsites()">Refresh List</button>
                    </div>
                    <div class="card">
                        <h3>Your Websites</h3>
                        <div id="websites-list" class="data-list">
                            <div class="text-center">Click "Refresh List" to load websites</div>
                        </div>
                    </div>
                </div>
                <div class="mt-1">
                    <div class="card">
                        <h3>API Response</h3>
                        <div id="websites-response" class="response-area">Ready to test website operations...</div>
                    </div>
                </div>
            </div>
            
            <!-- API Tester Section -->
            <div id="api-section" class="section">
                <h2>🔧 API Tester</h2>
                <div class="card">
                    <h3>Test Any API Endpoint</h3>
                    <div class="flex">
                        <div class="form-group" style="flex: 1;">
                            <label>HTTP Method</label>
                            <select id="api-method">
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 3;">
                            <label>Endpoint URL</label>
                            <input type="text" id="api-url" placeholder="/api/crm/contacts" value="/api/crm/contacts">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Request Body (JSON)</label>
                        <textarea id="api-body" placeholder='{"name": "Test User", "email": "test@example.com"}'></textarea>
                    </div>
                    <div class="flex">
                        <button class="btn" onclick="testAPI()">Send Request</button>
                        <button class="btn btn-secondary" onclick="clearAPIResponse()">Clear Response</button>
                    </div>
                    <div class="mt-1">
                        <h3>Response</h3>
                        <div id="api-response" class="response-area">Ready to test API endpoints...</div>
                    </div>
                </div>
                
                <div class="mt-1">
                    <div class="card">
                        <h3>Quick API Tests</h3>
                        <div class="flex">
                            <button class="btn btn-secondary" onclick="quickTest('/health', 'GET')">Health Check</button>
                            <button class="btn btn-secondary" onclick="quickTest('/api', 'GET')">API Info</button>
                            <button class="btn btn-secondary" onclick="quickTest('/api/crm/contacts', 'GET')">Get Contacts</button>
                            <button class="btn btn-secondary" onclick="quickTest('/api/campaigns', 'GET')">Get Campaigns</button>
                            <button class="btn btn-secondary" onclick="quickTest('/api/funnels', 'GET')">Get Funnels</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            // Global variables
            let currentSection = 'crm';
            
            // Wait for DOM to be fully loaded
            document.addEventListener('DOMContentLoaded', function() {
                console.log('DOM loaded, initializing dashboard...');
                // Initialize the first section
                showSection('crm', document.querySelector('.nav-tab.active'));
            });
            
            // Navigation
            function showSection(section, clickedTab) {
                console.log('showSection called with:', section, clickedTab);
                
                // Hide all sections
                document.querySelectorAll('.section').forEach(s => {
                    s.classList.remove('active');
                    console.log('Hiding section:', s.id);
                });
                
                document.querySelectorAll('.nav-tab').forEach(t => {
                    t.classList.remove('active');
                });
                
                // Show selected section
                const targetSection = document.getElementById(section + '-section');
                console.log('Target section:', targetSection);
                
                if (targetSection) {
                    targetSection.classList.add('active');
                    console.log('Activated section:', section + '-section');
                } else {
                    console.error('Section not found:', section + '-section');
                }
                
                // Activate the clicked tab
                if (clickedTab) {
                    clickedTab.classList.add('active');
                    console.log('Activated tab:', clickedTab);
                } else {
                    console.warn('No clicked tab provided');
                }
                
                currentSection = section;
                console.log('Current section set to:', section);
            }
            
            // Make showSection globally available
            window.showSection = showSection;
            
            // API Helper function
            async function apiCall(method, url, data = null, responseElementId = null) {
                try {
                    const options = {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    };
                    
                    if (data && (method === 'POST' || method === 'PUT')) {
                        options.body = JSON.stringify(data);
                    }
                    
                    const response = await fetch(url, options);
                    const result = await response.json();
                    
                    const responseText = JSON.stringify(result, null, 2);
                    
                    if (responseElementId) {
                        document.getElementById(responseElementId).textContent = responseText;
                    }
                    
                    return result;
                } catch (error) {
                    const errorText = 'Error: ' + error.message;
                    if (responseElementId) {
                        document.getElementById(responseElementId).textContent = errorText;
                    }
                    console.error('API Error:', error);
                    return null;
                }
            }
            
            // CRM Functions
            async function addContact() {
                const data = {
                    name: document.getElementById('contact-name').value,
                    email: document.getElementById('contact-email').value,
                    phone: document.getElementById('contact-phone').value,
                    status: document.getElementById('contact-status').value
                };
                
                if (!data.name || !data.email) {
                    alert('Please fill in name and email fields');
                    return;
                }
                
                await apiCall('POST', '/api/crm/contacts', data, 'crm-response');
                
                // Clear form
                document.getElementById('contact-name').value = '';
                document.getElementById('contact-email').value = '';
                document.getElementById('contact-phone').value = '';
                
                // Refresh list
                loadContacts();
            }
            
            async function loadContacts() {
                 const result = await apiCall('GET', '/api/crm/contacts', null, 'crm-response');
                 
                 if (result && result.data) {
                     const listHtml = result.data.map(function(contact) {
                         return '<div class="data-item">' +
                             '<strong>' + contact.name + '</strong><br>' +
                             '📧 ' + contact.email + '<br>' +
                             '📱 ' + (contact.phone || 'No phone') + '<br>' +
                             '<span class="status-badge status-active">' + contact.status + '</span>' +
                             '</div>';
                     }).join('');
                     
                     document.getElementById('contacts-list').innerHTML = listHtml || '<div class="text-center">No contacts found</div>';
                 }
             }
            
            // Campaign Functions
            async function createCampaign() {
                const data = {
                    name: document.getElementById('campaign-name').value,
                    subject: document.getElementById('campaign-subject').value,
                    content: document.getElementById('campaign-content').value,
                    audience: document.getElementById('campaign-audience').value
                };
                
                if (!data.name || !data.subject) {
                    alert('Please fill in campaign name and subject');
                    return;
                }
                
                await apiCall('POST', '/api/campaigns', data, 'campaigns-response');
                
                // Clear form
                document.getElementById('campaign-name').value = '';
                document.getElementById('campaign-subject').value = '';
                document.getElementById('campaign-content').value = '';
                
                loadCampaigns();
            }
            
            async function loadCampaigns() {
                 const result = await apiCall('GET', '/api/campaigns', null, 'campaigns-response');
                 
                 if (result && result.data) {
                     const listHtml = result.data.map(function(campaign) {
                         return '<div class="data-item">' +
                             '<strong>' + campaign.name + '</strong><br>' +
                             '📧 ' + campaign.subject + '<br>' +
                             '👥 ' + campaign.audience + '<br>' +
                             '<span class="status-badge status-pending">Draft</span>' +
                             '</div>';
                     }).join('');
                     
                     document.getElementById('campaigns-list').innerHTML = listHtml || '<div class="text-center">No campaigns found</div>';
                 }
             }
            
            // Funnel Functions
            async function createFunnel() {
                const data = {
                    name: document.getElementById('funnel-name').value,
                    description: document.getElementById('funnel-description').value,
                    type: document.getElementById('funnel-type').value
                };
                
                if (!data.name) {
                    alert('Please enter a funnel name');
                    return;
                }
                
                await apiCall('POST', '/api/funnels', data, 'funnels-response');
                
                // Clear form
                document.getElementById('funnel-name').value = '';
                document.getElementById('funnel-description').value = '';
                
                loadFunnels();
            }
            
            async function loadFunnels() {
                 const result = await apiCall('GET', '/api/funnels', null, 'funnels-response');
                 
                 if (result && result.data) {
                     const listHtml = result.data.map(function(funnel) {
                         return '<div class="data-item">' +
                             '<strong>' + funnel.name + '</strong><br>' +
                             '📝 ' + (funnel.description || 'No description') + '<br>' +
                             '🏷️ ' + funnel.type + '<br>' +
                             '<span class="status-badge status-active">Active</span>' +
                             '</div>';
                     }).join('');
                     
                     document.getElementById('funnels-list').innerHTML = listHtml || '<div class="text-center">No funnels found</div>';
                 }
             }
            
            // Automation Functions
            async function createAutomation() {
                const data = {
                    name: document.getElementById('automation-name').value,
                    trigger: document.getElementById('automation-trigger').value,
                    action: document.getElementById('automation-action').value,
                    message: document.getElementById('automation-message').value
                };
                
                if (!data.name) {
                    alert('Please enter an automation name');
                    return;
                }
                
                await apiCall('POST', '/api/automation', data, 'automation-response');
                
                // Clear form
                document.getElementById('automation-name').value = '';
                document.getElementById('automation-message').value = '';
                
                loadAutomations();
            }
            
            async function loadAutomations() {
                const result = await apiCall('GET', '/api/automation', null, 'automation-response');
                
                if (result && result.data) {
                    const listHtml = result.data.map(function(automation) {
                        return '<div class="data-item">' +
                            '<strong>' + automation.name + '</strong><br>' +
                            '🔄 ' + automation.trigger + '<br>' +
                            '⚡ ' + automation.action + '<br>' +
                            '<span class="status-badge status-active">Active</span>' +
                            '</div>';
                    }).join('');
                    
                    document.getElementById('automations-list').innerHTML = listHtml || '<div class="text-center">No automations found</div>';
                }
            }
            
            // Appointment Functions
            async function scheduleAppointment() {
                const data = {
                    clientName: document.getElementById('appointment-client').value,
                    email: document.getElementById('appointment-email').value,
                    datetime: document.getElementById('appointment-datetime').value,
                    service: document.getElementById('appointment-service').value,
                    notes: document.getElementById('appointment-notes').value
                };
                
                if (!data.clientName || !data.email || !data.datetime) {
                    alert('Please fill in client name, email, and date/time');
                    return;
                }
                
                await apiCall('POST', '/api/appointments', data, 'appointments-response');
                
                // Clear form
                document.getElementById('appointment-client').value = '';
                document.getElementById('appointment-email').value = '';
                document.getElementById('appointment-datetime').value = '';
                document.getElementById('appointment-notes').value = '';
                
                loadAppointments();
            }
            
            async function loadAppointments() {
                const result = await apiCall('GET', '/api/appointments', null, 'appointments-response');
                
                if (result && result.data) {
                    const listHtml = result.data.map(function(appointment) {
                        return '<div class="data-item">' +
                            '<strong>' + appointment.clientName + '</strong><br>' +
                            '📧 ' + appointment.email + '<br>' +
                            '📅 ' + new Date(appointment.datetime).toLocaleString() + '<br>' +
                            '🔧 ' + appointment.service + '<br>' +
                            '<span class="status-badge status-pending">Scheduled</span>' +
                            '</div>';
                    }).join('');
                    
                    document.getElementById('appointments-list').innerHTML = listHtml || '<div class="text-center">No appointments found</div>';
                }
            }
            
            // Website Functions
            async function createWebsite() {
                const data = {
                    name: document.getElementById('website-name').value,
                    domain: document.getElementById('website-domain').value,
                    template: document.getElementById('website-template').value,
                    description: document.getElementById('website-description').value
                };
                
                if (!data.name || !data.domain) {
                    alert('Please enter website name and domain');
                    return;
                }
                
                await apiCall('POST', '/api/websites', data, 'websites-response');
                
                // Clear form
                document.getElementById('website-name').value = '';
                document.getElementById('website-domain').value = '';
                document.getElementById('website-description').value = '';
                
                loadWebsites();
            }
            
            async function loadWebsites() {
                const result = await apiCall('GET', '/api/websites', null, 'websites-response');
                
                if (result && result.data) {
                    const listHtml = result.data.map(function(website) {
                        return '<div class="data-item">' +
                            '<strong>' + website.name + '</strong><br>' +
                            '🌐 ' + website.domain + '<br>' +
                            '📄 ' + website.template + '<br>' +
                            '<span class="status-badge status-active">Live</span>' +
                            '</div>';
                    }).join('');
                    
                    document.getElementById('websites-list').innerHTML = listHtml || '<div class="text-center">No websites found</div>';
                }
            }
            
            // API Tester Functions
            async function testAPI() {
                const method = document.getElementById('api-method').value;
                const url = document.getElementById('api-url').value;
                const bodyText = document.getElementById('api-body').value;
                
                let data = null;
                if (bodyText && (method === 'POST' || method === 'PUT')) {
                    try {
                        data = JSON.parse(bodyText);
                    } catch (e) {
                        alert('Invalid JSON in request body');
                        return;
                    }
                }
                
                await apiCall(method, url, data, 'api-response');
            }
            
            function quickTest(url, method) {
                document.getElementById('api-method').value = method;
                document.getElementById('api-url').value = url;
                document.getElementById('api-body').value = '';
                testAPI();
            }
            
            function clearAPIResponse() {
                document.getElementById('api-response').textContent = 'Ready to test API endpoints...';
            }
            
            // Initialize
            document.addEventListener('DOMContentLoaded', function() {
                // Set default datetime for appointments
                const now = new Date();
                now.setHours(now.getHours() + 1);
                document.getElementById('appointment-datetime').value = now.toISOString().slice(0, 16);
            });
        </script>
    </body>
    </html>
  `);
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'GeekSuitePro API',
    version: '1.0.0',
    description: 'All-in-one marketing and CRM platform API',
    endpoints: {
      auth: '/api/auth',
      crm: '/api/crm',
      funnels: '/api/funnels',
      automation: '/api/automation',
      campaigns: '/api/campaigns',
      forms: '/api/forms',
      appointments: '/api/appointments',
      reputation: '/api/reputation',
      conversations: '/api/conversations',
      websites: '/api/websites'
    },
    documentation: 'https://docs.geeksuitepro.com'
  });
});

// Webhook endpoints (public, no auth required)
app.use('/webhooks', require('./routes/webhooks'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }
  
  // Sequelize database error
  if (err.name === 'SequelizeDatabaseError') {
    return res.status(400).json({
      success: false,
      message: 'Database Error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Invalid data format'
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation'
    });
  }
  
  // Rate limit error
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests',
      retryAfter: err.retryAfter
    });
  }
  
  // Default server error
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Graceful shutdown for PostgreSQL
process.on('SIGINT', async () => {
  await sequelize.close();
  console.log('PostgreSQL connection closed through app termination');
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();
  
  const server = app.listen(PORT, () => {
    console.log(`🚀 GeekSuitePro API Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📖 API docs: http://localhost:${PORT}/api`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
    });
  });
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

if (require.main === module) {
  startServer();
}

module.exports = app;