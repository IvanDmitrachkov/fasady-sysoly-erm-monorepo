import { Role } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authUserId, requireJwt, requireRoles } from "../auth/preHandlers.js";
import { writeAudit } from "../lib/audit.js";

const createCustomerBody = z.object({ name: z.string().min(1) });
const patchCustomerBody = z.object({ name: z.string().min(1) });

export const customersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get("/customers", { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] }, async () => {
    const customers = await app.prisma.customer.findMany({ orderBy: { name: "asc" } });
    return { customers };
  });

  app.post(
    "/customers",
    { preHandler: [requireRoles(Role.ADMIN)] },
    async (request, reply) => {
      const parsed = createCustomerBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }
      const customer = await app.prisma.customer.create({ data: { name: parsed.data.name } });
      await writeAudit(
        app.prisma,
        authUserId(request),
        "customer.create",
        `Создан заказчик «${customer.name}»`,
        "Customer",
        customer.id,
      );
      return reply.code(201).send({ customer });
    },
  );

  app.patch(
    "/customers/:id",
    { preHandler: [requireRoles(Role.ADMIN)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = patchCustomerBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }
      const existing = await app.prisma.customer.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: "Заказчик не найден" });
      }
      const customer = await app.prisma.customer.update({
        where: { id },
        data: { name: parsed.data.name },
      });
      await writeAudit(
        app.prisma,
        authUserId(request),
        "customer.update",
        `Заказчик «${existing.name}» → «${customer.name}»`,
        "Customer",
        customer.id,
      );
      return { customer };
    },
  );
};
