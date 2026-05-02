import { Role } from "@prisma/client";
import { z } from "zod";
import { authUserId, requireJwt, requireRoles } from "../auth/preHandlers.js";
import { writeAudit } from "../lib/audit.js";
const createStageBody = z.object({
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    sortOrder: z.number().int(),
    isComplete: z.boolean().optional(),
});
const patchStageBody = z.object({
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
    name: z.string().min(1).optional(),
    sortOrder: z.number().int().optional(),
    isComplete: z.boolean().optional(),
});
export const stagesRoutes = async (app) => {
    app.addHook("preHandler", requireJwt);
    app.get("/stages", async () => {
        const stages = await app.prisma.stage.findMany({ orderBy: { sortOrder: "asc" } });
        return { stages };
    });
    app.post("/stages", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const parsed = createStageBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        const exists = await app.prisma.stage.findUnique({ where: { slug: parsed.data.slug } });
        if (exists) {
            return reply.code(409).send({ error: "Этап с таким slug уже есть" });
        }
        const stage = await app.prisma.stage.create({
            data: {
                slug: parsed.data.slug,
                name: parsed.data.name,
                sortOrder: parsed.data.sortOrder,
                isComplete: parsed.data.isComplete ?? false,
            },
        });
        await writeAudit(app.prisma, authUserId(request), "stage.create", `Добавлен этап «${stage.name}» (${stage.slug})`, "Stage", stage.id);
        return reply.code(201).send({ stage });
    });
    app.patch("/stages/:id", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const { id } = request.params;
        const parsed = patchStageBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        const existing = await app.prisma.stage.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: "Этап не найден" });
        }
        if (parsed.data.slug && parsed.data.slug !== existing.slug) {
            const clash = await app.prisma.stage.findUnique({ where: { slug: parsed.data.slug } });
            if (clash) {
                return reply.code(409).send({ error: "Этап с таким slug уже есть" });
            }
        }
        const stage = await app.prisma.stage.update({
            where: { id },
            data: {
                ...(parsed.data.slug !== undefined && { slug: parsed.data.slug }),
                ...(parsed.data.name !== undefined && { name: parsed.data.name }),
                ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
                ...(parsed.data.isComplete !== undefined && { isComplete: parsed.data.isComplete }),
            },
        });
        await writeAudit(app.prisma, authUserId(request), "stage.update", `Изменён этап «${stage.name}»`, "Stage", stage.id);
        return { stage };
    });
    app.delete("/stages/:id", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const { id } = request.params;
        const existing = await app.prisma.stage.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: "Этап не найден" });
        }
        const count = await app.prisma.order.count({ where: { currentStageId: id } });
        if (count > 0) {
            return reply.code(400).send({ error: `Нельзя удалить: на этапе ${count} заказ(ов)` });
        }
        await app.prisma.stage.delete({ where: { id } });
        await writeAudit(app.prisma, authUserId(request), "stage.delete", `Удалён этап «${existing.name}»`, "Stage", id);
        return reply.code(204).send();
    });
};
//# sourceMappingURL=stages.js.map