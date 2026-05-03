import { apiJson } from "./http";
import type { StageDto } from "./stages";

export type CustomerDto = {
  id: string;
  name: string;
  phone: string | null;
  deliveryAddress: string | null;
};
export type { StageDto };

export type FacadeTypeSnippet = {
  id: string;
  slug: string;
  name: string;
  pricePerM2: number;
};

export type FacadeDto = {
  id: string;
  sortIndex: number;
  millingLabel: string;
  coatingTypeId: string;
  handleLabel: string | null;
  handleLengthMm: number | null;
  coatingType: FacadeTypeSnippet;
  color: string;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  edgeRadius: number | null;
  optionsExtra: string | null;
  basePrice: number;
};

export type OrderDto = {
  id: string;
  orderNumber: number;
  orderNumberFormatted: string;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  deadlineAt: string | null;
  workType: string | null;
  deliveryAddress: string | null;
  comment: string | null;

  // Новые поля цен
  facadeCount: number;
  facadePricePerM2: number | null;
  facadeAreaTotal: number;
  facadeCostTotal: number | null;
  millingPricePerM2: number | null;
  millingCostTotal: number | null;
  handleLengthTotalMm: number | null;
  handlePricePerMeter: number | null;
  handleCostTotal: number | null;
  otherServicesPrice: number | null;
  subtotal: number | null;
  discount: number | null;
  totalCost: number | null;
  advance: number | null;

  customer: CustomerDto;
  currentStage: StageDto;
  facades: FacadeDto[];
};

export function ordersList() {
  return apiJson<{ orders: OrderDto[] }>("/api/orders");
}

export function orderMove(orderId: string, stageId: string) {
  return apiJson<{ order: OrderDto }>(`/api/orders/${orderId}/move`, {
    method: "POST",
    body: JSON.stringify({ stageId }),
  });
}

export type OrderCreateFacadePayload = {
  sortIndex?: number;
  millingLabel: string;
  coatingTypeId: string;
  handleLabel?: string | null;
  handleLengthMm?: number | null;
  color: string;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  edgeRadius: number;
  optionsExtra?: string | null;
  basePrice?: number;
};

export function orderCreate(body: {
  customerId: string;
  deadlineAt?: string | null;
  workType?: string | null;
  deliveryAddress?: string | null;
  comment?: string | null;
  facadeCount?: number;
  facadePricePerM2?: number | null;
  facadeAreaTotal?: number;
  facadeCostTotal?: number | null;
  millingPricePerM2?: number | null;
  millingCostTotal?: number | null;
  handleLengthTotalMm?: number | null;
  handlePricePerMeter?: number | null;
  handleCostTotal?: number | null;
  otherServicesPrice?: number | null;
  subtotal?: number | null;
  discount?: number | null;
  totalCost?: number | null;
  advance?: number | null;
  facades: OrderCreateFacadePayload[];
}) {
  return apiJson<{ order: OrderDto }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function orderGet(orderId: string) {
  return apiJson<{ order: OrderDto }>(`/api/orders/${orderId}`);
}

export type OrderUpdatePayload = {
  customerId?: string;
  deadlineAt?: string | null;
  workType?: string | null;
  deliveryAddress?: string | null;
  comment?: string | null;
  facadeCount?: number;
  facadePricePerM2?: number | null;
  facadeAreaTotal?: number;
  facadeCostTotal?: number | null;
  millingPricePerM2?: number | null;
  millingCostTotal?: number | null;
  handleLengthTotalMm?: number | null;
  handlePricePerMeter?: number | null;
  handleCostTotal?: number | null;
  otherServicesPrice?: number | null;
  subtotal?: number | null;
  discount?: number | null;
  totalCost?: number | null;
  advance?: number | null;
  facades?: OrderCreateFacadePayload[];
};

export function orderUpdate(orderId: string, body: OrderUpdatePayload) {
  return apiJson<{ order: OrderDto }>(`/api/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function orderDelete(orderId: string): Promise<void> {
  await apiJson<unknown>(`/api/orders/${orderId}`, { method: "DELETE" });
}

/** Скачать бланк заказа (xlsx из шаблона). Только ADMIN/WORKER — см. API. */
export function orderPrintXlsxPath(orderId: string) {
  return `/api/orders/${orderId}/print.xlsx`;
}
