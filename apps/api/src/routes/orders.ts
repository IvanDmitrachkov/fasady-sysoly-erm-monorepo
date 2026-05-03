import { Role, type Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authPayload, authUserId, requireJwt, requireRoles } from "../auth/preHandlers.js";
import { writeAudit } from "../lib/audit.js";
import { formatOrderNumber } from "../lib/order-number.js";

const facadeItem = z
  .object({
    sortIndex: z.number().int().optional(),
    millingTypeId: z.string().min(1),
    coatingTypeId: z.string().min(1),
    handleTypeId: z.string().min(1).nullable().optional(),
    handleLengthMm: z.number().positive().nullable().optional(),
    color: z.string(),
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    thicknessMm: z.number(),
    edgeRadius: z.number().nullable().optional(),
    optionsExtra: z.string().nullable().optional(),
    basePrice: z.number().optional(),
  })
  .superRefine((row, ctx) => {
    const hid = row.handleTypeId ?? null;
    if (hid) {
      if (row.handleLengthMm == null || !Number.isFinite(row.handleLengthMm) || row.handleLengthMm <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите длину интегрированной ручки, мм",
          path: ["handleLengthMm"],
        });
      }
    } else if (row.handleLengthMm != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Длина ручки задаётся только при выбранном типе ручки",
        path: ["handleLengthMm"],
      });
    }
  });

const orderInclude = {
  customer: true,
  currentStage: true,
  facades: {
    orderBy: { sortIndex: "asc" as const },
    include: { millingType: true, coatingType: true, handleType: true },
  },
} as const;
type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const createOrderBody = z.object({
  customerId: z.string().min(1),
  deadlineAt: z.string().datetime().optional().nullable(),
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

async function fetchOrder(prisma: PrismaClient, id: string): Promise<OrderWithRelations | null> {
  return prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });
}

function serializeFacade(f: OrderWithRelations["facades"][number]) {
  return {
    id: f.id,
    sortIndex: f.sortIndex,
    millingTypeId: f.millingTypeId,
    coatingTypeId: f.coatingTypeId,
    handleTypeId: f.handleTypeId,
    handleLengthMm: f.handleLengthMm,
    millingType: {
      id: f.millingType.id,
      slug: f.millingType.slug,
      name: f.millingType.name,
      pricePerM2: f.millingType.pricePerM2,
    },
    coatingType: {
      id: f.coatingType.id,
      slug: f.coatingType.slug,
      name: f.coatingType.name,
      pricePerM2: f.coatingType.pricePerM2,
    },
    handleType: f.handleType
      ? {
          id: f.handleType.id,
          slug: f.handleType.slug,
          name: f.handleType.name,
          pricePerMeter: f.handleType.pricePerMeter,
        }
      : null,
    color: f.color,
    widthMm: f.widthMm,
    heightMm: f.heightMm,
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
    deadlineAt: order.deadlineAt?.toISOString() ?? null,
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
    facades: order.facades.map(serializeFacade),
  };
}

function mapFacadeCreate(f: z.infer<typeof facadeItem>, index: number) {
  const handleTypeId = f.handleTypeId ?? null;
  return {
    sortIndex: f.sortIndex ?? index,
    millingTypeId: f.millingTypeId,
    coatingTypeId: f.coatingTypeId,
    handleTypeId,
    handleLengthMm: handleTypeId ? f.handleLengthMm ?? null : null,
    color: f.color,
    widthMm: f.widthMm,
    heightMm: f.heightMm,
    thicknessMm: f.thicknessMm,
    edgeRadius: f.edgeRadius ?? null,
    optionsExtra: f.optionsExtra ?? null,
    basePrice: f.basePrice ?? 0,
  };
}

async function validateFacadeCatalogRefs(
  prisma: PrismaClient,
  facades: z.infer<typeof facadeItem>[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const millingIds = [...new Set(facades.map((f) => f.millingTypeId))];
  const coatingIds = [...new Set(facades.map((f) => f.coatingTypeId))];
  const handleIds = [...new Set(facades.map((f) => f.handleTypeId).filter((id): id is string => !!id))];

  const [millings, coatings, handles] = await Promise.all([
    prisma.millingType.findMany({ where: { id: { in: millingIds } } }),
    prisma.coatingType.findMany({ where: { id: { in: coatingIds } } }),
    handleIds.length ? prisma.handleType.findMany({ where: { id: { in: handleIds } } }) : Promise.resolve([]),
  ]);

  if (millings.length !== millingIds.length) {
    return { ok: false, message: "Неизвестный тип фрезеровки" };
  }
  if (coatings.length !== coatingIds.length) {
    return { ok: false, message: "Неизвестный тип покрытия" };
  }
  if (handles.length !== handleIds.length) {
    return { ok: false, message: "Неизвестный тип ручки" };
  }

  return { ok: true };
}

export const ordersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireJwt);

  app.get("/orders", async (request, reply) => {
    const p = authPayload(request);
    if (p.role === Role.CUSTOMER && !p.customerId) {
      return reply.code(403).send({ error: "Нет привязки к заказчику" });
    }

    const orders = await app.prisma.order.findMany({
      where: p.role === Role.CUSTOMER ? { customerId: p.customerId! } : {},
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

  app.post(
    "/orders",
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
    async (request, reply) => {
      const parsed = createOrderBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.flatten() });
      }

      const cat = await validateFacadeCatalogRefs(app.prisma, parsed.data.facades);
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

      const maxAgg = await app.prisma.order.aggregate({ _max: { orderNumber: true } });
      const orderNumber = (maxAgg._max.orderNumber ?? 0) + 1;

      const order = await app.prisma.order.create({
        data: {
          orderNumber,
          customerId: parsed.data.customerId,
          currentStageId: newStage.id,
          deadlineAt: parsed.data.deadlineAt ? new Date(parsed.data.deadlineAt) : null,
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
    { preHandler: [requireRoles(Role.ADMIN, Role.WORKER)] },
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
        const cat = await validateFacadeCatalogRefs(app.prisma, parsed.data.facades);
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

      const fromName = order.currentStage.name;
      const updated = await app.prisma.order.update({
        where: { id },
        data: { currentStageId: stage.id },
        include: orderInclude,
      });

      const uid = authUserId(request);
      await writeAudit(
        app.prisma,
        uid,
        "order.move",
        `Заказ №${formatOrderNumber(updated.orderNumber)}: «${fromName}» → «${stage.name}»`,
        "Order",
        updated.id,
      );

      return { order: serializeOrder(updated) };
    },
  );
};
