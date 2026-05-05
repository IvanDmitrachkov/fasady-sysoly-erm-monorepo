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

function orderWorkStateTone(slug: string | null | undefined): { textColor: string; bgColor: string; borderColor: string } {
  switch (slug) {
    case "queue":
      return {
        textColor: "var(--mantine-color-gray-8)",
        bgColor: "var(--mantine-color-gray-2)",
        borderColor: "var(--mantine-color-gray-4)",
      };
    case "in_progress":
      return {
        textColor: "var(--mantine-color-blue-8)",
        bgColor: "var(--mantine-color-blue-2)",
        borderColor: "var(--mantine-color-blue-4)",
      };
    case "blocked":
      return {
        textColor: "var(--mantine-color-red-8)",
        bgColor: "var(--mantine-color-red-2)",
        borderColor: "var(--mantine-color-red-4)",
      };
    case "ready":
      return {
        textColor: "var(--mantine-color-green-8)",
        bgColor: "var(--mantine-color-green-2)",
        borderColor: "var(--mantine-color-green-4)",
      };
    default:
      return {
        textColor: "var(--mantine-color-gray-8)",
        bgColor: "var(--mantine-color-gray-2)",
        borderColor: "var(--mantine-color-gray-4)",
      };
  }
}

export function orderWorkStateSelectStyles(slug: string | null | undefined): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const tone = orderWorkStateTone(slug);
  return {
    backgroundColor: tone.bgColor,
    color: tone.textColor,
    borderColor: tone.borderColor,
  };
}

export function orderWorkStateOptionTextColor(slug: string | null | undefined): string {
  return orderWorkStateTone(slug).textColor;
}
