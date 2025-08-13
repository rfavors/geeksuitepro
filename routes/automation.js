const express = require('express');
const Automation = require('../models/Automation');
const Contact = require('../models/Contact');
const { auth, authorize, checkPermission, checkUsageLimit } = require('../middleware/auth');
const { validateAutomation, validatePagination } = require('../middleware/validation');
const router = express.Router();

// @route   GET /api/automation
// @desc    Get all automations with filtering and pagination
// @access  Private
router.get('/', 
  auth, 
  checkPermission('automations', 'read'),
  validatePagination,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        category,
        status,
        sort = '-createdAt'
      } = req.query;

      // Build filter query
      const filter = {
        ownerId: req.user.id,
        isArchived: false
      };

      // Add agency filter for agency users
      if (req.user.agencyId) {
        filter.agencyId = req.user.agencyId;
      }

      // Search filter
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Category filter
      if (category) {
        filter.category = category;
      }

      // Status filter
      if (status) {
        filter.status = status;
      }

      // Execute query with pagination
      const automations = await Automation.find(filter)
        .populate('ownerId', 'firstName lastName')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // Get total count for pagination
      const total = await Automation.countDocuments(filter);

      res.json({
        success: true,
        data: {
          automations,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });

    } catch (error) {
      console.error('Get automations error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/automation/:id
// @desc    Get single automation
// @access  Private
router.get('/:id', 
  auth, 
  checkPermission('automations', 'read'),
  async (req, res) => {
    try {
      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      })
      .populate('ownerId', 'firstName lastName')
      .populate('versions.createdBy', 'firstName lastName');

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      res.json({
        success: true,
        data: { automation }
      });

    } catch (error) {
      console.error('Get automation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/automation
// @desc    Create new automation
// @access  Private
router.post('/', 
  auth, 
  checkPermission('automations', 'create'),
  checkUsageLimit('automations'),
  validateAutomation,
  async (req, res) => {
    try {
      const automationData = {
        ...req.body,
        ownerId: req.user.id,
        agencyId: req.user.agencyId,
        clientId: req.user.clientId
      };

      const automation = new Automation(automationData);
      await automation.save();

      // Update user usage
      await req.user.updateUsage('automations', 1);

      res.status(201).json({
        success: true,
        message: 'Automation created successfully',
        data: { automation }
      });

    } catch (error) {
      console.error('Create automation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/automation/:id
// @desc    Update automation
// @access  Private
router.put('/:id', 
  auth, 
  checkPermission('automations', 'update'),
  validateAutomation,
  async (req, res) => {
    try {
      const automation = await Automation.findOneAndUpdate(
        {
          _id: req.params.id,
          ownerId: req.user.id,
          isArchived: false
        },
        req.body,
        { new: true, runValidators: true }
      );

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      res.json({
        success: true,
        message: 'Automation updated successfully',
        data: { automation }
      });

    } catch (error) {
      console.error('Update automation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/automation/:id
// @desc    Archive automation
// @access  Private
router.delete('/:id', 
  auth, 
  checkPermission('automations', 'delete'),
  async (req, res) => {
    try {
      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      });

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      await automation.archive();

      res.json({
        success: true,
        message: 'Automation archived successfully'
      });

    } catch (error) {
      console.error('Archive automation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/automation/:id/duplicate
// @desc    Duplicate automation
// @access  Private
router.post('/:id/duplicate', 
  auth, 
  checkPermission('automations', 'create'),
  checkUsageLimit('automations'),
  async (req, res) => {
    try {
      const originalAutomation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      });

      if (!originalAutomation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      const { name } = req.body;
      const duplicatedAutomation = await originalAutomation.duplicate(name || `${originalAutomation.name} (Copy)`);

      // Update user usage
      await req.user.updateUsage('automations', 1);

      res.status(201).json({
        success: true,
        message: 'Automation duplicated successfully',
        data: { automation: duplicatedAutomation }
      });

    } catch (error) {
      console.error('Duplicate automation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/automation/:id/activate
// @desc    Activate automation
// @access  Private
router.post('/:id/activate', 
  auth, 
  checkPermission('automations', 'update'),
  async (req, res) => {
    try {
      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      });

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      await automation.activate();

      res.json({
        success: true,
        message: 'Automation activated successfully',
        data: { automation }
      });

    } catch (error) {
      console.error('Activate automation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/automation/:id/pause
// @desc    Pause automation
// @access  Private
router.post('/:id/pause', 
  auth, 
  checkPermission('automations', 'update'),
  async (req, res) => {
    try {
      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      });

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      await automation.pause();

      res.json({
        success: true,
        message: 'Automation paused successfully',
        data: { automation }
      });

    } catch (error) {
      console.error('Pause automation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ AUTOMATION STEPS ROUTES ============

// @route   POST /api/automation/:id/steps
// @desc    Add step to automation
// @access  Private
router.post('/:id/steps', 
  auth, 
  checkPermission('automations', 'update'),
  async (req, res) => {
    try {
      const { type, name, config, position } = req.body;

      if (!type || !name) {
        return res.status(400).json({
          success: false,
          message: 'Step type and name are required'
        });
      }

      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      });

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      const step = automation.addStep({ type, name, config, position });
      await automation.save();

      res.status(201).json({
        success: true,
        message: 'Step added successfully',
        data: { step }
      });

    } catch (error) {
      console.error('Add step error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/automation/:id/steps/:stepId
// @desc    Update automation step
// @access  Private
router.put('/:id/steps/:stepId', 
  auth, 
  checkPermission('automations', 'update'),
  async (req, res) => {
    try {
      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      });

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      const step = automation.updateStep(req.params.stepId, req.body);
      await automation.save();

      res.json({
        success: true,
        message: 'Step updated successfully',
        data: { step }
      });

    } catch (error) {
      console.error('Update step error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/automation/:id/steps/:stepId
// @desc    Remove step from automation
// @access  Private
router.delete('/:id/steps/:stepId', 
  auth, 
  checkPermission('automations', 'update'),
  async (req, res) => {
    try {
      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      });

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      automation.removeStep(req.params.stepId);
      await automation.save();

      res.json({
        success: true,
        message: 'Step removed successfully'
      });

    } catch (error) {
      console.error('Remove step error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/automation/:id/steps/:stepId/connect/:targetStepId
// @desc    Connect automation steps
// @access  Private
router.post('/:id/steps/:stepId/connect/:targetStepId', 
  auth, 
  checkPermission('automations', 'update'),
  async (req, res) => {
    try {
      const { condition } = req.body;

      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      });

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      automation.connectSteps(req.params.stepId, req.params.targetStepId, condition);
      await automation.save();

      res.json({
        success: true,
        message: 'Steps connected successfully',
        data: { automation }
      });

    } catch (error) {
      console.error('Connect steps error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ AUTOMATION ANALYTICS ROUTES ============

// @route   GET /api/automation/:id/analytics
// @desc    Get automation analytics
// @access  Private
router.get('/:id/analytics', 
  auth, 
  checkPermission('automations', 'read'),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      });

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      // Calculate analytics
      const analytics = await automation.calculateAnalytics(startDate, endDate);

      res.json({
        success: true,
        data: { analytics }
      });

    } catch (error) {
      console.error('Get automation analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ AUTOMATION ENROLLMENT ROUTES ============

// @route   POST /api/automation/:id/enroll
// @desc    Manually enroll contacts in automation
// @access  Private
router.post('/:id/enroll', 
  auth, 
  checkPermission('automations', 'update'),
  async (req, res) => {
    try {
      const { contactIds } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Contact IDs array is required'
        });
      }

      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false,
        status: 'active'
      });

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Active automation not found'
        });
      }

      // Verify contacts belong to user
      const contacts = await Contact.find({
        _id: { $in: contactIds },
        ownerId: req.user.id,
        isDeleted: false
      });

      if (contacts.length !== contactIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some contacts not found or not accessible'
        });
      }

      // Enroll contacts (this would trigger the automation workflow)
      const enrollmentResults = [];
      for (const contact of contacts) {
        try {
          // Add enrollment logic here
          // This would typically involve creating automation enrollment records
          // and triggering the first step of the automation
          
          enrollmentResults.push({
            contactId: contact._id,
            success: true,
            message: 'Enrolled successfully'
          });
        } catch (error) {
          enrollmentResults.push({
            contactId: contact._id,
            success: false,
            message: error.message
          });
        }
      }

      res.json({
        success: true,
        message: 'Enrollment process completed',
        data: { results: enrollmentResults }
      });

    } catch (error) {
      console.error('Enroll contacts error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/automation/:id/enrollments
// @desc    Get automation enrollments
// @access  Private
router.get('/:id/enrollments', 
  auth, 
  checkPermission('automations', 'read'),
  validatePagination,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        sort = '-enrolledAt'
      } = req.query;

      const automation = await Automation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isArchived: false
      });

      if (!automation) {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }

      // This would typically query an AutomationEnrollment model
      // For now, returning mock data structure
      const enrollments = {
        data: [],
        pagination: {
          current: page,
          pages: 0,
          total: 0,
          limit
        }
      };

      res.json({
        success: true,
        data: enrollments
      });

    } catch (error) {
      console.error('Get enrollments error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ AUTOMATION TRIGGERS ROUTES ============

// @route   GET /api/automation/triggers
// @desc    Get available automation triggers
// @access  Private
router.get('/triggers', 
  auth, 
  checkPermission('automations', 'read'),
  async (req, res) => {
    try {
      const triggers = [
        {
          type: 'form_submission',
          name: 'Form Submission',
          description: 'Triggered when a contact submits a form',
          configFields: ['formId']
        },
        {
          type: 'tag_added',
          name: 'Tag Added',
          description: 'Triggered when a tag is added to a contact',
          configFields: ['tagName']
        },
        {
          type: 'tag_removed',
          name: 'Tag Removed',
          description: 'Triggered when a tag is removed from a contact',
          configFields: ['tagName']
        },
        {
          type: 'contact_created',
          name: 'Contact Created',
          description: 'Triggered when a new contact is created',
          configFields: []
        },
        {
          type: 'email_opened',
          name: 'Email Opened',
          description: 'Triggered when a contact opens an email',
          configFields: ['campaignId']
        },
        {
          type: 'email_clicked',
          name: 'Email Link Clicked',
          description: 'Triggered when a contact clicks a link in an email',
          configFields: ['campaignId', 'linkUrl']
        },
        {
          type: 'sms_received',
          name: 'SMS Received',
          description: 'Triggered when a contact sends an SMS',
          configFields: ['keyword']
        },
        {
          type: 'missed_call',
          name: 'Missed Call',
          description: 'Triggered when a contact calls but the call is missed',
          configFields: []
        },
        {
          type: 'appointment_booked',
          name: 'Appointment Booked',
          description: 'Triggered when a contact books an appointment',
          configFields: ['calendarId']
        },
        {
          type: 'pipeline_stage_changed',
          name: 'Pipeline Stage Changed',
          description: 'Triggered when a contact moves to a specific pipeline stage',
          configFields: ['pipelineId', 'stageId']
        },
        {
          type: 'date_based',
          name: 'Date/Time Based',
          description: 'Triggered at a specific date/time or interval',
          configFields: ['dateTime', 'recurring']
        },
        {
          type: 'webhook',
          name: 'Webhook',
          description: 'Triggered by an external webhook call',
          configFields: ['webhookUrl']
        }
      ];

      res.json({
        success: true,
        data: { triggers }
      });

    } catch (error) {
      console.error('Get triggers error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/automation/actions
// @desc    Get available automation actions
// @access  Private
router.get('/actions', 
  auth, 
  checkPermission('automations', 'read'),
  async (req, res) => {
    try {
      const actions = [
        {
          type: 'send_email',
          name: 'Send Email',
          description: 'Send an email to the contact',
          configFields: ['subject', 'content', 'template']
        },
        {
          type: 'send_sms',
          name: 'Send SMS',
          description: 'Send an SMS to the contact',
          configFields: ['message']
        },
        {
          type: 'add_tag',
          name: 'Add Tag',
          description: 'Add a tag to the contact',
          configFields: ['tagName']
        },
        {
          type: 'remove_tag',
          name: 'Remove Tag',
          description: 'Remove a tag from the contact',
          configFields: ['tagName']
        },
        {
          type: 'move_pipeline',
          name: 'Move in Pipeline',
          description: 'Move contact to a different pipeline stage',
          configFields: ['pipelineId', 'stageId']
        },
        {
          type: 'create_task',
          name: 'Create Task',
          description: 'Create a task for the contact',
          configFields: ['title', 'description', 'dueDate', 'assignedTo']
        },
        {
          type: 'book_appointment',
          name: 'Book Appointment',
          description: 'Create an appointment for the contact',
          configFields: ['title', 'dateTime', 'duration']
        },
        {
          type: 'webhook',
          name: 'Send Webhook',
          description: 'Send data to an external webhook URL',
          configFields: ['url', 'method', 'headers', 'payload']
        },
        {
          type: 'wait',
          name: 'Wait/Delay',
          description: 'Wait for a specified amount of time',
          configFields: ['duration', 'unit']
        },
        {
          type: 'condition',
          name: 'If/Else Condition',
          description: 'Branch the automation based on conditions',
          configFields: ['conditions', 'operator']
        },
        {
          type: 'goal',
          name: 'Goal',
          description: 'Set a goal that ends the automation when achieved',
          configFields: ['goalType', 'goalValue']
        }
      ];

      res.json({
        success: true,
        data: { actions }
      });

    } catch (error) {
      console.error('Get actions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

module.exports = router;