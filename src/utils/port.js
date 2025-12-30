/**
 * Port allocation utilities
 * Manages port assignments for deployed projects
 */

const fs = require('fs');
const config = require('../config');

// Port mapping state
let portMap = {};
let nextPort = config.ports.basePort + 1;

/**
 * Load port map from file
 */
function loadPortMap() {
  try {
    if (fs.existsSync(config.paths.portMapFile)) {
      const raw = fs.readFileSync(config.paths.portMapFile, 'utf8');
      portMap = JSON.parse(raw || '{}');
      const used = Object.values(portMap).map(Number);
      if (used.length) {
        nextPort = Math.max(...used) + 1;
      }
    } else {
      portMap = {};
      savePortMap();
    }
  } catch (e) {
    console.error('Failed to load port map:', e);
    portMap = {};
  }
}

/**
 * Save port map to file
 */
function savePortMap() {
  try {
    fs.writeFileSync(config.paths.portMapFile, JSON.stringify(portMap, null, 2));
  } catch (e) {
    console.error('Failed to save port map:', e);
  }
}

/**
 * Allocate a port for a project
 * @param {string} projectName - Name of the project
 * @returns {number} - Allocated port number
 */
function allocatePort(projectName) {
  if (portMap[projectName]) {
    return portMap[projectName];
  }

  let p = nextPort;
  while (Object.values(portMap).includes(p)) {
    p++;
  }

  portMap[projectName] = p;
  nextPort = p + 1;
  savePortMap();

  return p;
}

/**
 * Release a port allocation
 * @param {string} projectName - Name of the project
 * @returns {boolean} - Whether the port was released
 */
function releasePort(projectName) {
  if (portMap[projectName]) {
    delete portMap[projectName];
    savePortMap();
    return true;
  }
  return false;
}

/**
 * Get port for a project
 * @param {string} projectName - Name of the project
 * @returns {number|null} - Port number or null
 */
function getPort(projectName) {
  return portMap[projectName] || null;
}

/**
 * Get all port allocations
 * @returns {Object} - Port map
 */
function getAllPorts() {
  return { ...portMap };
}

/**
 * Check if a port is in use
 * @param {number} port - Port number
 * @returns {boolean} - Whether port is in use
 */
function isPortInUse(port) {
  return Object.values(portMap).includes(port);
}

// Initialize port map on module load
loadPortMap();

module.exports = {
  loadPortMap,
  savePortMap,
  allocatePort,
  releasePort,
  getPort,
  getAllPorts,
  isPortInUse,
};
