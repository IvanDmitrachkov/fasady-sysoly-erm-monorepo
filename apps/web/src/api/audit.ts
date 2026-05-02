import { apiJson } from "./http";

export type AuditItemDto = {
  id: string;
  action: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    patronymic: string | null;
    role: string;
  };
};

export function auditList(params?: { take?: number; skip?: number }) {
  const q = new URLSearchParams();
  if (params?.take != null) q.set("take", String(params.take));
  if (params?.skip != null) q.set("skip", String(params.skip));
  const s = q.toString();
  return apiJson<{ items: AuditItemDto[]; total: number; take: number; skip: number }>(
    `/api/audit${s ? `?${s}` : ""}`,
  );
}
