const express = require('express');
const Funnel = require('../models/Funnel');
const { auth, authorize, checkPermission, checkUsageLimit } = require('../middleware/auth');
const { validateFunnel, validatePagination } = require('../middleware/validation');
const router = express.Router();

// @route   GET /api/funnels
// @desc    Get all funnels with filtering and pagination
// @access  Private
router.get('/', 
  auth, 
  checkPermission('funnels', 'read'),
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

      // Category filter
      if (category) {
        filter.category = category;
      }

      // Status filter
      if (status) {
        filter.status = status;
      }

      // Execute query with pagination
      const funnels = await Funnel.find(filter)
        .populate('ownerId', 'firstName lastName')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // Get total count for pagination
      const total = await Funnel.countDocuments(filter);

      res.json({
        success: true,
        data: {
          funnels,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });

    } catch (error) {
      console.error('Get funnels error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/funnels/:id
// @desc    Get single funnel
// @access  Private
router.get('/:id', 
  auth, 
  checkPermission('funnels', 'read'),
  async (req, res) => {
    try {
      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      })
      .populate('ownerId', 'firstName lastName')
      .populate('versions.createdBy', 'firstName lastName');

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      res.json({
        success: true,
        data: { funnel }
      });

    } catch (error) {
      console.error('Get funnel error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/funnels
// @desc    Create new funnel
// @access  Private
router.post('/', 
  auth, 
  checkPermission('funnels', 'create'),
  checkUsageLimit('funnels'),
  validateFunnel,
  async (req, res) => {
    try {
      const funnelData = {
        ...req.body,
        ownerId: req.user.id,
        agencyId: req.user.agencyId,
        clientId: req.user.clientId
      };

      const funnel = new Funnel(funnelData);
      await funnel.save();

      // Update user usage
      await req.user.updateUsage('funnels', 1);

      res.status(201).json({
        success: true,
        message: 'Funnel created successfully',
        data: { funnel }
      });

    } catch (error) {
      console.error('Create funnel error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/funnels/:id
// @desc    Update funnel
// @access  Private
router.put('/:id', 
  auth, 
  checkPermission('funnels', 'update'),
  validateFunnel,
  async (req, res) => {
    try {
      const funnel = await Funnel.findOneAndUpdate(
        {
          _id: req.params.id,
          ownerId: req.user.id,
          isDeleted: false
        },
        req.body,
        { new: true, runValidators: true }
      );

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      res.json({
        success: true,
        message: 'Funnel updated successfully',
        data: { funnel }
      });

    } catch (error) {
      console.error('Update funnel error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/funnels/:id
// @desc    Delete funnel (soft delete)
// @access  Private
router.delete('/:id', 
  auth, 
  checkPermission('funnels', 'delete'),
  async (req, res) => {
    try {
      const funnel = await Funnel.findOneAndUpdate(
        {
          _id: req.params.id,
          ownerId: req.user.id,
          isDeleted: false
        },
        {
          isDeleted: true,
          deletedAt: new Date()
        },
        { new: true }
      );

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      res.json({
        success: true,
        message: 'Funnel deleted successfully'
      });

    } catch (error) {
      console.error('Delete funnel error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/funnels/:id/duplicate
// @desc    Duplicate funnel
// @access  Private
router.post('/:id/duplicate', 
  auth, 
  checkPermission('funnels', 'create'),
  checkUsageLimit('funnels'),
  async (req, res) => {
    try {
      const originalFunnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!originalFunnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      const { name } = req.body;
      const duplicatedFunnel = await originalFunnel.duplicate(name || `${originalFunnel.name} (Copy)`);

      // Update user usage
      await req.user.updateUsage('funnels', 1);

      res.status(201).json({
        success: true,
        message: 'Funnel duplicated successfully',
        data: { funnel: duplicatedFunnel }
      });

    } catch (error) {
      console.error('Duplicate funnel error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/funnels/:id/publish
// @desc    Publish funnel
// @access  Private
router.post('/:id/publish', 
  auth, 
  checkPermission('funnels', 'update'),
  async (req, res) => {
    try {
      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      await funnel.publish();

      res.json({
        success: true,
        message: 'Funnel published successfully',
        data: { funnel }
      });

    } catch (error) {
      console.error('Publish funnel error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/funnels/:id/unpublish
// @desc    Unpublish funnel
// @access  Private
router.post('/:id/unpublish', 
  auth, 
  checkPermission('funnels', 'update'),
  async (req, res) => {
    try {
      const funnel = await Funnel.findOneAndUpdate(
        {
          _id: req.params.id,
          ownerId: req.user.id,
          isDeleted: false
        },
        {
          status: 'draft',
          publishedAt: null
        },
        { new: true }
      );

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      res.json({
        success: true,
        message: 'Funnel unpublished successfully',
        data: { funnel }
      });

    } catch (error) {
      console.error('Unpublish funnel error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ FUNNEL PAGES ROUTES ============

// @route   GET /api/funnels/:id/pages
// @desc    Get all pages in a funnel
// @access  Private
router.get('/:id/pages', 
  auth, 
  checkPermission('funnels', 'read'),
  async (req, res) => {
    try {
      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      res.json({
        success: true,
        data: { pages: funnel.pages }
      });

    } catch (error) {
      console.error('Get funnel pages error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/funnels/:id/pages/:pageId
// @desc    Get single page from funnel
// @access  Private
router.get('/:id/pages/:pageId', 
  auth, 
  checkPermission('funnels', 'read'),
  async (req, res) => {
    try {
      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      const page = funnel.pages.id(req.params.pageId);
      if (!page) {
        return res.status(404).json({
          success: false,
          message: 'Page not found'
        });
      }

      res.json({
        success: true,
        data: { page }
      });

    } catch (error) {
      console.error('Get funnel page error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/funnels/:id/pages
// @desc    Add page to funnel
// @access  Private
router.post('/:id/pages', 
  auth, 
  checkPermission('funnels', 'update'),
  async (req, res) => {
    try {
      const { name, type = 'landing', slug } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Page name is required'
        });
      }

      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      const page = funnel.addPage(req.body);
      await funnel.save();

      res.status(201).json({
        success: true,
        message: 'Page added successfully',
        data: { page }
      });

    } catch (error) {
      console.error('Add page error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/funnels/:id/pages/:pageId
// @desc    Update funnel page
// @access  Private
router.put('/:id/pages/:pageId', 
  auth, 
  checkPermission('funnels', 'update'),
  async (req, res) => {
    try {
      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      const page = funnel.pages.id(req.params.pageId);
      if (!page) {
        return res.status(404).json({
          success: false,
          message: 'Page not found'
        });
      }

      // Update page properties
      Object.assign(page, req.body);
      page.updatedAt = new Date();
      
      await funnel.save();

      res.json({
        success: true,
        message: 'Page updated successfully',
        data: { page }
      });

    } catch (error) {
      console.error('Update page error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/funnels/:id/pages/:pageId
// @desc    Remove page from funnel
// @access  Private
router.delete('/:id/pages/:pageId', 
  auth, 
  checkPermission('funnels', 'update'),
  async (req, res) => {
    try {
      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      funnel.removePage(req.params.pageId);
      await funnel.save();

      res.json({
        success: true,
        message: 'Page removed successfully'
      });

    } catch (error) {
      console.error('Remove page error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/funnels/:id/pages/reorder
// @desc    Reorder funnel pages
// @access  Private
router.put('/:id/pages/reorder', 
  auth, 
  checkPermission('funnels', 'update'),
  async (req, res) => {
    try {
      const { pageOrder } = req.body;

      if (!Array.isArray(pageOrder)) {
        return res.status(400).json({
          success: false,
          message: 'Page order must be an array of page IDs'
        });
      }

      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      funnel.reorderPages(pageOrder);
      await funnel.save();

      res.json({
        success: true,
        message: 'Pages reordered successfully',
        data: { funnel }
      });

    } catch (error) {
      console.error('Reorder pages error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ VERSION CONTROL ROUTES ============

// @route   POST /api/funnels/:id/versions
// @desc    Create version backup
// @access  Private
router.post('/:id/versions', 
  auth, 
  checkPermission('funnels', 'update'),
  async (req, res) => {
    try {
      const { name, description } = req.body;

      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      const version = await funnel.createVersionBackup(name, description, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Version backup created successfully',
        data: { version }
      });

    } catch (error) {
      console.error('Create version error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/funnels/:id/versions
// @desc    Get funnel versions
// @access  Private
router.get('/:id/versions', 
  auth, 
  checkPermission('funnels', 'read'),
  async (req, res) => {
    try {
      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      })
      .populate('versions.createdBy', 'firstName lastName')
      .select('versions');

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      res.json({
        success: true,
        data: { versions: funnel.versions }
      });

    } catch (error) {
      console.error('Get versions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/funnels/:id/versions/:versionId/restore
// @desc    Restore funnel from version
// @access  Private
router.post('/:id/versions/:versionId/restore', 
  auth, 
  checkPermission('funnels', 'update'),
  async (req, res) => {
    try {
      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      await funnel.restoreFromVersion(req.params.versionId);

      res.json({
        success: true,
        message: 'Funnel restored from version successfully',
        data: { funnel }
      });

    } catch (error) {
      console.error('Restore version error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ ANALYTICS ROUTES ============

// @route   GET /api/funnels/:id/analytics
// @desc    Get funnel analytics
// @access  Private
router.get('/:id/analytics', 
  auth, 
  checkPermission('funnels', 'read'),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const funnel = await Funnel.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Funnel not found'
        });
      }

      // Filter analytics by date range if provided
      let analytics = funnel.analytics;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        
        // Filter analytics data (this would need to be implemented based on your analytics structure)
        // For now, returning the full analytics object
      }

      res.json({
        success: true,
        data: { analytics }
      });

    } catch (error) {
      console.error('Get funnel analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ PUBLIC ROUTES (for funnel viewing) ============

// @route   GET /api/funnels/public/:domain/:slug?
// @desc    Get published funnel by domain and optional page slug
// @access  Public
router.get('/public/:domain/:slug?', async (req, res) => {
  try {
    const { domain, slug } = req.params;
    
    const funnel = await Funnel.findByDomain(domain);
    
    if (!funnel) {
      return res.status(404).json({
        success: false,
        message: 'Funnel not found'
      });
    }

    // Find the specific page or landing page
    let page;
    if (slug) {
      page = funnel.pages.find(p => p.slug === slug);
    } else {
      page = funnel.landingPage;
    }

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

    // Increment page views (you might want to implement this with proper analytics)
    page.analytics.views += 1;
    await funnel.save();

    res.json({
      success: true,
      data: {
        funnel: {
          name: funnel.name,
          domain: funnel.domain,
          subdomain: funnel.subdomain
        },
        page
      }
    });

  } catch (error) {
    console.error('Get public funnel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;