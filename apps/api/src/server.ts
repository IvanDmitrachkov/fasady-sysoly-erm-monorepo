import "dotenv/config";
import { loadEnv } from "./env.js";
import { buildApp } from "./app.js";

const env = loadEnv();
const app = await buildApp(env);

await app.listen({ port: env.PORT, host: "0.0.0.0" });
