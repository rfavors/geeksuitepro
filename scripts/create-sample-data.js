#!/usr/bin/env node

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const Funnel = require('../models/Funnel');
const Form = require('../models/Form');
const Appointment = require('../models/Appointment');
const Conversation = require('../models/Conversation');
const Review = require('../models/Review');
const Website = require('../models/Website');
const Automation = require('../models/Automation');
const Pipeline = require('../models/Pipeline');

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

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(message, 'bright');
  log('='.repeat(60), 'cyan');
}

// Sample data generators
class SampleDataGenerator {
  constructor() {
    this.users = [];
    this.contacts = [];
    this.pipelines = [];
    this.campaigns = [];
    this.funnels = [];
    this.forms = [];
    this.websites = [];
    this.automations = [];
  }

  // Generate sample users
  async generateUsers(count = 5) {
    logInfo(`Generating ${count} sample users...`);
    
    const users = [];
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const adminUser = {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@geeksuitepro.com',
      password: adminPassword,
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
      profile: {
        avatar: faker.image.avatar(),
        bio: 'System Administrator',
        phone: faker.phone.number(),
        timezone: 'America/New_York',
        language: 'en'
      },
      settings: {
        notifications: {
          email: true,
          sms: true,
          push: true
        },
        privacy: {
          profileVisible: true,
          showEmail: false,
          showPhone: false
        }
      }
    };
    users.push(adminUser);

    // Create regular users
    for (let i = 0; i < count - 1; i++) {
      const password = await bcrypt.hash('password123', 12);
      const user = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        password,
        role: faker.helpers.arrayElement(['user', 'manager']),
        isActive: true,
        isEmailVerified: faker.datatype.boolean(),
        profile: {
          avatar: faker.image.avatar(),
          bio: faker.lorem.sentence(),
          phone: faker.phone.number(),
          timezone: faker.helpers.arrayElement(['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']),
          language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de'])
        },
        settings: {
          notifications: {
            email: faker.datatype.boolean(),
            sms: faker.datatype.boolean(),
            push: faker.datatype.boolean()
          },
          privacy: {
            profileVisible: faker.datatype.boolean(),
            showEmail: faker.datatype.boolean(),
            showPhone: faker.datatype.boolean()
          }
        }
      };
      users.push(user);
    }

    this.users = await User.insertMany(users);
    logSuccess(`Created ${this.users.length} users`);
    return this.users;
  }

  // Generate sample pipelines
  async generatePipelines(count = 3) {
    logInfo(`Generating ${count} sample pipelines...`);
    
    const pipelineTemplates = [
      {
        name: 'Sales Pipeline',
        description: 'Standard sales process for new leads',
        stages: [
          { name: 'New Lead', color: '#3B82F6', order: 1 },
          { name: 'Qualified', color: '#10B981', order: 2 },
          { name: 'Proposal', color: '#F59E0B', order: 3 },
          { name: 'Negotiation', color: '#EF4444', order: 4 },
          { name: 'Closed Won', color: '#8B5CF6', order: 5 },
          { name: 'Closed Lost', color: '#6B7280', order: 6 }
        ]
      },
      {
        name: 'Customer Onboarding',
        description: 'Process for onboarding new customers',
        stages: [
          { name: 'Welcome', color: '#3B82F6', order: 1 },
          { name: 'Setup', color: '#10B981', order: 2 },
          { name: 'Training', color: '#F59E0B', order: 3 },
          { name: 'Go Live', color: '#8B5CF6', order: 4 },
          { name: 'Success', color: '#059669', order: 5 }
        ]
      },
      {
        name: 'Support Tickets',
        description: 'Customer support ticket workflow',
        stages: [
          { name: 'New', color: '#3B82F6', order: 1 },
          { name: 'In Progress', color: '#F59E0B', order: 2 },
          { name: 'Waiting', color: '#6B7280', order: 3 },
          { name: 'Resolved', color: '#10B981', order: 4 },
          { name: 'Closed', color: '#059669', order: 5 }
        ]
      }
    ];

    const pipelines = [];
    for (let i = 0; i < Math.min(count, pipelineTemplates.length); i++) {
      const template = pipelineTemplates[i];
      const pipeline = {
        ...template,
        userId: faker.helpers.arrayElement(this.users)._id,
        isDefault: i === 0,
        isActive: true
      };
      pipelines.push(pipeline);
    }

    this.pipelines = await Pipeline.insertMany(pipelines);
    logSuccess(`Created ${this.pipelines.length} pipelines`);
    return this.pipelines;
  }

  // Generate sample contacts
  async generateContacts(count = 50) {
    logInfo(`Generating ${count} sample contacts...`);
    
    const contacts = [];
    const stages = this.pipelines[0]?.stages || [];
    
    for (let i = 0; i < count; i++) {
      const contact = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        company: faker.company.name(),
        jobTitle: faker.person.jobTitle(),
        website: faker.internet.url(),
        address: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          zipCode: faker.location.zipCode(),
          country: faker.location.country()
        },
        socialMedia: {
          linkedin: faker.internet.url(),
          twitter: faker.internet.userName(),
          facebook: faker.internet.url()
        },
        tags: faker.helpers.arrayElements(['lead', 'customer', 'prospect', 'vip', 'cold'], { min: 1, max: 3 }),
        source: faker.helpers.arrayElement(['website', 'referral', 'social_media', 'email_campaign', 'cold_call', 'event']),
        status: faker.helpers.arrayElement(['active', 'inactive', 'do_not_contact']),
        stage: stages.length > 0 ? faker.helpers.arrayElement(stages).name : 'New Lead',
        pipelineId: this.pipelines[0]?._id,
        userId: faker.helpers.arrayElement(this.users)._id,
        customFields: {
          industry: faker.company.buzzNoun(),
          budget: faker.number.int({ min: 1000, max: 100000 }),
          priority: faker.helpers.arrayElement(['low', 'medium', 'high'])
        },
        notes: [
          {
            content: faker.lorem.paragraph(),
            createdBy: faker.helpers.arrayElement(this.users)._id,
            createdAt: faker.date.recent()
          }
        ],
        activities: [
          {
            type: faker.helpers.arrayElement(['call', 'email', 'meeting', 'note']),
            description: faker.lorem.sentence(),
            createdBy: faker.helpers.arrayElement(this.users)._id,
            createdAt: faker.date.recent()
          }
        ]
      };
      contacts.push(contact);
    }

    this.contacts = await Contact.insertMany(contacts);
    logSuccess(`Created ${this.contacts.length} contacts`);
    return this.contacts;
  }

  // Generate sample campaigns
  async generateCampaigns(count = 10) {
    logInfo(`Generating ${count} sample campaigns...`);
    
    const campaigns = [];
    
    for (let i = 0; i < count; i++) {
      const type = faker.helpers.arrayElement(['email', 'sms']);
      const status = faker.helpers.arrayElement(['draft', 'scheduled', 'sent', 'paused']);
      
      const campaign = {
        name: faker.lorem.words(3),
        type,
        status,
        subject: type === 'email' ? faker.lorem.sentence() : undefined,
        content: type === 'email' ? 
          `<h1>${faker.lorem.sentence()}</h1><p>${faker.lorem.paragraphs(2)}</p>` :
          faker.lorem.sentence({ min: 10, max: 20 }),
        recipients: faker.helpers.arrayElements(this.contacts.map(c => c._id), { min: 5, max: 20 }),
        scheduledAt: status === 'scheduled' ? faker.date.future() : undefined,
        sentAt: status === 'sent' ? faker.date.recent() : undefined,
        userId: faker.helpers.arrayElement(this.users)._id,
        settings: {
          trackOpens: type === 'email',
          trackClicks: type === 'email',
          unsubscribeLink: type === 'email'
        },
        analytics: status === 'sent' ? {
          totalSent: faker.number.int({ min: 50, max: 500 }),
          delivered: faker.number.int({ min: 45, max: 480 }),
          opened: faker.number.int({ min: 10, max: 200 }),
          clicked: faker.number.int({ min: 5, max: 50 }),
          bounced: faker.number.int({ min: 0, max: 10 }),
          unsubscribed: faker.number.int({ min: 0, max: 5 })
        } : undefined
      };
      campaigns.push(campaign);
    }

    this.campaigns = await Campaign.insertMany(campaigns);
    logSuccess(`Created ${this.campaigns.length} campaigns`);
    return this.campaigns;
  }

  // Generate sample funnels
  async generateFunnels(count = 5) {
    logInfo(`Generating ${count} sample funnels...`);
    
    const funnels = [];
    
    for (let i = 0; i < count; i++) {
      const funnel = {
        name: faker.lorem.words(2) + ' Funnel',
        description: faker.lorem.sentence(),
        status: faker.helpers.arrayElement(['active', 'inactive', 'draft']),
        userId: faker.helpers.arrayElement(this.users)._id,
        steps: [
          {
            name: 'Landing Page',
            type: 'page',
            order: 1,
            settings: {
              url: faker.internet.url(),
              title: faker.lorem.sentence(),
              description: faker.lorem.paragraph()
            }
          },
          {
            name: 'Lead Capture',
            type: 'form',
            order: 2,
            settings: {
              fields: ['firstName', 'lastName', 'email'],
              submitText: 'Get Started'
            }
          },
          {
            name: 'Thank You',
            type: 'page',
            order: 3,
            settings: {
              url: faker.internet.url(),
              title: 'Thank You!',
              description: 'We\'ll be in touch soon.'
            }
          }
        ],
        analytics: {
          views: faker.number.int({ min: 100, max: 5000 }),
          conversions: faker.number.int({ min: 10, max: 500 }),
          conversionRate: faker.number.float({ min: 0.01, max: 0.3, precision: 0.01 })
        }
      };
      funnels.push(funnel);
    }

    this.funnels = await Funnel.insertMany(funnels);
    logSuccess(`Created ${this.funnels.length} funnels`);
    return this.funnels;
  }

  // Generate sample forms
  async generateForms(count = 8) {
    logInfo(`Generating ${count} sample forms...`);
    
    const forms = [];
    
    const formTemplates = [
      {
        name: 'Contact Form',
        description: 'Basic contact form for website',
        fields: [
          { name: 'firstName', label: 'First Name', type: 'text', required: true },
          { name: 'lastName', label: 'Last Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', required: false },
          { name: 'message', label: 'Message', type: 'textarea', required: true }
        ]
      },
      {
        name: 'Newsletter Signup',
        description: 'Simple newsletter subscription form',
        fields: [
          { name: 'email', label: 'Email Address', type: 'email', required: true },
          { name: 'firstName', label: 'First Name', type: 'text', required: false }
        ]
      },
      {
        name: 'Lead Generation',
        description: 'Comprehensive lead capture form',
        fields: [
          { name: 'firstName', label: 'First Name', type: 'text', required: true },
          { name: 'lastName', label: 'Last Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'company', label: 'Company', type: 'text', required: false },
          { name: 'jobTitle', label: 'Job Title', type: 'text', required: false },
          { name: 'phone', label: 'Phone', type: 'tel', required: false },
          { name: 'budget', label: 'Budget Range', type: 'select', required: false, options: ['< $1,000', '$1,000 - $5,000', '$5,000 - $10,000', '> $10,000'] }
        ]
      }
    ];

    for (let i = 0; i < count; i++) {
      const template = faker.helpers.arrayElement(formTemplates);
      const form = {
        ...template,
        name: template.name + (i > 2 ? ` ${i - 2}` : ''),
        userId: faker.helpers.arrayElement(this.users)._id,
        isActive: faker.datatype.boolean(),
        settings: {
          submitText: 'Submit',
          successMessage: 'Thank you for your submission!',
          redirectUrl: faker.internet.url(),
          sendNotification: true,
          notificationEmail: faker.internet.email()
        },
        styling: {
          theme: faker.helpers.arrayElement(['default', 'modern', 'minimal']),
          primaryColor: faker.internet.color(),
          backgroundColor: '#ffffff',
          textColor: '#333333'
        },
        analytics: {
          views: faker.number.int({ min: 50, max: 2000 }),
          submissions: faker.number.int({ min: 5, max: 200 }),
          conversionRate: faker.number.float({ min: 0.01, max: 0.5, precision: 0.01 })
        }
      };
      forms.push(form);
    }

    this.forms = await Form.insertMany(forms);
    logSuccess(`Created ${this.forms.length} forms`);
    return this.forms;
  }

  // Generate sample appointments
  async generateAppointments(count = 20) {
    logInfo(`Generating ${count} sample appointments...`);
    
    const appointments = [];
    
    for (let i = 0; i < count; i++) {
      const startTime = faker.date.between({ from: new Date(), to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
      const endTime = new Date(startTime.getTime() + faker.number.int({ min: 30, max: 120 }) * 60 * 1000);
      
      const appointment = {
        title: faker.lorem.words(3),
        description: faker.lorem.sentence(),
        startTime,
        endTime,
        contactId: faker.helpers.arrayElement(this.contacts)._id,
        userId: faker.helpers.arrayElement(this.users)._id,
        type: faker.helpers.arrayElement(['call', 'meeting', 'demo', 'consultation']),
        status: faker.helpers.arrayElement(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']),
        location: faker.helpers.arrayElement(['Office', 'Online', 'Client Location', faker.location.streetAddress()]),
        notes: faker.lorem.paragraph(),
        reminders: [
          {
            type: 'email',
            minutesBefore: 60,
            sent: faker.datatype.boolean()
          },
          {
            type: 'sms',
            minutesBefore: 15,
            sent: faker.datatype.boolean()
          }
        ]
      };
      appointments.push(appointment);
    }

    const createdAppointments = await Appointment.insertMany(appointments);
    logSuccess(`Created ${createdAppointments.length} appointments`);
    return createdAppointments;
  }

  // Generate sample conversations
  async generateConversations(count = 15) {
    logInfo(`Generating ${count} sample conversations...`);
    
    const conversations = [];
    
    for (let i = 0; i < count; i++) {
      const messages = [];
      const messageCount = faker.number.int({ min: 2, max: 10 });
      
      for (let j = 0; j < messageCount; j++) {
        messages.push({
          content: faker.lorem.sentence(),
          sender: j % 2 === 0 ? 'contact' : 'user',
          timestamp: faker.date.recent({ days: 7 }),
          type: faker.helpers.arrayElement(['text', 'email', 'sms']),
          status: faker.helpers.arrayElement(['sent', 'delivered', 'read'])
        });
      }
      
      const conversation = {
        contactId: faker.helpers.arrayElement(this.contacts)._id,
        userId: faker.helpers.arrayElement(this.users)._id,
        subject: faker.lorem.words(4),
        status: faker.helpers.arrayElement(['open', 'closed', 'pending']),
        priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
        channel: faker.helpers.arrayElement(['email', 'sms', 'chat', 'phone']),
        messages,
        tags: faker.helpers.arrayElements(['support', 'sales', 'billing', 'technical'], { min: 1, max: 2 })
      };
      conversations.push(conversation);
    }

    const createdConversations = await Conversation.insertMany(conversations);
    logSuccess(`Created ${createdConversations.length} conversations`);
    return createdConversations;
  }

  // Generate sample reviews
  async generateReviews(count = 25) {
    logInfo(`Generating ${count} sample reviews...`);
    
    const reviews = [];
    
    for (let i = 0; i < count; i++) {
      const review = {
        contactId: faker.helpers.arrayElement(this.contacts)._id,
        userId: faker.helpers.arrayElement(this.users)._id,
        platform: faker.helpers.arrayElement(['google', 'facebook', 'yelp', 'trustpilot', 'internal']),
        rating: faker.number.int({ min: 1, max: 5 }),
        title: faker.lorem.words(5),
        content: faker.lorem.paragraphs(2),
        status: faker.helpers.arrayElement(['pending', 'approved', 'rejected']),
        isPublic: faker.datatype.boolean(),
        reviewDate: faker.date.recent({ days: 90 }),
        response: faker.datatype.boolean() ? {
          content: faker.lorem.paragraph(),
          respondedBy: faker.helpers.arrayElement(this.users)._id,
          respondedAt: faker.date.recent({ days: 30 })
        } : undefined
      };
      reviews.push(review);
    }

    const createdReviews = await Review.insertMany(reviews);
    logSuccess(`Created ${createdReviews.length} reviews`);
    return createdReviews;
  }

  // Generate sample websites
  async generateWebsites(count = 3) {
    logInfo(`Generating ${count} sample websites...`);
    
    const websites = [];
    
    for (let i = 0; i < count; i++) {
      const website = {
        name: faker.company.name() + ' Website',
        domain: faker.internet.domainName(),
        userId: faker.helpers.arrayElement(this.users)._id,
        status: faker.helpers.arrayElement(['active', 'inactive', 'maintenance']),
        template: faker.helpers.arrayElement(['business', 'portfolio', 'ecommerce', 'blog']),
        settings: {
          title: faker.company.name(),
          description: faker.lorem.sentence(),
          keywords: faker.lorem.words(5).split(' '),
          favicon: faker.image.url(),
          logo: faker.image.url(),
          primaryColor: faker.internet.color(),
          secondaryColor: faker.internet.color(),
          font: faker.helpers.arrayElement(['Arial', 'Helvetica', 'Georgia', 'Times New Roman'])
        },
        pages: [
          {
            name: 'Home',
            slug: '/',
            title: 'Welcome to ' + faker.company.name(),
            content: faker.lorem.paragraphs(3),
            isPublished: true
          },
          {
            name: 'About',
            slug: '/about',
            title: 'About Us',
            content: faker.lorem.paragraphs(2),
            isPublished: true
          },
          {
            name: 'Contact',
            slug: '/contact',
            title: 'Contact Us',
            content: faker.lorem.paragraph(),
            isPublished: true
          }
        ],
        analytics: {
          visitors: faker.number.int({ min: 100, max: 10000 }),
          pageViews: faker.number.int({ min: 200, max: 50000 }),
          bounceRate: faker.number.float({ min: 0.2, max: 0.8, precision: 0.01 }),
          avgSessionDuration: faker.number.int({ min: 60, max: 600 })
        }
      };
      websites.push(website);
    }

    this.websites = await Website.insertMany(websites);
    logSuccess(`Created ${this.websites.length} websites`);
    return this.websites;
  }

  // Generate sample automations
  async generateAutomations(count = 8) {
    logInfo(`Generating ${count} sample automations...`);
    
    const automations = [];
    
    const automationTemplates = [
      {
        name: 'Welcome Email Series',
        description: 'Send welcome emails to new contacts',
        trigger: {
          type: 'contact_created',
          conditions: []
        },
        actions: [
          {
            type: 'send_email',
            delay: 0,
            settings: {
              template: 'welcome',
              subject: 'Welcome to our community!'
            }
          },
          {
            type: 'send_email',
            delay: 86400000, // 1 day
            settings: {
              template: 'getting_started',
              subject: 'Getting started guide'
            }
          }
        ]
      },
      {
        name: 'Lead Nurturing',
        description: 'Nurture leads through email sequence',
        trigger: {
          type: 'tag_added',
          conditions: [{ field: 'tags', operator: 'contains', value: 'lead' }]
        },
        actions: [
          {
            type: 'send_email',
            delay: 0,
            settings: {
              template: 'lead_nurture_1',
              subject: 'Thanks for your interest!'
            }
          },
          {
            type: 'add_to_pipeline',
            delay: 3600000, // 1 hour
            settings: {
              pipelineId: this.pipelines[0]?._id,
              stage: 'New Lead'
            }
          }
        ]
      },
      {
        name: 'Appointment Reminders',
        description: 'Send reminders for upcoming appointments',
        trigger: {
          type: 'appointment_scheduled',
          conditions: []
        },
        actions: [
          {
            type: 'send_email',
            delay: 86400000, // 1 day before
            settings: {
              template: 'appointment_reminder',
              subject: 'Reminder: Upcoming appointment'
            }
          },
          {
            type: 'send_sms',
            delay: 3600000, // 1 hour before
            settings: {
              message: 'Reminder: You have an appointment in 1 hour.'
            }
          }
        ]
      }
    ];

    for (let i = 0; i < count; i++) {
      const template = faker.helpers.arrayElement(automationTemplates);
      const automation = {
        ...template,
        name: template.name + (i > 2 ? ` ${i - 2}` : ''),
        userId: faker.helpers.arrayElement(this.users)._id,
        isActive: faker.datatype.boolean(),
        analytics: {
          triggered: faker.number.int({ min: 0, max: 100 }),
          completed: faker.number.int({ min: 0, max: 80 }),
          failed: faker.number.int({ min: 0, max: 5 })
        }
      };
      automations.push(automation);
    }

    this.automations = await Automation.insertMany(automations);
    logSuccess(`Created ${this.automations.length} automations`);
    return this.automations;
  }

  // Generate all sample data
  async generateAll() {
    logHeader('Generating Sample Data for GeekSuitePro');
    
    try {
      await this.generateUsers(5);
      await this.generatePipelines(3);
      await this.generateContacts(50);
      await this.generateCampaigns(10);
      await this.generateFunnels(5);
      await this.generateForms(8);
      await this.generateAppointments(20);
      await this.generateConversations(15);
      await this.generateReviews(25);
      await this.generateWebsites(3);
      await this.generateAutomations(8);
      
      logHeader('Sample Data Generation Complete!');
      logSuccess('All sample data has been created successfully!');
      
      log('\nGenerated:', 'blue');
      log(`• ${this.users.length} users (including admin@geeksuitepro.com)`);
      log(`• ${this.pipelines.length} pipelines`);
      log(`• ${this.contacts.length} contacts`);
      log(`• ${this.campaigns.length} campaigns`);
      log(`• ${this.funnels.length} funnels`);
      log(`• ${this.forms.length} forms`);
      log(`• 20 appointments`);
      log(`• 15 conversations`);
      log(`• 25 reviews`);
      log(`• ${this.websites.length} websites`);
      log(`• ${this.automations.length} automations`);
      
      log('\nDefault login credentials:', 'yellow');
      log('Email: admin@geeksuitepro.com');
      log('Password: admin123');
      
    } catch (error) {
      logError(`Error generating sample data: ${error.message}`);
      throw error;
    }
  }
}

// Main function
async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/geeksuitepro_dev';
    logInfo(`Connecting to MongoDB: ${mongoUri}`);
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    logSuccess('Connected to MongoDB');
    
    // Check if data already exists
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      logInfo(`Database already contains ${userCount} users`);
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Do you want to clear existing data and regenerate? (y/N): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        logInfo('Clearing existing data...');
        
        // Clear all collections
        const collections = [
          User, Contact, Campaign, Funnel, Form, 
          Appointment, Conversation, Review, Website, 
          Automation, Pipeline
        ];
        
        for (const Model of collections) {
          await Model.deleteMany({});
        }
        
        logSuccess('Existing data cleared');
      } else {
        logInfo('Keeping existing data. Exiting...');
        process.exit(0);
      }
    }
    
    // Generate sample data
    const generator = new SampleDataGenerator();
    await generator.generateAll();
    
  } catch (error) {
    logError(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logInfo('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = SampleDataGenerator;