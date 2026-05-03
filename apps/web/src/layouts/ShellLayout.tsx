import { type ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AppShell,
  Avatar,
  Burger,
  Button,
  Divider,
  Group,
  Menu,
  NavLink,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconChevronDown,
  IconClockHour4,
  IconFileAnalytics,
  IconFolders,
  IconHome2,
  IconLayoutKanban,
  IconLogout,
  IconMoon,
  IconPlus,
  IconReportAnalytics,
  IconShoppingCart,
  IconSun,
  IconUsers,
  IconUserCircle,
  IconUserSquareRounded,
} from "@tabler/icons-react";
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

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={6}>
      <Divider label={label} labelPosition="left" />
      <Stack gap={2}>{children}</Stack>
    </Stack>
  );
}

function navIcon(icon: ReactNode, color: string) {
  return (
    <ThemeIcon variant="light" color={color} size={28} radius="md">
      {icon}
    </ThemeIcon>
  );
}

export function ShellLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [opened, { toggle }] = useDisclosure();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });

  const rel = pathBelowAdmin(pathname);
  const ordersNavActive =
    rel === "/orders" || (rel.startsWith("/orders/") && !rel.startsWith("/orders/board"));
  const kanbanNavActive = rel === "/orders/board";
  const timeReportNavActive = rel === "/time-report";
  const reportsNavActive = rel === "/reports";
  const customersNavActive = rel === "/customers";
  const usersNavActive = rel === "/users";
  const stagesNavActive = rel === "/stages";
  const facadeCatalogNavActive = rel === "/facade-catalog";
  const auditNavActive = rel === "/audit";

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
  const canCreateOrder = user?.role === "ADMIN" || user?.role === "WORKER";
  const canTimeReport = user?.role === "ADMIN" || user?.role === "WORKER";
  const isDark = computedColorScheme === "dark";

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
              {canCreateOrder ? (
                <Button component={RouterLink} to="/orders/new" size="xs" leftSection={<IconPlus size={16} />}>
                  Новый заказ
                </Button>
              ) : null}
              <Menu position="bottom-end" width={220} shadow="md">
                <Menu.Target>
                  <UnstyledButton>
                    <Group gap="xs">
                      <Avatar size={30} radius="xl" color="blue">
                        {userDisplayName(user).slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Text size="sm" fw={500}>
                        {userDisplayName(user)}
                      </Text>
                      <IconChevronDown size={16} stroke={1.5} />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{user.role}</Menu.Label>
                  <Menu.Item component={RouterLink} to="/profile" leftSection={<IconUserCircle size={16} />}>
                    Профиль
                  </Menu.Item>
                  <Menu.Item
                    leftSection={isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
                    onClick={() => toggleColorScheme()}
                  >
                    Сменить тему
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={16} />}
                    onClick={() => {
                      localStorage.removeItem(ACCESS_TOKEN_KEY);
                      void navigate("/login", { replace: true });
                    }}
                  >
                    Выйти
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          ) : null}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="md">
          <NavLink
            label="Главная"
            component={RouterNavLink}
            to="/"
            end
            leftSection={navIcon(<IconHome2 size={16} />, "gray")}
          />

          <NavGroup label="Производство">
            <NavLink
              label="Заказы"
              component={RouterLink}
              to="/orders"
              active={ordersNavActive}
              leftSection={navIcon(<IconShoppingCart size={16} />, "blue")}
            />
            <NavLink
              label="Канбан"
              component={RouterLink}
              to="/orders/board"
              active={kanbanNavActive}
              leftSection={navIcon(<IconLayoutKanban size={16} />, "cyan")}
            />
          </NavGroup>

          {canTimeReport || isAdmin ? (
            <NavGroup label="Аналитика">
              {isAdmin ? (
                <NavLink
                  label="Отчёты"
                  component={RouterNavLink}
                  to="/reports"
                  active={reportsNavActive}
                  leftSection={navIcon(<IconReportAnalytics size={16} />, "violet")}
                />
              ) : null}
              {canTimeReport ? (
                <NavLink
                  label="Трудозатраты"
                  component={RouterNavLink}
                  to="/time-report"
                  active={timeReportNavActive}
                  leftSection={navIcon(<IconClockHour4 size={16} />, "orange")}
                />
              ) : null}
            </NavGroup>
          ) : null}

          {isAdmin ? (
            <NavGroup label="Администрирование">
              <NavLink
                label="Заказчики"
                component={RouterNavLink}
                to="/customers"
                active={customersNavActive}
                leftSection={navIcon(<IconUserSquareRounded size={16} />, "teal")}
              />
              <NavLink
                label="Пользователи"
                component={RouterNavLink}
                to="/users"
                active={usersNavActive}
                leftSection={navIcon(<IconUsers size={16} />, "indigo")}
              />
              <NavLink
                label="Этапы"
                component={RouterNavLink}
                to="/stages"
                active={stagesNavActive}
                leftSection={navIcon(<IconFolders size={16} />, "grape")}
              />
              <NavLink
                label="Фасады: справочники"
                component={RouterNavLink}
                to="/facade-catalog"
                active={facadeCatalogNavActive}
                leftSection={navIcon(<IconFolders size={16} />, "pink")}
              />
            </NavGroup>
          ) : null}

          {isAdmin ? (
            <NavGroup label="Система">
              <NavLink
                label="Журнал"
                component={RouterNavLink}
                to="/audit"
                active={auditNavActive}
                leftSection={navIcon(<IconFileAnalytics size={16} />, "red")}
              />
            </NavGroup>
          ) : null}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
