import { apiJson } from "./http";

export type OrderWorkStateDto = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
};

export function orderWorkStatesList() {
  return apiJson<{ orderWorkStates: OrderWorkStateDto[] }>("/api/order-work-states");
}
