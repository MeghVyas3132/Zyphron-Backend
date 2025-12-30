// ===========================================
// ZYPHRON WORKER ENTRY POINT
// ===========================================

import { createLogger } from './lib/logger.js';
import { config } from './config/index.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';
import { createConsumer, disconnectKafka, TOPICS } from './lib/kafka.js';
import { prisma } from './lib/prisma.js';
import { Consumer } from 'kafkajs';

const logger = createLogger('worker');

// Store consumers for cleanup
const consumers: Consumer[] = [];

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
  const { deploymentId, buildId, projectId } = event;

  logger.info({ deploymentId, buildId, projectId }, 'Starting deployment build');

  // Update deployment status to BUILDING
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status: 'BUILDING' },
  });

  // Update build status to BUILDING
  if (buildId) {
    await prisma.build.update({
      where: { id: buildId },
      data: {
        status: 'BUILDING',
        startedAt: new Date(),
      },
    });
  }

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

  // TODO: Implement actual build logic
  // 1. Clone repository
  // 2. Detect language/framework
  // 3. Build Docker image
  // 4. Push to registry
  // 5. Deploy container

  logger.info({ deploymentId, projectId }, 'Build started (placeholder)');

  // Simulate build process for now
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Update build status to SUCCESS (placeholder)
  if (buildId) {
    await prisma.build.update({
      where: { id: buildId },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        duration: 5000,
        imageUrl: `registry.local/${project.slug}:${event.commitSha || 'latest'}`,
      },
    });
  }

  // Update deployment status to DEPLOYING
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status: 'DEPLOYING' },
  });

  // Simulate deploy process
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Update deployment status to READY
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: {
      status: 'READY',
      finishedAt: new Date(),
    },
  });

  logger.info({ deploymentId, projectId }, 'Deployment completed successfully (placeholder)');
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
