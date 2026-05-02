import { apiJson } from "./http";

export type Role = "ADMIN" | "WORKER" | "CUSTOMER";

export type UserDto = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  role: Role;
  customerId: string | null;
};

export async function loginRequest(email: string, password: string) {
  return apiJson<{ token: string; user: UserDto }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function meRequest() {
  return apiJson<{ user: UserDto & { createdAt: string } }>("/api/me");
}
