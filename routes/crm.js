const express = require('express');
const { Contact, Pipeline } = require('../models');
const { auth, authorize, checkPermission, checkAgencyOwnership, checkUsageLimit } = require('../middleware/auth');
const { validateContact, validatePipeline, validatePagination } = require('../middleware/validation');
const router = express.Router();

// ============ CONTACT ROUTES ============

// @route   GET /api/crm/contacts
// @desc    Get all contacts with filtering and pagination
// @access  Private
router.get('/contacts', 
  auth, 
  checkPermission('contacts', 'read'),
  validatePagination,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        tags,
        segment,
        leadStatus,
        pipelineId,
        stageId,
        source,
        sort = '-createdAt'
      } = req.query;

      const { Op } = require('sequelize');
      
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
          { firstName: { [Op.like]: `%${search}%` } },
          { lastName: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
          { company: { [Op.like]: `%${search}%` } }
        ];
      }

      // Tags filter
      if (tags) {
        const tagArray = tags.split(',');
        where.tags = { [Op.overlap]: tagArray };
      }

      // Segment filter
      if (segment) {
        where.segments = { [Op.contains]: [segment] };
      }

      // Lead status filter
      if (leadStatus) {
        where['$lead.status$'] = leadStatus;
      }

      // Pipeline filter
      if (pipelineId) {
        where.pipelineId = pipelineId;
      }

      // Stage filter
      if (stageId) {
        where.stageId = stageId;
      }

      // Source filter
      if (source) {
        where['$lead.source$'] = source;
      }

      // Parse sort parameter
      let order = [['createdAt', 'DESC']];
      if (sort) {
        const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
        const sortDirection = sort.startsWith('-') ? 'DESC' : 'ASC';
        order = [[sortField, sortDirection]];
      }

      // Execute query with pagination
      const { count, rows: contacts } = await Contact.findAndCountAll({
        where,
        include: [
          {
            model: Pipeline,
            attributes: ['name']
          }
        ],
        order,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      const total = count;

      res.json({
        success: true,
        data: {
          contacts,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });

    } catch (error) {
      console.error('Get contacts error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/crm/contacts/:id
// @desc    Get single contact
// @access  Private
router.get('/contacts/:id', 
  auth, 
  checkPermission('contacts', 'read'),
  async (req, res) => {
    try {
      // Validate contact ID
      if (isNaN(parseInt(req.params.id)) || parseInt(req.params.id) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid contact ID'
        });
      }

      const contact = await Contact.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        },
        include: [
          {
            model: Pipeline,
            attributes: ['name', 'stages']
          }
        ]
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      res.json({
        success: true,
        data: { contact }
      });

    } catch (error) {
      console.error('Get contact error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/crm/contacts
// @desc    Create new contact
// @access  Private
router.post('/contacts', 
  auth, 
  checkPermission('contacts', 'create'),
  checkUsageLimit('contacts'),
  async (req, res) => {
    try {
      const { Op } = require('sequelize');
      
      // Validate contact data first
      const errors = [];
      const { firstName, lastName, email, phone, company } = req.body;

      // At least one of firstName, lastName, email, or company is required
      if (!firstName && !lastName && !email && !company) {
        errors.push('At least one of firstName, lastName, email, or company is required');
      }

      // Validate email if provided
      if (email && !require('validator').isEmail(email)) {
        errors.push('Please provide a valid email address');
      }

      // Validate phone if provided
      if (phone && !require('validator').isMobilePhone(phone, 'any', { strictMode: false })) {
        errors.push('Please provide a valid phone number');
      }

      if (errors.length > 0) {
         return res.status(400).json({
           success: false,
           message: 'Contact validation failed',
           errors
         });
       }
      
      // Check for duplicates (only check email if provided)
      if (email) {
        const existingContact = await Contact.findOne({
          where: {
            email: req.body.email,
            userId: req.user.id
          }
        });

        if (existingContact) {
          return res.status(400).json({
            success: false,
            message: 'Contact with this email already exists',
            duplicateContact: existingContact
          });
        }
      }

      const contactData = {
        ...req.body,
        userId: req.user.id,
        agencyId: req.user.agencyId,
        clientId: req.user.clientId
      };

      const contact = await Contact.create(contactData);

      // Update user usage
      await req.user.incrementUsage('contacts', 1);

      res.status(201).json({
        success: true,
        message: 'Contact created successfully',
        data: { contact }
      });

    } catch (error) {
      console.error('Create contact error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/crm/contacts/:id
// @desc    Update contact
// @access  Private
router.put('/contacts/:id', 
  auth, 
  checkPermission('contacts', 'update'),
  async (req, res) => {
    try {
      const { Op } = require('sequelize');
      
      // Validate contact data
      const { firstName, lastName, email, phone, company } = req.body;
      const errors = [];
      
      // At least one of firstName, lastName, email, or company is required
      if (!firstName && !lastName && !email && !company) {
        errors.push('At least one of firstName, lastName, email, or company is required');
      }
      
      // Validate email if provided
      if (email && !require('validator').isEmail(email)) {
        errors.push('Please provide a valid email address');
      }
      
      // Validate phone if provided
      if (phone && !require('validator').isMobilePhone(phone, 'any', { strictMode: false })) {
        errors.push('Please provide a valid phone number');
      }
      
      // Validate lead score if provided
      if (req.body.leadScore !== undefined) {
        const score = parseInt(req.body.leadScore);
        if (isNaN(score) || score < 0 || score > 100) {
          errors.push('Lead score must be a number between 0 and 100');
        }
      }
      
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Contact validation failed',
          errors
        });
      }
      
      const contact = await Contact.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      // Check for duplicate email if email is being updated
      if (req.body.email && req.body.email !== contact.email) {
        const existingContact = await Contact.findOne({
          where: {
            email: req.body.email,
            userId: req.user.id,
            id: { [Op.ne]: req.params.id }
          }
        });

        if (existingContact) {
          return res.status(400).json({
            success: false,
            message: 'Contact with this email already exists'
          });
        }
      }

      await contact.update(req.body);

      res.json({
        success: true,
        message: 'Contact updated successfully',
        data: { contact }
      });

    } catch (error) {
      console.error('Update contact error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/crm/contacts/:id
// @desc    Delete contact (soft delete)
// @access  Private
router.delete('/contacts/:id', 
  auth, 
  checkPermission('contacts', 'delete'),
  async (req, res) => {
    try {
      const contact = await Contact.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      await contact.destroy();

      res.json({
        success: true,
        message: 'Contact deleted successfully'
      });

    } catch (error) {
      console.error('Delete contact error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/crm/contacts/:id/notes
// @desc    Add note to contact
// @access  Private
router.post('/contacts/:id/notes', 
  auth, 
  checkPermission('contacts', 'update'),
  async (req, res) => {
    try {
      const { content, type = 'general' } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: ['Note content is required']
        });
      }

      const contact = await Contact.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      // Add note to contact's notes array
      const notes = contact.notes || [];
      notes.push({
        content,
        type,
        createdBy: req.user.id,
        createdAt: new Date()
      });
      
      await contact.update({ notes });

      res.json({
        success: true,
        message: 'Note added successfully',
        data: { contact }
      });

    } catch (error) {
      console.error('Add note error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/crm/contacts/:id/tags
// @desc    Add tags to contact
// @access  Private
router.post('/contacts/:id/tags', 
  auth, 
  checkPermission('contacts', 'update'),
  async (req, res) => {
    try {
      const { tags } = req.body;

      if (!tags || !Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          message: 'Tags array is required'
        });
      }

      const contact = await Contact.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      // Add tags to contact's tags array
      const existingTags = contact.tags || [];
      const newTags = [...new Set([...existingTags, ...tags])];
      
      await contact.update({ tags: newTags });

      res.json({
        success: true,
        message: 'Tags added successfully',
        data: { contact }
      });

    } catch (error) {
      console.error('Add tags error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/crm/contacts/:id/tags/:tag
// @desc    Remove tag from contact
// @access  Private
router.delete('/contacts/:id/tags/:tag', 
  auth, 
  checkPermission('contacts', 'update'),
  async (req, res) => {
    try {
      const contact = await Contact.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      // Remove tag from contact's tags array
      const existingTags = contact.tags || [];
      const updatedTags = existingTags.filter(tag => tag !== req.params.tag);
      
      await contact.update({ tags: updatedTags });

      res.json({
        success: true,
        message: 'Tag removed successfully',
        data: { contact }
      });

    } catch (error) {
      console.error('Remove tag error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/crm/contacts/:id/activities
// @desc    Add activity to contact
// @access  Private
router.post('/contacts/:id/activities', 
  auth, 
  checkPermission('contacts', 'update'),
  async (req, res) => {
    try {
      const { type, description, outcome } = req.body;

      // Validate activity type
      const validTypes = ['call', 'email', 'meeting', 'task', 'note'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          errors: ['Activity type must be one of: call, email, meeting, task, note']
        });
      }

      if (!description || description.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: ['Activity description is required']
        });
      }

      const contact = await Contact.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      // Add activity to contact's activities array
      const activities = contact.activities || [];
      activities.push({
        type,
        description,
        outcome,
        createdBy: req.user.id,
        createdAt: new Date()
      });
      
      await contact.update({ activities });

      res.json({
        success: true,
        message: 'Activity added successfully',
        data: { contact }
      });

    } catch (error) {
      console.error('Add activity error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ PIPELINE ROUTES ============

// @route   GET /api/crm/pipelines
// @desc    Get all pipelines
// @access  Private
router.get('/pipelines', 
  auth, 
  checkPermission('pipelines', 'read'),
  async (req, res) => {
    try {
      const where = {
        userId: req.user.id,
        isActive: true
      };

      if (req.user.agencyId) {
        where.agencyId = req.user.agencyId;
      }

      const pipelines = await Pipeline.findAll({
        where,
        order: [['name', 'ASC']]
      });

      res.json({
        success: true,
        data: { pipelines }
      });

    } catch (error) {
      console.error('Get pipelines error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/crm/pipelines/:id
// @desc    Get single pipeline with contacts
// @access  Private
router.get('/pipelines/:id', 
  auth, 
  checkPermission('pipelines', 'read'),
  async (req, res) => {
    try {
      const pipeline = await Pipeline.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id,
          isActive: true
        }
      });

      if (!pipeline) {
        return res.status(404).json({
          success: false,
          message: 'Pipeline not found'
        });
      }

      // Get contacts in this pipeline grouped by stage
      const contacts = await Contact.findAll({
        where: {
          pipelineId: req.params.id,
          userId: req.user.id
        },
        include: [
          {
            model: Pipeline,
            attributes: ['name']
          }
        ]
      });

      // Group contacts by stage
      const contactsByStage = {};
      if (pipeline.stages) {
        pipeline.stages.forEach(stage => {
          contactsByStage[stage.id] = contacts.filter(
            contact => contact.stageId === stage.id
          );
        });
      }

      res.json({
        success: true,
        data: {
          pipeline,
          contactsByStage
        }
      });

    } catch (error) {
      console.error('Get pipeline error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/crm/pipelines
// @desc    Create new pipeline
// @access  Private
router.post('/pipelines', 
  auth, 
  checkPermission('pipelines', 'create'),
  checkUsageLimit('pipelines'),
  validatePipeline,
  async (req, res) => {
    try {
      const pipelineData = {
        ...req.body,
        userId: req.user.id,
        agencyId: req.user.agencyId,
        clientId: req.user.clientId
      };

      const pipeline = await Pipeline.create(pipelineData);

      // Update user usage
      await req.user.incrementUsage('pipelines', 1);

      res.status(201).json({
        success: true,
        message: 'Pipeline created successfully',
        data: { pipeline }
      });

    } catch (error) {
      console.error('Create pipeline error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/crm/pipelines/:id
// @desc    Update pipeline
// @access  Private
router.put('/pipelines/:id', 
  auth, 
  checkPermission('pipelines', 'update'),
  validatePipeline,
  async (req, res) => {
    try {
      const pipeline = await Pipeline.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id,
          isActive: true
        }
      });

      if (!pipeline) {
        return res.status(404).json({
          success: false,
          message: 'Pipeline not found'
        });
      }

      await pipeline.update(req.body);

      res.json({
        success: true,
        message: 'Pipeline updated successfully',
        data: { pipeline }
      });

    } catch (error) {
      console.error('Update pipeline error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/crm/pipelines/:id
// @desc    Delete pipeline
// @access  Private
router.delete('/pipelines/:id', 
  auth, 
  checkPermission('pipelines', 'delete'),
  async (req, res) => {
    try {
      const pipeline = await Pipeline.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id,
          isActive: true
        }
      });

      if (!pipeline) {
        return res.status(404).json({
          success: false,
          message: 'Pipeline not found'
        });
      }

      // Check if pipeline has contacts
      const contactCount = await Contact.count({
        where: {
          pipelineId: req.params.id
        }
      });

      if (contactCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete pipeline with existing contacts. Please move contacts to another pipeline first.',
          contactCount
        });
      }

      await pipeline.update({ isActive: false });

      res.json({
        success: true,
        message: 'Pipeline deleted successfully'
      });

    } catch (error) {
      console.error('Delete pipeline error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/crm/pipelines/:id/stages
// @desc    Add stage to pipeline
// @access  Private
router.post('/pipelines/:id/stages', 
  auth, 
  checkPermission('pipelines', 'update'),
  async (req, res) => {
    try {
      const { name, description, color, probability } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Stage name is required'
        });
      }

      const pipeline = await Pipeline.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id,
          isActive: true
        }
      });

      if (!pipeline) {
        return res.status(404).json({
          success: false,
          message: 'Pipeline not found'
        });
      }

      // Add stage to pipeline's stages array
      const stages = pipeline.stages || [];
      const newStage = {
        id: Date.now().toString(), // Simple ID generation
        name,
        description,
        color,
        probability,
        createdAt: new Date()
      };
      stages.push(newStage);
      
      await pipeline.update({ stages });
      const stage = newStage;

      res.json({
        success: true,
        message: 'Stage added successfully',
        data: { pipeline, stage }
      });

    } catch (error) {
      console.error('Add stage error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/crm/pipelines/:id/stages/:stageId
// @desc    Update pipeline stage
// @access  Private
router.put('/pipelines/:id/stages/:stageId', 
  auth, 
  checkPermission('pipelines', 'update'),
  async (req, res) => {
    try {
      const pipeline = await Pipeline.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id,
          isActive: true
        }
      });

      if (!pipeline) {
        return res.status(404).json({
          success: false,
          message: 'Pipeline not found'
        });
      }

      const stages = pipeline.stages || [];
      const stageIndex = stages.findIndex(s => s.id === req.params.stageId);
      
      if (stageIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Stage not found'
        });
      }

      // Update the stage
      stages[stageIndex] = { ...stages[stageIndex], ...req.body };
      await pipeline.update({ stages });
      const stage = stages[stageIndex];

      res.json({
        success: true,
        message: 'Stage updated successfully',
        data: { pipeline, stage }
      });

    } catch (error) {
      console.error('Update stage error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/crm/pipelines/:id/stages/:stageId
// @desc    Remove stage from pipeline
// @access  Private
router.delete('/pipelines/:id/stages/:stageId', 
  auth, 
  checkPermission('pipelines', 'update'),
  async (req, res) => {
    try {
      const pipeline = await Pipeline.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id,
          isActive: true
        }
      });

      if (!pipeline) {
        return res.status(404).json({
          success: false,
          message: 'Pipeline not found'
        });
      }

      // Check if stage has contacts
      const contactCount = await Contact.count({
        where: {
          pipelineId: req.params.id,
          stageId: req.params.stageId
        }
      });

      if (contactCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete stage with existing contacts. Please move contacts to another stage first.',
          contactCount
        });
      }

      // Remove stage from pipeline's stages array
      const stages = pipeline.stages || [];
      const updatedStages = stages.filter(s => s.id !== req.params.stageId);
      
      await pipeline.update({ stages: updatedStages });

      res.json({
        success: true,
        message: 'Stage removed successfully',
        data: { pipeline }
      });

    } catch (error) {
      console.error('Remove stage error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/crm/contacts/:id/pipeline
// @desc    Move contact to different pipeline/stage
// @access  Private
router.put('/contacts/:id/pipeline', 
  auth, 
  checkPermission('contacts', 'update'),
  async (req, res) => {
    try {
      const { pipelineId, stageId } = req.body;

      if (!pipelineId || !stageId) {
        return res.status(400).json({
          success: false,
          message: 'Pipeline ID and Stage ID are required'
        });
      }

      // Verify pipeline and stage exist
      const pipeline = await Pipeline.findOne({
        where: {
          id: pipelineId,
          userId: req.user.id,
          isActive: true
        }
      });

      if (!pipeline) {
        return res.status(404).json({
          success: false,
          message: 'Pipeline not found'
        });
      }

      const stages = pipeline.stages || [];
      const stage = stages.find(s => s.id === stageId);
      if (!stage) {
        return res.status(404).json({
          success: false,
          message: 'Stage not found in pipeline'
        });
      }

      const contact = await Contact.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      await contact.update({
         pipelineId: pipelineId,
         stageId: stageId,
         movedAt: new Date()
       });

      res.json({
        success: true,
        message: 'Contact moved successfully',
        data: { contact }
      });

    } catch (error) {
      console.error('Move contact error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ ANALYTICS ROUTES ============

// @route   GET /api/crm/analytics
// @desc    Get CRM analytics
// @access  Private
router.get('/analytics', 
  auth, 
  checkPermission('analytics', 'read'),
  async (req, res) => {
    try {
      const { Op } = require('sequelize');
      
      const where = {
        userId: req.user.id
      };

      if (req.user.agencyId) {
        where.agencyId = req.user.agencyId;
      }

      // Get total contacts
      const totalContacts = await Contact.count({ where });

      // Get contacts by stage
      const contacts = await Contact.findAll({
        where,
        include: [
          {
            model: Pipeline,
            attributes: ['name', 'stages']
          }
        ]
      });

      // Group contacts by stage
      const contactsByStage = {};
      contacts.forEach(contact => {
        if (contact.pipeline && contact.pipeline.stages) {
          const stage = contact.pipeline.stages.find(s => s.id === contact.stageId);
          if (stage) {
            const stageName = stage.name;
            contactsByStage[stageName] = (contactsByStage[stageName] || 0) + 1;
          }
        }
      });

      // Get recent activities (from contact activities)
      const recentActivities = [];
      contacts.forEach(contact => {
        if (contact.activities && contact.activities.length > 0) {
          contact.activities.forEach(activity => {
            recentActivities.push({
              ...activity,
              contactName: `${contact.firstName} ${contact.lastName}`,
              contactId: contact.id
            });
          });
        }
      });

      // Sort by creation date and limit to 10
      recentActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const limitedActivities = recentActivities.slice(0, 10);

      // Calculate conversion rates (simplified)
      const conversionRates = {};
      const pipelineGroups = {};
      
      contacts.forEach(contact => {
        if (contact.pipeline) {
          const pipelineName = contact.pipeline.name;
          if (!pipelineGroups[pipelineName]) {
            pipelineGroups[pipelineName] = { total: 0, closed: 0 };
          }
          pipelineGroups[pipelineName].total++;
          
          // Assume last stage is "closed won" or similar
          if (contact.pipeline.stages && contact.pipeline.stages.length > 0) {
            const lastStage = contact.pipeline.stages[contact.pipeline.stages.length - 1];
            if (contact.stageId === lastStage.id) {
              pipelineGroups[pipelineName].closed++;
            }
          }
        }
      });

      Object.keys(pipelineGroups).forEach(pipeline => {
        const group = pipelineGroups[pipeline];
        conversionRates[pipeline] = group.total > 0 ? (group.closed / group.total * 100).toFixed(2) : 0;
      });

      const analytics = {
        totalContacts,
        contactsByStage,
        recentActivities: limitedActivities,
        conversionRates
      };

      res.json({
        success: true,
        data: { analytics }
      });

    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

module.exports = router;