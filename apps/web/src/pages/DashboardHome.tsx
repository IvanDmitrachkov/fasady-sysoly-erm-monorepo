import { Text, Title } from "@mantine/core";
import dayjs from "dayjs";

export function DashboardHome() {
  return (
    <>
      <Title order={3}>Рабочий стол</Title>
      <Text mt="md" c="dimmed">
        Сегодня {dayjs().format("D MMMM YYYY, HH:mm")}
      </Text>
      <Text mt="sm">
        «Заказы» — таблица и создание; «Канбан» — доска по этапам. Карточка заказа открывается по номеру. Этапы
        настраивает администратор.
      </Text>
    </>
  );
}
