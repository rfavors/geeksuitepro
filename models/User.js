const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    // Basic Information
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'First name is required' },
        len: { args: [1, 50], msg: 'First name cannot exceed 50 characters' }
      }
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Last name is required' },
        len: { args: [1, 50], msg: 'Last name cannot exceed 50 characters' }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: { msg: 'Please enter a valid email' }
      },
      set(value) {
        this.setDataValue('email', value.toLowerCase());
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: { args: [6, 255], msg: 'Password must be at least 6 characters' }
      }
    },
    phone: {
      type: DataTypes.STRING
    },
    company: {
      type: DataTypes.STRING
    },
    avatar: {
      type: DataTypes.STRING,
      defaultValue: ''
    },
    // Role and Permissions
    role: {
      type: DataTypes.ENUM('super_admin', 'agency_owner', 'agency_user', 'client_admin', 'client_user'),
      defaultValue: 'agency_owner'
    },
    permissions: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    // Agency/Organization
    agencyId: {
      type: DataTypes.UUID
    },
    clientId: {
      type: DataTypes.UUID
    },
    // White Label Settings
    whiteLabelSettings: {
      type: DataTypes.JSON,
      defaultValue: {
        brandName: 'GeekSuite Pro',
        logo: '',
        primaryColor: '#6366f1',
        secondaryColor: '#8b5cf6',
        customDomain: '',
        favicon: ''
      }
    },
    // Subscription and Billing
    subscription: {
      type: DataTypes.JSON,
      defaultValue: {
        plan: 'free',
        status: 'active',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false
      }
    },
    // Usage Limits
    limits: {
      type: DataTypes.JSON,
      defaultValue: {
        contacts: 1000,
        emailsPerMonth: 5000,
        smsPerMonth: 1000,
        campaigns: 100,
        funnels: 10,
        pipelines: 10,
        automations: 50,
        teamMembers: 3
      }
    },
    // Current Usage
    usage: {
      type: DataTypes.JSON,
      defaultValue: {
        contacts: 0,
        emailsThisMonth: 0,
        smsThisMonth: 0,
        campaigns: 0,
        funnels: 0,
        pipelines: 0,
        automations: 0,
        teamMembers: 1,
        lastResetDate: new Date()
      }
    },
    // Security
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    twoFactorSecret: {
      type: DataTypes.STRING
    },
    resetPasswordToken: {
      type: DataTypes.STRING
    },
    resetPasswordExpire: {
      type: DataTypes.DATE
    },
    emailVerificationToken: {
      type: DataTypes.STRING
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Activity
    lastLogin: {
      type: DataTypes.DATE
    },
    lastActivity: {
      type: DataTypes.DATE
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Preferences
    preferences: {
      type: DataTypes.JSON,
      defaultValue: {
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        language: 'en',
        notifications: {
          email: true,
          sms: false,
          push: true
        }
      }
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['email'] },
      { fields: ['agencyId'] },
      { fields: ['clientId'] }
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });

  // Instance methods
  User.prototype.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  };

  User.prototype.generateAuthToken = function() {
    return jwt.sign(
      { 
        id: this.id,
        email: this.email,
        role: this.role,
        agencyId: this.agencyId,
        clientId: this.clientId
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  };

  User.prototype.hasPermission = function(module, action) {
    if (this.role === 'super_admin') return true;
    
    const permission = this.permissions.find(p => p.module === module);
    return permission && permission.actions.includes(action);
  };

  User.prototype.canUse = function(resource) {
    const limit = this.limits[resource];
    const usage = this.usage[resource];
    return usage < limit;
  };

  User.prototype.incrementUsage = async function(resource, amount = 1) {
    const currentUsage = { ...this.usage };
    currentUsage[resource] += amount;
    this.usage = currentUsage;
    await this.save();
  };

  // Virtual for full name
  User.prototype.getFullName = function() {
    return `${this.firstName} ${this.lastName}`;
  };

  return User;
};