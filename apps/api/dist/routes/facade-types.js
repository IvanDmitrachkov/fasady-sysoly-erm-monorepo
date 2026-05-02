import { Role } from "@prisma/client";
import { z } from "zod";
import { authPayload, authUserId, requireJwt, requireRoles } from "../auth/preHandlers.js";
import { writeAudit } from "../lib/audit.js";
const slugRegex = /^[a-z0-9-]+$/;
const createMillingBody = z.object({
    slug: z.string().min(1).regex(slugRegex),
    name: z.string().min(1),
    pricePerM2: z.number().finite(),
    sortOrder: z.number().int().optional(),
    active: z.boolean().optional(),
});
const patchMillingBody = createMillingBody.partial();
const createCoatingBody = z.object({
    slug: z.string().min(1).regex(slugRegex),
    name: z.string().min(1),
    pricePerM2: z.number().finite(),
    sortOrder: z.number().int().optional(),
    active: z.boolean().optional(),
});
const patchCoatingBody = createCoatingBody.partial();
const createHandleBody = z.object({
    slug: z.string().min(1).regex(slugRegex),
    name: z.string().min(1),
    pricePerMeter: z.number().finite(),
    sortOrder: z.number().int().optional(),
    active: z.boolean().optional(),
});
const patchHandleBody = createHandleBody.partial();
export const facadeTypesRoutes = async (app) => {
    app.addHook("preHandler", requireJwt);
    app.get("/milling-types", async (request) => {
        const p = authPayload(request);
        const where = p.role === Role.ADMIN ? {} : { active: true };
        const millingTypes = await app.prisma.millingType.findMany({
            where,
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
        return { millingTypes };
    });
    app.post("/milling-types", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const parsed = createMillingBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        const exists = await app.prisma.millingType.findUnique({ where: { slug: parsed.data.slug } });
        if (exists) {
            return reply.code(409).send({ error: "Такой slug уже есть" });
        }
        const row = await app.prisma.millingType.create({
            data: {
                slug: parsed.data.slug,
                name: parsed.data.name,
                pricePerM2: parsed.data.pricePerM2,
                sortOrder: parsed.data.sortOrder ?? 0,
                active: parsed.data.active ?? true,
            },
        });
        await writeAudit(app.prisma, authUserId(request), "millingType.create", `Тип фрезеровки «${row.name}»`, "MillingType", row.id);
        return reply.code(201).send({ millingType: row });
    });
    app.patch("/milling-types/:id", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const { id } = request.params;
        const parsed = patchMillingBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        const existing = await app.prisma.millingType.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: "Не найдено" });
        }
        if (parsed.data.slug && parsed.data.slug !== existing.slug) {
            const clash = await app.prisma.millingType.findUnique({ where: { slug: parsed.data.slug } });
            if (clash) {
                return reply.code(409).send({ error: "Такой slug уже есть" });
            }
        }
        const row = await app.prisma.millingType.update({
            where: { id },
            data: {
                ...(parsed.data.slug !== undefined && { slug: parsed.data.slug }),
                ...(parsed.data.name !== undefined && { name: parsed.data.name }),
                ...(parsed.data.pricePerM2 !== undefined && { pricePerM2: parsed.data.pricePerM2 }),
                ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
                ...(parsed.data.active !== undefined && { active: parsed.data.active }),
            },
        });
        await writeAudit(app.prisma, authUserId(request), "millingType.update", `Тип фрезеровки «${row.name}»`, "MillingType", row.id);
        return { millingType: row };
    });
    app.delete("/milling-types/:id", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const { id } = request.params;
        const existing = await app.prisma.millingType.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: "Не найдено" });
        }
        const cnt = await app.prisma.facade.count({ where: { millingTypeId: id } });
        if (cnt > 0) {
            return reply.code(400).send({ error: `Нельзя удалить: используется в ${cnt} поз.` });
        }
        await app.prisma.millingType.delete({ where: { id } });
        await writeAudit(app.prisma, authUserId(request), "millingType.delete", `Удалён тип фрезеровки «${existing.name}»`, "MillingType", id);
        return reply.code(204).send();
    });
    app.get("/coating-types", async (request) => {
        const p = authPayload(request);
        const where = p.role === Role.ADMIN ? {} : { active: true };
        const coatingTypes = await app.prisma.coatingType.findMany({
            where,
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
        return { coatingTypes };
    });
    app.post("/coating-types", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const parsed = createCoatingBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        if (await app.prisma.coatingType.findUnique({ where: { slug: parsed.data.slug } })) {
            return reply.code(409).send({ error: "Такой slug уже есть" });
        }
        const row = await app.prisma.coatingType.create({
            data: {
                slug: parsed.data.slug,
                name: parsed.data.name,
                pricePerM2: parsed.data.pricePerM2,
                sortOrder: parsed.data.sortOrder ?? 0,
                active: parsed.data.active ?? true,
            },
        });
        await writeAudit(app.prisma, authUserId(request), "coatingType.create", `Тип покрытия «${row.name}»`, "CoatingType", row.id);
        return reply.code(201).send({ coatingType: row });
    });
    app.patch("/coating-types/:id", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const { id } = request.params;
        const parsed = patchCoatingBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        const existing = await app.prisma.coatingType.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: "Не найдено" });
        }
        if (parsed.data.slug && parsed.data.slug !== existing.slug) {
            if (await app.prisma.coatingType.findUnique({ where: { slug: parsed.data.slug } })) {
                return reply.code(409).send({ error: "Такой slug уже есть" });
            }
        }
        const row = await app.prisma.coatingType.update({
            where: { id },
            data: {
                ...(parsed.data.slug !== undefined && { slug: parsed.data.slug }),
                ...(parsed.data.name !== undefined && { name: parsed.data.name }),
                ...(parsed.data.pricePerM2 !== undefined && { pricePerM2: parsed.data.pricePerM2 }),
                ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
                ...(parsed.data.active !== undefined && { active: parsed.data.active }),
            },
        });
        await writeAudit(app.prisma, authUserId(request), "coatingType.update", `Тип покрытия «${row.name}»`, "CoatingType", row.id);
        return { coatingType: row };
    });
    app.delete("/coating-types/:id", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const { id } = request.params;
        const existing = await app.prisma.coatingType.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: "Не найдено" });
        }
        const cnt = await app.prisma.facade.count({ where: { coatingTypeId: id } });
        if (cnt > 0) {
            return reply.code(400).send({ error: `Нельзя удалить: используется в ${cnt} поз.` });
        }
        await app.prisma.coatingType.delete({ where: { id } });
        await writeAudit(app.prisma, authUserId(request), "coatingType.delete", `Удалён тип покрытия «${existing.name}»`, "CoatingType", id);
        return reply.code(204).send();
    });
    app.get("/handle-types", async (request) => {
        const p = authPayload(request);
        const where = p.role === Role.ADMIN ? {} : { active: true };
        const handleTypes = await app.prisma.handleType.findMany({
            where,
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
        return { handleTypes };
    });
    app.post("/handle-types", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const parsed = createHandleBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        if (await app.prisma.handleType.findUnique({ where: { slug: parsed.data.slug } })) {
            return reply.code(409).send({ error: "Такой slug уже есть" });
        }
        const row = await app.prisma.handleType.create({
            data: {
                slug: parsed.data.slug,
                name: parsed.data.name,
                pricePerMeter: parsed.data.pricePerMeter,
                sortOrder: parsed.data.sortOrder ?? 0,
                active: parsed.data.active ?? true,
            },
        });
        await writeAudit(app.prisma, authUserId(request), "handleType.create", `Тип ручки «${row.name}»`, "HandleType", row.id);
        return reply.code(201).send({ handleType: row });
    });
    app.patch("/handle-types/:id", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const { id } = request.params;
        const parsed = patchHandleBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
        }
        const existing = await app.prisma.handleType.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: "Не найдено" });
        }
        if (parsed.data.slug && parsed.data.slug !== existing.slug) {
            if (await app.prisma.handleType.findUnique({ where: { slug: parsed.data.slug } })) {
                return reply.code(409).send({ error: "Такой slug уже есть" });
            }
        }
        const row = await app.prisma.handleType.update({
            where: { id },
            data: {
                ...(parsed.data.slug !== undefined && { slug: parsed.data.slug }),
                ...(parsed.data.name !== undefined && { name: parsed.data.name }),
                ...(parsed.data.pricePerMeter !== undefined && { pricePerMeter: parsed.data.pricePerMeter }),
                ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
                ...(parsed.data.active !== undefined && { active: parsed.data.active }),
            },
        });
        await writeAudit(app.prisma, authUserId(request), "handleType.update", `Тип ручки «${row.name}»`, "HandleType", row.id);
        return { handleType: row };
    });
    app.delete("/handle-types/:id", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const { id } = request.params;
        const existing = await app.prisma.handleType.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: "Не найдено" });
        }
        const cnt = await app.prisma.facade.count({ where: { handleTypeId: id } });
        if (cnt > 0) {
            return reply.code(400).send({ error: `Нельзя удалить: используется в ${cnt} поз.` });
        }
        await app.prisma.handleType.delete({ where: { id } });
        await writeAudit(app.prisma, authUserId(request), "handleType.delete", `Удалён тип ручки «${existing.name}»`, "HandleType", id);
        return reply.code(204).send();
    });
};
//# sourceMappingURL=facade-types.js.map