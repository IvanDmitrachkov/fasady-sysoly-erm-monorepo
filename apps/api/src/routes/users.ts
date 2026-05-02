import { Role } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authUserId, requireJwt, requireRoles } from "../auth/preHandlers.js";
import { writeAudit } from "../lib/audit.js";

const roleEnum = z.enum([Role.ADMIN, Role.WORKER, Role.CUSTOMER]);

const createUserBody = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Пароль не короче 8 символов"),
    role: roleEnum,
    customerId: z.string().min(1).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === Role.CUSTOMER && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для роли «Заказчик» укажите организацию",
        path: ["customerId"],
      });
    }
    if (data.role !== Role.CUSTOMER && data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Организация только для роли «Заказчик»",
        path: ["customerId"],
      });
    }
  });

const patchUserBody = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: roleEnum.optional(),
  customerId: z.string().min(1).nullable().optional(),
});

function serializeUser(u: {
  id: string;
  email: string;
  role: Role;
  customerId: string | null;
  customer: { id: string; name: string } | null;
}) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    customerId: u.customerId,
    customer: u.customer ? { id: u.customer.id, name: u.customer.name } : null,
  };
}

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);
  app.addHook("preHandler", requireRoles(Role.ADMIN));

  app.get("/users", async () => {
    const users = await app.prisma.user.findMany({
      include: { customer: true },
      orderBy: { email: "asc" },
    });
    return { users: users.map((u) => serializeUser(u)) };
  });

  app.post("/users", async (request, reply) => {
    const parsed = createUserBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
    }

    const customerId =
      parsed.data.role === Role.CUSTOMER ? (parsed.data.customerId as string) : null;
    if (parsed.data.role === Role.CUSTOMER && customerId) {
      const c = await app.prisma.customer.findUnique({ where: { id: customerId } });
      if (!c) {
        return reply.code(400).send({ error: "Организация не найдена" });
      }
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    try {
      const user = await app.prisma.user.create({
        data: {
          email: parsed.data.email.toLowerCase().trim(),
          passwordHash,
          role: parsed.data.role,
          customerId,
        },
        include: { customer: true },
      });
      await writeAudit(
        app.prisma,
        authUserId(request),
        "user.create",
        `Создан пользователь ${user.email} (${user.role})`,
        "User",
        user.id,
      );
      return reply.code(201).send({ user: serializeUser(user) });
    } catch (e: unknown) {
      const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : "";
      if (code === "P2002") {
        return reply.code(409).send({ error: "Пользователь с таким email уже есть" });
      }
      throw e;
    }
  });

  app.patch("/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = patchUserBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
    }

    const existing = await app.prisma.user.findUnique({ where: { id }, include: { customer: true } });
    if (!existing) {
      return reply.code(404).send({ error: "Пользователь не найден" });
    }

    let nextRole = existing.role;
    let nextCustomerId = existing.customerId;
    if (parsed.data.role !== undefined) {
      nextRole = parsed.data.role;
    }
    if (parsed.data.customerId !== undefined) {
      nextCustomerId = parsed.data.customerId;
    }
    if (parsed.data.role !== undefined && nextRole !== Role.CUSTOMER) {
      nextCustomerId = null;
    }

    if (nextRole === Role.CUSTOMER && !nextCustomerId) {
      return reply.code(400).send({ error: "У заказчика должна быть выбрана организация" });
    }
    if (nextRole !== Role.CUSTOMER && nextCustomerId) {
      return reply.code(400).send({ error: "Организация допустима только для роли «Заказчик»" });
    }
    if (nextRole === Role.CUSTOMER && nextCustomerId) {
      const c = await app.prisma.customer.findUnique({ where: { id: nextCustomerId } });
      if (!c) {
        return reply.code(400).send({ error: "Организация не найдена" });
      }
    }

    if (existing.role === Role.ADMIN && nextRole !== Role.ADMIN) {
      const adminCount = await app.prisma.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        return reply.code(400).send({ error: "Нельзя снять роль администратора с последнего админа" });
      }
    }

    const data: {
      email?: string;
      passwordHash?: string;
      role?: Role;
      customerId?: string | null;
    } = {};
    if (parsed.data.email !== undefined) {
      data.email = parsed.data.email.toLowerCase().trim();
    }
    if (parsed.data.password !== undefined) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }
    if (parsed.data.role !== undefined) {
      data.role = nextRole;
      data.customerId = nextCustomerId;
    } else if (parsed.data.customerId !== undefined) {
      data.customerId = nextCustomerId;
    }

    try {
      const user = await app.prisma.user.update({
        where: { id },
        data,
        include: { customer: true },
      });
      await writeAudit(
        app.prisma,
        authUserId(request),
        "user.update",
        `Изменён пользователь ${user.email}`,
        "User",
        user.id,
      );
      return { user: serializeUser(user) };
    } catch (e: unknown) {
      const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : "";
      if (code === "P2002") {
        return reply.code(409).send({ error: "Пользователь с таким email уже есть" });
      }
      throw e;
    }
  });

  app.delete("/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (id === authUserId(request)) {
      return reply.code(400).send({ error: "Нельзя удалить свою учётную запись" });
    }

    const existing = await app.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: "Пользователь не найден" });
    }
    if (existing.role === Role.ADMIN) {
      const adminCount = await app.prisma.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        return reply.code(400).send({ error: "Нельзя удалить последнего администратора" });
      }
    }

    await app.prisma.user.delete({ where: { id } });
    await writeAudit(
      app.prisma,
      authUserId(request),
      "user.delete",
      `Удалён пользователь ${existing.email}`,
      "User",
      id,
    );
    return reply.code(204).send();
  });
};
