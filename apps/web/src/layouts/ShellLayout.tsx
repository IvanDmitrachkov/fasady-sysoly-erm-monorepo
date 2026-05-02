import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, Burger, Button, Group, NavLink, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link as RouterLink, NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { meRequest } from "../api/auth";
import { userDisplayName } from "../lib/user-display-name";
import { ACCESS_TOKEN_KEY, ApiError } from "../api/http";

/** Путь без префикса basename (`/admin`), как в маршрутизаторе. */
function pathBelowAdmin(pathname: string): string {
  const m = pathname.match(/^\/admin(\/.*)?$/);
  if (m?.[1]) return m[1];
  if (pathname === "/admin" || pathname === "/admin/") return "/";
  return pathname;
}

export function ShellLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [opened, { toggle }] = useDisclosure();

  const rel = pathBelowAdmin(pathname);
  const ordersNavActive =
    rel === "/orders" || (rel.startsWith("/orders/") && !rel.startsWith("/orders/board"));
  const kanbanNavActive = rel === "/orders/board";

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
                {userDisplayName(user)} · {user.role}
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
        <NavLink label="Заказы" component={RouterLink} to="/orders" active={ordersNavActive} />
        <NavLink label="Канбан" component={RouterLink} to="/orders/board" active={kanbanNavActive} />
        {isAdmin ? <NavLink label="Этапы" component={RouterNavLink} to="/stages" /> : null}
        {isAdmin ? <NavLink label="Пользователи" component={RouterNavLink} to="/users" /> : null}
        {isAdmin ? <NavLink label="Заказчики" component={RouterNavLink} to="/customers" /> : null}
        {isAdmin ? <NavLink label="Журнал (audit)" component={RouterNavLink} to="/audit" /> : null}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
