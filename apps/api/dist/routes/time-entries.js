import { Role } from "@prisma/client";
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
const timeEntryInclude = { user: true, stage: true };
export const timeEntriesRoutes = async (app) => {
    app.addHook("preHandler", requireJwt);
    app.get("/orders/:orderId/time-entries", async (request, reply) => {
        const { orderId } = request.params;
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
                user: { id: e.user.id, email: e.user.email },
                stage: { id: e.stage.id, name: e.stage.name },
            })),
        };
    });
    app.post("/orders/:orderId/time-entries", { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] }, async (request, reply) => {
        const { orderId } = request.params;
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
        await writeAudit(app.prisma, uid, "time.create", `Учёт времени: ${entry.minutes} мин, этап «${entry.stage.name}», заказ №${formatOrderNumber(order.orderNumber)}`, "TimeEntry", entry.id);
        return reply.code(201).send({
            entry: {
                id: entry.id,
                minutes: entry.minutes,
                comment: entry.comment,
                workedAt: entry.workedAt.toISOString(),
                createdAt: entry.createdAt.toISOString(),
                user: { id: entry.user.id, email: entry.user.email },
                stage: { id: entry.stage.id, name: entry.stage.name },
            },
        });
    });
};
//# sourceMappingURL=time-entries.js.map