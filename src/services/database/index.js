/**
 * Database service exports
 */

const { findSourceFiles, detectDatabaseIntegration, getRequiredEnvVars } = require('./detection');
const { setupDatabaseEnv, readEnvFile, mergeEnvVars } = require('./setup');

module.exports = {
  findSourceFiles,
  detectDatabaseIntegration,
  getRequiredEnvVars,
  setupDatabaseEnv,
  readEnvFile,
  mergeEnvVars,
};
