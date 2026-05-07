import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Modal, NumberInput, Select, Stack, Tabs, Text, TextInput, Textarea } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { z } from "zod";
import { stagesList } from "../api/stages";
import { timeEntryCreate } from "../api/time-entries";
import { materialEntryCreate } from "../api/material-entries";
import type { OrderDto } from "../api/orders";

const timeSchema = z
  .object({
    stageId: z.string().min(1, "Выберите этап"),
    startedAt: z.date({ message: "Укажите начало" }),
    endedAt: z.date({ message: "Укажите окончание" }),
    comment: z.string().optional(),
  })
  .refine((v) => v.endedAt > v.startedAt, { message: "Окончание должно быть позже начала", path: ["endedAt"] });

const materialSchema = z.object({
  stageId: z.string().optional(),
  name: z.string().trim().min(1, "Укажите материал"),
  kind: z.string().optional(),
  unit: z.string().trim().min(1, "Укажите ед. изм."),
  quantity: z.number().positive("Количество должно быть больше 0"),
  usedAt: z.date({ message: "Укажите дату/время" }),
  comment: z.string().optional(),
});

type TimeValues = z.infer<typeof timeSchema>;
type MaterialValues = z.infer<typeof materialSchema>;

type Props = {
  order: Pick<OrderDto, "id" | "orderNumberFormatted"> | null;
  opened: boolean;
  onClose: () => void;
};

const STATION_STAGE_LS_KEY = "erm_station_board_stage_id";
const MATERIAL_OPTIONS = [
  "Круги",
  "Полосы",
  "Губки",
  "Ситечко",
  "Грунт первичный гр.",
  "Грунт вторичный гр.",
  "Краска гр.",
  "Лак, гр.",
  "Прочее",
].map((x) => ({ value: x, label: x }));
const UNIT_OPTIONS = ["шт", "гр.", "кг", "л", "м", "м²", "мл"].map((x) => ({ value: x, label: x }));

export function OrderQuickAddModal({ order, opened, onClose }: Props) {
  const qc = useQueryClient();
  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList, enabled: opened });
  const stageOptions = useMemo(() => (stages.data?.stages ?? []).map((s) => ({ value: s.id, label: s.name })), [stages.data]);
  const stageOptionsWithEmpty = useMemo(
    () => [{ value: "", label: "Без этапа" }, ...stageOptions],
    [stageOptions],
  );

  const timeForm = useForm<TimeValues>({
    resolver: zodResolver(timeSchema),
    defaultValues: { stageId: "", startedAt: new Date(), endedAt: new Date(Date.now() + 60 * 60 * 1000), comment: "" },
  });
  const materialForm = useForm<MaterialValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: { stageId: "", name: "", kind: "", unit: "шт", quantity: 1, usedAt: new Date(), comment: "" },
  });

  const timeMut = useMutation({
    mutationFn: (v: TimeValues) =>
      timeEntryCreate(order!.id, {
        stageId: v.stageId,
        startedAt: v.startedAt.toISOString(),
        endedAt: v.endedAt.toISOString(),
        comment: v.comment?.trim() ? v.comment : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timeEntries", order?.id] });
      void qc.invalidateQueries({ queryKey: ["timeEntriesReport"] });
      onClose();
    },
  });

  const materialMut = useMutation({
    mutationFn: (v: MaterialValues) =>
      materialEntryCreate(order!.id, {
        stageId: v.stageId?.trim() ? v.stageId : null,
        name: v.name.trim(),
        kind: v.kind?.trim() ? v.kind : null,
        unit: v.unit.trim(),
        quantity: v.quantity,
        usedAt: v.usedAt.toISOString(),
        comment: v.comment?.trim() ? v.comment : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["materialEntries", order?.id] });
      onClose();
    },
  });

  useEffect(() => {
    if (!opened || stageOptions.length === 0) return;
    let lsStageId: string | null = null;
    try {
      lsStageId = localStorage.getItem(STATION_STAGE_LS_KEY);
    } catch {
      lsStageId = null;
    }
    const canUseLsStage = !!lsStageId && stageOptions.some((s) => s.value === lsStageId);
    const stageId = canUseLsStage ? lsStageId! : stageOptions[0]!.value;
    if (!timeForm.getValues("stageId")) {
      timeForm.setValue("stageId", stageId, { shouldValidate: true });
    }
    if (!materialForm.getValues("stageId")) {
      materialForm.setValue("stageId", stageId);
    }
  }, [opened, stageOptions, timeForm, materialForm]);

  return (
    <Modal opened={opened} onClose={onClose} title={order ? `Добавить в заказ №${order.orderNumberFormatted}` : "Добавить"} size="lg">
      {order ? (
        <Tabs defaultValue="time">
          <Tabs.List>
            <Tabs.Tab value="time">Трудозатрата</Tabs.Tab>
            <Tabs.Tab value="material">Материал</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="time" pt="md">
            <form onSubmit={timeForm.handleSubmit((v) => timeMut.mutate(v))}>
              <Stack gap="sm">
                <Controller
                  name="stageId"
                  control={timeForm.control}
                  render={({ field, fieldState }) => (
                    <Select
                      label="Этап"
                      data={stageOptions}
                      value={field.value || null}
                      onChange={(val) => field.onChange(val ?? "")}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  name="startedAt"
                  control={timeForm.control}
                  render={({ field, fieldState }) => (
                    <DateTimePicker
                      label="Начал"
                      value={field.value}
                      onChange={(d) => field.onChange(d ?? new Date())}
                      valueFormat="DD.MM.YYYY HH:mm"
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  name="endedAt"
                  control={timeForm.control}
                  render={({ field, fieldState }) => (
                    <DateTimePicker
                      label="Закончил"
                      value={field.value}
                      onChange={(d) => field.onChange(d ?? new Date())}
                      valueFormat="DD.MM.YYYY HH:mm"
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Textarea label="Комментарий" minRows={2} {...timeForm.register("comment")} />
                {timeMut.isError ? (
                  <Text c="red" size="sm">
                    {timeMut.error instanceof Error ? timeMut.error.message : "Ошибка"}
                  </Text>
                ) : null}
                <Group justify="flex-end">
                  <Button variant="default" type="button" onClick={onClose}>
                    Отмена
                  </Button>
                  <Button type="submit" loading={timeMut.isPending}>
                    Добавить
                  </Button>
                </Group>
              </Stack>
            </form>
          </Tabs.Panel>

          <Tabs.Panel value="material" pt="md">
            <form onSubmit={materialForm.handleSubmit((v) => materialMut.mutate(v))}>
              <Stack gap="sm">
                <Controller
                  name="stageId"
                  control={materialForm.control}
                  render={({ field, fieldState }) => (
                    <Select
                      label="Этап"
                      data={stageOptionsWithEmpty}
                      value={field.value || ""}
                      onChange={(val) => field.onChange(val ?? "")}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  name="name"
                  control={materialForm.control}
                  render={({ field, fieldState }) => (
                    <Select
                      label="Материал"
                      data={MATERIAL_OPTIONS}
                      value={field.value || null}
                      onChange={(val) => field.onChange(val ?? "")}
                      error={fieldState.error?.message}
                      searchable
                    />
                  )}
                />
                <TextInput label="Вид" placeholder="Свободный текст" {...materialForm.register("kind")} />
                <Group grow>
                  <Controller
                    name="unit"
                    control={materialForm.control}
                    render={({ field, fieldState }) => (
                      <Select
                        label="Ед. изм."
                        data={UNIT_OPTIONS}
                        value={field.value || null}
                        onChange={(val) => field.onChange(val ?? "")}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name="quantity"
                    control={materialForm.control}
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="Количество"
                        value={field.value}
                        onChange={(n) => field.onChange(typeof n === "number" ? n : 1)}
                        min={0.001}
                        decimalScale={3}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Group>
                <Controller
                  name="usedAt"
                  control={materialForm.control}
                  render={({ field, fieldState }) => (
                    <DateTimePicker
                      label="Дата/время расхода"
                      value={field.value}
                      onChange={(d) => field.onChange(d ?? new Date())}
                      valueFormat="DD.MM.YYYY HH:mm"
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Textarea label="Комментарий" minRows={2} {...materialForm.register("comment")} />
                {materialMut.isError ? (
                  <Text c="red" size="sm">
                    {materialMut.error instanceof Error ? materialMut.error.message : "Ошибка"}
                  </Text>
                ) : null}
                <Group justify="flex-end">
                  <Button variant="default" type="button" onClick={onClose}>
                    Отмена
                  </Button>
                  <Button type="submit" loading={materialMut.isPending}>
                    Добавить
                  </Button>
                </Group>
              </Stack>
            </form>
          </Tabs.Panel>
        </Tabs>
      ) : null}
    </Modal>
  );
}
