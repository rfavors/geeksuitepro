const express = require('express');
const Review = require('../models/Review');
const Contact = require('../models/Contact');
const { auth, authorize, checkPermission, checkUsageLimit } = require('../middleware/auth');
const { validateInput, validatePagination } = require('../middleware/validation');
const { sendEmail, sendSMS } = require('../utils/email');
const router = express.Router();

// @route   GET /api/reputation/reviews
// @desc    Get all reviews with filtering and pagination
// @access  Private
router.get('/reviews', 
  auth, 
  checkPermission('reputation', 'read'),
  validatePagination,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        platform,
        rating,
        status,
        sentiment,
        startDate,
        endDate,
        sort = '-createdAt'
      } = req.query;

      // Build filter query
      const filter = {
        ownerId: req.user.id,
        isDeleted: false
      };

      // Add agency filter for agency users
      if (req.user.agencyId) {
        filter.agencyId = req.user.agencyId;
      }

      // Search filter
      if (search) {
        filter.$or = [
          { reviewText: { $regex: search, $options: 'i' } },
          { reviewerName: { $regex: search, $options: 'i' } },
          { businessName: { $regex: search, $options: 'i' } },
          { response: { $regex: search, $options: 'i' } }
        ];
      }

      // Platform filter
      if (platform) {
        filter.platform = platform;
      }

      // Rating filter
      if (rating) {
        if (rating.includes('-')) {
          const [min, max] = rating.split('-').map(Number);
          filter.rating = { $gte: min, $lte: max };
        } else {
          filter.rating = Number(rating);
        }
      }

      // Status filter
      if (status) {
        filter.status = status;
      }

      // Sentiment filter
      if (sentiment) {
        filter.sentiment = sentiment;
      }

      // Date range filter
      if (startDate || endDate) {
        filter.reviewDate = {};
        if (startDate) filter.reviewDate.$gte = new Date(startDate);
        if (endDate) filter.reviewDate.$lte = new Date(endDate);
      }

      // Execute query with pagination
      const reviews = await Review.find(filter)
        .populate('contactId', 'firstName lastName email phone')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // Get total count for pagination
      const total = await Review.countDocuments(filter);

      res.json({
        success: true,
        data: {
          reviews,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });

    } catch (error) {
      console.error('Get reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/reputation/reviews/:id
// @desc    Get single review
// @access  Private
router.get('/reviews/:id', 
  auth, 
  checkPermission('reputation', 'read'),
  async (req, res) => {
    try {
      const review = await Review.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      })
      .populate('contactId', 'firstName lastName email phone')
      .populate('ownerId', 'firstName lastName email');

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      res.json({
        success: true,
        data: { review }
      });

    } catch (error) {
      console.error('Get review error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/reputation/reviews
// @desc    Create/Import review manually
// @access  Private
router.post('/reviews', 
  auth, 
  checkPermission('reputation', 'create'),
  checkUsageLimit('reviews'),
  validateInput([
    { field: 'reviewerName', required: true, type: 'string', maxLength: 100 },
    { field: 'reviewText', required: true, type: 'string', maxLength: 2000 },
    { field: 'rating', required: true, type: 'number', min: 1, max: 5 },
    { field: 'platform', required: true, type: 'string' },
    { field: 'reviewDate', required: false, type: 'date' }
  ]),
  async (req, res) => {
    try {
      const reviewData = {
        ...req.body,
        ownerId: req.user.id,
        agencyId: req.user.agencyId,
        clientId: req.user.clientId,
        source: 'manual',
        status: 'published'
      };

      // Analyze sentiment
      reviewData.sentiment = await Review.analyzeSentiment(req.body.reviewText, req.body.rating);

      const review = new Review(reviewData);
      await review.save();

      // Update user usage
      await req.user.updateUsage('reviews', 1);

      res.status(201).json({
        success: true,
        message: 'Review created successfully',
        data: { review }
      });

    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/reputation/reviews/:id/respond
// @desc    Respond to a review
// @access  Private
router.put('/reviews/:id/respond', 
  auth, 
  checkPermission('reputation', 'update'),
  validateInput([
    { field: 'response', required: true, type: 'string', maxLength: 1000 }
  ]),
  async (req, res) => {
    try {
      const review = await Review.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      await review.addResponse(req.body.response, req.user.id);

      res.json({
        success: true,
        message: 'Response added successfully',
        data: { review }
      });

    } catch (error) {
      console.error('Respond to review error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/reputation/reviews/:id/flag
// @desc    Flag/unflag a review
// @access  Private
router.put('/reviews/:id/flag', 
  auth, 
  checkPermission('reputation', 'update'),
  async (req, res) => {
    try {
      const { flagged, reason } = req.body;

      const review = await Review.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      review.flagged = flagged;
      if (flagged && reason) {
        review.flagReason = reason;
        review.flaggedAt = new Date();
      } else if (!flagged) {
        review.flagReason = undefined;
        review.flaggedAt = undefined;
      }

      await review.save();

      res.json({
        success: true,
        message: flagged ? 'Review flagged successfully' : 'Review unflagged successfully',
        data: { review }
      });

    } catch (error) {
      console.error('Flag review error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ REVIEW REQUESTS ============

// @route   POST /api/reputation/request-review
// @desc    Send review request to contact
// @access  Private
router.post('/request-review', 
  auth, 
  checkPermission('reputation', 'create'),
  checkUsageLimit('review_requests'),
  validateInput([
    { field: 'contactId', required: true, type: 'string' },
    { field: 'platform', required: true, type: 'string' },
    { field: 'method', required: true, type: 'string', enum: ['email', 'sms'] }
  ]),
  async (req, res) => {
    try {
      const { contactId, platform, method, customMessage, reviewUrl } = req.body;

      // Get contact
      const contact = await Contact.findOne({
        _id: contactId,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      // Check if contact has required communication method
      if (method === 'email' && !contact.email) {
        return res.status(400).json({
          success: false,
          message: 'Contact does not have an email address'
        });
      }

      if (method === 'sms' && !contact.phone) {
        return res.status(400).json({
          success: false,
          message: 'Contact does not have a phone number'
        });
      }

      // Create review request record
      const reviewRequest = {
        contactId,
        platform,
        method,
        customMessage,
        reviewUrl,
        requestedAt: new Date(),
        status: 'sent'
      };

      // Send review request
      const templateData = {
        contact,
        platform,
        reviewUrl: reviewUrl || `https://${platform}.com/review`,
        customMessage,
        businessName: req.user.businessName || 'Our Business'
      };

      if (method === 'email') {
        await sendEmail({
          to: contact.email,
          subject: `We'd love your feedback!`,
          template: 'review-request',
          data: templateData
        });
      } else if (method === 'sms') {
        const smsMessage = customMessage || 
          `Hi ${contact.firstName}, we'd love your feedback! Please leave us a review: ${reviewUrl || 'link'}`;
        
        await sendSMS({
          to: contact.phone,
          message: smsMessage
        });
      }

      // Add to contact's review requests
      contact.reviewRequests = contact.reviewRequests || [];
      contact.reviewRequests.push(reviewRequest);
      await contact.save();

      // Update user usage
      await req.user.updateUsage('review_requests', 1);

      res.json({
        success: true,
        message: 'Review request sent successfully',
        data: { reviewRequest }
      });

    } catch (error) {
      console.error('Send review request error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/reputation/bulk-request-review
// @desc    Send bulk review requests
// @access  Private
router.post('/bulk-request-review', 
  auth, 
  checkPermission('reputation', 'create'),
  validateInput([
    { field: 'contactIds', required: true, type: 'array' },
    { field: 'platform', required: true, type: 'string' },
    { field: 'method', required: true, type: 'string', enum: ['email', 'sms'] }
  ]),
  async (req, res) => {
    try {
      const { contactIds, platform, method, customMessage, reviewUrl } = req.body;

      if (contactIds.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Cannot send to more than 100 contacts at once'
        });
      }

      // Check usage limit
      const currentUsage = req.user.currentUsage.review_requests || 0;
      const limit = req.user.limits.review_requests || 1000;
      
      if (currentUsage + contactIds.length > limit) {
        return res.status(400).json({
          success: false,
          message: `This would exceed your review request limit. Current: ${currentUsage}, Limit: ${limit}`
        });
      }

      // Get contacts
      const contacts = await Contact.find({
        _id: { $in: contactIds },
        ownerId: req.user.id,
        isDeleted: false
      });

      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      // Send requests
      for (const contact of contacts) {
        try {
          // Check if contact has required communication method
          if (method === 'email' && !contact.email) {
            results.failed++;
            results.errors.push(`${contact.firstName} ${contact.lastName}: No email address`);
            continue;
          }

          if (method === 'sms' && !contact.phone) {
            results.failed++;
            results.errors.push(`${contact.firstName} ${contact.lastName}: No phone number`);
            continue;
          }

          // Create review request record
          const reviewRequest = {
            contactId: contact._id,
            platform,
            method,
            customMessage,
            reviewUrl,
            requestedAt: new Date(),
            status: 'sent'
          };

          // Send review request
          const templateData = {
            contact,
            platform,
            reviewUrl: reviewUrl || `https://${platform}.com/review`,
            customMessage,
            businessName: req.user.businessName || 'Our Business'
          };

          if (method === 'email') {
            await sendEmail({
              to: contact.email,
              subject: `We'd love your feedback!`,
              template: 'review-request',
              data: templateData
            });
          } else if (method === 'sms') {
            const smsMessage = customMessage || 
              `Hi ${contact.firstName}, we'd love your feedback! Please leave us a review: ${reviewUrl || 'link'}`;
            
            await sendSMS({
              to: contact.phone,
              message: smsMessage
            });
          }

          // Add to contact's review requests
          contact.reviewRequests = contact.reviewRequests || [];
          contact.reviewRequests.push(reviewRequest);
          await contact.save();

          results.sent++;

        } catch (error) {
          console.error(`Error sending to ${contact.email}:`, error);
          results.failed++;
          results.errors.push(`${contact.firstName} ${contact.lastName}: ${error.message}`);
        }
      }

      // Update user usage
      await req.user.updateUsage('review_requests', results.sent);

      res.json({
        success: true,
        message: `Review requests sent. Sent: ${results.sent}, Failed: ${results.failed}`,
        data: { results }
      });

    } catch (error) {
      console.error('Bulk review request error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ ANALYTICS AND REPORTING ============

// @route   GET /api/reputation/analytics
// @desc    Get reputation analytics
// @access  Private
router.get('/analytics', 
  auth, 
  checkPermission('reputation', 'read'),
  async (req, res) => {
    try {
      const { startDate, endDate, platform } = req.query;

      const analytics = await Review.getAnalytics(
        req.user.id,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        platform
      );

      res.json({
        success: true,
        data: { analytics }
      });

    } catch (error) {
      console.error('Get reputation analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/reputation/summary
// @desc    Get reputation summary
// @access  Private
router.get('/summary', 
  auth, 
  checkPermission('reputation', 'read'),
  async (req, res) => {
    try {
      const summary = await Review.getSummary(req.user.id);

      res.json({
        success: true,
        data: { summary }
      });

    } catch (error) {
      console.error('Get reputation summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/reputation/trends
// @desc    Get reputation trends over time
// @access  Private
router.get('/trends', 
  auth, 
  checkPermission('reputation', 'read'),
  async (req, res) => {
    try {
      const { period = 'month', startDate, endDate } = req.query;

      const trends = await Review.getTrends(
        req.user.id,
        period,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );

      res.json({
        success: true,
        data: { trends }
      });

    } catch (error) {
      console.error('Get reputation trends error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ PLATFORM INTEGRATION ============

// @route   POST /api/reputation/sync/:platform
// @desc    Sync reviews from external platform
// @access  Private
router.post('/sync/:platform', 
  auth, 
  checkPermission('reputation', 'create'),
  async (req, res) => {
    try {
      const { platform } = req.params;
      const { businessId, apiKey } = req.body;

      if (!['google', 'facebook', 'yelp', 'trustpilot'].includes(platform)) {
        return res.status(400).json({
          success: false,
          message: 'Unsupported platform'
        });
      }

      // This would integrate with actual platform APIs
      // For now, returning mock data
      const syncResult = {
        platform,
        synced: 0,
        errors: [],
        lastSync: new Date()
      };

      res.json({
        success: true,
        message: `${platform} reviews synced successfully`,
        data: { syncResult }
      });

    } catch (error) {
      console.error('Sync reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/reputation/platforms
// @desc    Get supported platforms and their status
// @access  Private
router.get('/platforms', 
  auth, 
  checkPermission('reputation', 'read'),
  async (req, res) => {
    try {
      const platforms = [
        {
          name: 'google',
          displayName: 'Google My Business',
          connected: false,
          lastSync: null,
          reviewCount: 0
        },
        {
          name: 'facebook',
          displayName: 'Facebook',
          connected: false,
          lastSync: null,
          reviewCount: 0
        },
        {
          name: 'yelp',
          displayName: 'Yelp',
          connected: false,
          lastSync: null,
          reviewCount: 0
        },
        {
          name: 'trustpilot',
          displayName: 'Trustpilot',
          connected: false,
          lastSync: null,
          reviewCount: 0
        }
      ];

      // Get actual review counts per platform
      for (const platform of platforms) {
        const count = await Review.countDocuments({
          ownerId: req.user.id,
          platform: platform.name,
          isDeleted: false
        });
        platform.reviewCount = count;
      }

      res.json({
        success: true,
        data: { platforms }
      });

    } catch (error) {
      console.error('Get platforms error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

module.exports = router;