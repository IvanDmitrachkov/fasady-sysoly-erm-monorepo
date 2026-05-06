import { apiJson } from "./http";

export type ActivityAction =
  | "order.create"
  | "order.move"
  | "order.work_state"
  | "order.comment.create"
  | "order.comment.update"
  | "time.create";

export type ActivityItemDto = {
  id: string;
  action: ActivityAction;
  label: string;
  details: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    patronymic: string | null;
    role: string;
  };
  order: {
    id: string;
    orderNumber: number;
    orderNumberFormatted: string;
  } | null;
};

export function activityList(params?: { from?: string; to?: string; take?: number }) {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.take != null) q.set("take", String(params.take));
  const s = q.toString();
  return apiJson<{ from: string; to: string; items: ActivityItemDto[] }>(`/api/activity${s ? `?${s}` : ""}`);
}
