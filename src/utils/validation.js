/**
 * Input validation utilities
 */

/**
 * Sanitize project name - remove invalid characters
 * @param {string} name - Project name to sanitize
 * @returns {string} - Sanitized project name
 */
function sanitizeProjectName(name) {
  return name.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
}

/**
 * Validate repository URL
 * Only allows GitHub, GitLab, and Bitbucket URLs
 * @param {string} url - Repository URL to validate
 * @returns {boolean} - Whether URL is valid
 */
function validateRepoUrl(url) {
  const validPatterns = [
    /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/,
    /^https:\/\/gitlab\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/,
    /^https:\/\/bitbucket\.org\/[\w-]+\/[\w.-]+(?:\.git)?$/,
  ];
  return validPatterns.some(pattern => pattern.test(url));
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result with valid flag and message
 */
function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  return { valid: true, message: 'Password is valid' };
}

/**
 * Validate project name
 * @param {string} name - Project name to validate
 * @returns {Object} - Validation result
 */
function validateProjectName(name) {
  if (!name || name.length < 2) {
    return { valid: false, message: 'Project name must be at least 2 characters long' };
  }

  if (name.length > 50) {
    return { valid: false, message: 'Project name must be less than 50 characters' };
  }

  const sanitized = sanitizeProjectName(name);
  if (sanitized !== name.toLowerCase()) {
    return { valid: false, message: 'Project name contains invalid characters. Only alphanumeric, hyphens, and underscores allowed.' };
  }

  return { valid: true, message: 'Project name is valid', sanitized };
}

/**
 * Check if a string is empty or whitespace only
 * @param {string} str - String to check
 * @returns {boolean} - Whether string is empty
 */
function isEmpty(str) {
  return !str || str.trim().length === 0;
}

/**
 * Validate environment variable format
 * @param {string} key - Environment variable key
 * @param {string} value - Environment variable value
 * @returns {Object} - Validation result
 */
function validateEnvVar(key, value) {
  const keyRegex = /^[A-Z][A-Z0-9_]*$/;

  if (!keyRegex.test(key)) {
    return { valid: false, message: 'Environment variable key must be uppercase with underscores only' };
  }

  if (isEmpty(value)) {
    return { valid: false, message: 'Environment variable value cannot be empty' };
  }

  return { valid: true };
}

module.exports = {
  sanitizeProjectName,
  validateRepoUrl,
  validateEmail,
  validatePassword,
  validateProjectName,
  isEmpty,
  validateEnvVar,
};
