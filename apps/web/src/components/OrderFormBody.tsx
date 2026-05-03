import type { FieldArrayWithId } from "react-hook-form";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  ActionIcon,
  Autocomplete,
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
import type { CreateOrderFormValues } from "../lib/order-form";
import { defaultFacadeRow, money } from "../lib/order-form";
import {
  calcFacadeAreaTotal,
  calcFacadeCount,
  calcFacadeCostTotal,
  calcMillingCostTotal,
  calcHandleCostTotal,
  calcSubtotal,
  calcTotalCost,
  calcBalance,
} from "../lib/facade-pricing";

type CatalogPriceRow = { name: string; pricePerM2: number };
type CatalogHandleRow = { name: string; pricePerMeter: number };

type OrderFormBodyProps = {
  form: UseFormReturn<CreateOrderFormValues>;
  fields: FieldArrayWithId<CreateOrderFormValues, "facades", "id">[];
  append: (v: CreateOrderFormValues["facades"][number]) => void;
  remove: (index: number) => void;
  customerOptions: { value: string; label: string }[];
  millingCatalog: CatalogPriceRow[];
  coatingOptions: { value: string; label: string }[];
  handleCatalog: CatalogHandleRow[];
  newRowDefaults: { millingLabel: string; coatingTypeId: string };
  actions: React.ReactNode;
};

export function OrderFormBody({
  form,
  fields,
  append,
  remove,
  customerOptions,
  millingCatalog,
  coatingOptions,
  handleCatalog,
  newRowDefaults,
  actions,
}: OrderFormBodyProps) {
  const watchedFacades = useWatch({ control: form.control, name: "facades" });
  const watchedPrices = useWatch({
    control: form.control,
    name: [
      "facadePricePerM2",
      "millingPricePerM2",
      "handleLengthTotalMm",
      "handlePricePerMeter",
      "otherServicesPrice",
      "discount",
      "advance",
    ],
  });

  const millingNames = useMemo(() => millingCatalog.map((t) => t.name), [millingCatalog]);
  const handleNames = useMemo(() => handleCatalog.map((t) => t.name), [handleCatalog]);

  const pricing = useMemo(() => {
    const area = calcFacadeAreaTotal((watchedFacades ?? []).map(f => ({ widthMm: f.widthMm, heightMm: f.heightMm })));
    const count = calcFacadeCount(watchedFacades ?? []);
    const facadePricePerM2 = watchedPrices?.[0];
    const millingPricePerM2 = watchedPrices?.[1];
    const handleLengthTotalMm = watchedPrices?.[2];
    const handlePricePerMeter = watchedPrices?.[3];
    const otherServicesPrice = watchedPrices?.[4];
    const discount = watchedPrices?.[5];
    const advance = watchedPrices?.[6];

    const facadeCostTotal = calcFacadeCostTotal(area, facadePricePerM2);
    const millingCostTotal = calcMillingCostTotal(area, millingPricePerM2);
    const handleCostTotal = calcHandleCostTotal(handleLengthTotalMm, handlePricePerMeter);
    const subtotal = calcSubtotal({
      facadeCostTotal,
      millingCostTotal,
      handleCostTotal,
      otherServicesPrice,
    });
    const totalCost = calcTotalCost(subtotal, discount);
    const balance = calcBalance(totalCost, advance);

    return {
      area: Math.round(area * 100) / 100,
      count,
      facadeCostTotal,
      millingCostTotal,
      handleCostTotal,
      subtotal,
      totalCost,
      balance,
    };
  }, [watchedFacades, watchedPrices]);

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

      <Divider label="Фасады (позиции)" labelPosition="center" />

      <Paper withBorder p="md" bg="gray.0">
        <Group grow>
          <div>
            <Text size="sm" c="dimmed">Количество фасадов</Text>
            <Text fw={600}>{pricing.count} шт.</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Общая площадь</Text>
            <Text fw={600}>{pricing.area} м²</Text>
          </div>
        </Group>
      </Paper>

      <Stack gap="sm">
        {fields.map((fItem, index) => {
          const handleHas = !!(watchedFacades?.[index]?.handleLabel ?? "").trim();
          return (
            <Paper key={fItem.id} withBorder p="md" radius="md">
              <Group justify="space-between" mb="xs">
                <Text fw={600} size="sm">
                  Позиция {index + 1}
                </Text>
                <Group gap="xs">
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
                    name={`facades.${index}.millingLabel`}
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Autocomplete
                        label="Фрезеровка"
                        description="Подсказки из справочника или свой текст"
                        placeholder="Начните ввод или выберите"
                        data={millingNames}
                        value={field.value}
                        onChange={(v) => field.onChange(v)}
                        onOptionSubmit={(val) => {
                          field.onChange(val);
                          const row = millingCatalog.find((t) => t.name === val);
                          if (row) form.setValue("millingPricePerM2", row.pricePerM2);
                        }}
                        error={fieldState.error?.message}
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
                    name={`facades.${index}.handleLabel`}
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Autocomplete
                        label="Интегрированная ручка"
                        description="Подсказки из справочника или свой текст; оставьте пустым, если нет"
                        placeholder="Нет"
                        data={handleNames}
                        value={field.value ?? ""}
                        onChange={(v) => {
                          field.onChange(v);
                          if (!(v ?? "").trim()) {
                            form.setValue(`facades.${index}.handleLengthMm`, null, { shouldValidate: true });
                          }
                        }}
                        onOptionSubmit={(val) => {
                          field.onChange(val);
                          const row = handleCatalog.find((t) => t.name === val);
                          if (row) form.setValue("handlePricePerMeter", row.pricePerMeter);
                        }}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  {handleHas ? (
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

      <Divider label="Расчет стоимости" labelPosition="center" />

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group grow>
            <Controller
              name="facadePricePerM2"
              control={form.control}
              render={({ field }) => (
                <NumberInput
                  label="Цена фасада, ₽/м²"
                  description="Начальное значение из таблицы"
                  placeholder="0"
                  decimalScale={0}
                  thousandSeparator=" "
                  value={field.value ?? undefined}
                  onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                />
              )}
            />
            <div>
              <Text size="sm" c="dimmed">Стоимость фасадов</Text>
              <Text fw={600}>{money.format(pricing.facadeCostTotal)}</Text>
            </div>
          </Group>

          <Group grow>
            <Controller
              name="millingPricePerM2"
              control={form.control}
              render={({ field }) => (
                <NumberInput
                  label="Цена фрезеровки, ₽/м²"
                  description="Отдельная цена за фрезеровку"
                  placeholder="0"
                  decimalScale={0}
                  thousandSeparator=" "
                  value={field.value ?? undefined}
                  onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                />
              )}
            />
            <div>
              <Text size="sm" c="dimmed">Стоимость фрезеровки</Text>
              <Text fw={600}>{money.format(pricing.millingCostTotal)}</Text>
            </div>
          </Group>

          <Group grow>
            <Controller
              name="handleLengthTotalMm"
              control={form.control}
              render={({ field }) => (
                <NumberInput
                  label="Длина ручки (общая), мм"
                  description="Суммарно по всем фасадам"
                  placeholder="0"
                  decimalScale={0}
                  thousandSeparator=" "
                  value={field.value ?? undefined}
                  onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                />
              )}
            />
            <Controller
              name="handlePricePerMeter"
              control={form.control}
              render={({ field }) => (
                <NumberInput
                  label="Цена ручки, ₽/м"
                  placeholder="0"
                  decimalScale={0}
                  thousandSeparator=" "
                  value={field.value ?? undefined}
                  onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                />
              )}
            />
            <div>
              <Text size="sm" c="dimmed">Стоимость ручек</Text>
              <Text fw={600}>{money.format(pricing.handleCostTotal)}</Text>
            </div>
          </Group>

          <Group grow>
            <Controller
              name="otherServicesPrice"
              control={form.control}
              render={({ field }) => (
                <NumberInput
                  label="Прочие услуги, ₽"
                  placeholder="0"
                  decimalScale={0}
                  thousandSeparator=" "
                  value={field.value ?? undefined}
                  onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                />
              )}
            />
          </Group>

          <Divider />

          <Group grow>
            <div>
              <Text size="sm" c="dimmed">Итого</Text>
              <Text fw={600}>{money.format(pricing.subtotal)}</Text>
            </div>
            <Controller
              name="discount"
              control={form.control}
              render={({ field }) => (
                <NumberInput
                  label="Скидка, ₽"
                  placeholder="0"
                  decimalScale={0}
                  thousandSeparator=" "
                  value={field.value ?? undefined}
                  onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                />
              )}
            />
            <div>
              <Text size="sm" c="dimmed">Общая стоимость</Text>
              <Text fw={700} size="lg">{money.format(pricing.totalCost)}</Text>
            </div>
          </Group>

          <Group grow>
            <Controller
              name="advance"
              control={form.control}
              render={({ field }) => (
                <NumberInput
                  label="Аванс, ₽"
                  placeholder="0"
                  decimalScale={0}
                  thousandSeparator=" "
                  value={field.value ?? undefined}
                  onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                />
              )}
            />
            <div>
              <Text size="sm" c="dimmed">Остаток</Text>
              <Text fw={600}>{money.format(pricing.balance)}</Text>
            </div>
          </Group>
        </Stack>
      </Paper>

      {actions}
    </Stack>
  );
}
