import { apiJson } from "./http";

export type StageDto = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isComplete: boolean;
};

export function stagesList() {
  return apiJson<{ stages: StageDto[] }>("/api/stages");
}
