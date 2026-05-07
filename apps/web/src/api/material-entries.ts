import { apiJson } from "./http";

export type MaterialEntryDto = {
  id: string;
  name: string;
  kind: string | null;
  unit: string;
  quantity: number;
  comment: string | null;
  usedAt: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    patronymic: string | null;
  };
  stage: { id: string; name: string } | null;
};

export function materialEntriesList(orderId: string) {
  return apiJson<{ entries: MaterialEntryDto[] }>(`/api/orders/${orderId}/material-entries`);
}

export function materialEntryCreate(
  orderId: string,
  body: {
    stageId?: string | null;
    name: string;
    kind?: string | null;
    unit: string;
    quantity: number;
    comment?: string | null;
    usedAt: string;
  },
) {
  return apiJson<{ entry: MaterialEntryDto }>(`/api/orders/${orderId}/material-entries`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function materialEntryUpdate(
  id: string,
  body: Partial<{
    stageId: string | null;
    name: string;
    kind: string | null;
    unit: string;
    quantity: number;
    comment: string | null;
    usedAt: string;
  }>,
) {
  return apiJson<{ entry: MaterialEntryDto }>(`/api/material-entries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
