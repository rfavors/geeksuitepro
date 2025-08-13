module.exports = (sequelize, DataTypes) => {
  const Form = sequelize.define('Form', {
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
    type: {
      type: DataTypes.ENUM('contact', 'lead', 'survey', 'registration', 'feedback'),
      defaultValue: 'contact'
    },
    fields: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {
        submitButtonText: 'Submit',
        successMessage: 'Thank you for your submission!',
        redirectUrl: null,
        emailNotifications: true
      }
    },
    styling: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    submissions: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['type'] },
      { fields: ['isActive'] }
    ]
  });

  return Form;
};