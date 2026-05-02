import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import { prismaPlugin } from "./plugins/prisma.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
export async function buildApp(env) {
    const app = Fastify({ logger: true });
    await app.register(cors, {
        origin: env.NODE_ENV === "development",
        credentials: true,
    });
    await app.register(fp(async (instance) => {
        await instance.register(jwt, {
            secret: env.JWT_SECRET,
            sign: { expiresIn: "7d" },
        });
    }, { name: "jwt" }));
    await app.register(prismaPlugin);
    await app.register(healthRoutes, { prefix: "/api" });
    await app.register(authRoutes, { prefix: "/api" });
    await app.register(meRoutes, { prefix: "/api" });
    // Раздача SPA под /admin после сборки: см. copy-web.mjs и включите @fastify/static
    // (пути Vite `base: '/admin/'` нужно согласовать с prefix — добавим в следующей итерации)
    return app;
}
//# sourceMappingURL=app.js.map