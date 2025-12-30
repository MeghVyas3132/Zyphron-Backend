// ===========================================
// WEBHOOK ROUTES
// ===========================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/lib/prisma.js';
import { createLogger } from '@/lib/logger.js';
import { producer } from '@/lib/kafka.js';
import { publishEvent } from '@/lib/redis.js';
import { createHmac, timingSafeEqual } from 'crypto';

const logger = createLogger('webhooks');

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'deployment.created',
    'deployment.started',
    'deployment.success',
    'deployment.failed',
    'deployment.cancelled',
    'build.started',
    'build.success',
    'build.failed',
    'project.created',
    'project.updated',
    'project.deleted',
    'database.created',
    'database.deleted',
  ])).min(1),
  secret: z.string().optional(),
  isActive: z.boolean().default(true),
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  secret: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GitHub webhook payload schemas
const githubPushEventSchema = z.object({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  repository: z.object({
    id: z.number(),
    full_name: z.string(),
    clone_url: z.string(),
    default_branch: z.string(),
  }),
  pusher: z.object({
    name: z.string(),
    email: z.string().optional(),
  }),
  commits: z.array(z.object({
    id: z.string(),
    message: z.string(),
    author: z.object({
      name: z.string(),
      email: z.string(),
    }),
  })),
  head_commit: z.object({
    id: z.string(),
    message: z.string(),
  }).nullable(),
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

function generateSecret(): string {
  return createHmac('sha256', Date.now().toString())
    .update(Math.random().toString())
    .digest('hex')
    .substring(0, 32);
}

// ===========================================
// ROUTES
// ===========================================

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // ===========================================
  // USER WEBHOOK MANAGEMENT
  // ===========================================

  // List webhooks for a project
  app.get('/projects/:projectId/webhooks', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { projectId } = request.params;

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

    const webhooks = await prisma.webhook.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // Mask secrets
    const maskedWebhooks = webhooks.map(wh => ({
      ...wh,
      secret: wh.secret ? '••••••••' : null,
    }));

    return reply.send({
      success: true,
      data: { webhooks: maskedWebhooks },
    });
  });

  // Create webhook
  app.post('/projects/:projectId/webhooks', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { projectId } = request.params;
    
    const parseResult = createWebhookSchema.safeParse(request.body);

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
          { team: { members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } } } },
        ],
      },
    });

    if (!project) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or you do not have permission',
        },
      });
    }

    const webhook = await prisma.webhook.create({
      data: {
        url: data.url,
        events: data.events,
        secret: data.secret || generateSecret(),
        isActive: data.isActive,
        projectId,
      },
    });

    logger.info({ webhookId: webhook.id, projectId, userId }, 'Webhook created');

    return reply.status(201).send({
      success: true,
      data: {
        webhook: {
          ...webhook,
          secret: '••••••••',
        },
      },
    });
  });

  // Update webhook
  app.put('/projects/:projectId/webhooks/:webhookId', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { projectId: string; webhookId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { projectId, webhookId } = request.params;
    
    const parseResult = updateWebhookSchema.safeParse(request.body);

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

    // Check project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId },
          { team: { members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } } } },
        ],
      },
    });

    if (!project) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or you do not have permission',
        },
      });
    }

    const existing = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        projectId,
      },
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found',
        },
      });
    }

    const webhook = await prisma.webhook.update({
      where: { id: webhookId },
      data: parseResult.data,
    });

    logger.info({ webhookId, projectId, userId }, 'Webhook updated');

    return reply.send({
      success: true,
      data: {
        webhook: {
          ...webhook,
          secret: webhook.secret ? '••••••••' : null,
        },
      },
    });
  });

  // Delete webhook
  app.delete('/projects/:projectId/webhooks/:webhookId', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { projectId: string; webhookId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { projectId, webhookId } = request.params;

    // Check project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId },
          { team: { members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } } } },
        ],
      },
    });

    if (!project) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or you do not have permission',
        },
      });
    }

    const existing = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        projectId,
      },
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found',
        },
      });
    }

    await prisma.webhook.delete({
      where: { id: webhookId },
    });

    logger.info({ webhookId, projectId, userId }, 'Webhook deleted');

    return reply.send({
      success: true,
      data: { message: 'Webhook deleted successfully' },
    });
  });

  // Regenerate webhook secret
  app.post('/projects/:projectId/webhooks/:webhookId/regenerate-secret', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { projectId: string; webhookId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.sub as string;
    const { projectId, webhookId } = request.params;

    // Check project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId },
          { team: { members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } } } },
        ],
      },
    });

    if (!project) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or you do not have permission',
        },
      });
    }

    const existing = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        projectId,
      },
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found',
        },
      });
    }

    const newSecret = generateSecret();
    
    await prisma.webhook.update({
      where: { id: webhookId },
      data: { secret: newSecret },
    });

    logger.info({ webhookId, projectId, userId }, 'Webhook secret regenerated');

    return reply.send({
      success: true,
      data: { secret: newSecret },
    });
  });

  // ===========================================
  // GITHUB WEBHOOK RECEIVER
  // ===========================================

  // GitHub webhook endpoint (no auth - uses signature verification)
  app.post('/webhooks/github/:projectId', {
    config: {
      rawBody: true,
    },
  }, async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
    const { projectId } = request.params;
    const signature = request.headers['x-hub-signature-256'] as string;
    const event = request.headers['x-github-event'] as string;
    const deliveryId = request.headers['x-github-delivery'] as string;

    logger.info({ projectId, event, deliveryId }, 'GitHub webhook received');

    // Find project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      logger.warn({ projectId }, 'Project not found for webhook');
      return reply.status(404).send({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    // Verify signature if secret is configured
    if (project.webhookSecret) {
      const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody || JSON.stringify(request.body);
      
      if (!signature || !verifyGitHubSignature(rawBody, signature, project.webhookSecret)) {
        logger.warn({ projectId, deliveryId }, 'Invalid webhook signature');
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid webhook signature',
          },
        });
      }
    }

    // Handle different GitHub events
    switch (event) {
      case 'push':
        await handlePushEvent(project, request.body);
        break;
      
      case 'pull_request':
        await handlePullRequestEvent(project, request.body);
        break;
      
      case 'ping':
        logger.info({ projectId }, 'GitHub webhook ping received');
        break;
      
      default:
        logger.info({ projectId, event }, 'Unhandled GitHub event');
    }

    return reply.send({
      success: true,
      data: { received: true },
    });
  });
}

// ===========================================
// EVENT HANDLERS
// ===========================================

interface Project {
  id: string;
  name: string;
  branch: string;
  autoDeploy: boolean;
  userId: string;
  subdomain: string;
}

async function handlePushEvent(project: Project, payload: unknown): Promise<void> {
  const parseResult = githubPushEventSchema.safeParse(payload);
  
  if (!parseResult.success) {
    logger.warn({ projectId: project.id }, 'Invalid push event payload');
    return;
  }

  const data = parseResult.data;
  
  // Extract branch name from ref (refs/heads/main -> main)
  const branch = data.ref.replace('refs/heads/', '');
  
  logger.info({
    projectId: project.id,
    branch,
    commits: data.commits.length,
    pusher: data.pusher.name,
  }, 'Processing push event');

  // Check if push is to the project's configured branch
  if (branch !== project.branch) {
    logger.info({ projectId: project.id, branch, configuredBranch: project.branch }, 'Push to non-configured branch, skipping');
    return;
  }

  // Check if auto-deploy is enabled
  if (!project.autoDeploy) {
    logger.info({ projectId: project.id }, 'Auto-deploy disabled, skipping');
    return;
  }

  // Create deployment
  const deployment = await prisma.deployment.create({
    data: {
      projectId: project.id,
      userId: project.userId,
      branch,
      commitSha: data.after,
      commitMessage: data.head_commit?.message || data.commits[0]?.message || 'No commit message',
      environment: 'production',
      status: 'PENDING',
      url: `https://${project.subdomain}.${process.env.BASE_DOMAIN || 'localhost'}`,
    },
  });

  // Create build record
  const build = await prisma.build.create({
    data: {
      deploymentId: deployment.id,
      projectId: project.id,
      status: 'PENDING',
    },
  });

  // Publish to Kafka for worker to pick up
  await producer.send({
    topic: 'deployment-events',
    messages: [{
      key: project.id,
      value: JSON.stringify({
        type: 'DEPLOYMENT_CREATED',
        deploymentId: deployment.id,
        buildId: build.id,
        projectId: project.id,
        trigger: 'github_push',
        commitSha: data.after,
        branch,
        timestamp: new Date().toISOString(),
      }),
    }],
  });

  // Publish real-time update
  await publishEvent('deployments', {
    type: 'DEPLOYMENT_STARTED',
    deploymentId: deployment.id,
    projectId: project.id,
  });

  logger.info({
    deploymentId: deployment.id,
    projectId: project.id,
    commitSha: data.after,
  }, 'Deployment triggered from GitHub push');
}

async function handlePullRequestEvent(project: Project, payload: unknown): Promise<void> {
  const pr = payload as { action: string; number: number; pull_request: { head: { sha: string; ref: string }; title: string } };
  
  logger.info({
    projectId: project.id,
    action: pr.action,
    prNumber: pr.number,
  }, 'Processing pull request event');

  // Only handle opened/synchronize for preview deployments
  if (!['opened', 'synchronize', 'reopened'].includes(pr.action)) {
    return;
  }

  // Create preview deployment
  const deployment = await prisma.deployment.create({
    data: {
      projectId: project.id,
      userId: project.userId,
      branch: pr.pull_request.head.ref,
      commitSha: pr.pull_request.head.sha,
      commitMessage: pr.pull_request.title,
      environment: 'preview',
      status: 'PENDING',
      url: `https://${project.subdomain}-pr-${pr.number}.${process.env.BASE_DOMAIN || 'localhost'}`,
    },
  });

  const build = await prisma.build.create({
    data: {
      deploymentId: deployment.id,
      projectId: project.id,
      status: 'PENDING',
    },
  });

  await producer.send({
    topic: 'deployment-events',
    messages: [{
      key: project.id,
      value: JSON.stringify({
        type: 'DEPLOYMENT_CREATED',
        deploymentId: deployment.id,
        buildId: build.id,
        projectId: project.id,
        trigger: 'github_pull_request',
        commitSha: pr.pull_request.head.sha,
        branch: pr.pull_request.head.ref,
        prNumber: pr.number,
        timestamp: new Date().toISOString(),
      }),
    }],
  });

  logger.info({
    deploymentId: deployment.id,
    projectId: project.id,
    prNumber: pr.number,
  }, 'Preview deployment triggered from GitHub PR');
}
