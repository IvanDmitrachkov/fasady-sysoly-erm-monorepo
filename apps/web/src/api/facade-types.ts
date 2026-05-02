import { apiJson } from "./http";

export type MillingTypeDto = {
  id: string;
  slug: string;
  name: string;
  pricePerM2: number;
  sortOrder: number;
  active: boolean;
};

export type CoatingTypeDto = {
  id: string;
  slug: string;
  name: string;
  pricePerM2: number;
  sortOrder: number;
  active: boolean;
};

export type HandleTypeDto = {
  id: string;
  slug: string;
  name: string;
  pricePerMeter: number;
  sortOrder: number;
  active: boolean;
};

export function millingTypesList() {
  return apiJson<{ millingTypes: MillingTypeDto[] }>("/api/milling-types");
}

export function millingTypeCreate(body: {
  slug: string;
  name: string;
  pricePerM2: number;
  sortOrder?: number;
  active?: boolean;
}) {
  return apiJson<{ millingType: MillingTypeDto }>("/api/milling-types", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function millingTypeUpdate(
  id: string,
  body: Partial<{ slug: string; name: string; pricePerM2: number; sortOrder: number; active: boolean }>,
) {
  return apiJson<{ millingType: MillingTypeDto }>(`/api/milling-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function millingTypeDelete(id: string): Promise<void> {
  await apiJson<unknown>(`/api/milling-types/${id}`, { method: "DELETE" });
}

export function coatingTypesList() {
  return apiJson<{ coatingTypes: CoatingTypeDto[] }>("/api/coating-types");
}

export function coatingTypeCreate(body: {
  slug: string;
  name: string;
  pricePerM2: number;
  sortOrder?: number;
  active?: boolean;
}) {
  return apiJson<{ coatingType: CoatingTypeDto }>("/api/coating-types", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function coatingTypeUpdate(
  id: string,
  body: Partial<{ slug: string; name: string; pricePerM2: number; sortOrder: number; active: boolean }>,
) {
  return apiJson<{ coatingType: CoatingTypeDto }>(`/api/coating-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function coatingTypeDelete(id: string): Promise<void> {
  await apiJson<unknown>(`/api/coating-types/${id}`, { method: "DELETE" });
}

export function handleTypesList() {
  return apiJson<{ handleTypes: HandleTypeDto[] }>("/api/handle-types");
}

export function handleTypeCreate(body: {
  slug: string;
  name: string;
  pricePerMeter: number;
  sortOrder?: number;
  active?: boolean;
}) {
  return apiJson<{ handleType: HandleTypeDto }>("/api/handle-types", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function handleTypeUpdate(
  id: string,
  body: Partial<{ slug: string; name: string; pricePerMeter: number; sortOrder: number; active: boolean }>,
) {
  return apiJson<{ handleType: HandleTypeDto }>(`/api/handle-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function handleTypeDelete(id: string): Promise<void> {
  await apiJson<unknown>(`/api/handle-types/${id}`, { method: "DELETE" });
}
