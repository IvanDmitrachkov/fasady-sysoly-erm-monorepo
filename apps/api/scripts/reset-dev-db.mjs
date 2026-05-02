/**
 * Сброс dev SQLite: удаляет `apps/api/.data/dev.db*`, затем migrate deploy + seed
 * на **абсолютный** путь к тому же файлу (как и runtime API после `resolveSqliteDatabaseUrl`).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(apiRoot, ".data");
const devDbPath = path.join(dataDir, "dev.db");
const databaseUrl = `${pathToFileURL(devDbPath).href}?busy_timeout=8000`;
const prismaEnv = { ...process.env, DATABASE_URL: databaseUrl };

function rmQuiet(p) {
  try {
    fs.unlinkSync(p);
    console.log("removed", p);
  } catch {
    /* ignore */
  }
}

function rmFinalDbStrict(dbPath) {
  const paths = [`${dbPath}-wal`, `${dbPath}-shm`, dbPath];
  for (const p of paths) {
    try {
      fs.unlinkSync(p);
      console.log("removed", p);
    } catch (err) {
      const code = /** @type {NodeJS.ErrnoException} */ (err).code;
      if (code === "ENOENT") continue;
      const isMain = p === dbPath;
      if (isMain) {
        console.error(
          `\nНе удалось удалить ${p} (${code ?? "error"}).\n` +
            `Остановите API (yarn dev) и Prisma Studio, затем снова: yarn db:reset\n`,
        );
        process.exit(1);
      }
      console.warn(`Предупреждение: не удалось удалить ${p} (${code ?? "error"})`);
    }
  }
}

fs.mkdirSync(dataDir, { recursive: true });
rmFinalDbStrict(devDbPath);

execSync("yarn exec prisma migrate deploy", {
  cwd: apiRoot,
  stdio: "inherit",
  shell: true,
  env: prismaEnv,
});

execSync("yarn exec tsx prisma/seed.ts", {
  cwd: apiRoot,
  stdio: "inherit",
  shell: true,
  env: prismaEnv,
});

console.log("\nГотово:", devDbPath);
