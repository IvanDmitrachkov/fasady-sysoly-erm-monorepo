import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { z } from "zod";
import { meRequest } from "../api/auth";
import { stageCreate, stageDelete, stagesList, stageUpdate, type StageDto } from "../api/stages";

const stageFormSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Латиница, цифры и дефис"),
  name: z.string().min(1),
  sortOrder: z.number().int(),
  isComplete: z.boolean(),
});

type StageForm = z.infer<typeof stageFormSchema>;

function emptyStageForm(sortOrder: number): StageForm {
  return { slug: "", name: "", sortOrder, isComplete: false };
}

export function StagesPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const isAdmin = me.data?.user.role === "ADMIN";

  const stages = useQuery({ queryKey: ["stages"], queryFn: stagesList, enabled: isAdmin });

  const [createOpen, setCreateOpen] = useState(false);
  const [editStage, setEditStage] = useState<StageDto | null>(null);
  const [deleteStage, setDeleteStage] = useState<StageDto | null>(null);

  const maxSort = useMemo(() => {
    const list = stages.data?.stages ?? [];
    if (!list.length) return 0;
    return Math.max(...list.map((s) => s.sortOrder));
  }, [stages.data]);

  const createForm = useForm<StageForm>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: emptyStageForm(maxSort + 10),
  });

  const editForm = useForm<StageForm>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: emptyStageForm(0),
  });

  const createMut = useMutation({
    mutationFn: stageCreate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stages"] });
      setCreateOpen(false);
      createForm.reset(emptyStageForm(0));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<StageForm> }) => stageUpdate(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stages"] });
      setEditStage(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: stageDelete,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stages"] });
      setDeleteStage(null);
    },
  });

  if (!isAdmin) {
    return <Text c="dimmed">Раздел доступен только администратору.</Text>;
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={3}>Этапы производства</Title>
        <Button
          onClick={() => {
            createForm.reset(emptyStageForm(maxSort + 10));
            setCreateOpen(true);
          }}
        >
          Новый этап
        </Button>
      </Group>

      {stages.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {stages.isError ? (
        <Text c="red">{stages.error instanceof Error ? stages.error.message : "Ошибка"}</Text>
      ) : null}

      {stages.data ? (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Порядок</Table.Th>
              <Table.Th>Название</Table.Th>
              <Table.Th>Slug</Table.Th>
              <Table.Th>Финальный</Table.Th>
              <Table.Th style={{ width: 100 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stages.data.stages.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>{s.sortOrder}</Table.Td>
                <Table.Td>{s.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" ff="monospace">
                    {s.slug}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {s.isComplete ? (
                    <Badge color="teal" variant="light">
                      да
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      aria-label="Изменить"
                      onClick={() => {
                        setEditStage(s);
                        editForm.reset({
                          slug: s.slug,
                          name: s.name,
                          sortOrder: s.sortOrder,
                          isComplete: s.isComplete,
                        });
                      }}
                    >
                      <IconPencil size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="Удалить"
                      onClick={() => setDeleteStage(s)}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : null}

      <Modal
        opened={createOpen}
        onClose={() => {
          setCreateOpen(false);
          createForm.reset(emptyStageForm(maxSort + 10));
        }}
        title="Новый этап"
      >
        <form
          onSubmit={createForm.handleSubmit((v) =>
            createMut.mutate({
              slug: v.slug,
              name: v.name,
              sortOrder: v.sortOrder,
              isComplete: v.isComplete,
            }),
          )}
        >
          <Stack>
            <TextInput label="Slug" description="например: painting" {...createForm.register("slug")} />
            {createForm.formState.errors.slug ? (
              <Text c="red" size="xs">
                {createForm.formState.errors.slug.message}
              </Text>
            ) : null}
            <TextInput label="Название" {...createForm.register("name")} />
            <Controller
              control={createForm.control}
              name="sortOrder"
              render={({ field }) => (
                <NumberInput label="Порядок (sortOrder)" min={0} value={field.value} onChange={field.onChange} />
              )}
            />
            <Controller
              control={createForm.control}
              name="isComplete"
              render={({ field }) => (
                <Switch
                  label="Это финальный этап («готово»)"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            {createMut.isError ? (
              <Text c="red" size="sm">
                {createMut.error instanceof Error ? createMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button variant="default" type="button" onClick={() => setCreateOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" loading={createMut.isPending}>
                Создать
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!editStage} onClose={() => setEditStage(null)} title="Этап">
        <form
          onSubmit={editForm.handleSubmit((v) => {
            if (!editStage) return;
            updateMut.mutate({
              id: editStage.id,
              body: {
                slug: v.slug,
                name: v.name,
                sortOrder: v.sortOrder,
                isComplete: v.isComplete,
              },
            });
          })}
        >
          <Stack>
            <TextInput label="Slug" {...editForm.register("slug")} />
            <TextInput label="Название" {...editForm.register("name")} />
            <Controller
              control={editForm.control}
              name="sortOrder"
              render={({ field }) => (
                <NumberInput label="Порядок" min={0} value={field.value} onChange={field.onChange} />
              )}
            />
            <Controller
              control={editForm.control}
              name="isComplete"
              render={({ field }) => (
                <Switch
                  label="Финальный этап"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            {updateMut.isError ? (
              <Text c="red" size="sm">
                {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button variant="default" type="button" onClick={() => setEditStage(null)}>
                Отмена
              </Button>
              <Button type="submit" loading={updateMut.isPending}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!deleteStage} onClose={() => setDeleteStage(null)} title="Удалить этап?">
        <Stack>
          <Text size="sm">
            Удалить этап «{deleteStage?.name}»? На нём не должно быть заказов.
          </Text>
          {deleteMut.isError ? (
            <Text c="red" size="sm">
              {deleteMut.error instanceof Error ? deleteMut.error.message : "Ошибка"}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteStage(null)}>
              Отмена
            </Button>
            <Button
              color="red"
              loading={deleteMut.isPending}
              onClick={() => {
                if (deleteStage) deleteMut.mutate(deleteStage.id);
              }}
            >
              Удалить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
