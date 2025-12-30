// ===========================================
// HEALTH CHECK ROUTES
// ===========================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { checkDatabaseHealth } from '@/lib/prisma.js';
import { checkRedisHealth } from '@/lib/redis.js';
import { checkKafkaHealth } from '@/lib/kafka.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: boolean;
    redis: boolean;
    kafka: boolean;
  };
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Basic health check
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe (for Kubernetes)
  app.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    const [dbHealthy, redisHealthy, kafkaHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkKafkaHealth(),
    ]);

    const allHealthy = dbHealthy && redisHealthy && kafkaHealthy;

    const health: HealthStatus = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: dbHealthy,
        redis: redisHealthy,
        kafka: kafkaHealthy,
      },
    };

    return reply.status(allHealthy ? 200 : 503).send(health);
  });

  // Liveness probe (for Kubernetes)
  app.get('/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  // Detailed health check
  app.get('/detailed', async (_request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    
    const [dbResult, redisResult, kafkaResult] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkKafkaHealth(),
    ]);

    const dbHealthy = dbResult.status === 'fulfilled' && dbResult.value;
    const redisHealthy = redisResult.status === 'fulfilled' && redisResult.value;
    const kafkaHealthy = kafkaResult.status === 'fulfilled' && kafkaResult.value;

    const allHealthy = dbHealthy && redisHealthy && kafkaHealthy;

    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          latency: dbResult.status === 'fulfilled' ? 'ok' : 'error',
        },
        redis: {
          status: redisHealthy ? 'healthy' : 'unhealthy',
          latency: redisResult.status === 'fulfilled' ? 'ok' : 'error',
        },
        kafka: {
          status: kafkaHealthy ? 'healthy' : 'unhealthy',
          latency: kafkaResult.status === 'fulfilled' ? 'ok' : 'error',
        },
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        rss: process.memoryUsage().rss,
      },
    });
  });
}
