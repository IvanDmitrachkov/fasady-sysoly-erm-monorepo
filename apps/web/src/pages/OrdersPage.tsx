import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { z } from "zod";
import { meRequest } from "../api/auth";
import { customersList } from "../api/customers";
import { orderCreate, orderMove, ordersList } from "../api/orders";
import { stagesList } from "../api/stages";

const createSchema = z.object({
  customerId: z.string().min(1, "Выберите заказчика"),
  comment: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

export function OrdersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [stagePick, setStagePick] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const canCreate = me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";

  const orders = useQuery({ queryKey: ["orders"], queryFn: ordersList });
  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: customersList,
    enabled: canCreate && createOpen,
  });

  const stageOptions = useMemo(() => {
    if (!stages.data) return [];
    return stages.data.stages.map((s) => ({ value: s.id, label: s.name }));
  }, [stages.data]);

  const moveMut = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) => orderMove(id, stageId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      setMoveFor(null);
      setStagePick(null);
    },
  });

  const createMut = useMutation({
    mutationFn: orderCreate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      setCreateOpen(false);
      createForm.reset({ customerId: "", comment: "" });
    },
  });

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { customerId: "", comment: "" },
  });

  const rows = orders.data?.orders.map((o) => (
    <Table.Tr key={o.id}>
      <Table.Td>
        <Text fw={600}>№{o.orderNumberFormatted}</Text>
      </Table.Td>
      <Table.Td>{o.customer.name}</Table.Td>
      <Table.Td>{o.currentStage.name}</Table.Td>
      <Table.Td>{o.totalPrice != null ? String(o.totalPrice) : "—"}</Table.Td>
      <Table.Td>
        {canCreate ? (
          <Button size="xs" variant="light" onClick={() => setMoveFor(o.id)}>
            Этап…
          </Button>
        ) : null}
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={3}>Заказы</Title>
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>Новый заказ</Button>
        ) : null}
      </Group>

      {orders.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {orders.isError ? (
        <Text c="red">{orders.error instanceof Error ? orders.error.message : "Ошибка"}</Text>
      ) : null}

      {orders.data ? (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Номер</Table.Th>
              <Table.Th>Заказчик</Table.Th>
              <Table.Th>Этап</Table.Th>
              <Table.Th>Сумма</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      ) : null}

      <Modal opened={!!moveFor} onClose={() => setMoveFor(null)} title="Переместить заказ">
        <Stack>
          <Select
            label="Этап"
            data={stageOptions}
            value={stagePick}
            onChange={setStagePick}
            placeholder="Выберите этап"
          />
          <Button
            disabled={!moveFor || !stagePick}
            loading={moveMut.isPending}
            onClick={() => {
              if (moveFor && stagePick) moveMut.mutate({ id: moveFor, stageId: stagePick });
            }}
          >
            Переместить
          </Button>
          {moveMut.isError ? (
            <Text c="red" size="sm">
              {moveMut.error instanceof Error ? moveMut.error.message : "Ошибка"}
            </Text>
          ) : null}
        </Stack>
      </Modal>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Новый заказ">
        <form
          onSubmit={createForm.handleSubmit((v) => {
            createMut.mutate({
              customerId: v.customerId,
              comment: v.comment || null,
              totalPrice: null,
            });
          })}
        >
          <Stack>
            <Controller
              name="customerId"
              control={createForm.control}
              render={({ field, fieldState }) => (
                <Select
                  label="Заказчик"
                  placeholder="Выберите"
                  data={(customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Textarea label="Комментарий" {...createForm.register("comment")} />
            {createMut.isError ? (
              <Text c="red" size="sm">
                {createMut.error instanceof Error ? createMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Button type="submit" loading={createMut.isPending}>
              Создать
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
