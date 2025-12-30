/**
 * Database integration detection
 */

const fs = require('fs');
const path = require('path');
const { dbConfigurations } = require('../../config/database');

/**
 * Recursively find source files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} - Array of file paths
 */
function findSourceFiles(dir) {
  const sourceFiles = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      // Skip node_modules and .git
      if (item === 'node_modules' || item === '.git') continue;

      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        sourceFiles.push(...findSourceFiles(fullPath));
      } else if (item.match(/\.(js|ts|jsx|tsx)$/)) {
        sourceFiles.push(fullPath);
      }
    }
  } catch (e) {
    console.warn(`Error scanning directory ${dir}:`, e.message);
  }

  return sourceFiles;
}

/**
 * Detect database integrations in a project
 * @param {string} projectPath - Path to project
 * @returns {Object[]|null} - Detected database integrations or null
 */
function detectDatabaseIntegration(projectPath) {
  try {
    const detectedDbs = [];
    const packageJsonPath = path.join(projectPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Get source files for pattern matching
      const sourceFiles = findSourceFiles(projectPath);

      for (const [dbType, dbConfig] of Object.entries(dbConfigurations)) {
        // Check if any dependency matches
        const hasDependency = dbConfig.dependencies.some(dep => allDeps[dep]);

        // Check source code for import patterns
        let hasImport = false;
        if (hasDependency) {
          for (const file of sourceFiles) {
            try {
              const content = fs.readFileSync(file, 'utf8');
              if (dbConfig.importPatterns.some(pattern => content.includes(pattern))) {
                hasImport = true;
                break;
              }
            } catch (e) {
              // Skip files that can't be read
            }
          }
        }

        if (hasDependency && hasImport) {
          detectedDbs.push({
            type: dbType,
            required: dbConfig.required,
          });
        }
      }
    }

    return detectedDbs.length > 0 ? detectedDbs : null;
  } catch (error) {
    console.warn('Database detection error:', error);
    return null;
  }
}

/**
 * Get required environment variables for a database type
 * @param {string} dbType - Database type (supabase, mongodb, etc.)
 * @returns {Object[]|null} - Required environment variables
 */
function getRequiredEnvVars(dbType) {
  const config = dbConfigurations[dbType];
  return config ? config.required : null;
}

module.exports = {
  findSourceFiles,
  detectDatabaseIntegration,
  getRequiredEnvVars,
};
