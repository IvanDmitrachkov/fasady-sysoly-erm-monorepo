import { Role, type Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireJwt, requireRoles } from "../auth/preHandlers.js";
import { formatOrderNumber } from "../lib/order-number.js";

const salesReportQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  coatingTypeId: z.string().uuid().optional(),
  millingLabel: z.string().optional(),
  color: z.string().optional(),
  handle: z.enum(["with", "without"]).optional(),
  customerId: z.string().uuid().optional(),
});

const dashboardReportQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

function facadeAreaM2(f: { widthMm: number; heightMm: number; quantity?: number | null }): number {
  const quantity = f.quantity && f.quantity > 0 ? f.quantity : 1;
  return ((f.widthMm * f.heightMm) / 1_000_000) * quantity;
}

function trendPercent(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - previous) / previous) * 100;
}

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get(
    "/reports/dashboard",
    { preHandler: [requireRoles(Role.ADMIN)] },
    async (request, reply) => {
      const q = dashboardReportQuery.safeParse(request.query);
      if (!q.success) {
        return reply.code(400).send({ error: "Некорректные параметры", details: q.error.flatten() });
      }

      const from = new Date(q.data.from);
      const to = new Date(q.data.to);
      if (from > to) {
        return reply.code(400).send({ error: "Начало периода позже конца" });
      }

      const rangeMs = to.getTime() - from.getTime();
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - rangeMs);

      const [ordersCurrent, ordersPrevious, facadesCurrent, facadesPrevious, timeCurrent, timePrevious] =
        await Promise.all([
          app.prisma.order.findMany({
            where: {
              deletedAt: null,
              completedAt: { gte: from, lte: to },
            },
            select: {
              id: true,
              completedAt: true,
              totalCost: true,
            },
          }),
          app.prisma.order.findMany({
            where: {
              deletedAt: null,
              completedAt: { gte: prevFrom, lte: prevTo },
            },
            select: {
              id: true,
              totalCost: true,
            },
          }),
          app.prisma.facade.findMany({
            where: {
              order: {
                is: {
                  deletedAt: null,
                  completedAt: { gte: from, lte: to },
                },
              },
            },
            select: {
              widthMm: true,
              heightMm: true,
              quantity: true,
              order: { select: { completedAt: true } },
            },
          }),
          app.prisma.facade.findMany({
            where: {
              order: {
                is: {
                  deletedAt: null,
                  completedAt: { gte: prevFrom, lte: prevTo },
                },
              },
            },
            select: {
              widthMm: true,
              heightMm: true,
              quantity: true,
            },
          }),
          app.prisma.timeEntry.findMany({
            where: {
              workedAt: { gte: from, lte: to },
            },
            include: {
              stage: { select: { id: true, name: true } },
            },
            orderBy: { workedAt: "asc" },
          }),
          app.prisma.timeEntry.findMany({
            where: {
              workedAt: { gte: prevFrom, lte: prevTo },
            },
            select: { minutes: true },
          }),
        ]);

      const facadesCountCurrent = facadesCurrent.reduce((sum, f) => sum + (f.quantity && f.quantity > 0 ? f.quantity : 1), 0);
      const facadesCountPrevious = facadesPrevious.reduce(
        (sum, f) => sum + (f.quantity && f.quantity > 0 ? f.quantity : 1),
        0,
      );

      const areaCurrent = facadesCurrent.reduce((sum, f) => sum + facadeAreaM2(f), 0);
      const areaPrevious = facadesPrevious.reduce((sum, f) => sum + facadeAreaM2(f), 0);

      const revenueCurrent = ordersCurrent.reduce((sum, o) => sum + (o.totalCost ?? 0), 0);
      const revenuePrevious = ordersPrevious.reduce((sum, o) => sum + (o.totalCost ?? 0), 0);

      const minutesCurrent = timeCurrent.reduce((sum, t) => sum + t.minutes, 0);
      const minutesPrevious = timePrevious.reduce((sum, t) => sum + t.minutes, 0);

      const dailyMap = new Map<string, { date: string; ordersCount: number; facadeCount: number; minutes: number }>();
      for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
        const key = d.toISOString().slice(0, 10);
        dailyMap.set(key, { date: key, ordersCount: 0, facadeCount: 0, minutes: 0 });
      }

      for (const order of ordersCurrent) {
        if (!order.completedAt) continue;
        const key = order.completedAt.toISOString().slice(0, 10);
        const row = dailyMap.get(key);
        if (row) row.ordersCount += 1;
      }
      for (const facade of facadesCurrent) {
        const completedAt = facade.order.completedAt;
        if (!completedAt) continue;
        const key = completedAt.toISOString().slice(0, 10);
        const row = dailyMap.get(key);
        if (row) row.facadeCount += facade.quantity && facade.quantity > 0 ? facade.quantity : 1;
      }
      for (const t of timeCurrent) {
        const key = t.workedAt.toISOString().slice(0, 10);
        const row = dailyMap.get(key);
        if (row) row.minutes += t.minutes;
      }

      const stageMap = new Map<string, { stageId: string; stageName: string; minutes: number }>();
      for (const t of timeCurrent) {
        const prev = stageMap.get(t.stageId);
        if (prev) {
          prev.minutes += t.minutes;
        } else {
          stageMap.set(t.stageId, { stageId: t.stageId, stageName: t.stage.name, minutes: t.minutes });
        }
      }

      return {
        period: {
          from: from.toISOString(),
          to: to.toISOString(),
          previousFrom: prevFrom.toISOString(),
          previousTo: prevTo.toISOString(),
        },
        kpis: {
          ordersCount: {
            value: ordersCurrent.length,
            previous: ordersPrevious.length,
            trendPercent: trendPercent(ordersCurrent.length, ordersPrevious.length),
          },
          facadeCount: {
            value: facadesCountCurrent,
            previous: facadesCountPrevious,
            trendPercent: trendPercent(facadesCountCurrent, facadesCountPrevious),
          },
          areaM2: {
            value: areaCurrent,
            previous: areaPrevious,
            trendPercent: trendPercent(areaCurrent, areaPrevious),
          },
          totalMinutes: {
            value: minutesCurrent,
            previous: minutesPrevious,
            trendPercent: trendPercent(minutesCurrent, minutesPrevious),
          },
          totalRevenue: {
            value: revenueCurrent,
            previous: revenuePrevious,
            trendPercent: trendPercent(revenueCurrent, revenuePrevious),
          },
        },
        daily: [...dailyMap.values()],
        stageBreakdown: [...stageMap.values()].sort((a, b) => b.minutes - a.minutes),
      };
    },
  );

  app.get(
    "/reports/sales",
    { preHandler: [requireRoles(Role.ADMIN)] },
    async (request, reply) => {
      const q = salesReportQuery.safeParse(request.query);
      if (!q.success) {
        return reply.code(400).send({ error: "Некорректные параметры", details: q.error.flatten() });
      }

      const from = new Date(q.data.from);
      const to = new Date(q.data.to);
      if (from > to) {
        return reply.code(400).send({ error: "Начало периода позже конца" });
      }

      const baseOrderWhere: Prisma.OrderWhereInput = {
        deletedAt: null,
        completedAt: { gte: from, lte: to },
        ...(q.data.customerId ? { customerId: q.data.customerId } : {}),
      };

      const facadeWhere: Prisma.FacadeWhereInput = {
        order: { is: baseOrderWhere },
        ...(q.data.coatingTypeId ? { coatingTypeId: q.data.coatingTypeId } : {}),
        ...(q.data.millingLabel?.trim() ? { millingLabel: q.data.millingLabel.trim() } : {}),
        ...(q.data.color?.trim() ? { color: q.data.color.trim() } : {}),
        ...(q.data.handle === "with" ? { handleLabel: { not: null } } : {}),
        ...(q.data.handle === "without" ? { handleLabel: null } : {}),
      };

      const [facades, filterFacades] = await Promise.all([
        app.prisma.facade.findMany({
          where: facadeWhere,
          include: {
            coatingType: true,
            order: { include: { customer: true } },
          },
          orderBy: { sortIndex: "asc" },
        }),
        app.prisma.facade.findMany({
          where: { order: { is: baseOrderWhere } },
          include: { coatingType: true },
        }),
      ]);

      const orderMap = new Map<string, (typeof facades)[number]["order"]>();
      for (const facade of facades) {
        orderMap.set(facade.order.id, facade.order);
      }
      const orders = [...orderMap.values()].sort(
        (a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
      );

      const facadeAreaTotal = facades.reduce((sum, facade) => sum + facadeAreaM2(facade), 0);
      const totalCost = orders.reduce((sum, order) => sum + (order.totalCost ?? 0), 0);

      const coatingMap = new Map<string, { id: string; name: string }>();
      const millingLabels = new Set<string>();
      const colors = new Set<string>();
      for (const facade of filterFacades) {
        coatingMap.set(facade.coatingType.id, { id: facade.coatingType.id, name: facade.coatingType.name });
        if (facade.millingLabel.trim()) millingLabels.add(facade.millingLabel);
        if (facade.color.trim()) colors.add(facade.color);
      }

      return {
        totals: {
          ordersCount: orders.length,
          facadeCount: facades.reduce((sum, facade) => sum + (facade.quantity || 1), 0),
          facadeAreaTotal,
          totalCost,
        },
        filters: {
          coatings: [...coatingMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ru")),
          millingLabels: [...millingLabels].sort((a, b) => a.localeCompare(b, "ru")),
          colors: [...colors].sort((a, b) => a.localeCompare(b, "ru")),
        },
        orders: orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          orderNumberFormatted: formatOrderNumber(order.orderNumber),
          completedAt: order.completedAt?.toISOString() ?? null,
          customer: { id: order.customer.id, name: order.customer.name },
          facadeCount: order.facadeCount,
          facadeAreaTotal: order.facadeAreaTotal,
          totalCost: order.totalCost,
        })),
        facades: facades.map((facade) => ({
          id: facade.id,
          orderId: facade.orderId,
          orderNumber: facade.order.orderNumber,
          orderNumberFormatted: formatOrderNumber(facade.order.orderNumber),
          completedAt: facade.order.completedAt?.toISOString() ?? null,
          customer: { id: facade.order.customer.id, name: facade.order.customer.name },
          coatingType: { id: facade.coatingType.id, name: facade.coatingType.name },
          millingLabel: facade.millingLabel,
          handleLabel: facade.handleLabel,
          color: facade.color,
          widthMm: facade.widthMm,
          heightMm: facade.heightMm,
          quantity: facade.quantity,
          thicknessMm: facade.thicknessMm,
          areaM2: facadeAreaM2(facade),
        })),
      };
    },
  );
};
