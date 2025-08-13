const express = require('express');
const Appointment = require('../models/Appointment');
const Contact = require('../models/Contact');
const { auth, authorize, checkPermission, checkUsageLimit, optionalAuth } = require('../middleware/auth');
const { validateAppointment, validatePagination } = require('../middleware/validation');
const { sendEmail } = require('../utils/email');
const router = express.Router();

// @route   GET /api/appointments
// @desc    Get all appointments with filtering and pagination
// @access  Private
router.get('/', 
  auth, 
  checkPermission('appointments', 'read'),
  validatePagination,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        type,
        startDate,
        endDate,
        calendarId,
        sort = 'startTime'
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
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { 'contact.firstName': { $regex: search, $options: 'i' } },
          { 'contact.lastName': { $regex: search, $options: 'i' } },
          { 'contact.email': { $regex: search, $options: 'i' } }
        ];
      }

      // Status filter
      if (status) {
        filter.status = status;
      }

      // Type filter
      if (type) {
        filter.type = type;
      }

      // Calendar filter
      if (calendarId) {
        filter.calendarId = calendarId;
      }

      // Date range filter
      if (startDate || endDate) {
        filter.startTime = {};
        if (startDate) filter.startTime.$gte = new Date(startDate);
        if (endDate) filter.startTime.$lte = new Date(endDate);
      }

      // Execute query with pagination
      const appointments = await Appointment.find(filter)
        .populate('ownerId', 'firstName lastName')
        .populate('contactId', 'firstName lastName email phone')
        .populate('calendarId', 'name')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // Get total count for pagination
      const total = await Appointment.countDocuments(filter);

      res.json({
        success: true,
        data: {
          appointments,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });

    } catch (error) {
      console.error('Get appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/appointments/:id
// @desc    Get single appointment
// @access  Private
router.get('/:id', 
  auth, 
  checkPermission('appointments', 'read'),
  async (req, res) => {
    try {
      const appointment = await Appointment.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      })
      .populate('ownerId', 'firstName lastName email')
      .populate('contactId', 'firstName lastName email phone')
      .populate('calendarId', 'name settings')
      .populate('assignedTo', 'firstName lastName email');

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      res.json({
        success: true,
        data: { appointment }
      });

    } catch (error) {
      console.error('Get appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/appointments
// @desc    Create new appointment
// @access  Private
router.post('/', 
  auth, 
  checkPermission('appointments', 'create'),
  checkUsageLimit('appointments'),
  validateAppointment,
  async (req, res) => {
    try {
      const appointmentData = {
        ...req.body,
        ownerId: req.user.id,
        agencyId: req.user.agencyId,
        clientId: req.user.clientId
      };

      // Check for conflicts
      const conflicts = await Appointment.findConflicts(
        appointmentData.startTime,
        appointmentData.endTime,
        appointmentData.assignedTo || req.user.id,
        appointmentData.calendarId
      );

      if (conflicts.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Time slot conflicts with existing appointment',
          conflicts
        });
      }

      const appointment = new Appointment(appointmentData);
      await appointment.save();

      // Update user usage
      await req.user.updateUsage('appointments', 1);

      // Send confirmation emails
      if (appointment.notifications.email) {
        try {
          // Send to contact
          if (appointment.contact.email) {
            await sendEmail({
              to: appointment.contact.email,
              subject: `Appointment Confirmation: ${appointment.title}`,
              template: 'appointment-confirmation',
              data: { appointment }
            });
          }

          // Send to assigned user
          if (appointment.assignedTo && appointment.assignedTo.toString() !== req.user.id) {
            const assignedUser = await User.findById(appointment.assignedTo);
            if (assignedUser) {
              await sendEmail({
                to: assignedUser.email,
                subject: `New Appointment Assigned: ${appointment.title}`,
                template: 'appointment-assigned',
                data: { appointment, assignedUser }
              });
            }
          }
        } catch (emailError) {
          console.error('Email sending error:', emailError);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        data: { appointment }
      });

    } catch (error) {
      console.error('Create appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/appointments/:id
// @desc    Update appointment
// @access  Private
router.put('/:id', 
  auth, 
  checkPermission('appointments', 'update'),
  validateAppointment,
  async (req, res) => {
    try {
      const appointment = await Appointment.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      // Check for conflicts if time is being changed
      if (req.body.startTime || req.body.endTime) {
        const newStartTime = req.body.startTime ? new Date(req.body.startTime) : appointment.startTime;
        const newEndTime = req.body.endTime ? new Date(req.body.endTime) : appointment.endTime;
        const assignedTo = req.body.assignedTo || appointment.assignedTo;
        const calendarId = req.body.calendarId || appointment.calendarId;

        const conflicts = await Appointment.findConflicts(
          newStartTime,
          newEndTime,
          assignedTo,
          calendarId,
          appointment._id // Exclude current appointment
        );

        if (conflicts.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Time slot conflicts with existing appointment',
            conflicts
          });
        }
      }

      // Store original data for comparison
      const originalData = {
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        title: appointment.title,
        status: appointment.status
      };

      Object.assign(appointment, req.body);
      await appointment.save();

      // Send update notifications if significant changes
      const hasSignificantChanges = 
        originalData.startTime.getTime() !== appointment.startTime.getTime() ||
        originalData.endTime.getTime() !== appointment.endTime.getTime() ||
        originalData.title !== appointment.title ||
        originalData.status !== appointment.status;

      if (hasSignificantChanges && appointment.notifications.email) {
        try {
          if (appointment.contact.email) {
            await sendEmail({
              to: appointment.contact.email,
              subject: `Appointment Updated: ${appointment.title}`,
              template: 'appointment-updated',
              data: { appointment, originalData }
            });
          }
        } catch (emailError) {
          console.error('Email sending error:', emailError);
        }
      }

      res.json({
        success: true,
        message: 'Appointment updated successfully',
        data: { appointment }
      });

    } catch (error) {
      console.error('Update appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/appointments/:id
// @desc    Cancel/Delete appointment
// @access  Private
router.delete('/:id', 
  auth, 
  checkPermission('appointments', 'delete'),
  async (req, res) => {
    try {
      const { reason } = req.body;

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      await appointment.cancel(reason);

      // Send cancellation notifications
      if (appointment.notifications.email) {
        try {
          if (appointment.contact.email) {
            await sendEmail({
              to: appointment.contact.email,
              subject: `Appointment Cancelled: ${appointment.title}`,
              template: 'appointment-cancelled',
              data: { appointment, reason }
            });
          }
        } catch (emailError) {
          console.error('Email sending error:', emailError);
        }
      }

      res.json({
        success: true,
        message: 'Appointment cancelled successfully'
      });

    } catch (error) {
      console.error('Cancel appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/appointments/:id/reschedule
// @desc    Reschedule appointment
// @access  Private
router.post('/:id/reschedule', 
  auth, 
  checkPermission('appointments', 'update'),
  async (req, res) => {
    try {
      const { startTime, endTime, reason } = req.body;

      if (!startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'Start time and end time are required'
        });
      }

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      const originalStartTime = appointment.startTime;
      const originalEndTime = appointment.endTime;

      await appointment.reschedule(new Date(startTime), new Date(endTime), reason);

      // Send reschedule notifications
      if (appointment.notifications.email) {
        try {
          if (appointment.contact.email) {
            await sendEmail({
              to: appointment.contact.email,
              subject: `Appointment Rescheduled: ${appointment.title}`,
              template: 'appointment-rescheduled',
              data: { 
                appointment, 
                originalStartTime, 
                originalEndTime, 
                reason 
              }
            });
          }
        } catch (emailError) {
          console.error('Email sending error:', emailError);
        }
      }

      res.json({
        success: true,
        message: 'Appointment rescheduled successfully',
        data: { appointment }
      });

    } catch (error) {
      console.error('Reschedule appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/appointments/:id/complete
// @desc    Mark appointment as completed
// @access  Private
router.post('/:id/complete', 
  auth, 
  checkPermission('appointments', 'update'),
  async (req, res) => {
    try {
      const { notes, outcome } = req.body;

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      await appointment.complete(notes, outcome);

      res.json({
        success: true,
        message: 'Appointment marked as completed',
        data: { appointment }
      });

    } catch (error) {
      console.error('Complete appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/appointments/:id/no-show
// @desc    Mark appointment as no-show
// @access  Private
router.post('/:id/no-show', 
  auth, 
  checkPermission('appointments', 'update'),
  async (req, res) => {
    try {
      const { notes } = req.body;

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        ownerId: req.user.id,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      await appointment.markNoShow(notes);

      res.json({
        success: true,
        message: 'Appointment marked as no-show',
        data: { appointment }
      });

    } catch (error) {
      console.error('Mark no-show error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ CALENDAR AVAILABILITY ROUTES ============

// @route   GET /api/appointments/availability/:calendarId
// @desc    Get available time slots for a calendar
// @access  Public
router.get('/availability/:calendarId', 
  optionalAuth,
  async (req, res) => {
    try {
      const { date, duration = 30, timezone = 'UTC' } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date is required'
        });
      }

      // This would typically query a Calendar model
      // For now, returning mock availability data
      const availableSlots = await Appointment.getAvailableSlots(
        req.params.calendarId,
        new Date(date),
        parseInt(duration),
        timezone
      );

      res.json({
        success: true,
        data: { availableSlots }
      });

    } catch (error) {
      console.error('Get availability error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/appointments/book/:calendarId
// @desc    Book appointment (public booking)
// @access  Public
router.post('/book/:calendarId', 
  optionalAuth,
  async (req, res) => {
    try {
      const {
        startTime,
        endTime,
        contact,
        type,
        notes,
        timezone = 'UTC'
      } = req.body;

      if (!startTime || !endTime || !contact || !contact.email) {
        return res.status(400).json({
          success: false,
          message: 'Start time, end time, and contact email are required'
        });
      }

      // This would typically query a Calendar model to get owner info
      // For now, we'll create a mock calendar lookup
      const calendarId = req.params.calendarId;
      
      // Check availability
      const conflicts = await Appointment.findConflicts(
        new Date(startTime),
        new Date(endTime),
        null, // No specific user for public booking
        calendarId
      );

      if (conflicts.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Selected time slot is no longer available'
        });
      }

      // Create or find contact
      let contactRecord = await Contact.findOne({
        email: contact.email,
        // ownerId would come from calendar owner
      });

      if (!contactRecord) {
        contactRecord = new Contact({
          ...contact,
          source: 'booking',
          // ownerId would come from calendar owner
        });
        await contactRecord.save();
      }

      // Create appointment
      const appointmentData = {
        title: `${type || 'Appointment'} with ${contact.firstName} ${contact.lastName}`,
        description: notes,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        type: type || 'consultation',
        status: 'confirmed',
        contactId: contactRecord._id,
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone
        },
        calendarId,
        timezone,
        source: 'public_booking',
        notifications: {
          email: true,
          sms: !!contact.phone
        },
        // ownerId would come from calendar owner
        // agencyId would come from calendar owner
      };

      const appointment = new Appointment(appointmentData);
      await appointment.save();

      // Send confirmation emails
      try {
        await sendEmail({
          to: contact.email,
          subject: `Appointment Confirmation: ${appointment.title}`,
          template: 'appointment-confirmation',
          data: { appointment }
        });
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }

      res.status(201).json({
        success: true,
        message: 'Appointment booked successfully',
        data: { 
          appointment: {
            id: appointment._id,
            title: appointment.title,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            status: appointment.status
          }
        }
      });

    } catch (error) {
      console.error('Book appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ============ APPOINTMENT ANALYTICS ROUTES ============

// @route   GET /api/appointments/analytics
// @desc    Get appointment analytics
// @access  Private
router.get('/analytics', 
  auth, 
  checkPermission('appointments', 'read'),
  async (req, res) => {
    try {
      const { startDate, endDate, calendarId } = req.query;

      const analytics = await Appointment.getAnalytics(
        req.user.id,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        calendarId
      );

      res.json({
        success: true,
        data: { analytics }
      });

    } catch (error) {
      console.error('Get appointment analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/appointments/upcoming
// @desc    Get upcoming appointments
// @access  Private
router.get('/upcoming', 
  auth, 
  checkPermission('appointments', 'read'),
  async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const appointments = await Appointment.find({
        ownerId: req.user.id,
        startTime: { $gte: new Date() },
        status: { $in: ['confirmed', 'pending'] },
        isDeleted: false
      })
      .populate('contactId', 'firstName lastName email phone')
      .sort({ startTime: 1 })
      .limit(parseInt(limit));

      res.json({
        success: true,
        data: { appointments }
      });

    } catch (error) {
      console.error('Get upcoming appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

module.exports = router;