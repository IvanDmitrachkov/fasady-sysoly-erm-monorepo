import { type ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ActionIcon,
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
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
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

function NavGroup({ label, collapsed, children }: { label: string; collapsed: boolean; children: ReactNode }) {
  return (
    <Stack gap={collapsed ? 4 : 6}>
      <Divider label={collapsed ? undefined : label} labelPosition="left" />
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
  const [navbarCollapsed, setNavbarCollapsed] = useState(false);
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
      navbar={{ width: navbarCollapsed ? 76 : 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
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

      <AppShell.Navbar p={navbarCollapsed ? "xs" : "md"}>
        <Stack gap="md">
          <Group justify={navbarCollapsed ? "center" : "space-between"} gap="xs">
            {navbarCollapsed ? null : (
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Меню
              </Text>
            )}
            <Tooltip label={navbarCollapsed ? "Развернуть меню" : "Свернуть меню"} position="right">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setNavbarCollapsed((v) => !v)}
                aria-label={navbarCollapsed ? "Развернуть меню" : "Свернуть меню"}
              >
                {navbarCollapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
              </ActionIcon>
            </Tooltip>
          </Group>

          <NavLink
            label={navbarCollapsed ? null : "Главная"}
            component={RouterNavLink}
            to="/"
            end
            leftSection={navIcon(<IconHome2 size={16} />, "gray")}
            styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
          />

          <NavGroup label="Производство" collapsed={navbarCollapsed}>
            <NavLink
              label={navbarCollapsed ? null : "Заказы"}
              component={RouterLink}
              to="/orders"
              active={ordersNavActive}
              leftSection={navIcon(<IconShoppingCart size={16} />, "blue")}
              styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
            />
            <NavLink
              label={navbarCollapsed ? null : "Канбан"}
              component={RouterLink}
              to="/orders/board"
              active={kanbanNavActive}
              leftSection={navIcon(<IconLayoutKanban size={16} />, "cyan")}
              styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
            />
          </NavGroup>

          {canTimeReport || isAdmin ? (
            <NavGroup label="Аналитика" collapsed={navbarCollapsed}>
              {isAdmin ? (
                <NavLink
                  label={navbarCollapsed ? null : "Отчёты"}
                  component={RouterNavLink}
                  to="/reports"
                  active={reportsNavActive}
                  leftSection={navIcon(<IconReportAnalytics size={16} />, "violet")}
                  styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
                />
              ) : null}
              {canTimeReport ? (
                <NavLink
                  label={navbarCollapsed ? null : "Трудозатраты"}
                  component={RouterNavLink}
                  to="/time-report"
                  active={timeReportNavActive}
                  leftSection={navIcon(<IconClockHour4 size={16} />, "orange")}
                  styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
                />
              ) : null}
            </NavGroup>
          ) : null}

          {isAdmin ? (
            <NavGroup label="Администрирование" collapsed={navbarCollapsed}>
              <NavLink
                label={navbarCollapsed ? null : "Заказчики"}
                component={RouterNavLink}
                to="/customers"
                active={customersNavActive}
                leftSection={navIcon(<IconUserSquareRounded size={16} />, "teal")}
                styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
              />
              <NavLink
                label={navbarCollapsed ? null : "Пользователи"}
                component={RouterNavLink}
                to="/users"
                active={usersNavActive}
                leftSection={navIcon(<IconUsers size={16} />, "indigo")}
                styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
              />
              <NavLink
                label={navbarCollapsed ? null : "Этапы"}
                component={RouterNavLink}
                to="/stages"
                active={stagesNavActive}
                leftSection={navIcon(<IconFolders size={16} />, "grape")}
                styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
              />
              <NavLink
                label={navbarCollapsed ? null : "Фасады: справочники"}
                component={RouterNavLink}
                to="/facade-catalog"
                active={facadeCatalogNavActive}
                leftSection={navIcon(<IconFolders size={16} />, "pink")}
                styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
              />
            </NavGroup>
          ) : null}

          {isAdmin ? (
            <NavGroup label="Система" collapsed={navbarCollapsed}>
              <NavLink
                label={navbarCollapsed ? null : "Журнал"}
                component={RouterNavLink}
                to="/audit"
                active={auditNavActive}
                leftSection={navIcon(<IconFileAnalytics size={16} />, "red")}
                styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
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
