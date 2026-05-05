/** Цвет бейджа/селекта под-статуса на участке (по slug из справочника). */
export function orderWorkStateBadgeColor(slug: string | null | undefined): string {
  switch (slug) {
    case "queue":
      return "gray";
    case "in_progress":
      return "blue";
    case "blocked":
      return "red";
    case "ready":
      return "green";
    default:
      return "gray";
  }
}

export function orderWorkStateSelectStyles(slug: string | null | undefined): { bg: string; color: string } {
  switch (slug) {
    case "queue":
      return { bg: "var(--mantine-color-gray-1)", color: "var(--mantine-color-gray-8)" };
    case "in_progress":
      return { bg: "var(--mantine-color-blue-1)", color: "var(--mantine-color-blue-8)" };
    case "blocked":
      return { bg: "var(--mantine-color-red-1)", color: "var(--mantine-color-red-8)" };
    case "ready":
      return { bg: "var(--mantine-color-green-1)", color: "var(--mantine-color-green-8)" };
    default:
      return { bg: "var(--mantine-color-gray-1)", color: "var(--mantine-color-gray-8)" };
  }
}
