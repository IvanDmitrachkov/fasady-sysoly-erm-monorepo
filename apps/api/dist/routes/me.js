export const meRoutes = async (app) => {
    app.get("/me", async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        const payload = request.user;
        const user = await app.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, role: true, customerId: true, createdAt: true },
        });
        if (!user) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        return { user };
    });
};
//# sourceMappingURL=me.js.map