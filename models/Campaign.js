module.exports = (sequelize, DataTypes) => {
  const Campaign = sequelize.define('Campaign', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('email', 'sms', 'voice', 'mixed'),
      defaultValue: 'email'
    },
    status: {
      type: DataTypes.ENUM('draft', 'scheduled', 'active', 'paused', 'completed', 'sent'),
      defaultValue: 'draft'
    },
    subject: {
      type: DataTypes.STRING
    },
    content: {
      type: DataTypes.TEXT
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    stats: {
      type: DataTypes.JSON,
      defaultValue: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0
      }
    },
    scheduledAt: {
      type: DataTypes.DATE
    },
    sentAt: {
      type: DataTypes.DATE
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['type'] }
    ]
  });

  return Campaign;
};