// ===========================================
// ZYPHRON API SERVER ENTRY POINT
// ===========================================

import { createApp } from './app.js';
import { config } from './config/index.js';
import { createLogger } from './lib/logger.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';
import { getProducer, disconnectKafka } from './lib/kafka.js';
import { prisma } from './lib/prisma.js';

const logger = createLogger('server');

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
    }, 'Starting Zyphron API server');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Connect to Kafka
    await getProducer();
    logger.info('Kafka producer connected');

    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connected');

    // Build and start Fastify
    const app = await createApp();

    await app.listen({
      host: config.host,
      port: config.port,
    });

    logger.info({
      host: config.host,
      port: config.port,
      url: `http://${config.host}:${config.port}`,
    }, 'Zyphron API server started');

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Run the server
main();
