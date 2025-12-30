/**
 * Utility module exports
 */

const { runCmd, runCmdCallback, runCmdSilent, execAsync } = require('./command');
const { loadPortMap, savePortMap, allocatePort, releasePort, getPort, getAllPorts, isPortInUse } = require('./port');
const {
  sanitizeProjectName,
  validateRepoUrl,
  validateEmail,
  validatePassword,
  validateProjectName,
  isEmpty,
  validateEnvVar,
} = require('./validation');

module.exports = {
  // Command utilities
  runCmd,
  runCmdCallback,
  runCmdSilent,
  execAsync,

  // Port utilities
  loadPortMap,
  savePortMap,
  allocatePort,
  releasePort,
  getPort,
  getAllPorts,
  isPortInUse,

  // Validation utilities
  sanitizeProjectName,
  validateRepoUrl,
  validateEmail,
  validatePassword,
  validateProjectName,
  isEmpty,
  validateEnvVar,
};
