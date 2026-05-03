import { Role } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { requireJwt, requireRoles } from "../auth/preHandlers.js";
import { computeCuttingPlan } from "../lib/cutting-layout.js";
import { cuttingPlanToPdfBuffer } from "../lib/cutting-pdf.js";
import { formatOrderNumber } from "../lib/order-number.js";

const orderInclude = {
  customer: true,
  currentStage: true,
  facades: { orderBy: { sortIndex: "asc" as const } },
} as const;

export const cuttingRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get(
    "/orders/:orderId/cutting",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const order = await app.prisma.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) {
        return reply.code(404).send({ error: "Заказ не найден" });
      }

      const plan = computeCuttingPlan({
        orderId: order.id,
        orderNumberFormatted: formatOrderNumber(order.orderNumber),
        facades: order.facades.map((f) => ({
          id: f.id,
          sortIndex: f.sortIndex,
          widthMm: f.widthMm,
          heightMm: f.heightMm,
          quantity: f.quantity,
          thicknessMm: f.thicknessMm,
        })),
      });

      return plan;
    },
  );

  app.get(
    "/orders/:orderId/cutting.pdf",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const order = await app.prisma.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) {
        return reply.code(404).send({ error: "Заказ не найден" });
      }

      const plan = computeCuttingPlan({
        orderId: order.id,
        orderNumberFormatted: formatOrderNumber(order.orderNumber),
        facades: order.facades.map((f) => ({
          id: f.id,
          sortIndex: f.sortIndex,
          widthMm: f.widthMm,
          heightMm: f.heightMm,
          quantity: f.quantity,
          thicknessMm: f.thicknessMm,
        })),
      });

      const buf = await cuttingPlanToPdfBuffer(plan);
      const safeNum = formatOrderNumber(order.orderNumber).replace(/\s/g, "_");
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="raskroy_${safeNum}.pdf"`)
        .send(buf);
    },
  );
};
