import { Role } from "@prisma/client";
import { z } from "zod";
import { authPayload, authUserId, requireJwt, requireRoles } from "../auth/preHandlers.js";
import { writeAudit } from "../lib/audit.js";
import { formatOrderNumber } from "../lib/order-number.js";
const facadeItem = z.object({
    sortIndex: z.number().int().optional(),
    milling: z.string(),
    coating: z.string(),
    color: z.string(),
    dimensionsMm: z.string().min(1),
    thicknessMm: z.number(),
    integratedHandle: z.boolean().optional(),
    edgeRadius: z.number().nullable().optional(),
    optionsExtra: z.string().nullable().optional(),
    basePrice: z.number(),
});
const orderInclude = {
    customer: true,
    currentStage: true,
    facades: { orderBy: { sortIndex: "asc" } },
};
const createOrderBody = z.object({
    customerId: z.string().min(1),
    deadlineAt: z.string().datetime().optional().nullable(),
    comment: z.string().optional().nullable(),
    overridePercent: z.number().optional().nullable(),
    overridePrice: z.number().optional().nullable(),
    totalPrice: z.number().optional().nullable(),
    facades: z.array(facadeItem).min(1, "Нужен хотя бы один фасад"),
});
const patchOrderBody = z.object({
    customerId: z.string().min(1).optional(),
    deadlineAt: z.string().datetime().optional().nullable(),
    comment: z.string().optional().nullable(),
    overridePercent: z.number().optional().nullable(),
    overridePrice: z.number().optional().nullable(),
    totalPrice: z.number().optional().nullable(),
    facades: z.array(facadeItem).min(1).optional(),
});
const moveBody = z.object({ stageId: z.string().min(1) });
async function fetchOrder(prisma, id) {
    return prisma.order.findUnique({
        where: { id },
        include: orderInclude,
    });
}
function serializeFacade(f) {
    return {
        id: f.id,
        sortIndex: f.sortIndex,
        milling: f.milling,
        coating: f.coating,
        color: f.color,
        dimensionsMm: f.dimensionsMm,
        thicknessMm: f.thicknessMm,
        integratedHandle: f.integratedHandle,
        edgeRadius: f.edgeRadius,
        optionsExtra: f.optionsExtra,
        basePrice: f.basePrice,
    };
}
function serializeOrder(order) {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        orderNumberFormatted: formatOrderNumber(order.orderNumber),
        createdAt: order.createdAt.toISOString(),
        deadlineAt: order.deadlineAt?.toISOString() ?? null,
        comment: order.comment,
        overridePercent: order.overridePercent,
        overridePrice: order.overridePrice,
        totalPrice: order.totalPrice,
        customer: order.customer,
        currentStage: order.currentStage,
        facades: order.facades.map(serializeFacade),
    };
}
function mapFacadeCreate(f, index) {
    return {
        sortIndex: f.sortIndex ?? index,
        milling: f.milling,
        coating: f.coating,
        color: f.color,
        dimensionsMm: f.dimensionsMm,
        thicknessMm: f.thicknessMm,
        integratedHandle: f.integratedHandle ?? false,
        edgeRadius: f.edgeRadius ?? null,
        optionsExtra: f.optionsExtra ?? null,
        basePrice: f.basePrice,
    };
}
export const ordersRoutes = async (app) => {
    app.addHook("preHandler", requireJwt);
    app.get("/orders", async (request, reply) => {
        const p = authPayload(request);
        if (p.role === Role.CUSTOMER && !p.customerId) {
            return reply.code(403).send({ error: "Нет привязки к заказчику" });
        }
        const orders = await app.prisma.order.findMany({
            where: p.role === Role.CUSTOMER ? { customerId: p.customerId } : {},
            include: orderInclude,
            orderBy: { orderNumber: "desc" },
        });
        return { orders: orders.map((o) => serializeOrder(o)) };
    });
    app.get("/orders/:id", async (request, reply) => {
        const { id } = request.params;
        const order = await fetchOrder(app.prisma, id);
        if (!order) {
            return reply.code(404).send({ error: "Заказ не найден" });
        }
        const p = authPayload(request);
        if (p.role === Role.CUSTOMER && order.customerId !== p.customerId) {
            return reply.code(403).send({ error: "Forbidden" });
        }
        return { order: serializeOrder(order) };
    });
    app.post("/orders", { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] }, async (request, reply) => {
        const parsed = createOrderBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        const newStage = (await app.prisma.stage.findUnique({ where: { slug: "new" } })) ??
            (await app.prisma.stage.findFirst({ orderBy: { sortOrder: "asc" } }));
        if (!newStage) {
            return reply.code(500).send({ error: "Нет ни одного этапа в базе" });
        }
        const customer = await app.prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
        if (!customer) {
            return reply.code(400).send({ error: "Заказчик не найден" });
        }
        const maxAgg = await app.prisma.order.aggregate({ _max: { orderNumber: true } });
        const orderNumber = (maxAgg._max.orderNumber ?? 0) + 1;
        const order = await app.prisma.order.create({
            data: {
                orderNumber,
                customerId: parsed.data.customerId,
                currentStageId: newStage.id,
                deadlineAt: parsed.data.deadlineAt ? new Date(parsed.data.deadlineAt) : null,
                comment: parsed.data.comment ?? null,
                overridePercent: parsed.data.overridePercent ?? null,
                overridePrice: parsed.data.overridePrice ?? null,
                totalPrice: parsed.data.totalPrice ?? null,
                facades: {
                    create: parsed.data.facades.map(mapFacadeCreate),
                },
            },
            include: orderInclude,
        });
        const uid = authUserId(request);
        await writeAudit(app.prisma, uid, "order.create", `Создан заказ №${formatOrderNumber(order.orderNumber)} для «${customer.name}» (${order.facades.length} поз.)`, "Order", order.id);
        return reply.code(201).send({ order: serializeOrder(order) });
    });
    app.patch("/orders/:id", { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] }, async (request, reply) => {
        const { id } = request.params;
        const parsed = patchOrderBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        const existing = await fetchOrder(app.prisma, id);
        if (!existing) {
            return reply.code(404).send({ error: "Заказ не найден" });
        }
        if (parsed.data.customerId) {
            const c = await app.prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
            if (!c) {
                return reply.code(400).send({ error: "Заказчик не найден" });
            }
        }
        const data = {};
        if (parsed.data.customerId !== undefined)
            data.customerId = parsed.data.customerId;
        if (parsed.data.deadlineAt !== undefined) {
            data.deadlineAt = parsed.data.deadlineAt ? new Date(parsed.data.deadlineAt) : null;
        }
        if (parsed.data.comment !== undefined)
            data.comment = parsed.data.comment;
        if (parsed.data.overridePercent !== undefined)
            data.overridePercent = parsed.data.overridePercent;
        if (parsed.data.overridePrice !== undefined)
            data.overridePrice = parsed.data.overridePrice;
        if (parsed.data.totalPrice !== undefined)
            data.totalPrice = parsed.data.totalPrice;
        const order = parsed.data.facades !== undefined
            ? await app.prisma.$transaction(async (tx) => {
                await tx.facade.deleteMany({ where: { orderId: id } });
                return tx.order.update({
                    where: { id },
                    data: {
                        ...data,
                        facades: { create: parsed.data.facades.map(mapFacadeCreate) },
                    },
                    include: orderInclude,
                });
            })
            : await app.prisma.order.update({
                where: { id },
                data,
                include: orderInclude,
            });
        const uid = authUserId(request);
        const auditExtra = parsed.data.facades !== undefined
            ? ` (${parsed.data.facades.length} поз., сумма ${parsed.data.totalPrice ?? "—"})`
            : "";
        await writeAudit(app.prisma, uid, "order.update", `Обновлён заказ №${formatOrderNumber(order.orderNumber)}${auditExtra}`, "Order", order.id);
        return { order: serializeOrder(order) };
    });
    app.post("/orders/:id/move", { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] }, async (request, reply) => {
        const { id } = request.params;
        const parsed = moveBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        const order = await fetchOrder(app.prisma, id);
        if (!order) {
            return reply.code(404).send({ error: "Заказ не найден" });
        }
        const stage = await app.prisma.stage.findUnique({ where: { id: parsed.data.stageId } });
        if (!stage) {
            return reply.code(400).send({ error: "Этап не найден" });
        }
        const fromName = order.currentStage.name;
        const updated = await app.prisma.order.update({
            where: { id },
            data: { currentStageId: stage.id },
            include: orderInclude,
        });
        const uid = authUserId(request);
        await writeAudit(app.prisma, uid, "order.move", `Заказ №${formatOrderNumber(updated.orderNumber)}: «${fromName}» → «${stage.name}»`, "Order", updated.id);
        return { order: serializeOrder(updated) };
    });
};
//# sourceMappingURL=orders.js.map