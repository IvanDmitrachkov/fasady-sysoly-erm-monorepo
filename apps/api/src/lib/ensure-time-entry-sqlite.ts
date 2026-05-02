import type { PrismaClient } from "@prisma/client";
import { resolveSqliteDatabaseUrl } from "./database-url.js";

const CREATE_TIME_ENTRY = `
CREATE TABLE IF NOT EXISTS "TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "comment" TEXT,
    "workedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
`.trim();

/** Dev SQLite: таблица могла не появиться, если миграцию не прогнали — создаём при старте. MySQL и прод — только через migrate. */
export async function ensureTimeEntrySqlite(prisma: PrismaClient): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) return;
  const url = resolveSqliteDatabaseUrl(raw);
  if (!url.startsWith("file:")) return;

  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='TimeEntry'",
  );
  if (rows.length > 0) return;

  await prisma.$executeRawUnsafe(CREATE_TIME_ENTRY);
}
