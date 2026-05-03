import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import dayjs from "dayjs";
import { salesReport, type SalesReportHandleFilter } from "../api/reports";
import { meRequest } from "../api/auth";
import { customersList } from "../api/customers";
import { money } from "../lib/order-form";
import "./ReportsPage.css";

const area = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(value: string | null): string {
  return value ? dayjs(value).format("DD.MM.YYYY") : "—";
}

export function ReportsPage() {
  const now = dayjs();
  const [periodFrom, setPeriodFrom] = useState<Date | null>(now.startOf("month").toDate());
  const [periodTo, setPeriodTo] = useState<Date | null>(now.endOf("day").toDate());
  const [reportType, setReportType] = useState<string | null>("sales");
  const [coatingTypeId, setCoatingTypeId] = useState<string | null>(null);
  const [millingLabel, setMillingLabel] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [handle, setHandle] = useState<SalesReportHandleFilter | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const isAdmin = me.data?.user.role === "ADMIN";

  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: customersList,
    enabled: isAdmin,
  });

  const fromIso = periodFrom ? dayjs(periodFrom).startOf("day").toISOString() : "";
  const toIso = periodTo ? dayjs(periodTo).endOf("day").toISOString() : "";

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

  const coatingOptions = (report.data?.filters.coatings ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const millingOptions = (report.data?.filters.millingLabels ?? []).map((m) => ({ value: m, label: m }));
  const colorOptions = (report.data?.filters.colors ?? []).map((c) => ({ value: c, label: c }));
  const customerOptions = (customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name }));

  if (me.isSuccess && !isAdmin) {
    return <Text c="dimmed">Отчёты доступны только администратору.</Text>;
  }

  return (
    <>
      <Title order={3} mb="md">
        Отчёты
      </Title>

      <Stack gap="md" mb="lg" className="reports-filters-stack">
        <Group grow align="flex-start" className="reports-filter-row">
          <DatePickerInput
            label="Начало периода"
            value={periodFrom}
            onChange={setPeriodFrom}
            locale="ru"
            clearable={false}
            w="100%"
          />
          <DatePickerInput
            label="Конец периода"
            value={periodTo}
            onChange={setPeriodTo}
            locale="ru"
            clearable={false}
            w="100%"
          />
          <Select
            label="Отчёт"
            data={[{ value: "sales", label: "Реализация и сумма заказов" }]}
            value={reportType}
            onChange={setReportType}
            clearable={false}
            w="100%"
          />
        </Group>

        <Group grow align="flex-start" className="reports-filter-row">
          <Select
            label="Заказчик"
            placeholder="Все"
            data={customerOptions}
            value={customerId}
            onChange={setCustomerId}
            clearable
            w="100%"
          />
          <Select
            label="Покрытие"
            placeholder="Все"
            data={coatingOptions}
            value={coatingTypeId}
            onChange={setCoatingTypeId}
            clearable
            w="100%"
          />
          <Select
            label="Фрезеровка"
            placeholder="Все"
            data={millingOptions}
            value={millingLabel}
            onChange={setMillingLabel}
            clearable
            w="100%"
          />
        </Group>

        <Group grow align="flex-start" className="reports-filter-row">
          <Select
            label="Цвет"
            placeholder="Все"
            data={colorOptions}
            value={color}
            onChange={setColor}
            clearable
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

      {report.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {report.isError ? (
        <Text c="red">{report.error instanceof Error ? report.error.message : "Ошибка"}</Text>
      ) : null}

      {report.data ? (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed">
                Реализовано заказов
              </Text>
              <Text size="xl" fw={700}>
                {report.data.totals.ordersCount}
              </Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed">
                Фасадов
              </Text>
              <Text size="xl" fw={700}>
                {report.data.totals.facadeCount}
              </Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed">
                Площадь
              </Text>
              <Text size="xl" fw={700}>
                {area.format(report.data.totals.facadeAreaTotal)} м²
              </Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed">
                Сумма заказов
              </Text>
              <Text size="xl" fw={700}>
                {money.format(report.data.totals.totalCost)}
              </Text>
            </Paper>
          </SimpleGrid>

          <ScrollArea type="auto" offsetScrollbars>
            <Table striped highlightOnHover withTableBorder miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Заказ</Table.Th>
                  <Table.Th>Дата реализации</Table.Th>
                  <Table.Th>Заказчик</Table.Th>
                  <Table.Th>Покрытие</Table.Th>
                  <Table.Th>Фрезеровка</Table.Th>
                  <Table.Th>Цвет</Table.Th>
                  <Table.Th>Размер</Table.Th>
                  <Table.Th>Площадь</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {report.data.facades.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Text size="sm" c="dimmed">
                        Нет реализованных фасадов за выбранный период
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  report.data.facades.map((facade) => (
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
          </ScrollArea>
        </Stack>
      ) : null}
    </>
  );
}
