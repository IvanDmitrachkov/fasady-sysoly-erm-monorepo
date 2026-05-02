import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { z } from "zod";
import dayjs from "dayjs";
import { meRequest } from "../api/auth";
import { customersList } from "../api/customers";
import { orderCreate, orderMove, ordersList } from "../api/orders";
import { stagesList } from "../api/stages";
import {
  computeOrderTotal,
  estimateFacadeBasePrice,
  sumFacadeBasePrices,
} from "../lib/facade-pricing";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const facadeRowSchema = z.object({
  milling: z.string(),
  coating: z.string(),
  color: z.string(),
  dimensionsMm: z.string().min(1, "Размеры, мм"),
  thicknessMm: z.number().positive("Толщина > 0"),
  integratedHandle: z.boolean(),
  edgeRadius: z.number().finite().nullable().optional(),
  optionsExtra: z.string().optional(),
});

const createOrderFormSchema = z.object({
  customerId: z.string().min(1, "Выберите заказчика"),
  deadlineAt: z.date().nullable().optional(),
  comment: z.string().optional(),
  overridePercent: z.number().finite().nullable().optional(),
  overridePrice: z.number().finite().nullable().optional(),
  facades: z.array(facadeRowSchema).min(1, "Добавьте хотя бы одну позицию"),
});

type CreateOrderForm = z.infer<typeof createOrderFormSchema>;

const defaultFacadeRow = (): CreateOrderForm["facades"][number] => ({
  milling: "",
  coating: "",
  color: "",
  dimensionsMm: "",
  thicknessMm: 16,
  integratedHandle: false,
  edgeRadius: null,
  optionsExtra: "",
});

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

  const createForm = useForm<CreateOrderForm>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: {
      customerId: "",
      deadlineAt: null,
      comment: "",
      overridePercent: null,
      overridePrice: null,
      facades: [defaultFacadeRow()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: createForm.control,
    name: "facades",
  });

  const watchedFacades = useWatch({ control: createForm.control, name: "facades" });
  const watchedOverrides = useWatch({
    control: createForm.control,
    name: ["overridePercent", "overridePrice"],
  });

  const pricing = useMemo(() => {
    const rows = (watchedFacades ?? []).map((row) => ({
      dimensionsMm: row?.dimensionsMm ?? "",
      thicknessMm: row?.thicknessMm ?? 0,
      integratedHandle: !!row?.integratedHandle,
      milling: row?.milling ?? "",
      coating: row?.coating ?? "",
      color: row?.color ?? "",
      edgeRadius: row?.edgeRadius,
      optionsExtra: row?.optionsExtra,
    }));
    const linePrices = rows.map((r) => estimateFacadeBasePrice(r));
    const sumBase = sumFacadeBasePrices(rows);
    const pct = watchedOverrides?.[0];
    const fixed = watchedOverrides?.[1];
    const total = computeOrderTotal(
      sumBase,
      pct != null && Number.isFinite(pct) ? pct : null,
      fixed != null && Number.isFinite(fixed) ? fixed : null,
    );
    return { linePrices, sumBase, total };
  }, [watchedFacades, watchedOverrides]);

  const createMut = useMutation({
    mutationFn: orderCreate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      setCreateOpen(false);
      createForm.reset({
        customerId: "",
        deadlineAt: null,
        comment: "",
        overridePercent: null,
        overridePrice: null,
        facades: [defaultFacadeRow()],
      });
    },
  });

  const rows = orders.data?.orders.map((o) => (
    <Table.Tr key={o.id}>
      <Table.Td>
        <Text fw={600}>№{o.orderNumberFormatted}</Text>
      </Table.Td>
      <Table.Td>{o.customer.name}</Table.Td>
      <Table.Td>{o.currentStage.name}</Table.Td>
      <Table.Td>
        <Text size="sm">{o.facades.length ? `${o.facades.length} поз.` : "—"}</Text>
      </Table.Td>
      <Table.Td>{o.totalPrice != null ? money.format(o.totalPrice) : "—"}</Table.Td>
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
            const facadesPayload = v.facades.map((row, i) => ({
              sortIndex: i,
              milling: row.milling,
              coating: row.coating,
              color: row.color,
              dimensionsMm: row.dimensionsMm,
              thicknessMm: row.thicknessMm,
              integratedHandle: row.integratedHandle,
              edgeRadius: row.edgeRadius ?? null,
              optionsExtra: row.optionsExtra?.trim() ? row.optionsExtra : null,
              basePrice: estimateFacadeBasePrice({
                dimensionsMm: row.dimensionsMm,
                thicknessMm: row.thicknessMm,
                integratedHandle: row.integratedHandle,
                milling: row.milling,
                coating: row.coating,
                color: row.color,
                edgeRadius: row.edgeRadius,
                optionsExtra: row.optionsExtra,
              }),
            }));
            const sumBase = facadesPayload.reduce((s, f) => s + f.basePrice, 0);
            const totalPrice = computeOrderTotal(sumBase, v.overridePercent ?? null, v.overridePrice ?? null);
            createMut.mutate({
              customerId: v.customerId,
              deadlineAt: v.deadlineAt ? dayjs(v.deadlineAt).endOf("day").toISOString() : null,
              comment: v.comment?.trim() ? v.comment : null,
              overridePercent: v.overridePercent ?? null,
              overridePrice: v.overridePrice ?? null,
              totalPrice,
              facades: facadesPayload,
            });
          })}
        >
          <Stack gap="md">
            <Controller
              name="customerId"
              control={createForm.control}
              render={({ field, fieldState }) => (
                <Select
                  label="Заказчик"
                  placeholder="Выберите"
                  data={(customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={field.value || null}
                  onChange={(val) => field.onChange(val ?? "")}
                  error={fieldState.error?.message}
                  searchable
                />
              )}
            />

            <Group grow align="flex-start">
              <Controller
                name="deadlineAt"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="Дедлайн"
                    placeholder="Не задан"
                    value={field.value}
                    onChange={field.onChange}
                    clearable
                    locale="ru"
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Textarea
                label="Комментарий к заказу"
                minRows={2}
                autosize
                {...createForm.register("comment")}
              />
            </Group>

            <Divider label="Переопределение цены" labelPosition="center" />
            <Group grow>
              <Controller
                name="overridePercent"
                control={createForm.control}
                render={({ field }) => (
                  <NumberInput
                    label="Наценка / скидка, %"
                    description="К сумме позиций: итог = сумма × (1 + %/100) + фикс."
                    placeholder="0"
                    decimalScale={2}
                    value={field.value ?? undefined}
                    onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                    clearable
                  />
                )}
              />
              <Controller
                name="overridePrice"
                control={createForm.control}
                render={({ field }) => (
                  <NumberInput
                    label="Фикс. корректировка, ₽"
                    description="Добавляется после процента"
                    placeholder="0"
                    decimalScale={0}
                    thousandSeparator=" "
                    value={field.value ?? undefined}
                    onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                    clearable
                  />
                )}
              />
            </Group>

            <Divider label="Фасады (позиции)" labelPosition="center" />

            <Stack gap="sm">
              {fields.map((fItem, index) => (
                <Paper key={fItem.id} withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text fw={600} size="sm">
                      Позиция {index + 1}
                    </Text>
                    <Group gap="xs">
                      <Text size="sm" c="dimmed">
                        База:{" "}
                        <Text span fw={500} c="dark">
                          {money.format(pricing.linePrices[index] ?? 0)}
                        </Text>
                      </Text>
                      {fields.length > 1 ? (
                        <ActionIcon
                          type="button"
                          variant="subtle"
                          color="red"
                          aria-label="Удалить позицию"
                          onClick={() => remove(index)}
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      ) : null}
                    </Group>
                  </Group>

                  <Stack gap="sm">
                    <Group grow>
                      <TextInput label="Фрезеровка" {...createForm.register(`facades.${index}.milling`)} />
                      <TextInput label="Покрытие" {...createForm.register(`facades.${index}.coating`)} />
                      <TextInput label="Цвет" {...createForm.register(`facades.${index}.color`)} />
                    </Group>
                    <Group grow align="flex-start">
                      <TextInput
                        label="Размеры, мм"
                        description="Напр. 720×2400 или 800 х 2100"
                        {...createForm.register(`facades.${index}.dimensionsMm`)}
                        error={createForm.formState.errors.facades?.[index]?.dimensionsMm?.message}
                      />
                      <Controller
                        name={`facades.${index}.thicknessMm`}
                        control={createForm.control}
                        render={({ field, fieldState }) => (
                          <NumberInput
                            label="Толщина, мм"
                            min={1}
                            decimalScale={1}
                            value={field.value}
                            onChange={(n) => field.onChange(typeof n === "number" ? n : 16)}
                            error={fieldState.error?.message}
                          />
                        )}
                      />
                      <Controller
                        name={`facades.${index}.edgeRadius`}
                        control={createForm.control}
                        render={({ field }) => (
                          <NumberInput
                            label="Радиус завала, мм"
                            placeholder="—"
                            min={0}
                            decimalScale={1}
                            value={field.value ?? undefined}
                            onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                            clearable
                          />
                        )}
                      />
                    </Group>
                    <Textarea
                      label="Доп. опции"
                      minRows={1}
                      autosize
                      {...createForm.register(`facades.${index}.optionsExtra`)}
                    />
                    <Controller
                      name={`facades.${index}.integratedHandle`}
                      control={createForm.control}
                      render={({ field }) => (
                        <Switch
                          label="Интегрированная ручка"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.currentTarget.checked)}
                        />
                      )}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>

            <Button
              type="button"
              variant="light"
              leftSection={<IconPlus size={18} />}
              onClick={() => append(defaultFacadeRow())}
            >
              Добавить фасад
            </Button>

            <Paper withBorder p="md" bg="gray.0">
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">
                    Сумма базовых цен
                  </Text>
                  <Text fw={600}>{money.format(pricing.sumBase)}</Text>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Text size="sm" c="dimmed">
                    Итого к заказу
                  </Text>
                  <Text fw={700} size="lg">
                    {money.format(pricing.total)}
                  </Text>
                </div>
              </Group>
            </Paper>

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
          </Stack>
        </form>
      </Modal>
    </>
  );
}
