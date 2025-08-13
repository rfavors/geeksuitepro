const express = require('express');
const Form = require('../models/Form');
const Contact = require('../models/Contact');
const { auth, authorize, checkPermission, checkUsageLimit, optionalAuth } = require('../middleware/auth');
const { validateForm, validatePagination } = require('../middleware/validation');
const router = express.Router();

// @route   GET /api/forms
// @desc    Get all forms with filtering and pagination
// @access  Private
router.get('/', 
  auth, 
  checkPermission('forms', 'read'),
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
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Type filter
      if (type) {
        filter.type = type;
      }

      // Status filter
      if (status) {
        filter.status = status;
      }

      // Category filter
      if (category) {
        filter.category = category;
      }

      // Execute query with pagination
      const forms = await Form.find(filter)
        .populate('ownerId', 'firstName lastName')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // Get total count for pagination
      const total = await Form.countDocuments(filter);

      res.json({
        success: true,
        data: {
          forms,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });

    } catch (error) {
      console.error('Get forms error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/forms/:id
// @desc    Get single form
// @access  Private
router.get('/:id', 
  auth, 
  checkPermission('forms', 'read'),
  async (req, res) => {
    try {
      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      })
      .populate('ownerId', 'firstName lastName')
      .populate('integrations.automation', 'name')
      .populate('integrations.pipeline', 'name')
      .populate('integrations.tags', 'name');

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      res.json({
        success: true,
        data: { form }
      });

    } catch (error) {
      console.error('Get form error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/forms
// @desc    Create new form
// @access  Private
router.post('/', 
  auth, 
  checkPermission('forms', 'create'),
  checkUsageLimit('forms'),
  validateForm,
  async (req, res) => {
    try {
      const formData = {
        ...req.body,
        ownerId: req.user.id,
        agencyId: req.user.agencyId,
        clientId: req.user.clientId
      };

      const form = new Form(formData);
      await form.save();

      // Update user usage
      await req.user.updateUsage('forms', 1);

      res.status(201).json({
        success: true,
        message: 'Form created successfully',
        data: { form }
      });

    } catch (error) {
      console.error('Create form error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/forms/:id
// @desc    Update form
// @access  Private
router.put('/:id', 
  auth, 
  checkPermission('forms', 'update'),
  validateForm,
  async (req, res) => {
    try {
      const form = await Form.findOneAndUpdate(
        {
          _id: req.params.id,
          ownerId: req.user.id,
          isDeleted: false
        },
        req.body,
        { new: true, runValidators: true }
      );

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      res.json({
        success: true,
        message: 'Form updated successfully',
        data: { form }
      });

    } catch (error) {
      console.error('Update form error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/forms/:id
// @desc    Soft delete form
// @access  Private
router.delete('/:id', 
  auth, 
  checkPermission('forms', 'delete'),
  async (req, res) => {
    try {
      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      await form.softDelete();

      res.json({
        success: true,
        message: 'Form deleted successfully'
      });

    } catch (error) {
      console.error('Delete form error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/forms/:id/duplicate
// @desc    Duplicate form
// @access  Private
router.post('/:id/duplicate', 
  auth, 
  checkPermission('forms', 'create'),
  checkUsageLimit('forms'),
  async (req, res) => {
    try {
      const originalForm = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!originalForm) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      const { name } = req.body;
      const duplicatedForm = await originalForm.duplicate(name || `${originalForm.name} (Copy)`);

      // Update user usage
      await req.user.updateUsage('forms', 1);

      res.status(201).json({
        success: true,
        message: 'Form duplicated successfully',
        data: { form: duplicatedForm }
      });

    } catch (error) {
      console.error('Duplicate form error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/forms/:id/publish
// @desc    Publish form
// @access  Private
router.post('/:id/publish', 
  auth, 
  checkPermission('forms', 'update'),
  async (req, res) => {
    try {
      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      await form.publish();

      res.json({
        success: true,
        message: 'Form published successfully',
        data: { form }
      });

    } catch (error) {
      console.error('Publish form error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/forms/:id/unpublish
// @desc    Unpublish form
// @access  Private
router.post('/:id/unpublish', 
  auth, 
  checkPermission('forms', 'update'),
  async (req, res) => {
    try {
      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      await form.unpublish();

      res.json({
        success: true,
        message: 'Form unpublished successfully',
        data: { form }
      });

    } catch (error) {
      console.error('Unpublish form error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ FORM FIELDS ROUTES ============

// @route   POST /api/forms/:id/fields
// @desc    Add field to form
// @access  Private
router.post('/:id/fields', 
  auth, 
  checkPermission('forms', 'update'),
  async (req, res) => {
    try {
      const { type, label, name, required, options, validation, position } = req.body;

      if (!type || !label || !name) {
        return res.status(400).json({
          success: false,
          message: 'Field type, label, and name are required'
        });
      }

      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      const field = form.addField({ type, label, name, required, options, validation, position });
      await form.save();

      res.status(201).json({
        success: true,
        message: 'Field added successfully',
        data: { field }
      });

    } catch (error) {
      console.error('Add field error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/forms/:id/fields/:fieldId
// @desc    Update form field
// @access  Private
router.put('/:id/fields/:fieldId', 
  auth, 
  checkPermission('forms', 'update'),
  async (req, res) => {
    try {
      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      const field = form.updateField(req.params.fieldId, req.body);
      await form.save();

      res.json({
        success: true,
        message: 'Field updated successfully',
        data: { field }
      });

    } catch (error) {
      console.error('Update field error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/forms/:id/fields/:fieldId
// @desc    Remove field from form
// @access  Private
router.delete('/:id/fields/:fieldId', 
  auth, 
  checkPermission('forms', 'update'),
  async (req, res) => {
    try {
      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      form.removeField(req.params.fieldId);
      await form.save();

      res.json({
        success: true,
        message: 'Field removed successfully'
      });

    } catch (error) {
      console.error('Remove field error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/forms/:id/fields/reorder
// @desc    Reorder form fields
// @access  Private
router.post('/:id/fields/reorder', 
  auth, 
  checkPermission('forms', 'update'),
  async (req, res) => {
    try {
      const { fieldOrder } = req.body;

      if (!Array.isArray(fieldOrder)) {
        return res.status(400).json({
          success: false,
          message: 'Field order array is required'
        });
      }

      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      form.reorderFields(fieldOrder);
      await form.save();

      res.json({
        success: true,
        message: 'Fields reordered successfully',
        data: { form }
      });

    } catch (error) {
      console.error('Reorder fields error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ FORM SUBMISSIONS ROUTES ============

// @route   POST /api/forms/:id/submit
// @desc    Submit form (public endpoint)
// @access  Public
router.post('/:id/submit', 
  optionalAuth,
  async (req, res) => {
    try {
      const form = await Form.findOne({
        _id: req.params.id,
        status: 'published',
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found or not published'
        });
      }

      const submissionData = req.body;

      // Validate required fields
      const requiredFields = form.fields.filter(field => field.required);
      for (const field of requiredFields) {
        if (!submissionData[field.name] || submissionData[field.name].toString().trim() === '') {
          return res.status(400).json({
            success: false,
            message: `${field.label} is required`,
            field: field.name
          });
        }
      }

      // Validate field types and constraints
      for (const field of form.fields) {
        const value = submissionData[field.name];
        if (value !== undefined && value !== null && value !== '') {
          // Email validation
          if (field.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              return res.status(400).json({
                success: false,
                message: `${field.label} must be a valid email address`,
                field: field.name
              });
            }
          }

          // Phone validation
          if (field.type === 'phone') {
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
              return res.status(400).json({
                success: false,
                message: `${field.label} must be a valid phone number`,
                field: field.name
              });
            }
          }

          // Custom validation
          if (field.validation) {
            if (field.validation.minLength && value.length < field.validation.minLength) {
              return res.status(400).json({
                success: false,
                message: `${field.label} must be at least ${field.validation.minLength} characters`,
                field: field.name
              });
            }

            if (field.validation.maxLength && value.length > field.validation.maxLength) {
              return res.status(400).json({
                success: false,
                message: `${field.label} must be no more than ${field.validation.maxLength} characters`,
                field: field.name
              });
            }

            if (field.validation.pattern) {
              const regex = new RegExp(field.validation.pattern);
              if (!regex.test(value)) {
                return res.status(400).json({
                  success: false,
                  message: field.validation.message || `${field.label} format is invalid`,
                  field: field.name
                });
              }
            }
          }
        }
      }

      // Process submission
      const submission = await form.processSubmission(submissionData, req.ip, req.get('User-Agent'));

      // Create or update contact if email is provided
      const emailField = form.fields.find(field => field.type === 'email');
      if (emailField && submissionData[emailField.name]) {
        try {
          const contactData = {
            email: submissionData[emailField.name],
            ownerId: form.ownerId,
            agencyId: form.agencyId,
            clientId: form.clientId,
            source: 'form',
            sourceDetails: {
              formId: form._id,
              formName: form.name,
              submissionId: submission._id
            }
          };

          // Map form fields to contact fields
          const firstNameField = form.fields.find(field => field.name === 'firstName' || field.name === 'first_name');
          const lastNameField = form.fields.find(field => field.name === 'lastName' || field.name === 'last_name');
          const phoneField = form.fields.find(field => field.type === 'phone');
          const companyField = form.fields.find(field => field.name === 'company');

          if (firstNameField && submissionData[firstNameField.name]) {
            contactData.firstName = submissionData[firstNameField.name];
          }
          if (lastNameField && submissionData[lastNameField.name]) {
            contactData.lastName = submissionData[lastNameField.name];
          }
          if (phoneField && submissionData[phoneField.name]) {
            contactData.phone = submissionData[phoneField.name];
          }
          if (companyField && submissionData[companyField.name]) {
            contactData.company = { name: submissionData[companyField.name] };
          }

          // Check for existing contact
          let contact = await Contact.findOne({
            email: contactData.email,
            ownerId: form.ownerId
          });

          if (contact) {
            // Update existing contact
            Object.assign(contact, contactData);
            await contact.save();
          } else {
            // Create new contact
            contact = new Contact(contactData);
            await contact.save();
          }

          // Apply form integrations
          if (form.integrations) {
            // Add tags
            if (form.integrations.tags && form.integrations.tags.length > 0) {
              for (const tag of form.integrations.tags) {
                contact.addTag(tag);
              }
              await contact.save();
            }

            // Move to pipeline stage
            if (form.integrations.pipeline && form.integrations.stage) {
              contact.pipeline = form.integrations.pipeline;
              contact.stage = form.integrations.stage;
              await contact.save();
            }

            // Trigger automation
            if (form.integrations.automation) {
              // This would trigger the automation workflow
              // Implementation depends on automation system
            }
          }

        } catch (contactError) {
          console.error('Contact creation/update error:', contactError);
          // Don't fail the form submission if contact creation fails
        }
      }

      // Prepare response based on form settings
      let responseData = {
        success: true,
        message: form.settings.successMessage || 'Form submitted successfully'
      };

      if (form.settings.redirectUrl) {
        responseData.redirectUrl = form.settings.redirectUrl;
      }

      res.json(responseData);

    } catch (error) {
      console.error('Form submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/forms/:id/submissions
// @desc    Get form submissions
// @access  Private
router.get('/:id/submissions', 
  auth, 
  checkPermission('forms', 'read'),
  validatePagination,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        sort = '-submittedAt'
      } = req.query;

      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      // Build filter for submissions
      const filter = { formId: form._id };

      if (startDate || endDate) {
        filter.submittedAt = {};
        if (startDate) filter.submittedAt.$gte = new Date(startDate);
        if (endDate) filter.submittedAt.$lte = new Date(endDate);
      }

      // This would typically query a FormSubmission model
      // For now, returning mock data structure
      const submissions = {
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
        data: submissions
      });

    } catch (error) {
      console.error('Get form submissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/forms/:id/analytics
// @desc    Get form analytics
// @access  Private
router.get('/:id/analytics', 
  auth, 
  checkPermission('forms', 'read'),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      // Calculate analytics
      const analytics = await form.calculateAnalytics(startDate, endDate);

      res.json({
        success: true,
        data: { analytics }
      });

    } catch (error) {
      console.error('Get form analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ PUBLIC FORM ACCESS ROUTES ============

// @route   GET /api/forms/public/:id
// @desc    Get published form for public access
// @access  Public
router.get('/public/:id', async (req, res) => {
  try {
    const form = await Form.findOne({
      _id: req.params.id,
      status: 'published',
      isDeleted: false
    })
    .select('name description fields settings styling');

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found or not published'
      });
    }

    // Increment view count
    await Form.findByIdAndUpdate(req.params.id, {
      $inc: { 'analytics.views': 1 }
    });

    res.json({
      success: true,
      data: { form }
    });

  } catch (error) {
    console.error('Get public form error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/forms/embed/:id
// @desc    Get form embed code
// @access  Private
router.get('/embed/:id', 
  auth, 
  checkPermission('forms', 'read'),
  async (req, res) => {
    try {
      const form = await Form.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      const embedCode = form.generateEmbedCode();

      res.json({
        success: true,
        data: { embedCode }
      });

    } catch (error) {
      console.error('Get form embed code error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

module.exports = router;