import { Role } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireJwt, requireRoles } from "../auth/preHandlers.js";
import { formatOrderNumber } from "../lib/order-number.js";

const activityQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  take: z.coerce.number().int().min(1).max(300).optional().default(150),
});

const SUPPORTED_ACTIONS = [
  "order.create",
  "order.move",
  "order.work_state",
  "order.comment.create",
  "order.comment.update",
  "time.create",
] as const;

type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

function defaultRange() {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function actionLabel(action: SupportedAction): string {
  switch (action) {
    case "order.create":
      return "Создан заказ";
    case "order.move":
      return "Перемещение по этапам";
    case "order.work_state":
      return "Изменение под-статуса";
    case "order.comment.create":
      return "Добавлен комментарий";
    case "order.comment.update":
      return "Комментарий обновлён";
    case "time.create":
      return "Добавлена трудозатрата";
  }
}

export const activityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get(
    "/activity",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const parsed = activityQuery.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные параметры", details: parsed.error.flatten() });
      }

      const defaulted = defaultRange();
      const from = parsed.data.from ? new Date(parsed.data.from) : defaulted.from;
      const to = parsed.data.to ? new Date(parsed.data.to) : defaulted.to;
      if (from > to) {
        return reply.code(400).send({ error: "Начало периода позже конца" });
      }

      const items = await app.prisma.auditLog.findMany({
        where: {
          action: { in: [...SUPPORTED_ACTIONS] },
          createdAt: { gte: from, lte: to },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              patronymic: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: parsed.data.take,
      });

      const orderIds = new Set<string>();
      const commentIds: string[] = [];
      const timeEntryIds: string[] = [];
      for (const row of items) {
        if (row.entityType === "Order" && row.entityId) orderIds.add(row.entityId);
        if (row.entityType === "OrderComment" && row.entityId) commentIds.push(row.entityId);
        if (row.entityType === "TimeEntry" && row.entityId) timeEntryIds.push(row.entityId);
      }

      const [orders, comments, timeEntries] = await Promise.all([
        orderIds.size
          ? app.prisma.order.findMany({
              where: { id: { in: [...orderIds] } },
              select: { id: true, orderNumber: true },
            })
          : Promise.resolve([]),
        commentIds.length
          ? app.prisma.orderComment.findMany({
              where: { id: { in: commentIds } },
              select: { id: true, orderId: true, text: true },
            })
          : Promise.resolve([]),
        timeEntryIds.length
          ? app.prisma.timeEntry.findMany({
              where: { id: { in: timeEntryIds } },
              select: { id: true, orderId: true },
            })
          : Promise.resolve([]),
      ]);

      const orderMap = new Map(orders.map((o) => [o.id, o]));
      const commentMap = new Map(comments.map((c) => [c.id, c]));
      const timeMap = new Map(timeEntries.map((t) => [t.id, t]));

      for (const c of comments) {
        if (!orderMap.has(c.orderId)) orderIds.add(c.orderId);
      }
      for (const t of timeEntries) {
        if (!orderMap.has(t.orderId)) orderIds.add(t.orderId);
      }
      if (orderIds.size > orderMap.size) {
        const extraOrders = await app.prisma.order.findMany({
          where: { id: { in: [...orderIds] } },
          select: { id: true, orderNumber: true },
        });
        for (const o of extraOrders) orderMap.set(o.id, o);
      }

      const events = items.map((row) => {
        const action = row.action as SupportedAction;
        let orderId: string | null = null;
        let details = row.message;

        if (row.entityType === "Order" && row.entityId) {
          orderId = row.entityId;
        } else if (row.entityType === "OrderComment" && row.entityId) {
          const comment = commentMap.get(row.entityId);
          orderId = comment?.orderId ?? null;
          if (comment?.text.trim()) {
            details = `${actionLabel(action)}: ${comment.text.trim()}`;
          }
        } else if (row.entityType === "TimeEntry" && row.entityId) {
          const entry = timeMap.get(row.entityId);
          orderId = entry?.orderId ?? null;
        }

        const order = orderId ? orderMap.get(orderId) : null;

        return {
          id: row.id,
          action,
          label: actionLabel(action),
          details,
          createdAt: row.createdAt.toISOString(),
          user: row.user,
          order: order
            ? {
                id: order.id,
                orderNumber: order.orderNumber,
                orderNumberFormatted: formatOrderNumber(order.orderNumber),
              }
            : null,
        };
      });

      return {
        from: from.toISOString(),
        to: to.toISOString(),
        items: events,
      };
    },
  );
};
