/** Подпись для UI и аудита: ФИО или email, если имён нет. */
export function userDisplayName(u: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
}): string {
  const f = (u.firstName ?? "").trim();
  const p = (u.patronymic ?? "").trim();
  const l = (u.lastName ?? "").trim();
  const parts = [f, p, l].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : u.email;
}
