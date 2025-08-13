const express = require('express');
const { Keyword, Campaign, sequelize } = require('../models');
const { auth, checkPermission } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const router = express.Router();

// Validation middleware for keywords
const validateKeyword = [
  body('keyword')
    .notEmpty()
    .withMessage('Keyword is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Keyword must be between 1 and 100 characters'),
  body('category')
    .optional()
    .isIn(['primary', 'secondary', 'long-tail', 'branded', 'competitor'])
    .withMessage('Invalid keyword category'),
  body('searchVolume')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Search volume must be a positive integer'),
  body('difficulty')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid difficulty level'),
  body('cpc')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('CPC must be a positive number'),
  body('intent')
    .optional()
    .isIn(['informational', 'navigational', 'transactional', 'commercial'])
    .withMessage('Invalid search intent'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters')
];

// @route   GET /api/keywords
// @desc    Get all keywords for the user
// @access  Private
router.get('/', 
  auth, 
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        search,
        category,
        difficulty,
        intent,
        isActive = true,
        sort = 'keyword'
      } = req.query;

      // Build filter query
      const where = {
        userId: req.user.id
      };

      // Search filter
      if (search) {
        where.keyword = { [Op.like]: `%${search}%` };
      }

      // Category filter
      if (category) {
        where.category = category;
      }

      // Difficulty filter
      if (difficulty) {
        where.difficulty = difficulty;
      }

      // Intent filter
      if (intent) {
        where.intent = intent;
      }

      // Active filter
      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      // Sort options
      let order = [];
      switch (sort) {
        case 'keyword':
          order = [['keyword', 'ASC']];
          break;
        case '-keyword':
          order = [['keyword', 'DESC']];
          break;
        case 'searchVolume':
          order = [['searchVolume', 'DESC']];
          break;
        case 'cpc':
          order = [['cpc', 'DESC']];
          break;
        case 'createdAt':
          order = [['createdAt', 'DESC']];
          break;
        default:
          order = [['keyword', 'ASC']];
      }

      const offset = (page - 1) * limit;

      const keywords = await Keyword.findAndCountAll({
        where,
        order,
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [{
          model: Campaign,
          attributes: ['id', 'name', 'type', 'status'],
          through: { attributes: [] }
        }]
      });

      res.json({
        success: true,
        data: keywords.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: keywords.count,
          pages: Math.ceil(keywords.count / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching keywords:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching keywords'
      });
    }
  }
);

// @route   POST /api/keywords
// @desc    Create a new keyword
// @access  Private
router.post('/',
  auth,
  checkPermission('campaigns', 'create'),
  validateKeyword,
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        keyword,
        category = 'primary',
        searchVolume = 0,
        difficulty = 'medium',
        cpc = 0.00,
        intent = 'informational',
        notes
      } = req.body;

      // Check if keyword already exists for this user
      const existingKeyword = await Keyword.findOne({
        where: {
          keyword: keyword.toLowerCase().trim(),
          userId: req.user.id
        }
      });

      if (existingKeyword) {
        return res.status(400).json({
          success: false,
          message: 'Keyword already exists'
        });
      }

      const newKeyword = await Keyword.create({
        keyword: keyword.toLowerCase().trim(),
        category,
        searchVolume,
        difficulty,
        cpc,
        intent,
        notes,
        userId: req.user.id
      });

      res.status(201).json({
        success: true,
        message: 'Keyword created successfully',
        data: newKeyword
      });
    } catch (error) {
      console.error('Error creating keyword:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while creating keyword'
      });
    }
  }
);

// @route   POST /api/keywords/bulk
// @desc    Create multiple keywords at once
// @access  Private
router.post('/bulk',
  auth,
  checkPermission('campaigns', 'create'),
  body('keywords')
    .isArray({ min: 1, max: 100 })
    .withMessage('Keywords must be an array with 1-100 items'),
  body('keywords.*')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each keyword must be between 1 and 100 characters'),
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { keywords, category = 'primary', difficulty = 'medium', intent = 'informational' } = req.body;

      // Prepare keywords for bulk insert
      const keywordData = keywords.map(keyword => ({
        keyword: keyword.toLowerCase().trim(),
        category,
        difficulty,
        intent,
        userId: req.user.id
      }));

      // Remove duplicates and existing keywords
      const uniqueKeywords = [];
      const existingKeywords = await Keyword.findAll({
        where: {
          keyword: { [Op.in]: keywordData.map(k => k.keyword) },
          userId: req.user.id
        },
        attributes: ['keyword']
      });

      const existingKeywordSet = new Set(existingKeywords.map(k => k.keyword));
      const seenKeywords = new Set();

      for (const keywordObj of keywordData) {
        if (!existingKeywordSet.has(keywordObj.keyword) && !seenKeywords.has(keywordObj.keyword)) {
          uniqueKeywords.push(keywordObj);
          seenKeywords.add(keywordObj.keyword);
        }
      }

      if (uniqueKeywords.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'All keywords already exist'
        });
      }

      const createdKeywords = await Keyword.bulkCreate(uniqueKeywords);

      res.status(201).json({
        success: true,
        message: `${createdKeywords.length} keywords created successfully`,
        data: createdKeywords,
        skipped: keywords.length - uniqueKeywords.length
      });
    } catch (error) {
      console.error('Error creating bulk keywords:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while creating keywords'
      });
    }
  }
);

// @route   PUT /api/keywords/:id
// @desc    Update a keyword
// @access  Private
router.put('/:id',
  auth,
  checkPermission('campaigns', 'update'),
  validateKeyword,
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const keyword = await Keyword.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!keyword) {
        return res.status(404).json({
          success: false,
          message: 'Keyword not found'
        });
      }

      const updatedKeyword = await keyword.update(req.body);

      res.json({
        success: true,
        message: 'Keyword updated successfully',
        data: updatedKeyword
      });
    } catch (error) {
      console.error('Error updating keyword:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while updating keyword'
      });
    }
  }
);

// @route   DELETE /api/keywords/:id
// @desc    Delete a keyword
// @access  Private
router.delete('/:id',
  auth,
  checkPermission('campaigns', 'delete'),
  async (req, res) => {
    try {
      const keyword = await Keyword.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!keyword) {
        return res.status(404).json({
          success: false,
          message: 'Keyword not found'
        });
      }

      await keyword.destroy();

      res.json({
        success: true,
        message: 'Keyword deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting keyword:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while deleting keyword'
      });
    }
  }
);

// @route   POST /api/keywords/:id/toggle
// @desc    Toggle keyword active status
// @access  Private
router.post('/:id/toggle',
  auth,
  checkPermission('campaigns', 'update'),
  async (req, res) => {
    try {
      const keyword = await Keyword.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!keyword) {
        return res.status(404).json({
          success: false,
          message: 'Keyword not found'
        });
      }

      const updatedKeyword = await keyword.update({
        isActive: !keyword.isActive
      });

      res.json({
        success: true,
        message: `Keyword ${updatedKeyword.isActive ? 'activated' : 'deactivated'} successfully`,
        data: updatedKeyword
      });
    } catch (error) {
      console.error('Error toggling keyword:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while toggling keyword'
      });
    }
  }
);

// @route   GET /api/keywords/stats
// @desc    Get keyword statistics
// @access  Private
router.get('/stats',
  auth,
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      const stats = await Keyword.findAll({
        where: { userId: req.user.id },
        attributes: [
          'category',
          'difficulty',
          'intent',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('AVG', sequelize.col('searchVolume')), 'avgSearchVolume'],
          [sequelize.fn('AVG', sequelize.col('cpc')), 'avgCpc']
        ],
        group: ['category', 'difficulty', 'intent'],
        raw: true
      });

      const totalKeywords = await Keyword.count({
        where: { userId: req.user.id }
      });

      const activeKeywords = await Keyword.count({
        where: { 
          userId: req.user.id,
          isActive: true
        }
      });

      res.json({
        success: true,
        data: {
          total: totalKeywords,
          active: activeKeywords,
          inactive: totalKeywords - activeKeywords,
          breakdown: stats
        }
      });
    } catch (error) {
      console.error('Error fetching keyword stats:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching keyword statistics'
      });
    }
  }
);

module.exports = router;