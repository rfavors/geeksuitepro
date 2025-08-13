module.exports = (sequelize, DataTypes) => {
  const Funnel = sequelize.define('Funnel', {
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
    status: {
      type: DataTypes.ENUM('draft', 'active', 'paused', 'archived'),
      defaultValue: 'draft'
    },
    steps: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    stats: {
      type: DataTypes.JSON,
      defaultValue: {
        visitors: 0,
        conversions: 0,
        conversionRate: 0
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
      { fields: ['status'] }
    ]
  });

  return Funnel;
};