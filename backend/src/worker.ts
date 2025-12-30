// ===========================================
// ZYPHRON WORKER ENTRY POINT
// ===========================================

import { createLogger } from './lib/logger.js';
import { config } from './config/index.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';
import { createConsumer, disconnectKafka, TOPICS } from './lib/kafka.js';
import { prisma } from './lib/prisma.js';
import { Consumer } from 'kafkajs';

// Import deployment services
import { detectProject } from './services/detector/index.js';
import { getGitService } from './services/git/index.js';
import { getBuilderService } from './services/builder/index.js';
import { getDeployerService } from './services/deployer/index.js';

const logger = createLogger('worker');

// Store consumers for cleanup
const consumers: Consumer[] = [];

// Initialize services
const gitService = getGitService('/tmp/zyphron/repos');
const builderService = getBuilderService(config.docker.registry || 'localhost:5000');
const deployerService = getDeployerService('zyphron-network', config.deployment.baseDomain || 'localhost');

// ===========================================
// DEPLOYMENT EVENT HANDLER
// ===========================================

interface DeploymentEvent {
  type: string;
  deploymentId: string;
  buildId?: string;
  projectId: string;
  userId?: string;
  environment?: string;
  branch?: string;
  commitSha?: string;
  timestamp: string;
}

async function handleDeploymentEvent(topic: string, message: unknown): Promise<void> {
  const event = message as DeploymentEvent;
  
  logger.info({
    topic,
    type: event.type,
    deploymentId: event.deploymentId,
    projectId: event.projectId,
  }, 'Processing deployment event');

  try {
    switch (event.type) {
      case 'DEPLOYMENT_CREATED':
        await handleDeploymentCreated(event);
        break;

      case 'DEPLOYMENT_CANCELLED':
        await handleDeploymentCancelled(event);
        break;

      case 'BUILD_COMPLETED':
        await handleBuildCompleted(event);
        break;

      default:
        logger.warn({ type: event.type }, 'Unknown deployment event type');
    }
  } catch (error) {
    logger.error({ error, event }, 'Error processing deployment event');
    
    // Update deployment status to failed
    if (event.deploymentId) {
      await prisma.deployment.update({
        where: { id: event.deploymentId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
        },
      });
    }
  }
}

async function handleDeploymentCreated(event: DeploymentEvent): Promise<void> {
  const { deploymentId, projectId } = event;

  logger.info({ deploymentId, projectId }, 'Starting deployment build');

  const startTime = Date.now();

  // Update deployment status to BUILDING
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { 
      status: 'BUILDING',
      startedAt: new Date(),
    },
  });

  // Get project details
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      envVariables: true,
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Prepare environment variables
  const envVars: Record<string, string> = {};
  for (const envVar of project.envVariables) {
    envVars[envVar.key] = envVar.value;
  }

  try {
    // =============================================
    // STEP 1: Clone Repository
    // =============================================
    logger.info({ deploymentId, repoUrl: project.repoUrl }, 'Cloning repository');

    const cloneResult = await gitService.cloneRepository(
      project.repoUrl,
      deploymentId,
      event.branch || project.defaultBranch || 'main',
      project.gitToken || undefined
    );

    if (!cloneResult.success) {
      throw new Error(`Failed to clone repository: ${cloneResult.error}`);
    }

    logger.info({
      deploymentId,
      commitHash: cloneResult.commitHash.substring(0, 7),
      branch: cloneResult.branch,
    }, 'Repository cloned successfully');

    // Update deployment with commit info
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        commitSha: cloneResult.commitHash,
        commitMessage: cloneResult.commitMessage,
        commitAuthor: cloneResult.author,
        branch: cloneResult.branch,
      },
    });

    // =============================================
    // STEP 2: Detect Project Framework
    // =============================================
    logger.info({ deploymentId }, 'Detecting project framework');

    const detection = await detectProject(cloneResult.path);

    logger.info({
      deploymentId,
      framework: detection.framework,
      language: detection.language,
      packageManager: detection.packageManager,
      confidence: detection.confidence,
    }, 'Project detected');

    // =============================================
    // STEP 3: Build Docker Image
    // =============================================
    logger.info({ deploymentId, framework: detection.framework }, 'Building Docker image');

    const buildLogs: string[] = [];
    const buildResult = await builderService.buildImage({
      projectPath: cloneResult.path,
      deploymentId,
      projectId,
      detection,
      envVars,
      onLog: (log) => {
        buildLogs.push(log);
        logger.debug({ deploymentId, log }, 'Build log');
      },
    });

    if (!buildResult.success) {
      // Update deployment with build logs before failing
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          buildLogs: buildLogs.join('\n'),
        },
      });
      throw new Error(`Build failed: ${buildResult.error}`);
    }

    logger.info({
      deploymentId,
      imageId: buildResult.imageId,
      duration: buildResult.duration,
    }, 'Docker image built successfully');

    // Update deployment with build info
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        imageTag: `${buildResult.imageName}:${buildResult.imageTag}`,
        buildLogs: buildResult.buildLogs.join('\n'),
        buildDuration: Math.round(buildResult.duration / 1000),
      },
    });

    // =============================================
    // STEP 4: Push Image to Registry
    // =============================================
    logger.info({ deploymentId }, 'Pushing image to registry');

    const pushResult = await builderService.pushImage(
      buildResult.imageName,
      buildResult.imageTag
    );

    if (!pushResult.success) {
      logger.warn({ deploymentId, error: pushResult.error }, 'Failed to push image, continuing with local image');
    }

    // =============================================
    // STEP 5: Deploy Container
    // =============================================
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'DEPLOYING' },
    });

    logger.info({ deploymentId }, 'Deploying container');

    const deployStartTime = Date.now();
    const deployResult = await deployerService.deploy({
      deploymentId,
      projectId,
      projectSlug: project.slug,
      imageName: buildResult.imageName,
      imageTag: buildResult.imageTag,
      envVars,
      port: detection.port,
      detection,
      healthCheck: {
        path: '/health',
        interval: 30,
        timeout: 10,
        retries: 3,
        startPeriod: 60,
      },
    });
    const deployDuration = Math.round((Date.now() - deployStartTime) / 1000);

    if (!deployResult.success) {
      throw new Error(`Deployment failed: ${deployResult.error}`);
    }

    logger.info({
      deploymentId,
      containerId: deployResult.containerId,
      internalUrl: deployResult.internalUrl,
      externalUrl: deployResult.externalUrl,
    }, 'Container deployed successfully');

    // =============================================
    // STEP 6: Cleanup and Finalize
    // =============================================

    // Cleanup cloned repository
    await gitService.cleanup(deploymentId);

    // Cleanup old deployments for this project (keep last 3)
    await deployerService.cleanupOldDeployments(projectId, 3);

    // Update deployment to LIVE
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'LIVE',
        completedAt: new Date(),
        deployDuration,
        metadata: {
          containerId: deployResult.containerId,
          containerName: deployResult.containerName,
          internalUrl: deployResult.internalUrl,
          externalUrl: deployResult.externalUrl,
          port: deployResult.port,
          framework: detection.framework,
          language: detection.language,
        },
      },
    });

    const totalDuration = Date.now() - startTime;
    logger.info({
      deploymentId,
      projectId,
      duration: totalDuration,
      url: deployResult.externalUrl,
    }, 'Deployment completed successfully');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error({
      deploymentId,
      projectId,
      error: errorMessage,
    }, 'Deployment failed');

    // Update deployment status to FAILED
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage,
      },
    });

    // Cleanup cloned repository on failure
    await gitService.cleanup(deploymentId);

    throw error; // Re-throw to be handled by parent
  }
}

async function handleDeploymentCancelled(event: DeploymentEvent): Promise<void> {
  const { deploymentId } = event;

  logger.info({ deploymentId }, 'Processing deployment cancellation');

  // TODO: Implement actual cancellation logic
  // 1. Stop running build process
  // 2. Clean up any partial resources

  logger.info({ deploymentId }, 'Deployment cancellation processed');
}

async function handleBuildCompleted(event: DeploymentEvent): Promise<void> {
  const { deploymentId, buildId } = event;

  logger.info({ deploymentId, buildId }, 'Processing build completion');

  // TODO: Implement post-build logic
  // 1. Start container deployment
  // 2. Update DNS/routing
  // 3. Health checks

  logger.info({ deploymentId, buildId }, 'Build completion processed');
}

// ===========================================
// BUILD LOG HANDLER
// ===========================================

interface BuildLogMessage {
  deploymentId: string;
  line: string;
  stream: 'stdout' | 'stderr';
  timestamp: string;
}

async function handleBuildLog(topic: string, message: unknown): Promise<void> {
  const log = message as BuildLogMessage;
  
  // Store log in Redis for real-time streaming
  // This is handled elsewhere, but could be processed here too
  
  logger.debug({
    topic,
    deploymentId: log.deploymentId,
    stream: log.stream,
  }, 'Build log received');
}

// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);

  try {
    // Disconnect consumers
    for (const consumer of consumers) {
      await consumer.disconnect();
    }
    logger.info('Kafka consumers disconnected');

    // Disconnect from databases
    await prisma.$disconnect();
    logger.info('Prisma disconnected');

    // Disconnect from Redis
    await disconnectRedis();
    logger.info('Redis disconnected');

    // Disconnect from Kafka
    await disconnectKafka();
    logger.info('Kafka disconnected');

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// ===========================================
// MAIN
// ===========================================

async function main(): Promise<void> {
  try {
    logger.info({
      env: config.env,
      nodeEnv: process.env.NODE_ENV,
    }, 'Starting Zyphron Worker');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connected');

    // Create deployment events consumer
    const deploymentConsumer = await createConsumer(
      'zyphron-deployment-workers',
      [TOPICS.DEPLOYMENTS],
      handleDeploymentEvent
    );
    consumers.push(deploymentConsumer);
    logger.info('Deployment events consumer started');

    // Create build logs consumer
    const buildLogsConsumer = await createConsumer(
      'zyphron-build-log-workers',
      [TOPICS.BUILD_LOGS],
      handleBuildLog
    );
    consumers.push(buildLogsConsumer);
    logger.info('Build logs consumer started');

    logger.info('Zyphron Worker started and listening for events');

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.fatal({ error }, 'Failed to start worker');
    process.exit(1);
  }
}

// Run the worker
main();
