const express = require('express');
const { AdGrade } = require('../models');
const { auth, checkPermission } = require('../middleware/auth');
const adGrader = require('../utils/adGrader');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Validation middleware for ad grading
const validateAdGrading = [
  body('adTitle')
    .notEmpty()
    .withMessage('Ad title is required')
    .isLength({ min: 5, max: 100 })
    .withMessage('Ad title must be between 5 and 100 characters'),
  body('adDescription')
    .notEmpty()
    .withMessage('Ad description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Ad description must be between 10 and 500 characters'),
  body('adType')
    .optional()
    .isIn(['facebook', 'google', 'instagram', 'linkedin', 'twitter', 'general'])
    .withMessage('Invalid ad type'),
  body('targetAudience')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Target audience description too long'),
  body('callToAction')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Call to action too long'),
  body('industry')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Industry description too long')
];

// @route   POST /api/ad-grader/grade
// @desc    Grade an advertisement
// @access  Private
router.post('/grade',
  auth,
  checkPermission('campaigns', 'create'),
  validateAdGrading,
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
        adTitle,
        adDescription,
        adType,
        targetAudience,
        callToAction,
        industry
      } = req.body;

      // Grade the ad
      const gradeResult = await adGrader.gradeAd({
        adTitle,
        adDescription,
        adType,
        targetAudience,
        callToAction,
        industry
      }, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Ad graded successfully',
        data: gradeResult
      });

    } catch (error) {
      console.error('Ad grading error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to grade ad',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// @route   GET /api/ad-grader/history
// @desc    Get user's ad grading history
// @access  Private
router.get('/history',
  auth,
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      const { limit = 10, page = 1 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows: grades } = await AdGrade.findAndCountAll({
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
        attributes: [
          'id',
          'adTitle',
          'adType',
          'overallScore',
          'scores',
          'createdAt'
        ]
      });

      const gradesWithLetters = grades.map(grade => ({
        ...grade.toJSON(),
        grade: adGrader.getGradeLetter(grade.overallScore)
      }));

      res.json({
        success: true,
        data: {
          grades: gradesWithLetters,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      console.error('Error fetching ad grade history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch ad grade history'
      });
    }
  }
);

// @route   GET /api/ad-grader/grade/:id
// @desc    Get specific ad grade details
// @access  Private
router.get('/grade/:id',
  auth,
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      const grade = await AdGrade.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!grade) {
        return res.status(404).json({
          success: false,
          message: 'Ad grade not found'
        });
      }

      const gradeData = {
        ...grade.toJSON(),
        grade: adGrader.getGradeLetter(grade.overallScore)
      };

      res.json({
        success: true,
        data: gradeData
      });

    } catch (error) {
      console.error('Error fetching ad grade:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch ad grade'
      });
    }
  }
);

// @route   DELETE /api/ad-grader/grade/:id
// @desc    Delete an ad grade
// @access  Private
router.delete('/grade/:id',
  auth,
  checkPermission('campaigns', 'delete'),
  async (req, res) => {
    try {
      const grade = await AdGrade.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!grade) {
        return res.status(404).json({
          success: false,
          message: 'Ad grade not found'
        });
      }

      await grade.destroy();

      res.json({
        success: true,
        message: 'Ad grade deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting ad grade:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete ad grade'
      });
    }
  }
);

// @route   GET /api/ad-grader/analytics
// @desc    Get ad grading analytics for user
// @access  Private
router.get('/analytics',
  auth,
  checkPermission('campaigns', 'read'),
  async (req, res) => {
    try {
      const { timeframe = '30' } = req.query; // days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeframe));

      const grades = await AdGrade.findAll({
        where: {
          userId: req.user.id,
          createdAt: {
            [require('sequelize').Op.gte]: startDate
          }
        },
        attributes: ['overallScore', 'scores', 'adType', 'createdAt']
      });

      // Calculate analytics
      const totalGrades = grades.length;
      const averageScore = totalGrades > 0 
        ? Math.round(grades.reduce((sum, grade) => sum + grade.overallScore, 0) / totalGrades)
        : 0;

      // Score distribution
      const scoreDistribution = {
        'A (90-100)': grades.filter(g => g.overallScore >= 90).length,
        'B (80-89)': grades.filter(g => g.overallScore >= 80 && g.overallScore < 90).length,
        'C (70-79)': grades.filter(g => g.overallScore >= 70 && g.overallScore < 80).length,
        'D (60-69)': grades.filter(g => g.overallScore >= 60 && g.overallScore < 70).length,
        'F (0-59)': grades.filter(g => g.overallScore < 60).length
      };

      // Ad type performance
      const adTypePerformance = {};
      grades.forEach(grade => {
        if (!adTypePerformance[grade.adType]) {
          adTypePerformance[grade.adType] = {
            count: 0,
            totalScore: 0,
            averageScore: 0
          };
        }
        adTypePerformance[grade.adType].count++;
        adTypePerformance[grade.adType].totalScore += grade.overallScore;
      });

      // Calculate averages for ad types
      Object.keys(adTypePerformance).forEach(type => {
        const data = adTypePerformance[type];
        data.averageScore = Math.round(data.totalScore / data.count);
        delete data.totalScore;
      });

      // Score trends (last 7 days)
      const scoreTrends = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));
        
        const dayGrades = grades.filter(g => {
          const gradeDate = new Date(g.createdAt);
          return gradeDate >= dayStart && gradeDate <= dayEnd;
        });
        
        const dayAverage = dayGrades.length > 0
          ? Math.round(dayGrades.reduce((sum, grade) => sum + grade.overallScore, 0) / dayGrades.length)
          : 0;
        
        scoreTrends.push({
          date: dayStart.toISOString().split('T')[0],
          averageScore: dayAverage,
          count: dayGrades.length
        });
      }

      res.json({
        success: true,
        data: {
          summary: {
            totalGrades,
            averageScore,
            timeframe: parseInt(timeframe)
          },
          scoreDistribution,
          adTypePerformance,
          scoreTrends
        }
      });

    } catch (error) {
      console.error('Error fetching ad grading analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics'
      });
    }
  }
);

// @route   POST /api/ad-grader/quick-tips
// @desc    Get quick tips for ad improvement
// @access  Public
router.post('/quick-tips',
  async (req, res) => {
    try {
      const { adType = 'general', industry } = req.body;

      const tips = {
        general: [
          'Use numbers in your headline for credibility',
          'Focus on benefits, not features',
          'Include a clear call-to-action',
          'Test multiple variations',
          'Use emotional triggers'
        ],
        facebook: [
          'Use high-quality, eye-catching visuals',
          'Keep text overlay under 20% of image',
          'Target specific interests and behaviors',
          'Use video content for higher engagement',
          'Include social proof in your copy'
        ],
        google: [
          'Include keywords in your headline',
          'Use ad extensions for more visibility',
          'Match your ad copy to landing page',
          'Include price or promotion details',
          'Use location targeting effectively'
        ],
        instagram: [
          'Use high-quality, visually appealing content',
          'Keep captions concise and engaging',
          'Use relevant hashtags strategically',
          'Include user-generated content',
          'Leverage Instagram Stories and Reels'
        ],
        linkedin: [
          'Use professional, business-focused language',
          'Target by job title and company size',
          'Include industry-specific benefits',
          'Use thought leadership content',
          'Focus on B2B value propositions'
        ]
      };

      const industryTips = {
        'real-estate': [
          'Highlight location benefits',
          'Include virtual tour options',
          'Use local market statistics',
          'Emphasize investment potential'
        ],
        'healthcare': [
          'Focus on patient outcomes',
          'Include credentials and certifications',
          'Use testimonials and reviews',
          'Emphasize convenience and accessibility'
        ],
        'fitness': [
          'Show transformation results',
          'Include trial offers',
          'Use before/after imagery',
          'Emphasize community and support'
        ],
        'education': [
          'Highlight career outcomes',
          'Include success stories',
          'Offer free resources',
          'Emphasize skill development'
        ]
      };

      const selectedTips = tips[adType] || tips.general;
      const selectedIndustryTips = industry && industryTips[industry.toLowerCase()] 
        ? industryTips[industry.toLowerCase()]
        : [];

      res.json({
        success: true,
        data: {
          platformTips: selectedTips,
          industryTips: selectedIndustryTips,
          generalBestPractices: [
            'A/B test different versions',
            'Monitor performance metrics',
            'Optimize for mobile devices',
            'Use compelling visuals',
            'Include urgency or scarcity'
          ]
        }
      });

    } catch (error) {
      console.error('Error fetching quick tips:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tips'
      });
    }
  }
);

// @route   POST /api/ad-grader/demo
// @desc    Demo ad grading (limited functionality, no auth required)
// @access  Public
router.post('/demo',
  validateAdGrading,
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
        adTitle,
        adDescription,
        adType,
        targetAudience,
        callToAction,
        industry
      } = req.body;

      // For demo, we'll use a simplified grading without saving to database
      const adGrader = require('../utils/adGrader');
      
      // Calculate scores without AI analysis for demo
      const scores = {
        headline: adGrader.scoreHeadline(adTitle),
        description: adGrader.scoreDescription(adDescription),
        callToAction: adGrader.scoreCallToAction(callToAction),
        targeting: adGrader.scoreTargeting(targetAudience, industry),
        engagement: adGrader.scoreEngagement(adTitle, adDescription)
      };
      
      const overallScore = adGrader.calculateOverallScore(scores);
      const grade = adGrader.getGradeLetter(overallScore);
      
      // Generate basic feedback
      const feedback = {
        strengths: [],
        improvements: [],
        suggestions: [
          'Consider A/B testing different variations',
          'Include social proof elements',
          'Use specific numbers and statistics',
          'Create urgency with limited-time offers'
        ]
      };
      
      if (scores.headline >= 70) feedback.strengths.push('Strong headline structure');
      if (scores.description >= 70) feedback.strengths.push('Compelling description');
      if (scores.callToAction >= 70) feedback.strengths.push('Clear call-to-action');
      
      if (scores.headline < 60) feedback.improvements.push('Headline needs more impact');
      if (scores.description < 60) feedback.improvements.push('Description should focus on benefits');
      if (scores.callToAction < 60) feedback.improvements.push('Call-to-action needs improvement');
      
      const demoResult = {
        overallScore,
        scores,
        feedback,
        grade,
        isDemo: true,
        message: 'This is a demo version. Sign up for full AI-powered analysis and history tracking.'
      };

      res.json({
        success: true,
        message: 'Demo ad grading completed',
        data: demoResult
      });

    } catch (error) {
      console.error('Demo ad grading error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to grade ad in demo mode'
      });
    }
  }
);

module.exports = router;