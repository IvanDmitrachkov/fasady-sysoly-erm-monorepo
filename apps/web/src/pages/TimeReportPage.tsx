import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { DatePickerInput, DateTimePicker } from "@mantine/dates";
import { Link } from "react-router-dom";
import { z } from "zod";
import dayjs from "dayjs";
import { meRequest } from "../api/auth";
import { stagesList } from "../api/stages";
import {
  timeEntriesReport,
  timeEntriesReportXlsxPath,
  timeEntryUpdate,
  type TimeEntryReportDto,
} from "../api/time-entries";
import { usersList } from "../api/users";
import { userDisplayName } from "../lib/user-display-name";
import "./TimeReportPage.css";

function formatMinutes(m: number): string {
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h} ч ${min} мин` : `${h} ч`;
}

const editSchema = z.object({
  stageId: z.string().min(1, "Выберите этап"),
  startedAt: z.date({ message: "Укажите начало" }),
  endedAt: z.date({ message: "Укажите окончание" }),
  comment: z.string().optional(),
}).refine((v) => v.endedAt > v.startedAt, {
  message: "Окончание должно быть позже начала",
  path: ["endedAt"],
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
    mutationFn: (body: { id: string; values: EditFormValues }) =>
      timeEntryUpdate(body.id, {
        stageId: body.values.stageId,
        startedAt: body.values.startedAt.toISOString(),
        endedAt: body.values.endedAt.toISOString(),
        comment: body.values.comment?.trim() ? body.values.comment : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timeEntriesReport"] });
      setEditing(null);
    },
  });

  const totalMinutes = report.data?.totalMinutes ?? 0;
  const timeEntryCards = report.data?.entries.map((e) => (
    <Paper key={e.id} withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="xs">
          <div>
            <Text component={Link} to={`/orders/${e.order.id}`} fw={600} c="brand.6" style={{ textDecoration: "none" }}>
              №{e.order.orderNumber}
            </Text>
            <Text size="xs" c="dimmed">
              {dayjs(e.startedAt).format("DD.MM.YYYY HH:mm")} - {e.endedAt ? dayjs(e.endedAt).format("DD.MM.YYYY HH:mm") : "—"}
            </Text>
          </div>
          <Text fw={600}>{formatMinutes(e.minutes)}</Text>
        </Group>

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
          <div className="time-report-card-cell">
            <Text size="xs" c="dimmed">
              Вид (этап)
            </Text>
            <Text size="sm">{e.stage.name}</Text>
          </div>
          <div className="time-report-card-cell">
            <Text size="xs" c="dimmed">
              Комментарий
            </Text>
            <Text size="sm" lineClamp={3}>
              {e.comment?.trim() ? e.comment : "—"}
            </Text>
          </div>
        </SimpleGrid>

        <Button size="xs" variant="light" fullWidth onClick={() => setEditing(e)}>
          Редактировать
        </Button>
      </Stack>
    </Paper>
  ));

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

      <Stack gap="md" mb="lg" className="time-report-filters-stack">
        {isAdmin ? (
          <Select
            label="Сотрудник"
            placeholder="Выберите"
            data={staffOptions}
            value={employeeId}
            onChange={setEmployeeId}
            disabled={usersQ.isPending}
            w="100%"
          />
        ) : null}
        <Group grow align="flex-start" className="time-report-filter-row">
          <DatePickerInput
            label="Начало периода"
            value={periodFrom}
            onChange={setPeriodFrom}
            locale="ru"
            clearable={false}
            w="100%"
          />
          <DatePickerInput
            label="Конец периода"
            value={periodTo}
            onChange={setPeriodTo}
            locale="ru"
            clearable={false}
            w="100%"
          />
        </Group>
        {fromIso && toIso ? (
          <Button
            component="a"
            variant="light"
            href={timeEntriesReportXlsxPath({
              from: fromIso,
              to: toIso,
              ...(isAdmin && employeeId ? { userId: employeeId } : {}),
            })}
          >
            Скачать табель Excel
          </Button>
        ) : null}
      </Stack>

      {report.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {report.isError ? (
        <Text c="red">{report.error instanceof Error ? report.error.message : "Ошибка"}</Text>
      ) : null}

      {report.data ? (
        <>
          <Paper withBorder p="md" radius="md" mb="sm" hiddenFrom="sm">
            <Text size="xs" c="dimmed">
              Всего трудозатрат
            </Text>
            <Text fw={700}>
              {formatMinutes(totalMinutes)} ({totalMinutes} мин)
            </Text>
          </Paper>

          {report.data.entries.length === 0 ? (
            <Text size="sm" c="dimmed">
              Нет записей за выбранный период
            </Text>
          ) : (
            <Stack gap="sm" hiddenFrom="sm">
              {timeEntryCards}
            </Stack>
          )}

          <Table striped withTableBorder visibleFrom="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th colSpan={7} style={{ textAlign: "right", fontWeight: 600 }}>
                  Всего трудозатрат: {formatMinutes(totalMinutes)} ({totalMinutes} мин)
                </Table.Th>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Заказ</Table.Th>
                <Table.Th>Начал</Table.Th>
                <Table.Th>Закончил</Table.Th>
                <Table.Th>Вид (этап)</Table.Th>
                <Table.Th>Длительность</Table.Th>
                <Table.Th>Комментарий</Table.Th>
                <Table.Th style={{ width: 140 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.data.entries.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text size="sm" c="dimmed">
                      Нет записей за выбранный период
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                report.data.entries.map((e) => (
                  <Table.Tr key={e.id}>
                    <Table.Td>№{e.order.orderNumber}</Table.Td>
                    <Table.Td>{dayjs(e.startedAt).format("DD.MM.YYYY HH:mm")}</Table.Td>
                    <Table.Td>{e.endedAt ? dayjs(e.endedAt).format("DD.MM.YYYY HH:mm") : "—"}</Table.Td>
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
        </>
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
          <Stack gap="sm" className="time-report-modal-form">
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
                  w="100%"
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
                  w="100%"
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
                  w="100%"
                />
              )}
            />
            <Textarea label="Комментарий" minRows={2} w="100%" {...editForm.register("comment")} />
            {updateMut.isError ? (
              <Text c="red" size="sm">
                {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end" mt="xs" className="time-report-modal-actions">
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
