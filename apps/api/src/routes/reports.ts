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

function facadeAreaM2(f: { widthMm: number; heightMm: number; quantity?: number | null }): number {
  const quantity = f.quantity && f.quantity > 0 ? f.quantity : 1;
  return ((f.widthMm * f.heightMm) / 1_000_000) * quantity;
}

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

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
