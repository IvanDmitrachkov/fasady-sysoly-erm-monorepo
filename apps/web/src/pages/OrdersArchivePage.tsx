import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Group, Paper, ScrollArea, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { ordersList } from "../api/orders";
import { money } from "../lib/order-form";
import { orderWorkStateBadgeColor } from "../lib/order-work-state-ui";
import "./OrdersArchivePage.css";

export function OrdersArchivePage() {
  const orders = useQuery({ queryKey: ["orders", "archive"], queryFn: () => ordersList("archive") });

  const rows = orders.data?.orders.map((o) => {
    const balance = o.totalCost != null ? o.totalCost - (o.advance ?? 0) : null;
    return (
      <Table.Tr key={o.id}>
        <Table.Td>
          <Text component={Link} to={`/orders/${o.id}`} fw={500} size="sm" c="brand.6" style={{ textDecoration: "none" }}>
            №{o.orderNumberFormatted}
          </Text>
          <Text size="xs" c="dimmed">
            создан {dayjs(o.createdAt).format("DD.MM.YY")}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" lineClamp={1}>
            {o.customer.name}
          </Text>
          {o.customer.phone?.trim() ? (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {o.customer.phone}
            </Text>
          ) : null}
        </Table.Td>
        <Table.Td>
          <Group gap={6} wrap="wrap">
            <Badge variant="light">{o.currentStage.name}</Badge>
            <Badge variant="light" color={orderWorkStateBadgeColor(o.workState.slug)}>
              {o.workState.name}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            {o.completedAt ? dayjs(o.completedAt).format("DD.MM.YY HH:mm") : "дата завершения не указана"}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{o.deadlineAt ? dayjs(o.deadlineAt).format("DD.MM.YY") : "—"}</Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {o.workType?.trim() ? o.workType : "вид работы не указан"}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{o.facadeCount} шт.</Text>
          <Text size="xs" c="dimmed">
            {o.facades.length} поз. · {o.facadeAreaTotal} м²
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{o.totalCost != null ? money.format(o.totalCost) : "—"}</Text>
          <Text size="xs" c="dimmed">
            аванс {o.advance != null ? money.format(o.advance) : "—"}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{balance != null ? money.format(balance) : "—"}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {o.deliveryAddress?.trim() ? o.deliveryAddress : "—"}
          </Text>
        </Table.Td>
      </Table.Tr>
    );
  });

  const cards = orders.data?.orders.map((o) => {
    const balance = o.totalCost != null ? o.totalCost - (o.advance ?? 0) : null;
    return (
      <Paper key={o.id} withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" gap="xs">
            <div>
              <Text component={Link} to={`/orders/${o.id}`} fw={600} c="brand.6" style={{ textDecoration: "none" }}>
                №{o.orderNumberFormatted}
              </Text>
              <Text size="xs" c="dimmed">
                создан {dayjs(o.createdAt).format("DD.MM.YY")}
              </Text>
            </div>
            <Group gap={4}>
              <Badge variant="light">{o.currentStage.name}</Badge>
              <Badge variant="light" color={orderWorkStateBadgeColor(o.workState.slug)}>
                {o.workState.name}
              </Badge>
            </Group>
          </Group>
          <div>
            <Text fw={500} size="sm" lineClamp={1}>
              {o.customer.name}
            </Text>
            {o.customer.phone?.trim() ? (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {o.customer.phone}
              </Text>
            ) : null}
          </div>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
            <div className="orders-archive-card-cell">
              <Text size="xs" c="dimmed">
                Завершён
              </Text>
              <Text size="sm">{o.completedAt ? dayjs(o.completedAt).format("DD.MM.YY HH:mm") : "—"}</Text>
            </div>
            <div className="orders-archive-card-cell">
              <Text size="xs" c="dimmed">
                Срок / работа
              </Text>
              <Text size="sm">{o.deadlineAt ? dayjs(o.deadlineAt).format("DD.MM.YY") : "—"}</Text>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {o.workType?.trim() ? o.workType : "вид работы не указан"}
              </Text>
            </div>
            <div className="orders-archive-card-cell">
              <Text size="xs" c="dimmed">
                Фасады
              </Text>
              <Text size="sm">{o.facadeCount} шт.</Text>
              <Text size="xs" c="dimmed">
                {o.facades.length} поз. · {o.facadeAreaTotal} м²
              </Text>
            </div>
            <div className="orders-archive-card-cell">
              <Text size="xs" c="dimmed">
                Деньги
              </Text>
              <Text size="sm">{o.totalCost != null ? money.format(o.totalCost) : "—"}</Text>
              <Text size="xs" c="dimmed">
                остаток {balance != null ? money.format(balance) : "—"}
              </Text>
            </div>
          </SimpleGrid>
          <div>
            <Text size="xs" c="dimmed">
              Доставка
            </Text>
            <Text size="sm" c={o.deliveryAddress?.trim() ? undefined : "dimmed"} lineClamp={3}>
              {o.deliveryAddress?.trim() ? o.deliveryAddress : "—"}
            </Text>
          </div>
        </Stack>
      </Paper>
    );
  });

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Group gap="sm">
          <Title order={3}>Архив заказов</Title>
          <Button component={Link} to="/orders" variant="light" size="sm">
            Активные
          </Button>
          <Button component={Link} to="/orders/board" variant="light" size="sm">
            По цеху
          </Button>
        </Group>
      </Group>

      {orders.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {orders.isError ? (
        <Text c="red">{orders.error instanceof Error ? orders.error.message : "Ошибка"}</Text>
      ) : null}

      {orders.data ? (
        orders.data.orders.length > 0 ? (
          <>
          <ScrollArea type="auto" offsetScrollbars visibleFrom="sm">
            <Table striped highlightOnHover withTableBorder verticalSpacing={6} fz="sm" miw={1100}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Номер</Table.Th>
                  <Table.Th>Заказчик</Table.Th>
                  <Table.Th>Завершён</Table.Th>
                  <Table.Th>Срок / работа</Table.Th>
                  <Table.Th>Фасады</Table.Th>
                  <Table.Th>Сумма / аванс</Table.Th>
                  <Table.Th>Остаток</Table.Th>
                  <Table.Th>Доставка</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </ScrollArea>
          <Stack gap="sm" hiddenFrom="sm">
            {cards}
          </Stack>
          </>
        ) : (
          <Text c="dimmed">В архиве пока нет заказов.</Text>
        )
      ) : null}
    </>
  );
}
