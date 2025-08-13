const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { sendEmail } = require('../utils/email');
const rateLimit = require('express-rate-limit');
const { Op } = require('sequelize');

const router = express.Router();

// Rate limiting for auth routes (disabled in test environment)
const authLimiter = process.env.NODE_ENV === 'test' ? (req, res, next) => next() : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = process.env.NODE_ENV === 'test' ? (req, res, next) => next() : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter, validateInput([
  'firstName',
  'lastName',
  'email',
  'password'
]), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      phone,
      agencyName,
      role = 'agency_owner'
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Validate password confirmation
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        errors: ['Password must be at least 6 characters long']
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phone,
      role,
      emailVerificationToken: crypto.randomBytes(32).toString('hex')
    });

    // Generate JWT token
    const token = user.generateAuthToken();

    // Send verification email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome to GeekSuite Pro - Verify Your Email',
        template: 'email-verification',
        data: {
          firstName: user.firstName,
          verificationUrl: `${process.env.CLIENT_URL}/verify-email/${verificationToken}`
        }
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    // Remove sensitive data from response
    const userResponse = user.toJSON();
    delete userResponse.password;
    delete userResponse.emailVerificationToken;
    delete userResponse.twoFactorSecret;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginLimiter, validateInput([
  'email',
  'password'
]), async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ 
      where: {
        email: email.toLowerCase()
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Update last login
    await user.update({
      lastLogin: new Date(),
      lastActivity: new Date()
    });

    // Generate JWT token
    const token = user.generateAuthToken();

    // Remove sensitive data from response
    const userResponse = user.toJSON();
    delete userResponse.password;
    delete userResponse.emailVerificationToken;
    delete userResponse.twoFactorSecret;
    delete userResponse.resetPasswordToken;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token,
        expiresIn: rememberMe ? '30d' : '7d'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', auth, async (req, res) => {
  try {
    // Update last activity
    await User.update(
      { lastActivity: new Date() },
      { where: { id: req.user.id } }
    );

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update last activity
    user.lastActivity = new Date();
    await user.save();

    // Remove sensitive data from response
    const userResponse = user.toJSON();
    delete userResponse.password;
    delete userResponse.emailVerificationToken;
    delete userResponse.twoFactorSecret;
    delete userResponse.resetPasswordToken;

    res.json({
      success: true,
      data: { user: userResponse }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', authLimiter, validateInput(['email']), async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({
      where: {
        email: email.toLowerCase(),
        isActive: true
      }
    });

    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        success: true,
        message: 'Password reset email sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expireTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await user.update({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: expireTime
    });

    // Send reset email
    try {
      if (process.env.NODE_ENV === 'test') {
        console.log('Test mode: Skipping email send');
      } else {
        await sendEmail({
          to: user.email,
          subject: 'GeekSuite Pro - Password Reset Request',
          template: 'password-reset',
          data: {
            firstName: user.firstName,
            resetUrl: `${process.env.CLIENT_URL}/reset-password/${resetToken}`,
            expiresIn: '10 minutes'
          }
        });
      }
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      await user.update({
        resetPasswordToken: null,
        resetPasswordExpire: null
      });

      return res.status(500).json({
        success: false,
        message: 'Email could not be sent. Please try again later.'
      });
    }

    res.json({
      success: true,
      message: 'Password reset email sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password
// @access  Public
router.post('/reset-password/:token', authLimiter, validateInput(['password']), async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Hash token and find user
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { [Op.gt]: new Date() },
        isActive: true
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Set new password
    await user.update({
      password: password,
      resetPasswordToken: null,
      resetPasswordExpire: null
    });

    // Generate new JWT token
    const jwtToken = user.generateAuthToken();

    res.json({
      success: true,
      message: 'Password reset successful',
      data: { token: jwtToken }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/verify-email/:token
// @desc    Verify email address
// @access  Public
router.post('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      where: {
        emailVerificationToken: token,
        isActive: true
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    await user.update({
      emailVerified: true,
      emailVerificationToken: null
    });

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Resend email verification
// @access  Private
router.post('/resend-verification', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await user.update({
      emailVerificationToken: verificationToken
    });

    // Send verification email
    try {
      await sendEmail({
        to: user.email,
        subject: 'GeekSuite Pro - Verify Your Email',
        template: 'email-verification',
        data: {
          firstName: user.firstName,
          verificationUrl: `${process.env.CLIENT_URL}/verify-email/${user.emailVerificationToken}`
        }
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, validateInput([
  'currentPassword',
  'newPassword',
  'confirmPassword'
]), async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate new password
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    // Get user with password
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      avatar,
      preferences
    } = req.body;

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          errors: ['Please provide a valid email address']
        });
      }
    }

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (company) updateData.company = company;
    if (avatar) updateData.avatar = avatar;
    if (preferences) updateData.preferences = { ...updateData.preferences, ...preferences };

    const [updatedRowsCount] = await User.update(updateData, {
      where: { id: req.user.id },
      returning: true
    });
    
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh-token', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new token
    const token = user.generateAuthToken();

    res.json({
      success: true,
      data: { token }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;