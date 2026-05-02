import type { FieldArrayWithId } from "react-hook-form";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  ActionIcon,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useMemo } from "react";
import type { CreateOrderFormValues, FacadeCatalogLookup } from "../lib/order-form";
import { defaultFacadeRow, facadeRowToPricingInput, money } from "../lib/order-form";
import { computeOrderTotal, estimateFacadeBasePrice, sumFacadeBasePrices } from "../lib/facade-pricing";

const HANDLE_NONE = "__none__";

type OrderFormBodyProps = {
  form: UseFormReturn<CreateOrderFormValues>;
  fields: FieldArrayWithId<CreateOrderFormValues, "facades", "id">[];
  append: (v: CreateOrderFormValues["facades"][number]) => void;
  remove: (index: number) => void;
  customerOptions: { value: string; label: string }[];
  catalog: FacadeCatalogLookup;
  millingOptions: { value: string; label: string }[];
  coatingOptions: { value: string; label: string }[];
  handleOptions: { value: string; label: string }[];
  newRowDefaults: { millingTypeId: string; coatingTypeId: string };
  actions: React.ReactNode;
};

export function OrderFormBody({
  form,
  fields,
  append,
  remove,
  customerOptions,
  catalog,
  millingOptions,
  coatingOptions,
  handleOptions,
  newRowDefaults,
  actions,
}: OrderFormBodyProps) {
  const watchedFacades = useWatch({ control: form.control, name: "facades" });
  const watchedOverrides = useWatch({
    control: form.control,
    name: ["overridePercent", "overridePrice"],
  });

  const handleSelectData = useMemo(
    () => [{ value: HANDLE_NONE, label: "Нет" }, ...handleOptions],
    [handleOptions],
  );

  const pricing = useMemo(() => {
    const empty = defaultFacadeRow(newRowDefaults);
    const rows = (watchedFacades ?? []).map((row) =>
      row ? facadeRowToPricingInput(row, catalog) : facadeRowToPricingInput(empty, catalog),
    );
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
  }, [watchedFacades, watchedOverrides, catalog, newRowDefaults]);

  return (
    <Stack gap="md">
      <Controller
        name="customerId"
        control={form.control}
        render={({ field, fieldState }) => (
          <Select
            label="Заказчик"
            placeholder="Выберите"
            data={customerOptions}
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
          control={form.control}
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
        <Textarea label="Комментарий к заказу" minRows={2} autosize {...form.register("comment")} />
      </Group>

      <Divider label="Переопределение цены" labelPosition="center" />
      <Group grow>
        <Controller
          name="overridePercent"
          control={form.control}
          render={({ field }) => (
            <NumberInput
              label="Наценка / скидка, %"
              description="Итог = сумма × (1 + %/100) + фикс."
              placeholder="0"
              decimalScale={2}
              value={field.value ?? undefined}
              onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
            />
          )}
        />
        <Controller
          name="overridePrice"
          control={form.control}
          render={({ field }) => (
            <NumberInput
              label="Фикс. корректировка, ₽"
              description="После процента"
              placeholder="0"
              decimalScale={0}
              thousandSeparator=" "
              value={field.value ?? undefined}
              onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
            />
          )}
        />
      </Group>

      <Divider label="Фасады (позиции)" labelPosition="center" />

      <Stack gap="sm">
        {fields.map((fItem, index) => {
          const handleId = watchedFacades?.[index]?.handleTypeId ?? null;
          return (
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
                <Group grow align="flex-start">
                  <Controller
                    name={`facades.${index}.millingTypeId`}
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Select
                        label="Тип фрезеровки"
                        placeholder="Выберите"
                        data={millingOptions}
                        value={field.value || null}
                        onChange={(v) => field.onChange(v ?? "")}
                        error={fieldState.error?.message}
                        searchable
                      />
                    )}
                  />
                  <Controller
                    name={`facades.${index}.coatingTypeId`}
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Select
                        label="Тип покрытия"
                        placeholder="Выберите"
                        data={coatingOptions}
                        value={field.value || null}
                        onChange={(v) => field.onChange(v ?? "")}
                        error={fieldState.error?.message}
                        searchable
                      />
                    )}
                  />
                  <TextInput label="Цвет" {...form.register(`facades.${index}.color`)} />
                </Group>
                <Group grow align="flex-start">
                  <Controller
                    name={`facades.${index}.widthMm`}
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="Ширина, мм"
                        min={1}
                        decimalScale={0}
                        thousandSeparator=" "
                        value={field.value}
                        onChange={(n) => field.onChange(typeof n === "number" ? n : undefined)}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name={`facades.${index}.heightMm`}
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="Высота, мм"
                        min={1}
                        decimalScale={0}
                        thousandSeparator=" "
                        value={field.value}
                        onChange={(n) => field.onChange(typeof n === "number" ? n : undefined)}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name={`facades.${index}.thicknessMm`}
                    control={form.control}
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
                    control={form.control}
                    render={({ field }) => (
                      <NumberInput
                        label="Радиус завала, мм"
                        placeholder="—"
                        min={0}
                        decimalScale={1}
                      value={field.value ?? undefined}
                      onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                    />
                  )}
                />
              </Group>
              <Textarea
                label="Доп. опции"
                  minRows={1}
                  autosize
                  {...form.register(`facades.${index}.optionsExtra`)}
                />
                <Group grow align="flex-start">
                  <Controller
                    name={`facades.${index}.handleTypeId`}
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Select
                        label="Интегрированная ручка"
                        description="Цена за п.м. задаётся в справочнике"
                        data={handleSelectData}
                        value={field.value ?? HANDLE_NONE}
                        onChange={(v) => {
                          const next = v === HANDLE_NONE || !v ? null : v;
                          field.onChange(next);
                          if (!next) {
                            form.setValue(`facades.${index}.handleLengthMm`, null, { shouldValidate: true });
                          }
                        }}
                        error={fieldState.error?.message}
                        searchable
                      />
                    )}
                  />
                  {handleId ? (
                    <Controller
                      name={`facades.${index}.handleLengthMm`}
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <NumberInput
                          label="Длина ручки, мм"
                          min={1}
                          decimalScale={0}
                          thousandSeparator=" "
                          value={field.value ?? undefined}
                          onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                  ) : null}
                </Group>
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      <Button
        type="button"
        variant="light"
        leftSection={<IconPlus size={18} />}
        onClick={() => append(defaultFacadeRow(newRowDefaults))}
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

      {actions}
    </Stack>
  );
}
