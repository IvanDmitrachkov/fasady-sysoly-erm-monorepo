/**
 * Сброс dev SQLite:
 * 1) Удаляет apps/api/.data/dev.db* (если занято — сообщение остановить API)
 * 2) prisma migrate deploy + seed на файл в os.tmpdir() (не трогает .data во время миграций)
 * 3) Копирует готовую БД в .data/dev.db
 *
 * Остановите `yarn dev` и Prisma Studio перед запуском.
 */
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(apiRoot, ".data");
const devDbPath = path.join(dataDir, "dev.db");

function sleepSync(ms) {
  try {
    const sab = new SharedArrayBuffer(4);
    const ia = new Int32Array(sab);
    Atomics.wait(ia, 0, 0, ms);
  } catch {
    execSync(process.platform === "win32" ? "ping -n 2 127.0.0.1 >nul" : "sleep 1", { stdio: "ignore" });
  }
}

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

function rmSqliteBundle(dbPath) {
  for (const ext of ["", "-wal", "-shm"]) {
    const p = ext === "" ? dbPath : `${dbPath}${ext}`;
    rmQuiet(p);
  }
}

function copySqliteBundle(fromDbPath, toDbPath) {
  for (const ext of ["", "-wal", "-shm"]) {
    const from = ext === "" ? fromDbPath : `${fromDbPath}${ext}`;
    const to = ext === "" ? toDbPath : `${toDbPath}${ext}`;
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to);
      console.log("copied", path.basename(from), "→", path.basename(to));
    }
  }
}

function execOrRetry(cmd, env, label) {
  const max = 5;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      execSync(cmd, {
        cwd: apiRoot,
        stdio: "inherit",
        shell: true,
        env,
      });
      return;
    } catch (err) {
      if (attempt === max) throw err;
      console.warn(`${label}: ошибка (попытка ${attempt}/${max}), пауза 2 с…`);
      sleepSync(2000);
    }
  }
}

fs.mkdirSync(dataDir, { recursive: true });
rmFinalDbStrict(devDbPath);
sleepSync(300);

const tmpDbPath = path.join(os.tmpdir(), `erm-migrate-${crypto.randomBytes(8).toString("hex")}.db`);
const tmpDatabaseUrl = `${pathToFileURL(tmpDbPath).href}?busy_timeout=30000`;
const tmpEnv = { ...process.env, DATABASE_URL: tmpDatabaseUrl };

try {
  execOrRetry("yarn exec prisma migrate deploy", tmpEnv, "migrate deploy");
  execOrRetry("yarn exec tsx prisma/seed.ts", tmpEnv, "seed");
} catch (e) {
  rmSqliteBundle(tmpDbPath);
  throw e;
}

try {
  copySqliteBundle(tmpDbPath, devDbPath);
} finally {
  rmSqliteBundle(tmpDbPath);
}

console.log("\nГотово:", devDbPath);
