import type { PrismaClient } from "@prisma/client";
import { resolveSqliteDatabaseUrl } from "./database-url.js";

/** Dev SQLite: колонки ФИО, если миграцию не прогнали — добавляем при старте. */
export async function ensureUserNameColumnsSqlite(prisma: PrismaClient): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) return;
  const url = resolveSqliteDatabaseUrl(raw);
  if (!url.startsWith("file:")) return;

  const cols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("User")`);
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("firstName")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "firstName" TEXT`);
  }
  if (!names.has("lastName")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "lastName" TEXT`);
  }
  if (!names.has("patronymic")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "patronymic" TEXT`);
  }
}
