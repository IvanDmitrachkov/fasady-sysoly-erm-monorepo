import { Role } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authPayload, authUserId, requireJwt, requireRoles } from "../auth/preHandlers.js";
import { writeAudit } from "../lib/audit.js";
import { formatOrderNumber } from "../lib/order-number.js";

const createBody = z.object({
  stageId: z.string().min(1),
  minutes: z.number().int().positive(),
  comment: z.string().optional().nullable(),
  workedAt: z.string().datetime(),
});

const patchBody = z
  .object({
    stageId: z.string().min(1).optional(),
    minutes: z.number().int().positive().optional(),
    comment: z.string().optional().nullable(),
    workedAt: z.string().datetime().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Нет полей для обновления" });

const reportQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  userId: z.string().uuid().optional(),
});

function serializeEntry(e: {
  id: string;
  minutes: number;
  comment: string | null;
  workedAt: Date;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    patronymic: string | null;
  };
  stage: { id: string; name: string };
  order: { id: string; orderNumber: number };
}) {
  return {
    id: e.id,
    minutes: e.minutes,
    comment: e.comment,
    workedAt: e.workedAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    user: {
      id: e.user.id,
      email: e.user.email,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      patronymic: e.user.patronymic,
    },
    stage: { id: e.stage.id, name: e.stage.name },
    order: {
      id: e.order.id,
      orderNumber: formatOrderNumber(e.order.orderNumber),
    },
  };
}

const timeEntryInclude = { user: true, stage: true } as const;
const timeEntryReportInclude = { user: true, stage: true, order: true } as const;

export const timeEntriesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get(
    "/time-entries/report",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const p = authPayload(request);
      const q = reportQuery.safeParse(request.query);
      if (!q.success) {
        return reply.code(400).send({ error: "Некорректные параметры", details: q.error.flatten() });
      }

      let targetUserId = authUserId(request);
      if (p.role === Role.ADMIN) {
        if (!q.data.userId) {
          return reply.code(400).send({ error: "Укажите сотрудника" });
        }
        const u = await app.prisma.user.findUnique({ where: { id: q.data.userId } });
        if (!u) {
          return reply.code(404).send({ error: "Пользователь не найден" });
        }
        targetUserId = q.data.userId;
      }

      const from = new Date(q.data.from);
      const to = new Date(q.data.to);
      if (from > to) {
        return reply.code(400).send({ error: "Начало периода позже конца" });
      }

      const entries = await app.prisma.timeEntry.findMany({
        where: {
          userId: targetUserId,
          workedAt: { gte: from, lte: to },
        },
        include: timeEntryReportInclude,
        orderBy: { workedAt: "desc" },
      });

      const totalMinutes = entries.reduce((acc, e) => acc + e.minutes, 0);

      return {
        entries: entries.map((e) => serializeEntry(e)),
        totalMinutes,
      };
    },
  );

  app.patch(
    "/time-entries/:id",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = patchBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }

      const existing = await app.prisma.timeEntry.findUnique({
        where: { id },
        include: { order: true, stage: true },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Запись не найдена" });
      }

      const uid = authUserId(request);
      const p = authPayload(request);
      if (p.role !== Role.ADMIN && existing.userId !== uid) {
        return reply.code(403).send({ error: "Нельзя редактировать чужую запись" });
      }

      if (parsed.data.stageId) {
        const stage = await app.prisma.stage.findUnique({ where: { id: parsed.data.stageId } });
        if (!stage) {
          return reply.code(400).send({ error: "Этап не найден" });
        }
      }

      const updated = await app.prisma.timeEntry.update({
        where: { id },
        data: {
          ...(parsed.data.stageId !== undefined ? { stageId: parsed.data.stageId } : {}),
          ...(parsed.data.minutes !== undefined ? { minutes: parsed.data.minutes } : {}),
          ...(parsed.data.comment !== undefined ? { comment: parsed.data.comment } : {}),
          ...(parsed.data.workedAt !== undefined ? { workedAt: new Date(parsed.data.workedAt) } : {}),
        },
        include: timeEntryReportInclude,
      });

      await writeAudit(
        app.prisma,
        uid,
        "time.update",
        `Изменение учёта времени: ${updated.minutes} мин, этап «${updated.stage.name}», заказ №${formatOrderNumber(updated.order.orderNumber)}`,
        "TimeEntry",
        updated.id,
      );

      return { entry: serializeEntry(updated) };
    },
  );

  app.get("/orders/:orderId/time-entries", async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const p = authPayload(request);

    const order = await app.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return reply.code(404).send({ error: "Заказ не найден" });
    }
    if (p.role === Role.CUSTOMER && order.customerId !== p.customerId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const entries = await app.prisma.timeEntry.findMany({
      where: { orderId },
      include: timeEntryInclude,
      orderBy: { workedAt: "desc" },
    });

    return {
      entries: entries.map((e) => ({
        id: e.id,
        minutes: e.minutes,
        comment: e.comment,
        workedAt: e.workedAt.toISOString(),
        createdAt: e.createdAt.toISOString(),
        user: {
          id: e.user.id,
          email: e.user.email,
          firstName: e.user.firstName,
          lastName: e.user.lastName,
          patronymic: e.user.patronymic,
        },
        stage: { id: e.stage.id, name: e.stage.name },
      })),
    };
  });

  app.post(
    "/orders/:orderId/time-entries",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const parsed = createBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }

      const order = await app.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return reply.code(404).send({ error: "Заказ не найден" });
      }

      const stage = await app.prisma.stage.findUnique({ where: { id: parsed.data.stageId } });
      if (!stage) {
        return reply.code(400).send({ error: "Этап не найден" });
      }

      const uid = authUserId(request);
      const entry = await app.prisma.timeEntry.create({
        data: {
          orderId,
          userId: uid,
          stageId: stage.id,
          minutes: parsed.data.minutes,
          comment: parsed.data.comment ?? null,
          workedAt: new Date(parsed.data.workedAt),
        },
        include: timeEntryInclude,
      });

      await writeAudit(
        app.prisma,
        uid,
        "time.create",
        `Учёт времени: ${entry.minutes} мин, этап «${entry.stage.name}», заказ №${formatOrderNumber(order.orderNumber)}`,
        "TimeEntry",
        entry.id,
      );

      return reply.code(201).send({
        entry: {
          id: entry.id,
          minutes: entry.minutes,
          comment: entry.comment,
          workedAt: entry.workedAt.toISOString(),
          createdAt: entry.createdAt.toISOString(),
          user: {
            id: entry.user.id,
            email: entry.user.email,
            firstName: entry.user.firstName,
            lastName: entry.user.lastName,
            patronymic: entry.user.patronymic,
          },
          stage: { id: entry.stage.id, name: entry.stage.name },
        },
      });
    },
  );
};
