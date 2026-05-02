import { apiJson } from "./http";

export type UserRole = "ADMIN" | "WORKER" | "CUSTOMER";

export type UserListDto = {
  id: string;
  email: string;
  role: UserRole;
  customerId: string | null;
  customer: { id: string; name: string } | null;
};

export function usersList() {
  return apiJson<{ users: UserListDto[] }>("/api/users");
}

export function userCreate(body: {
  email: string;
  password: string;
  role: UserRole;
  customerId?: string | null;
}) {
  return apiJson<{ user: UserListDto }>("/api/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function userUpdate(
  id: string,
  body: Partial<{ email: string; password: string; role: UserRole; customerId: string | null }>,
) {
  return apiJson<{ user: UserListDto }>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function userDelete(id: string): Promise<void> {
  await apiJson<unknown>(`/api/users/${id}`, { method: "DELETE" });
}
