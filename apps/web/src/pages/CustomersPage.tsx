import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Group, Modal, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { meRequest } from "../api/auth";
import { customerCreate, customerUpdate, customersList } from "../api/customers";

const nameSchema = z.object({ name: z.string().min(1, "Введите название") });
type NameForm = z.infer<typeof nameSchema>;

export function CustomersPage() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const list = useQuery({
    queryKey: ["customers"],
    queryFn: customersList,
    enabled: me.data?.user.role === "ADMIN",
  });

  const createForm = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: "" },
  });

  const editForm = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: "" },
  });

  const createMut = useMutation({
    mutationFn: (name: string) => customerCreate(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      createForm.reset({ name: "" });
    },
  });

  const patchMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => customerUpdate(id, name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setEditId(null);
      editForm.reset({ name: "" });
    },
  });

  if (me.isPending) {
    return <Text c="dimmed">Загрузка…</Text>;
  }
  if (me.isSuccess && me.data.user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Title order={3} mb="md">
        Заказчики
      </Title>
      <Text c="dimmed" size="sm" mb="lg">
        Управление заказчиками — только для администратора.
      </Text>

      <form
        onSubmit={createForm.handleSubmit((v) => {
          createMut.mutate(v.name.trim());
        })}
      >
        <Group align="flex-end" mb="xl">
          <TextInput
            label="Новый заказчик"
            placeholder="Название компании"
            style={{ flex: 1, maxWidth: 400 }}
            {...createForm.register("name")}
            error={createForm.formState.errors.name?.message}
          />
          <Button type="submit" loading={createMut.isPending}>
            Добавить
          </Button>
        </Group>
        {createMut.isError ? (
          <Text c="red" size="sm" mb="md">
            {createMut.error instanceof Error ? createMut.error.message : "Ошибка"}
          </Text>
        ) : null}
      </form>

      {list.isPending ? <Text c="dimmed">Загрузка списка…</Text> : null}
      {list.isError ? (
        <Text c="red">{list.error instanceof Error ? list.error.message : "Ошибка"}</Text>
      ) : null}

      {list.data ? (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Название</Table.Th>
              <Table.Th w={140} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list.data.customers.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.name}</Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => {
                      setEditId(c.id);
                      editForm.reset({ name: c.name });
                    }}
                  >
                    Переименовать
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : null}

      <Modal opened={!!editId} onClose={() => setEditId(null)} title="Переименовать заказчика">
        <form
          onSubmit={editForm.handleSubmit((v) => {
            if (editId) patchMut.mutate({ id: editId, name: v.name.trim() });
          })}
        >
          <Stack>
            <TextInput label="Название" {...editForm.register("name")} error={editForm.formState.errors.name?.message} />
            {patchMut.isError ? (
              <Text c="red" size="sm">
                {patchMut.error instanceof Error ? patchMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Button type="submit" loading={patchMut.isPending}>
              Сохранить
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
