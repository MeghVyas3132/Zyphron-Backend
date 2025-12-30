// ===========================================
// ZYPHRON FASTIFY APPLICATION
// ===========================================

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { config } from '@/config/index.js';
import { logger } from '@/lib/logger.js';
import { getRedisClient } from '@/lib/redis.js';

// Routes
import { healthRoutes } from '@/routes/health.js';
import { authRoutes } from '@/routes/auth.js';
import { projectRoutes } from '@/routes/projects.js';
import { deploymentRoutes } from '@/routes/deployments.js';
import { envRoutes } from '@/routes/env.js';
import { databaseRoutes } from '@/routes/databases.js';
import { webhookRoutes } from '@/routes/webhooks.js';
import { metricsRoutes } from '@/routes/metrics.js';

// ===========================================
// CREATE APPLICATION
// ===========================================

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.env === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      } : undefined,
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
  });

  // ===========================================
  // REGISTER PLUGINS
  // ===========================================

  // CORS
  await app.register(cors, {
    origin: config.env === 'production' 
      ? [`https://${config.deployment.baseDomain}`, `https://app.${config.deployment.baseDomain}`]
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: config.env === 'production',
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 hour',
    redis: getRedisClient(),
    keyGenerator: (req: FastifyRequest) => {
      return req.headers['x-forwarded-for']?.toString() || req.ip;
    },
  });

  // JWT authentication
  await app.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });

  // File uploads
  await app.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB
      files: 1,
    },
  });

  // WebSocket support
  await app.register(websocket);

  // API Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Zyphron API',
        description: 'Next-Generation Universal Deployment Platform API',
        version: '1.0.0',
      },
      servers: [
        {
          url: config.env === 'production' 
            ? `https://api.${config.deployment.baseDomain}`
            : `http://localhost:${config.port}`,
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // ===========================================
  // AUTHENTICATION DECORATOR
  // ===========================================

  app.decorate('authenticate', async function (
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      });
    }
  });

  // ===========================================
  // GLOBAL HOOKS
  // ===========================================

  // Request logging
  app.addHook('onRequest', async (request) => {
    request.log.info({
      url: request.url,
      method: request.method,
      headers: {
        'user-agent': request.headers['user-agent'],
        'x-forwarded-for': request.headers['x-forwarded-for'],
      },
    }, 'Incoming request');
  });

  // Response logging
  app.addHook('onResponse', async (request, reply) => {
    request.log.info({
      url: request.url,
      method: request.method,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, 'Request completed');
  });

  // Error handler
  app.setErrorHandler(async (error, request, reply) => {
    request.log.error({ err: error }, 'Request error');

    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: config.env === 'production' && statusCode === 500
          ? 'An unexpected error occurred'
          : error.message,
        ...(config.env === 'development' && { stack: error.stack }),
      },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    };

    reply.status(statusCode).send(response);
  });

  // Not found handler
  app.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  // ===========================================
  // REGISTER ROUTES
  // ===========================================

  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(projectRoutes, { prefix: '/api/v1/projects' });
  await app.register(deploymentRoutes, { prefix: '/api/v1/deployments' });
  await app.register(envRoutes, { prefix: '/api/v1/projects' });
  await app.register(databaseRoutes, { prefix: '/api/v1/databases' });
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await app.register(metricsRoutes, { prefix: '/metrics' });

  return app;
}

// ===========================================
// TYPE AUGMENTATION
// ===========================================

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
