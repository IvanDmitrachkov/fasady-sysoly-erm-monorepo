import { z } from "zod";
import dayjs from "dayjs";
import {
  computeOrderTotal,
  estimateFacadeBasePrice,
  type FacadePricingInput,
} from "./facade-pricing";
import type { OrderCreateFacadePayload, OrderDto } from "../api/orders";

export const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const facadeRowSchema = z.object({
  milling: z.string(),
  coating: z.string(),
  color: z.string(),
  dimensionsMm: z.string().min(1, "Размеры, мм"),
  thicknessMm: z.number().positive("Толщина > 0"),
  integratedHandle: z.boolean(),
  edgeRadius: z.number().finite().nullable().optional(),
  optionsExtra: z.string().optional(),
});

export const createOrderFormSchema = z.object({
  customerId: z.string().min(1, "Выберите заказчика"),
  deadlineAt: z.date().nullable().optional(),
  comment: z.string().optional(),
  overridePercent: z.number().finite().nullable().optional(),
  overridePrice: z.number().finite().nullable().optional(),
  facades: z.array(facadeRowSchema).min(1, "Добавьте хотя бы одну позицию"),
});

export type CreateOrderFormValues = z.infer<typeof createOrderFormSchema>;

export function defaultFacadeRow(): CreateOrderFormValues["facades"][number] {
  return {
    milling: "",
    coating: "",
    color: "",
    dimensionsMm: "",
    thicknessMm: 16,
    integratedHandle: false,
    edgeRadius: null,
    optionsExtra: "",
  };
}

export function facadeRowToPricingInput(row: CreateOrderFormValues["facades"][number]): FacadePricingInput {
  return {
    dimensionsMm: row.dimensionsMm,
    thicknessMm: row.thicknessMm,
    integratedHandle: row.integratedHandle,
    milling: row.milling,
    coating: row.coating,
    color: row.color,
    edgeRadius: row.edgeRadius,
    optionsExtra: row.optionsExtra,
  };
}

export function buildFacadesPayload(
  facades: CreateOrderFormValues["facades"],
): OrderCreateFacadePayload[] {
  return facades.map((row, i) => ({
    sortIndex: i,
    milling: row.milling,
    coating: row.coating,
    color: row.color,
    dimensionsMm: row.dimensionsMm,
    thicknessMm: row.thicknessMm,
    integratedHandle: row.integratedHandle,
    edgeRadius: row.edgeRadius ?? null,
    optionsExtra: row.optionsExtra?.trim() ? row.optionsExtra : null,
    basePrice: estimateFacadeBasePrice(facadeRowToPricingInput(row)),
  }));
}

export function orderDtoToFormValues(order: OrderDto): CreateOrderFormValues {
  return {
    customerId: order.customer.id,
    deadlineAt: order.deadlineAt ? new Date(order.deadlineAt) : null,
    comment: order.comment ?? "",
    overridePercent: order.overridePercent,
    overridePrice: order.overridePrice,
    facades: order.facades.map((f) => ({
      milling: f.milling,
      coating: f.coating,
      color: f.color,
      dimensionsMm: f.dimensionsMm,
      thicknessMm: f.thicknessMm,
      integratedHandle: f.integratedHandle,
      edgeRadius: f.edgeRadius,
      optionsExtra: f.optionsExtra ?? "",
    })),
  };
}

export function buildOrderWritePayload(v: CreateOrderFormValues) {
  const facadesPayload = buildFacadesPayload(v.facades);
  const sumBase = facadesPayload.reduce((s, f) => s + f.basePrice, 0);
  const totalPrice = computeOrderTotal(sumBase, v.overridePercent ?? null, v.overridePrice ?? null);
  return {
    customerId: v.customerId,
    deadlineAt: v.deadlineAt ? dayjs(v.deadlineAt).endOf("day").toISOString() : null,
    comment: v.comment?.trim() ? v.comment : null,
    overridePercent: v.overridePercent ?? null,
    overridePrice: v.overridePrice ?? null,
    totalPrice,
    facades: facadesPayload,
  };
}
