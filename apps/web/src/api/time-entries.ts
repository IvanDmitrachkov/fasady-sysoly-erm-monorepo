import { apiJson } from "./http";

export type TimeEntryDto = {
  id: string;
  minutes: number;
  comment: string | null;
  startedAt: string;
  endedAt: string | null;
  workedAt: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    patronymic: string | null;
  };
  stage: { id: string; name: string };
};

export type TimeEntryReportDto = TimeEntryDto & {
  order: { id: string; orderNumber: string };
};

export function timeEntriesList(orderId: string) {
  return apiJson<{ entries: TimeEntryDto[] }>(`/api/orders/${orderId}/time-entries`);
}

export function timeEntriesReport(params: { from: string; to: string; userId?: string }) {
  const q = new URLSearchParams();
  q.set("from", params.from);
  q.set("to", params.to);
  if (params.userId) q.set("userId", params.userId);
  return apiJson<{ entries: TimeEntryReportDto[]; totalMinutes: number }>(
    `/api/time-entries/report?${q.toString()}`,
  );
}

export function timeEntriesReportXlsxPath(params: { from: string; to: string; userId?: string }) {
  const q = new URLSearchParams();
  q.set("from", params.from);
  q.set("to", params.to);
  if (params.userId) q.set("userId", params.userId);
  return `/api/time-entries/report.xlsx?${q.toString()}`;
}

export function timeEntryUpdate(
  id: string,
  body: Partial<{
    stageId: string;
    startedAt: string;
    endedAt: string;
    minutes: number;
    comment: string | null;
    workedAt: string;
  }>,
) {
  return apiJson<{ entry: TimeEntryReportDto }>(`/api/time-entries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function timeEntryCreate(
  orderId: string,
  body: {
    stageId: string;
    startedAt: string;
    endedAt: string;
    comment?: string | null;
  },
) {
  return apiJson<{ entry: TimeEntryDto }>(`/api/orders/${orderId}/time-entries`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
