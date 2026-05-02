import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "..");
const webDist = path.join(apiRoot, "../web/dist");
const target = path.join(apiRoot, "web-dist");

if (!fs.existsSync(webDist)) {
  console.warn("[copy-web] ../web/dist not found — skip (run build:web first for production static)");
  process.exit(0);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(webDist, target, { recursive: true });
console.log("[copy-web] copied to", target);
