import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Group, Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
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

  const onDragEnd = (result: DropResult) => {
    if (!canMove) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    moveMut.mutate({ id: draggableId, stageId: destination.droppableId });
  };

  const columns =
    stages.data?.stages.map((stage) => {
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
          {canMove ? (
            <Text size="xs" c="dimmed" mb="xs">
              Тяните за ⋮⋮ в другую колонку
            </Text>
          ) : null}
          <Droppable droppableId={stage.id}>
            {(dropProvided) => (
              <Stack
                gap="sm"
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  minHeight: 120,
                  paddingBottom: 4,
                }}
              >
                {list.map((o, index) => (
                  <Draggable key={o.id} draggableId={o.id} index={index} isDragDisabled={!canMove}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        style={{
                          ...dragProvided.draggableProps.style,
                          opacity: snapshot.isDragging ? 0.85 : 1,
                        }}
                      >
                        <Paper
                          p="sm"
                          withBorder
                          radius="sm"
                          bg={snapshot.isDragging ? "blue.0" : "gray.0"}
                          shadow={snapshot.isDragging ? "md" : undefined}
                        >
                          <Group gap="xs" align="flex-start" wrap="nowrap">
                            {canMove ? (
                              <Box
                                {...dragProvided.dragHandleProps}
                                style={{
                                  cursor: "grab",
                                  color: "var(--mantine-color-dimmed)",
                                  lineHeight: 1,
                                  paddingTop: 2,
                                }}
                                aria-label="Перетащить"
                              >
                                <IconGripVertical size={18} />
                              </Box>
                            ) : null}
                            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
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
                                <Text size="xs">до {dayjs(o.deadlineAt).format("D MMM YYYY")}</Text>
                              ) : null}
                              <Text size="xs">{o.totalCost != null ? money.format(o.totalCost) : "—"}</Text>
                            </Stack>
                          </Group>
                        </Paper>
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </Stack>
            )}
          </Droppable>
        </Paper>
      );
    }) ?? null;

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

      {stages.data && columns ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <ScrollArea type="scroll" offsetScrollbars>
            <Group align="flex-start" wrap="nowrap" gap="md" pb="md" style={{ minHeight: 360 }}>
              {columns}
            </Group>
          </ScrollArea>
        </DragDropContext>
      ) : null}
    </>
  );
}
