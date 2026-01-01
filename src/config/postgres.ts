import { PrismaClient } from '@prisma/client';
import { config } from './index.js';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: config.env === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (config.env !== 'production') {
  global.prisma = prisma;
}

export const connectPostgres = async (): Promise<void> => {
  try {
    await prisma.$connect();
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    throw error;
  }
};

export const disconnectPostgres = async (): Promise<void> => {
  await prisma.$disconnect();
};
