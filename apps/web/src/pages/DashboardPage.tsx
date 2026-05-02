import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, Burger, Button, Group, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { meRequest } from "../api/auth";
import { ACCESS_TOKEN_KEY, ApiError } from "../api/http";

export function DashboardPage() {
  const navigate = useNavigate();
  const [opened, { toggle }] = useDisclosure();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: meRequest,
  });

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      void navigate("/login", { replace: true });
    }
  }, [me.error, navigate]);

  const user = me.data?.user;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>ERM</Title>
          </Group>
          {user ? (
            <Group gap="sm">
              <Text size="sm" c="dimmed">
                {user.email} · {user.role}
              </Text>
              <Button
                size="xs"
                variant="default"
                onClick={() => {
                  localStorage.removeItem(ACCESS_TOKEN_KEY);
                  void navigate("/login", { replace: true });
                }}
              >
                Выйти
              </Button>
            </Group>
          ) : null}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Text size="sm" c="dimmed">
          Навигация — в следующих задачах
        </Text>
      </AppShell.Navbar>

      <AppShell.Main>
        <Title order={3}>Рабочий стол</Title>
        <Text mt="md" c="dimmed">
          {me.isPending ? "Загрузка…" : null}
          {me.isError && !(me.error instanceof ApiError && me.error.status === 401)
            ? `Ошибка: ${me.error instanceof Error ? me.error.message : "unknown"}`
            : null}
        </Text>
        {user ? (
          <Text mt="sm">
            Сессия: сегодня {dayjs().format("D MMMM YYYY, HH:mm")}
          </Text>
        ) : null}
      </AppShell.Main>
    </AppShell>
  );
}
