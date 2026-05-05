import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  IconArrowDown,
  IconArrowUp,
  IconChartBar,
  IconFilter,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { salesReport, type SalesReportHandleFilter } from "../api/reports";
import { meRequest } from "../api/auth";
import { customersList } from "../api/customers";
import { money } from "../lib/order-form";
import "./ReportsPage.css";

const area = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CHART_COLORS = ["#4c6ef5", "#12b886", "#f59f00", "#e64980", "#7950f2", "#228be6", "#fa5252"];

type TableMode = "facades" | "orders";
type SortDirection = "asc" | "desc";
type FacadeSortKey = "orderNumber" | "completedAt" | "customer" | "coating" | "milling" | "color" | "areaM2";
type OrderSortKey = "orderNumber" | "completedAt" | "customer" | "facadeCount" | "facadeAreaTotal" | "totalCost";

type FacadeSortState = { key: FacadeSortKey; dir: SortDirection };
type OrderSortState = { key: OrderSortKey; dir: SortDirection };

function formatDate(value: string | null): string {
  return value ? dayjs(value).format("DD.MM.YYYY") : "—";
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "ru", { sensitivity: "base" });
}

function compareNullableDate(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return dayjs(a).valueOf() - dayjs(b).valueOf();
}

function kpiDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function PeriodPreset({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: "today" | "week" | "month" | "quarter" | "custom") => void;
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as "today" | "week" | "month" | "quarter" | "custom")}
      data={[
        { value: "today", label: "Сегодня" },
        { value: "week", label: "7 дней" },
        { value: "month", label: "Месяц" },
        { value: "quarter", label: "Квартал" },
        { value: "custom", label: "Период" },
      ]}
      className="reports-segmented"
    />
  );
}

function KpiCard({
  title,
  value,
  delta,
}: {
  title: string;
  value: string;
  delta: number;
}) {
  const positive = delta >= 0;
  return (
    <Paper withBorder p="md" radius="md" className="reports-kpi-card">
      <Text size="sm" c="dimmed">
        {title}
      </Text>
      <Text mt={4} size="xl" fw={700}>
        {value}
      </Text>
      <Badge
        mt="sm"
        variant="light"
        color={positive ? "green" : "red"}
        leftSection={positive ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />}
      >
        {`${positive ? "+" : ""}${(Math.round(delta * 10) / 10).toFixed(1)}% к пред. периоду`}
      </Badge>
      <div className="reports-kpi-accent" />
    </Paper>
  );
}

function SortHeader({
  active,
  dir,
  title,
  onClick,
}: {
  active: boolean;
  dir: SortDirection;
  title: string;
  onClick: () => void;
}) {
  return (
    <UnstyledButton onClick={onClick} className="reports-sort-header">
      <span>{title}</span>
      <span className="reports-sort-arrow">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
    </UnstyledButton>
  );
}

export function ReportsPage() {
  const now = dayjs();
  const [periodFrom, setPeriodFrom] = useState<Date | null>(now.startOf("month").toDate());
  const [periodTo, setPeriodTo] = useState<Date | null>(now.endOf("day").toDate());
  const [periodPreset, setPeriodPreset] = useState<"today" | "week" | "month" | "quarter" | "custom">("month");
  const [reportType, setReportType] = useState<string | null>("sales");
  const [coatingTypeId, setCoatingTypeId] = useState<string | null>(null);
  const [millingLabel, setMillingLabel] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [handle, setHandle] = useState<SalesReportHandleFilter | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [tableMode, setTableMode] = useState<TableMode>("facades");
  const [search, setSearch] = useState("");
  const [facadeSort, setFacadeSort] = useState<FacadeSortState>({ key: "completedAt", dir: "desc" });
  const [orderSort, setOrderSort] = useState<OrderSortState>({ key: "completedAt", dir: "desc" });

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const isAdmin = me.data?.user.role === "ADMIN";

  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: customersList,
    enabled: isAdmin,
  });

  const fromIso = periodFrom ? dayjs(periodFrom).startOf("day").toISOString() : "";
  const toIso = periodTo ? dayjs(periodTo).endOf("day").toISOString() : "";
  const fromDay = periodFrom ? dayjs(periodFrom).startOf("day") : null;
  const toDay = periodTo ? dayjs(periodTo).endOf("day") : null;
  const periodDurationMs = fromDay && toDay ? toDay.valueOf() - fromDay.valueOf() + 1 : 0;
  const prevToIso = fromDay ? fromDay.subtract(1, "millisecond").toISOString() : "";
  const prevFromIso = fromDay ? dayjs(prevToIso).subtract(periodDurationMs - 1, "millisecond").toISOString() : "";

  const report = useQuery({
    queryKey: ["salesReport", fromIso, toIso, coatingTypeId, millingLabel, color, handle, customerId],
    queryFn: () =>
      salesReport({
        from: fromIso,
        to: toIso,
        ...(coatingTypeId ? { coatingTypeId } : {}),
        ...(millingLabel ? { millingLabel } : {}),
        ...(color ? { color } : {}),
        ...(handle ? { handle } : {}),
        ...(customerId ? { customerId } : {}),
      }),
    enabled: isAdmin && reportType === "sales" && !!fromIso && !!toIso,
  });

  const previousReport = useQuery({
    queryKey: ["salesReportPrevious", prevFromIso, prevToIso, coatingTypeId, millingLabel, color, handle, customerId],
    queryFn: () =>
      salesReport({
        from: prevFromIso,
        to: prevToIso,
        ...(coatingTypeId ? { coatingTypeId } : {}),
        ...(millingLabel ? { millingLabel } : {}),
        ...(color ? { color } : {}),
        ...(handle ? { handle } : {}),
        ...(customerId ? { customerId } : {}),
      }),
    enabled: isAdmin && reportType === "sales" && !!prevFromIso && !!prevToIso,
  });

  const coatingOptions = (report.data?.filters.coatings ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const millingOptions = (report.data?.filters.millingLabels ?? []).map((m) => ({ value: m, label: m }));
  const colorOptions = (report.data?.filters.colors ?? []).map((c) => ({ value: c, label: c }));
  const customerOptions = (customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name }));
  const activeFilters = [
    customerId ? { key: "customer", label: `Заказчик: ${customerOptions.find((c) => c.value === customerId)?.label ?? "Выбран"}` } : null,
    coatingTypeId ? { key: "coating", label: `Покрытие: ${coatingOptions.find((c) => c.value === coatingTypeId)?.label ?? "Выбрано"}` } : null,
    millingLabel ? { key: "milling", label: `Фрезеровка: ${millingLabel}` } : null,
    color ? { key: "color", label: `Цвет: ${color}` } : null,
    handle ? { key: "handle", label: `Ручка: ${handle === "with" ? "С ручкой" : "Без ручки"}` } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const dailyRevenue = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of report.data?.orders ?? []) {
      const key = row.completedAt ? dayjs(row.completedAt).format("YYYY-MM-DD") : "no-date";
      if (key === "no-date") continue;
      map.set(key, (map.get(key) ?? 0) + (row.totalCost ?? 0));
    }
    return Array.from(map.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [report.data]);

  const coatingChartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of report.data?.facades ?? []) {
      map.set(row.coatingType.name, (map.get(row.coatingType.name) ?? 0) + row.quantity);
    }
    return Array.from(map.entries())
      .map(([name, value], idx) => ({ name, value, color: CHART_COLORS[idx % CHART_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [report.data]);

  const filteredFacades = useMemo(() => {
    const list = [...(report.data?.facades ?? [])].filter((row) => {
      if (!search.trim()) return true;
      const needle = search.toLowerCase().trim();
      return (
        row.orderNumberFormatted.toLowerCase().includes(needle) ||
        row.customer.name.toLowerCase().includes(needle) ||
        row.coatingType.name.toLowerCase().includes(needle) ||
        row.millingLabel.toLowerCase().includes(needle) ||
        row.color.toLowerCase().includes(needle)
      );
    });
    list.sort((a, b) => {
      const cmp =
        facadeSort.key === "orderNumber"
          ? compareValues(a.orderNumber, b.orderNumber)
          : facadeSort.key === "completedAt"
            ? compareNullableDate(a.completedAt, b.completedAt)
            : facadeSort.key === "customer"
              ? compareValues(a.customer.name, b.customer.name)
              : facadeSort.key === "coating"
                ? compareValues(a.coatingType.name, b.coatingType.name)
                : facadeSort.key === "milling"
                  ? compareValues(a.millingLabel, b.millingLabel)
                  : facadeSort.key === "color"
                    ? compareValues(a.color || "", b.color || "")
                    : compareValues(a.areaM2, b.areaM2);
      return facadeSort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [report.data, search, facadeSort]);

  const filteredOrders = useMemo(() => {
    const list = [...(report.data?.orders ?? [])].filter((row) => {
      if (!search.trim()) return true;
      const needle = search.toLowerCase().trim();
      return row.orderNumberFormatted.toLowerCase().includes(needle) || row.customer.name.toLowerCase().includes(needle);
    });
    list.sort((a, b) => {
      const cmp =
        orderSort.key === "orderNumber"
          ? compareValues(a.orderNumber, b.orderNumber)
          : orderSort.key === "completedAt"
            ? compareNullableDate(a.completedAt, b.completedAt)
            : orderSort.key === "customer"
              ? compareValues(a.customer.name, b.customer.name)
              : orderSort.key === "facadeCount"
                ? compareValues(a.facadeCount, b.facadeCount)
                : orderSort.key === "facadeAreaTotal"
                  ? compareValues(a.facadeAreaTotal, b.facadeAreaTotal)
                  : compareValues(a.totalCost ?? 0, b.totalCost ?? 0);
      return orderSort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [report.data, search, orderSort]);

  const setPresetPeriod = (preset: "today" | "week" | "month" | "quarter" | "custom") => {
    setPeriodPreset(preset);
    if (preset === "custom") return;
    const current = dayjs();
    if (preset === "today") {
      setPeriodFrom(current.startOf("day").toDate());
      setPeriodTo(current.endOf("day").toDate());
      return;
    }
    if (preset === "week") {
      setPeriodFrom(current.subtract(6, "day").startOf("day").toDate());
      setPeriodTo(current.endOf("day").toDate());
      return;
    }
    if (preset === "month") {
      setPeriodFrom(current.startOf("month").toDate());
      setPeriodTo(current.endOf("day").toDate());
      return;
    }
    setPeriodFrom(current.startOf("quarter").toDate());
    setPeriodTo(current.endOf("day").toDate());
  };

  const clearFilter = (key: string) => {
    if (key === "customer") setCustomerId(null);
    if (key === "coating") setCoatingTypeId(null);
    if (key === "milling") setMillingLabel(null);
    if (key === "color") setColor(null);
    if (key === "handle") setHandle(null);
  };

  const resetFilters = () => {
    setPresetPeriod("month");
    setCoatingTypeId(null);
    setMillingLabel(null);
    setColor(null);
    setHandle(null);
    setCustomerId(null);
    setSearch("");
  };

  const applyFacadeSort = (key: FacadeSortKey) => {
    setFacadeSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const applyOrderSort = (key: OrderSortKey) => {
    setOrderSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  if (me.isSuccess && !isAdmin) {
    return <Text c="dimmed">Отчёты доступны только администратору.</Text>;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={3}>Отчёты</Title>
          <Text c="dimmed" size="sm" mt={4}>
            Аналитика реализации заказов и фасадов
          </Text>
        </div>
        <Select
          label="Тип отчёта"
          data={[{ value: "sales", label: "Реализация и сумма заказов" }]}
          value={reportType}
          onChange={setReportType}
          clearable={false}
          w={280}
        />
      </Group>

      <Paper withBorder p="md" radius="md" className="reports-filters-panel">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Stack gap={4}>
              <Group gap="xs">
                <IconFilter size={16} />
                <Text fw={600}>Фильтры</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Период: {fromIso ? dayjs(fromIso).format("DD.MM.YYYY") : "—"} - {toIso ? dayjs(toIso).format("DD.MM.YYYY") : "—"}
              </Text>
            </Stack>
            <Group gap="xs">
              <Button variant="default" onClick={resetFilters}>
                Сбросить все
              </Button>
              <Button
                variant={showAdvancedFilters ? "filled" : "light"}
                leftSection={<IconChartBar size={16} />}
                onClick={() => setShowAdvancedFilters((v) => !v)}
              >
                Доп. фильтры
              </Button>
            </Group>
          </Group>

          <PeriodPreset value={periodPreset} onChange={setPresetPeriod} />

          <Group grow align="flex-start" className="reports-filter-row">
            <DatePickerInput
              label="Начало периода"
              value={periodFrom}
              onChange={(value) => {
                setPeriodPreset("custom");
                setPeriodFrom(value);
              }}
              locale="ru"
              clearable={false}
              w="100%"
            />
            <DatePickerInput
              label="Конец периода"
              value={periodTo}
              onChange={(value) => {
                setPeriodPreset("custom");
                setPeriodTo(value);
              }}
              locale="ru"
              clearable={false}
              w="100%"
            />
            <Select
              label="Заказчик"
              placeholder="Все"
              data={customerOptions}
              value={customerId}
              onChange={setCustomerId}
              clearable
              w="100%"
              searchable
            />
          </Group>

          <Collapse in={showAdvancedFilters}>
            <Stack gap="md" mt="xs">
              <Group grow align="flex-start" className="reports-filter-row">
                <Select
                  label="Покрытие"
                  placeholder="Все"
                  data={coatingOptions}
                  value={coatingTypeId}
                  onChange={setCoatingTypeId}
                  clearable
                  searchable
                  w="100%"
                />
                <Select
                  label="Фрезеровка"
                  placeholder="Все"
                  data={millingOptions}
                  value={millingLabel}
                  onChange={setMillingLabel}
                  clearable
                  searchable
                  w="100%"
                />
                <Select
                  label="Цвет"
                  placeholder="Все"
                  data={colorOptions}
                  value={color}
                  onChange={setColor}
                  clearable
                  searchable
                  w="100%"
                />
                <Select
                  label="Ручка"
                  placeholder="Все"
                  data={[
                    { value: "with", label: "С ручкой" },
                    { value: "without", label: "Без ручки" },
                  ]}
                  value={handle}
                  onChange={(value) => setHandle(value as SalesReportHandleFilter | null)}
                  clearable
                  w="100%"
                />
              </Group>
            </Stack>
          </Collapse>

          {activeFilters.length ? (
            <Group gap="xs">
              {activeFilters.map((f) => (
                <Badge
                  key={f.key}
                  size="lg"
                  radius="sm"
                  variant="light"
                  rightSection={
                    <Tooltip label="Убрать фильтр">
                      <ActionIcon size={14} variant="transparent" onClick={() => clearFilter(f.key)}>
                        <IconX size={10} />
                      </ActionIcon>
                    </Tooltip>
                  }
                >
                  {f.label}
                </Badge>
              ))}
            </Group>
          ) : null}
        </Stack>
      </Paper>

      {report.isPending || previousReport.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {report.isError ? <Text c="red">{report.error instanceof Error ? report.error.message : "Ошибка"}</Text> : null}

      {report.data ? (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <KpiCard
              title="Реализовано заказов"
              value={String(report.data.totals.ordersCount)}
              delta={kpiDelta(report.data.totals.ordersCount, previousReport.data?.totals.ordersCount ?? 0)}
            />
            <KpiCard
              title="Фасадов"
              value={String(report.data.totals.facadeCount)}
              delta={kpiDelta(report.data.totals.facadeCount, previousReport.data?.totals.facadeCount ?? 0)}
            />
            <KpiCard
              title="Площадь"
              value={`${area.format(report.data.totals.facadeAreaTotal)} м²`}
              delta={kpiDelta(report.data.totals.facadeAreaTotal, previousReport.data?.totals.facadeAreaTotal ?? 0)}
            />
            <KpiCard
              title="Сумма заказов"
              value={money.format(report.data.totals.totalCost)}
              delta={kpiDelta(report.data.totals.totalCost, previousReport.data?.totals.totalCost ?? 0)}
            />
          </SimpleGrid>

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Paper withBorder p="md" radius="md">
                <Title order={5}>Динамика выручки по дням</Title>
                <Text size="sm" c="dimmed" mb="sm">
                  Помогает быстро увидеть пики и провалы
                </Text>
                <div className="reports-chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => dayjs(v as string).format("DD.MM")} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                      <ChartTooltip
                        formatter={(value) => [money.format(Number(value)), "Выручка"]}
                        labelFormatter={(value) => dayjs(value as string).format("DD.MM.YYYY")}
                      />
                      <Bar dataKey="revenue" fill="#4c6ef5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Paper withBorder p="md" radius="md">
                <Title order={5}>Распределение по покрытиям</Title>
                <Text size="sm" c="dimmed" mb="sm">
                  Топ по количеству фасадов
                </Text>
                <div className="reports-chart-wrap reports-chart-wrap-pie">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={coatingChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={86} innerRadius={50}>
                        {coatingChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(v) => [v, "Фасадов"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <Stack gap={6}>
                  {(coatingChartData.length ? coatingChartData : [{ name: "Нет данных", value: 0, color: "#adb5bd" }]).map((item) => (
                    <Group key={item.name} justify="space-between">
                      <Group gap={8}>
                        <div className="reports-legend-dot" style={{ backgroundColor: item.color }} />
                        <Text size="sm">{item.name}</Text>
                      </Group>
                      <Text size="sm" fw={600}>
                        {item.value}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-end" mb="sm" wrap="wrap">
              <Stack gap={2}>
                <Title order={5}>Детализация</Title>
                <Text size="sm" c="dimmed">
                  Быстрый поиск и сортировка по ключевым полям
                </Text>
              </Stack>
              <Group gap="sm">
                <TextInput
                  placeholder="Поиск по заказу, заказчику..."
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  leftSection={<IconSearch size={16} />}
                  w={280}
                />
                <SegmentedControl
                  value={tableMode}
                  onChange={(v) => setTableMode(v as TableMode)}
                  data={[
                    { label: "Фасады", value: "facades" },
                    { label: "Заказы", value: "orders" },
                  ]}
                />
              </Group>
            </Group>

            <ScrollArea type="auto" offsetScrollbars className="reports-table-scroll">
              {tableMode === "facades" ? (
                <Table striped highlightOnHover withTableBorder miw={1020} stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>
                        <SortHeader
                          title="Заказ"
                          active={facadeSort.key === "orderNumber"}
                          dir={facadeSort.dir}
                          onClick={() => applyFacadeSort("orderNumber")}
                        />
                      </Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Дата реализации"
                          active={facadeSort.key === "completedAt"}
                          dir={facadeSort.dir}
                          onClick={() => applyFacadeSort("completedAt")}
                        />
                      </Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Заказчик"
                          active={facadeSort.key === "customer"}
                          dir={facadeSort.dir}
                          onClick={() => applyFacadeSort("customer")}
                        />
                      </Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Покрытие"
                          active={facadeSort.key === "coating"}
                          dir={facadeSort.dir}
                          onClick={() => applyFacadeSort("coating")}
                        />
                      </Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Фрезеровка"
                          active={facadeSort.key === "milling"}
                          dir={facadeSort.dir}
                          onClick={() => applyFacadeSort("milling")}
                        />
                      </Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Цвет"
                          active={facadeSort.key === "color"}
                          dir={facadeSort.dir}
                          onClick={() => applyFacadeSort("color")}
                        />
                      </Table.Th>
                      <Table.Th>Размер</Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Площадь"
                          active={facadeSort.key === "areaM2"}
                          dir={facadeSort.dir}
                          onClick={() => applyFacadeSort("areaM2")}
                        />
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredFacades.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={8}>
                          <Text size="sm" c="dimmed">
                            Нет данных по фасадам для текущих условий
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      filteredFacades.map((facade) => (
                        <Table.Tr key={facade.id}>
                          <Table.Td>№{facade.orderNumberFormatted}</Table.Td>
                          <Table.Td>{formatDate(facade.completedAt)}</Table.Td>
                          <Table.Td>{facade.customer.name}</Table.Td>
                          <Table.Td>{facade.coatingType.name}</Table.Td>
                          <Table.Td>{facade.millingLabel}</Table.Td>
                          <Table.Td>{facade.color || "—"}</Table.Td>
                          <Table.Td>
                            {facade.widthMm}×{facade.heightMm}×{facade.thicknessMm}
                          </Table.Td>
                          <Table.Td>{area.format(facade.areaM2)} м²</Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              ) : (
                <Table striped highlightOnHover withTableBorder miw={980} stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>
                        <SortHeader
                          title="Заказ"
                          active={orderSort.key === "orderNumber"}
                          dir={orderSort.dir}
                          onClick={() => applyOrderSort("orderNumber")}
                        />
                      </Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Дата реализации"
                          active={orderSort.key === "completedAt"}
                          dir={orderSort.dir}
                          onClick={() => applyOrderSort("completedAt")}
                        />
                      </Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Заказчик"
                          active={orderSort.key === "customer"}
                          dir={orderSort.dir}
                          onClick={() => applyOrderSort("customer")}
                        />
                      </Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Фасадов"
                          active={orderSort.key === "facadeCount"}
                          dir={orderSort.dir}
                          onClick={() => applyOrderSort("facadeCount")}
                        />
                      </Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Площадь"
                          active={orderSort.key === "facadeAreaTotal"}
                          dir={orderSort.dir}
                          onClick={() => applyOrderSort("facadeAreaTotal")}
                        />
                      </Table.Th>
                      <Table.Th>
                        <SortHeader
                          title="Сумма"
                          active={orderSort.key === "totalCost"}
                          dir={orderSort.dir}
                          onClick={() => applyOrderSort("totalCost")}
                        />
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredOrders.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={6}>
                          <Text size="sm" c="dimmed">
                            Нет данных по заказам для текущих условий
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      filteredOrders.map((row) => (
                        <Table.Tr key={row.id}>
                          <Table.Td>№{row.orderNumberFormatted}</Table.Td>
                          <Table.Td>{formatDate(row.completedAt)}</Table.Td>
                          <Table.Td>{row.customer.name}</Table.Td>
                          <Table.Td>{row.facadeCount}</Table.Td>
                          <Table.Td>{area.format(row.facadeAreaTotal)} м²</Table.Td>
                          <Table.Td>{row.totalCost != null ? money.format(row.totalCost) : "—"}</Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              )}
            </ScrollArea>
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}
