# GeekSuite Pro - Coolify Deployment Guide

## 🚀 Quick Deployment

This application is fully configured and ready for deployment on Coolify.

### Prerequisites

1. **Coolify Instance**: Ensure you have a running Coolify instance
2. **Domain**: A domain or subdomain pointed to your Coolify server
3. **Database**: PostgreSQL database (can be created in Coolify)

### Deployment Steps

#### 1. Create New Application in Coolify

1. Log into your Coolify dashboard
2. Click "New Resource" → "Application"
3. Choose "Docker Compose" as the build pack
4. Connect your Git repository

#### 2. Configure Environment Variables

Set the following environment variables in Coolify:

**Required Variables:**
```bash
# Database
DATABASE_URL=postgresql://username:password@host:5432/database_name

# Security
JWT_SECRET=your_super_secure_jwt_secret_key_here
SESSION_SECRET=your_super_secure_session_secret_key_here

# Application
NODE_ENV=production
PORT=3000
CLIENT_URL=https://yourdomain.com
```

**Optional Variables (for full functionality):**
```bash
# Email (Choose one)
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
# OR
SENDGRID_API_KEY=your_sendgrid_api_key

FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=GeekSuite Pro

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# File Upload (Cloudinary)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# AI Services
OPENAI_API_KEY=your_openai_api_key

# Social Auth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Branding
DEFAULT_BRAND_NAME=Your Company Name
DEFAULT_BRAND_LOGO=https://yourdomain.com/logo.png
```

#### 3. Database Setup

**Option A: Use Coolify's PostgreSQL**
1. In Coolify, create a new PostgreSQL database
2. Copy the connection string to `DATABASE_URL`

**Option B: External Database**
1. Use any PostgreSQL provider (AWS RDS, DigitalOcean, etc.)
2. Set the `DATABASE_URL` accordingly

#### 4. Deploy

1. Set the Docker Compose file to `docker-compose.coolify.yml`
2. Configure domain and SSL
3. Click "Deploy"

### Health Checks

The application includes built-in health checks:
- **Health Endpoint**: `https://yourdomain.com/health`
- **API Status**: `https://yourdomain.com/api`

### File Structure for Deployment

```
GeekSuitePro/
├── docker-compose.coolify.yml  # Coolify deployment config
├── Dockerfile                  # Container configuration
├── app-production.js          # Production-ready server
├── healthcheck.js             # Health check script
├── .env.production            # Production environment template
└── public/                    # Static files
    ├── favicon.ico
    ├── ad-grader.html
    └── keyword-builder.html
```

### Features Included

✅ **Core Functionality**
- Modern responsive UI
- Ad Grader tool
- Keyword Builder
- CRM dashboard
- Health monitoring

✅ **Production Ready**
- Security headers (Helmet)
- CORS configuration
- Compression
- Error handling
- Graceful shutdown

✅ **Deployment Ready**
- Docker containerization
- Health checks
- Environment configuration
- Static file serving

### Troubleshooting

**Common Issues:**

1. **Database Connection Failed**
   - Verify `DATABASE_URL` format
   - Ensure database is accessible
   - Check firewall settings

2. **Application Won't Start**
   - Check environment variables
   - Verify port 3000 is available
   - Review application logs

3. **Static Files Not Loading**
   - Ensure `public/` directory exists
   - Check file permissions
   - Verify CSP settings

### Support

For deployment issues:
1. Check application logs in Coolify
2. Verify environment variables
3. Test health endpoint: `/health`
4. Review this deployment guide

### Security Notes

- Always use strong, unique secrets for production
- Enable SSL/TLS (handled by Coolify)
- Regularly update dependencies
- Monitor application logs
- Use environment variables for all secrets

---

**Ready to deploy!** 🚀

This application is fully configured and tested for Coolify deployment.