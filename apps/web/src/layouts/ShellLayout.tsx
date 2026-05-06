import { type ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ActionIcon,
  AppShell,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
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
  IconArchive,
  IconBolt,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClockHour4,
  IconFileAnalytics,
  IconFolders,
  IconHelpCircle,
  IconHome2,
  IconInfoCircle,
  IconLayoutColumns,
  IconLayoutKanban,
  IconLogout,
  IconMenu2,
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
import "./ShellLayout.css";

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

const NAVBAR_COLLAPSED_KEY = "erm_navbar_collapsed";

function MobileBottomAction({
  label,
  icon,
  active,
  to,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  to?: string;
  onClick?: () => void;
}) {
  const content = (
    <Stack gap={4} align="center">
      <ThemeIcon variant={active ? "light" : "transparent"} color={active ? "blue" : "gray"} size={30} radius="xl">
        {icon}
      </ThemeIcon>
      <Text size="xs" fw={active ? 600 : 500} c={active ? "blue" : "dimmed"} ta="center" lh={1.1}>
        {label}
      </Text>
    </Stack>
  );

  const styles = {
    borderRadius: "var(--mantine-radius-lg)",
    padding: "6px 4px",
  };

  if (to) {
    return (
      <UnstyledButton component={RouterLink} to={to} style={styles} onClick={onClick}>
        {content}
      </UnstyledButton>
    );
  }

  return (
    <UnstyledButton type="button" style={styles} onClick={onClick}>
      {content}
    </UnstyledButton>
  );
}

export function ShellLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileMenuOpened, { open: openMobileMenu, close: closeMobileMenu }] = useDisclosure(false);
  const [navbarCollapsed, setNavbarCollapsed] = useState(
    () => localStorage.getItem(NAVBAR_COLLAPSED_KEY) === "true",
  );
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });

  const rel = pathBelowAdmin(pathname);
  const newOrderNavActive = rel === "/orders/new";
  const ordersNavActive =
    rel === "/orders" ||
    (rel.startsWith("/orders/") &&
      !newOrderNavActive &&
      !rel.startsWith("/orders/board") &&
      !rel.startsWith("/orders/archive"));
  const boardShopFloorActive = rel === "/orders/board";
  const boardStationActive = rel === "/orders/board/station";
  const archiveNavActive = rel === "/orders/archive";
  const timeReportNavActive = rel === "/time-report";
  const reportsNavActive = rel === "/reports";
  const activityNavActive = rel === "/activity";
  const customersNavActive = rel === "/customers";
  const usersNavActive = rel === "/users";
  const stagesNavActive = rel === "/stages";
  const facadeCatalogNavActive = rel === "/facade-catalog";
  const auditNavActive = rel === "/audit";
  const helpNavActive = rel === "/help";
  const aboutNavActive = rel === "/about";

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
  const canCreateOrder = user?.role === "ADMIN";
  const canStationBoard = user?.role === "ADMIN" || user?.role === "WORKER";
  const canTimeReport = user?.role === "ADMIN" || user?.role === "WORKER";
  const isDark = computedColorScheme === "dark";
  const logout = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    void navigate("/login", { replace: true });
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: navbarCollapsed ? 76 : 260, breakpoint: "sm", collapsed: { mobile: true } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Title order={4}>ERM</Title>
          </Group>
          {user ? (
            <Group gap="sm" visibleFrom="sm">
              {canCreateOrder ? (
                <Button component={RouterLink} to="/orders/new" size="sm" leftSection={<IconPlus size={18} />} fw={600}>
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
                    onClick={logout}
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
                onClick={() =>
                  setNavbarCollapsed((v) => {
                    const next = !v;
                    localStorage.setItem(NAVBAR_COLLAPSED_KEY, String(next));
                    return next;
                  })
                }
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
              label={navbarCollapsed ? null : "По цеху"}
              component={RouterLink}
              to="/orders/board"
              active={boardShopFloorActive}
              leftSection={navIcon(<IconLayoutKanban size={16} />, "cyan")}
              styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
            />
            {canStationBoard ? (
              <NavLink
                label={navbarCollapsed ? null : "На участке"}
                component={RouterLink}
                to="/orders/board/station"
                active={boardStationActive}
                leftSection={navIcon(<IconLayoutColumns size={16} />, "cyan")}
                styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
              />
            ) : null}
            <NavLink
              label={navbarCollapsed ? null : "Архив"}
              component={RouterLink}
              to="/orders/archive"
              active={archiveNavActive}
              leftSection={navIcon(<IconArchive size={16} />, "gray")}
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
                  label={navbarCollapsed ? null : "Активность"}
                  component={RouterNavLink}
                  to="/activity"
                  active={activityNavActive}
                  leftSection={navIcon(<IconBolt size={16} />, "yellow")}
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

          <NavGroup label="Система" collapsed={navbarCollapsed}>
            <NavLink
              label={navbarCollapsed ? null : "О сервисе"}
              component={RouterNavLink}
              to="/about"
              active={aboutNavActive}
              leftSection={navIcon(<IconInfoCircle size={16} />, "blue")}
              styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
            />
            <NavLink
              label={navbarCollapsed ? null : "Инструкция"}
              component={RouterNavLink}
              to="/help"
              active={helpNavActive}
              leftSection={navIcon(<IconHelpCircle size={16} />, "green")}
              styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
            />
            {isAdmin ? (
              <NavLink
                label={navbarCollapsed ? null : "Журнал"}
                component={RouterNavLink}
                to="/audit"
                active={auditNavActive}
                leftSection={navIcon(<IconFileAnalytics size={16} />, "red")}
                styles={{ body: { display: navbarCollapsed ? "none" : undefined } }}
              />
            ) : null}
          </NavGroup>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className="shell-layout-main">
        <Outlet />
      </AppShell.Main>

      <Drawer
        opened={mobileMenuOpened}
        onClose={closeMobileMenu}
        position="bottom"
        size="85%"
        title="Меню"
        hiddenFrom="sm"
      >
        <Stack gap="md" pb="md">
          {user ? (
            <Stack gap="sm">
              <Group gap="sm">
                <Avatar size={42} radius="xl" color="blue">
                  {userDisplayName(user).slice(0, 1).toUpperCase()}
                </Avatar>
                <Box>
                  <Text fw={600}>{userDisplayName(user)}</Text>
                  <Text size="xs" c="dimmed">
                    {user.role}
                  </Text>
                </Box>
              </Group>
              <Group grow>
                <Button component={RouterLink} to="/profile" variant="light" onClick={closeMobileMenu}>
                  Профиль
                </Button>
                <Button
                  variant="default"
                  leftSection={isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
                  onClick={() => toggleColorScheme()}
                >
                  Сменить тему
                </Button>
              </Group>
            </Stack>
          ) : null}

          <Divider />

          <Stack gap={4}>
            <NavLink
              label="Главная"
              component={RouterNavLink}
              to="/"
              end
              onClick={closeMobileMenu}
              leftSection={navIcon(<IconHome2 size={16} />, "gray")}
            />
            <NavLink
              label="Архив"
              component={RouterLink}
              to="/orders/archive"
              active={archiveNavActive}
              onClick={closeMobileMenu}
              leftSection={navIcon(<IconArchive size={16} />, "gray")}
            />
          </Stack>

          {canTimeReport || isAdmin ? (
            <NavGroup label="Аналитика" collapsed={false}>
              {isAdmin ? (
                <NavLink
                  label="Отчёты"
                  component={RouterNavLink}
                  to="/reports"
                  active={reportsNavActive}
                  onClick={closeMobileMenu}
                  leftSection={navIcon(<IconReportAnalytics size={16} />, "violet")}
                />
              ) : null}
              {canTimeReport ? (
                <NavLink
                  label="Активность"
                  component={RouterNavLink}
                  to="/activity"
                  active={activityNavActive}
                  onClick={closeMobileMenu}
                  leftSection={navIcon(<IconBolt size={16} />, "yellow")}
                />
              ) : null}
              {canTimeReport ? (
                <NavLink
                  label="Трудозатраты"
                  component={RouterNavLink}
                  to="/time-report"
                  active={timeReportNavActive}
                  onClick={closeMobileMenu}
                  leftSection={navIcon(<IconClockHour4 size={16} />, "orange")}
                />
              ) : null}
            </NavGroup>
          ) : null}

          {isAdmin ? (
            <NavGroup label="Администрирование" collapsed={false}>
              <NavLink
                label="Заказчики"
                component={RouterNavLink}
                to="/customers"
                active={customersNavActive}
                onClick={closeMobileMenu}
                leftSection={navIcon(<IconUserSquareRounded size={16} />, "teal")}
              />
              <NavLink
                label="Пользователи"
                component={RouterNavLink}
                to="/users"
                active={usersNavActive}
                onClick={closeMobileMenu}
                leftSection={navIcon(<IconUsers size={16} />, "indigo")}
              />
              <NavLink
                label="Этапы"
                component={RouterNavLink}
                to="/stages"
                active={stagesNavActive}
                onClick={closeMobileMenu}
                leftSection={navIcon(<IconFolders size={16} />, "grape")}
              />
              <NavLink
                label="Фасады: справочники"
                component={RouterNavLink}
                to="/facade-catalog"
                active={facadeCatalogNavActive}
                onClick={closeMobileMenu}
                leftSection={navIcon(<IconFolders size={16} />, "pink")}
              />
            </NavGroup>
          ) : null}

          <NavGroup label="Система" collapsed={false}>
            <NavLink
              label="О сервисе"
              component={RouterNavLink}
              to="/about"
              active={aboutNavActive}
              onClick={closeMobileMenu}
              leftSection={navIcon(<IconInfoCircle size={16} />, "blue")}
            />
            <NavLink
              label="Инструкция"
              component={RouterNavLink}
              to="/help"
              active={helpNavActive}
              onClick={closeMobileMenu}
              leftSection={navIcon(<IconHelpCircle size={16} />, "green")}
            />
            {isAdmin ? (
              <NavLink
                label="Журнал"
                component={RouterNavLink}
                to="/audit"
                active={auditNavActive}
                onClick={closeMobileMenu}
                leftSection={navIcon(<IconFileAnalytics size={16} />, "red")}
              />
            ) : null}
          </NavGroup>

          {user ? (
            <Button color="red" variant="light" leftSection={<IconLogout size={16} />} onClick={logout}>
              Выйти
            </Button>
          ) : null}
        </Stack>
      </Drawer>

      <Box hiddenFrom="sm" className="shell-layout-mobile-tabs">
        <Group grow gap={4} align="stretch">
          <MobileBottomAction
            label="Заказы"
            to="/orders"
            active={ordersNavActive}
            icon={<IconShoppingCart size={18} />}
          />
          <MobileBottomAction
            label="По цеху"
            to="/orders/board"
            active={boardShopFloorActive}
            icon={<IconLayoutKanban size={18} />}
          />
          {canStationBoard ? (
            <MobileBottomAction
              label="На участке"
              to="/orders/board/station"
              active={boardStationActive}
              icon={<IconLayoutColumns size={18} />}
            />
          ) : null}
          {canCreateOrder ? (
            <MobileBottomAction
              label="Новый заказ"
              to="/orders/new"
              active={newOrderNavActive}
              icon={<IconPlus size={22} />}
            />
          ) : null}
          <MobileBottomAction label="Открыть меню" icon={<IconMenu2 size={18} />} onClick={openMobileMenu} />
        </Group>
      </Box>
    </AppShell>
  );
}
