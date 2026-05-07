import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Divider, Group, Modal, Paper, ScrollArea, Select, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconCalendarDue, IconCash, IconExternalLink, IconPackage, IconUser } from "@tabler/icons-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { meRequest } from "../api/auth";
import { ordersList, orderSetWorkState, type OrderDto } from "../api/orders";
import { orderWorkStatesList } from "../api/order-work-states";
import { stagesList } from "../api/stages";
import { orderWorkStateBadgeColor } from "../lib/order-work-state-ui";
import { money } from "../lib/order-form";
import dayjs from "dayjs";
import { OrderKanbanCard } from "../components/OrderKanbanCard";
import { OrderQuickAddModal } from "../components/OrderQuickAddModal";
import "./OrdersKanban.css";

const STATION_STAGE_LS_KEY = "erm_station_board_stage_id";

type OrdersListData = Awaited<ReturnType<typeof ordersList>>;

function workStateAccentColor(slug: string): string {
  switch (orderWorkStateBadgeColor(slug)) {
    case "blue":
      return "var(--mantine-color-blue-5)";
    case "green":
      return "var(--mantine-color-green-5)";
    case "red":
      return "var(--mantine-color-red-5)";
    default:
      return "var(--mantine-color-gray-5)";
  }
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

export function OrdersStationBoardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [previewOrder, setPreviewOrder] = useState<OrderDto | null>(null);
  const [quickAddOrder, setQuickAddOrder] = useState<OrderDto | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const isCustomer = me.data?.user.role === "CUSTOMER";
  const canMove = me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";

  const orders = useQuery({ queryKey: ["orders"], queryFn: () => ordersList() });
  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList });
  const workStates = useQuery({
    queryKey: ["order-work-states"],
    queryFn: orderWorkStatesList,
    enabled: canMove && !isCustomer,
  });

  const [selectedStageId, setSelectedStageId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STATION_STAGE_LS_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const list = stages.data?.stages;
    if (!list?.length) return;
    const ok = selectedStageId && list.some((s) => s.id === selectedStageId);
    if (!ok) {
      setSelectedStageId(list[0]!.id);
    }
  }, [stages.data, selectedStageId]);

  useEffect(() => {
    if (!selectedStageId) return;
    try {
      localStorage.setItem(STATION_STAGE_LS_KEY, selectedStageId);
    } catch {
      /* ignore */
    }
  }, [selectedStageId]);

  const ordersOnStage = useMemo(() => {
    if (!selectedStageId || !orders.data) return [];
    return orders.data.orders.filter((o) => o.currentStage.id === selectedStageId);
  }, [orders.data, selectedStageId]);
  const selectedStage = stages.data?.stages.find((s) => s.id === selectedStageId);
  const allowWorkStatesOnStage = selectedStage?.allowWorkStates ?? true;

  const byWorkState = useMemo(() => {
    const map = new Map<string, OrderDto[]>();
    for (const w of workStates.data?.orderWorkStates ?? []) {
      map.set(w.id, []);
    }
    for (const o of ordersOnStage) {
      const list = map.get(o.workState.id);
      if (list) list.push(o);
      else map.set(o.workState.id, [o]);
    }
    return map;
  }, [ordersOnStage, workStates.data]);

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

  const onDragEnd = (result: DropResult) => {
    if (!canMove || !allowWorkStatesOnStage) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const previous = qc.getQueryData<OrdersListData>(["orders"]);
    const ws = workStates.data?.orderWorkStates.find((w) => w.id === destination.droppableId);
    if (previous && ws) {
      qc.setQueryData<OrdersListData>(["orders"], {
        orders: previous.orders.map((o) =>
          o.id === draggableId
            ? {
                ...o,
                workState: { id: ws.id, slug: ws.slug, name: ws.name, sortOrder: ws.sortOrder },
              }
            : o,
        ),
      });
    }

    workStateMut.mutate({ id: draggableId, workStateId: destination.droppableId });
  };

  const stageSelectData = useMemo(
    () => (stages.data?.stages ?? []).map((s) => ({ value: s.id, label: s.name })),
    [stages.data],
  );

  const selectedStageName = selectedStage?.name;

  const columns = !allowWorkStatesOnStage ? (
    <Paper
      key="single-stage-column"
      shadow="sm"
      p="xs"
      radius="md"
      withBorder
      className="order-kanban-column"
      style={{
        ["--kanban-column-accent" as string]: "var(--mantine-color-blue-5)",
        flex: "0 0 320px",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
      }}
    >
      <Group justify="space-between" wrap="nowrap" className="order-kanban-column__header" gap="xs">
        <Group gap="xs" wrap="nowrap" className="order-kanban-column__title-wrap">
          <span className="order-kanban-column__accent" />
          <Text className="order-kanban-column__title" lineClamp={1}>
            Заказы
          </Text>
        </Group>
        <Text className="order-kanban-column__count">
          {ordersOnStage.length}
        </Text>
      </Group>
      <Stack
        gap="sm"
        style={{
          flex: 1,
          minHeight: 120,
          padding: "6px 4px 10px",
        }}
      >
        {ordersOnStage.map((o) => (
          <OrderKanbanCard
            key={o.id}
            order={o}
            onClick={() => setPreviewOrder(o)}
            statusSlot={
              <Badge size="sm" variant="light" color={orderWorkStateBadgeColor(o.workState.slug)}>
                {o.workState.name}
              </Badge>
            }
          />
        ))}
      </Stack>
    </Paper>
  ) : (
    workStates.data?.orderWorkStates.map((ws) => {
      const list = byWorkState.get(ws.id) ?? [];
      return (
        <Paper
          key={ws.id}
          shadow="sm"
          p="xs"
          radius="md"
          withBorder
          className="order-kanban-column"
          style={{
            ["--kanban-column-accent" as string]: workStateAccentColor(ws.slug),
            flex: "0 0 260px",
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
          }}
        >
          <Group justify="space-between" wrap="nowrap" className="order-kanban-column__header" gap="xs">
            <Group gap="xs" wrap="nowrap" className="order-kanban-column__title-wrap">
              <span className="order-kanban-column__accent" />
              <Text className="order-kanban-column__title" lineClamp={1}>
                {ws.name}
              </Text>
            </Group>
            <Text className="order-kanban-column__count">
              {list.length}
            </Text>
          </Group>
          <Droppable droppableId={ws.id}>
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
    }) ?? null
  );

  if (me.isPending) {
    return <Text c="dimmed">Загрузка…</Text>;
  }

  if (isCustomer) {
    return <Navigate to="/orders" replace />;
  }

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap" align="flex-end">
        <Stack gap="xs" style={{ flex: 1, minWidth: 220 }}>
          <Title order={3}>На участке</Title>
          <Select
            label="Точка (этап)"
            placeholder="Выберите этап"
            data={stageSelectData}
            value={selectedStageId}
            onChange={(id) => setSelectedStageId(id)}
            searchable
            maxDropdownHeight={280}
            maw={420}
          />
          {selectedStageName && allowWorkStatesOnStage ? (
            <Text size="sm" c="dimmed">
              Заказы на этапе «{selectedStageName}»: карточки перетаскивайте между колонками под-статусов.
            </Text>
          ) : null}
          {selectedStageName && !allowWorkStatesOnStage ? (
            <Text size="sm" c="dimmed">
              Для этапа «{selectedStageName}» под-статусы отключены.
            </Text>
          ) : null}
        </Stack>
      </Group>

      {orders.isPending || stages.isPending || (allowWorkStatesOnStage && workStates.isPending) ? (
        <Text c="dimmed">Загрузка…</Text>
      ) : null}
      {orders.isError ? (
        <Text c="red">{orders.error instanceof Error ? orders.error.message : "Ошибка"}</Text>
      ) : null}

      {(allowWorkStatesOnStage ? workStates.data && columns : columns) ? (
        allowWorkStatesOnStage ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <ScrollArea type="scroll" offsetScrollbars>
            <Group align="flex-start" wrap="nowrap" gap="sm" pb="xs" style={{ minHeight: 360 }}>
              {columns}
            </Group>
          </ScrollArea>
        </DragDropContext>
        ) : (
          <ScrollArea type="scroll" offsetScrollbars>
            <Group align="flex-start" wrap="nowrap" gap="sm" pb="xs" style={{ minHeight: 360 }}>
              {columns}
            </Group>
          </ScrollArea>
        )
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
