import { z } from "zod";
import dayjs from "dayjs";
import type { OrderCreateFacadePayload, OrderDto } from "../api/orders";
import {
  calcFacadeAreaTotal,
  calcFacadeCount,
  calcFacadeCostTotal,
  calcMillingCostTotal,
  calcHandleCostTotal,
  calcSubtotal,
  calcTotalCost,
} from "../lib/facade-pricing";

export const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export type FacadeCatalogLookup = {
  millingById: Map<string, { pricePerM2: number }>;
  coatingById: Map<string, { pricePerM2: number }>;
  handleById: Map<string, { pricePerMeter: number }>;
};

export function buildCatalogLookup(data: {
  millingTypes: { id: string; pricePerM2: number }[];
  coatingTypes: { id: string; pricePerM2: number }[];
  handleTypes: { id: string; pricePerMeter: number }[];
}): FacadeCatalogLookup {
  return {
    millingById: new Map(data.millingTypes.map((t) => [t.id, { pricePerM2: t.pricePerM2 }])),
    coatingById: new Map(data.coatingTypes.map((t) => [t.id, { pricePerM2: t.pricePerM2 }])),
    handleById: new Map(data.handleTypes.map((t) => [t.id, { pricePerMeter: t.pricePerMeter }])),
  };
}

export function defaultCatalogIds(data: {
  millingTypes: { id: string; slug: string }[];
  coatingTypes: { id: string; slug: string }[];
}): { millingTypeId: string; coatingTypeId: string } {
  const millingNone = data.millingTypes.find((t) => t.slug === "none");
  const coatingNone = data.coatingTypes.find((t) => t.slug === "none");
  return {
    millingTypeId: millingNone?.id ?? data.millingTypes[0]?.id ?? "",
    coatingTypeId: coatingNone?.id ?? data.coatingTypes[0]?.id ?? "",
  };
}

const facadeRowSchema = z
  .object({
    millingTypeId: z.string().min(1, "Выберите тип фрезеровки"),
    coatingTypeId: z.string().min(1, "Выберите тип покрытия"),
    handleTypeId: z.string().nullable().optional(),
    handleLengthMm: z.number().positive().nullable().optional(),
    color: z.string(),
    widthMm: z.number().positive("Ширина > 0"),
    heightMm: z.number().positive("Высота > 0"),
    thicknessMm: z.number().positive("Толщина > 0"),
    edgeRadius: z.number().finite().nullable().optional(),
    optionsExtra: z.string().optional(),
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
        message: "Без типа ручки не указывайте длину",
        path: ["handleLengthMm"],
      });
    }
  });

export const createOrderFormSchema = z.object({
  customerId: z.string().min(1, "Выберите заказчика"),
  deadlineAt: z.date().nullable().optional(),
  comment: z.string().optional(),

  // Новые поля цен
  facadePricePerM2: z.number().positive().nullable().optional(),
  millingPricePerM2: z.number().positive().nullable().optional(),
  handleLengthTotalMm: z.number().positive().nullable().optional(),
  handlePricePerMeter: z.number().positive().nullable().optional(),
  otherServicesPrice: z.number().finite().nullable().optional(),
  discount: z.number().finite().nullable().optional(),
  advance: z.number().finite().nullable().optional(),

  facades: z.array(facadeRowSchema).min(1, "Добавьте хотя бы одну позицию"),
});

export type CreateOrderFormValues = z.infer<typeof createOrderFormSchema>;

export function defaultFacadeRow(defaults?: { millingTypeId: string; coatingTypeId: string }): CreateOrderFormValues["facades"][number] {
  return {
    millingTypeId: defaults?.millingTypeId ?? "",
    coatingTypeId: defaults?.coatingTypeId ?? "",
    handleTypeId: null,
    handleLengthMm: null,
    color: "",
    widthMm: 720,
    heightMm: 2400,
    thicknessMm: 16,
    edgeRadius: null,
    optionsExtra: "",
  };
}

export function buildFacadesPayload(
  facades: CreateOrderFormValues["facades"],
  catalog: FacadeCatalogLookup,
): OrderCreateFacadePayload[] {
  return facades.map((row, i) => ({
    sortIndex: i,
    millingTypeId: row.millingTypeId,
    coatingTypeId: row.coatingTypeId,
    handleTypeId: row.handleTypeId ?? null,
    handleLengthMm: row.handleTypeId ? row.handleLengthMm ?? null : null,
    color: row.color,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    thicknessMm: row.thicknessMm,
    edgeRadius: row.edgeRadius ?? null,
    optionsExtra: row.optionsExtra?.trim() ? row.optionsExtra : null,
    basePrice: 0,
  }));
}

export function orderDtoToFormValues(order: OrderDto): CreateOrderFormValues {
  return {
    customerId: order.customer.id,
    deadlineAt: order.deadlineAt ? new Date(order.deadlineAt) : null,
    comment: order.comment ?? "",
    facadePricePerM2: order.facadePricePerM2 ?? null,
    millingPricePerM2: order.millingPricePerM2 ?? null,
    handleLengthTotalMm: order.handleLengthTotalMm ?? null,
    handlePricePerMeter: order.handlePricePerMeter ?? null,
    otherServicesPrice: order.otherServicesPrice ?? null,
    discount: order.discount ?? null,
    advance: order.advance ?? null,
    facades: order.facades.map((f) => ({
      millingTypeId: f.millingTypeId,
      coatingTypeId: f.coatingTypeId,
      handleTypeId: f.handleTypeId ?? null,
      handleLengthMm: f.handleLengthMm ?? null,
      color: f.color,
      widthMm: f.widthMm,
      heightMm: f.heightMm,
      thicknessMm: f.thicknessMm,
      edgeRadius: f.edgeRadius,
      optionsExtra: f.optionsExtra ?? "",
    })),
  };
}

export function buildOrderWritePayload(
  v: CreateOrderFormValues,
  catalog: FacadeCatalogLookup,
) {
  const facadeAreaTotal = calcFacadeAreaTotal(v.facades.map(f => ({ widthMm: f.widthMm, heightMm: f.heightMm })));
  const facadeCount = calcFacadeCount(v.facades);
  const facadeCostTotal = calcFacadeCostTotal(facadeAreaTotal, v.facadePricePerM2);
  const millingCostTotal = calcMillingCostTotal(facadeAreaTotal, v.millingPricePerM2);
  const handleCostTotal = calcHandleCostTotal(v.handleLengthTotalMm, v.handlePricePerMeter);
  const subtotal = calcSubtotal({
    facadeCostTotal,
    millingCostTotal,
    handleCostTotal,
    otherServicesPrice: v.otherServicesPrice,
  });
  const totalCost = calcTotalCost(subtotal, v.discount);

  return {
    customerId: v.customerId,
    deadlineAt: v.deadlineAt ? dayjs(v.deadlineAt).endOf("day").toISOString() : null,
    comment: v.comment?.trim() ? v.comment : null,
    facadeCount,
    facadePricePerM2: v.facadePricePerM2 ?? null,
    facadeAreaTotal,
    facadeCostTotal,
    millingPricePerM2: v.millingPricePerM2 ?? null,
    millingCostTotal,
    handleLengthTotalMm: v.handleLengthTotalMm ?? null,
    handlePricePerMeter: v.handlePricePerMeter ?? null,
    handleCostTotal,
    otherServicesPrice: v.otherServicesPrice ?? null,
    subtotal,
    discount: v.discount ?? null,
    totalCost,
    advance: v.advance ?? null,
    facades: buildFacadesPayload(v.facades, catalog),
  };
}
