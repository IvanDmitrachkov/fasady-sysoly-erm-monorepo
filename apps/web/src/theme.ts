import { createTheme, type MantineColorsTuple } from "@mantine/core";

const brand: MantineColorsTuple = [
  "#e8f4fc",
  "#cce6f7",
  "#99cdef",
  "#66b3e7",
  "#339adf",
  "#0680d1",
  "#0566a7",
  "#044d7d",
  "#023354",
  "#011a2a",
];

export const theme = createTheme({
  primaryColor: "brand",
  colors: { brand },
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  defaultRadius: "md",
});
