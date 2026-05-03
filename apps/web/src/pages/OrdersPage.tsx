import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Group, Modal, Select, Stack, Table, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { meRequest } from "../api/auth";
import { orderMove, ordersList } from "../api/orders";
import { stagesList } from "../api/stages";
import { money } from "../lib/order-form";

export function OrdersPage() {
  const qc = useQueryClient();
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [stagePick, setStagePick] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const canCreate = me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";

  const orders = useQuery({ queryKey: ["orders"], queryFn: ordersList });
  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList });

  const stageOptions = useMemo(() => {
    if (!stages.data) return [];
    return stages.data.stages.map((s) => ({ value: s.id, label: s.name }));
  }, [stages.data]);

  const moveMut = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) => orderMove(id, stageId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      setMoveFor(null);
      setStagePick(null);
    },
  });

  const rows = orders.data?.orders.map((o) => (
    <Table.Tr key={o.id}>
      <Table.Td>
        <Text component={Link} to={`/orders/${o.id}`} fw={600} c="blue" style={{ textDecoration: "none" }}>
          №{o.orderNumberFormatted}
        </Text>
      </Table.Td>
      <Table.Td>{o.customer.name}</Table.Td>
      <Table.Td>{o.currentStage.name}</Table.Td>
      <Table.Td>
        <Text size="sm">
          {o.facadeCount} шт. ({o.facades.length} поз.)
        </Text>
      </Table.Td>
      <Table.Td>{o.totalCost != null ? money.format(o.totalCost) : "—"}</Table.Td>
      <Table.Td>
        {canCreate ? (
          <Button size="xs" variant="light" onClick={() => setMoveFor(o.id)}>
            Этап…
          </Button>
        ) : null}
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Group gap="sm">
          <Title order={3}>Заказы</Title>
          <Button component={Link} to="/orders/board" variant="light" size="sm">
            Канбан
          </Button>
        </Group>
        {canCreate ? (
          <Button component={Link} to="/orders/new">
            Новый заказ
          </Button>
        ) : null}
      </Group>

      {orders.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {orders.isError ? (
        <Text c="red">{orders.error instanceof Error ? orders.error.message : "Ошибка"}</Text>
      ) : null}

      {orders.data ? (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Номер</Table.Th>
              <Table.Th>Заказчик</Table.Th>
              <Table.Th>Этап</Table.Th>
              <Table.Th>Фасады</Table.Th>
              <Table.Th>Сумма</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      ) : null}

      <Modal opened={!!moveFor} onClose={() => setMoveFor(null)} title="Переместить заказ">
        <Stack>
          <Select
            label="Этап"
            data={stageOptions}
            value={stagePick}
            onChange={setStagePick}
            placeholder="Выберите этап"
          />
          <Button
            disabled={!moveFor || !stagePick}
            loading={moveMut.isPending}
            onClick={() => {
              if (moveFor && stagePick) moveMut.mutate({ id: moveFor, stageId: stagePick });
            }}
          >
            Переместить
          </Button>
          {moveFor ? (
            <Button component={Link} to={`/orders/${moveFor}`} variant="subtle" size="xs">
              Открыть карточку заказа
            </Button>
          ) : null}
          {moveMut.isError ? (
            <Text c="red" size="sm">
              {moveMut.error instanceof Error ? moveMut.error.message : "Ошибка"}
            </Text>
          ) : null}
        </Stack>
      </Modal>
    </>
  );
}
