import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Group, Menu, Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { meRequest } from "../api/auth";
import { orderMove, ordersList, type OrderDto } from "../api/orders";
import { stagesList } from "../api/stages";
import { money } from "../lib/order-form";
import dayjs from "dayjs";

export function OrdersBoardPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const canMove = me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";

  const orders = useQuery({ queryKey: ["orders"], queryFn: ordersList });
  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList });

  const byStage = useMemo(() => {
    const map = new Map<string, OrderDto[]>();
    for (const s of stages.data?.stages ?? []) {
      map.set(s.id, []);
    }
    for (const o of orders.data?.orders ?? []) {
      const list = map.get(o.currentStage.id);
      if (list) list.push(o);
      else map.set(o.currentStage.id, [o]);
    }
    return map;
  }, [orders.data, stages.data]);

  const moveMut = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) => orderMove(id, stageId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Group gap="sm">
          <Title order={3}>Канбан</Title>
          <Button component={Link} to="/orders" variant="light" size="sm">
            Список
          </Button>
        </Group>
      </Group>

      {orders.isPending || stages.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {orders.isError ? (
        <Text c="red">{orders.error instanceof Error ? orders.error.message : "Ошибка"}</Text>
      ) : null}

      {stages.data ? (
        <ScrollArea type="scroll" offsetScrollbars>
          <Group align="flex-start" wrap="nowrap" gap="md" pb="md" style={{ minHeight: 360 }}>
            {stages.data.stages.map((stage) => {
              const list = byStage.get(stage.id) ?? [];
              return (
                <Paper
                  key={stage.id}
                  shadow="sm"
                  p="md"
                  radius="md"
                  withBorder
                  style={{ flex: "0 0 280px", maxHeight: "70vh", display: "flex", flexDirection: "column" }}
                >
                  <Group justify="space-between" mb="xs" wrap="nowrap">
                    <Text fw={700} size="sm" lineClamp={2}>
                      {stage.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {list.length}
                    </Text>
                  </Group>
                  {stage.isComplete ? (
                    <Text size="xs" c="teal" mb="xs">
                      Финальный этап
                    </Text>
                  ) : null}
                  <ScrollArea style={{ flex: 1 }} offsetScrollbars>
                    <Stack gap="sm">
                      {list.map((o) => (
                        <Paper key={o.id} p="sm" withBorder radius="sm" bg="gray.0">
                          <Text
                            component={Link}
                            to={`/orders/${o.id}`}
                            fw={600}
                            size="sm"
                            c="blue"
                            style={{ textDecoration: "none" }}
                          >
                            №{o.orderNumberFormatted}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {o.customer.name}
                          </Text>
                          {o.deadlineAt ? (
                            <Text size="xs" mt={4}>
                              до {dayjs(o.deadlineAt).format("D MMM YYYY")}
                            </Text>
                          ) : null}
                          <Text size="xs" mt={4}>
                            {o.totalPrice != null ? money.format(o.totalPrice) : "—"}
                          </Text>
                          {canMove ? (
                            <Menu shadow="md" width={200} withinPortal>
                              <Menu.Target>
                                <Button size="xs" variant="light" mt="xs" fullWidth>
                                  На этап…
                                </Button>
                              </Menu.Target>
                              <Menu.Dropdown>
                                {stages.data!.stages
                                  .filter((s) => s.id !== o.currentStage.id)
                                  .map((s) => (
                                    <Menu.Item
                                      key={s.id}
                                      onClick={() => moveMut.mutate({ id: o.id, stageId: s.id })}
                                    >
                                      {s.name}
                                    </Menu.Item>
                                  ))}
                              </Menu.Dropdown>
                            </Menu>
                          ) : null}
                        </Paper>
                      ))}
                    </Stack>
                  </ScrollArea>
                </Paper>
              );
            })}
          </Group>
        </ScrollArea>
      ) : null}
    </>
  );
}
