import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { Link, useNavigate, useParams } from "react-router-dom";
import { meRequest } from "../api/auth";
import { customersList } from "../api/customers";
import { coatingTypesList, handleTypesList, millingTypesList } from "../api/facade-types";
import {
  orderDelete,
  orderGet,
  orderMove,
  orderPrintXlsxPath,
  orderUpdate,
  type OrderUpdatePayload,
} from "../api/orders";
import { apiBlob } from "../api/http";
import { stagesList } from "../api/stages";
import { OrderFormBody } from "../components/OrderFormBody";
import { OrderTimeEntriesSection } from "../components/OrderTimeEntriesSection";
import {
  buildOrderWritePayload,
  createOrderFormSchema,
  defaultsForNewFacadeRow,
  defaultFacadeRow,
  money,
  orderDtoToFormValues,
  type CreateOrderFormValues,
} from "../lib/order-form";
import dayjs from "dayjs";

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveStageId, setMoveStageId] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const canEdit = me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";
  const isAdmin = me.data?.user.role === "ADMIN";

  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderGet(orderId!),
    enabled: !!orderId,
  });

  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: customersList,
    enabled: canEdit && editOpen,
  });

  const millingTypes = useQuery({
    queryKey: ["milling-types"],
    queryFn: millingTypesList,
    enabled: canEdit && editOpen,
  });
  const coatingTypes = useQuery({
    queryKey: ["coating-types"],
    queryFn: coatingTypesList,
    enabled: canEdit && editOpen,
  });
  const handleTypes = useQuery({
    queryKey: ["handle-types"],
    queryFn: handleTypesList,
    enabled: canEdit && editOpen,
  });

  const catalogsReady = !!(millingTypes.data && coatingTypes.data && handleTypes.data);

  const newRowDefaults = useMemo(() => {
    if (!millingTypes.data || !coatingTypes.data) return { millingLabel: "", coatingTypeId: "" };
    return defaultsForNewFacadeRow({
      millingTypes: millingTypes.data.millingTypes,
      coatingTypes: coatingTypes.data.coatingTypes,
    });
  }, [millingTypes.data, coatingTypes.data]);

  const millingCatalog = useMemo(
    () =>
      (millingTypes.data?.millingTypes ?? []).map((t) => ({
        name: t.name,
        pricePerM2: t.pricePerM2,
      })),
    [millingTypes.data],
  );
  const handleCatalog = useMemo(
    () =>
      (handleTypes.data?.handleTypes ?? []).map((t) => ({
        name: t.name,
        pricePerMeter: t.pricePerMeter,
      })),
    [handleTypes.data],
  );

  const coatingOptions = useMemo(
    () =>
      (coatingTypes.data?.coatingTypes ?? []).map((t) => ({
        value: t.id,
        label: `${t.name} (${t.pricePerM2.toLocaleString("ru-RU")} ₽/м²)`,
      })),
    [coatingTypes.data],
  );

  const customerOptions = useMemo(
    () => (customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name })),
    [customers.data],
  );

  const stageOptions = useMemo(() => {
    if (!stages.data) return [];
    return stages.data.stages.map((s) => ({ value: s.id, label: s.name }));
  }, [stages.data]);

  const editForm = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: {
      customerId: "",
      deadlineAt: null,
      comment: "",
      facades: [defaultFacadeRow({ millingLabel: "", coatingTypeId: "" })],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: editForm.control,
    name: "facades",
  });

  useEffect(() => {
    if (editOpen && order.data?.order) {
      editForm.reset(orderDtoToFormValues(order.data.order));
    }
  }, [editOpen, order.data?.order, editForm]);

  const updateMut = useMutation({
    mutationFn: (body: OrderUpdatePayload) => orderUpdate(orderId!, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order", orderId] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
      setEditOpen(false);
    },
  });

  const moveMut = useMutation({
    mutationFn: (stageId: string) => orderMove(orderId!, stageId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order", orderId] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
      setMoveStageId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => orderDelete(orderId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void navigate("/orders", { replace: true });
    },
  });

  const o = order.data?.order;

  if (!orderId) {
    return <Text>Некорректная ссылка</Text>;
  }

  if (order.isPending) {
    return <Text c="dimmed">Загрузка…</Text>;
  }

  if (order.isError || !o) {
    return (
      <Stack>
        <Text c="red">{order.error instanceof Error ? order.error.message : "Заказ не найден"}</Text>
        <Button component={Link} to="/orders" variant="light">
          К списку
        </Button>
      </Stack>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Button variant="subtle" onClick={() => void navigate(-1)}>
          ← Назад
        </Button>
        <Group gap="sm">
          <Button component={Link} to="/orders" variant="light" size="sm">
            Список
          </Button>
          <Button component={Link} to="/orders/board" variant="light" size="sm">
            Канбан
          </Button>
          {canEdit ? (
            <>
              <Button
                component={Link}
                to={`/orders/${orderId}/cutting`}
                target="_blank"
                rel="noopener noreferrer"
                variant="light"
                size="sm"
              >
                Раскрой
              </Button>
              <Button
                variant="light"
                size="sm"
                onClick={async () => {
                  const blob = await apiBlob(orderPrintXlsxPath(orderId!));
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `zakaz_${o.orderNumberFormatted.replace(/\s/g, "_")}.xlsx`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Печать заказа
              </Button>
            </>
          ) : null}
          {isAdmin ? (
            <Button color="red" variant="light" size="sm" onClick={() => setDeleteOpen(true)}>
              Удалить
            </Button>
          ) : null}
        </Group>
      </Group>

      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <div>
          <Title order={2}>№{o.orderNumberFormatted}</Title>
          <Text c="dimmed" mt={4}>
            {o.customer.name}
          </Text>
        </div>
        <Stack gap="xs" align="flex-end">
          <Badge size="lg" variant="light">
            {o.currentStage.name}
          </Badge>
          {canEdit ? (
            <Group gap="xs">
              <Select
                placeholder="Переместить на…"
                data={stageOptions.filter((s) => s.value !== o.currentStage.id)}
                value={moveStageId}
                onChange={setMoveStageId}
                w={220}
                size="sm"
              />
              <Button
                size="sm"
                disabled={!moveStageId}
                loading={moveMut.isPending}
                onClick={() => {
                  if (moveStageId) moveMut.mutate(moveStageId);
                }}
              >
                Переместить
              </Button>
            </Group>
          ) : null}
        </Stack>
      </Group>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="md" radius="md">
            <Text size="sm" c="dimmed">
              Создан
            </Text>
            <Text>{dayjs(o.createdAt).format("D MMMM YYYY, HH:mm")}</Text>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">
              Дедлайн
            </Text>
            <Text>{o.deadlineAt ? dayjs(o.deadlineAt).format("D MMMM YYYY") : "—"}</Text>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">
              Количество фасадов
            </Text>
            <Text>{o.facadeCount} шт.</Text>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">
              Общая площадь
            </Text>
            <Text>{o.facadeAreaTotal} м²</Text>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">
              Стоимость фасадов
            </Text>
            <Text>{o.facadeCostTotal != null ? money.format(o.facadeCostTotal) : "—"}</Text>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">
              Стоимость фрезеровки
            </Text>
            <Text>{o.millingCostTotal != null ? money.format(o.millingCostTotal) : "—"}</Text>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">
              Стоимость ручек
            </Text>
            <Text>{o.handleCostTotal != null ? money.format(o.handleCostTotal) : "—"}</Text>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">
              Прочие услуги
            </Text>
            <Text>{o.otherServicesPrice != null ? money.format(o.otherServicesPrice) : "—"}</Text>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">
              Итого
            </Text>
            <Text fw={600}>{o.subtotal != null ? money.format(o.subtotal) : "—"}</Text>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">
              Скидка
            </Text>
            <Text>{o.discount != null ? money.format(o.discount) : "—"}</Text>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">
              Общая стоимость
            </Text>
            <Text fw={700} size="lg">
              {o.totalCost != null ? money.format(o.totalCost) : "—"}
            </Text>
            {o.advance != null && (
              <>
                <Divider my="sm" />
                <Text size="sm" c="dimmed">
                  Аванс
                </Text>
                <Text>{money.format(o.advance)}</Text>
              </>
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder p="md" radius="md">
            <Text fw={600} mb="xs">
              Комментарий
            </Text>
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {o.comment?.trim() ? o.comment : "—"}
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>

      <Group justify="space-between" mt="xl" mb="sm">
        <Title order={4}>Фасады</Title>
        {canEdit ? (
          <Button onClick={() => setEditOpen(true)}>Редактировать заказ</Button>
        ) : null}
      </Group>

      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>Размеры</Table.Th>
            <Table.Th>Толщ.</Table.Th>
            <Table.Th>Ручка</Table.Th>
            <Table.Th>Цвет</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {o.facades.map((f, i) => (
            <Table.Tr key={f.id}>
              <Table.Td>{i + 1}</Table.Td>
              <Table.Td>
                <Text size="sm">
                  {f.widthMm} × {f.heightMm} мм
                </Text>
                <Text size="xs" c="dimmed">
                  {[f.millingLabel, f.coatingType.name].filter(Boolean).join(" · ") || "—"}
                </Text>
              </Table.Td>
              <Table.Td>{f.thicknessMm}</Table.Td>
              <Table.Td>
                {f.handleLabel?.trim() ? (
                  <Text size="sm">
                    {f.handleLabel}
                    {f.handleLengthMm != null ? `, ${f.handleLengthMm} мм` : ""}
                  </Text>
                ) : (
                  "—"
                )}
              </Table.Td>
              <Table.Td>{f.color || "—"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <OrderTimeEntriesSection orderId={orderId!} canEdit={canEdit} />

      <Modal opened={deleteOpen} onClose={() => setDeleteOpen(false)} title="Удалить заказ">
        <Stack>
          <Text size="sm">
            Заказ №{o.orderNumberFormatted} будет перемещён в корзину и исчезнет из рабочих списков.
          </Text>
          {deleteMut.isError ? (
            <Text c="red" size="sm">
              {deleteMut.error instanceof Error ? deleteMut.error.message : "Ошибка"}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteOpen(false)}>
              Отмена
            </Button>
            <Button color="red" loading={deleteMut.isPending} onClick={() => deleteMut.mutate()}>
              Удалить
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title="Редактирование заказа"
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
        styles={{ body: { maxHeight: "min(85vh, 720px)" } }}
      >
        <form
          onSubmit={editForm.handleSubmit((v) => {
            if (!catalogsReady) return;
            updateMut.mutate(buildOrderWritePayload(v));
          })}
        >
          {!catalogsReady ? (
            <Text c="dimmed" size="sm">
              Загрузка справочников…
            </Text>
          ) : (
            <OrderFormBody
              form={editForm}
              fields={fields}
              append={append}
              remove={remove}
              customerOptions={customerOptions}
              millingCatalog={millingCatalog}
              coatingOptions={coatingOptions}
              handleCatalog={handleCatalog}
              newRowDefaults={newRowDefaults}
              actions={
                <>
                  {updateMut.isError ? (
                    <Text c="red" size="sm">
                      {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
                    </Text>
                  ) : null}
                  <Group justify="flex-end">
                    <Button type="button" variant="default" onClick={() => setEditOpen(false)}>
                      Отмена
                    </Button>
                    <Button type="submit" loading={updateMut.isPending}>
                      Сохранить
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
