import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';

// @neondatabase/serverless v0.10+ ile HTTP connection cache varsayılan olarak açıktır.
// fetchConnectionCache = true olarak ayarlamaya gerek yok (deprecated).


// Sadece local dev ortamında WebSocket polyfill'i devreye al
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ws = require('ws');
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL!;

function createPrismaClient() {
  // PrismaNeon constructor: (config: NeonQueryConfig | string, options?)
  // config olarak doğrudan connection string geçilir
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
