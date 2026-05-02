import type { FastifyPluginAsync } from "fastify";

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const payload = request.user as { sub: string; role: string; customerId: string | null };
    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        patronymic: true,
        role: true,
        customerId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    return { user };
  });
};
