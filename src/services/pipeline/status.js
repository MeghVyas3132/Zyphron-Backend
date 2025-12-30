/**
 * Pipeline status tracking
 * Manages pipeline execution status and logs
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');

// In-memory status storage
let pipelineStatus = {};

/**
 * Initialize status for a pipeline
 * @param {string} projectName - Project name
 */
function initializeStatus(projectName) {
  pipelineStatus[projectName] = {
    projectName,
    currentStep: null,
    stepIndex: 0,
    totalSteps: 0,
    logs: {},
    done: false,
    success: false,
    error: null,
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null,
  };
}

/**
 * Update pipeline status
 * @param {string} projectName - Project name
 * @param {Object} updates - Status updates
 */
function updateStatus(projectName, updates) {
  if (!pipelineStatus[projectName]) {
    initializeStatus(projectName);
  }

  Object.assign(pipelineStatus[projectName], updates);

  // Calculate duration on completion
  if (updates.done && pipelineStatus[projectName].startTime) {
    const startTime = new Date(pipelineStatus[projectName].startTime);
    const endTime = new Date();
    pipelineStatus[projectName].endTime = endTime.toISOString();
    pipelineStatus[projectName].duration = Math.round((endTime - startTime) / 1000);
  }
}

/**
 * Get pipeline status
 * @param {string} projectName - Project name
 * @returns {Object} - Pipeline status
 */
function getStatus(projectName) {
  const status = pipelineStatus[projectName];

  if (!status) {
    return {
      error: 'Pipeline not found',
      projectName,
      found: false,
    };
  }

  return {
    ...status,
    found: true,
  };
}

/**
 * Get all pipeline statuses
 * @returns {Object} - All statuses
 */
function getAllStatuses() {
  return { ...pipelineStatus };
}

/**
 * Clear pipeline status
 * @param {string} projectName - Project name
 * @returns {boolean} - Whether status was cleared
 */
function clearStatus(projectName) {
  if (pipelineStatus[projectName]) {
    delete pipelineStatus[projectName];
    return true;
  }
  return false;
}

/**
 * Cleanup old statuses
 * Removes statuses older than retention period
 * @returns {string[]} - Cleaned project names
 */
function cleanupOldStatuses() {
  const retentionMs = config.pipeline.statusRetentionHours * 60 * 60 * 1000;
  const cutoffTime = Date.now() - retentionMs;
  const cleaned = [];

  for (const [projectName, status] of Object.entries(pipelineStatus)) {
    const statusTime = new Date(status.startTime).getTime();

    if (statusTime < cutoffTime) {
      delete pipelineStatus[projectName];
      cleaned.push(projectName);
    }
  }

  if (cleaned.length > 0) {
    console.log(`Cleaned up pipeline statuses for ${cleaned.length} projects: ${cleaned.join(', ')}`);
  }

  return cleaned;
}

/**
 * Write step log to file
 * @param {string} projectPath - Project directory path
 * @param {string} step - Step name
 * @param {string} content - Log content
 */
function writeStepLog(projectPath, step, content) {
  const logsDir = path.join(projectPath, 'logs');

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFile = path.join(logsDir, `${step}.log`);

  try {
    fs.writeFileSync(logFile, content);
    console.log(`Log written to: ${logFile}`);
  } catch (e) {
    console.warn(`Failed to write log for step ${step}:`, e.message);
  }
}

/**
 * Read pipeline logs from files
 * @param {string} projectPath - Project directory path
 * @returns {Object} - Logs by step name
 */
function readLogs(projectPath) {
  const logsDir = path.join(projectPath, 'logs');

  if (!fs.existsSync(logsDir)) {
    return { error: 'No logs directory found' };
  }

  const logs = {};
  const logFiles = ['preDeploy.log', 'build.log', 'test.log', 'postDeploy.log', 'summary.log', 'error.log'];

  for (const logFile of logFiles) {
    const logPath = path.join(logsDir, logFile);
    if (fs.existsSync(logPath)) {
      try {
        logs[logFile.replace('.log', '')] = fs.readFileSync(logPath, 'utf8');
      } catch (e) {
        logs[logFile.replace('.log', '')] = `Error reading log: ${e.message}`;
      }
    }
  }

  return logs;
}

module.exports = {
  initializeStatus,
  updateStatus,
  getStatus,
  getAllStatuses,
  clearStatus,
  cleanupOldStatuses,
  writeStepLog,
  readLogs,
};
