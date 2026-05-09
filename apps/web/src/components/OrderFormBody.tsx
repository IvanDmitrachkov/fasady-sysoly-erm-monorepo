import type { FieldArrayWithId, FieldErrors } from "react-hook-form";
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
import { defaultFacadeRow, formatDecimalRu, isNoHandleLabel, money } from "../lib/order-form";
import {
  calcFacadeAreaTotal,
  calcFacadeCount,
  calcFacadeCostTotal,
  calcMillingCostTotal,
  calcHandleCostTotal,
  calcSubtotal,
  calcTotalCost,
  calcBalance,
  rectangleAreaM2,
} from "../lib/facade-pricing";
import "./OrderFormBody.css";

type CatalogPriceRow = { name: string; pricePerM2: number };
type CatalogHandleRow = { name: string; pricePerMeter: number };
const EDGE_RADIUS_OPTIONS = ["0", "1", "2", "3", "6", "9"];

const ERROR_LABELS: Record<string, string> = {
  customerId: "Заказчик",
  deadlineAt: "Дедлайн",
  workType: "Вид работы",
  deliveryAddress: "Адрес доставки",
  comment: "Комментарий к заказу",
  facadePricePerM2: "Цена фасада, ₽/м²",
  millingPricePerM2: "Цена фрезеровки, ₽/м²",
  handleLengthTotalMm: "Длина ручки (общая), мм",
  handlePricePerMeter: "Цена ручки, ₽/м",
  otherServicesPrice: "Прочие услуги, ₽",
  discount: "Скидка, ₽",
  advance: "Аванс, ₽",
  millingLabel: "Фрезеровка",
  coatingTypeId: "Тип покрытия",
  handleLabel: "Интегрированная ручка",
  handleLengthMm: "Длина ручки, мм",
  color: "Цвет",
  widthMm: "Ширина, мм",
  heightMm: "Высота, мм",
  quantity: "Количество",
  thicknessMm: "Толщина, мм",
  edgeRadius: "Радиус завала, мм",
  optionsExtra: "Доп. опции",
};

function errorLabel(path: string[]): string {
  if (path[0] === "facades") {
    const index = Number(path[1]);
    const field = path[path.length - 1] ?? "";
    const label = ERROR_LABELS[field] ?? field;
    return Number.isInteger(index) ? `Позиция ${index + 1}: ${label}` : label;
  }
  const field = path[path.length - 1] ?? "";
  return ERROR_LABELS[field] ?? field;
}

function collectValidationMessages(errors: FieldErrors<CreateOrderFormValues>): string[] {
  const messages: string[] = [];

  function visit(value: unknown, path: string[]) {
    if (!value || typeof value !== "object") return;

    const maybeMessage = (value as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      messages.push(`${errorLabel(path)}: ${maybeMessage}`);
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index)]));
      return;
    }

    Object.entries(value).forEach(([key, nested]) => {
      if (key === "message" || key === "type" || key === "ref") return;
      visit(nested, [...path, key]);
    });
  }

  visit(errors, []);
  return [...new Set(messages)];
}

type OrderFormBodyProps = {
  form: UseFormReturn<CreateOrderFormValues>;
  fields: FieldArrayWithId<CreateOrderFormValues, "facades", "id">[];
  append: (v: CreateOrderFormValues["facades"][number]) => void;
  remove: (index: number) => void;
  customerOptions: { value: string; label: string; deliveryAddress: string | null }[];
  millingCatalog: CatalogPriceRow[];
  coatingOptions: { value: string; label: string }[];
  handleCatalog: CatalogHandleRow[];
  newRowDefaults: { millingLabel: string; coatingTypeId: string; handleLabel: string };
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
  const validationMessages = collectValidationMessages(form.formState.errors);

  const pricing = useMemo(() => {
    const area = calcFacadeAreaTotal(
      (watchedFacades ?? []).map((f) => ({ widthMm: f.widthMm, heightMm: f.heightMm, quantity: f.quantity })),
    );
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
                        onChange={(val) => {
                          field.onChange(val ?? "");
                          const customer = customerOptions.find((c) => c.value === val);
                          form.setValue("deliveryAddress", customer?.deliveryAddress ?? "");
                        }}
            error={fieldState.error?.message}
            searchable
          />
        )}
      />

      <Group align="flex-start" className="order-form-row">
        <div style={{ flex: 1 }}>
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
        </div>
        <TextInput
          label="Вид работы"
          placeholder="Например: фасады эмаль"
          style={{ flex: 3 }}
          {...form.register("workType")}
        />
      </Group>

      <Textarea
        label="Адрес доставки"
        minRows={2}
        autosize
        placeholder="Заполнится из карточки заказчика, можно изменить"
        {...form.register("deliveryAddress")}
      />

      <Textarea label="Комментарий к заказу" minRows={2} autosize {...form.register("comment")} />

      <Divider label="Фасады (позиции)" labelPosition="center" />

      <Paper withBorder p="md">
        <Group grow className="order-form-row">
          <div>
            <Text size="sm">Количество фасадов</Text>
            <Text fw={600}>{pricing.count} шт.</Text>
          </div>
          <div>
            <Text size="sm">Общая площадь</Text>
            <Text fw={600}>{formatDecimalRu.format(pricing.area)} м²</Text>
          </div>
        </Group>
      </Paper>

      <Stack gap="sm">
        {fields.map((fItem, index) => {
          const facade = watchedFacades?.[index];
          const positionArea = rectangleAreaM2(facade?.widthMm ?? 0, facade?.heightMm ?? 0) * (facade?.quantity ?? 1);
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

              <div className="facade-position-grid">
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
                  name={`facades.${index}.quantity`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <NumberInput
                      label="Количество"
                      min={1}
                      decimalScale={0}
                      thousandSeparator=" "
                      value={field.value}
                      onChange={(n) => field.onChange(typeof n === "number" ? n : 1)}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <NumberInput
                  label="Площадь, м²"
                  decimalScale={2}
                  thousandSeparator=" "
                  value={Math.round(positionArea * 100) / 100}
                  readOnly
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
                <Controller
                  name={`facades.${index}.millingLabel`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Autocomplete
                      label="Фрезеровка"
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
                  name={`facades.${index}.handleLabel`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Autocomplete
                      label="Интегрированная ручка"
                      placeholder="Выберите"
                      data={handleNames}
                      value={field.value ?? ""}
                      onChange={(v) => {
                        field.onChange(v);
                        form.setValue(`facades.${index}.handleLengthMm`, null, { shouldValidate: true });
                        if (isNoHandleLabel(v)) {
                          form.setValue("handleLengthTotalMm", null, { shouldValidate: true });
                          form.setValue("handlePricePerMeter", null, { shouldValidate: true });
                        }
                      }}
                      onOptionSubmit={(val) => {
                        field.onChange(val);
                        form.setValue(`facades.${index}.handleLengthMm`, null, { shouldValidate: true });
                        if (isNoHandleLabel(val)) {
                          form.setValue("handleLengthTotalMm", null, { shouldValidate: true });
                          form.setValue("handlePricePerMeter", null, { shouldValidate: true });
                        } else {
                          const row = handleCatalog.find((t) => t.name === val);
                          if (row) form.setValue("handlePricePerMeter", row.pricePerMeter, { shouldValidate: true });
                        }
                      }}
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
                  render={({ field, fieldState }) => (
                    <Autocomplete
                      label="Радиус завала торца, мм"
                      placeholder="Выберите или введите"
                      data={EDGE_RADIUS_OPTIONS}
                      value={field.value == null ? "" : String(field.value)}
                      onChange={(value) => {
                        const normalized = value.replace(",", ".").trim();
                        const parsed = Number(normalized);
                        field.onChange(normalized && Number.isFinite(parsed) ? parsed : undefined);
                      }}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Textarea
                  className="facade-position-field--wide"
                  label="Доп. опции"
                  minRows={1}
                  autosize
                  {...form.register(`facades.${index}.optionsExtra`)}
                />
              </div>
            </Paper>
          );
        })}
      </Stack>

      <Button
        type="button"
        variant="light"
        leftSection={<IconPlus size={18} />}
        onClick={() => {
          const facades = form.getValues("facades");
          const previous = facades.at(-1);
          append(previous ? { ...previous } : defaultFacadeRow(newRowDefaults));
        }}
      >
        Добавить фасад
      </Button>

      <Divider label="Расчет стоимости" labelPosition="center" />

      <Paper withBorder p="md" radius="md">
        <div className="order-pricing-grid">
          <Controller
            name="facadePricePerM2"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="Цена фасада, ₽/м²"
                placeholder="0"
                decimalScale={0}
                thousandSeparator=" "
                value={field.value ?? undefined}
                onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                error={fieldState.error?.message}
              />
            )}
          />
          <div className="order-pricing-summary">
            <Text size="sm">Стоимость фасадов</Text>
            <Text fw={600}>{money.format(pricing.facadeCostTotal)}</Text>
          </div>

          <NumberInput
            label="Площадь фрезеровки, м²"
            decimalScale={2}
            thousandSeparator=" "
            value={pricing.area}
            readOnly
          />
          <Controller
            name="millingPricePerM2"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="Цена фрезеровки, ₽/м²"
                placeholder="0"
                decimalScale={0}
                thousandSeparator=" "
                value={field.value ?? undefined}
                onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                error={fieldState.error?.message}
              />
            )}
          />
          <NumberInput
            label="Стоимость фрезеровки, ₽"
            decimalScale={0}
            thousandSeparator=" "
            value={pricing.millingCostTotal}
            readOnly
          />

          <Controller
            name="handleLengthTotalMm"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="Длина ручки (общая), мм"
                placeholder="0"
                decimalScale={0}
                thousandSeparator=" "
                value={field.value ?? undefined}
                onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="handlePricePerMeter"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="Цена ручки, ₽/м"
                placeholder="0"
                decimalScale={0}
                thousandSeparator=" "
                value={field.value ?? undefined}
                onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                error={fieldState.error?.message}
              />
            )}
          />
          <NumberInput
            label="Стоимость ручек, ₽"
            decimalScale={0}
            thousandSeparator=" "
            value={pricing.handleCostTotal}
            readOnly
          />

          <Controller
            name="otherServicesPrice"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="Прочие услуги, ₽"
                placeholder="0"
                decimalScale={0}
                thousandSeparator=" "
                value={field.value ?? undefined}
                onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                error={fieldState.error?.message}
              />
            )}
          />

          <Divider className="order-pricing-divider" />

          <div className="order-pricing-summary">
            <Text size="sm">Итого</Text>
            <Text fw={600}>{money.format(pricing.subtotal)}</Text>
          </div>
          <Controller
            name="discount"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="Скидка, ₽"
                placeholder="0"
                decimalScale={0}
                thousandSeparator=" "
                value={field.value ?? undefined}
                onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                error={fieldState.error?.message}
              />
            )}
          />
          <div className="order-pricing-summary order-pricing-summary--total">
            <Text size="sm">Общая стоимость</Text>
            <Text fw={700} size="lg">
              {money.format(pricing.totalCost)}
            </Text>
          </div>
          <Controller
            name="advance"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="Аванс, ₽"
                placeholder="0"
                decimalScale={0}
                thousandSeparator=" "
                value={field.value ?? undefined}
                onChange={(n) => field.onChange(typeof n === "number" ? n : null)}
                error={fieldState.error?.message}
              />
            )}
          />
          <div className="order-pricing-summary">
            <Text size="sm">Остаток</Text>
            <Text fw={600}>{money.format(pricing.balance)}</Text>
          </div>
        </div>
      </Paper>

      {validationMessages.length > 0 ? (
        <Paper withBorder p="sm" radius="md" bg="red.0" style={{ borderColor: "var(--mantine-color-red-4)" }}>
          <Stack gap={4}>
            <Text c="red" fw={600} size="sm">
              Не удалось сохранить. Проверьте поля:
            </Text>
            {validationMessages.map((message) => (
              <Text key={message} c="red" size="sm">
                {message}
              </Text>
            ))}
          </Stack>
        </Paper>
      ) : null}

      {actions}
    </Stack>
  );
}
