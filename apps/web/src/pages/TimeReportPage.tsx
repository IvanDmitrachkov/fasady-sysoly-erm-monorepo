import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { z } from "zod";
import dayjs from "dayjs";
import { meRequest } from "../api/auth";
import { stagesList } from "../api/stages";
import {
  timeEntriesReport,
  timeEntryUpdate,
  type TimeEntryReportDto,
} from "../api/time-entries";
import { usersList } from "../api/users";
import { userDisplayName } from "../lib/user-display-name";

function formatMinutes(m: number): string {
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h} ч ${min} мин` : `${h} ч`;
}

const editSchema = z.object({
  stageId: z.string().min(1, "Выберите этап"),
  minutes: z.number().int().positive("Укажите минуты > 0"),
  comment: z.string().optional(),
  workedAt: z.date({ message: "Укажите дату" }),
});

type EditFormValues = z.infer<typeof editSchema>;

export function TimeReportPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const user = me.data?.user;
  const isAdmin = user?.role === "ADMIN";

  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: usersList,
    enabled: isAdmin === true,
  });

  const staffOptions = useMemo(() => {
    const list = usersQ.data?.users ?? [];
    return list
      .filter((u) => u.role === "ADMIN" || u.role === "WORKER")
      .map((u) => ({
        value: u.id,
        label: userDisplayName(u) || u.email,
      }));
  }, [usersQ.data?.users]);

  const now = dayjs();
  const [periodFrom, setPeriodFrom] = useState<Date | null>(now.startOf("month").toDate());
  const [periodTo, setPeriodTo] = useState<Date | null>(now.endOf("day").toDate());
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !staffOptions.length) return;
    setEmployeeId((prev) => {
      if (prev && staffOptions.some((o) => o.value === prev)) return prev;
      return staffOptions[0]?.value ?? null;
    });
  }, [isAdmin, staffOptions]);

  const fromIso = periodFrom ? dayjs(periodFrom).startOf("day").toISOString() : "";
  const toIso = periodTo ? dayjs(periodTo).endOf("day").toISOString() : "";

  const reportEnabled =
    !!fromIso &&
    !!toIso &&
    (!isAdmin || !!employeeId) &&
    me.isSuccess &&
    (user?.role === "ADMIN" || user?.role === "WORKER");

  const report = useQuery({
    queryKey: ["timeEntriesReport", fromIso, toIso, isAdmin ? employeeId : user?.id],
    queryFn: () =>
      timeEntriesReport({
        from: fromIso,
        to: toIso,
        ...(isAdmin && employeeId ? { userId: employeeId } : {}),
      }),
    enabled: reportEnabled,
  });

  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList });
  const stageOptions = (stages.data?.stages ?? []).map((s) => ({ value: s.id, label: s.name }));

  const [editing, setEditing] = useState<TimeEntryReportDto | null>(null);

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      stageId: "",
      minutes: 30,
      comment: "",
      workedAt: new Date(),
    },
  });

  useEffect(() => {
    if (!editing) return;
    editForm.reset({
      stageId: editing.stage.id,
      minutes: editing.minutes,
      comment: editing.comment ?? "",
      workedAt: new Date(editing.workedAt),
    });
  }, [editing, editForm]);

  const updateMut = useMutation({
    mutationFn: (body: { id: string; values: EditFormValues }) =>
      timeEntryUpdate(body.id, {
        stageId: body.values.stageId,
        minutes: body.values.minutes,
        comment: body.values.comment?.trim() ? body.values.comment : null,
        workedAt: dayjs(body.values.workedAt).startOf("day").toISOString(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timeEntriesReport"] });
      setEditing(null);
    },
  });

  const totalMinutes = report.data?.totalMinutes ?? 0;

  if (me.isSuccess && user && user.role !== "ADMIN" && user.role !== "WORKER") {
    return (
      <Text c="dimmed">
        Отчёт доступен только администратору и работнику производства.
      </Text>
    );
  }

  return (
    <>
      <Title order={3} mb="md">
        Отчёт по трудозатратам
      </Title>

      <Stack gap="md" mb="lg">
        {isAdmin ? (
          <Select
            label="Сотрудник"
            placeholder="Выберите"
            data={staffOptions}
            value={employeeId}
            onChange={setEmployeeId}
            disabled={usersQ.isPending}
          />
        ) : null}
        <Group grow align="flex-start">
          <DatePickerInput
            label="Начало периода"
            value={periodFrom}
            onChange={setPeriodFrom}
            locale="ru"
            clearable={false}
          />
          <DatePickerInput
            label="Конец периода"
            value={periodTo}
            onChange={setPeriodTo}
            locale="ru"
            clearable={false}
          />
        </Group>
      </Stack>

      {report.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {report.isError ? (
        <Text c="red">{report.error instanceof Error ? report.error.message : "Ошибка"}</Text>
      ) : null}

      {report.data ? (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th colSpan={6} style={{ textAlign: "right", fontWeight: 600 }}>
                Всего трудозатрат: {formatMinutes(totalMinutes)} ({totalMinutes} мин)
              </Table.Th>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>Заказ</Table.Th>
              <Table.Th>Дата работы</Table.Th>
              <Table.Th>Вид (этап)</Table.Th>
              <Table.Th>Время</Table.Th>
              <Table.Th>Комментарий</Table.Th>
              <Table.Th style={{ width: 140 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {report.data.entries.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed">
                    Нет записей за выбранный период
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              report.data.entries.map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>№{e.order.orderNumber}</Table.Td>
                  <Table.Td>{dayjs(e.workedAt).format("DD.MM.YYYY")}</Table.Td>
                  <Table.Td>{e.stage.name}</Table.Td>
                  <Table.Td>{formatMinutes(e.minutes)}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={3}>
                      {e.comment?.trim() ? e.comment : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="light" onClick={() => setEditing(e)}>
                      Редактировать
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      ) : null}

      <Modal
        opened={!!editing}
        onClose={() => setEditing(null)}
        title="Редактировать трудозатрату"
        size="md"
      >
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
                  label="Вид трудозатрат (этап)"
                  data={stageOptions}
                  value={field.value || null}
                  onChange={(val) => field.onChange(val ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="minutes"
              control={editForm.control}
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Время, минуты"
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
              control={editForm.control}
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
            <Textarea label="Комментарий" minRows={2} {...editForm.register("comment")} />
            {updateMut.isError ? (
              <Text c="red" size="sm">
                {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end" mt="xs">
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
    </>
  );
}
