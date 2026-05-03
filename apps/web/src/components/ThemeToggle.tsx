import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";

export function ThemeToggle() {
  const { toggleColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computed === "dark";

  return (
    <Tooltip label={isDark ? "Светлая тема" : "Тёмная тема"}>
      <ActionIcon
        variant="default"
        size="lg"
        onClick={() => toggleColorScheme()}
        aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      >
        {isDark ? <IconSun size={18} stroke={1.5} /> : <IconMoon size={18} stroke={1.5} />}
      </ActionIcon>
    </Tooltip>
  );
}
