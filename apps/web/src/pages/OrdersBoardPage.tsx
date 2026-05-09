import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Group, Modal, Paper, ScrollArea, Select, SimpleGrid, Stack, Table, Tabs, Text, Title } from "@mantine/core";
import { IconCalendarDue, IconCash, IconExternalLink, IconPackage, IconUser } from "@tabler/icons-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import { meRequest } from "../api/auth";
import { orderGet, orderMove, ordersList, orderSetWorkState, type OrderDto } from "../api/orders";
import { orderWorkStatesList } from "../api/order-work-states";
import { stagesList } from "../api/stages";
import { orderWorkStateBadgeColor, orderWorkStateOptionTextColor, orderWorkStateSelectStyles } from "../lib/order-work-state-ui";
import { money } from "../lib/order-form";
import dayjs from "dayjs";
import { OrderKanbanCard } from "../components/OrderKanbanCard";
import { OrderCommentsSection } from "../components/OrderCommentsSection";
import { OrderMaterialEntriesSection } from "../components/OrderMaterialEntriesSection";
import { OrderQuickAddModal } from "../components/OrderQuickAddModal";
import { OrderTimeEntriesSection } from "../components/OrderTimeEntriesSection";
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
  const [quickAddTab, setQuickAddTab] = useState<"time" | "material">("time");
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
  const previewOrderDetails = useQuery({
    queryKey: ["order", previewOrder?.id],
    queryFn: () => orderGet(previewOrder!.id),
    enabled: !!previewOrder?.id,
  });
  const previewData = previewOrderDetails.data?.order ?? previewOrder;

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
        size="90vw"
        styles={{ content: { maxWidth: 1200 } }}
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

            <Tabs defaultValue="overview">
              <Tabs.List>
                <Tabs.Tab value="overview">Обзор</Tabs.Tab>
                <Tabs.Tab value="finance">Финансы</Tabs.Tab>
                <Tabs.Tab value="comments">Комментарии</Tabs.Tab>
                <Tabs.Tab value="facades">Фасады</Tabs.Tab>
                <Tabs.Tab value="time">Трудозатраты</Tabs.Tab>
                <Tabs.Tab value="materials">Материалы</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="overview" pt="md">
                {previewData ? (
                  <Stack gap="md">
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <PreviewField
                        icon={<IconCalendarDue size={16} />}
                        label="Дедлайн"
                        value={previewData.deadlineAt ? dayjs(previewData.deadlineAt).format("D MMMM YYYY") : "—"}
                      />
                      <PreviewField
                        icon={<IconPackage size={16} />}
                        label="Фасады"
                        value={`${previewData.facadeCount} шт. · ${previewData.facadeAreaTotal} м²`}
                      />
                      <PreviewField
                        icon={<IconCash size={16} />}
                        label="Стоимость"
                        value={previewData.totalCost != null ? money.format(previewData.totalCost) : "—"}
                      />
                      <PreviewField
                        icon={<IconUser size={16} />}
                        label="Вид работы"
                        value={previewData.workType?.trim() ? previewData.workType : "—"}
                      />
                    </SimpleGrid>
                    <PreviewField
                      icon={<IconUser size={16} />}
                      label="Доставка"
                      value={previewData.deliveryAddress?.trim() ? previewData.deliveryAddress : "—"}
                    />
                    <PreviewField
                      icon={<IconUser size={16} />}
                      label="Комментарий к заказу"
                      value={previewData.comment?.trim() ? previewData.comment : "—"}
                    />
                  </Stack>
                ) : null}
              </Tabs.Panel>
              <Tabs.Panel value="finance" pt="md">
                {previewData ? (
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <PreviewField
                      icon={<IconCash size={16} />}
                      label="Стоимость фасадов"
                      value={previewData.facadeCostTotal != null ? money.format(previewData.facadeCostTotal) : "—"}
                    />
                    <PreviewField
                      icon={<IconCash size={16} />}
                      label="Стоимость фрезеровки"
                      value={previewData.millingCostTotal != null ? money.format(previewData.millingCostTotal) : "—"}
                    />
                    <PreviewField
                      icon={<IconCash size={16} />}
                      label="Стоимость ручек"
                      value={previewData.handleCostTotal != null ? money.format(previewData.handleCostTotal) : "—"}
                    />
                    <PreviewField
                      icon={<IconCash size={16} />}
                      label="Прочие услуги"
                      value={previewData.otherServicesPrice != null ? money.format(previewData.otherServicesPrice) : "—"}
                    />
                    <PreviewField
                      icon={<IconCash size={16} />}
                      label="Скидка"
                      value={previewData.discount != null ? money.format(previewData.discount) : "—"}
                    />
                    <PreviewField
                      icon={<IconCash size={16} />}
                      label="Аванс"
                      value={previewData.advance != null ? money.format(previewData.advance) : "—"}
                    />
                  </SimpleGrid>
                ) : null}
              </Tabs.Panel>
              <Tabs.Panel value="comments" pt="md">
                <OrderCommentsSection
                  orderId={previewOrder.id}
                  canEdit={canMove}
                  currentUserId={me.data?.user.id}
                  isAdmin={me.data?.user.role === "ADMIN"}
                />
              </Tabs.Panel>
              <Tabs.Panel value="facades" pt="md">
                {previewOrderDetails.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
                {previewOrderDetails.data?.order ? (
                  <ScrollArea type="auto" offsetScrollbars>
                    <Table striped highlightOnHover withTableBorder miw={900}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>#</Table.Th>
                          <Table.Th>Размеры</Table.Th>
                          <Table.Th>Кол-во</Table.Th>
                          <Table.Th>Толщина</Table.Th>
                          <Table.Th>Фрезеровка</Table.Th>
                          <Table.Th>Покрытие</Table.Th>
                          <Table.Th>Ручка</Table.Th>
                          <Table.Th>Цвет</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {previewOrderDetails.data.order.facades.map((f, i) => (
                          <Table.Tr key={f.id}>
                            <Table.Td>{i + 1}</Table.Td>
                            <Table.Td>{f.widthMm} × {f.heightMm} мм</Table.Td>
                            <Table.Td>{f.quantity} шт.</Table.Td>
                            <Table.Td>{f.thicknessMm} мм</Table.Td>
                            <Table.Td>{f.millingLabel || "—"}</Table.Td>
                            <Table.Td>{f.coatingType.name}</Table.Td>
                            <Table.Td>{f.handleLabel?.trim() ? f.handleLabel : "—"}</Table.Td>
                            <Table.Td>{f.color || "—"}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                ) : null}
              </Tabs.Panel>
              <Tabs.Panel value="time" pt="md">
                {canMove ? (
                  <Group justify="flex-end" mb="sm">
                    <Button
                      size="sm"
                      variant="light"
                      onClick={() => {
                        setQuickAddTab("time");
                        setQuickAddOrder(previewOrder);
                      }}
                    >
                      Добавить трудозатрату
                    </Button>
                  </Group>
                ) : null}
                <OrderTimeEntriesSection orderId={previewOrder.id} canEdit={canMove} showCreateForm={false} />
              </Tabs.Panel>
              <Tabs.Panel value="materials" pt="md">
                {canMove ? (
                  <Group justify="flex-end" mb="sm">
                    <Button
                      size="sm"
                      variant="light"
                      onClick={() => {
                        setQuickAddTab("material");
                        setQuickAddOrder(previewOrder);
                      }}
                    >
                      Добавить материал
                    </Button>
                  </Group>
                ) : null}
                <OrderMaterialEntriesSection orderId={previewOrder.id} canEdit={canMove} showCreateForm={false} />
              </Tabs.Panel>
            </Tabs>

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
      <OrderQuickAddModal
        order={quickAddOrder ? { id: quickAddOrder.id, orderNumberFormatted: quickAddOrder.orderNumberFormatted } : null}
        opened={!!quickAddOrder}
        initialTab={quickAddTab}
        onClose={() => setQuickAddOrder(null)}
      />
    </>
  );
}
