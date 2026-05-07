import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Divider, Group, Modal, Paper, ScrollArea, Select, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconCalendarDue, IconCash, IconExternalLink, IconPackage, IconUser } from "@tabler/icons-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import { meRequest } from "../api/auth";
import { orderMove, ordersList, orderSetWorkState, type OrderDto } from "../api/orders";
import { orderWorkStatesList } from "../api/order-work-states";
import { stagesList } from "../api/stages";
import { orderWorkStateBadgeColor, orderWorkStateOptionTextColor, orderWorkStateSelectStyles } from "../lib/order-work-state-ui";
import { money } from "../lib/order-form";
import dayjs from "dayjs";
import { OrderKanbanCard } from "../components/OrderKanbanCard";
import { OrderQuickAddModal } from "../components/OrderQuickAddModal";
import "./OrdersKanban.css";

type OrdersListData = Awaited<ReturnType<typeof ordersList>>;
type MoveVariables = { id: string; stageId: string; previous?: OrdersListData };

function stageAccentColor(isComplete: boolean): string {
  return isComplete ? "var(--mantine-color-green-5)" : "var(--mantine-color-blue-5)";
}

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
  const [quickAddOrder, setQuickAddOrder] = useState<OrderDto | null>(null);
  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const canMove = me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";

  const orders = useQuery({ queryKey: ["orders"], queryFn: () => ordersList() });
  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList });
  const workStates = useQuery({
    queryKey: ["order-work-states"],
    queryFn: orderWorkStatesList,
    enabled: canMove,
  });

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

  const workStateMut = useMutation({
    mutationFn: ({ id, workStateId }: { id: string; workStateId: string }) => orderSetWorkState(id, workStateId),
    onMutate: async ({ id, workStateId }) => {
      await qc.cancelQueries({ queryKey: ["orders"] });
      const previous = qc.getQueryData<OrdersListData>(["orders"]);
      const ws = workStates.data?.orderWorkStates.find((w) => w.id === workStateId);
      if (previous && ws) {
        qc.setQueryData<OrdersListData>(["orders"], {
          orders: previous.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  workState: { id: ws.id, slug: ws.slug, name: ws.name, sortOrder: ws.sortOrder },
                }
              : o,
          ),
        });
      }
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

  const workStateSelectData =
    workStates.data?.orderWorkStates.map((w) => ({ value: w.id, label: w.name })) ?? [];
  const workStateSlugById = useMemo(
    () => new Map((workStates.data?.orderWorkStates ?? []).map((w) => [w.id, w.slug])),
    [workStates.data],
  );

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
          p="xs"
          radius="md"
          withBorder
          className="order-kanban-column"
          style={{
            ["--kanban-column-accent" as string]: stageAccentColor(stage.isComplete),
            flex: "0 0 280px",
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
          }}
        >
          <Group justify="space-between" wrap="nowrap" className="order-kanban-column__header" gap="xs">
            <Group gap="xs" wrap="nowrap" className="order-kanban-column__title-wrap">
              <span className="order-kanban-column__accent" />
              <Text className="order-kanban-column__title" lineClamp={2}>
                {stage.name}
              </Text>
            </Group>
            <Text className="order-kanban-column__count">
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
                  minHeight: 120,
                  padding: "6px 4px 10px",
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
                        <OrderKanbanCard
                          order={o}
                          isDragging={snapshot.isDragging}
                          onClick={() => setPreviewOrder(o)}
                          statusSlot={
                            canMove && stage.allowWorkStates && workStateSelectData.length > 0 ? (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                role="presentation"
                              >
                                <Select
                                  size="xs"
                                  data={workStateSelectData}
                                  value={o.workState.id}
                                  onChange={(wsId) => {
                                    if (wsId && wsId !== o.workState.id) {
                                      workStateMut.mutate({ id: o.id, workStateId: wsId });
                                    }
                                  }}
                                  disabled={workStateMut.isPending}
                                  allowDeselect={false}
                                  styles={{ input: orderWorkStateSelectStyles(o.workState.slug) }}
                                  renderOption={({ option }) => (
                                    <Text
                                      size="sm"
                                      style={{ color: orderWorkStateOptionTextColor(workStateSlugById.get(option.value)) }}
                                    >
                                      {option.label}
                                    </Text>
                                  )}
                                />
                              </div>
                            ) : (
                              <Badge size="sm" variant="light" color={orderWorkStateBadgeColor(o.workState.slug)}>
                                {o.workState.name}
                              </Badge>
                            )
                          }
                        />
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
          <Title order={3}>По цеху</Title>
        </Group>
      </Group>

      {orders.isPending || stages.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {orders.isError ? (
        <Text c="red">{orders.error instanceof Error ? orders.error.message : "Ошибка"}</Text>
      ) : null}

      {stages.data && columns ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <ScrollArea type="scroll" offsetScrollbars>
            <Group align="flex-start" wrap="nowrap" gap="sm" pb="xs" style={{ minHeight: 360 }}>
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
              <Group gap="xs">
                <Badge variant="light">{previewOrder.currentStage.name}</Badge>
                <Badge variant="light" color={orderWorkStateBadgeColor(previewOrder.workState.slug)}>
                  {previewOrder.workState.name}
                </Badge>
              </Group>
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
              {canMove ? (
                <Button
                  variant="light"
                  onClick={() => {
                    setQuickAddOrder(previewOrder);
                  }}
                >
                  Добавить запись
                </Button>
              ) : null}
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
      <OrderQuickAddModal
        order={quickAddOrder ? { id: quickAddOrder.id, orderNumberFormatted: quickAddOrder.orderNumberFormatted } : null}
        opened={!!quickAddOrder}
        onClose={() => setQuickAddOrder(null)}
      />
    </>
  );
}
