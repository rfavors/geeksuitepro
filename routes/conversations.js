const express = require('express');
const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
const { auth, authorize, checkPermission, checkUsageLimit } = require('../middleware/auth');
const { validateInput, validatePagination } = require('../middleware/validation');
const { sendEmail, sendSMS } = require('../utils/email');
const router = express.Router();

// @route   GET /api/conversations
// @desc    Get all conversations with filtering and pagination
// @access  Private
router.get('/', 
  auth, 
  checkPermission('conversations', 'read'),
  validatePagination,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        channel,
        status,
        assignedTo,
        priority,
        unreadOnly,
        sort = '-lastMessageAt'
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
          { 'contact.firstName': { $regex: search, $options: 'i' } },
          { 'contact.lastName': { $regex: search, $options: 'i' } },
          { 'contact.email': { $regex: search, $options: 'i' } },
          { 'contact.phone': { $regex: search, $options: 'i' } },
          { 'messages.content': { $regex: search, $options: 'i' } }
        ];
      }

      // Channel filter
      if (channel) {
        filter.channels = channel;
      }

      // Status filter
      if (status) {
        filter.status = status;
      }

      // Assigned filter
      if (assignedTo) {
        filter.assignedTo = assignedTo;
      }

      // Priority filter
      if (priority) {
        filter.priority = priority;
      }

      // Unread only filter
      if (unreadOnly === 'true') {
        filter.unreadCount = { $gt: 0 };
      }

      // Execute query with pagination
      const conversations = await Conversation.find(filter)
        .populate('contactId', 'firstName lastName email phone avatar')
        .populate('assignedTo', 'firstName lastName email')
        .populate('lastMessage')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // Get total count for pagination
      const total = await Conversation.countDocuments(filter);

      res.json({
        success: true,
        data: {
          conversations,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });

    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/conversations/:id
// @desc    Get single conversation with messages
// @access  Private
router.get('/:id', 
  auth, 
  checkPermission('conversations', 'read'),
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      })
      .populate('contactId', 'firstName lastName email phone avatar')
      .populate('assignedTo', 'firstName lastName email')
      .populate('messages.sentBy', 'firstName lastName email')
      .populate('tags', 'name color');

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Mark as read
      if (conversation.unreadCount > 0) {
        await conversation.markAsRead(req.user.id);
      }

      res.json({
        success: true,
        data: { conversation }
      });

    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/conversations
// @desc    Create new conversation
// @access  Private
router.post('/', 
  auth, 
  checkPermission('conversations', 'create'),
  checkUsageLimit('conversations'),
  validateInput([
    { field: 'contactId', required: true, type: 'string' },
    { field: 'channel', required: true, type: 'string', enum: ['email', 'sms', 'facebook', 'instagram', 'whatsapp', 'webchat', 'phone'] },
    { field: 'subject', required: false, type: 'string', maxLength: 200 }
  ]),
  async (req, res) => {
    try {
      const { contactId, channel, subject } = req.body;

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

      // Check if conversation already exists for this contact and channel
      let conversation = await Conversation.findOne({
        contactId,
        channels: channel,
        ownerId: req.user.id,
        status: { $ne: 'closed' }
      });

      if (conversation) {
        return res.json({
          success: true,
          message: 'Conversation already exists',
          data: { conversation }
        });
      }

      // Create new conversation
      const conversationData = {
        contactId,
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          avatar: contact.avatar
        },
        channels: [channel],
        subject: subject || `${channel} conversation with ${contact.firstName} ${contact.lastName}`,
        ownerId: req.user.id,
        agencyId: req.user.agencyId,
        clientId: req.user.clientId,
        assignedTo: req.user.id
      };

      conversation = new Conversation(conversationData);
      await conversation.save();

      // Update user usage
      await req.user.updateUsage('conversations', 1);

      res.status(201).json({
        success: true,
        message: 'Conversation created successfully',
        data: { conversation }
      });

    } catch (error) {
      console.error('Create conversation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/conversations/:id/assign
// @desc    Assign conversation to user
// @access  Private
router.put('/:id/assign', 
  auth, 
  checkPermission('conversations', 'update'),
  validateInput([
    { field: 'assignedTo', required: true, type: 'string' }
  ]),
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      await conversation.assignTo(req.body.assignedTo, req.user.id);

      res.json({
        success: true,
        message: 'Conversation assigned successfully',
        data: { conversation }
      });

    } catch (error) {
      console.error('Assign conversation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/conversations/:id/status
// @desc    Update conversation status
// @access  Private
router.put('/:id/status', 
  auth, 
  checkPermission('conversations', 'update'),
  validateInput([
    { field: 'status', required: true, type: 'string', enum: ['open', 'pending', 'resolved', 'closed'] }
  ]),
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      conversation.status = req.body.status;
      if (req.body.status === 'closed') {
        conversation.closedAt = new Date();
        conversation.closedBy = req.user.id;
      }
      await conversation.save();

      res.json({
        success: true,
        message: 'Conversation status updated successfully',
        data: { conversation }
      });

    } catch (error) {
      console.error('Update conversation status error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/conversations/:id/priority
// @desc    Update conversation priority
// @access  Private
router.put('/:id/priority', 
  auth, 
  checkPermission('conversations', 'update'),
  validateInput([
    { field: 'priority', required: true, type: 'string', enum: ['low', 'normal', 'high', 'urgent'] }
  ]),
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      conversation.priority = req.body.priority;
      await conversation.save();

      res.json({
        success: true,
        message: 'Conversation priority updated successfully',
        data: { conversation }
      });

    } catch (error) {
      console.error('Update conversation priority error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ MESSAGE ROUTES ============

// @route   POST /api/conversations/:id/messages
// @desc    Send message in conversation
// @access  Private
router.post('/:id/messages', 
  auth, 
  checkPermission('conversations', 'create'),
  validateInput([
    { field: 'content', required: true, type: 'string', maxLength: 2000 },
    { field: 'type', required: false, type: 'string', enum: ['text', 'image', 'file', 'audio', 'video'] },
    { field: 'channel', required: true, type: 'string', enum: ['email', 'sms', 'facebook', 'instagram', 'whatsapp', 'webchat', 'phone'] }
  ]),
  async (req, res) => {
    try {
      const { content, type = 'text', channel, attachments } = req.body;

      const conversation = await Conversation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      }).populate('contactId');

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Add message to conversation
      const message = await conversation.addMessage({
        content,
        type,
        channel,
        direction: 'outbound',
        sentBy: req.user.id,
        attachments
      });

      // Send the actual message based on channel
      try {
        if (channel === 'email' && conversation.contact.email) {
          await sendEmail({
            to: conversation.contact.email,
            subject: conversation.subject || 'Message from ' + (req.user.businessName || 'Business'),
            text: content,
            html: content.replace(/\n/g, '<br>')
          });
        } else if (channel === 'sms' && conversation.contact.phone) {
          await sendSMS({
            to: conversation.contact.phone,
            message: content
          });
        }
        // Other channels would be handled by their respective APIs
      } catch (sendError) {
        console.error('Error sending message:', sendError);
        // Update message status to failed
        message.status = 'failed';
        message.error = sendError.message;
        await conversation.save();
      }

      res.json({
        success: true,
        message: 'Message sent successfully',
        data: { message, conversation }
      });

    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/conversations/:id/messages/bulk
// @desc    Send bulk messages
// @access  Private
router.post('/:id/messages/bulk', 
  auth, 
  checkPermission('conversations', 'create'),
  validateInput([
    { field: 'messages', required: true, type: 'array' }
  ]),
  async (req, res) => {
    try {
      const { messages } = req.body;

      const conversation = await Conversation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      for (const messageData of messages) {
        try {
          await conversation.addMessage({
            ...messageData,
            direction: 'outbound',
            sentBy: req.user.id
          });
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push(error.message);
        }
      }

      res.json({
        success: true,
        message: `Bulk messages processed. Sent: ${results.sent}, Failed: ${results.failed}`,
        data: { results }
      });

    } catch (error) {
      console.error('Bulk send messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/conversations/:id/messages/:messageId
// @desc    Update message (edit, mark as read, etc.)
// @access  Private
router.put('/:id/messages/:messageId', 
  auth, 
  checkPermission('conversations', 'update'),
  async (req, res) => {
    try {
      const { content, status } = req.body;

      const conversation = await Conversation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const message = conversation.messages.id(req.params.messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      if (content) message.content = content;
      if (status) message.status = status;
      message.updatedAt = new Date();

      await conversation.save();

      res.json({
        success: true,
        message: 'Message updated successfully',
        data: { message }
      });

    } catch (error) {
      console.error('Update message error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/conversations/:id/messages/:messageId
// @desc    Delete message
// @access  Private
router.delete('/:id/messages/:messageId', 
  auth, 
  checkPermission('conversations', 'delete'),
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const message = conversation.messages.id(req.params.messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      message.remove();
      await conversation.save();

      res.json({
        success: true,
        message: 'Message deleted successfully'
      });

    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ ANALYTICS AND REPORTING ============

// @route   GET /api/conversations/analytics
// @desc    Get conversation analytics
// @access  Private
router.get('/analytics', 
  auth, 
  checkPermission('conversations', 'read'),
  async (req, res) => {
    try {
      const { startDate, endDate, channel } = req.query;

      const analytics = await Conversation.getAnalytics(
        req.user.id,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        channel
      );

      res.json({
        success: true,
        data: { analytics }
      });

    } catch (error) {
      console.error('Get conversation analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/conversations/unread-count
// @desc    Get unread conversations count
// @access  Private
router.get('/unread-count', 
  auth, 
  checkPermission('conversations', 'read'),
  async (req, res) => {
    try {
      const count = await Conversation.countDocuments({
        ownerId: req.user.id,
        unreadCount: { $gt: 0 },
        isDeleted: false
      });

      res.json({
        success: true,
        data: { unreadCount: count }
      });

    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ WEBHOOK ENDPOINTS ============

// @route   POST /api/conversations/webhook/:channel
// @desc    Receive incoming messages from external channels
// @access  Public (with webhook validation)
router.post('/webhook/:channel', async (req, res) => {
  try {
    const { channel } = req.params;
    const webhookData = req.body;

    // This would handle incoming messages from various platforms
    // Each platform has its own webhook format
    
    // Example for SMS (Twilio format)
    if (channel === 'sms') {
      const { From, Body, MessageSid } = webhookData;
      
      // Find or create conversation
      let conversation = await Conversation.findOne({
        'contact.phone': From,
        channels: 'sms',
        status: { $ne: 'closed' }
      });

      if (!conversation) {
        // Create new conversation for unknown contact
        const contact = await Contact.findOne({ phone: From }) || 
          new Contact({
            phone: From,
            firstName: 'Unknown',
            lastName: 'Contact',
            source: 'sms_webhook'
          });
        
        if (contact.isNew) await contact.save();

        conversation = new Conversation({
          contactId: contact._id,
          contact: {
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone: contact.phone
          },
          channels: ['sms'],
          subject: `SMS from ${From}`,
          // ownerId would be determined by phone number routing
        });
        await conversation.save();
      }

      // Add incoming message
      await conversation.addMessage({
        content: Body,
        type: 'text',
        channel: 'sms',
        direction: 'inbound',
        externalId: MessageSid
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

module.exports = router;