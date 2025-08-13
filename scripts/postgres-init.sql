-- PostgreSQL initialization script for GeekSuitePro
-- This script sets up the database schema and initial data

-- Create database (if running manually)
-- CREATE DATABASE geeksuitepro;
-- \c geeksuitepro;

-- Create user (if running manually)
-- CREATE USER geeksuitepro WITH PASSWORD 'password123';
-- GRANT ALL PRIVILEGES ON DATABASE geeksuitepro TO geeksuitepro;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for better performance (Sequelize will create tables)
-- Note: These indexes will be created after Sequelize migrations

-- Insert default data
INSERT INTO "EmailTemplates" (id, name, subject, content, type, "isDefault", "createdAt", "updatedAt")
VALUES 
  (uuid_generate_v4(), 'Welcome Email', 'Welcome to {{company_name}}!', 
   '<h1>Welcome {{first_name}}!</h1><p>Thank you for joining {{company_name}}. We''re excited to have you on board!</p><p>If you have any questions, feel free to reach out to us.</p><p>Best regards,<br>The {{company_name}} Team</p>',
   'welcome', true, NOW(), NOW()),
  (uuid_generate_v4(), 'Follow Up Email', 'Following up on our conversation',
   '<h1>Hi {{first_name}},</h1><p>I wanted to follow up on our recent conversation about {{topic}}.</p><p>Do you have any questions or would you like to schedule a call to discuss further?</p><p>Looking forward to hearing from you!</p><p>Best regards,<br>{{sender_name}}</p>',
   'follow_up', true, NOW(), NOW()),
  (uuid_generate_v4(), 'Appointment Reminder', 'Reminder: Your appointment tomorrow',
   '<h1>Hi {{first_name}},</h1><p>This is a friendly reminder about your upcoming appointment:</p><ul><li><strong>Date:</strong> {{appointment_date}}</li><li><strong>Time:</strong> {{appointment_time}}</li><li><strong>Duration:</strong> {{appointment_duration}}</li></ul><p>If you need to reschedule, please let us know as soon as possible.</p><p>See you soon!</p>',
   'appointment_reminder', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO "SmsTemplates" (id, name, content, type, "isDefault", "createdAt", "updatedAt")
VALUES 
  (uuid_generate_v4(), 'Welcome SMS', 'Hi {{first_name}}! Welcome to {{company_name}}. We''re excited to have you! Reply STOP to opt out.', 'welcome', true, NOW(), NOW()),
  (uuid_generate_v4(), 'Appointment Reminder SMS', 'Hi {{first_name}}, reminder: You have an appointment tomorrow at {{appointment_time}}. Reply STOP to opt out.', 'appointment_reminder', true, NOW(), NOW()),
  (uuid_generate_v4(), 'Follow Up SMS', 'Hi {{first_name}}, just following up on our conversation. Any questions? Reply STOP to opt out.', 'follow_up', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Create default sales pipeline
INSERT INTO "Pipelines" (id, name, description, "ownerId", "agencyId", "isDefault", stages, "createdAt", "updatedAt")
VALUES (
  uuid_generate_v4(),
  'Default Sales Pipeline',
  'Default sales pipeline for new accounts',
  NULL,
  NULL,
  true,
  '[
    {"name": "Lead", "description": "New leads", "color": "#3B82F6", "order": 1, "isDefault": true},
    {"name": "Qualified", "description": "Qualified prospects", "color": "#F59E0B", "order": 2, "isDefault": false},
    {"name": "Proposal", "description": "Proposal sent", "color": "#8B5CF6", "order": 3, "isDefault": false},
    {"name": "Negotiation", "description": "In negotiation", "color": "#EF4444", "order": 4, "isDefault": false},
    {"name": "Closed Won", "description": "Deal closed successfully", "color": "#10B981", "order": 5, "isDefault": false},
    {"name": "Closed Lost", "description": "Deal lost", "color": "#6B7280", "order": 6, "isDefault": false}
  ]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Print completion message
SELECT 'PostgreSQL initialization completed!' as message;
SELECT 'Database: geeksuitepro' as info;
SELECT 'Default templates and pipelines created' as status;