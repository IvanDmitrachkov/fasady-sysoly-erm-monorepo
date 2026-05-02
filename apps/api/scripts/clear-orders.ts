/**
 * Удаляет все заказы (фасады и time entries уходят каскадом).
 * Запуск: из apps/api — `yarn exec tsx scripts/clear-orders.ts`
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { resolveSqliteDatabaseUrl } from "../src/lib/database-url.js";

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolveSqliteDatabaseUrl(process.env.DATABASE_URL);
}

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.order.deleteMany({});
  console.log(`Удалено заказов: ${r.count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
