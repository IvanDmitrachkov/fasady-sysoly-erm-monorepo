import { Badge, Group, Paper, Stack, Text } from "@mantine/core";
import dayjs from "dayjs";
import { orderWorkStateBadgeColor } from "../lib/order-work-state-ui";
import type { OrderDto } from "../api/orders";
import "./OrderKanbanCard.css";

function kanbanAccentColor(slug: string | null | undefined): string {
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="order-kanban-card__meta-row">
      <Text className="order-kanban-card__meta-label">{label}</Text>
      <Text className="order-kanban-card__meta-value" lineClamp={1}>
        {value}
      </Text>
    </div>
  );
}

export function OrderKanbanCard({
  order,
  onClick,
  isDragging = false,
  statusSlot,
}: {
  order: OrderDto;
  onClick: () => void;
  isDragging?: boolean;
  statusSlot?: React.ReactNode;
}) {
  return (
    <Paper
      p="sm"
      radius="lg"
      withBorder
      className="order-kanban-card"
      data-dragging={isDragging || undefined}
      style={{ ["--kanban-card-accent" as string]: kanbanAccentColor(order.workState.slug) }}
      onClick={onClick}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text className="order-kanban-card__eyebrow">Заказ</Text>
            <Text className="order-kanban-card__title" lineClamp={1}>
              №{order.orderNumberFormatted}
            </Text>
          </div>
          <Badge variant="white" color="gray" radius="sm" className="order-kanban-card__badge">
            {order.facadeCount} шт
          </Badge>
        </Group>

        <Stack gap={2}>
          <Text className="order-kanban-card__customer" lineClamp={2}>
            {order.customer.name}
          </Text>
          <Text className="order-kanban-card__subtitle" lineClamp={1}>
            {order.workType?.trim() ? order.workType : "Без типа работ"}
          </Text>
        </Stack>

        <div>{statusSlot ?? <Badge color={orderWorkStateBadgeColor(order.workState.slug)}>{order.workState.name}</Badge>}</div>

        <Stack gap={6}>
          <MetaRow label="Дедлайн" value={order.deadlineAt ? dayjs(order.deadlineAt).format("D MMM YYYY") : "Не указан"} />
          <MetaRow label="Площадь" value={`${order.facadeAreaTotal} м2`} />
        </Stack>
      </Stack>
    </Paper>
  );
}
