import path from "node:path";
import { fileURLToPath } from "node:url";
/** Корень пакета `@erm/api` (рядом с `package.json` / `prisma/`), не зависит от `process.cwd()`. */
export function apiPackageRoot() {
    return path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}
/**
 * SQLite `DATABASE_URL`: относительный `file:./...` резолвится от корня пакета API.
 * Иначе при `node apps/api/dist/server.js` из корня репо открывалась бы `./.data/dev.db` у корня, а не `apps/api/.data/dev.db`.
 */
export function resolveSqliteDatabaseUrl(raw) {
    if (raw == null || raw.trim() === "")
        return "";
    const trimmed = raw.trim();
    if (!trimmed.startsWith("file:"))
        return trimmed;
    const withoutScheme = trimmed.slice("file:".length);
    const q = withoutScheme.indexOf("?");
    const pathPart = (q === -1 ? withoutScheme : withoutScheme.slice(0, q)).trim();
    const query = q === -1 ? "" : withoutScheme.slice(q);
    if (pathPart.startsWith("/") ||
        pathPart.startsWith("//") ||
        /^[A-Za-z]:[\\/]/.test(pathPart)) {
        return trimmed;
    }
    const abs = path.resolve(apiPackageRoot(), pathPart);
    return `file:${abs}${query}`;
}
//# sourceMappingURL=database-url.js.map