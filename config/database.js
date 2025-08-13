const { Sequelize } = require('sequelize');
const path = require('path');

// Database configuration
const config = {
  development: {
    storage: path.join(__dirname, '..', 'database.sqlite'),
    dialect: 'sqlite',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    storage: ':memory:',
    dialect: 'sqlite',
    logging: false
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize;
if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
} else {
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
}

// Test database connection
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    const dbType = process.env.NODE_ENV === 'production' ? 'PostgreSQL' : 'SQLite';
    console.log(`✅ ${dbType} connected successfully`);
    
    // Sync database in development only
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database synced successfully');
    } else if (process.env.NODE_ENV === 'production') {
      // In production, just ensure tables exist without altering
      await sequelize.sync({ force: false });
      console.log('✅ Production database tables verified');
    }
  } catch (error) {
    const dbType = process.env.NODE_ENV === 'production' ? 'PostgreSQL' : 'SQLite';
    console.error(`❌ Unable to connect to ${dbType}:`, error.message);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  connectDB,
  Sequelize
};