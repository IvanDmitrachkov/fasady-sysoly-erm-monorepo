import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";

const optionalName = z.union([z.string().max(120), z.null()]).optional();

const patchMeBody = z
  .object({
    email: z.string().email().optional(),
    firstName: optionalName,
    lastName: optionalName,
    patronymic: optionalName,
    currentPassword: z.string().optional(),
    password: z.string().min(8, "Пароль не короче 8 символов").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password && !data.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Введите текущий пароль",
        path: ["currentPassword"],
      });
    }
  });

function normName(val: string | null | undefined): string | null {
  if (val == null) return null;
  const t = val.trim();
  return t.length ? t : null;
}

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const payload = request.user as { sub: string; role: string; customerId: string | null };
    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        patronymic: true,
        role: true,
        customerId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    return { user };
  });

  app.patch("/me", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const parsed = patchMeBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
    }

    const payload = request.user as { sub: string };
    const existing = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, passwordHash: true },
    });
    if (!existing) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const data: {
      email?: string;
      firstName?: string | null;
      lastName?: string | null;
      patronymic?: string | null;
      passwordHash?: string;
    } = {};
    if (parsed.data.email !== undefined) {
      data.email = parsed.data.email.toLowerCase().trim();
    }
    if (parsed.data.firstName !== undefined) {
      data.firstName = normName(parsed.data.firstName);
    }
    if (parsed.data.lastName !== undefined) {
      data.lastName = normName(parsed.data.lastName);
    }
    if (parsed.data.patronymic !== undefined) {
      data.patronymic = normName(parsed.data.patronymic);
    }
    if (parsed.data.password !== undefined) {
      const passwordMatch = await bcrypt.compare(parsed.data.currentPassword ?? "", existing.passwordHash);
      if (!passwordMatch) {
        return reply.code(400).send({ error: "Текущий пароль указан неверно" });
      }
      data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }

    try {
      const user = await app.prisma.user.update({
        where: { id: existing.id },
        data,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          patronymic: true,
          role: true,
          customerId: true,
          createdAt: true,
        },
      });
      return { user };
    } catch (e: unknown) {
      const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : "";
      if (code === "P2002") {
        return reply.code(409).send({ error: "Пользователь с таким email уже есть" });
      }
      throw e;
    }
  });
};
