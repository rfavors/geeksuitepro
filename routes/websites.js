const express = require('express');
const router = express.Router();
const Website = require('../models/Website');
const { auth, authorize, checkUsageLimit } = require('../middleware/auth');
const { validateInput, validateWebsite, sanitizeInput, validatePagination } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

// Rate limiting
const websiteLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many website requests from this IP'
});

// Get all websites
router.get('/', auth, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Build query
    const query = {
      ownerId: req.user.id,
      isDeleted: false
    };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { domain: { $regex: search, $options: 'i' } },
        { customDomain: { $regex: search, $options: 'i' } }
      ];
    }

    const websites = await Website.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .populate('collaborators.userId', 'firstName lastName email')
      .select('-pages.content -pages.htmlContent -pages.cssContent -pages.jsContent -customCss -customJs');

    const total = await Website.countDocuments(query);

    res.json({
      websites,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get websites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single website
router.get('/:id', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    }).populate('collaborators.userId', 'firstName lastName email');

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    res.json(website);
  } catch (error) {
    console.error('Get website error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create website
router.post('/', 
  auth, 
  websiteLimit,
  checkUsageLimit('websites'),
  validateWebsite,
  sanitizeInput,
  async (req, res) => {
    try {
      const websiteData = {
        ...req.body,
        ownerId: req.user.id
      };

      // Set agency/client IDs if user is part of agency
      if (req.user.role === 'client' && req.user.agencyId) {
        websiteData.agencyId = req.user.agencyId;
        websiteData.clientId = req.user.id;
      } else if (req.user.role === 'agency_user' && req.user.agencyId) {
        websiteData.agencyId = req.user.agencyId;
      }

      // Check for duplicate domain/subdomain
      if (websiteData.domain) {
        const existingDomain = await Website.findOne({ 
          domain: websiteData.domain,
          isDeleted: false 
        });
        if (existingDomain) {
          return res.status(400).json({ message: 'Domain already exists' });
        }
      }

      if (websiteData.subdomain) {
        const existingSubdomain = await Website.findOne({ 
          subdomain: websiteData.subdomain,
          isDeleted: false 
        });
        if (existingSubdomain) {
          return res.status(400).json({ message: 'Subdomain already exists' });
        }
      }

      if (websiteData.customDomain) {
        const existingCustomDomain = await Website.findOne({ 
          customDomain: websiteData.customDomain,
          isDeleted: false 
        });
        if (existingCustomDomain) {
          return res.status(400).json({ message: 'Custom domain already exists' });
        }
      }

      const website = new Website(websiteData);

      // Create default home page
      website.pages.push({
        name: 'Home',
        slug: 'home',
        title: websiteData.name || 'Welcome',
        description: 'Home page',
        type: 'home',
        content: '<h1>Welcome to your new website!</h1><p>Start building your amazing website.</p>',
        status: 'published',
        isHomePage: true,
        seo: {
          metaTitle: websiteData.name || 'Welcome',
          metaDescription: websiteData.description || 'Welcome to our website'
        }
      });

      await website.save();

      res.status(201).json(website);
    } catch (error) {
      console.error('Create website error:', error);
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Domain or subdomain already exists' });
      }
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update website
router.put('/:id', 
  auth, 
  validateWebsite,
  sanitizeInput,
  async (req, res) => {
    try {
      const website = await Website.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!website) {
        return res.status(404).json({ message: 'Website not found' });
      }

      // Check for duplicate domain/subdomain (excluding current website)
      if (req.body.domain && req.body.domain !== website.domain) {
        const existingDomain = await Website.findOne({ 
          domain: req.body.domain,
          _id: { $ne: website._id },
          isDeleted: false 
        });
        if (existingDomain) {
          return res.status(400).json({ message: 'Domain already exists' });
        }
      }

      if (req.body.subdomain && req.body.subdomain !== website.subdomain) {
        const existingSubdomain = await Website.findOne({ 
          subdomain: req.body.subdomain,
          _id: { $ne: website._id },
          isDeleted: false 
        });
        if (existingSubdomain) {
          return res.status(400).json({ message: 'Subdomain already exists' });
        }
      }

      if (req.body.customDomain && req.body.customDomain !== website.customDomain) {
        const existingCustomDomain = await Website.findOne({ 
          customDomain: req.body.customDomain,
          _id: { $ne: website._id },
          isDeleted: false 
        });
        if (existingCustomDomain) {
          return res.status(400).json({ message: 'Custom domain already exists' });
        }
      }

      // Update website
      Object.assign(website, req.body);
      await website.save();

      res.json(website);
    } catch (error) {
      console.error('Update website error:', error);
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Domain or subdomain already exists' });
      }
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Delete website
router.delete('/:id', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    });

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    await website.softDelete();
    res.json({ message: 'Website deleted successfully' });
  } catch (error) {
    console.error('Delete website error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Duplicate website
router.post('/:id/duplicate', 
  auth, 
  checkUsageLimit('websites'),
  async (req, res) => {
    try {
      const originalWebsite = await Website.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!originalWebsite) {
        return res.status(404).json({ message: 'Website not found' });
      }

      const duplicateData = originalWebsite.toObject();
      delete duplicateData._id;
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;
      delete duplicateData.publishedAt;
      delete duplicateData.domain;
      delete duplicateData.customDomain;
      delete duplicateData.subdomain;
      
      // Update name and reset status
      duplicateData.name = `${duplicateData.name} (Copy)`;
      duplicateData.status = 'draft';
      
      // Reset analytics
      duplicateData.analytics = {
        totalViews: 0,
        uniqueVisitors: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
        topPages: [],
        trafficSources: [],
        deviceStats: { desktop: 0, mobile: 0, tablet: 0 },
        locationStats: []
      };
      
      // Reset page analytics
      duplicateData.pages.forEach(page => {
        delete page._id;
        page.views = 0;
        page.uniqueViews = 0;
        page.bounceRate = 0;
        page.avgTimeOnPage = 0;
      });

      const duplicateWebsite = new Website(duplicateData);
      await duplicateWebsite.save();

      res.status(201).json(duplicateWebsite);
    } catch (error) {
      console.error('Duplicate website error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Publish website
router.post('/:id/publish', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    });

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    await website.publish();
    res.json({ message: 'Website published successfully', website });
  } catch (error) {
    console.error('Publish website error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unpublish website
router.post('/:id/unpublish', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    });

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    await website.unpublish();
    res.json({ message: 'Website unpublished successfully', website });
  } catch (error) {
    console.error('Unpublish website error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PAGE MANAGEMENT ROUTES

// Get all pages in a website
router.get('/:id/pages', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    }).select('pages');

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    const { type, status } = req.query;
    let pages = website.pages;

    if (type) {
      pages = pages.filter(page => page.type === type);
    }

    if (status) {
      pages = pages.filter(page => page.status === status);
    }

    res.json(pages);
  } catch (error) {
    console.error('Get pages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single page
router.get('/:id/pages/:pageId', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    });

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    const page = website.pages.id(req.params.pageId);
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }

    res.json(page);
  } catch (error) {
    console.error('Get page error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add page to website
router.post('/:id/pages', 
  auth, 
  validateInput([
    { field: 'name', required: true, type: 'string', maxLength: 100 },
    { field: 'slug', required: true, type: 'string', pattern: /^[a-z0-9-]+$/ },
    { field: 'title', required: true, type: 'string', maxLength: 200 },
    { field: 'type', type: 'string', enum: ['page', 'blog', 'landing', 'home', 'about', 'contact', 'privacy', 'terms'] }
  ]),
  sanitizeInput,
  async (req, res) => {
    try {
      const website = await Website.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!website) {
        return res.status(404).json({ message: 'Website not found' });
      }

      // Check if slug already exists
      const existingPage = website.pages.find(page => page.slug === req.body.slug);
      if (existingPage) {
        return res.status(400).json({ message: 'Page with this slug already exists' });
      }

      const page = await website.addPage({
        ...req.body,
        author: req.user.id
      });

      res.status(201).json(page);
    } catch (error) {
      console.error('Add page error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update page
router.put('/:id/pages/:pageId', 
  auth, 
  validateInput([
    { field: 'name', type: 'string', maxLength: 100 },
    { field: 'slug', type: 'string', pattern: /^[a-z0-9-]+$/ },
    { field: 'title', type: 'string', maxLength: 200 },
    { field: 'type', type: 'string', enum: ['page', 'blog', 'landing', 'home', 'about', 'contact', 'privacy', 'terms'] }
  ]),
  sanitizeInput,
  async (req, res) => {
    try {
      const website = await Website.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!website) {
        return res.status(404).json({ message: 'Website not found' });
      }

      // Check if slug already exists (excluding current page)
      if (req.body.slug) {
        const existingPage = website.pages.find(page => 
          page.slug === req.body.slug && page._id.toString() !== req.params.pageId
        );
        if (existingPage) {
          return res.status(400).json({ message: 'Page with this slug already exists' });
        }
      }

      const page = await website.updatePage(req.params.pageId, req.body);
      res.json(page);
    } catch (error) {
      console.error('Update page error:', error);
      if (error.message === 'Page not found') {
        return res.status(404).json({ message: 'Page not found' });
      }
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Remove page from website
router.delete('/:id/pages/:pageId', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    });

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    await website.removePage(req.params.pageId);
    res.json({ message: 'Page removed successfully' });
  } catch (error) {
    console.error('Remove page error:', error);
    if (error.message === 'Page not found') {
      return res.status(404).json({ message: 'Page not found' });
    }
    if (error.message === 'Cannot remove home page') {
      return res.status(400).json({ message: 'Cannot remove home page' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// BACKUP AND VERSION CONTROL

// Create backup
router.post('/:id/backup', 
  auth, 
  validateInput([
    { field: 'description', type: 'string', maxLength: 200 }
  ]),
  async (req, res) => {
    try {
      const website = await Website.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!website) {
        return res.status(404).json({ message: 'Website not found' });
      }

      const backup = await website.createBackup(req.body.description, req.user.id);
      res.status(201).json(backup);
    } catch (error) {
      console.error('Create backup error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get website versions
router.get('/:id/versions', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    }).select('versions').populate('versions.createdBy', 'firstName lastName email');

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    res.json(website.versions);
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Restore from backup
router.post('/:id/restore/:versionId', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    });

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    await website.restoreFromBackup(req.params.versionId);
    res.json({ message: 'Website restored successfully', website });
  } catch (error) {
    console.error('Restore backup error:', error);
    if (error.message === 'Backup version not found') {
      return res.status(404).json({ message: 'Backup version not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// ANALYTICS

// Get website analytics
router.get('/:id/analytics', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    }).select('analytics pages');

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    // Basic analytics
    const analytics = {
      overview: website.analytics,
      pages: website.pages.map(page => ({
        id: page._id,
        name: page.name,
        slug: page.slug,
        views: page.views,
        uniqueViews: page.uniqueViews,
        bounceRate: page.bounceRate,
        avgTimeOnPage: page.avgTimeOnPage
      })).sort((a, b) => b.views - a.views)
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// COLLABORATION

// Add collaborator
router.post('/:id/collaborators', 
  auth, 
  validateInput([
    { field: 'userId', required: true, type: 'string' },
    { field: 'role', type: 'string', enum: ['editor', 'viewer', 'admin'] },
    { field: 'permissions', type: 'array' }
  ]),
  async (req, res) => {
    try {
      const website = await Website.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!website) {
        return res.status(404).json({ message: 'Website not found' });
      }

      await website.addCollaborator(
        req.body.userId, 
        req.body.role || 'editor', 
        req.body.permissions || []
      );
      
      res.json({ message: 'Collaborator added successfully' });
    } catch (error) {
      console.error('Add collaborator error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Remove collaborator
router.delete('/:id/collaborators/:userId', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    });

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    await website.removeCollaborator(req.params.userId);
    res.json({ message: 'Collaborator removed successfully' });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// SITEMAP

// Generate sitemap
router.get('/:id/sitemap', auth, async (req, res) => {
  try {
    const website = await Website.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      isDeleted: false
    });

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    const sitemap = website.generateSitemap();
    
    if (!sitemap) {
      return res.status(400).json({ message: 'Cannot generate sitemap without domain' });
    }

    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Generate sitemap error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUBLIC ROUTES

// Get published website by domain
router.get('/public/:domain', async (req, res) => {
  try {
    const website = await Website.findByDomain(req.params.domain)
      .populate('pages')
      .select('-customCss -customJs -versions -collaborators');

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    // Filter only published pages
    website.pages = website.pages.filter(page => page.status === 'published');

    res.json(website);
  } catch (error) {
    console.error('Get public website error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get published page by domain and slug
router.get('/public/:domain/:slug', async (req, res) => {
  try {
    const website = await Website.findByDomain(req.params.domain);

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    const page = website.getPage(req.params.slug);
    
    if (!page || page.status !== 'published') {
      return res.status(404).json({ message: 'Page not found' });
    }

    // Increment page views
    const isUnique = !req.session || !req.session.viewedPages || !req.session.viewedPages.includes(page._id.toString());
    
    if (isUnique) {
      if (!req.session.viewedPages) {
        req.session.viewedPages = [];
      }
      req.session.viewedPages.push(page._id.toString());
    }

    await website.incrementPageViews(page._id, isUnique);

    res.json({
      page,
      website: {
        name: website.name,
        theme: website.theme,
        navigation: website.navigation,
        seo: website.seo,
        contact: website.contact
      }
    });
  } catch (error) {
    console.error('Get public page error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;