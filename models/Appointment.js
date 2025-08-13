module.exports = (sequelize, DataTypes) => {
  const Appointment = sequelize.define('Appointment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'),
      defaultValue: 'scheduled'
    },
    type: {
      type: DataTypes.ENUM('call', 'meeting', 'demo', 'consultation', 'other'),
      defaultValue: 'meeting'
    },
    location: {
      type: DataTypes.STRING
    },
    meetingUrl: {
      type: DataTypes.STRING
    },
    notes: {
      type: DataTypes.TEXT
    },
    reminderSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: false
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
      { fields: ['status'] },
      { fields: ['startTime'] }
    ]
  });

  return Appointment;
};