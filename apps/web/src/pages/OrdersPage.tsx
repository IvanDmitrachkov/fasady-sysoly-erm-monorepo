import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Modal, ScrollArea, Select, Stack, Table, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { meRequest } from "../api/auth";
import { customersList } from "../api/customers";
import { coatingTypesList, handleTypesList, millingTypesList } from "../api/facade-types";
import { orderCreate, orderMove, ordersList } from "../api/orders";
import { stagesList } from "../api/stages";
import { OrderFormBody } from "../components/OrderFormBody";
import {
  buildCatalogLookup,
  buildOrderWritePayload,
  createOrderFormSchema,
  defaultCatalogIds,
  defaultFacadeRow,
  type CreateOrderFormValues,
  money,
} from "../lib/order-form";

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

  const millingTypes = useQuery({
    queryKey: ["milling-types"],
    queryFn: millingTypesList,
    enabled: canCreate && createOpen,
  });
  const coatingTypes = useQuery({
    queryKey: ["coating-types"],
    queryFn: coatingTypesList,
    enabled: canCreate && createOpen,
  });
  const handleTypes = useQuery({
    queryKey: ["handle-types"],
    queryFn: handleTypesList,
    enabled: canCreate && createOpen,
  });

  const catalogReady =
    millingTypes.data && coatingTypes.data && handleTypes.data
      ? buildCatalogLookup({
          millingTypes: millingTypes.data.millingTypes,
          coatingTypes: coatingTypes.data.coatingTypes,
          handleTypes: handleTypes.data.handleTypes,
        })
      : null;

  const newRowDefaults = useMemo(() => {
    if (!millingTypes.data || !coatingTypes.data) return { millingTypeId: "", coatingTypeId: "" };
    return defaultCatalogIds({
      millingTypes: millingTypes.data.millingTypes,
      coatingTypes: coatingTypes.data.coatingTypes,
    });
  }, [millingTypes.data, coatingTypes.data]);

  const millingOptions = useMemo(
    () =>
      (millingTypes.data?.millingTypes ?? []).map((t) => ({
        value: t.id,
        label: `${t.name} (${t.pricePerM2.toLocaleString("ru-RU")} ₽/м²)`,
      })),
    [millingTypes.data],
  );
  const coatingOptions = useMemo(
    () =>
      (coatingTypes.data?.coatingTypes ?? []).map((t) => ({
        value: t.id,
        label: `${t.name} (${t.pricePerM2.toLocaleString("ru-RU")} ₽/м²)`,
      })),
    [coatingTypes.data],
  );
  const handleOptions = useMemo(
    () =>
      (handleTypes.data?.handleTypes ?? []).map((t) => ({
        value: t.id,
        label: `${t.name} (${t.pricePerMeter.toLocaleString("ru-RU")} ₽/м)`,
      })),
    [handleTypes.data],
  );

  const customerOptions = useMemo(
    () => (customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name })),
    [customers.data],
  );

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

  const createForm = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: {
      customerId: "",
      deadlineAt: null,
      comment: "",
      facades: [defaultFacadeRow({ millingTypeId: "", coatingTypeId: "" })],
    },
  });

  useEffect(() => {
    if (!createOpen || !millingTypes.data || !coatingTypes.data || !handleTypes.data) return;
    const defs = defaultCatalogIds({
      millingTypes: millingTypes.data.millingTypes,
      coatingTypes: coatingTypes.data.coatingTypes,
    });
    createForm.reset({
      customerId: "",
      deadlineAt: null,
      comment: "",
      facades: [defaultFacadeRow(defs)],
    });
  }, [createOpen, millingTypes.data, coatingTypes.data, handleTypes.data, createForm]);

  const { fields, append, remove } = useFieldArray({
    control: createForm.control,
    name: "facades",
  });

  const createMut = useMutation({
    mutationFn: (v: CreateOrderFormValues) => {
      if (!catalogReady) throw new Error("Справочники не загружены");
      return orderCreate(buildOrderWritePayload(v, catalogReady));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      setCreateOpen(false);
      createForm.reset({
        customerId: "",
        deadlineAt: null,
        comment: "",
        facades: [defaultFacadeRow(newRowDefaults)],
      });
    },
  });

  const rows = orders.data?.orders.map((o) => (
    <Table.Tr key={o.id}>
      <Table.Td>
        <Text component={Link} to={`/orders/${o.id}`} fw={600} c="blue" style={{ textDecoration: "none" }}>
          №{o.orderNumberFormatted}
        </Text>
      </Table.Td>
      <Table.Td>{o.customer.name}</Table.Td>
      <Table.Td>{o.currentStage.name}</Table.Td>
      <Table.Td>
        <Text size="sm">{o.facadeCount} шт. ({o.facades.length} поз.)</Text>
      </Table.Td>
      <Table.Td>{o.totalCost != null ? money.format(o.totalCost) : "—"}</Table.Td>
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
      <Group justify="space-between" mb="md" wrap="wrap">
        <Group gap="sm">
          <Title order={3}>Заказы</Title>
          <Button component={Link} to="/orders/board" variant="light" size="sm">
            Канбан
          </Button>
        </Group>
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
              <Table.Th>Фасады</Table.Th>
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
          {moveFor ? (
            <Button component={Link} to={`/orders/${moveFor}`} variant="subtle" size="xs">
              Открыть карточку заказа
            </Button>
          ) : null}
          {moveMut.isError ? (
            <Text c="red" size="sm">
              {moveMut.error instanceof Error ? moveMut.error.message : "Ошибка"}
            </Text>
          ) : null}
        </Stack>
      </Modal>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый заказ"
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
        styles={{ body: { maxHeight: "min(85vh, 720px)" } }}
      >
        <form
          onSubmit={createForm.handleSubmit((v) => {
            createMut.mutate(v);
          })}
        >
          {!catalogReady ? (
            <Text c="dimmed" size="sm">
              Загрузка справочников фрезеровки / покрытия / ручки…
            </Text>
          ) : (
            <OrderFormBody
              form={createForm}
              fields={fields}
              append={append}
              remove={remove}
              customerOptions={customerOptions}
              catalog={catalogReady}
              millingOptions={millingOptions}
              coatingOptions={coatingOptions}
              handleOptions={handleOptions}
              newRowDefaults={newRowDefaults}
              actions={
                <>
                  {createMut.isError ? (
                    <Text c="red" size="sm">
                      {createMut.error instanceof Error ? createMut.error.message : "Ошибка"}
                    </Text>
                  ) : null}
                  <Group justify="flex-end">
                    <Button type="button" variant="default" onClick={() => setCreateOpen(false)}>
                      Отмена
                    </Button>
                    <Button type="submit" loading={createMut.isPending}>
                      Создать заказ
                    </Button>
                  </Group>
                </>
              }
            />
          )}
        </form>
      </Modal>
    </>
  );
}
