module.exports = (sequelize, DataTypes) => {
  const Automation = sequelize.define('Automation', {
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
    trigger: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    actions: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    conditions: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'draft'),
      defaultValue: 'draft'
    },
    stats: {
      type: DataTypes.JSON,
      defaultValue: {
        triggered: 0,
        completed: 0,
        failed: 0
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

  return Automation;
};