/**
 * Database environment setup
 */

const fs = require('fs');
const path = require('path');

/**
 * Setup database environment variables for a project
 * @param {string} projectPath - Path to project
 * @param {Object} dbCredentials - Database credentials by service
 */
function setupDatabaseEnv(projectPath, dbCredentials) {
  // Handle credentials for frontend and backend separately
  const services = ['frontend', 'backend'];

  for (const service of services) {
    if (dbCredentials[service]) {
      const envPath = path.join(projectPath, service, '.env');
      const envDir = path.join(projectPath, service);

      // Create directory if it doesn't exist
      if (!fs.existsSync(envDir)) {
        fs.mkdirSync(envDir, { recursive: true });
      }

      // Generate env content
      const envContent = Object.entries(dbCredentials[service])
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      if (envContent) {
        fs.writeFileSync(envPath, envContent);
        console.log(`Created .env file for ${service}`);
      }
    }
  }

  // Also handle root-level credentials (for single-service projects)
  if (dbCredentials.root || (!dbCredentials.frontend && !dbCredentials.backend)) {
    const credentials = dbCredentials.root || dbCredentials;
    
    // Filter out 'frontend' and 'backend' keys
    const rootCredentials = Object.entries(credentials)
      .filter(([key]) => !['frontend', 'backend', 'root'].includes(key));

    if (rootCredentials.length > 0) {
      const envPath = path.join(projectPath, '.env');
      const envContent = rootCredentials
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      fs.writeFileSync(envPath, envContent);
      console.log('Created .env file at project root');
    }
  }
}

/**
 * Read environment file
 * @param {string} envPath - Path to .env file
 * @returns {Object} - Parsed environment variables
 */
function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};

    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    return env;
  } catch (e) {
    console.warn(`Failed to read env file ${envPath}:`, e.message);
    return {};
  }
}

/**
 * Merge environment variables into existing .env file
 * @param {string} envPath - Path to .env file
 * @param {Object} newVars - New variables to add
 */
function mergeEnvVars(envPath, newVars) {
  const existing = readEnvFile(envPath);
  const merged = { ...existing, ...newVars };

  const content = Object.entries(merged)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(envPath, content);
  console.log(`Updated .env file at ${envPath}`);
}

module.exports = {
  setupDatabaseEnv,
  readEnvFile,
  mergeEnvVars,
};
