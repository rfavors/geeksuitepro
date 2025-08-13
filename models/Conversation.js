module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define('Conversation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    subject: {
      type: DataTypes.STRING
    },
    channel: {
      type: DataTypes.ENUM('email', 'sms', 'chat', 'phone', 'social'),
      defaultValue: 'email'
    },
    status: {
      type: DataTypes.ENUM('open', 'closed', 'pending', 'resolved'),
      defaultValue: 'open'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium'
    },
    messages: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    lastMessageAt: {
      type: DataTypes.DATE
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['contactId'] },
      { fields: ['status'] },
      { fields: ['channel'] }
    ]
  });

  return Conversation;
};