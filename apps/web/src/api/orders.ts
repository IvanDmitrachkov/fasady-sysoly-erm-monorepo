import { apiJson } from "./http";

export type StageDto = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isComplete: boolean;
};

export type CustomerDto = { id: string; name: string };

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

export function orderCreate(body: {
  customerId: string;
  deadlineAt?: string | null;
  comment?: string | null;
  overridePercent?: number | null;
  overridePrice?: number | null;
  totalPrice?: number | null;
}) {
  return apiJson<{ order: OrderDto }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
