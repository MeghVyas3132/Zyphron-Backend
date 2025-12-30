# Zyphron Backend

The core API service for Zyphron deployment platform, built with Fastify and TypeScript.

## Tech Stack

- **Framework**: Fastify
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: BullMQ with Redis
- **Messaging**: Apache Kafka
- **Auth**: JWT with bcrypt

## Project Structure

```
backend/
├── src/
│   ├── app.ts              # Fastify app setup
│   ├── index.ts            # API server entry point
│   ├── worker.ts           # Worker process entry point
│   ├── config/             # Configuration
│   ├── lib/                # Shared libraries
│   │   ├── logger.ts       # Pino logger
│   │   ├── prisma.ts       # Prisma client
│   │   ├── redis.ts        # Redis client
│   │   └── kafka.ts        # Kafka producer
│   ├── routes/             # API routes
│   │   ├── auth.ts         # Authentication
│   │   ├── projects.ts     # Project management
│   │   ├── deployments.ts  # Deployment management
│   │   ├── databases.ts    # Database provisioning
│   │   ├── env.ts          # Environment variables
│   │   └── webhooks.ts     # GitHub webhooks
│   └── types/              # TypeScript types
├── prisma/
│   └── schema.prisma       # Database schema
├── package.json
└── tsconfig.json
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user

### Projects
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/:slug` - Get project
- `PUT /api/v1/projects/:slug` - Update project
- `DELETE /api/v1/projects/:slug` - Delete project

### Deployments
- `GET /api/v1/projects/:slug/deployments` - List deployments
- `POST /api/v1/projects/:slug/deployments` - Create deployment
- `GET /api/v1/projects/:slug/deployments/:id` - Get deployment

### Environment Variables
- `GET /api/v1/projects/:slug/env` - List env vars
- `PUT /api/v1/projects/:slug/env` - Set env vars
- `DELETE /api/v1/projects/:slug/env/:key` - Delete env var

### Databases
- `GET /api/v1/databases` - List databases
- `POST /api/v1/databases` - Create database
- `DELETE /api/v1/databases/:id` - Delete database

## Development

The backend runs as part of the Docker Compose setup. From the root directory:

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Backend API will be available at http://localhost:3000
```

## Environment Variables

See `.env.example` in the root directory for required environment variables.
