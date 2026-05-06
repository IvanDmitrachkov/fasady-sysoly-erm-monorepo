import { createTheme, type MantineColorsTuple } from "@mantine/core";

/** Тёмная база в духе fintech-референса: уголь ~#1a1d23 */
const dark: MantineColorsTuple = [
  "#f1f3f5",
  "#e9ecef",
  "#ced4da",
  "#868e96",
  "#495057",
  "#3d4450",
  "#2d323c",
  "#1a1d23",
  "#12141a",
  "#0a0b0e",
];

/** Основной акцент: дорогой холодный графит для монохромного UI. */
const brand: MantineColorsTuple = [
  "#f3f5f8",
  "#e4e8ee",
  "#cbd3df",
  "#aeb9c8",
  "#8795aa",
  "#66758d",
  "#4a5668",
  "#343d4a",
  "#232a34",
  "#151a21",
];

/** Вторичный акцент — янтарь / золото для вторых линий и метрик */
const accentGold: MantineColorsTuple = [
  "#fffbeb",
  "#fef3c7",
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#d97706",
  "#b45309",
  "#92400e",
  "#78350f",
];

/** Третичный — приглушённый фиолетовый для графиков / меток */
const accentViolet: MantineColorsTuple = [
  "#f5f3ff",
  "#ede9fe",
  "#ddd6fe",
  "#c4b5fd",
  "#a78bfa",
  "#8b5cf6",
  "#7c3aed",
  "#6d28d9",
  "#5b21b6",
  "#4c1d95",
];

export const theme = createTheme({
  primaryColor: "brand",
  colors: {
    dark,
    brand,
    accentGold,
    accentViolet,
  },
  fontFamily:
    'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
  defaultRadius: "md",
  /** Мягкие тени для светлой ERP-темы: акцент на границы, а не на глубину. */
  shadows: {
    xs: "0 1px 2px rgba(15, 23, 42, 0.04)",
    sm: "0 2px 8px rgba(15, 23, 42, 0.06)",
    md: "0 8px 24px rgba(15, 23, 42, 0.08)",
    lg: "0 12px 32px rgba(15, 23, 42, 0.1)",
    xl: "0 18px 48px rgba(15, 23, 42, 0.12)",
  },
  headings: {
    fontWeight: "500",
    sizes: {
      h1: { fontSize: "2rem", lineHeight: "1.25" },
      h2: { fontSize: "1.5rem", lineHeight: "1.35" },
      h3: { fontSize: "1.25rem", lineHeight: "1.4" },
      h4: { fontSize: "1.05rem", lineHeight: "1.45" },
    },
  },
  components: {
    Button: {
      defaultProps: {
        radius: "xl",
      },
    },
    Input: {
      defaultProps: {
        autoComplete: "off",
      },
    },
    TextInput: {
      defaultProps: {
        radius: "md",
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: "md",
      },
    },
    Paper: {
      defaultProps: {
        radius: "md",
      },
    },
  },
});
