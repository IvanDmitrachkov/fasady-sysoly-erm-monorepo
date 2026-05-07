import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconCalendarDue,
  IconCash,
  IconClockHour4,
  IconEdit,
  IconFileDownload,
  IconLayoutKanban,
  IconMapPin,
  IconPackage,
  IconPrinter,
  IconReceipt,
  IconScissors,
  IconTrash,
  IconUser,
  IconTool,
} from "@tabler/icons-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { meRequest } from "../api/auth";
import { customersList } from "../api/customers";
import { coatingTypesList, handleTypesList, millingTypesList } from "../api/facade-types";
import {
  orderDelete,
  orderGet,
  orderMove,
  orderPrintXlsxPath,
  orderSetWorkState,
  orderUpdate,
  type OrderUpdatePayload,
} from "../api/orders";
import { orderWorkStatesList } from "../api/order-work-states";
import { apiBlob } from "../api/http";
import { stagesList } from "../api/stages";
import { orderTimeEntriesXlsxPath } from "../api/time-entries";
import { OrderFormBody } from "../components/OrderFormBody";
import { OrderCommentsSection } from "../components/OrderCommentsSection";
import { OrderMaterialEntriesSection } from "../components/OrderMaterialEntriesSection";
import { OrderQuickAddModal } from "../components/OrderQuickAddModal";
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
import { orderWorkStateBadgeColor, orderWorkStateOptionTextColor, orderWorkStateSelectStyles } from "../lib/order-work-state-ui";
import "./OrderDetailPage.css";

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card withBorder radius="md" p="md">
      <Group gap="xs" mb="sm">
        <ThemeIcon variant="light" size={30} radius="md">
          {icon}
        </ThemeIcon>
      <Text fw={500}>{title}</Text>
      </Group>
      {children}
    </Card>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
        {value}
      </Text>
    </Stack>
  );
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [moveStageId, setMoveStageId] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const canEditOrder = me.data?.user.role === "ADMIN";
  const canWorkWithOrder = me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";
  const isAdmin = me.data?.user.role === "ADMIN";

  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderGet(orderId!),
    enabled: !!orderId,
  });

  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList });
  const workStates = useQuery({
    queryKey: ["order-work-states"],
    queryFn: orderWorkStatesList,
    enabled: canWorkWithOrder,
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: customersList,
    enabled: canEditOrder && editOpen,
  });

  const millingTypes = useQuery({
    queryKey: ["milling-types"],
    queryFn: millingTypesList,
    enabled: canEditOrder && editOpen,
  });
  const coatingTypes = useQuery({
    queryKey: ["coating-types"],
    queryFn: coatingTypesList,
    enabled: canEditOrder && editOpen,
  });
  const handleTypes = useQuery({
    queryKey: ["handle-types"],
    queryFn: handleTypesList,
    enabled: canEditOrder && editOpen,
  });

  const catalogsReady = !!(millingTypes.data && coatingTypes.data && handleTypes.data);

  const newRowDefaults = useMemo(() => {
    if (!millingTypes.data || !coatingTypes.data) return { millingLabel: "", coatingTypeId: "", handleLabel: "" };
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
        label: t.name,
      })),
    [coatingTypes.data],
  );

  const customerOptions = useMemo(
    () =>
      (customers.data?.customers ?? []).map((c) => ({
        value: c.id,
        label: c.phone?.trim() ? `${c.name} · ${c.phone}` : c.name,
        deliveryAddress: c.deliveryAddress,
      })),
    [customers.data],
  );

  const stageOptions = useMemo(() => {
    if (!stages.data) return [];
    return stages.data.stages.map((s) => ({ value: s.id, label: s.name }));
  }, [stages.data]);
  const workStateSlugById = useMemo(
    () => new Map((workStates.data?.orderWorkStates ?? []).map((w) => [w.id, w.slug])),
    [workStates.data],
  );

  const editForm = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: {
      customerId: "",
      deadlineAt: null,
      workType: "",
      deliveryAddress: "",
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

  const workStateMut = useMutation({
    mutationFn: (workStateId: string) => orderSetWorkState(orderId!, workStateId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order", orderId] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
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
  const tabFromQuery = searchParams.get("tab");
  const allowedTabs = canWorkWithOrder
    ? ["overview", "facades", "finance", "time", "materials", "comments"]
    : ["overview", "facades", "finance", "time", "materials"];
  const activeTab = allowedTabs.includes(tabFromQuery ?? "") ? (tabFromQuery as string) : "overview";

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
      <Paper withBorder p="md" radius="lg" mb="md" className="order-detail-header">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap="xs">
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => void navigate(-1)}
              w="fit-content"
            >
              Назад
            </Button>
            <Group gap="sm" align="center">
              <Title order={2}>№{o.orderNumberFormatted}</Title>
              <Badge size="lg" variant="light">
                {o.currentStage.name}
              </Badge>
              <Badge size="lg" variant="light" color={orderWorkStateBadgeColor(o.workState.slug)}>
                {o.workState.name}
              </Badge>
            </Group>
            <Text c="dimmed">
              {o.customer.name}
              {o.customer.phone?.trim() ? ` · ${o.customer.phone}` : ""}
            </Text>
          </Stack>

          <Stack gap="sm" align="flex-end" className="order-detail-actions">
            <Group gap="xs" wrap="wrap" justify="flex-end">
              {canWorkWithOrder ? (
                <>
                  <Button
                    component={Link}
                    to={`/orders/${orderId}/cutting`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="light"
                    size="sm"
                    leftSection={<IconScissors size={16} />}
                  >
                    Раскрой
                  </Button>
                  <Button
                    variant="light"
                    size="sm"
                    leftSection={<IconFileDownload size={16} />}
                    onClick={async () => {
                      const blob = await apiBlob(orderPrintXlsxPath(orderId!));
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      const exportedAt = dayjs().format("YYYY-MM-DD");
                      a.href = url;
                      a.download = `zakaz_${o.orderNumberFormatted.replace(/\s/g, "_")}_ot_${exportedAt}.xlsx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Выгрузка заказа Excel
                  </Button>
                  <Button
                    variant="light"
                    size="sm"
                    leftSection={<IconFileDownload size={16} />}
                    onClick={async () => {
                      const blob = await apiBlob(orderTimeEntriesXlsxPath(orderId!));
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      const exportedAt = dayjs().format("YYYY-MM-DD");
                      a.href = url;
                      a.download = `naryad_${o.orderNumberFormatted.replace(/\s/g, "_")}_ot_${exportedAt}.xlsx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Выгрузка наряда Excel
                  </Button>
                </>
              ) : null}
              {canEditOrder ? (
                  <Button size="sm" leftSection={<IconEdit size={16} />} onClick={() => setEditOpen(true)}>
                    Редактировать
                  </Button>
              ) : null}
              {canWorkWithOrder ? (
                <Button size="sm" variant="light" onClick={() => setQuickAddOpen(true)}>
                  Добавить запись
                </Button>
              ) : null}
              {isAdmin ? (
                <Button
                  color="red"
                  variant="light"
                  size="sm"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => setDeleteOpen(true)}
                >
                  Удалить
                </Button>
              ) : null}
            </Group>
            {canWorkWithOrder ? (
              <Stack gap="xs" className="order-detail-move-row" align="flex-end">
                <Group gap="xs" wrap="wrap" justify="flex-end">
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
                {workStates.data && o.currentStage.allowWorkStates ? (
                  <Select
                    label="На участке"
                    data={workStates.data.orderWorkStates.map((w) => ({ value: w.id, label: w.name }))}
                    value={o.workState.id}
                    onChange={(wsId) => {
                      if (wsId && wsId !== o.workState.id) workStateMut.mutate(wsId);
                    }}
                    disabled={workStateMut.isPending}
                    allowDeselect={false}
                    styles={{ input: orderWorkStateSelectStyles(o.workState.slug) }}
                    renderOption={({ option }) => (
                      <Text size="sm" style={{ color: orderWorkStateOptionTextColor(workStateSlugById.get(option.value)) }}>
                        {option.label}
                      </Text>
                    )}
                    w={280}
                    size="sm"
                  />
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Дедлайн
          </Text>
          <Text fw={500}>{o.deadlineAt ? dayjs(o.deadlineAt).format("D MMMM YYYY") : "—"}</Text>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Фасады
          </Text>
          <Text fw={500}>
            {o.facadeCount} шт. · {o.facadeAreaTotal} м²
          </Text>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Вид работы
          </Text>
          <Text fw={500}>{o.workType?.trim() ? o.workType : "—"}</Text>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Общая стоимость
          </Text>
          <Text fw={700} size="lg">
            {o.totalCost != null ? money.format(o.totalCost) : "—"}
          </Text>
        </Paper>
      </SimpleGrid>

      <Tabs
        value={activeTab}
        onChange={(next) => {
          if (!next) return;
          const updated = new URLSearchParams(searchParams);
          updated.set("tab", next);
          setSearchParams(updated, { replace: true });
        }}
        variant="outline"
        radius="md"
      >
        <ScrollArea type="auto" offsetScrollbars mb="md">
          <Tabs.List className="order-detail-tabs-list">
            <Tabs.Tab value="overview" leftSection={<IconReceipt size={16} />}>
              Обзор
            </Tabs.Tab>
            <Tabs.Tab value="facades" leftSection={<IconPackage size={16} />}>
              Фасады
            </Tabs.Tab>
            <Tabs.Tab value="finance" leftSection={<IconCash size={16} />}>
              Финансы
            </Tabs.Tab>
            <Tabs.Tab value="time" leftSection={<IconClockHour4 size={16} />}>
              Трудозатраты
            </Tabs.Tab>
            <Tabs.Tab value="materials" leftSection={<IconTool size={16} />}>
              Материалы
            </Tabs.Tab>
            {canWorkWithOrder ? (
              <Tabs.Tab value="comments" leftSection={<IconLayoutKanban size={16} />}>
                Комментарии
              </Tabs.Tab>
            ) : null}
          </Tabs.List>
        </ScrollArea>

        <Tabs.Panel value="overview">
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <InfoCard title="Клиент" icon={<IconUser size={18} />}>
              <Stack gap="sm">
                <Field label="Заказчик" value={o.customer.name} />
                <Field label="Телефон" value={o.customer.phone?.trim() ? o.customer.phone : "—"} />
              </Stack>
            </InfoCard>
            <InfoCard title="Производство" icon={<IconCalendarDue size={18} />}>
              <Stack gap="sm">
                <Field label="Создан" value={dayjs(o.createdAt).format("D MMMM YYYY, HH:mm")} />
                <Field label="Дедлайн" value={o.deadlineAt ? dayjs(o.deadlineAt).format("D MMMM YYYY") : "—"} />
                <Field label="Вид работы" value={o.workType?.trim() ? o.workType : "—"} />
              </Stack>
            </InfoCard>
            <InfoCard title="Доставка" icon={<IconMapPin size={18} />}>
              <Field label="Адрес" value={o.deliveryAddress?.trim() ? o.deliveryAddress : "—"} />
            </InfoCard>
            <InfoCard title="Комментарий" icon={<IconPrinter size={18} />}>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {o.comment?.trim() ? o.comment : "—"}
              </Text>
            </InfoCard>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="facades">
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Title order={4}>Фасады</Title>
              <Text size="sm" c="dimmed">
                {o.facadeCount} шт. · {o.facadeAreaTotal} м²
              </Text>
            </Group>
            <ScrollArea type="auto" offsetScrollbars>
              <Table striped highlightOnHover withTableBorder miw={900}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Размеры</Table.Th>
                    <Table.Th>Кол-во</Table.Th>
                    <Table.Th>Толщина</Table.Th>
                    <Table.Th>Фрезеровка</Table.Th>
                    <Table.Th>Покрытие</Table.Th>
                    <Table.Th>Ручка</Table.Th>
                    <Table.Th>Цвет</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {o.facades.map((f, i) => (
                    <Table.Tr key={f.id}>
                      <Table.Td>{i + 1}</Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {f.widthMm} × {f.heightMm} мм
                        </Text>
                      </Table.Td>
                      <Table.Td>{f.quantity} шт.</Table.Td>
                      <Table.Td>{f.thicknessMm} мм</Table.Td>
                      <Table.Td>{f.millingLabel || "—"}</Table.Td>
                      <Table.Td>{f.coatingType.name}</Table.Td>
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
            </ScrollArea>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="finance">
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <InfoCard title="Расчёт" icon={<IconCash size={18} />}>
              <Stack gap="sm">
                <Field label="Стоимость фасадов" value={o.facadeCostTotal != null ? money.format(o.facadeCostTotal) : "—"} />
                <Field label="Стоимость фрезеровки" value={o.millingCostTotal != null ? money.format(o.millingCostTotal) : "—"} />
                <Field label="Стоимость ручек" value={o.handleCostTotal != null ? money.format(o.handleCostTotal) : "—"} />
                <Field label="Прочие услуги" value={o.otherServicesPrice != null ? money.format(o.otherServicesPrice) : "—"} />
              </Stack>
            </InfoCard>
            <InfoCard title="Итоги" icon={<IconReceipt size={18} />}>
              <Stack gap="sm">
                <Field label="Итого" value={o.subtotal != null ? money.format(o.subtotal) : "—"} />
                <Field label="Скидка" value={o.discount != null ? money.format(o.discount) : "—"} />
                <Divider />
                <Group justify="space-between">
                  <Text fw={700}>Общая стоимость</Text>
                  <Text fw={700} size="lg">
                    {o.totalCost != null ? money.format(o.totalCost) : "—"}
                  </Text>
                </Group>
                <Field label="Аванс" value={o.advance != null ? money.format(o.advance) : "—"} />
              </Stack>
            </InfoCard>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="time">
          <OrderTimeEntriesSection orderId={orderId!} canEdit={canWorkWithOrder} showCreateForm={false} />
        </Tabs.Panel>
        <Tabs.Panel value="materials">
          <OrderMaterialEntriesSection orderId={orderId!} canEdit={canWorkWithOrder} showCreateForm={false} />
        </Tabs.Panel>
        {canWorkWithOrder ? (
          <Tabs.Panel value="comments">
            <OrderCommentsSection
              orderId={orderId!}
              canEdit={canWorkWithOrder}
              currentUserId={me.data?.user.id}
              isAdmin={isAdmin}
            />
          </Tabs.Panel>
        ) : null}
      </Tabs>

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

      <OrderQuickAddModal
        order={{ id: o.id, orderNumberFormatted: o.orderNumberFormatted }}
        opened={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />

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
