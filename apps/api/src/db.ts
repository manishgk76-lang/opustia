import { PrismaClient } from '@prisma/client';

/**
 * Reuse the client while the development server is reloaded. Without this,
 * each reload can create another PostgreSQL connection pool.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  opustiaPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.opustiaPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.opustiaPrisma = prisma;
}
