// ===========================================
// DEPLOYMENT ROUTES
// ===========================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/lib/prisma.js';
import { createLogger } from '@/lib/logger.js';
import { redis, publishEvent } from '@/lib/redis.js';
import { producer } from '@/lib/kafka.js';

const logger = createLogger('deployments');

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const triggerDeploymentSchema = z.object({
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  environment: z.enum(['production', 'preview', 'staging']).default('production'),
  force: z.boolean().default(false),
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'BUILDING', 'DEPLOYING', 'READY', 'FAILED', 'CANCELLED']).optional(),
  environment: z.enum(['production', 'preview', 'staging']).optional(),
});

const cancelDeploymentSchema = z.object({
  reason: z.string().optional(),
});

// ===========================================
// ROUTES
// ===========================================

export async function deploymentRoutes(app: FastifyInstance): Promise<void> {
  // List deployments for a project
  app.get('/projects/:projectId/deployments', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { projectId } = request.params;
    const query = querySchema.parse(request.query);

    // Check project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId },
          { team: { members: { some: { userId } } } },
        ],
      },
    });

    if (!project) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or you do not have access',
        },
      });
    }

    const where = {
      projectId,
      ...(query.status && { status: query.status }),
      ...(query.environment && { environment: query.environment }),
    };

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          build: {
            select: {
              id: true,
              status: true,
              duration: true,
            },
          },
        },
      }),
      prisma.deployment.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: { deployments },
      meta: {
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
          hasNext: query.page * query.limit < total,
          hasPrev: query.page > 1,
        },
      },
    });
  });

  // Trigger new deployment
  app.post('/projects/:projectId/deployments', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { projectId } = request.params;
    
    const parseResult = triggerDeploymentSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parseResult.error.flatten(),
        },
      });
    }

    const data = parseResult.data;

    // Check project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId },
          { team: { members: { some: { userId, role: { in: ['OWNER', 'ADMIN', 'DEVELOPER'] } } } } },
        ],
      },
    });

    if (!project) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or you do not have permission to deploy',
        },
      });
    }

    // Check for existing deployment in progress
    if (!data.force) {
      const activeDeployment = await prisma.deployment.findFirst({
        where: {
          projectId,
          status: { in: ['PENDING', 'BUILDING', 'DEPLOYING'] },
        },
      });

      if (activeDeployment) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'DEPLOYMENT_IN_PROGRESS',
            message: 'A deployment is already in progress. Use force=true to override.',
            details: { activeDeploymentId: activeDeployment.id },
          },
        });
      }
    }

    // Create deployment record
    const deployment = await prisma.deployment.create({
      data: {
        projectId,
        userId,
        branch: data.branch || project.branch,
        commitSha: data.commitSha,
        environment: data.environment,
        status: 'PENDING',
        url: `https://${project.subdomain}-${data.environment === 'production' ? '' : data.environment + '-'}${process.env.BASE_DOMAIN || 'localhost'}`,
      },
    });

    // Create associated build record
    const build = await prisma.build.create({
      data: {
        deploymentId: deployment.id,
        projectId,
        status: 'PENDING',
      },
    });

    // Publish deployment event to Kafka
    await producer.send({
      topic: 'deployment-events',
      messages: [{
        key: projectId,
        value: JSON.stringify({
          type: 'DEPLOYMENT_CREATED',
          deploymentId: deployment.id,
          buildId: build.id,
          projectId,
          userId,
          environment: data.environment,
          branch: data.branch || project.branch,
          timestamp: new Date().toISOString(),
        }),
      }],
    });

    // Publish real-time update via Redis
    await publishEvent('deployments', {
      type: 'DEPLOYMENT_STARTED',
      deploymentId: deployment.id,
      projectId,
    });

    logger.info({
      deploymentId: deployment.id,
      projectId,
      userId,
      environment: data.environment,
    }, 'Deployment triggered');

    return reply.status(201).send({
      success: true,
      data: {
        deployment: {
          ...deployment,
          build,
        },
      },
    });
  });

  // Get single deployment
  app.get('/deployments/:deploymentId', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { deploymentId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { deploymentId } = request.params;

    const deployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        project: {
          OR: [
            { userId },
            { team: { members: { some: { userId } } } },
          ],
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            repositoryUrl: true,
          },
        },
        build: true,
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!deployment) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'DEPLOYMENT_NOT_FOUND',
          message: 'Deployment not found or you do not have access',
        },
      });
    }

    return reply.send({
      success: true,
      data: { deployment },
    });
  });

  // Cancel deployment
  app.post('/deployments/:deploymentId/cancel', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { deploymentId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { deploymentId } = request.params;
    
    const parseResult = cancelDeploymentSchema.safeParse(request.body);
    const data = parseResult.success ? parseResult.data : {};

    const deployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        status: { in: ['PENDING', 'BUILDING', 'DEPLOYING'] },
        project: {
          OR: [
            { userId },
            { team: { members: { some: { userId, role: { in: ['OWNER', 'ADMIN', 'DEVELOPER'] } } } } },
          ],
        },
      },
    });

    if (!deployment) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'DEPLOYMENT_NOT_FOUND',
          message: 'Deployment not found, already completed, or you do not have permission',
        },
      });
    }

    // Update deployment status
    const updatedDeployment = await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'CANCELLED',
        finishedAt: new Date(),
      },
    });

    // Update build status if exists
    await prisma.build.updateMany({
      where: {
        deploymentId,
        status: { in: ['PENDING', 'BUILDING'] },
      },
      data: {
        status: 'CANCELLED',
        finishedAt: new Date(),
      },
    });

    // Publish cancellation event
    await producer.send({
      topic: 'deployment-events',
      messages: [{
        key: deployment.projectId,
        value: JSON.stringify({
          type: 'DEPLOYMENT_CANCELLED',
          deploymentId,
          projectId: deployment.projectId,
          userId,
          reason: data.reason,
          timestamp: new Date().toISOString(),
        }),
      }],
    });

    await publishEvent('deployments', {
      type: 'DEPLOYMENT_CANCELLED',
      deploymentId,
      projectId: deployment.projectId,
    });

    logger.info({ deploymentId, userId, reason: data.reason }, 'Deployment cancelled');

    return reply.send({
      success: true,
      data: { deployment: updatedDeployment },
    });
  });

  // Redeploy (create new deployment from existing)
  app.post('/deployments/:deploymentId/redeploy', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { deploymentId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { deploymentId } = request.params;

    const originalDeployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        project: {
          OR: [
            { userId },
            { team: { members: { some: { userId, role: { in: ['OWNER', 'ADMIN', 'DEVELOPER'] } } } } },
          ],
        },
      },
      include: {
        project: true,
      },
    });

    if (!originalDeployment) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'DEPLOYMENT_NOT_FOUND',
          message: 'Deployment not found or you do not have permission',
        },
      });
    }

    // Create new deployment based on original
    const newDeployment = await prisma.deployment.create({
      data: {
        projectId: originalDeployment.projectId,
        userId,
        branch: originalDeployment.branch,
        commitSha: originalDeployment.commitSha,
        environment: originalDeployment.environment,
        status: 'PENDING',
        url: originalDeployment.url,
      },
    });

    const build = await prisma.build.create({
      data: {
        deploymentId: newDeployment.id,
        projectId: originalDeployment.projectId,
        status: 'PENDING',
      },
    });

    // Publish events
    await producer.send({
      topic: 'deployment-events',
      messages: [{
        key: originalDeployment.projectId,
        value: JSON.stringify({
          type: 'DEPLOYMENT_CREATED',
          deploymentId: newDeployment.id,
          buildId: build.id,
          projectId: originalDeployment.projectId,
          userId,
          environment: originalDeployment.environment,
          branch: originalDeployment.branch,
          redeployedFrom: deploymentId,
          timestamp: new Date().toISOString(),
        }),
      }],
    });

    await publishEvent('deployments', {
      type: 'DEPLOYMENT_STARTED',
      deploymentId: newDeployment.id,
      projectId: originalDeployment.projectId,
    });

    logger.info({
      deploymentId: newDeployment.id,
      originalDeploymentId: deploymentId,
      projectId: originalDeployment.projectId,
      userId,
    }, 'Redeployment triggered');

    return reply.status(201).send({
      success: true,
      data: {
        deployment: {
          ...newDeployment,
          build,
        },
      },
    });
  });

  // Get deployment logs
  app.get('/deployments/:deploymentId/logs', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { deploymentId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { deploymentId } = request.params;

    const deployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        project: {
          OR: [
            { userId },
            { team: { members: { some: { userId } } } },
          ],
        },
      },
      include: {
        build: true,
      },
    });

    if (!deployment) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'DEPLOYMENT_NOT_FOUND',
          message: 'Deployment not found or you do not have access',
        },
      });
    }

    // Get logs from Redis (stored during build/deploy process)
    const logsKey = `deployment:${deploymentId}:logs`;
    const logs = await redis.lrange(logsKey, 0, -1);

    return reply.send({
      success: true,
      data: {
        logs: logs.map(log => JSON.parse(log)),
        build: deployment.build,
      },
    });
  });

  // Stream deployment logs via WebSocket
  app.get('/deployments/:deploymentId/logs/stream', {
    websocket: true,
    onRequest: [app.authenticate],
  }, async (socket: any, request: FastifyRequest<{ Params: { deploymentId: string } }>) => {
    const userId = request.user?.sub as string;
    const { deploymentId } = request.params;

    const deployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        project: {
          OR: [
            { userId },
            { team: { members: { some: { userId } } } },
          ],
        },
      },
    });

    if (!deployment) {
      socket.send(JSON.stringify({
        type: 'error',
        error: 'Deployment not found or you do not have access',
      }));
      socket.close();
      return;
    }

    // Subscribe to deployment logs channel
    const channel = `deployment:${deploymentId}:logs`;
    
    const subscriber = redis.duplicate();
    await subscriber.subscribe(channel);

    subscriber.on('message', (_channel: string, message: string) => {
      socket.send(message);
    });

    // Send existing logs first
    const existingLogs = await redis.lrange(`deployment:${deploymentId}:logs`, 0, -1);
    existingLogs.forEach(log => socket.send(log));

    socket.on('close', async () => {
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
    });
  });
}
