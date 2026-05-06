import { OrderCommentType, Role, type Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authPayload, authUserId, requireJwt, requireRoles } from "../auth/preHandlers.js";
import { writeAudit } from "../lib/audit.js";
import { DEFAULT_ORDER_WORK_STATE_SLUG } from "../lib/default-order-work-states.js";
import { formatOrderNumber } from "../lib/order-number.js";

const NO_HANDLE_LABEL = "Нет";

const facadeItem = z
  .object({
    sortIndex: z.number().int().optional(),
    millingLabel: z.string(),
    coatingTypeId: z.string().min(1),
    handleLabel: z.string().nullable().optional(),
    handleLengthMm: z.number().positive().nullable().optional(),
    color: z.string(),
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    quantity: z.number().int().positive().optional(),
    thicknessMm: z.number(),
    edgeRadius: z.number().finite(),
    optionsExtra: z.string().nullable().optional(),
    basePrice: z.number().optional(),
  })
  .superRefine((row, ctx) => {
    const ml = row.millingLabel.trim();
    if (!ml) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите фрезеровку",
        path: ["millingLabel"],
      });
    }
  });

const orderInclude = {
  customer: true,
  currentStage: true,
  workState: true,
  facades: {
    orderBy: { sortIndex: "asc" as const },
    include: { coatingType: true },
  },
} as const;
type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const createOrderBody = z.object({
  customerId: z.string().min(1),
  deadlineAt: z.string().datetime().optional().nullable(),
  workType: z.string().optional().nullable(),
  deliveryAddress: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),

  // Новые поля цен
  facadeCount: z.number().int().optional(),
  facadePricePerM2: z.number().optional().nullable(),
  facadeAreaTotal: z.number().optional(),
  facadeCostTotal: z.number().optional().nullable(),
  millingPricePerM2: z.number().optional().nullable(),
  millingCostTotal: z.number().optional().nullable(),
  handleLengthTotalMm: z.number().optional().nullable(),
  handlePricePerMeter: z.number().optional().nullable(),
  handleCostTotal: z.number().optional().nullable(),
  otherServicesPrice: z.number().optional().nullable(),
  subtotal: z.number().optional().nullable(),
  discount: z.number().optional().nullable(),
  totalCost: z.number().optional().nullable(),
  advance: z.number().optional().nullable(),

  facades: z.array(facadeItem).min(1, "Нужен хотя бы один фасад"),
});

const patchOrderBody = z.object({
  customerId: z.string().min(1).optional(),
  deadlineAt: z.string().datetime().optional().nullable(),
  workType: z.string().optional().nullable(),
  deliveryAddress: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),

  // Новые поля цен
  facadeCount: z.number().int().optional(),
  facadePricePerM2: z.number().optional().nullable(),
  facadeAreaTotal: z.number().optional(),
  facadeCostTotal: z.number().optional().nullable(),
  millingPricePerM2: z.number().optional().nullable(),
  millingCostTotal: z.number().optional().nullable(),
  handleLengthTotalMm: z.number().optional().nullable(),
  handlePricePerMeter: z.number().optional().nullable(),
  handleCostTotal: z.number().optional().nullable(),
  otherServicesPrice: z.number().optional().nullable(),
  subtotal: z.number().optional().nullable(),
  discount: z.number().optional().nullable(),
  totalCost: z.number().optional().nullable(),
  advance: z.number().optional().nullable(),

  facades: z.array(facadeItem).min(1).optional(),
});

const moveBody = z.object({ stageId: z.string().min(1) });
const setWorkStateBody = z.object({ workStateId: z.string().min(1) });
const createCommentBody = z.object({
  type: z.nativeEnum(OrderCommentType).default(OrderCommentType.NOTE),
  text: z.string().trim().min(1, "Комментарий не может быть пустым").max(4000, "Комментарий слишком длинный"),
});
const patchCommentBody = z.object({
  type: z.nativeEnum(OrderCommentType).optional(),
  text: z.string().trim().min(1, "Комментарий не может быть пустым").max(4000, "Комментарий слишком длинный").optional(),
});
const listOrdersQuery = z.object({
  scope: z.enum(["active", "archive", "all"]).default("active"),
});
const COMMENT_EDIT_WINDOW_MS = 10 * 60 * 1000;

async function fetchOrder(prisma: PrismaClient, id: string): Promise<OrderWithRelations | null> {
  return prisma.order.findFirst({
    where: { id, deletedAt: null },
    include: orderInclude,
  });
}

function serializeFacade(f: OrderWithRelations["facades"][number]) {
  return {
    id: f.id,
    sortIndex: f.sortIndex,
    millingLabel: f.millingLabel,
    coatingTypeId: f.coatingTypeId,
    handleLabel: f.handleLabel,
    handleLengthMm: f.handleLengthMm,
    coatingType: {
      id: f.coatingType.id,
      slug: f.coatingType.slug,
      name: f.coatingType.name,
      pricePerM2: f.coatingType.pricePerM2,
    },
    color: f.color,
    widthMm: f.widthMm,
    heightMm: f.heightMm,
    quantity: f.quantity,
    thicknessMm: f.thicknessMm,
    edgeRadius: f.edgeRadius,
    optionsExtra: f.optionsExtra,
    basePrice: f.basePrice,
  };
}

function serializeOrder(order: OrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderNumberFormatted: formatOrderNumber(order.orderNumber),
    createdAt: order.createdAt.toISOString(),
    completedAt: order.completedAt?.toISOString() ?? null,
    deletedAt: order.deletedAt?.toISOString() ?? null,
    deadlineAt: order.deadlineAt?.toISOString() ?? null,
    workType: order.workType,
    deliveryAddress: order.deliveryAddress,
    comment: order.comment,

    // Новые поля цен
    facadeCount: order.facadeCount,
    facadePricePerM2: order.facadePricePerM2,
    facadeAreaTotal: order.facadeAreaTotal,
    facadeCostTotal: order.facadeCostTotal,
    millingPricePerM2: order.millingPricePerM2,
    millingCostTotal: order.millingCostTotal,
    handleLengthTotalMm: order.handleLengthTotalMm,
    handlePricePerMeter: order.handlePricePerMeter,
    handleCostTotal: order.handleCostTotal,
    otherServicesPrice: order.otherServicesPrice,
    subtotal: order.subtotal,
    discount: order.discount,
    totalCost: order.totalCost,
    advance: order.advance,

    customer: order.customer,
    currentStage: order.currentStage,
    workState: {
      id: order.workState.id,
      slug: order.workState.slug,
      name: order.workState.name,
      sortOrder: order.workState.sortOrder,
    },
    facades: order.facades.map(serializeFacade),
  };
}

function mapFacadeCreate(f: z.infer<typeof facadeItem>, index: number) {
  const rawHandleLabel = f.handleLabel?.trim() ? f.handleLabel.trim() : null;
  const handleLabel = rawHandleLabel === NO_HANDLE_LABEL ? null : rawHandleLabel;
  return {
    sortIndex: f.sortIndex ?? index,
    millingLabel: f.millingLabel.trim(),
    coatingTypeId: f.coatingTypeId,
    handleLabel,
    handleLengthMm: null,
    color: f.color,
    widthMm: f.widthMm,
    heightMm: f.heightMm,
    quantity: f.quantity ?? 1,
    thicknessMm: f.thicknessMm,
    edgeRadius: f.edgeRadius,
    optionsExtra: f.optionsExtra ?? null,
    basePrice: f.basePrice ?? 0,
  };
}

function serializeComment(comment: {
  id: string;
  type: OrderCommentType;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    patronymic: string | null;
  };
}) {
  return {
    id: comment.id,
    type: comment.type,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    user: {
      id: comment.user.id,
      email: comment.user.email,
      firstName: comment.user.firstName,
      lastName: comment.user.lastName,
      patronymic: comment.user.patronymic,
    },
  };
}

async function validateFacadeCoatingRefs(
  prisma: PrismaClient,
  facades: z.infer<typeof facadeItem>[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const coatingIds = [...new Set(facades.map((f) => f.coatingTypeId))];
  const coatings = await prisma.coatingType.findMany({ where: { id: { in: coatingIds } } });
  if (coatings.length !== coatingIds.length) {
    return { ok: false, message: "Неизвестный тип покрытия" };
  }
  return { ok: true };
}

export const ordersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get("/orders", async (request, reply) => {
    const parsed = listOrdersQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Некорректные параметры", details: parsed.error.flatten() });
    }

    const p = authPayload(request);
    if (p.role === Role.CUSTOMER && !p.customerId) {
      return reply.code(403).send({ error: "Нет привязки к заказчику" });
    }

    const archiveCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const archivedWhere: Prisma.OrderWhereInput = {
      completedAt: { lte: archiveCutoff },
      currentStage: { isComplete: true },
    };
    const scopeWhere: Prisma.OrderWhereInput =
      parsed.data.scope === "archive"
        ? archivedWhere
        : parsed.data.scope === "active"
          ? { NOT: archivedWhere }
          : {};

    const orders = await app.prisma.order.findMany({
      where: {
        deletedAt: null,
        ...scopeWhere,
        ...(p.role === Role.CUSTOMER ? { customerId: p.customerId! } : {}),
      },
      include: orderInclude,
      orderBy: { orderNumber: "desc" },
    });

    return { orders: orders.map((o) => serializeOrder(o)) };
  });

  app.get("/orders/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
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

  app.get(
    "/orders/:id/comments",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const order = await fetchOrder(app.prisma, id);
      if (!order) {
        return reply.code(404).send({ error: "Заказ не найден" });
      }

      const comments = await app.prisma.orderComment.findMany({
        where: { orderId: id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              patronymic: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return { comments: comments.map((comment) => serializeComment(comment)) };
    },
  );

  app.post(
    "/orders/:id/comments",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = createCommentBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }

      const order = await fetchOrder(app.prisma, id);
      if (!order) {
        return reply.code(404).send({ error: "Заказ не найден" });
      }

      const uid = authUserId(request);
      const comment = await app.prisma.orderComment.create({
        data: {
          orderId: id,
          userId: uid,
          type: parsed.data.type,
          text: parsed.data.text,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              patronymic: true,
            },
          },
        },
      });

      await writeAudit(
        app.prisma,
        uid,
        "order.comment.create",
        `Комментарий (${parsed.data.type}) к заказу №${formatOrderNumber(order.orderNumber)}`,
        "OrderComment",
        comment.id,
      );

      return reply.code(201).send({ comment: serializeComment(comment) });
    },
  );

  app.patch(
    "/orders/:id/comments/:commentId",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { id, commentId } = request.params as { id: string; commentId: string };
      const parsed = patchCommentBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }
      if (parsed.data.type === undefined && parsed.data.text === undefined) {
        return reply.code(400).send({ error: "Нет полей для обновления" });
      }

      const existing = await app.prisma.orderComment.findFirst({
        where: { id: commentId, orderId: id },
        include: {
          order: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              patronymic: true,
            },
          },
        },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Комментарий не найден" });
      }

      const p = authPayload(request);
      const uid = authUserId(request);
      if (p.role !== Role.ADMIN) {
        if (existing.userId !== uid) {
          return reply.code(403).send({ error: "Нельзя редактировать чужой комментарий" });
        }
        if (Date.now() - existing.createdAt.getTime() > COMMENT_EDIT_WINDOW_MS) {
          return reply.code(403).send({ error: "Комментарий можно редактировать только в течение 10 минут" });
        }
      }

      const updated = await app.prisma.orderComment.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
          ...(parsed.data.text !== undefined ? { text: parsed.data.text } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              patronymic: true,
            },
          },
        },
      });

      await writeAudit(
        app.prisma,
        uid,
        "order.comment.update",
        `Обновлён комментарий (${updated.type}) к заказу №${formatOrderNumber(existing.order.orderNumber)}`,
        "OrderComment",
        updated.id,
      );

      return { comment: serializeComment(updated) };
    },
  );

  app.post(
    "/orders",
    { preHandler: [requireRoles(Role.ADMIN)] },
    async (request, reply) => {
      const parsed = createOrderBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }

      const cat = await validateFacadeCoatingRefs(app.prisma, parsed.data.facades);
      if (!cat.ok) {
        return reply.code(400).send({ error: cat.message });
      }

      const newStage =
        (await app.prisma.stage.findUnique({ where: { slug: "new" } })) ??
        (await app.prisma.stage.findFirst({ orderBy: { sortOrder: "asc" } }));
      if (!newStage) {
        return reply.code(500).send({ error: "Нет ни одного этапа в базе" });
      }

      const customer = await app.prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
      if (!customer) {
        return reply.code(400).send({ error: "Заказчик не найден" });
      }

      const queueWorkState = await app.prisma.orderWorkState.findUnique({
        where: { slug: DEFAULT_ORDER_WORK_STATE_SLUG },
      });
      if (!queueWorkState) {
        return reply.code(500).send({ error: "Не настроены под-статусы заказа (очередь)" });
      }

      const maxAgg = await app.prisma.order.aggregate({ _max: { orderNumber: true } });
      const orderNumber = (maxAgg._max.orderNumber ?? 0) + 1;

      const order = await app.prisma.order.create({
        data: {
          orderNumber,
          customerId: parsed.data.customerId,
          currentStageId: newStage.id,
          workStateId: queueWorkState.id,
          completedAt: newStage.isComplete ? new Date() : null,
          deadlineAt: parsed.data.deadlineAt ? new Date(parsed.data.deadlineAt) : null,
          workType: parsed.data.workType?.trim() ? parsed.data.workType.trim() : null,
          deliveryAddress: parsed.data.deliveryAddress?.trim() ? parsed.data.deliveryAddress.trim() : null,
          comment: parsed.data.comment ?? null,

          // Новые поля цен
          facadeCount: parsed.data.facadeCount ?? 0,
          facadePricePerM2: parsed.data.facadePricePerM2 ?? null,
          facadeAreaTotal: parsed.data.facadeAreaTotal ?? 0,
          facadeCostTotal: parsed.data.facadeCostTotal ?? null,
          millingPricePerM2: parsed.data.millingPricePerM2 ?? null,
          millingCostTotal: parsed.data.millingCostTotal ?? null,
          handleLengthTotalMm: parsed.data.handleLengthTotalMm ?? null,
          handlePricePerMeter: parsed.data.handlePricePerMeter ?? null,
          handleCostTotal: parsed.data.handleCostTotal ?? null,
          otherServicesPrice: parsed.data.otherServicesPrice ?? null,
          subtotal: parsed.data.subtotal ?? null,
          discount: parsed.data.discount ?? null,
          totalCost: parsed.data.totalCost ?? null,
          advance: parsed.data.advance ?? null,

          facades: {
            create: parsed.data.facades.map(mapFacadeCreate),
          },
        },
        include: orderInclude,
      });

      const uid = authUserId(request);
      await writeAudit(
        app.prisma,
        uid,
        "order.create",
        `Создан заказ №${formatOrderNumber(order.orderNumber)} для «${customer.name}» (${order.facades.length} поз.)`,
        "Order",
        order.id,
      );

      return reply.code(201).send({ order: serializeOrder(order) });
    },
  );

  app.patch(
    "/orders/:id",
    { preHandler: [requireRoles(Role.ADMIN)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = patchOrderBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }

      const existing = await fetchOrder(app.prisma, id);
      if (!existing) {
        return reply.code(404).send({ error: "Заказ не найден" });
      }

      if (parsed.data.facades !== undefined) {
        const cat = await validateFacadeCoatingRefs(app.prisma, parsed.data.facades);
        if (!cat.ok) {
          return reply.code(400).send({ error: cat.message });
        }
      }

      if (parsed.data.customerId) {
        const c = await app.prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
        if (!c) {
          return reply.code(400).send({ error: "Заказчик не найден" });
        }
      }

      const data: Prisma.OrderUncheckedUpdateInput = {};
      if (parsed.data.customerId !== undefined) data.customerId = parsed.data.customerId;
      if (parsed.data.deadlineAt !== undefined) {
        data.deadlineAt = parsed.data.deadlineAt ? new Date(parsed.data.deadlineAt) : null;
      }
      if (parsed.data.workType !== undefined) {
        data.workType = parsed.data.workType?.trim() ? parsed.data.workType.trim() : null;
      }
      if (parsed.data.deliveryAddress !== undefined) {
        data.deliveryAddress = parsed.data.deliveryAddress?.trim() ? parsed.data.deliveryAddress.trim() : null;
      }
      if (parsed.data.comment !== undefined) data.comment = parsed.data.comment;

      // Новые поля цен
      if (parsed.data.facadeCount !== undefined) data.facadeCount = parsed.data.facadeCount;
      if (parsed.data.facadePricePerM2 !== undefined) data.facadePricePerM2 = parsed.data.facadePricePerM2;
      if (parsed.data.facadeAreaTotal !== undefined) data.facadeAreaTotal = parsed.data.facadeAreaTotal;
      if (parsed.data.facadeCostTotal !== undefined) data.facadeCostTotal = parsed.data.facadeCostTotal;
      if (parsed.data.millingPricePerM2 !== undefined) data.millingPricePerM2 = parsed.data.millingPricePerM2;
      if (parsed.data.millingCostTotal !== undefined) data.millingCostTotal = parsed.data.millingCostTotal;
      if (parsed.data.handleLengthTotalMm !== undefined) data.handleLengthTotalMm = parsed.data.handleLengthTotalMm;
      if (parsed.data.handlePricePerMeter !== undefined) data.handlePricePerMeter = parsed.data.handlePricePerMeter;
      if (parsed.data.handleCostTotal !== undefined) data.handleCostTotal = parsed.data.handleCostTotal;
      if (parsed.data.otherServicesPrice !== undefined) data.otherServicesPrice = parsed.data.otherServicesPrice;
      if (parsed.data.subtotal !== undefined) data.subtotal = parsed.data.subtotal;
      if (parsed.data.discount !== undefined) data.discount = parsed.data.discount;
      if (parsed.data.totalCost !== undefined) data.totalCost = parsed.data.totalCost;
      if (parsed.data.advance !== undefined) data.advance = parsed.data.advance;

      const order =
        parsed.data.facades !== undefined
          ? await app.prisma.$transaction(async (tx) => {
              await tx.facade.deleteMany({ where: { orderId: id } });
              return tx.order.update({
                where: { id },
                data: {
                  ...data,
                  facades: { create: parsed.data.facades!.map(mapFacadeCreate) },
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
      const auditExtra =
        parsed.data.facades !== undefined
          ? ` (${parsed.data.facades.length} поз., сумма ${parsed.data.totalCost ?? "—"})`
          : "";
      await writeAudit(
        app.prisma,
        uid,
        "order.update",
        `Обновлён заказ №${formatOrderNumber(order.orderNumber)}${auditExtra}`,
        "Order",
        order.id,
      );

      return { order: serializeOrder(order) };
    },
  );

  app.post(
    "/orders/:id/move",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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

      const queueWorkState = await app.prisma.orderWorkState.findUnique({
        where: { slug: DEFAULT_ORDER_WORK_STATE_SLUG },
      });
      if (!queueWorkState) {
        return reply.code(500).send({ error: "Не настроены под-статусы заказа (очередь)" });
      }

      const fromName = order.currentStage.name;
      const updated = await app.prisma.order.update({
        where: { id },
        data: {
          currentStageId: stage.id,
          workStateId: queueWorkState.id,
          completedAt: stage.isComplete ? order.completedAt ?? new Date() : null,
        },
        include: orderInclude,
      });

      const uid = authUserId(request);
      await writeAudit(
        app.prisma,
        uid,
        "order.move",
        `Заказ №${formatOrderNumber(updated.orderNumber)}: «${fromName}» → «${stage.name}» (под-статус: очередь)`,
        "Order",
        updated.id,
      );

      return { order: serializeOrder(updated) };
    },
  );

  app.post(
    "/orders/:id/work-state",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = setWorkStateBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }

      const order = await fetchOrder(app.prisma, id);
      if (!order) {
        return reply.code(404).send({ error: "Заказ не найден" });
      }

      const ws = await app.prisma.orderWorkState.findUnique({ where: { id: parsed.data.workStateId } });
      if (!ws) {
        return reply.code(400).send({ error: "Под-статус не найден" });
      }
      if (!order.currentStage.allowWorkStates) {
        return reply.code(400).send({ error: "На текущем этапе под-статусы отключены" });
      }

      const updated = await app.prisma.order.update({
        where: { id },
        data: { workStateId: ws.id },
        include: orderInclude,
      });

      const uid = authUserId(request);
      await writeAudit(
        app.prisma,
        uid,
        "order.work_state",
        `Заказ №${formatOrderNumber(updated.orderNumber)}: под-статус «${ws.name}»`,
        "Order",
        updated.id,
      );

      return { order: serializeOrder(updated) };
    },
  );

  app.delete(
    "/orders/:id",
    { preHandler: [requireRoles(Role.ADMIN)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const order = await fetchOrder(app.prisma, id);
      if (!order) {
        return reply.code(404).send({ error: "Заказ не найден" });
      }

      const deleted = await app.prisma.order.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: orderInclude,
      });

      await writeAudit(
        app.prisma,
        authUserId(request),
        "order.delete",
        `Заказ №${formatOrderNumber(deleted.orderNumber)} перемещён в корзину`,
        "Order",
        deleted.id,
      );

      return reply.code(204).send();
    },
  );
};
