import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Group, Paper, ScrollArea, Select, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { meRequest } from "../api/auth";
import { orderMove, ordersList, orderSetWorkState, type OrderDto } from "../api/orders";
import { orderWorkStatesList } from "../api/order-work-states";
import { stagesList } from "../api/stages";
import { money } from "../lib/order-form";
import { orderWorkStateBadgeColor, orderWorkStateOptionTextColor, orderWorkStateSelectStyles } from "../lib/order-work-state-ui";
import dayjs from "dayjs";
import "./OrdersPage.css";

export function OrdersPage() {
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const canMoveOrder = me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";
  const canStationBoard = canMoveOrder;

  const orders = useQuery({ queryKey: ["orders"], queryFn: () => ordersList() });
  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList });
  const workStates = useQuery({
    queryKey: ["order-work-states"],
    queryFn: orderWorkStatesList,
    enabled: canMoveOrder,
  });

  const stageOptions = useMemo(() => {
    if (!stages.data) return [];
    return stages.data.stages.map((s) => ({ value: s.id, label: s.name }));
  }, [stages.data]);

  const moveMut = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) => orderMove(id, stageId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const workStateOptions = useMemo(
    () => (workStates.data?.orderWorkStates ?? []).map((w) => ({ value: w.id, label: w.name })),
    [workStates.data],
  );
  const workStateSlugById = useMemo(
    () => new Map((workStates.data?.orderWorkStates ?? []).map((w) => [w.id, w.slug])),
    [workStates.data],
  );

  const workStateMut = useMutation({
    mutationFn: ({ id, workStateId }: { id: string; workStateId: string }) => orderSetWorkState(id, workStateId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const stageControl = (order: OrderDto, fullWidth = false) =>
    canMoveOrder ? (
      <Select
        data={stageOptions}
        value={order.currentStage.id}
        onChange={(stageId) => {
          if (stageId && stageId !== order.currentStage.id) {
            moveMut.mutate({ id: order.id, stageId });
          }
        }}
        size="xs"
        variant="filled"
        allowDeselect={false}
        disabled={moveMut.isPending}
        w={fullWidth ? "100%" : 180}
      />
    ) : (
      <Badge variant="light">{order.currentStage.name}</Badge>
    );

  const workStateControl = (order: OrderDto, fullWidth = false) =>
    canMoveOrder && order.currentStage.allowWorkStates ? (
      <Select
        data={workStateOptions}
        value={order.workState.id}
        onChange={(workStateId) => {
          if (workStateId && workStateId !== order.workState.id) {
            workStateMut.mutate({ id: order.id, workStateId });
          }
        }}
        size="xs"
        variant="filled"
        allowDeselect={false}
        disabled={workStateMut.isPending || workStateOptions.length === 0}
        styles={{ input: orderWorkStateSelectStyles(order.workState.slug) }}
        renderOption={({ option }) => (
          <Text size="sm" style={{ color: orderWorkStateOptionTextColor(workStateSlugById.get(option.value)) }}>
            {option.label}
          </Text>
        )}
        w={fullWidth ? "100%" : 200}
      />
    ) : (
      <Badge variant="light" color={orderWorkStateBadgeColor(order.workState.slug)}>
        {order.workState.name}
      </Badge>
    );

  const rows = orders.data?.orders.map((o) => {
    const balance = o.totalCost != null ? o.totalCost - (o.advance ?? 0) : null;
    return (
      <Table.Tr key={o.id}>
        <Table.Td>
          <Text
            component={Link}
            to={`/orders/${o.id}`}
            fw={500}
            size="sm"
            c="brand.6"
            style={{ textDecoration: "none" }}
          >
            №{o.orderNumberFormatted}
          </Text>
          <Text size="xs" c="dimmed">
            {dayjs(o.createdAt).format("DD.MM.YY")}
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
        <Table.Td>{stageControl(o)}</Table.Td>
        <Table.Td>{workStateControl(o)}</Table.Td>
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
            <Badge variant="light" color={o.deadlineAt ? "blue" : "gray"}>
              {o.deadlineAt ? dayjs(o.deadlineAt).format("DD.MM.YY") : "без срока"}
            </Badge>
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

          <Stack gap={6}>
            {stageControl(o, true)}
            {workStateControl(o, true)}
          </Stack>

          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
            <div className="orders-mobile-card-cell">
              <Text size="xs" c="dimmed">
                Работа
              </Text>
              <Text size="sm" lineClamp={2}>
                {o.workType?.trim() ? o.workType : "не указана"}
              </Text>
            </div>
            <div className="orders-mobile-card-cell">
              <Text size="xs" c="dimmed">
                Фасады
              </Text>
              <Text size="sm">{o.facadeCount} шт.</Text>
              <Text size="xs" c="dimmed">
                {o.facades.length} поз. · {o.facadeAreaTotal} м²
              </Text>
            </div>
            <div className="orders-mobile-card-cell">
              <Text size="xs" c="dimmed">
                Сумма
              </Text>
              <Text size="sm">{o.totalCost != null ? money.format(o.totalCost) : "—"}</Text>
              <Text size="xs" c="dimmed">
                аванс {o.advance != null ? money.format(o.advance) : "—"}
              </Text>
            </div>
            <div className="orders-mobile-card-cell">
              <Text size="xs" c="dimmed">
                Остаток
              </Text>
              <Text size="sm" fw={600}>
                {balance != null ? money.format(balance) : "—"}
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
          <Title order={3}>Заказы</Title>
          <Button component={Link} to="/orders/board" variant="light" size="sm">
            По цеху
          </Button>
          {canStationBoard ? (
            <Button component={Link} to="/orders/board/station" variant="light" size="sm">
              На участке
            </Button>
          ) : null}
          <Button component={Link} to="/orders/archive" variant="light" size="sm">
            Архив
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
              <Table striped highlightOnHover withTableBorder verticalSpacing={6} fz="sm" miw={1280}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Номер</Table.Th>
                    <Table.Th>Заказчик</Table.Th>
                    <Table.Th>Этап</Table.Th>
                    <Table.Th>На участке</Table.Th>
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
          <Text c="dimmed">Заказов пока нет.</Text>
        )
      ) : null}
      {moveMut.isError ? (
        <Text c="red" size="sm" mt="sm">
          {moveMut.error instanceof Error ? moveMut.error.message : "Ошибка перемещения"}
        </Text>
      ) : null}
    </>
  );
}
