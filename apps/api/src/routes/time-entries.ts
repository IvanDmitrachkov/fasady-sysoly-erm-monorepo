import { Role } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync } from "fastify";
import ExcelJS from "exceljs";
import { z } from "zod";
import { authPayload, authUserId, requireJwt, requireRoles } from "../auth/preHandlers.js";
import { writeAudit } from "../lib/audit.js";
import { formatOrderNumber } from "../lib/order-number.js";

const createBody = z.object({
  stageId: z.string().min(1),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  minutes: z.number().int().positive().optional(),
  comment: z.string().optional().nullable(),
  workedAt: z.string().datetime().optional(),
});

const patchBody = z
  .object({
    stageId: z.string().min(1).optional(),
    startedAt: z.string().datetime().optional(),
    endedAt: z.string().datetime().optional(),
    minutes: z.number().int().positive().optional(),
    comment: z.string().optional().nullable(),
    workedAt: z.string().datetime().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Нет полей для обновления" });

const reportQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  userId: z.string().uuid().optional(),
});

const NARYAD_TEMPLATE_FILE = "zakaz-naryad-emal.xlsx";

function resolveNaryadTemplatePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "../templates", NARYAD_TEMPLATE_FILE),
    path.join(process.cwd(), "templates", NARYAD_TEMPLATE_FILE),
    path.join(process.cwd(), "apps/api/templates", NARYAD_TEMPLATE_FILE),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `Не найден шаблон ${NARYAD_TEMPLATE_FILE}. Ожидается apps/api/templates/ или dist/templates/ после сборки.`,
  );
}

function formatDateRuShort(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function fileToken(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-.а-яА-Я]/g, "")
    .slice(0, 80);
}

function exportedAtToken(): string {
  return new Date().toISOString().slice(0, 10);
}

function serializeEntry(e: {
  id: string;
  minutes: number;
  comment: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  workedAt: Date;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    patronymic: string | null;
  };
  stage: { id: string; name: string };
  order: { id: string; orderNumber: number };
}) {
  const startedAt = e.startedAt ?? e.workedAt;
  const endedAt = e.endedAt;
  const durationMinutes =
    startedAt && endedAt
      ? Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))
      : e.minutes;
  return {
    id: e.id,
    minutes: durationMinutes,
    comment: e.comment,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt?.toISOString() ?? null,
    workedAt: e.workedAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    user: {
      id: e.user.id,
      email: e.user.email,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      patronymic: e.user.patronymic,
    },
    stage: { id: e.stage.id, name: e.stage.name },
    order: {
      id: e.order.id,
      orderNumber: formatOrderNumber(e.order.orderNumber),
    },
  };
}

function resolveTimeInput(data: {
  startedAt?: string;
  endedAt?: string;
  workedAt?: string;
  minutes?: number;
}): { startedAt: Date; endedAt: Date | null; workedAt: Date; minutes: number } | { error: string } {
  if (data.startedAt) {
    const startedAt = new Date(data.startedAt);
    const endedAt = data.endedAt ? new Date(data.endedAt) : null;
    if (!Number.isFinite(startedAt.getTime())) return { error: "Некорректная дата начала" };
    if (endedAt && !Number.isFinite(endedAt.getTime())) return { error: "Некорректная дата окончания" };
    if (endedAt && endedAt <= startedAt) return { error: "Дата окончания должна быть позже начала" };
    const minutes = endedAt ? Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)) : 1;
    return {
      startedAt,
      endedAt,
      workedAt: startedAt,
      minutes,
    };
  }
  if (data.workedAt) {
    const workedAt = new Date(data.workedAt);
    if (!Number.isFinite(workedAt.getTime())) return { error: "Некорректная дата работы" };
    return {
      startedAt: workedAt,
      endedAt: workedAt,
      workedAt,
      minutes: data.minutes ?? 1,
    };
  }
  return { error: "Укажите дату начала и окончания" };
}

function durationMinutes(e: { startedAt: Date | null; endedAt: Date | null; workedAt: Date; minutes: number }): number {
  const startedAt = e.startedAt ?? e.workedAt;
  if (e.endedAt && e.endedAt > startedAt) {
    return Math.max(1, Math.round((e.endedAt.getTime() - startedAt.getTime()) / 60000));
  }
  return e.minutes;
}

const timeEntryInclude = { user: true, stage: true } as const;
const timeEntryReportInclude = { user: true, stage: true, order: true } as const;

export const timeEntriesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get(
    "/time-entries/report",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const p = authPayload(request);
      const q = reportQuery.safeParse(request.query);
      if (!q.success) {
        return reply.code(400).send({ error: "Некорректные параметры", details: q.error.flatten() });
      }

      let targetUserId = authUserId(request);
      if (p.role === Role.ADMIN) {
        if (!q.data.userId) {
          return reply.code(400).send({ error: "Укажите сотрудника" });
        }
        const u = await app.prisma.user.findUnique({ where: { id: q.data.userId } });
        if (!u) {
          return reply.code(404).send({ error: "Пользователь не найден" });
        }
        targetUserId = q.data.userId;
      }

      const from = new Date(q.data.from);
      const to = new Date(q.data.to);
      if (from > to) {
        return reply.code(400).send({ error: "Начало периода позже конца" });
      }

      const entries = await app.prisma.timeEntry.findMany({
        where: {
          userId: targetUserId,
          OR: [{ startedAt: { gte: from, lte: to } }, { workedAt: { gte: from, lte: to } }],
        },
        include: timeEntryReportInclude,
        orderBy: [{ startedAt: "desc" }, { workedAt: "desc" }],
      });

      const totalMinutes = entries.reduce((acc, e) => acc + durationMinutes(e), 0);

      return {
        entries: entries.map((e) => serializeEntry(e)),
        totalMinutes,
      };
    },
  );

  app.get(
    "/time-entries/report.xlsx",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const p = authPayload(request);
      const q = reportQuery.safeParse(request.query);
      if (!q.success) {
        return reply.code(400).send({ error: "Некорректные параметры", details: q.error.flatten() });
      }
      let targetUserId = authUserId(request);
      if (p.role === Role.ADMIN) {
        if (!q.data.userId) {
          return reply.code(400).send({ error: "Укажите сотрудника" });
        }
        targetUserId = q.data.userId;
      }
      const from = new Date(q.data.from);
      const to = new Date(q.data.to);
      const user = await app.prisma.user.findUnique({ where: { id: targetUserId } });
      if (!user) return reply.code(404).send({ error: "Пользователь не найден" });

      const entries = await app.prisma.timeEntry.findMany({
        where: {
          userId: targetUserId,
          OR: [{ startedAt: { gte: from, lte: to } }, { workedAt: { gte: from, lte: to } }],
        },
        include: timeEntryReportInclude,
        orderBy: [{ startedAt: "asc" }, { workedAt: "asc" }],
      });

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Табель");
      const displayName = [user.lastName, user.firstName, user.patronymic].filter(Boolean).join(" ").trim() || user.email;
      ws.getCell("A1").value = "Табель работ";
      ws.getCell("A2").value = `Сотрудник: ${displayName}`;
      ws.getCell("A3").value = `Период: ${from.toISOString().slice(0, 10)} — ${to.toISOString().slice(0, 10)}`;
      ws.getRow(5).values = ["#", "Заказ", "Этап", "Начал", "Закончил", "Минут", "Комментарий"];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]!;
        const startedAt = e.startedAt ?? e.workedAt;
        const endedAt = e.endedAt;
        ws.addRow([
          i + 1,
          formatOrderNumber(e.order.orderNumber),
          e.stage.name,
          startedAt.toISOString().slice(0, 16).replace("T", " "),
          endedAt ? endedAt.toISOString().slice(0, 16).replace("T", " ") : "—",
          durationMinutes(e),
          e.comment ?? "",
        ]);
      }
      ws.columns = [
        { width: 6 },
        { width: 14 },
        { width: 26 },
        { width: 20 },
        { width: 20 },
        { width: 10 },
        { width: 48 },
      ];
      const header = ws.getRow(5);
      header.font = { bold: true };

      const buf = await wb.xlsx.writeBuffer();
      const userToken = fileToken(displayName || targetUserId);
      const fromToken = from.toISOString().slice(0, 10);
      const toToken = to.toISOString().slice(0, 10);
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header(
          "Content-Disposition",
          `attachment; filename="tabel_${userToken}_${fromToken}_${toToken}_ot_${exportedAtToken()}.xlsx"`,
        )
        .send(Buffer.from(buf));
    },
  );

  app.patch(
    "/time-entries/:id",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = patchBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }

      const existing = await app.prisma.timeEntry.findUnique({
        where: { id },
        include: { order: true, stage: true },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Запись не найдена" });
      }

      const uid = authUserId(request);
      const p = authPayload(request);
      if (p.role !== Role.ADMIN && existing.userId !== uid) {
        return reply.code(403).send({ error: "Нельзя редактировать чужую запись" });
      }

      if (parsed.data.stageId) {
        const stage = await app.prisma.stage.findUnique({ where: { id: parsed.data.stageId } });
        if (!stage) {
          return reply.code(400).send({ error: "Этап не найден" });
        }
      }
      const hasTimeFields =
        parsed.data.startedAt !== undefined ||
        parsed.data.endedAt !== undefined ||
        parsed.data.workedAt !== undefined;
      const resolved = hasTimeFields
        ? resolveTimeInput({
            startedAt: parsed.data.startedAt ?? existing.startedAt?.toISOString() ?? existing.workedAt.toISOString(),
            endedAt: parsed.data.endedAt ?? existing.endedAt?.toISOString(),
            workedAt: parsed.data.workedAt ?? existing.workedAt.toISOString(),
            minutes: parsed.data.minutes ?? existing.minutes,
          })
        : { error: "skip" as const };
      if ("error" in resolved && resolved.error !== "skip") {
        return reply.code(400).send({ error: resolved.error });
      }

      const updated = await app.prisma.timeEntry.update({
        where: { id },
        data: {
          ...(parsed.data.stageId !== undefined ? { stageId: parsed.data.stageId } : {}),
          ...(parsed.data.minutes !== undefined ? { minutes: parsed.data.minutes } : {}),
          ...(parsed.data.comment !== undefined ? { comment: parsed.data.comment } : {}),
          ...("error" in resolved
            ? {}
            : {
                startedAt: resolved.startedAt,
                endedAt: resolved.endedAt,
                workedAt: resolved.workedAt,
                minutes: resolved.minutes,
              }),
        },
        include: timeEntryReportInclude,
      });

      await writeAudit(
        app.prisma,
        uid,
        "time.update",
        `Изменение учёта времени: ${updated.minutes} мин, этап «${updated.stage.name}», заказ №${formatOrderNumber(updated.order.orderNumber)}`,
        "TimeEntry",
        updated.id,
      );

      return { entry: serializeEntry(updated) };
    },
  );

  app.get("/orders/:orderId/time-entries", async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
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
      orderBy: [{ startedAt: "desc" }, { workedAt: "desc" }],
    });

    return {
      entries: entries.map((e) =>
        serializeEntry({
          ...e,
          order: { id: order.id, orderNumber: order.orderNumber },
        }),
      ),
    };
  });

  app.get(
    "/orders/:orderId/time-entries.xlsx",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const order = await app.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          facades: { orderBy: { sortIndex: "asc" } },
          materialEntries: { orderBy: { usedAt: "asc" } },
        },
      });
      if (!order) {
        return reply.code(404).send({ error: "Заказ не найден" });
      }
      const entries = await app.prisma.timeEntry.findMany({
        where: { orderId },
        include: timeEntryReportInclude,
        orderBy: [{ startedAt: "asc" }, { workedAt: "asc" }],
      });
      const stages = await app.prisma.stage.findMany({
        orderBy: { sortOrder: "asc" },
      });

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(resolveNaryadTemplatePath());
      const ws = wb.worksheets[0];
      if (!ws) {
        return reply.code(500).send({ error: "В шаблоне наряда нет листов" });
      }

      ws.getCell("C2").value = formatOrderNumber(order.orderNumber);
      ws.getCell("G2").value = order.customer.name;
      ws.getCell("C3").value = formatDateRuShort(order.createdAt);
      ws.getCell("G3").value = order.customer.phone ?? "";
      ws.getCell("C4").value = formatDateRuShort(order.deadlineAt);
      ws.getCell("G4").value = order.deliveryAddress?.trim() ?? "";
      ws.getCell("C5").value = order.workType?.trim() ?? "";

      for (let i = 0; i < Math.min(order.facades.length, 24); i++) {
        const f = order.facades[i]!;
        const r = 8 + i;
        ws.getCell(`B${r}`).value = f.heightMm;
        ws.getCell(`C${r}`).value = f.widthMm;
        ws.getCell(`D${r}`).value = f.quantity ?? 1;
        ws.getCell(`E${r}`).value = f.thicknessMm;
        ws.getCell(`F${r}`).value = f.edgeRadius ?? "";
        ws.getCell(`G${r}`).value = f.handleLabel ?? "";
        ws.getCell(`H${r}`).value = f.millingLabel ?? "";
        ws.getCell(`I${r}`).value = f.color ?? "";
      }

      const stageRows = [36, 37, 38, 39, 40, 41];
      const visibleStages = stages.slice(0, stageRows.length);
      const stageRowById = new Map<string, number>();
      for (let i = 0; i < stageRows.length; i++) {
        const row = stageRows[i]!;
        const stage = visibleStages[i];
        ws.getCell(`A${row}`).value = stage?.name ?? "";
        ws.getCell(`C${row}`).value = "";
        ws.getCell(`F${row}`).value = "";
        ws.getCell(`H${row}`).value = "";
        if (stage) stageRowById.set(stage.id, row);
      }
      for (const e of entries) {
        const row = stageRowById.get(e.stageId) ?? stageRows[stageRows.length - 1]!;
        if (!row) continue;
        const startedAt = e.startedAt ?? e.workedAt;
        const endedAt = e.endedAt;
        const displayName = [e.user.lastName, e.user.firstName, e.user.patronymic].filter(Boolean).join(" ").trim() || e.user.email;
        ws.getCell(`C${row}`).value = displayName;
        ws.getCell(`F${row}`).value = startedAt.toISOString().slice(0, 16).replace("T", " ");
        ws.getCell(`H${row}`).value = endedAt ? endedAt.toISOString().slice(0, 16).replace("T", " ") : "";
      }

      const materialRows = new Map<string, number>([
        ["круг", 44],
        ["полос", 45],
        ["губк", 46],
        ["ситеч", 47],
        ["грунт перв", 48],
        ["грунт втор", 49],
        ["краск", 50],
        ["лак", 51],
        ["проч", 52],
      ]);
      for (const r of materialRows.values()) {
        ws.getCell(`D${r}`).value = "";
        ws.getCell(`H${r}`).value = "";
      }
      const otherMaterials: string[] = [];
      let otherQty = 0;
      for (const m of order.materialEntries) {
        const key = m.name.trim().toLowerCase();
        const found = [...materialRows.entries()].find(([k]) => key.includes(k));
        if (found) {
          const row = found[1];
          ws.getCell(`D${row}`).value = m.kind ?? "";
          const prev = Number(ws.getCell(`H${row}`).value ?? 0) || 0;
          ws.getCell(`H${row}`).value = prev + m.quantity;
        } else {
          otherMaterials.push(m.name);
          otherQty += m.quantity;
        }
      }
      if (otherMaterials.length > 0) {
        ws.getCell("D52").value = otherMaterials.join(", ");
        ws.getCell("H52").value = otherQty;
      }

      const buf = await wb.xlsx.writeBuffer();
      const orderToken = fileToken(formatOrderNumber(order.orderNumber));
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="naryad_zakaza_${orderToken}_ot_${exportedAtToken()}.xlsx"`)
        .send(Buffer.from(buf));
    },
  );

  app.post(
    "/orders/:orderId/time-entries",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
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
      const resolved = resolveTimeInput(parsed.data);
      if ("error" in resolved) {
        return reply.code(400).send({ error: resolved.error });
      }

      const uid = authUserId(request);
      const entry = await app.prisma.timeEntry.create({
        data: {
          orderId,
          userId: uid,
          stageId: stage.id,
          minutes: resolved.minutes,
          comment: parsed.data.comment ?? null,
          workedAt: resolved.workedAt,
          startedAt: resolved.startedAt,
          endedAt: resolved.endedAt,
        },
        include: timeEntryReportInclude,
      });

      await writeAudit(
        app.prisma,
        uid,
        "time.create",
        `Учёт времени: ${entry.minutes} мин, этап «${entry.stage.name}», заказ №${formatOrderNumber(order.orderNumber)}`,
        "TimeEntry",
        entry.id,
      );

      return reply.code(201).send({ entry: serializeEntry(entry) });
    },
  );
};
