import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Divider, Group, Modal, Paper, ScrollArea, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconCalendarDue, IconCash, IconExternalLink, IconPackage, IconUser } from "@tabler/icons-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Link, useNavigate } from "react-router-dom";
import { meRequest } from "../api/auth";
import { orderMove, ordersList, type OrderDto } from "../api/orders";
import { stagesList } from "../api/stages";
import { money } from "../lib/order-form";
import dayjs from "dayjs";

type OrdersListData = Awaited<ReturnType<typeof ordersList>>;
type MoveVariables = { id: string; stageId: string; previous?: OrdersListData };

function PreviewField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Paper withBorder p="sm" radius="md">
      <Group gap="xs" mb={4}>
        {icon}
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
      </Group>
      <Text size="sm" fw={500}>
        {value}
      </Text>
    </Paper>
  );
}

export function OrdersBoardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [previewOrder, setPreviewOrder] = useState<OrderDto | null>(null);
  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const canMove = me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";

  const orders = useQuery({ queryKey: ["orders"], queryFn: () => ordersList() });
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
    mutationFn: ({ id, stageId }: MoveVariables) => orderMove(id, stageId),
    onMutate: ({ previous }) => {
      void qc.cancelQueries({ queryKey: ["orders"] });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData<OrdersListData>(["orders"], context.previous);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData<OrdersListData>(["orders"], (current) =>
        current
          ? { orders: current.orders.map((o) => (o.id === data.order.id ? data.order : o)) }
          : current,
      );
      qc.setQueryData(["order", data.order.id], data);
    },
  });

  const onDragEnd = (result: DropResult) => {
    if (!canMove) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const previous = qc.getQueryData<OrdersListData>(["orders"]);
    const nextStage = stages.data?.stages.find((s) => s.id === destination.droppableId);

    if (previous && nextStage) {
      qc.setQueryData<OrdersListData>(["orders"], {
        orders: previous.orders.map((o) => (o.id === draggableId ? { ...o, currentStage: nextStage } : o)),
      });
    }

    moveMut.mutate({ id: draggableId, stageId: destination.droppableId, previous });
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
                        {...dragProvided.dragHandleProps}
                        style={{
                          ...dragProvided.draggableProps.style,
                          opacity: snapshot.isDragging ? 0.85 : 1,
                          cursor: canMove ? (snapshot.isDragging ? "grabbing" : "grab") : "pointer",
                        }}
                      >
                        <Paper
                          p="sm"
                          withBorder
                          radius="md"
                          shadow={snapshot.isDragging ? "sm" : undefined}
                          bg={snapshot.isDragging ? "var(--mantine-primary-color-light)" : "var(--mantine-color-body)"}
                          style={{
                            borderColor: snapshot.isDragging
                              ? "var(--mantine-primary-color-filled)"
                              : "var(--mantine-color-default-border)",
                            transition: snapshot.isDragging ? undefined : "border-color 120ms ease, background 120ms ease",
                          }}
                          onClick={() => setPreviewOrder(o)}
                        >
                          <Group gap="xs" align="flex-start" wrap="nowrap">
                            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                              <Text fw={600} size="sm" c="brand.6">
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
          <Button component={Link} to="/orders/archive" variant="light" size="sm">
            Архив
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

      <Modal
        opened={!!previewOrder}
        onClose={() => setPreviewOrder(null)}
        title={previewOrder ? `Заказ №${previewOrder.orderNumberFormatted}` : "Заказ"}
        size="lg"
      >
        {previewOrder ? (
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text fw={500}>{previewOrder.customer.name}</Text>
                {previewOrder.customer.phone?.trim() ? (
                  <Text size="sm" c="dimmed">
                    {previewOrder.customer.phone}
                  </Text>
                ) : null}
              </Stack>
              <Badge variant="light">{previewOrder.currentStage.name}</Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <PreviewField
                icon={<IconCalendarDue size={16} />}
                label="Дедлайн"
                value={previewOrder.deadlineAt ? dayjs(previewOrder.deadlineAt).format("D MMMM YYYY") : "—"}
              />
              <PreviewField
                icon={<IconPackage size={16} />}
                label="Фасады"
                value={`${previewOrder.facadeCount} шт. · ${previewOrder.facadeAreaTotal} м²`}
              />
              <PreviewField
                icon={<IconCash size={16} />}
                label="Стоимость"
                value={previewOrder.totalCost != null ? money.format(previewOrder.totalCost) : "—"}
              />
              <PreviewField
                icon={<IconUser size={16} />}
                label="Вид работы"
                value={previewOrder.workType?.trim() ? previewOrder.workType : "—"}
              />
            </SimpleGrid>

            {previewOrder.deliveryAddress?.trim() ? (
              <Stack gap={4}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Доставка
                </Text>
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {previewOrder.deliveryAddress}
                </Text>
              </Stack>
            ) : null}

            {previewOrder.comment?.trim() ? (
              <>
                <Divider />
                <Stack gap={4}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                    Комментарий
                  </Text>
                  <Text size="sm" lineClamp={4} style={{ whiteSpace: "pre-wrap" }}>
                    {previewOrder.comment}
                  </Text>
                </Stack>
              </>
            ) : null}

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPreviewOrder(null)}>
                Закрыть
              </Button>
              <Button
                rightSection={<IconExternalLink size={16} />}
                onClick={() => {
                  const id = previewOrder.id;
                  setPreviewOrder(null);
                  void navigate(`/orders/${id}`);
                }}
              >
                Открыть заказ
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
