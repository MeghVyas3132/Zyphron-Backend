/**
 * Docker operations for deployment
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runCmd } = require('../../utils/command');
const { allocatePort } = require('../../utils/port');

/**
 * Build and run a Docker container for a service
 * @param {string} projectName - Project name
 * @param {string} serviceName - Service name (or empty for single service)
 * @param {Object} serviceConfig - Service configuration
 * @returns {Object} - Deployment result
 */
async function deployMicroservice(projectName, serviceName, serviceConfig) {
  const fullName = serviceName ? `${projectName}-${serviceName}` : projectName;
  const hostPort = allocatePort(fullName);
  const imageName = `${fullName}-image`;
  const containerName = `${fullName}-container`;

  console.log(`Building ${serviceName || 'main'} service on port ${hostPort}`);

  // Cleanup existing container and image
  try { await runCmd(`docker rm -f ${containerName} || true`); } catch (e) { /* ignore */ }
  try { await runCmd(`docker rmi -f ${imageName} || true`); } catch (e) { /* ignore */ }

  // Write Dockerfile if not exists
  const dockerfilePath = path.join(serviceConfig.path, 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    fs.writeFileSync(dockerfilePath, serviceConfig.detection.dockerfile);
    console.log('Created Dockerfile');
  }

  // Build image
  try {
    await runCmd(`docker build -t ${imageName} "${serviceConfig.path}"`, {
      maxBuffer: 1024 * 1024 * 20,
      timeout: 600000, // 10 minutes
    });
  } catch (e) {
    throw new Error(`${serviceName || 'Main'} build failed: ${e.stderr || e.message}`);
  }

  // Run container
  try {
    await runCmd(`docker run -d --name ${containerName} -p ${hostPort}:${serviceConfig.detection.internalPort} --restart unless-stopped ${imageName}`);
  } catch (e) {
    try { await runCmd(`docker rmi -f ${imageName} || true`); } catch (_) { /* ignore */ }
    throw new Error(`${serviceName || 'Main'} container start failed: ${e.stderr || e.message}`);
  }

  // Wait for container to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Health check
  try {
    const status = await runCmd(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`);
    if (!status.trim()) {
      const logs = await runCmd(`docker logs ${containerName}`).catch(() => 'No logs available');
      throw new Error(`${serviceName || 'Main'} container exited: ${logs}`);
    }
  } catch (e) {
    throw new Error(`${serviceName || 'Main'} health check failed: ${e.message}`);
  }

  return {
    serviceName: serviceName || 'main',
    containerName,
    imageName,
    port: hostPort,
    internalPort: serviceConfig.detection.internalPort,
    type: serviceConfig.detection.type,
    status: 'running',
  };
}

/**
 * Deploy a PostgreSQL database service
 * @param {string} projectName - Project name
 * @returns {Object} - Database deployment result
 */
async function deployDatabaseService(projectName) {
  const hostPort = allocatePort(`${projectName}-database`);
  const containerName = `${projectName}-database-container`;

  console.log(`Deploying database service on port ${hostPort}`);

  // Cleanup existing container
  try { await runCmd(`docker rm -f ${containerName} || true`); } catch (e) { /* ignore */ }

  // Generate secure password
  const dbPassword = crypto.randomBytes(16).toString('hex');

  // Run PostgreSQL container
  try {
    await runCmd(`docker run -d --name ${containerName} \
      -e POSTGRES_DB=${projectName}_db \
      -e POSTGRES_USER=${projectName}_user \
      -e POSTGRES_PASSWORD=${dbPassword} \
      -p ${hostPort}:5432 \
      --restart unless-stopped \
      postgres:15-alpine`);
  } catch (e) {
    throw new Error(`Database container start failed: ${e.stderr || e.message}`);
  }

  return {
    serviceName: 'database',
    containerName,
    port: hostPort,
    internalPort: 5432,
    type: 'postgresql',
    status: 'running',
    credentials: {
      host: 'localhost',
      port: hostPort,
      database: `${projectName}_db`,
      user: `${projectName}_user`,
      password: dbPassword,
    },
  };
}

/**
 * Remove a Docker container and its image
 * @param {string} containerName - Container name
 * @param {string} imageName - Image name (optional)
 */
async function cleanupContainer(containerName, imageName) {
  try { await runCmd(`docker rm -f ${containerName} || true`); } catch (e) { /* ignore */ }
  if (imageName) {
    try { await runCmd(`docker rmi -f ${imageName} || true`); } catch (e) { /* ignore */ }
  }
}

/**
 * Get container status
 * @param {string} containerName - Container name
 * @returns {string} - Container status
 */
async function getContainerStatus(containerName) {
  try {
    const output = await runCmd(`docker ps --filter "name=${containerName}" --format "{{.Names}} {{.Status}} {{.Ports}}"`);
    return output.trim() || 'stopped';
  } catch (e) {
    return 'stopped';
  }
}

/**
 * Get container logs
 * @param {string} containerName - Container name
 * @param {number} lines - Number of lines to retrieve
 * @returns {string} - Container logs
 */
async function getContainerLogs(containerName, lines = 100) {
  try {
    return await runCmd(`docker logs --tail ${lines} ${containerName}`);
  } catch (e) {
    return `Could not fetch container logs: ${e.message}`;
  }
}

module.exports = {
  deployMicroservice,
  deployDatabaseService,
  cleanupContainer,
  getContainerStatus,
  getContainerLogs,
};
