import { useQuery } from "@tanstack/react-query";
import { Table, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import { auditList } from "../api/audit";
import { userDisplayName } from "../lib/user-display-name";

export function AuditPage() {
  const q = useQuery({ queryKey: ["audit"], queryFn: () => auditList({ take: 100 }) });

  return (
    <>
      <Title order={3} mb="md">
        Журнал изменений
      </Title>
      {q.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {q.isError ? (
        <Text c="red">{q.error instanceof Error ? q.error.message : "Ошибка"}</Text>
      ) : null}
      {q.data ? (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Время</Table.Th>
              <Table.Th>Пользователь</Table.Th>
              <Table.Th>Действие</Table.Th>
              <Table.Th>Сообщение</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.items.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{dayjs(row.createdAt).format("DD.MM.YYYY HH:mm")}</Table.Td>
                <Table.Td>{userDisplayName(row.user)}</Table.Td>
                <Table.Td>{row.action}</Table.Td>
                <Table.Td>{row.message}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : null}
    </>
  );
}
