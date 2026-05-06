import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { activityList, type ActivityAction } from "../api/activity";
import { userDisplayName } from "../lib/user-display-name";

function actionColor(action: ActivityAction): string {
  switch (action) {
    case "order.create":
      return "blue";
    case "order.move":
      return "cyan";
    case "order.work_state":
      return "violet";
    case "order.comment.create":
    case "order.comment.update":
      return "orange";
    case "time.create":
      return "teal";
  }
}

function orderLink(item: { action: ActivityAction; order: { id: string } | null }) {
  if (!item.order) return null;
  if (item.action === "order.comment.create" || item.action === "order.comment.update") {
    return `/orders/${item.order.id}?tab=comments`;
  }
  return `/orders/${item.order.id}`;
}

export function ActivityPage() {
  const q = useQuery({
    queryKey: ["activity", "today"],
    queryFn: () => activityList({ take: 200 }),
  });

  const grouped = useMemo(() => {
    const rows = q.data?.items ?? [];
    const byDay = new Map<string, typeof rows>();
    for (const row of rows) {
      const day = dayjs(row.createdAt).format("YYYY-MM-DD");
      const list = byDay.get(day) ?? [];
      list.push(row);
      byDay.set(day, list);
    }
    return [...byDay.entries()];
  }, [q.data?.items]);

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>Активность</Title>
        <Text size="sm" c="dimmed">
          События по заказам за выбранный период.
        </Text>
      </div>

      {q.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {q.isError ? <Text c="red">{q.error instanceof Error ? q.error.message : "Ошибка"}</Text> : null}
      {q.data && q.data.items.length === 0 ? (
        <Text size="sm" c="dimmed">
          Событий за период не найдено.
        </Text>
      ) : null}

      {grouped.map(([day, items]) => (
        <Stack key={day} gap="xs">
          <Text size="sm" fw={700} c="dimmed">
            {dayjs(day).format("D MMMM YYYY")}
          </Text>
          {items.map((item) => (
            <Card key={item.id} withBorder radius="md" p="sm">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Group gap="xs" align="center">
                    <Text fw={600}>{dayjs(item.createdAt).format("HH:mm")}</Text>
                    <Badge variant="light" color={actionColor(item.action)}>
                      {item.label}
                    </Badge>
                  </Group>
                  <Text size="sm">{item.details}</Text>
                  <Text size="xs" c="dimmed">
                    {userDisplayName(item.user)}
                    {item.order ? (
                      <>
                        {" · "}
                        <Text component={Link} to={orderLink(item) ?? "#"} span>
                          Заказ №{item.order.orderNumberFormatted}
                        </Text>
                      </>
                    ) : null}
                  </Text>
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
