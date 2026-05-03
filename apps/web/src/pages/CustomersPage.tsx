import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Group, Modal, Paper, ScrollArea, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { meRequest } from "../api/auth";
import { customerCreate, customerUpdate, customersList } from "../api/customers";
import "./CustomersPage.css";

const customerSchema = z.object({
  name: z.string().min(1, "Введите название"),
  phone: z.string().optional(),
  deliveryAddress: z.string().optional(),
});
type CustomerForm = z.infer<typeof customerSchema>;

export function CustomersPage() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const list = useQuery({
    queryKey: ["customers"],
    queryFn: customersList,
    enabled: me.data?.user.role === "ADMIN",
  });

  const createForm = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", phone: "", deliveryAddress: "" },
  });

  const editForm = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", phone: "", deliveryAddress: "" },
  });

  const createMut = useMutation({
    mutationFn: (body: CustomerForm) =>
      customerCreate({
        name: body.name.trim(),
        phone: body.phone?.trim() ? body.phone.trim() : null,
        deliveryAddress: body.deliveryAddress?.trim() ? body.deliveryAddress.trim() : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      createForm.reset({ name: "", phone: "", deliveryAddress: "" });
    },
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CustomerForm }) =>
      customerUpdate(id, {
        name: body.name.trim(),
        phone: body.phone?.trim() ? body.phone.trim() : null,
        deliveryAddress: body.deliveryAddress?.trim() ? body.deliveryAddress.trim() : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setEditId(null);
      editForm.reset({ name: "", phone: "", deliveryAddress: "" });
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
          createMut.mutate(v);
        })}
      >
        <Group align="flex-end" mb="xl" className="customers-create-row">
          <TextInput
            label="Новый заказчик"
            placeholder="Название компании"
            style={{ flex: 1, maxWidth: 400 }}
            {...createForm.register("name")}
            error={createForm.formState.errors.name?.message}
          />
          <TextInput
            label="Телефон"
            placeholder="+7 ..."
            style={{ flex: 1, maxWidth: 260 }}
            {...createForm.register("phone")}
            error={createForm.formState.errors.phone?.message}
          />
          <TextInput
            label="Адрес доставки"
            placeholder="Город, улица, дом"
            style={{ flex: 1, minWidth: 260 }}
            {...createForm.register("deliveryAddress")}
            error={createForm.formState.errors.deliveryAddress?.message}
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
        <>
          <ScrollArea type="auto" offsetScrollbars visibleFrom="sm">
            <Table striped withTableBorder miw={760}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Название</Table.Th>
                  <Table.Th>Телефон</Table.Th>
                  <Table.Th>Адрес доставки</Table.Th>
                  <Table.Th w={140} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {list.data.customers.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>{c.name}</Table.Td>
                    <Table.Td>{c.phone?.trim() ? c.phone : "—"}</Table.Td>
                    <Table.Td>{c.deliveryAddress?.trim() ? c.deliveryAddress : "—"}</Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => {
                          setEditId(c.id);
                          editForm.reset({
                            name: c.name,
                            phone: c.phone ?? "",
                            deliveryAddress: c.deliveryAddress ?? "",
                          });
                        }}
                      >
                        Переименовать
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          <Stack gap="sm" hiddenFrom="sm">
            {list.data.customers.map((c) => (
              <Paper key={c.id} withBorder p="md" radius="md">
                <Stack gap="xs">
                  <div>
                    <Text fw={600}>{c.name}</Text>
                    <Text size="sm" c={c.phone?.trim() ? undefined : "dimmed"}>
                      {c.phone?.trim() ? c.phone : "телефон не указан"}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Адрес доставки
                    </Text>
                    <Text size="sm" c={c.deliveryAddress?.trim() ? undefined : "dimmed"}>
                      {c.deliveryAddress?.trim() ? c.deliveryAddress : "—"}
                    </Text>
                  </div>
                  <Button
                    size="xs"
                    variant="light"
                    fullWidth
                    onClick={() => {
                      setEditId(c.id);
                      editForm.reset({
                        name: c.name,
                        phone: c.phone ?? "",
                        deliveryAddress: c.deliveryAddress ?? "",
                      });
                    }}
                  >
                    Переименовать
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </>
      ) : null}

      <Modal opened={!!editId} onClose={() => setEditId(null)} title="Переименовать заказчика">
        <form
          onSubmit={editForm.handleSubmit((v) => {
            if (editId) patchMut.mutate({ id: editId, body: v });
          })}
        >
          <Stack>
            <TextInput label="Название" {...editForm.register("name")} error={editForm.formState.errors.name?.message} />
            <TextInput label="Телефон" {...editForm.register("phone")} error={editForm.formState.errors.phone?.message} />
            <TextInput
              label="Адрес доставки"
              {...editForm.register("deliveryAddress")}
              error={editForm.formState.errors.deliveryAddress?.message}
            />
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
