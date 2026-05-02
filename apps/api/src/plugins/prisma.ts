import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { ensureDefaultStages } from "../lib/default-stages.js";
import { ensureTimeEntrySqlite } from "../lib/ensure-time-entry-sqlite.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPluginImpl: FastifyPluginAsync = async (app) => {
  const prisma = new PrismaClient();
  await prisma.$connect();
  await ensureDefaultStages(prisma);
  await ensureTimeEntrySqlite(prisma);
  app.decorate("prisma", prisma);
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

/** Вынесен из изоляции плагина — иначе `app.prisma` недоступен в sibling-маршрутах. */
export const prismaPlugin = fp(prismaPluginImpl, { name: "prisma" });
