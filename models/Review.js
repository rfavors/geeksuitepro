module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define('Review', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    title: {
      type: DataTypes.STRING
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    reviewerName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    reviewerEmail: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true
      }
    },
    reviewerAvatar: {
      type: DataTypes.STRING
    },
    platform: {
      type: DataTypes.ENUM('google', 'facebook', 'yelp', 'trustpilot', 'manual'),
      defaultValue: 'manual'
    },
    externalId: {
      type: DataTypes.STRING
    },
    externalUrl: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'hidden'),
      defaultValue: 'pending'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    response: {
      type: DataTypes.TEXT
    },
    respondedAt: {
      type: DataTypes.DATE
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    contactId: {
      type: DataTypes.UUID
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
      { fields: ['rating'] },
      { fields: ['status'] },
      { fields: ['platform'] },
      { fields: ['isFeatured'] }
    ]
  });

  return Review;
};