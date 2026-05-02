import { apiJson } from "./http";

export type TimeEntryDto = {
  id: string;
  minutes: number;
  comment: string | null;
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

export function timeEntriesList(orderId: string) {
  return apiJson<{ entries: TimeEntryDto[] }>(`/api/orders/${orderId}/time-entries`);
}

export function timeEntryCreate(
  orderId: string,
  body: {
    stageId: string;
    minutes: number;
    comment?: string | null;
    workedAt: string;
  },
) {
  return apiJson<{ entry: TimeEntryDto }>(`/api/orders/${orderId}/time-entries`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
