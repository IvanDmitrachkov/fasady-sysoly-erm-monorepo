import { Role } from "@prisma/client";
import { z } from "zod";
import { requireJwt, requireRoles } from "../auth/preHandlers.js";
const querySchema = z.object({
    take: z.coerce.number().int().min(1).max(200).optional().default(50),
    skip: z.coerce.number().int().min(0).optional().default(0),
});
export const auditRoutes = async (app) => {
    app.addHook("preHandler", requireJwt);
    app.get("/audit", { preHandler: [requireRoles(Role.ADMIN)] }, async (request, reply) => {
        const parsed = querySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Некорректный query", details: parsed.error.flatten() });
        }
        const { take, skip } = parsed.data;
        const [items, total] = await Promise.all([
            app.prisma.auditLog.findMany({
                take,
                skip,
                orderBy: { createdAt: "desc" },
                include: { user: { select: { id: true, email: true, role: true } } },
            }),
            app.prisma.auditLog.count(),
        ]);
        return { items, total, take, skip };
    });
};
//# sourceMappingURL=audit.js.map