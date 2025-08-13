module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING
    },
    company: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.ENUM('lead', 'prospect', 'customer', 'inactive'),
      defaultValue: 'lead'
    },
    stage: {
      type: DataTypes.STRING,
      defaultValue: 'new'
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    customFields: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    notes: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    activities: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    pipelineId: {
      type: DataTypes.INTEGER
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['email'] },
      { fields: ['userId'] },
      { fields: ['status'] }
    ]
  });

  return Contact;
};