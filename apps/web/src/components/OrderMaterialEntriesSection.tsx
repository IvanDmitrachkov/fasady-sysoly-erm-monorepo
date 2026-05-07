import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Divider, Group, Modal, NumberInput, Paper, Select, Stack, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { z } from "zod";
import dayjs from "dayjs";
import { materialEntriesList, materialEntryCreate, materialEntryUpdate, type MaterialEntryDto } from "../api/material-entries";
import { stagesList } from "../api/stages";
import { userDisplayName } from "../lib/user-display-name";

const formSchema = z.object({
  stageId: z.string().optional(),
  name: z.string().trim().min(1, "Укажите материал"),
  unit: z.string().trim().min(1, "Укажите ед. изм."),
  quantity: z.number().positive("Количество должно быть больше 0"),
  usedAt: z.date({ message: "Укажите дату/время" }),
  comment: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

type Props = { orderId: string; canEdit: boolean };

export function OrderMaterialEntriesSection({ orderId, canEdit }: Props) {
  const qc = useQueryClient();
  const materials = useQuery({
    queryKey: ["materialEntries", orderId],
    queryFn: () => materialEntriesList(orderId),
    enabled: !!orderId,
  });
  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList, enabled: canEdit });
  const stageOptions = useMemo(
    () => [{ value: "", label: "Без этапа" }, ...(stages.data?.stages ?? []).map((s) => ({ value: s.id, label: s.name }))],
    [stages.data],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { stageId: "", name: "", unit: "шт", quantity: 1, usedAt: new Date(), comment: "" },
  });
  const createMut = useMutation({
    mutationFn: (body: Parameters<typeof materialEntryCreate>[1]) => materialEntryCreate(orderId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["materialEntries", orderId] });
      form.reset({ stageId: "", name: "", unit: "шт", quantity: 1, usedAt: new Date(), comment: "" });
    },
  });

  const [editing, setEditing] = useState<MaterialEntryDto | null>(null);
  const editForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { stageId: "", name: "", unit: "шт", quantity: 1, usedAt: new Date(), comment: "" },
  });
  useEffect(() => {
    if (!editing) return;
    editForm.reset({
      stageId: editing.stage?.id ?? "",
      name: editing.name,
      unit: editing.unit,
      quantity: editing.quantity,
      usedAt: new Date(editing.usedAt),
      comment: editing.comment ?? "",
    });
  }, [editing, editForm]);
  const updateMut = useMutation({
    mutationFn: (body: { id: string; values: FormValues }) =>
      materialEntryUpdate(body.id, {
        stageId: body.values.stageId?.trim() ? body.values.stageId : null,
        name: body.values.name.trim(),
        unit: body.values.unit.trim(),
        quantity: body.values.quantity,
        usedAt: body.values.usedAt.toISOString(),
        comment: body.values.comment?.trim() ? body.values.comment : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["materialEntries", orderId] });
      setEditing(null);
    },
  });

  return (
    <Paper withBorder p="md" radius="md" mt="xl">
      <Title order={4} mb="sm">
        Материалы
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Список списаний материалов по заказу.
      </Text>

      {materials.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {materials.isError ? (
        <Text c="red" size="sm">
          {materials.error instanceof Error ? materials.error.message : "Ошибка"}
        </Text>
      ) : null}

      {materials.data ? (
        <Table striped withTableBorder mb="lg">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Дата</Table.Th>
              <Table.Th>Этап</Table.Th>
              <Table.Th>Материал</Table.Th>
              <Table.Th>Кол-во</Table.Th>
              <Table.Th>Кто</Table.Th>
              <Table.Th>Комментарий</Table.Th>
              {canEdit ? <Table.Th style={{ width: 140 }} /> : null}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {materials.data.entries.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={canEdit ? 7 : 6}>
                  <Text size="sm" c="dimmed">
                    Записей пока нет
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              materials.data.entries.map((m) => (
                <Table.Tr key={m.id}>
                  <Table.Td>{dayjs(m.usedAt).format("DD.MM.YYYY HH:mm")}</Table.Td>
                  <Table.Td>{m.stage?.name ?? "—"}</Table.Td>
                  <Table.Td>{m.name}</Table.Td>
                  <Table.Td>
                    {m.quantity} {m.unit}
                  </Table.Td>
                  <Table.Td>{userDisplayName(m.user)}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2}>
                      {m.comment?.trim() ? m.comment : "—"}
                    </Text>
                  </Table.Td>
                  {canEdit ? (
                    <Table.Td>
                      <Button size="xs" variant="light" onClick={() => setEditing(m)}>
                        Редактировать
                      </Button>
                    </Table.Td>
                  ) : null}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      ) : null}

      {canEdit ? (
        <>
          <Divider label="Новая запись" labelPosition="left" mb="md" />
          <form
            onSubmit={form.handleSubmit((v) =>
              createMut.mutate({
                stageId: v.stageId?.trim() ? v.stageId : null,
                name: v.name.trim(),
                unit: v.unit.trim(),
                quantity: v.quantity,
                usedAt: v.usedAt.toISOString(),
                comment: v.comment?.trim() ? v.comment : null,
              }),
            )}
          >
            <Stack gap="sm">
              <Controller
                name="stageId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Select
                    label="Этап"
                    data={stageOptions}
                    value={field.value || ""}
                    onChange={(val) => field.onChange(val ?? "")}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <TextInput label="Материал" {...form.register("name")} />
              <Group grow>
                <TextInput label="Ед. изм." {...form.register("unit")} />
                <Controller
                  name="quantity"
                  control={form.control}
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
                control={form.control}
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
              <Textarea label="Комментарий" minRows={2} {...form.register("comment")} />
              {createMut.isError ? (
                <Text c="red" size="sm">
                  {createMut.error instanceof Error ? createMut.error.message : "Ошибка"}
                </Text>
              ) : null}
              <Group justify="flex-end">
                <Button type="submit" loading={createMut.isPending}>
                  Добавить материал
                </Button>
              </Group>
            </Stack>
          </form>
        </>
      ) : null}

      <Modal opened={!!editing} onClose={() => setEditing(null)} title="Редактировать материал" size="md">
        <form
          onSubmit={editForm.handleSubmit((values) => {
            if (!editing) return;
            updateMut.mutate({ id: editing.id, values });
          })}
        >
          <Stack gap="sm">
            <Controller
              name="stageId"
              control={editForm.control}
              render={({ field, fieldState }) => (
                <Select
                  label="Этап"
                  data={stageOptions}
                  value={field.value || ""}
                  onChange={(val) => field.onChange(val ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <TextInput label="Материал" {...editForm.register("name")} />
            <Group grow>
              <TextInput label="Ед. изм." {...editForm.register("unit")} />
              <Controller
                name="quantity"
                control={editForm.control}
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
              control={editForm.control}
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
            <Textarea label="Комментарий" minRows={2} {...editForm.register("comment")} />
            {updateMut.isError ? (
              <Text c="red" size="sm">
                {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button variant="default" type="button" onClick={() => setEditing(null)}>
                Отмена
              </Button>
              <Button type="submit" loading={updateMut.isPending}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Paper>
  );
}
