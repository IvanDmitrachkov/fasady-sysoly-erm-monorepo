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

/** Акцент: бирюза / циан (графики, CTA) */
const brand: MantineColorsTuple = [
  "#e7fdf9",
  "#c6faf1",
  "#96f0e0",
  "#5ee0cd",
  "#2dd4bf",
  "#14b8a6",
  "#0d9488",
  "#0f766e",
  "#115e59",
  "#134e4a",
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
  /** Лёгкие тени — без «пластикового» эффекта */
  shadows: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.35)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.45)",
    md: "0 4px 12px rgba(0, 0, 0, 0.45)",
    lg: "0 8px 24px rgba(0, 0, 0, 0.5)",
    xl: "0 12px 40px rgba(0, 0, 0, 0.55)",
  },
  headings: {
    fontWeight: "600",
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
        shadow: "xs",
      },
    },
  },
});
