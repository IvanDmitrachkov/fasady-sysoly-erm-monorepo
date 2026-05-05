import { apiJson } from "./http";

export type StageDto = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isComplete: boolean;
  allowWorkStates: boolean;
};

export function stagesList() {
  return apiJson<{ stages: StageDto[] }>("/api/stages");
}

export function stageCreate(body: {
  slug: string;
  name: string;
  sortOrder: number;
  isComplete?: boolean;
  allowWorkStates?: boolean;
}) {
  return apiJson<{ stage: StageDto }>("/api/stages", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function stageUpdate(
  id: string,
  body: Partial<{ slug: string; name: string; sortOrder: number; isComplete: boolean; allowWorkStates: boolean }>,
) {
  return apiJson<{ stage: StageDto }>(`/api/stages/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function stageDelete(id: string): Promise<void> {
  await apiJson<unknown>(`/api/stages/${id}`, { method: "DELETE" });
}
