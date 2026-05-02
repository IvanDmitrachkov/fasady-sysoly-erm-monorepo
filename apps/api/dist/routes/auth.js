import { z } from "zod";
import bcrypt from "bcryptjs";
const loginBody = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
export const authRoutes = async (app) => {
    app.post("/auth/login", async (request, reply) => {
        const parsed = loginBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Invalid body", details: parsed.error.flatten() });
        }
        const { email, password } = parsed.data;
        const user = await app.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return reply.code(401).send({ error: "Invalid email or password" });
        }
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return reply.code(401).send({ error: "Invalid email or password" });
        }
        const token = await reply.jwtSign({ sub: user.id, role: user.role }, { sign: { expiresIn: "7d" } });
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                customerId: user.customerId,
            },
        };
    });
};
//# sourceMappingURL=auth.js.map