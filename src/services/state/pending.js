/**
 * Pending deployment state management
 */

const crypto = require('crypto');
const config = require('../../config');

// In-memory store for pending deployments
const pendingDeployments = new Map();

// Cleanup timeout (default 30 minutes)
const DEPLOYMENT_TIMEOUT = config.deployment.pendingTimeout;

/**
 * Generate a unique deployment ID
 * @returns {string} - Deployment ID
 */
function generateDeploymentId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Store a pending deployment
 * @param {Object} deployment - Deployment data
 * @returns {string} - Deployment ID
 */
function storePendingDeployment(deployment) {
  const deploymentId = generateDeploymentId();

  pendingDeployments.set(deploymentId, {
    ...deployment,
    timestamp: Date.now(),
    status: 'pending',
  });

  // Set auto-cleanup timeout
  setTimeout(() => {
    if (pendingDeployments.has(deploymentId)) {
      console.log(`Cleaning up expired deployment: ${deploymentId}`);
      pendingDeployments.delete(deploymentId);
    }
  }, DEPLOYMENT_TIMEOUT);

  console.log(`Stored pending deployment: ${deploymentId} for project: ${deployment.projectName}`);

  return deploymentId;
}

/**
 * Get a pending deployment
 * @param {string} deploymentId - Deployment ID
 * @returns {Object|null} - Deployment data or null
 */
function getPendingDeployment(deploymentId) {
  const deployment = pendingDeployments.get(deploymentId);

  if (!deployment) {
    console.log(`Deployment not found: ${deploymentId}`);
    return null;
  }

  // Check if expired
  if (Date.now() - deployment.timestamp > DEPLOYMENT_TIMEOUT) {
    console.log(`Deployment expired: ${deploymentId}`);
    pendingDeployments.delete(deploymentId);
    return null;
  }

  console.log(`Retrieved pending deployment: ${deploymentId}`);
  return deployment;
}

/**
 * Remove a pending deployment
 * @param {string} deploymentId - Deployment ID
 * @returns {boolean} - Whether deployment was removed
 */
function removePendingDeployment(deploymentId) {
  const existed = pendingDeployments.has(deploymentId);
  pendingDeployments.delete(deploymentId);

  if (existed) {
    console.log(`Removed pending deployment: ${deploymentId}`);
  }

  return existed;
}

/**
 * Update deployment status
 * @param {string} deploymentId - Deployment ID
 * @param {string} status - New status
 * @returns {boolean} - Whether update was successful
 */
function updateDeploymentStatus(deploymentId, status) {
  const deployment = pendingDeployments.get(deploymentId);

  if (!deployment) {
    return false;
  }

  deployment.status = status;
  pendingDeployments.set(deploymentId, deployment);

  return true;
}

/**
 * Get all pending deployments
 * @returns {Object[]} - Array of pending deployments
 */
function getAllPendingDeployments() {
  const deployments = [];

  for (const [id, deployment] of pendingDeployments) {
    // Skip expired
    if (Date.now() - deployment.timestamp > DEPLOYMENT_TIMEOUT) {
      pendingDeployments.delete(id);
      continue;
    }

    deployments.push({
      id,
      ...deployment,
    });
  }

  return deployments;
}

/**
 * Cleanup expired deployments
 * @returns {number} - Number of cleaned deployments
 */
function cleanupExpiredDeployments() {
  let cleaned = 0;

  for (const [id, deployment] of pendingDeployments) {
    if (Date.now() - deployment.timestamp > DEPLOYMENT_TIMEOUT) {
      pendingDeployments.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired deployments`);
  }

  return cleaned;
}

module.exports = {
  storePendingDeployment,
  getPendingDeployment,
  removePendingDeployment,
  updateDeploymentStatus,
  getAllPendingDeployments,
  cleanupExpiredDeployments,
};
