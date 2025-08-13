const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const Form = require('../models/Form');
const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Rate limiting for webhooks
const webhookLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: 'Too many webhook requests'
});

router.use(webhookLimit);

// Twilio SMS webhook
router.post('/twilio/sms', async (req, res) => {
  try {
    const { From, To, Body, MessageSid, AccountSid } = req.body;
    
    // Verify Twilio signature (optional but recommended)
    if (process.env.TWILIO_AUTH_TOKEN) {
      const twilioSignature = req.headers['x-twilio-signature'];
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const expectedSignature = crypto
        .createHmac('sha1', process.env.TWILIO_AUTH_TOKEN)
        .update(Buffer.from(url + JSON.stringify(req.body), 'utf-8'))
        .digest('base64');
      
      if (twilioSignature !== expectedSignature) {
        return res.status(403).send('Forbidden');
      }
    }
    
    // Find or create contact
    let contact = await Contact.findOne({ phone: From });
    if (!contact) {
      contact = new Contact({
        phone: From,
        firstName: 'Unknown',
        lastName: 'Contact',
        source: 'sms',
        ownerId: process.env.DEFAULT_OWNER_ID // Set a default owner or determine from To number
      });
      await contact.save();
    }
    
    // Find or create conversation
    let conversation = await Conversation.findOne({
      contactId: contact._id,
      channels: 'sms',
      status: { $in: ['open', 'pending'] }
    });
    
    if (!conversation) {
      conversation = new Conversation({
        contactId: contact._id,
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone
        },
        channels: ['sms'],
        ownerId: contact.ownerId,
        agencyId: contact.agencyId,
        clientId: contact.clientId
      });
    }
    
    // Add message to conversation
    await conversation.addMessage({
      content: Body,
      type: 'text',
      channel: 'sms',
      direction: 'inbound',
      senderPhone: From,
      externalId: MessageSid,
      externalData: {
        accountSid: AccountSid,
        to: To
      }
    });
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Twilio SMS webhook error:', error);
    res.status(500).send('Error processing SMS');
  }
});

// Twilio Voice webhook
router.post('/twilio/voice', async (req, res) => {
  try {
    const { From, To, CallSid, CallStatus, Direction } = req.body;
    
    // Find or create contact
    let contact = await Contact.findOne({ phone: From });
    if (!contact) {
      contact = new Contact({
        phone: From,
        firstName: 'Unknown',
        lastName: 'Contact',
        source: 'phone',
        ownerId: process.env.DEFAULT_OWNER_ID
      });
      await contact.save();
    }
    
    // Log call activity
    contact.activities.push({
      type: 'call',
      description: `${Direction} call - ${CallStatus}`,
      metadata: {
        callSid: CallSid,
        from: From,
        to: To,
        status: CallStatus,
        direction: Direction
      },
      performedBy: contact.ownerId,
      performedAt: new Date()
    });
    
    await contact.save();
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Twilio Voice webhook error:', error);
    res.status(500).send('Error processing call');
  }
});

// Mailgun email webhook
router.post('/mailgun/email', async (req, res) => {
  try {
    const { sender, recipient, subject, 'body-plain': bodyPlain, 'Message-Id': messageId } = req.body;
    
    // Verify Mailgun signature
    if (process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
      const signature = crypto
        .createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY)
        .update(Buffer.from(req.body.timestamp + req.body.token, 'utf-8'))
        .digest('hex');
      
      if (signature !== req.body.signature) {
        return res.status(403).send('Forbidden');
      }
    }
    
    // Find or create contact
    let contact = await Contact.findOne({ email: sender });
    if (!contact) {
      contact = new Contact({
        email: sender,
        firstName: 'Unknown',
        lastName: 'Contact',
        source: 'email',
        ownerId: process.env.DEFAULT_OWNER_ID
      });
      await contact.save();
    }
    
    // Find or create conversation
    let conversation = await Conversation.findOne({
      contactId: contact._id,
      channels: 'email',
      status: { $in: ['open', 'pending'] }
    });
    
    if (!conversation) {
      conversation = new Conversation({
        contactId: contact._id,
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email
        },
        channels: ['email'],
        subject: subject,
        ownerId: contact.ownerId,
        agencyId: contact.agencyId,
        clientId: contact.clientId
      });
    }
    
    // Add message to conversation
    await conversation.addMessage({
      content: bodyPlain || 'No content',
      type: 'text',
      channel: 'email',
      direction: 'inbound',
      senderEmail: sender,
      subject: subject,
      externalId: messageId
    });
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Mailgun email webhook error:', error);
    res.status(500).send('Error processing email');
  }
});

// Facebook Messenger webhook
router.get('/facebook/messenger', (req, res) => {
  // Webhook verification
  const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Facebook webhook verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

router.post('/facebook/messenger', async (req, res) => {
  try {
    const body = req.body;
    
    if (body.object === 'page') {
      body.entry.forEach(async (entry) => {
        const webhookEvent = entry.messaging[0];
        const senderId = webhookEvent.sender.id;
        const message = webhookEvent.message;
        
        if (message) {
          // Find or create contact
          let contact = await Contact.findOne({ 'externalIds.facebook': senderId });
          if (!contact) {
            contact = new Contact({
              firstName: 'Facebook',
              lastName: 'User',
              source: 'facebook',
              externalIds: { facebook: senderId },
              ownerId: process.env.DEFAULT_OWNER_ID
            });
            await contact.save();
          }
          
          // Find or create conversation
          let conversation = await Conversation.findOne({
            contactId: contact._id,
            channels: 'facebook',
            status: { $in: ['open', 'pending'] }
          });
          
          if (!conversation) {
            conversation = new Conversation({
              contactId: contact._id,
              contact: {
                firstName: contact.firstName,
                lastName: contact.lastName
              },
              channels: ['facebook'],
              ownerId: contact.ownerId,
              externalIds: { facebook: senderId }
            });
          }
          
          // Add message to conversation
          await conversation.addMessage({
            content: message.text || 'Media message',
            type: message.attachments ? 'file' : 'text',
            channel: 'facebook',
            direction: 'inbound',
            externalId: message.mid,
            externalData: {
              senderId: senderId,
              timestamp: webhookEvent.timestamp
            }
          });
        }
      });
      
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('Facebook Messenger webhook error:', error);
    res.status(500).send('Error processing message');
  }
});

// Google My Business reviews webhook
router.post('/google/reviews', async (req, res) => {
  try {
    const { reviewId, reviewer, rating, comment, createTime } = req.body;
    
    // Create review record
    const review = new Review({
      platform: 'google',
      externalId: reviewId,
      reviewer: {
        name: reviewer.displayName || 'Anonymous',
        avatar: reviewer.profilePhotoUrl
      },
      rating: rating,
      text: comment || '',
      reviewedAt: new Date(createTime),
      ownerId: process.env.DEFAULT_OWNER_ID
    });
    
    await review.save();
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Google reviews webhook error:', error);
    res.status(500).send('Error processing review');
  }
});

// Stripe payment webhook
router.post('/stripe/payments', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    let event;
    
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = req.body;
    }
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        // Handle successful payment
        console.log('Payment succeeded:', paymentIntent.id);
        break;
        
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        // Handle failed payment
        console.log('Payment failed:', failedPayment.id);
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).send('Webhook error');
  }
});

// Zapier webhook
router.post('/zapier/:hookId', async (req, res) => {
  try {
    const { hookId } = req.params;
    const data = req.body;
    
    // Process Zapier webhook data
    console.log(`Zapier webhook ${hookId}:`, data);
    
    // You can implement custom logic here based on hookId
    // For example, create contacts, trigger automations, etc.
    
    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Zapier webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Generic webhook endpoint
router.post('/generic/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const data = req.body;
    
    // Log webhook for debugging
    console.log(`Generic webhook ${identifier}:`, {
      headers: req.headers,
      body: data,
      timestamp: new Date().toISOString()
    });
    
    // You can implement custom webhook processing logic here
    // based on the identifier and data received
    
    res.status(200).json({ 
      success: true, 
      message: 'Webhook received',
      identifier,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Generic webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Campaign tracking webhook (for email opens, clicks, etc.)
router.get('/track/email/:campaignId/:contactId/open', async (req, res) => {
  try {
    const { campaignId, contactId } = req.params;
    
    // Update campaign analytics
    await Campaign.findByIdAndUpdate(campaignId, {
      $inc: { 'analytics.opens': 1 }
    });
    
    // Update contact activity
    await Contact.findByIdAndUpdate(contactId, {
      $push: {
        activities: {
          type: 'email_open',
          description: 'Opened email campaign',
          metadata: { campaignId },
          performedAt: new Date()
        }
      }
    });
    
    // Return 1x1 transparent pixel
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(pixel);
  } catch (error) {
    console.error('Email tracking error:', error);
    res.status(500).send('Error');
  }
});

router.get('/track/email/:campaignId/:contactId/click', async (req, res) => {
  try {
    const { campaignId, contactId } = req.params;
    const { url } = req.query;
    
    // Update campaign analytics
    await Campaign.findByIdAndUpdate(campaignId, {
      $inc: { 'analytics.clicks': 1 }
    });
    
    // Update contact activity
    await Contact.findByIdAndUpdate(contactId, {
      $push: {
        activities: {
          type: 'email_click',
          description: 'Clicked email link',
          metadata: { campaignId, url },
          performedAt: new Date()
        }
      }
    });
    
    // Redirect to original URL
    res.redirect(url || 'https://geeksuitepro.com');
  } catch (error) {
    console.error('Email click tracking error:', error);
    res.redirect('https://geeksuitepro.com');
  }
});

module.exports = router;