module.exports = (sequelize, DataTypes) => {
  const Keyword = sequelize.define('Keyword', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    keyword: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    category: {
      type: DataTypes.ENUM('primary', 'secondary', 'long-tail', 'branded', 'competitor'),
      defaultValue: 'primary'
    },
    searchVolume: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    difficulty: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium'
    },
    cpc: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    intent: {
      type: DataTypes.ENUM('informational', 'navigational', 'transactional', 'commercial'),
      defaultValue: 'informational'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notes: {
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
      { fields: ['keyword'] },
      { fields: ['category'] },
      { fields: ['isActive'] },
      { unique: true, fields: ['keyword', 'userId'] }
    ]
  });

  return Keyword;
};