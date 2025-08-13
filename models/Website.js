module.exports = (sequelize, DataTypes) => {
  const Website = sequelize.define('Website', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    domain: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    subdomain: {
      type: DataTypes.STRING
    },
    template: {
      type: DataTypes.STRING,
      defaultValue: 'default'
    },
    theme: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    pages: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    seoSettings: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    analytics: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    publishedAt: {
      type: DataTypes.DATE
    },
    customCode: {
      type: DataTypes.TEXT
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['domain'], unique: true },
      { fields: ['isPublished'] }
    ]
  });

  return Website;
};