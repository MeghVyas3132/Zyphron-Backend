/**
 * State service exports
 */

const {
  storePendingDeployment,
  getPendingDeployment,
  removePendingDeployment,
  updateDeploymentStatus,
  getAllPendingDeployments,
  cleanupExpiredDeployments,
} = require('./pending');

module.exports = {
  storePendingDeployment,
  getPendingDeployment,
  removePendingDeployment,
  updateDeploymentStatus,
  getAllPendingDeployments,
  cleanupExpiredDeployments,
};
