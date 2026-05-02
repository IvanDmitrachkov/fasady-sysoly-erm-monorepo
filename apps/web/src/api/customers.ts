import { apiJson } from "./http";

export type CustomerDto = { id: string; name: string };

export function customersList() {
  return apiJson<{ customers: CustomerDto[] }>("/api/customers");
}

export function customerCreate(name: string) {
  return apiJson<{ customer: CustomerDto }>("/api/customers", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function customerUpdate(id: string, name: string) {
  return apiJson<{ customer: CustomerDto }>(`/api/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}
