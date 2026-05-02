import { z } from "zod";
import { resolveSqliteDatabaseUrl } from "./lib/database-url.js";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Absolute or relative to cwd: built SPA (после `yarn build:web` в корне + copy-web) */
  WEB_DIST_PATH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = resolveSqliteDatabaseUrl(process.env.DATABASE_URL);
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
