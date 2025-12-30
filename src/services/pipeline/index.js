/**
 * Pipeline service exports
 */

const { runPipeline, runPipelineQueued, loadPipelineConfig, createDefaultPipeline } = require('./runner');
const { 
  initializeStatus, 
  updateStatus, 
  getStatus, 
  getAllStatuses, 
  clearStatus, 
  cleanupOldStatuses, 
  writeStepLog, 
  readLogs 
} = require('./status');
const { queue, queuePipeline, getPipelineQueueStatus } = require('./queue');
const config = require('../../config');

module.exports = {
  // Pipeline runner
  runPipeline,
  runPipelineQueued,
  loadPipelineConfig,
  createDefaultPipeline,

  // Status management
  getPipelineStatus: getStatus,
  getAllPipelineStatuses: getAllStatuses,
  clearPipelineStatus: clearStatus,
  cleanupOldStatuses,
  getPipelineLogs: readLogs,

  // Queue management
  getQueueStatus: () => queue.getQueueStatus(),
  getQueuePosition: (projectName) => queue.getQueuePosition(projectName),
  getPipelineQueueStatus,

  // Configuration (read-only)
  config: Object.freeze({ ...config.build }),
};
