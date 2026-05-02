import { Text, Title } from "@mantine/core";
import dayjs from "dayjs";

export function DashboardHome() {
  return (
    <>
      <Title order={3}>Рабочий стол</Title>
      <Text mt="md" c="dimmed">
        Сегодня {dayjs().format("D MMMM YYYY, HH:mm")}
      </Text>
      <Text mt="sm">Раздел «Заказы» — список и перемещение по этапам.</Text>
    </>
  );
}
