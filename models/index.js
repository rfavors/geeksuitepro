const { sequelize, Sequelize } = require('../config/database');
const { DataTypes } = Sequelize;

// Import all models
const User = require('./User')(sequelize, DataTypes);
const Contact = require('./Contact')(sequelize, DataTypes);
const Campaign = require('./Campaign')(sequelize, DataTypes);
const Funnel = require('./Funnel')(sequelize, DataTypes);
const Form = require('./Form')(sequelize, DataTypes);
const Appointment = require('./Appointment')(sequelize, DataTypes);
const Automation = require('./Automation')(sequelize, DataTypes);
const Conversation = require('./Conversation')(sequelize, DataTypes);
const Website = require('./Website')(sequelize, DataTypes);
const Pipeline = require('./Pipeline')(sequelize, DataTypes);
const Review = require('./Review')(sequelize, DataTypes);
const AdGrade = require('./AdGrade')(sequelize, DataTypes);
const Keyword = require('./Keyword')(sequelize, DataTypes);

// Define associations
User.hasMany(Contact, { foreignKey: 'userId' });
Contact.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Campaign, { foreignKey: 'userId' });
Campaign.belongsTo(User, { foreignKey: 'userId' });

Campaign.belongsToMany(Contact, { through: 'CampaignContacts' });
Contact.belongsToMany(Campaign, { through: 'CampaignContacts' });

User.hasMany(Funnel, { foreignKey: 'userId' });
Funnel.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Form, { foreignKey: 'userId' });
Form.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Appointment, { foreignKey: 'userId' });
Appointment.belongsTo(User, { foreignKey: 'userId' });

Contact.hasMany(Appointment, { foreignKey: 'contactId' });
Appointment.belongsTo(Contact, { foreignKey: 'contactId' });

User.hasMany(Automation, { foreignKey: 'userId' });
Automation.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Conversation, { foreignKey: 'userId' });
Conversation.belongsTo(User, { foreignKey: 'userId' });

Contact.hasMany(Conversation, { foreignKey: 'contactId' });
Conversation.belongsTo(Contact, { foreignKey: 'contactId' });

User.hasMany(Website, { foreignKey: 'userId' });
Website.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Pipeline, { foreignKey: 'userId' });
Pipeline.belongsTo(User, { foreignKey: 'userId' });

Contact.belongsTo(Pipeline, { foreignKey: 'pipelineId' });
Pipeline.hasMany(Contact, { foreignKey: 'pipelineId' });

User.hasMany(Review, { foreignKey: 'userId' });
Review.belongsTo(User, { foreignKey: 'userId' });

Contact.hasMany(Review, { foreignKey: 'contactId' });
Review.belongsTo(Contact, { foreignKey: 'contactId' });

User.hasMany(AdGrade, { foreignKey: 'userId' });
AdGrade.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Keyword, { foreignKey: 'userId' });
Keyword.belongsTo(User, { foreignKey: 'userId' });

// Many-to-many relationship between Keywords and Campaigns
Keyword.belongsToMany(Campaign, { through: 'CampaignKeywords' });
Campaign.belongsToMany(Keyword, { through: 'CampaignKeywords' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Contact,
  Campaign,
  Funnel,
  Form,
  Appointment,
  Automation,
  Conversation,
  Website,
  Pipeline,
  Review,
  AdGrade,
  Keyword
};