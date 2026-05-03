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

export const NO_HANDLE_LABEL = "Нет";

export function isNoHandleLabel(value: string | null | undefined): boolean {
  return !value?.trim() || value.trim() === NO_HANDLE_LABEL;
}

export function defaultsForNewFacadeRow(_data: {
  millingTypes: { slug: string; name: string }[];
  coatingTypes: { id: string; slug: string }[];
}): { millingLabel: string; coatingTypeId: string; handleLabel: string } {
  return {
    millingLabel: "",
    coatingTypeId: "",
    handleLabel: "",
  };
}

const facadeRowSchema = z
  .object({
    millingLabel: z.string(),
    coatingTypeId: z.string().min(1, "Выберите тип покрытия"),
    handleLabel: z.string().min(1, "Выберите ручку"),
    handleLengthMm: z.number().positive().nullable().optional(),
    color: z.string(),
    widthMm: z.number().positive("Ширина > 0"),
    heightMm: z.number().positive("Высота > 0"),
    quantity: z.number().int("Количество целое").positive("Количество > 0"),
    thicknessMm: z.number().positive("Толщина > 0"),
    edgeRadius: z.number().finite("Укажите радиус").optional(),
    optionsExtra: z.string().optional(),
  })
  .superRefine((row, ctx) => {
    if (!row.millingLabel.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите фрезеровку",
        path: ["millingLabel"],
      });
    }
    if (row.edgeRadius == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите радиус",
        path: ["edgeRadius"],
      });
    }
  });

export const createOrderFormSchema = z.object({
  customerId: z.string().min(1, "Выберите заказчика"),
  deadlineAt: z.date().nullable().optional(),
  workType: z.string().optional(),
  deliveryAddress: z.string().optional(),
  comment: z.string().optional(),

  // Новые поля цен
  facadePricePerM2: z.number().positive("Цена фасада должна быть больше 0").nullable().optional(),
  millingPricePerM2: z.number().nonnegative().nullable().optional(),
  handleLengthTotalMm: z.number().nonnegative().nullable().optional(),
  handlePricePerMeter: z.number().nonnegative().nullable().optional(),
  otherServicesPrice: z.number().finite().nullable().optional(),
  discount: z.number().finite().nullable().optional(),
  advance: z.number().finite().nullable().optional(),

  facades: z.array(facadeRowSchema).min(1, "Добавьте хотя бы одну позицию"),
});

export type CreateOrderFormValues = z.infer<typeof createOrderFormSchema>;

export function defaultFacadeRow(
  defaults?: { millingLabel: string; coatingTypeId: string; handleLabel?: string },
): CreateOrderFormValues["facades"][number] {
  return {
    millingLabel: defaults?.millingLabel ?? "",
    coatingTypeId: defaults?.coatingTypeId ?? "",
    handleLabel: defaults?.handleLabel ?? "",
    handleLengthMm: null,
    color: "",
    widthMm: 720,
    heightMm: 2400,
    quantity: 1,
    thicknessMm: 16,
    edgeRadius: undefined,
    optionsExtra: "",
  };
}

export function buildFacadesPayload(facades: CreateOrderFormValues["facades"]): OrderCreateFacadePayload[] {
  return facades.map((row, i) => {
    const hl = row.handleLabel?.trim() ?? "";
    const hasHandle = !isNoHandleLabel(hl);
    if (row.edgeRadius == null) {
      throw new Error("Укажите радиус завала");
    }
    return {
      sortIndex: i,
      millingLabel: row.millingLabel.trim(),
      coatingTypeId: row.coatingTypeId,
      handleLabel: hasHandle ? hl : null,
      handleLengthMm: null,
      color: row.color,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      quantity: row.quantity,
      thicknessMm: row.thicknessMm,
      edgeRadius: row.edgeRadius,
      optionsExtra: row.optionsExtra?.trim() ? row.optionsExtra : null,
      basePrice: 0,
    };
  });
}

export function orderDtoToFormValues(order: OrderDto): CreateOrderFormValues {
  return {
    customerId: order.customer.id,
    deadlineAt: order.deadlineAt ? new Date(order.deadlineAt) : null,
    workType: order.workType ?? "",
    deliveryAddress: order.deliveryAddress ?? "",
    comment: order.comment ?? "",
    facadePricePerM2: order.facadePricePerM2 ?? null,
    millingPricePerM2: order.millingPricePerM2 ?? null,
    handleLengthTotalMm: order.handleLengthTotalMm ?? null,
    handlePricePerMeter: order.handlePricePerMeter ?? null,
    otherServicesPrice: order.otherServicesPrice ?? null,
    discount: order.discount ?? null,
    advance: order.advance ?? null,
    facades: order.facades.map((f) => ({
      millingLabel: f.millingLabel,
      coatingTypeId: f.coatingTypeId,
      handleLabel: f.handleLabel ?? NO_HANDLE_LABEL,
      handleLengthMm: f.handleLengthMm ?? null,
      color: f.color,
      widthMm: f.widthMm,
      heightMm: f.heightMm,
      quantity: f.quantity ?? 1,
      thicknessMm: f.thicknessMm,
      edgeRadius: f.edgeRadius ?? 0,
      optionsExtra: f.optionsExtra ?? "",
    })),
  };
}

export function buildOrderWritePayload(v: CreateOrderFormValues) {
  const facadeAreaTotal = calcFacadeAreaTotal(
    v.facades.map((f) => ({ widthMm: f.widthMm, heightMm: f.heightMm, quantity: f.quantity })),
  );
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
    workType: v.workType?.trim() ? v.workType.trim() : null,
    deliveryAddress: v.deliveryAddress?.trim() ? v.deliveryAddress.trim() : null,
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
    facades: buildFacadesPayload(v.facades),
  };
}
