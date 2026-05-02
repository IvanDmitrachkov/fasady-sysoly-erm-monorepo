import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Divider, Group, NumberInput, Paper, Select, Stack, Table, Text, Textarea, Title } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { z } from "zod";
import dayjs from "dayjs";
import { timeEntriesList, timeEntryCreate } from "../api/time-entries";
import { userDisplayName } from "../lib/user-display-name";
import { stagesList } from "../api/stages";

const formSchema = z.object({
  stageId: z.string().min(1, "Выберите этап"),
  minutes: z.number().int().positive("Укажите минуты > 0"),
  comment: z.string().optional(),
  workedAt: z.date({ message: "Укажите дату" }),
});

type FormValues = z.infer<typeof formSchema>;

function formatMinutes(m: number): string {
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h} ч ${min} мин` : `${h} ч`;
}

type Props = { orderId: string; canEdit: boolean };

export function OrderTimeEntriesSection({ orderId, canEdit }: Props) {
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
      minutes: 30,
      comment: "",
      workedAt: new Date(),
    },
  });

  const createMut = useMutation({
    mutationFn: (body: Parameters<typeof timeEntryCreate>[1]) => timeEntryCreate(orderId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timeEntries", orderId] });
      form.reset({
        stageId: form.getValues("stageId"),
        minutes: 30,
        comment: "",
        workedAt: new Date(),
      });
    },
  });

  const stageOptions = (stages.data?.stages ?? []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <Paper withBorder p="md" radius="md" mt="xl">
      <Title order={4} mb="sm">
        Учёт времени
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Записи трудозатрат по заказу (минуты, этап, дата работы).
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
              <Table.Th>Дата работы</Table.Th>
              <Table.Th>Этап</Table.Th>
              <Table.Th>Время</Table.Th>
              <Table.Th>Кто</Table.Th>
              <Table.Th>Комментарий</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {entries.data.entries.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text size="sm" c="dimmed">
                    Записей пока нет
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              entries.data.entries.map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>{dayjs(e.workedAt).format("D MMM YYYY")}</Table.Td>
                  <Table.Td>{e.stage.name}</Table.Td>
                  <Table.Td>{formatMinutes(e.minutes)}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{userDisplayName(e.user)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2}>
                      {e.comment?.trim() ? e.comment : "—"}
                    </Text>
                  </Table.Td>
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
                stageId: v.stageId,
                minutes: v.minutes,
                comment: v.comment?.trim() ? v.comment : null,
                workedAt: dayjs(v.workedAt).startOf("day").toISOString(),
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
                name="minutes"
                control={form.control}
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Минуты"
                    min={1}
                    max={24 * 60}
                    value={field.value}
                    onChange={(n) => field.onChange(typeof n === "number" ? n : 1)}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="workedAt"
                control={form.control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="Дата работы"
                    value={field.value}
                    onChange={(d) => field.onChange(d ?? new Date())}
                    locale="ru"
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
