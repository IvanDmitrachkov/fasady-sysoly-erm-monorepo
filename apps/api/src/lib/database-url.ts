import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** SQLite не создаёт родительские каталоги — после удаления `.data/` без этого будет ошибка 14 (unable to open). */
function ensureSqliteParentDir(urlString: string): void {
  try {
    const noQuery = urlString.split("?")[0] ?? urlString;
    const u = new URL(noQuery);
    if (u.protocol !== "file:") return;
    const fp = fileURLToPath(u);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
  } catch {
    /* если URL не распарсился — дальше всё равно упадёт при коннекте */
  }
}

/** Корень пакета `@erm/api` (рядом с `package.json` / `prisma/`), не зависит от `process.cwd()`. */
export function apiPackageRoot(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/** Каталог `prisma/` — как у Prisma CLI при резолве относительных путей в `DATABASE_URL` для SQLite. */
export function prismaSchemaDir(): string {
  return path.join(apiPackageRoot(), "prisma");
}

/**
 * SQLite `DATABASE_URL`: относительный `file:./...` резолвится от каталога со `schema.prisma`
 * (то же правило, что у `prisma migrate`), не от `cwd` и не от корня пакета без `prisma/`.
 */
export function resolveSqliteDatabaseUrl(raw: string | undefined): string {
  if (raw == null || raw.trim() === "") return "";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("file:")) return trimmed;

  const withoutScheme = trimmed.slice("file:".length);
  const q = withoutScheme.indexOf("?");
  const pathPart = (q === -1 ? withoutScheme : withoutScheme.slice(0, q)).trim();
  const query = q === -1 ? "" : withoutScheme.slice(q);

  if (
    pathPart.startsWith("/") ||
    pathPart.startsWith("//") ||
    /^[A-Za-z]:[\\/]/.test(pathPart)
  ) {
    ensureSqliteParentDir(trimmed);
    return trimmed;
  }

  const abs = path.resolve(prismaSchemaDir(), pathPart);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return `file:${abs}${query}`;
}
