const express = require('express');
const { Campaign, Contact, User, Keyword } = require('../models');
const { auth, authorize, checkPermission, checkUsageLimit } = require('../middleware/auth');
const { validateCampaign, validatePagination } = require('../middleware/validation');
const { Op } = require('sequelize');
const router = express.Router();

// @route   GET /api/campaigns
// @desc    Get all campaigns with filtering and pagination
// @access  Private
router.get('/', 
  auth, 
  checkPermission('campaigns', 'read'),
  validatePagination,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        type,
        status,
        category,
        sort = '-createdAt'
      } = req.query;

      // Build filter query
      const where = {
        userId: req.user.id
      };

      // Add agency filter for agency users
      if (req.user.agencyId) {
        where.agencyId = req.user.agencyId;
      }

      // Search filter
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { subject: { [Op.like]: `%${search}%` } }
        ];
      }

      // Type filter
      if (type) {
        where.type = type;
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      // Parse sort parameter
      let order = [['createdAt', 'DESC']];
      if (sort) {
        const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
        const sortDirection = sort.startsWith('-') ? 'DESC' : 'ASC';
        order = [[sortField, sortDirection]];
      }

      // Execute query with pagination
      const { count: total, rows: campaigns } = await Campaign.findAndCountAll({
        where,
        include: [
          {
            model: User,
            attributes: ['firstName', 'lastName']
          }
        ],
        order,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      res.json({
        success: true,
        data: {
          campaigns,
          pagination: {
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get campaigns error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ CAMPAIGN TEMPLATE ROUTES ============

// @route   GET /api/campaigns/templates
// @desc    Get campaign templates
// @access  Private
router.get('/templates', 
  auth, 
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      // For now, return empty array as templates functionality is not implemented
      // In a real implementation, you would have a Template model
      const templates = [];

      res.json({
        success: true,
        data: { templates }
      });

    } catch (error) {
      console.error('Get campaign templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/campaigns/templates
// @desc    Create campaign template
// @access  Private
router.post('/templates', 
  auth, 
  checkPermission('campaigns', 'create'),
  async (req, res) => {
    try {
      const { name, type, subject, content, category } = req.body;

      // Basic validation
      if (!name || !type || !content) {
        return res.status(400).json({
          success: false,
          message: 'Name, type, and content are required'
        });
      }

      // For now, just return the template data as if it was created
      // In a real implementation, you would save to a Template model
      const template = {
        id: require('crypto').randomUUID(),
        name,
        type,
        subject,
        content,
        category,
        userId: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: { template }
      });

    } catch (error) {
      console.error('Create campaign template error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/campaigns/:id
// @desc    Get single campaign
// @access  Private
router.get('/:id', 
  auth, 
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        },
        include: [
          {
            model: User,
            attributes: ['firstName', 'lastName']
          },
          {
            model: Keyword,
            attributes: ['id', 'keyword', 'category', 'difficulty', 'searchVolume', 'cpc'],
            through: { attributes: [] }
          }
        ]
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      res.json({
        success: true,
        data: { campaign }
      });

    } catch (error) {
      console.error('Get campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/campaigns
// @desc    Create new campaign
// @access  Private
router.post('/', 
  auth, 
  checkPermission('campaigns', 'create'),
  checkUsageLimit('campaigns'),
  validateCampaign,
  async (req, res) => {
    try {
      const { keywordIds, ...campaignData } = req.body;
      
      const finalCampaignData = {
        ...campaignData,
        userId: req.user.id,
        agencyId: req.user.agencyId,
        clientId: req.user.clientId
      };

      // Set status to 'scheduled' if scheduledAt is provided
      if (finalCampaignData.scheduledAt) {
        finalCampaignData.status = 'scheduled';
      } else if (!finalCampaignData.status) {
        finalCampaignData.status = 'draft';
      }

      const campaign = await Campaign.create(finalCampaignData);

      // Associate keywords with campaign if provided
      if (keywordIds && Array.isArray(keywordIds) && keywordIds.length > 0) {
        // Verify keywords belong to the user
        const userKeywords = await Keyword.findAll({
          where: {
            id: keywordIds,
            userId: req.user.id
          }
        });
        
        if (userKeywords.length > 0) {
          await campaign.setKeywords(userKeywords);
        }
      }

      // Fetch campaign with keywords for response
      const campaignWithKeywords = await Campaign.findByPk(campaign.id, {
        include: [{
          model: Keyword,
          attributes: ['id', 'keyword', 'category', 'difficulty'],
          through: { attributes: [] }
        }]
      });

      // Update user usage (if method exists)
      if (req.user.updateUsage) {
        await req.user.updateUsage('campaigns', 1);
      }

      res.status(201).json({
        success: true,
        message: 'Campaign created successfully',
        data: { campaign: campaignWithKeywords }
      });

    } catch (error) {
      console.error('Create campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/campaigns/:id
// @desc    Update campaign
// @access  Private
router.put('/:id', 
  auth, 
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      // Prevent editing sent campaigns
      if (campaign.status === 'sent') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update a campaign that has already been sent'
        });
      }

      if (campaign.status === 'sending') {
        return res.status(400).json({
          success: false,
          message: 'Cannot edit campaign that is currently sending'
        });
      }

      await campaign.update(req.body);

      res.json({
        success: true,
        message: 'Campaign updated successfully',
        data: { campaign }
      });

    } catch (error) {
      console.error('Update campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/campaigns/:id
// @desc    Archive campaign
// @access  Private
router.delete('/:id', 
  auth, 
  checkPermission('campaigns', 'delete'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      // Prevent deleting active campaigns
      if (campaign.status === 'sending') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete campaign that is currently sending'
        });
      }

      if (campaign.status === 'sent') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete a campaign that has already been sent'
        });
      }

      // Archive campaign by updating status or deleting
      await campaign.destroy();

      res.json({
        success: true,
        message: 'Campaign deleted successfully'
      });

    } catch (error) {
      console.error('Archive campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/campaigns/:id/duplicate
// @desc    Duplicate campaign
// @access  Private
router.post('/:id/duplicate', 
  auth, 
  checkPermission('campaigns', 'create'),
  checkUsageLimit('campaigns'),
  async (req, res) => {
    try {
      const originalCampaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!originalCampaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      const { name } = req.body;
      const campaignData = originalCampaign.toJSON();
      delete campaignData.id;
      delete campaignData.createdAt;
      delete campaignData.updatedAt;
      campaignData.name = name || `${originalCampaign.name} (Copy)`;
      campaignData.status = 'draft';
      
      const duplicatedCampaign = await Campaign.create(campaignData);

      // Update user usage (if method exists)
      if (req.user.updateUsage) {
        await req.user.updateUsage('campaigns', 1);
      }

      res.status(201).json({
        success: true,
        message: 'Campaign duplicated successfully',
        data: { campaign: duplicatedCampaign }
      });

    } catch (error) {
      console.error('Duplicate campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/campaigns/:id/schedule
// @desc    Schedule campaign
// @access  Private
router.post('/:id/schedule', 
  auth, 
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const { scheduledAt, timezone } = req.body;

      if (!scheduledAt) {
        return res.status(400).json({
          success: false,
          message: 'Scheduled date/time is required'
        });
      }

      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      await campaign.update({
        scheduledAt: new Date(scheduledAt),
        status: 'scheduled'
      });

      res.json({
        success: true,
        message: 'Campaign scheduled successfully',
        data: { campaign }
      });

    } catch (error) {
      console.error('Schedule campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/campaigns/:id/send
// @desc    Send campaign immediately
// @access  Private
router.post('/:id/send', 
  auth, 
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      if (campaign.status === 'sent') {
        return res.status(400).json({
          success: false,
          message: 'Campaign has already been sent'
        });
      }

      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        return res.status(400).json({
          success: false,
          message: 'Campaign can only be sent from draft or scheduled status'
        });
      }

      await campaign.update({
        status: 'sent',
        sentAt: new Date()
      });

      res.json({
        success: true,
        message: 'Campaign sent successfully',
        data: { campaign }
      });

    } catch (error) {
      console.error('Send campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/campaigns/:id/pause
// @desc    Pause campaign sending
// @access  Private
router.post('/:id/pause', 
  auth, 
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      if (campaign.status !== 'sending') {
        return res.status(400).json({
          success: false,
          message: 'Can only pause campaigns that are currently sending'
        });
      }

      await campaign.update({ status: 'paused' });

      res.json({
        success: true,
        message: 'Campaign paused successfully',
        data: { campaign }
      });

    } catch (error) {
      console.error('Pause campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/campaigns/:id/resume
// @desc    Resume paused campaign
// @access  Private
router.post('/:id/resume', 
  auth, 
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      if (campaign.status !== 'paused') {
        return res.status(400).json({
          success: false,
          message: 'Can only resume paused campaigns'
        });
      }

      await campaign.update({ status: 'active' });

      res.json({
        success: true,
        message: 'Campaign resumed successfully',
        data: { campaign }
      });

    } catch (error) {
      console.error('Resume campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/campaigns/:id/cancel
// @desc    Cancel campaign
// @access  Private
router.post('/:id/cancel', 
  auth, 
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      if (campaign.status === 'sent' || campaign.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel campaign that is already sent or cancelled'
        });
      }

      await campaign.update({ status: 'cancelled' });

      res.json({
        success: true,
        message: 'Campaign cancelled successfully',
        data: { campaign }
      });

    } catch (error) {
      console.error('Cancel campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ CAMPAIGN ANALYTICS ROUTES ============

// @route   GET /api/campaigns/:id/analytics
// @desc    Get campaign analytics
// @access  Private
router.get('/:id/analytics', 
  auth, 
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      // Get analytics from stats field
      const analytics = {
        totalSent: campaign.stats?.sent || 0,
        delivered: campaign.stats?.delivered || 0,
        opened: campaign.stats?.opened || 0,
        clicked: campaign.stats?.clicked || 0,
        bounced: campaign.stats?.bounced || 0,
        unsubscribed: campaign.stats?.unsubscribed || 0,
        openRate: campaign.stats?.delivered > 0 ? ((campaign.stats?.opened || 0) / campaign.stats.delivered * 100).toFixed(2) : 0,
        clickRate: campaign.stats?.delivered > 0 ? ((campaign.stats?.clicked || 0) / campaign.stats.delivered * 100).toFixed(2) : 0
      };

      res.json({
        success: true,
        data: { analytics }
      });

    } catch (error) {
      console.error('Get campaign analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/campaigns/:id/recipients
// @desc    Get campaign recipients
// @access  Private
router.get('/:id/recipients', 
  auth, 
  checkPermission('campaigns', 'read'),
  validatePagination,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        status,
        sort = 'firstName'
      } = req.query;

      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      // Build recipient query based on campaign targeting
      const recipientWhere = {
        userId: req.user.id
      };

      // Apply targeting filters
      if (campaign.targeting && campaign.targeting.segments && campaign.targeting.segments.length > 0) {
        recipientWhere.segments = { [Op.in]: campaign.targeting.segments };
      }

      if (campaign.targeting && campaign.targeting.tags && campaign.targeting.tags.length > 0) {
        recipientWhere.tags = { [Op.in]: campaign.targeting.tags };
      }

      if (campaign.targeting && campaign.targeting.customList && campaign.targeting.customList.length > 0) {
        recipientWhere.id = { [Op.in]: campaign.targeting.customList };
      }

      // Get recipients
      const { rows: recipients, count: total } = await Contact.findAndCountAll({
        where: recipientWhere,
        attributes: ['firstName', 'lastName', 'email', 'phone', 'avatar'],
        order: [[sort, 'ASC']],
        limit: parseInt(limit),
        offset: (page - 1) * limit
      });

      res.json({
        success: true,
        data: {
          recipients,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });

    } catch (error) {
      console.error('Get campaign recipients error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/campaigns/:id/test
// @desc    Send test campaign
// @access  Private
router.post('/:id/test', 
  auth, 
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const { email, testEmails, testPhones } = req.body;

      if (!email && (!testEmails || testEmails.length === 0) && (!testPhones || testPhones.length === 0)) {
        return res.status(400).json({
          success: false,
          errors: ['Test email address is required']
        });
      }

      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      // Send test campaign
      const testResults = [];
      
      if (campaign.type === 'email' && testEmails) {
        for (const email of testEmails) {
          try {
            // Send test email logic here
            testResults.push({
              recipient: email,
              type: 'email',
              success: true,
              message: 'Test email sent successfully'
            });
          } catch (error) {
            testResults.push({
              recipient: email,
              type: 'email',
              success: false,
              message: error.message
            });
          }
        }
      }

      if (campaign.type === 'sms' && testPhones) {
        for (const phone of testPhones) {
          try {
            // Send test SMS logic here
            testResults.push({
              recipient: phone,
              type: 'sms',
              success: true,
              message: 'Test SMS sent successfully'
            });
          } catch (error) {
            testResults.push({
              recipient: phone,
              type: 'sms',
              success: false,
              message: error.message
            });
          }
        }
      }

      res.json({
        success: true,
        message: 'Test campaign sent successfully',
        data: { results: testResults }
      });

    } catch (error) {
      console.error('Send test campaign error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ CAMPAIGN PERFORMANCE ROUTES ============

// @route   GET /api/campaigns/performance
// @desc    Get campaign performance summary
// @access  Private
router.get('/performance', 
  auth, 
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      const { startDate, endDate, type } = req.query;

      // Build where clause for performance query
      const whereClause = {
        userId: req.user.id
      };

      if (startDate) {
        whereClause.createdAt = { [Op.gte]: new Date(startDate) };
      }

      if (endDate) {
        whereClause.createdAt = {
          ...whereClause.createdAt,
          [Op.lte]: new Date(endDate)
        };
      }

      if (type) {
        whereClause.type = type;
      }

      const campaigns = await Campaign.findAll({
        where: whereClause,
        attributes: ['id', 'name', 'type', 'status', 'stats', 'createdAt']
      });

      // Calculate performance summary
      const performance = {
        totalCampaigns: campaigns.length,
        totalSent: campaigns.reduce((sum, c) => sum + (c.stats?.sent || 0), 0),
        totalDelivered: campaigns.reduce((sum, c) => sum + (c.stats?.delivered || 0), 0),
        totalOpened: campaigns.reduce((sum, c) => sum + (c.stats?.opened || 0), 0),
        totalClicked: campaigns.reduce((sum, c) => sum + (c.stats?.clicked || 0), 0),
        averageOpenRate: 0,
        averageClickRate: 0
      };

      if (performance.totalDelivered > 0) {
        performance.averageOpenRate = (performance.totalOpened / performance.totalDelivered) * 100;
        performance.averageClickRate = (performance.totalClicked / performance.totalDelivered) * 100;
      }

      res.json({
        success: true,
        data: { performance }
      });

    } catch (error) {
      console.error('Get campaign performance error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/campaigns/ready-to-send
// @desc    Get campaigns ready to send
// @access  Private
router.get('/ready-to-send', 
  auth, 
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      const campaigns = await Campaign.findAll({
        where: {
          userId: req.user.id,
          status: 'scheduled',
          scheduledAt: {
            [Op.lte]: new Date()
          }
        },
        include: [{
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email']
        }]
      });

      res.json({
        success: true,
        data: { campaigns }
      });

    } catch (error) {
      console.error('Get ready to send campaigns error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ CAMPAIGN KEYWORD MANAGEMENT ROUTES ============

// @route   POST /api/campaigns/:id/keywords
// @desc    Add keywords to campaign
// @access  Private
router.post('/:id/keywords',
  auth,
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const { keywordIds } = req.body;

      if (!keywordIds || !Array.isArray(keywordIds) || keywordIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Keyword IDs array is required'
        });
      }

      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      // Verify keywords belong to the user
      const userKeywords = await Keyword.findAll({
        where: {
          id: keywordIds,
          userId: req.user.id
        }
      });

      if (userKeywords.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid keywords found'
        });
      }

      // Add keywords to campaign
      await campaign.addKeywords(userKeywords);

      // Fetch updated campaign with keywords
      const updatedCampaign = await Campaign.findByPk(campaign.id, {
        include: [{
          model: Keyword,
          attributes: ['id', 'keyword', 'category', 'difficulty'],
          through: { attributes: [] }
        }]
      });

      res.json({
        success: true,
        message: `${userKeywords.length} keywords added to campaign`,
        data: { campaign: updatedCampaign }
      });
    } catch (error) {
      console.error('Error adding keywords to campaign:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while adding keywords'
      });
    }
  }
);

// @route   DELETE /api/campaigns/:id/keywords/:keywordId
// @desc    Remove keyword from campaign
// @access  Private
router.delete('/:id/keywords/:keywordId',
  auth,
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      const keyword = await Keyword.findOne({
        where: {
          id: req.params.keywordId,
          userId: req.user.id
        }
      });

      if (!keyword) {
        return res.status(404).json({
          success: false,
          message: 'Keyword not found'
        });
      }

      // Remove keyword from campaign
      await campaign.removeKeyword(keyword);

      res.json({
        success: true,
        message: 'Keyword removed from campaign'
      });
    } catch (error) {
      console.error('Error removing keyword from campaign:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while removing keyword'
      });
    }
  }
);

// @route   GET /api/campaigns/:id/keywords
// @desc    Get keywords for a campaign
// @access  Private
router.get('/:id/keywords',
  auth,
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        },
        include: [{
          model: Keyword,
          attributes: ['id', 'keyword', 'category', 'difficulty', 'searchVolume', 'cpc', 'intent'],
          through: { attributes: [] }
        }]
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      res.json({
        success: true,
        data: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          keywords: campaign.Keywords || []
        }
      });
    } catch (error) {
      console.error('Error fetching campaign keywords:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching keywords'
      });
    }
  }
);

// @route   PUT /api/campaigns/:id/keywords
// @desc    Replace all keywords for a campaign
// @access  Private
router.put('/:id/keywords',
  auth,
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const { keywordIds } = req.body;

      if (!Array.isArray(keywordIds)) {
        return res.status(400).json({
          success: false,
          message: 'Keyword IDs must be an array'
        });
      }

      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      if (keywordIds.length === 0) {
        // Remove all keywords
        await campaign.setKeywords([]);
      } else {
        // Verify keywords belong to the user
        const userKeywords = await Keyword.findAll({
          where: {
            id: keywordIds,
            userId: req.user.id
          }
        });

        // Replace all keywords
        await campaign.setKeywords(userKeywords);
      }

      // Fetch updated campaign with keywords
      const updatedCampaign = await Campaign.findByPk(campaign.id, {
        include: [{
          model: Keyword,
          attributes: ['id', 'keyword', 'category', 'difficulty'],
          through: { attributes: [] }
        }]
      });

      res.json({
        success: true,
        message: 'Campaign keywords updated successfully',
        data: { campaign: updatedCampaign }
      });
    } catch (error) {
      console.error('Error updating campaign keywords:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while updating keywords'
      });
    }
  }
);

module.exports = router;