import { apiJson } from "./http";
import type { StageDto } from "./stages";

export type CustomerDto = { id: string; name: string };
export type { StageDto };

export type FacadeTypeSnippet = {
  id: string;
  slug: string;
  name: string;
  pricePerM2: number;
};

export type HandleTypeSnippet = {
  id: string;
  slug: string;
  name: string;
  pricePerMeter: number;
};

export type FacadeDto = {
  id: string;
  sortIndex: number;
  millingTypeId: string;
  coatingTypeId: string;
  handleTypeId: string | null;
  handleLengthMm: number | null;
  millingType: FacadeTypeSnippet;
  coatingType: FacadeTypeSnippet;
  handleType: HandleTypeSnippet | null;
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
  deadlineAt: string | null;
  comment: string | null;
  overridePercent: number | null;
  overridePrice: number | null;
  totalPrice: number | null;
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
  millingTypeId: string;
  coatingTypeId: string;
  handleTypeId?: string | null;
  handleLengthMm?: number | null;
  color: string;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  edgeRadius?: number | null;
  optionsExtra?: string | null;
  basePrice: number;
};

export function orderCreate(body: {
  customerId: string;
  deadlineAt?: string | null;
  comment?: string | null;
  overridePercent?: number | null;
  overridePrice?: number | null;
  totalPrice?: number | null;
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
  comment?: string | null;
  overridePercent?: number | null;
  overridePrice?: number | null;
  totalPrice?: number | null;
  facades?: OrderCreateFacadePayload[];
};

export function orderUpdate(orderId: string, body: OrderUpdatePayload) {
  return apiJson<{ order: OrderDto }>(`/api/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
