import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge, Button, Group, Paper, Select, Stack, Text, Textarea, Title } from "@mantine/core";
import { useState } from "react";
import { z } from "zod";
import dayjs from "dayjs";
import { orderCommentCreate, orderCommentsList, orderCommentUpdate, type OrderCommentType } from "../api/orders";
import { userDisplayName } from "../lib/user-display-name";

const formSchema = z.object({
  type: z.enum(["NOTE", "DEFECT", "INCIDENT"]),
  text: z.string().trim().min(1, "Введите комментарий").max(4000, "Слишком длинный комментарий"),
});

type FormValues = z.infer<typeof formSchema>;

const typeMeta: Record<OrderCommentType, { label: string; color: string }> = {
  NOTE: { label: "Комментарий", color: "gray" },
  DEFECT: { label: "Дефект", color: "orange" },
  INCIDENT: { label: "Происшествие", color: "red" },
};
const EDIT_WINDOW_MS = 10 * 60 * 1000;

type Props = { orderId: string; canEdit: boolean; currentUserId?: string; isAdmin?: boolean };

export function OrderCommentsSection({ orderId, canEdit, currentUserId, isAdmin = false }: Props) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const comments = useQuery({
    queryKey: ["orderComments", orderId],
    queryFn: () => orderCommentsList(orderId),
    enabled: !!orderId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "NOTE",
      text: "",
    },
  });

  const createMut = useMutation({
    mutationFn: (body: FormValues) => orderCommentCreate(orderId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orderComments", orderId] });
      form.reset({ type: form.getValues("type"), text: "" });
    },
  });
  const editForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "NOTE",
      text: "",
    },
  });
  const updateMut = useMutation({
    mutationFn: (payload: { commentId: string; body: FormValues }) =>
      orderCommentUpdate(orderId, payload.commentId, payload.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orderComments", orderId] });
      setEditingId(null);
    },
  });

  return (
    <Paper withBorder p="md" radius="md" mt="xl">
      <Title order={4} mb="sm">
        Комментарии
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Рабочие заметки, дефекты и происшествия по заказу.
      </Text>

      {comments.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {comments.isError ? (
        <Text c="red" size="sm">
          {comments.error instanceof Error ? comments.error.message : "Ошибка"}
        </Text>
      ) : null}

      {comments.data ? (
        <Stack gap="sm" mb={canEdit ? "lg" : 0}>
          {comments.data.comments.length === 0 ? (
            <Text size="sm" c="dimmed">
              Комментариев пока нет
            </Text>
          ) : (
            comments.data.comments.map((item) => (
              <Paper key={item.id} withBorder p="sm" radius="md">
                <Group justify="space-between" align="flex-start" mb={6}>
                  <Group gap="xs">
                    <Badge size="sm" variant="light" color={typeMeta[item.type].color}>
                      {typeMeta[item.type].label}
                    </Badge>
                    <Text size="sm" fw={500}>
                      {userDisplayName(item.user)}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {dayjs(item.createdAt).format("D MMM YYYY, HH:mm")}
                  </Text>
                </Group>
                {editingId === item.id ? (
                  <form
                    onSubmit={editForm.handleSubmit((v) => {
                      updateMut.mutate({ commentId: item.id, body: v });
                    })}
                  >
                    <Stack gap="sm">
                      <Controller
                        name="type"
                        control={editForm.control}
                        render={({ field, fieldState }) => (
                          <Select
                            label="Тип"
                            data={[
                              { value: "NOTE", label: typeMeta.NOTE.label },
                              { value: "DEFECT", label: typeMeta.DEFECT.label },
                              { value: "INCIDENT", label: typeMeta.INCIDENT.label },
                            ]}
                            value={field.value}
                            onChange={(v) => field.onChange(v ?? "NOTE")}
                            allowDeselect={false}
                            error={fieldState.error?.message}
                          />
                        )}
                      />
                      <Textarea
                        label="Текст"
                        minRows={3}
                        error={editForm.formState.errors.text?.message}
                        {...editForm.register("text")}
                      />
                      {updateMut.isError ? (
                        <Text c="red" size="sm">
                          {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
                        </Text>
                      ) : null}
                      <Group justify="flex-end">
                        <Button type="button" variant="default" onClick={() => setEditingId(null)}>
                          Отмена
                        </Button>
                        <Button type="submit" loading={updateMut.isPending}>
                          Сохранить
                        </Button>
                      </Group>
                    </Stack>
                  </form>
                ) : (
                  <>
                    <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {item.text}
                    </Text>
                    {canEdit &&
                    (isAdmin ||
                      (item.user.id === currentUserId &&
                        Date.now() - new Date(item.createdAt).getTime() <= EDIT_WINDOW_MS)) ? (
                      <Group justify="flex-end" mt="sm">
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          onClick={() => {
                            editForm.reset({ type: item.type, text: item.text });
                            setEditingId(item.id);
                          }}
                        >
                          Редактировать
                        </Button>
                      </Group>
                    ) : null}
                  </>
                )}
              </Paper>
            ))
          )}
        </Stack>
      ) : null}

      {canEdit ? (
        <form
          onSubmit={form.handleSubmit((v) => {
            createMut.mutate(v);
          })}
        >
          <Stack gap="sm">
            <Controller
              name="type"
              control={form.control}
              render={({ field, fieldState }) => (
                <Select
                  label="Тип"
                  data={[
                    { value: "NOTE", label: typeMeta.NOTE.label },
                    { value: "DEFECT", label: typeMeta.DEFECT.label },
                    { value: "INCIDENT", label: typeMeta.INCIDENT.label },
                  ]}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "NOTE")}
                  allowDeselect={false}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Textarea
              label="Текст"
              minRows={3}
              placeholder="Например: поставил детали на стол у участка кромки"
              error={form.formState.errors.text?.message}
              {...form.register("text")}
            />
            {createMut.isError ? (
              <Text c="red" size="sm">
                {createMut.error instanceof Error ? createMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button type="submit" loading={createMut.isPending}>
                Добавить комментарий
              </Button>
            </Group>
          </Stack>
        </form>
      ) : null}
    </Paper>
  );
}
