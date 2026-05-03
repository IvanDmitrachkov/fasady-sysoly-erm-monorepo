import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const BASELINE_MIGRATION = "20260503143500_init_mysql";
const APP_TABLES = ["Customer", "User", "Stage", "Order", "Facade"];

const prisma = new PrismaClient();

function numberFromRow(row, key) {
  const value = row?.[key];

  if (typeof value === "bigint") {
    return Number(value);
  }

  return Number(value ?? 0);
}

async function main() {
  const migrationTableRows = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS tableCount FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '_prisma_migrations'",
  );
  const migrationTableExists =
    numberFromRow(migrationTableRows[0], "tableCount") > 0;

  if (migrationTableExists) {
    const migrationRows = await prisma.$queryRawUnsafe(
      "SELECT COUNT(*) AS migrationCount FROM `_prisma_migrations`",
    );
    const migrationCount = numberFromRow(
      migrationRows[0],
      "migrationCount",
    );

    if (migrationCount > 0) {
      console.log("Prisma migration history already exists, skipping baseline.");
      return;
    }
  }

  const appTableRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS appTableCount FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (${APP_TABLES.map(
      () => "?",
    ).join(", ")})`,
    ...APP_TABLES,
  );
  const appTableCount = numberFromRow(appTableRows[0], "appTableCount");

  if (appTableCount === 0) {
    console.log("No existing application tables found, skipping baseline.");
    return;
  }

  if (appTableCount !== APP_TABLES.length) {
    throw new Error(
      `Found only ${appTableCount} of ${APP_TABLES.length} baseline tables. Refusing to baseline a partial database.`,
    );
  }

  await prisma.$disconnect();

  const result = spawnSync(
    "yarn",
    ["exec", "prisma", "migrate", "resolve", "--applied", BASELINE_MIGRATION],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
