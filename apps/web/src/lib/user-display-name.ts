export type UserNameFields = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  patronymic?: string | null;
};

/** ФИО или email, если ФИО не задано. */
export function userDisplayName(u: UserNameFields): string {
  const f = (u.firstName ?? "").trim();
  const p = (u.patronymic ?? "").trim();
  const l = (u.lastName ?? "").trim();
  const parts = [f, p, l].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : u.email;
}

export function userHasDisplayName(u: UserNameFields): boolean {
  return !!(u.firstName?.trim() || u.lastName?.trim() || u.patronymic?.trim());
}
