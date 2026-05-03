import { apiJson } from "./http";

export type CustomerDto = {
  id: string;
  name: string;
  phone: string | null;
  deliveryAddress: string | null;
};

export function customersList() {
  return apiJson<{ customers: CustomerDto[] }>("/api/customers");
}

export function customerCreate(body: { name: string; phone?: string | null; deliveryAddress?: string | null }) {
  return apiJson<{ customer: CustomerDto }>("/api/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function customerUpdate(
  id: string,
  body: { name: string; phone?: string | null; deliveryAddress?: string | null },
) {
  return apiJson<{ customer: CustomerDto }>(`/api/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
