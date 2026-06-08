import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';

// Vercel Serverless ortamında Neon HTTP adaptörü kullanılır.
// Local dev ortamında da aynı adaptörü kullanıyoruz (websocket gerekmez,
// neonConfig.webSocketConstructor yalnızca Node.js ws kullanımı için gerekli
// ama HTTP modunda (fetch) bu ayar gereksizdir).

const connectionString = process.env.DATABASE_URL!;

function createPrismaClient() {
  // PrismaNeon HTTP modunda çalışır — WebSocket'e gerek yok
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
