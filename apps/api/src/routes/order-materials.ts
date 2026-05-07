import { Role } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authPayload, authUserId, requireJwt, requireRoles } from "../auth/preHandlers.js";
import { writeAudit } from "../lib/audit.js";
import { formatOrderNumber } from "../lib/order-number.js";

const createBody = z.object({
  stageId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1, "Укажите материал"),
  unit: z.string().trim().min(1, "Укажите единицу"),
  quantity: z.number().positive("Количество должно быть > 0"),
  comment: z.string().optional().nullable(),
  usedAt: z.string().datetime(),
});

const patchBody = z
  .object({
    stageId: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(1).optional(),
    unit: z.string().trim().min(1).optional(),
    quantity: z.number().positive().optional(),
    comment: z.string().optional().nullable(),
    usedAt: z.string().datetime().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Нет полей для обновления" });

function serializeEntry(e: {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  comment: string | null;
  usedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    patronymic: string | null;
  };
  stage: { id: string; name: string } | null;
}) {
  return {
    id: e.id,
    name: e.name,
    unit: e.unit,
    quantity: e.quantity,
    comment: e.comment,
    usedAt: e.usedAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    user: e.user,
    stage: e.stage,
  };
}

export const orderMaterialsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get("/orders/:orderId/material-entries", async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const p = authPayload(request);
    const order = await app.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return reply.code(404).send({ error: "Заказ не найден" });
    if (p.role === Role.CUSTOMER && order.customerId !== p.customerId) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const entries = await app.prisma.orderMaterialEntry.findMany({
      where: { orderId },
      include: { user: true, stage: true },
      orderBy: [{ usedAt: "desc" }, { createdAt: "desc" }],
    });
    return { entries: entries.map((e) => serializeEntry(e)) };
  });

  app.post(
    "/orders/:orderId/material-entries",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const parsed = createBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }
      const order = await app.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return reply.code(404).send({ error: "Заказ не найден" });
      if (parsed.data.stageId) {
        const stage = await app.prisma.stage.findUnique({ where: { id: parsed.data.stageId } });
        if (!stage) return reply.code(400).send({ error: "Этап не найден" });
      }
      const uid = authUserId(request);
      const entry = await app.prisma.orderMaterialEntry.create({
        data: {
          orderId,
          userId: uid,
          stageId: parsed.data.stageId ?? null,
          name: parsed.data.name,
          unit: parsed.data.unit,
          quantity: parsed.data.quantity,
          comment: parsed.data.comment ?? null,
          usedAt: new Date(parsed.data.usedAt),
        },
        include: { user: true, stage: true },
      });
      await writeAudit(
        app.prisma,
        uid,
        "material.create",
        `Материал: ${entry.name} ${entry.quantity} ${entry.unit}, заказ №${formatOrderNumber(order.orderNumber)}`,
        "OrderMaterialEntry",
        entry.id,
      );
      return reply.code(201).send({ entry: serializeEntry(entry) });
    },
  );

  app.patch(
    "/material-entries/:id",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = patchBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }
      const existing = await app.prisma.orderMaterialEntry.findUnique({
        where: { id },
        include: { order: true, stage: true },
      });
      if (!existing) return reply.code(404).send({ error: "Запись не найдена" });
      const uid = authUserId(request);
      const p = authPayload(request);
      if (p.role !== Role.ADMIN && existing.userId !== uid) {
        return reply.code(403).send({ error: "Нельзя редактировать чужую запись" });
      }
      if (parsed.data.stageId) {
        const stage = await app.prisma.stage.findUnique({ where: { id: parsed.data.stageId } });
        if (!stage) return reply.code(400).send({ error: "Этап не найден" });
      }
      const updated = await app.prisma.orderMaterialEntry.update({
        where: { id },
        data: {
          ...(parsed.data.stageId !== undefined ? { stageId: parsed.data.stageId } : {}),
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.unit !== undefined ? { unit: parsed.data.unit } : {}),
          ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity } : {}),
          ...(parsed.data.comment !== undefined ? { comment: parsed.data.comment } : {}),
          ...(parsed.data.usedAt !== undefined ? { usedAt: new Date(parsed.data.usedAt) } : {}),
        },
        include: { user: true, stage: true },
      });
      await writeAudit(
        app.prisma,
        uid,
        "material.update",
        `Изменение материала: ${updated.name} ${updated.quantity} ${updated.unit}, заказ №${formatOrderNumber(existing.order.orderNumber)}`,
        "OrderMaterialEntry",
        updated.id,
      );
      return { entry: serializeEntry(updated) };
    },
  );
};
