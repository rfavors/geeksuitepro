module.exports = (sequelize, DataTypes) => {
  const AdGrade = sequelize.define('AdGrade', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    adTitle: {
      type: DataTypes.STRING,
      allowNull: false
    },
    adDescription: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    adType: {
      type: DataTypes.ENUM('facebook', 'google', 'instagram', 'linkedin', 'twitter', 'general'),
      defaultValue: 'general'
    },
    targetAudience: {
      type: DataTypes.STRING
    },
    callToAction: {
      type: DataTypes.STRING
    },
    industry: {
      type: DataTypes.STRING
    },
    overallScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        max: 100
      }
    },
    scores: {
      type: DataTypes.JSON,
      defaultValue: {
        headline: 0,
        description: 0,
        callToAction: 0,
        targeting: 0,
        engagement: 0
      }
    },
    feedback: {
      type: DataTypes.JSON,
      defaultValue: {
        strengths: [],
        improvements: [],
        suggestions: []
      }
    },
    recommendations: {
      type: DataTypes.JSON,
      defaultValue: {
        headline: [],
        description: [],
        callToAction: [],
        targeting: []
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['adType'] },
      { fields: ['overallScore'] }
    ]
  });

  return AdGrade;
};