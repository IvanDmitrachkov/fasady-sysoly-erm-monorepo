import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Divider, Group, Modal, Paper, Select, Stack, Table, Text, Textarea, Title } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { z } from "zod";
import dayjs from "dayjs";
import { timeEntriesList, timeEntryCreate, timeEntryUpdate, type TimeEntryDto } from "../api/time-entries";
import { userDisplayName } from "../lib/user-display-name";
import { stagesList } from "../api/stages";

const formSchema = z.object({
  stageId: z.string().min(1, "Выберите этап"),
  startedAt: z.date({ message: "Укажите начало" }),
  endedAt: z.date({ message: "Укажите окончание" }),
  comment: z.string().optional(),
}).refine((v) => v.endedAt > v.startedAt, {
  message: "Окончание должно быть позже начала",
  path: ["endedAt"],
});

type FormValues = z.infer<typeof formSchema>;

type Props = { orderId: string; canEdit: boolean; showCreateForm?: boolean };

export function OrderTimeEntriesSection({ orderId, canEdit, showCreateForm = true }: Props) {
  const qc = useQueryClient();
  const entries = useQuery({
    queryKey: ["timeEntries", orderId],
    queryFn: () => timeEntriesList(orderId),
    enabled: !!orderId,
  });
  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList, enabled: canEdit });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stageId: "",
      startedAt: new Date(),
      endedAt: dayjs().add(1, "hour").toDate(),
      comment: "",
    },
  });

  const createMut = useMutation({
    mutationFn: (body: Parameters<typeof timeEntryCreate>[1]) => timeEntryCreate(orderId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timeEntries", orderId] });
      form.reset({
        stageId: form.getValues("stageId"),
        startedAt: new Date(),
        endedAt: dayjs().add(1, "hour").toDate(),
        comment: "",
      });
    },
  });
  const [editing, setEditing] = useState<TimeEntryDto | null>(null);
  const editForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stageId: "",
      startedAt: new Date(),
      endedAt: dayjs().add(1, "hour").toDate(),
      comment: "",
    },
  });
  useEffect(() => {
    if (!editing) return;
    editForm.reset({
      stageId: editing.stage.id,
      startedAt: new Date(editing.startedAt),
      endedAt: editing.endedAt ? new Date(editing.endedAt) : new Date(editing.startedAt),
      comment: editing.comment ?? "",
    });
  }, [editing, editForm]);
  const updateMut = useMutation({
    mutationFn: (body: { id: string; values: FormValues }) =>
      timeEntryUpdate(body.id, {
        stageId: body.values.stageId,
        startedAt: body.values.startedAt.toISOString(),
        endedAt: body.values.endedAt.toISOString(),
        comment: body.values.comment?.trim() ? body.values.comment : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timeEntries", orderId] });
      setEditing(null);
    },
  });

  const stageOptions = (stages.data?.stages ?? []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <Paper withBorder p="md" radius="md" mt="xl">
      <Title order={4} mb="sm">
        Учёт времени
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Список выполненных работ по заказу (этап, начало/окончание, комментарий).
      </Text>

      {entries.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {entries.isError ? (
        <Text c="red" size="sm">
          {entries.error instanceof Error ? entries.error.message : "Ошибка"}
        </Text>
      ) : null}

      {entries.data ? (
        <Table striped withTableBorder mb="lg">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Начал</Table.Th>
              <Table.Th>Закончил</Table.Th>
              <Table.Th>Этап</Table.Th>
              <Table.Th>Кто</Table.Th>
              <Table.Th>Комментарий</Table.Th>
                {canEdit ? <Table.Th style={{ width: 140 }} /> : null}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {entries.data.entries.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={canEdit ? 6 : 5}>
                  <Text size="sm" c="dimmed">
                    Записей пока нет
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              entries.data.entries.map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>{dayjs(e.startedAt).format("DD.MM.YYYY HH:mm")}</Table.Td>
                  <Table.Td>{e.endedAt ? dayjs(e.endedAt).format("DD.MM.YYYY HH:mm") : "—"}</Table.Td>
                  <Table.Td>{e.stage.name}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{userDisplayName(e.user)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2}>
                      {e.comment?.trim() ? e.comment : "—"}
                    </Text>
                  </Table.Td>
                  {canEdit ? (
                    <Table.Td>
                      <Button size="xs" variant="light" onClick={() => setEditing(e)}>
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
      <Modal opened={!!editing} onClose={() => setEditing(null)} title="Редактировать трудозатрату" size="md">
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
                  value={field.value || null}
                  onChange={(val) => field.onChange(val ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="startedAt"
              control={editForm.control}
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
              control={editForm.control}
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

      {canEdit && showCreateForm ? (
        <>
          <Divider label="Новая запись" labelPosition="left" mb="md" />
          <form
            onSubmit={form.handleSubmit((v) =>
              createMut.mutate({
                stageId: v.stageId,
                startedAt: v.startedAt.toISOString(),
                endedAt: v.endedAt.toISOString(),
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
                    placeholder="Выберите"
                    data={stageOptions}
                    value={field.value || null}
                    onChange={(val) => field.onChange(val ?? "")}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="startedAt"
                control={form.control}
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
                control={form.control}
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
              <Textarea label="Комментарий" minRows={2} {...form.register("comment")} />
              {createMut.isError ? (
                <Text c="red" size="sm">
                  {createMut.error instanceof Error ? createMut.error.message : "Ошибка"}
                </Text>
              ) : null}
              <Group justify="flex-end">
                <Button type="submit" loading={createMut.isPending}>
                  Добавить запись
                </Button>
              </Group>
            </Stack>
          </form>
        </>
      ) : null}
    </Paper>
  );
}
