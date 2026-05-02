import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, Burger, Button, Group, NavLink, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { NavLink as RouterNavLink, Outlet, useNavigate } from "react-router-dom";
import { meRequest } from "../api/auth";
import { ACCESS_TOKEN_KEY, ApiError } from "../api/http";

export function ShellLayout() {
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
  const isAdmin = user?.role === "ADMIN";

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
        <NavLink label="Главная" component={RouterNavLink} to="/" end />
        <NavLink label="Заказы" component={RouterNavLink} to="/orders" />
        {isAdmin ? <NavLink label="Заказчики" component={RouterNavLink} to="/customers" /> : null}
        {isAdmin ? <NavLink label="Журнал (audit)" component={RouterNavLink} to="/audit" /> : null}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
