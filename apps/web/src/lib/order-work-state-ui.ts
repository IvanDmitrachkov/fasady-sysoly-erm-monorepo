/** Цвет бейджа под-статуса на участке (slug из справочника). */
export function orderWorkStateBadgeColor(slug: string): string {
  switch (slug) {
    case "queue":
      return "gray";
    case "in_progress":
      return "blue";
    case "blocked":
      return "red";
    case "ready":
      return "teal";
    default:
      return "gray";
  }
}
