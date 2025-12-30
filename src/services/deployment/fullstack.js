/**
 * Full-stack deployment utilities
 */

const path = require('path');
const { runPipelineQueued } = require('../pipeline');
const { deployMicroservice, deployDatabaseService, cleanupContainer } = require('./docker');
const { setupNginx } = require('./nginx');
const { detectDatabaseIntegration, setupDatabaseEnv } = require('../database');
const { storePendingDeployment } = require('../state');
const { supabase } = require('../../middleware/auth');
const config = require('../../config');

/**
 * Deploy a full-stack application
 * @param {string} projectName - Project name
 * @param {string} projectPath - Project path
 * @param {Object} detection - Full-stack detection result
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deployFullStackApp(projectName, projectPath, detection, req, res) {
  console.log(`Deploying full stack app: ${projectName}`);

  const deployedServices = {};

  try {
    // Get paths for services
    const frontendPath = detection.serviceConfig.frontend
      ? path.join(projectPath, detection.serviceConfig.frontend.subdirectory)
      : null;
    const backendPath = detection.serviceConfig.backend
      ? path.join(projectPath, detection.serviceConfig.backend.subdirectory)
      : null;

    // Check for database integrations
    const frontendDbIntegration = frontendPath ? detectDatabaseIntegration(frontendPath) : null;
    const backendDbIntegration = backendPath ? detectDatabaseIntegration(backendPath) : null;

    // If DB integration detected but no credentials provided, request them
    if ((frontendDbIntegration || backendDbIntegration) && !req.body.dbCredentials) {
      const deploymentId = storePendingDeployment({
        projectName,
        projectPath,
        detection,
        type: 'database_config_needed',
      });

      return res.status(202).json({
        status: 'db_credentials_required',
        message: 'Database credentials required for full-stack deployment',
        projectName,
        dbIntegrations: [...(frontendDbIntegration || []), ...(backendDbIntegration || [])],
        deploymentId,
      });
    }

    // Setup database environment if credentials provided
    if (req.body.dbCredentials) {
      if (frontendPath) setupDatabaseEnv(frontendPath, req.body.dbCredentials);
      if (backendPath) setupDatabaseEnv(backendPath, req.body.dbCredentials);
    }

    // Deploy each service
    for (const serviceName of detection.services) {
      const serviceConfig = detection.serviceConfig[serviceName];
      console.log(`Deploying service: ${serviceName}`);

      if (serviceName === 'database') {
        const dbResult = await deployDatabaseService(projectName);
        deployedServices[serviceName] = dbResult;
      } else {
        // Run pipeline first
        await runPipelineQueued(`${projectName}-${serviceName}`, serviceConfig.path);

        // Deploy the microservice
        const serviceResult = await deployMicroservice(projectName, serviceName, serviceConfig);
        deployedServices[serviceName] = serviceResult;
      }
    }

    // Setup Nginx
    await setupNginx(projectName, 'fullstack', { deployedServices });

    console.log(`Full stack app deployed: ${projectName}`);

    // Save to database
    try {
      await supabase.from('projects').insert({
        user_id: req.user.id,
        name: projectName,
        repo_url: req.body.repoUrl || null,
        type: 'fullstack',
        status: 'running',
        subdomain: `${projectName}.${config.domain.base}`,
        port: deployedServices.backend ? deployedServices.backend.port : null,
      });
    } catch (dbError) {
      console.error('Failed to save project to database:', dbError);
    }

    return res.json({
      message: 'Full stack deployment successful',
      url: `http://${projectName}.${config.domain.base}`,
      name: projectName,
      type: 'fullstack',
      services: Object.keys(deployedServices),
      serviceUrls: deployedServices,
    });
  } catch (error) {
    console.error(`Full stack deployment failed:`, error);

    // Cleanup on failure
    for (const [serviceName, serviceInfo] of Object.entries(deployedServices)) {
      try {
        await cleanupContainer(serviceInfo.containerName, serviceInfo.imageName);
      } catch (e) {
        console.warn(`Failed to cleanup ${serviceName}:`, e.message);
      }
    }

    return res.status(500).json({
      error: 'Full stack deployment failed',
      details: error.message,
      partialDeployment: Object.keys(deployedServices),
    });
  }
}

module.exports = {
  deployFullStackApp,
};
