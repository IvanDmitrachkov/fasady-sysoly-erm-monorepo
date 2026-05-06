import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";
import type { Env } from "./env.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { ordersRoutes } from "./routes/orders.js";
import { stagesRoutes } from "./routes/stages.js";
import { customersRoutes } from "./routes/customers.js";
import { auditRoutes } from "./routes/audit.js";
import { activityRoutes } from "./routes/activity.js";
import { timeEntriesRoutes } from "./routes/time-entries.js";
import { usersRoutes } from "./routes/users.js";
import { cuttingRoutes } from "./routes/cutting.js";
import { orderPrintRoutes } from "./routes/order-print.js";
import { facadeTypesRoutes } from "./routes/facade-types.js";
import { reportsRoutes } from "./routes/reports.js";
import { orderWorkStatesRoutes } from "./routes/order-work-states.js";

function defaultWebDistPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web-dist");
}

function resolveWebDistPath(env: Env): string {
  if (!env.WEB_DIST_PATH) return defaultWebDistPath();
  return path.isAbsolute(env.WEB_DIST_PATH)
    ? env.WEB_DIST_PATH
    : path.resolve(process.cwd(), env.WEB_DIST_PATH);
}

async function registerWebStatic(app: FastifyInstance, env: Env) {
  const webDistPath = resolveWebDistPath(env);
  const indexPath = path.join(webDistPath, "index.html");

  app.get("/", async (_request, reply) =>
    reply.type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ERM Фасады Сысолы</title>
  </head>
  <body>
    <h1>ERM Фасады Сысолы</h1>
    <p>Админ-панель доступна по адресу <a href="/admin/">/admin/</a>.</p>
  </body>
</html>`),
  );

  if (!existsSync(indexPath)) {
    const message = `Built web app not found at ${indexPath}. Run the web build and copy-web step first.`;
    if (env.NODE_ENV === "production") {
      throw new Error(message);
    }
    app.log.warn(message);
    return;
  }

  await app.register(fastifyStatic, {
    root: webDistPath,
    prefix: "/admin/",
    wildcard: false,
  });

  app.get("/admin", async (_request, reply) => reply.redirect("/admin/", 308));
  app.get("/admin/*", async (_request, reply) => reply.sendFile("index.html"));
}

export async function buildApp(env: Env) {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: env.NODE_ENV === "development",
    credentials: true,
  });

  await app.register(
    fp(
      async (instance) => {
        await instance.register(jwt, {
          secret: env.JWT_SECRET,
          sign: { expiresIn: "7d" },
        });
      },
      { name: "jwt" },
    ),
  );

  await app.register(prismaPlugin);

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(meRoutes, { prefix: "/api" });
  await app.register(cuttingRoutes, { prefix: "/api" });
  await app.register(orderPrintRoutes, { prefix: "/api" });
  await app.register(orderWorkStatesRoutes, { prefix: "/api" });
  await app.register(ordersRoutes, { prefix: "/api" });
  await app.register(facadeTypesRoutes, { prefix: "/api" });
  await app.register(stagesRoutes, { prefix: "/api" });
  await app.register(customersRoutes, { prefix: "/api" });
  await app.register(auditRoutes, { prefix: "/api" });
  await app.register(activityRoutes, { prefix: "/api" });
  await app.register(timeEntriesRoutes, { prefix: "/api" });
  await app.register(usersRoutes, { prefix: "/api" });
  await app.register(reportsRoutes, { prefix: "/api" });

  await registerWebStatic(app, env);

  return app;
}
