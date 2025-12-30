/**
 * Database integration configurations
 * Defines detection patterns and required environment variables for various databases
 */

const dbConfigurations = {
  supabase: {
    dependencies: ['@supabase/supabase-js'],
    importPatterns: ['createClient', 'supabase'],
    required: [
      { name: 'SUPABASE_URL', description: 'Supabase Project URL' },
      { name: 'SUPABASE_ANON_KEY', description: 'Supabase Anonymous/Public Key' },
      { name: 'SUPABASE_SERVICE_KEY', description: 'Supabase Service Key (optional)', optional: true },
    ],
  },
  mongodb: {
    dependencies: ['mongodb', 'mongoose'],
    importPatterns: ['mongoose', 'MongoClient'],
    required: [
      { name: 'MONGODB_URI', description: 'MongoDB Connection URI' },
    ],
  },
  postgres: {
    dependencies: ['pg', 'typeorm', 'sequelize', 'prisma', '@prisma/client'],
    importPatterns: ['Pool', 'Client', 'sequelize', 'PrismaClient'],
    required: [
      { name: 'DATABASE_URL', description: 'PostgreSQL Connection String' },
    ],
  },
  mysql: {
    dependencies: ['mysql', 'mysql2', 'typeorm', 'sequelize'],
    importPatterns: ['mysql', 'createConnection', 'createPool'],
    required: [
      { name: 'MYSQL_URL', description: 'MySQL Connection String' },
      { name: 'MYSQL_HOST', description: 'MySQL Host', optional: true },
      { name: 'MYSQL_USER', description: 'MySQL User', optional: true },
      { name: 'MYSQL_PASSWORD', description: 'MySQL Password', optional: true },
      { name: 'MYSQL_DATABASE', description: 'MySQL Database Name', optional: true },
    ],
  },
  redis: {
    dependencies: ['redis', 'ioredis'],
    importPatterns: ['redis', 'Redis', 'createClient'],
    required: [
      { name: 'REDIS_URL', description: 'Redis Connection URL' },
    ],
  },
  firebase: {
    dependencies: ['firebase', 'firebase-admin'],
    importPatterns: ['initializeApp', 'firestore', 'firebase'],
    required: [
      { name: 'FIREBASE_PROJECT_ID', description: 'Firebase Project ID' },
      { name: 'FIREBASE_CLIENT_EMAIL', description: 'Firebase Client Email', optional: true },
      { name: 'FIREBASE_PRIVATE_KEY', description: 'Firebase Private Key', optional: true },
    ],
  },
};

module.exports = { dbConfigurations };
