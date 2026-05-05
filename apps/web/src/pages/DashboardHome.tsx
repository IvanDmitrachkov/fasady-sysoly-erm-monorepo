import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconArrowsExchange2,
  IconBox,
  IconClockHour4,
  IconSquareRoundedArrowDown,
  IconSquareRoundedArrowUp,
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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboardReport } from "../api/reports";
import { meRequest } from "../api/auth";
import { money } from "../lib/order-form";
import "./DashboardHome.css";

type DashboardPeriod = "today" | "week" | "month";

const areaFormat = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CHART_COLORS = ["#4c6ef5", "#12b886", "#f59f00", "#e64980", "#7950f2", "#228be6", "#fa5252"];

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

function trendLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

function rangeByPeriod(period: DashboardPeriod): { from: string; to: string } {
  const now = dayjs();
  if (period === "today") {
    return {
      from: now.startOf("day").toISOString(),
      to: now.endOf("day").toISOString(),
    };
  }
  if (period === "week") {
    return {
      from: now.subtract(6, "day").startOf("day").toISOString(),
      to: now.endOf("day").toISOString(),
    };
  }
  return {
    from: now.subtract(29, "day").startOf("day").toISOString(),
    to: now.endOf("day").toISOString(),
  };
}

export function DashboardHome() {
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const { from, to } = useMemo(() => rangeByPeriod(period), [period]);
  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const isAdmin = me.data?.user.role === "ADMIN";

  const dashboardQ = useQuery({
    queryKey: ["dashboardReport", from, to],
    queryFn: () => dashboardReport({ from, to }),
    enabled: isAdmin === true,
  });

  const stageChartData =
    dashboardQ.data?.stageBreakdown.map((s, idx) => ({
      name: s.stageName,
      value: s.minutes,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    })) ?? [];

  const topStage = stageChartData[0];
  const topStagePercent =
    topStage && dashboardQ.data && dashboardQ.data.kpis.totalMinutes.value > 0
      ? Math.round((topStage.value / dashboardQ.data.kpis.totalMinutes.value) * 100)
      : 0;

  const avgMinutesPerFacade =
    dashboardQ.data && dashboardQ.data.kpis.facadeCount.value > 0
      ? Math.round(dashboardQ.data.kpis.totalMinutes.value / dashboardQ.data.kpis.facadeCount.value)
      : 0;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="end">
        <div>
          <Title order={3}>Производственный дашборд</Title>
          <Text c="dimmed" size="sm" mt={4}>
            Срез на {dayjs(to).format("DD.MM.YYYY HH:mm")}
          </Text>
        </div>
        <SegmentedControl
          value={period}
          onChange={(value) => setPeriod(value as DashboardPeriod)}
          data={[
            { value: "today", label: "Сегодня" },
            { value: "week", label: "7 дней" },
            { value: "month", label: "30 дней" },
          ]}
        />
      </Group>

      {me.isSuccess && !isAdmin ? (
        <Paper withBorder p="lg" radius="md">
          <Text c="dimmed">Дашборд доступен администратору. Для детализации используйте разделы отчётов.</Text>
        </Paper>
      ) : null}

      {dashboardQ.isPending ? <Text c="dimmed">Загрузка дашборда…</Text> : null}
      {dashboardQ.isError ? (
        <Text c="red">{dashboardQ.error instanceof Error ? dashboardQ.error.message : "Ошибка загрузки дашборда"}</Text>
      ) : null}

      {dashboardQ.data ? (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <Paper withBorder p="md" radius="md" className="dashboard-kpi-card">
              <Group justify="space-between">
                <Text c="dimmed" size="sm">
                  Выполнено заказов
                </Text>
                <ThemeIcon variant="light" color="blue">
                  <IconArrowsExchange2 size={16} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700} mt={6}>
                {dashboardQ.data.kpis.ordersCount.value}
              </Text>
              <Badge
                mt="sm"
                color={dashboardQ.data.kpis.ordersCount.trendPercent >= 0 ? "green" : "red"}
                variant="light"
                leftSection={
                  dashboardQ.data.kpis.ordersCount.trendPercent >= 0 ? (
                    <IconSquareRoundedArrowUp size={14} />
                  ) : (
                    <IconSquareRoundedArrowDown size={14} />
                  )
                }
              >
                {trendLabel(dashboardQ.data.kpis.ordersCount.trendPercent)}
              </Badge>
            </Paper>

            <Paper withBorder p="md" radius="md" className="dashboard-kpi-card">
              <Group justify="space-between">
                <Text c="dimmed" size="sm">
                  Выполнено фасадов
                </Text>
                <ThemeIcon variant="light" color="teal">
                  <IconBox size={16} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700} mt={6}>
                {dashboardQ.data.kpis.facadeCount.value}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                Площадь: {areaFormat.format(dashboardQ.data.kpis.areaM2.value)} м²
              </Text>
            </Paper>

            <Paper withBorder p="md" radius="md" className="dashboard-kpi-card">
              <Group justify="space-between">
                <Text c="dimmed" size="sm">
                  Трудозатраты
                </Text>
                <ThemeIcon variant="light" color="orange">
                  <IconClockHour4 size={16} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700} mt={6}>
                {minutesLabel(dashboardQ.data.kpis.totalMinutes.value)}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                Среднее на фасад: {avgMinutesPerFacade ? `${avgMinutesPerFacade} мин` : "—"}
              </Text>
            </Paper>

            <Paper withBorder p="md" radius="md" className="dashboard-kpi-card">
              <Group justify="space-between">
                <Text c="dimmed" size="sm">
                  Выручка
                </Text>
                <ThemeIcon variant="light" color="violet">
                  <IconArrowsExchange2 size={16} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700} mt={6}>
                {money.format(dashboardQ.data.kpis.totalRevenue.value)}
              </Text>
              <Badge
                mt="sm"
                color={dashboardQ.data.kpis.totalRevenue.trendPercent >= 0 ? "green" : "red"}
                variant="light"
              >
                {trendLabel(dashboardQ.data.kpis.totalRevenue.trendPercent)}
              </Badge>
            </Paper>
          </SimpleGrid>

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Paper withBorder p="md" radius="md">
                <Title order={5}>Динамика по дням</Title>
                <Text c="dimmed" size="sm" mb="md">
                  Заказы, фасады и трудозатраты
                </Text>
                <div className="dashboard-chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardQ.data.daily}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => dayjs(value as string).format("DD.MM")}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === "minutes") return [minutesLabel(Number(value)), "Трудозатраты"];
                          if (name === "facadeCount") return [value, "Фасады"];
                          return [value, "Заказы"];
                        }}
                        labelFormatter={(value) => dayjs(value as string).format("DD.MM.YYYY")}
                      />
                      <Bar yAxisId="left" dataKey="ordersCount" fill="#4c6ef5" radius={[4, 4, 0, 0]} name="ordersCount" />
                      <Bar yAxisId="left" dataKey="facadeCount" fill="#12b886" radius={[4, 4, 0, 0]} name="facadeCount" />
                      <Bar yAxisId="right" dataKey="minutes" fill="#fab005" radius={[4, 4, 0, 0]} name="minutes" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Paper withBorder p="md" radius="md">
                <Title order={5}>Структура времени по этапам</Title>
                <Text c="dimmed" size="sm" mb="md">
                  Где больше всего времени
                </Text>
                <div className="dashboard-chart-wrap dashboard-chart-wrap-pie">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stageChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={52}
                        paddingAngle={2}
                      >
                        {stageChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => minutesLabel(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <Stack gap={6}>
                  {(stageChartData.length ? stageChartData.slice(0, 4) : [{ name: "Нет данных", value: 0, color: "#adb5bd" }]).map(
                    (stage) => (
                      <Group key={stage.name} justify="space-between">
                        <Group gap={8}>
                          <div className="dashboard-stage-dot" style={{ backgroundColor: stage.color }} />
                          <Text size="sm">{stage.name}</Text>
                        </Group>
                        <Text size="sm" fw={600}>
                          {minutesLabel(stage.value)}
                        </Text>
                      </Group>
                    ),
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>

          <Paper withBorder p="md" radius="md">
            <Title order={5}>Инсайты</Title>
            <SimpleGrid cols={{ base: 1, sm: 3 }} mt="sm">
              <Text size="sm">
                Пиковая загрузка:{" "}
                <Text span fw={600}>
                  {dashboardQ.data.daily
                    .slice()
                    .sort((a, b) => b.minutes - a.minutes)[0]?.date
                    ? dayjs(dashboardQ.data.daily.slice().sort((a, b) => b.minutes - a.minutes)[0]?.date).format("DD.MM")
                    : "—"}
                </Text>
              </Text>
              <Text size="sm">
                Самый затратный этап:{" "}
                <Text span fw={600}>
                  {topStage ? `${topStage.name} (${topStagePercent}%)` : "—"}
                </Text>
              </Text>
              <Text size="sm">
                Среднее время на фасад:{" "}
                <Text span fw={600}>
                  {avgMinutesPerFacade ? `${avgMinutesPerFacade} мин` : "—"}
                </Text>
              </Text>
            </SimpleGrid>
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}
