import { Role } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { requireJwt, requireRoles } from "../auth/preHandlers.js";
import { buildOrderPrintXlsxBuffer, orderIncludeForPrint } from "../lib/order-print-xlsx.js";
import { formatOrderNumber } from "../lib/order-number.js";

export const orderPrintRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get(
    "/orders/:orderId/print.xlsx",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const order = await app.prisma.order.findUnique({
        where: { id: orderId },
        include: orderIncludeForPrint,
      });
      if (!order) {
        return reply.code(404).send({ error: "Заказ не найден" });
      }

      try {
        const buf = await buildOrderPrintXlsxBuffer(order);
        const safe = formatOrderNumber(order.orderNumber).replace(/\s/g, "_");
        const exportedAt = new Date().toISOString().slice(0, 10);
        return reply
          .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          .header("Content-Disposition", `attachment; filename="zakaz_${safe}_ot_${exportedAt}.xlsx"`)
          .send(buf);
      } catch (e) {
        request.log.error(e);
        const msg = e instanceof Error ? e.message : "Ошибка формирования файла";
        return reply.code(500).send({ error: msg });
      }
    },
  );
};
