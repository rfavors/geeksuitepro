module.exports = (sequelize, DataTypes) => {
  const Pipeline = sequelize.define('Pipeline', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    stages: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    color: {
      type: DataTypes.STRING,
      defaultValue: '#007bff'
    },
    stats: {
      type: DataTypes.JSON,
      defaultValue: {
        totalContacts: 0,
        conversionRate: 0,
        averageTimeInPipeline: 0
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
      { fields: ['isDefault'] },
      { fields: ['isActive'] }
    ]
  });

  return Pipeline;
};