import type { FastifyPluginAsync } from "fastify";
import { requireJwt } from "../auth/preHandlers.js";

export const orderWorkStatesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get("/order-work-states", async () => {
    const orderWorkStates = await app.prisma.orderWorkState.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return {
      orderWorkStates: orderWorkStates.map((w) => ({
        id: w.id,
        slug: w.slug,
        name: w.name,
        sortOrder: w.sortOrder,
      })),
    };
  });
};
