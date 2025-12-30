/**
 * Central configuration module
 * Loads environment variables and exports app-wide configuration
 */

require('dotenv').config();

const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Supabase configuration
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },

  // Project directories
  paths: {
    projectsDir: process.env.PROJECTS_DIR || '/var/www/projects',
    portMapFile: process.env.PORT_MAP_FILE || '/var/www/port-map.json',
    uploadsDir: process.env.UPLOADS_DIR || 'uploads/',
  },

  // Port allocation
  ports: {
    basePort: parseInt(process.env.BASE_PORT || '4000', 10),
  },

  // Build configuration
  build: {
    memoryLimit: process.env.BUILD_MEMORY_LIMIT || '512m',
    cpuLimit: process.env.BUILD_CPU_LIMIT || '0.5',
    timeout: parseInt(process.env.BUILD_TIMEOUT || '1200000', 10), // 20 minutes
    maxConcurrentBuilds: parseInt(process.env.MAX_CONCURRENT_BUILDS || '1', 10),
    nodeModulesMaxAge: parseInt(process.env.NODE_MODULES_MAX_AGE || '7', 10),
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '3600000', 10),
    stepTimeout: {
      build: parseInt(process.env.BUILD_STEP_TIMEOUT || '1200000', 10),
      test: parseInt(process.env.TEST_STEP_TIMEOUT || '300000', 10),
      default: parseInt(process.env.DEFAULT_STEP_TIMEOUT || '300000', 10),
    },
    skipTests: process.env.SKIP_TESTS === 'true',
  },

  // Docker configuration
  docker: {
    buildMemory: process.env.DOCKER_BUILD_MEMORY || '512m',
    buildCpus: process.env.DOCKER_BUILD_CPUS || '0.5',
  },

  // Pipeline configuration
  pipeline: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_PIPELINES || '1', 10),
    statusRetentionHours: parseInt(process.env.STATUS_RETENTION_HOURS || '24', 10),
  },

  // Deployment state
  deployment: {
    pendingTimeout: parseInt(process.env.DEPLOYMENT_PENDING_TIMEOUT || '1800000', 10), // 30 minutes
  },

  // Domain configuration
  domain: {
    base: process.env.BASE_DOMAIN || 'zyphron.space',
  },
};

// Validate required configuration
function validateConfig() {
  const required = [
    { key: 'supabase.url', value: config.supabase.url },
    { key: 'supabase.serviceKey', value: config.supabase.serviceKey },
  ];

  const missing = required.filter(item => !item.value);

  if (missing.length > 0) {
    console.warn('Warning: Missing required configuration:');
    missing.forEach(item => console.warn(`  - ${item.key}`));
  }
}

validateConfig();

module.exports = config;
