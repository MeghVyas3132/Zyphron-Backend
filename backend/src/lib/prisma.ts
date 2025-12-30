// ===========================================
// PRISMA DATABASE CLIENT
// ===========================================

import { PrismaClient } from '@prisma/client';
import { config } from '@/config/index.js';

// ===========================================
// PRISMA CLIENT SINGLETON
// ===========================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: config.env === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  datasources: {
    db: {
      url: config.database.url,
    },
  },
});

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ===========================================
// DATABASE CONNECTION HELPERS
// ===========================================

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('Database disconnected');
}

// ===========================================
// HEALTH CHECK
// ===========================================

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export { PrismaClient };
