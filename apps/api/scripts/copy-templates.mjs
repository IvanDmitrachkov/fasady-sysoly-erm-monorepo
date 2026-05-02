import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "..");
const src = path.join(apiRoot, "templates");
const dst = path.join(apiRoot, "dist/templates");

if (!fs.existsSync(src)) {
  console.warn("[copy-templates] no templates dir — skip");
  process.exit(0);
}

fs.mkdirSync(dst, { recursive: true });
fs.cpSync(src, dst, { recursive: true });
console.log("[copy-templates] copied to", dst);
