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
  ScrollArea,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { z } from "zod";
import { meRequest } from "../api/auth";
import {
  coatingTypeCreate,
  coatingTypeDelete,
  coatingTypeUpdate,
  coatingTypesList,
  handleTypeCreate,
  handleTypeDelete,
  handleTypeUpdate,
  handleTypesList,
  millingTypeCreate,
  millingTypeDelete,
  millingTypeUpdate,
  millingTypesList,
  type CoatingTypeDto,
  type HandleTypeDto,
  type MillingTypeDto,
} from "../api/facade-types";

const rowFormSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Латиница, цифры и дефис"),
  name: z.string().min(1),
  price: z.number().finite(),
  sortOrder: z.number().int(),
  active: z.boolean(),
});

type RowForm = z.infer<typeof rowFormSchema>;

function emptyRowForm(sortOrder: number): RowForm {
  return { slug: "", name: "", price: 0, sortOrder, active: true };
}

function MillingTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["milling-types"], queryFn: millingTypesList });
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<MillingTypeDto | null>(null);
  const [deleteRow, setDeleteRow] = useState<MillingTypeDto | null>(null);

  const maxSort = useMemo(() => {
    const list = q.data?.millingTypes ?? [];
    if (!list.length) return 0;
    return Math.max(...list.map((s) => s.sortOrder));
  }, [q.data]);

  const createForm = useForm<RowForm>({
    resolver: zodResolver(rowFormSchema),
    defaultValues: emptyRowForm(10),
  });
  const editForm = useForm<RowForm>({
    resolver: zodResolver(rowFormSchema),
    defaultValues: emptyRowForm(0),
  });

  const createMut = useMutation({
    mutationFn: millingTypeCreate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["milling-types"] });
      setCreateOpen(false);
      createForm.reset(emptyRowForm(maxSort + 10));
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof millingTypeUpdate>[1] }) =>
      millingTypeUpdate(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["milling-types"] });
      setEditRow(null);
    },
  });
  const deleteMut = useMutation({
    mutationFn: millingTypeDelete,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["milling-types"] });
      setDeleteRow(null);
    },
  });

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Text size="sm" c="dimmed">
          Цена применяется за м² площади фасада (надбавка к базе).
        </Text>
        <Button
          onClick={() => {
            createForm.reset(emptyRowForm(maxSort + 10));
            setCreateOpen(true);
          }}
        >
          Новый тип
        </Button>
      </Group>
      {q.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {q.isError ? <Text c="red">{q.error instanceof Error ? q.error.message : "Ошибка"}</Text> : null}
      {q.data ? (
        <ScrollArea type="auto" offsetScrollbars>
        <Table striped withTableBorder miw={760}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Порядок</Table.Th>
              <Table.Th>Название</Table.Th>
              <Table.Th>Slug</Table.Th>
              <Table.Th>₽/м²</Table.Th>
              <Table.Th>Активен</Table.Th>
              <Table.Th w={100} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.millingTypes.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.sortOrder}</Table.Td>
                <Table.Td>{r.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace" c="dimmed">
                    {r.slug}
                  </Text>
                </Table.Td>
                <Table.Td>{r.pricePerM2.toLocaleString("ru-RU")}</Table.Td>
                <Table.Td>
                  {r.active ? (
                    <Badge color="teal" variant="light">
                      да
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      нет
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      aria-label="Изменить"
                      onClick={() => {
                        setEditRow(r);
                        editForm.reset({
                          slug: r.slug,
                          name: r.name,
                          price: r.pricePerM2,
                          sortOrder: r.sortOrder,
                          active: r.active,
                        });
                      }}
                    >
                      <IconPencil size={18} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" aria-label="Удалить" onClick={() => setDeleteRow(r)}>
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </ScrollArea>
      ) : null}

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый тип фрезеровки"
      >
        <form
          onSubmit={createForm.handleSubmit((v) =>
            createMut.mutate({
              slug: v.slug,
              name: v.name,
              pricePerM2: v.price,
              sortOrder: v.sortOrder,
              active: v.active,
            }),
          )}
        >
          <Stack>
            <TextInput label="Slug" {...createForm.register("slug")} />
            {createForm.formState.errors.slug ? (
              <Text c="red" size="xs">
                {createForm.formState.errors.slug.message}
              </Text>
            ) : null}
            <TextInput label="Название" {...createForm.register("name")} />
            <Controller
              control={createForm.control}
              name="price"
              render={({ field }) => (
                <NumberInput label="Цена, ₽/м²" min={0} decimalScale={2} value={field.value} onChange={field.onChange} />
              )}
            />
            <Controller
              control={createForm.control}
              name="sortOrder"
              render={({ field }) => <NumberInput label="Порядок" min={0} value={field.value} onChange={field.onChange} />}
            />
            <Controller
              control={createForm.control}
              name="active"
              render={({ field }) => (
                <Switch label="Активен" checked={field.value} onChange={(e) => field.onChange(e.currentTarget.checked)} />
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

      <Modal opened={!!editRow} onClose={() => setEditRow(null)} title="Тип фрезеровки">
        <form
          onSubmit={editForm.handleSubmit((v) => {
            if (!editRow) return;
            updateMut.mutate({
              id: editRow.id,
              body: {
                slug: v.slug,
                name: v.name,
                pricePerM2: v.price,
                sortOrder: v.sortOrder,
                active: v.active,
              },
            });
          })}
        >
          <Stack>
            <TextInput label="Slug" {...editForm.register("slug")} />
            <TextInput label="Название" {...editForm.register("name")} />
            <Controller
              control={editForm.control}
              name="price"
              render={({ field }) => (
                <NumberInput label="Цена, ₽/м²" min={0} decimalScale={2} value={field.value} onChange={field.onChange} />
              )}
            />
            <Controller
              control={editForm.control}
              name="sortOrder"
              render={({ field }) => <NumberInput label="Порядок" min={0} value={field.value} onChange={field.onChange} />}
            />
            <Controller
              control={editForm.control}
              name="active"
              render={({ field }) => (
                <Switch label="Активен" checked={field.value} onChange={(e) => field.onChange(e.currentTarget.checked)} />
              )}
            />
            {updateMut.isError ? (
              <Text c="red" size="sm">
                {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button variant="default" type="button" onClick={() => setEditRow(null)}>
                Отмена
              </Button>
              <Button type="submit" loading={updateMut.isPending}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!deleteRow} onClose={() => setDeleteRow(null)} title="Удалить тип фрезеровки?">
        <Stack>
          <Text size="sm">Удалить «{deleteRow?.name}»? Тип не должен использоваться в заказах.</Text>
          {deleteMut.isError ? (
            <Text c="red" size="sm">
              {deleteMut.error instanceof Error ? deleteMut.error.message : "Ошибка"}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteRow(null)}>
              Отмена
            </Button>
            <Button color="red" loading={deleteMut.isPending} onClick={() => deleteRow && deleteMut.mutate(deleteRow.id)}>
              Удалить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function CoatingTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["coating-types"], queryFn: coatingTypesList });
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<CoatingTypeDto | null>(null);
  const [deleteRow, setDeleteRow] = useState<CoatingTypeDto | null>(null);

  const maxSort = useMemo(() => {
    const list = q.data?.coatingTypes ?? [];
    if (!list.length) return 0;
    return Math.max(...list.map((s) => s.sortOrder));
  }, [q.data]);

  const createForm = useForm<RowForm>({
    resolver: zodResolver(rowFormSchema),
    defaultValues: emptyRowForm(10),
  });
  const editForm = useForm<RowForm>({
    resolver: zodResolver(rowFormSchema),
    defaultValues: emptyRowForm(0),
  });

  const createMut = useMutation({
    mutationFn: coatingTypeCreate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["coating-types"] });
      setCreateOpen(false);
      createForm.reset(emptyRowForm(maxSort + 10));
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof coatingTypeUpdate>[1] }) =>
      coatingTypeUpdate(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["coating-types"] });
      setEditRow(null);
    },
  });
  const deleteMut = useMutation({
    mutationFn: coatingTypeDelete,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["coating-types"] });
      setDeleteRow(null);
    },
  });

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Text size="sm" c="dimmed">
          Цена за м² площади фасада.
        </Text>
        <Button
          onClick={() => {
            createForm.reset(emptyRowForm(maxSort + 10));
            setCreateOpen(true);
          }}
        >
          Новый тип
        </Button>
      </Group>
      {q.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {q.isError ? <Text c="red">{q.error instanceof Error ? q.error.message : "Ошибка"}</Text> : null}
      {q.data ? (
        <ScrollArea type="auto" offsetScrollbars>
        <Table striped withTableBorder miw={760}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Порядок</Table.Th>
              <Table.Th>Название</Table.Th>
              <Table.Th>Slug</Table.Th>
              <Table.Th>₽/м²</Table.Th>
              <Table.Th>Активен</Table.Th>
              <Table.Th w={100} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.coatingTypes.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.sortOrder}</Table.Td>
                <Table.Td>{r.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace" c="dimmed">
                    {r.slug}
                  </Text>
                </Table.Td>
                <Table.Td>{r.pricePerM2.toLocaleString("ru-RU")}</Table.Td>
                <Table.Td>
                  {r.active ? (
                    <Badge color="teal" variant="light">
                      да
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      нет
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      aria-label="Изменить"
                      onClick={() => {
                        setEditRow(r);
                        editForm.reset({
                          slug: r.slug,
                          name: r.name,
                          price: r.pricePerM2,
                          sortOrder: r.sortOrder,
                          active: r.active,
                        });
                      }}
                    >
                      <IconPencil size={18} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" aria-label="Удалить" onClick={() => setDeleteRow(r)}>
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </ScrollArea>
      ) : null}

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Новый тип покрытия">
        <form
          onSubmit={createForm.handleSubmit((v) =>
            createMut.mutate({
              slug: v.slug,
              name: v.name,
              pricePerM2: v.price,
              sortOrder: v.sortOrder,
              active: v.active,
            }),
          )}
        >
          <Stack>
            <TextInput label="Slug" {...createForm.register("slug")} />
            {createForm.formState.errors.slug ? (
              <Text c="red" size="xs">
                {createForm.formState.errors.slug.message}
              </Text>
            ) : null}
            <TextInput label="Название" {...createForm.register("name")} />
            <Controller
              control={createForm.control}
              name="price"
              render={({ field }) => (
                <NumberInput label="Цена, ₽/м²" min={0} decimalScale={2} value={field.value} onChange={field.onChange} />
              )}
            />
            <Controller
              control={createForm.control}
              name="sortOrder"
              render={({ field }) => <NumberInput label="Порядок" min={0} value={field.value} onChange={field.onChange} />}
            />
            <Controller
              control={createForm.control}
              name="active"
              render={({ field }) => (
                <Switch label="Активен" checked={field.value} onChange={(e) => field.onChange(e.currentTarget.checked)} />
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

      <Modal opened={!!editRow} onClose={() => setEditRow(null)} title="Тип покрытия">
        <form
          onSubmit={editForm.handleSubmit((v) => {
            if (!editRow) return;
            updateMut.mutate({
              id: editRow.id,
              body: {
                slug: v.slug,
                name: v.name,
                pricePerM2: v.price,
                sortOrder: v.sortOrder,
                active: v.active,
              },
            });
          })}
        >
          <Stack>
            <TextInput label="Slug" {...editForm.register("slug")} />
            <TextInput label="Название" {...editForm.register("name")} />
            <Controller
              control={editForm.control}
              name="price"
              render={({ field }) => (
                <NumberInput label="Цена, ₽/м²" min={0} decimalScale={2} value={field.value} onChange={field.onChange} />
              )}
            />
            <Controller
              control={editForm.control}
              name="sortOrder"
              render={({ field }) => <NumberInput label="Порядок" min={0} value={field.value} onChange={field.onChange} />}
            />
            <Controller
              control={editForm.control}
              name="active"
              render={({ field }) => (
                <Switch label="Активен" checked={field.value} onChange={(e) => field.onChange(e.currentTarget.checked)} />
              )}
            />
            {updateMut.isError ? (
              <Text c="red" size="sm">
                {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button variant="default" type="button" onClick={() => setEditRow(null)}>
                Отмена
              </Button>
              <Button type="submit" loading={updateMut.isPending}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!deleteRow} onClose={() => setDeleteRow(null)} title="Удалить тип покрытия?">
        <Stack>
          <Text size="sm">Удалить «{deleteRow?.name}»?</Text>
          {deleteMut.isError ? (
            <Text c="red" size="sm">
              {deleteMut.error instanceof Error ? deleteMut.error.message : "Ошибка"}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteRow(null)}>
              Отмена
            </Button>
            <Button color="red" loading={deleteMut.isPending} onClick={() => deleteRow && deleteMut.mutate(deleteRow.id)}>
              Удалить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function HandleTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["handle-types"], queryFn: handleTypesList });
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<HandleTypeDto | null>(null);
  const [deleteRow, setDeleteRow] = useState<HandleTypeDto | null>(null);

  const maxSort = useMemo(() => {
    const list = q.data?.handleTypes ?? [];
    if (!list.length) return 0;
    return Math.max(...list.map((s) => s.sortOrder));
  }, [q.data]);

  const createForm = useForm<RowForm>({
    resolver: zodResolver(rowFormSchema),
    defaultValues: emptyRowForm(10),
  });
  const editForm = useForm<RowForm>({
    resolver: zodResolver(rowFormSchema),
    defaultValues: emptyRowForm(0),
  });

  const createMut = useMutation({
    mutationFn: handleTypeCreate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["handle-types"] });
      setCreateOpen(false);
      createForm.reset(emptyRowForm(maxSort + 10));
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof handleTypeUpdate>[1] }) => handleTypeUpdate(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["handle-types"] });
      setEditRow(null);
    },
  });
  const deleteMut = useMutation({
    mutationFn: handleTypeDelete,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["handle-types"] });
      setDeleteRow(null);
    },
  });

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Text size="sm" c="dimmed">
          Цена за погонный метр длины ручки.
        </Text>
        <Button
          onClick={() => {
            createForm.reset(emptyRowForm(maxSort + 10));
            setCreateOpen(true);
          }}
        >
          Новый тип
        </Button>
      </Group>
      {q.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {q.isError ? <Text c="red">{q.error instanceof Error ? q.error.message : "Ошибка"}</Text> : null}
      {q.data ? (
        <ScrollArea type="auto" offsetScrollbars>
        <Table striped withTableBorder miw={760}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Порядок</Table.Th>
              <Table.Th>Название</Table.Th>
              <Table.Th>Slug</Table.Th>
              <Table.Th>₽/м</Table.Th>
              <Table.Th>Активен</Table.Th>
              <Table.Th w={100} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.handleTypes.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.sortOrder}</Table.Td>
                <Table.Td>{r.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace" c="dimmed">
                    {r.slug}
                  </Text>
                </Table.Td>
                <Table.Td>{r.pricePerMeter.toLocaleString("ru-RU")}</Table.Td>
                <Table.Td>
                  {r.active ? (
                    <Badge color="teal" variant="light">
                      да
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      нет
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      aria-label="Изменить"
                      onClick={() => {
                        setEditRow(r);
                        editForm.reset({
                          slug: r.slug,
                          name: r.name,
                          price: r.pricePerMeter,
                          sortOrder: r.sortOrder,
                          active: r.active,
                        });
                      }}
                    >
                      <IconPencil size={18} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" aria-label="Удалить" onClick={() => setDeleteRow(r)}>
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </ScrollArea>
      ) : null}

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Новый тип ручки">
        <form
          onSubmit={createForm.handleSubmit((v) =>
            createMut.mutate({
              slug: v.slug,
              name: v.name,
              pricePerMeter: v.price,
              sortOrder: v.sortOrder,
              active: v.active,
            }),
          )}
        >
          <Stack>
            <TextInput label="Slug" {...createForm.register("slug")} />
            {createForm.formState.errors.slug ? (
              <Text c="red" size="xs">
                {createForm.formState.errors.slug.message}
              </Text>
            ) : null}
            <TextInput label="Название" {...createForm.register("name")} />
            <Controller
              control={createForm.control}
              name="price"
              render={({ field }) => (
                <NumberInput label="Цена, ₽/м" min={0} decimalScale={2} value={field.value} onChange={field.onChange} />
              )}
            />
            <Controller
              control={createForm.control}
              name="sortOrder"
              render={({ field }) => <NumberInput label="Порядок" min={0} value={field.value} onChange={field.onChange} />}
            />
            <Controller
              control={createForm.control}
              name="active"
              render={({ field }) => (
                <Switch label="Активен" checked={field.value} onChange={(e) => field.onChange(e.currentTarget.checked)} />
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

      <Modal opened={!!editRow} onClose={() => setEditRow(null)} title="Тип ручки">
        <form
          onSubmit={editForm.handleSubmit((v) => {
            if (!editRow) return;
            updateMut.mutate({
              id: editRow.id,
              body: {
                slug: v.slug,
                name: v.name,
                pricePerMeter: v.price,
                sortOrder: v.sortOrder,
                active: v.active,
              },
            });
          })}
        >
          <Stack>
            <TextInput label="Slug" {...editForm.register("slug")} />
            <TextInput label="Название" {...editForm.register("name")} />
            <Controller
              control={editForm.control}
              name="price"
              render={({ field }) => (
                <NumberInput label="Цена, ₽/м" min={0} decimalScale={2} value={field.value} onChange={field.onChange} />
              )}
            />
            <Controller
              control={editForm.control}
              name="sortOrder"
              render={({ field }) => <NumberInput label="Порядок" min={0} value={field.value} onChange={field.onChange} />}
            />
            <Controller
              control={editForm.control}
              name="active"
              render={({ field }) => (
                <Switch label="Активен" checked={field.value} onChange={(e) => field.onChange(e.currentTarget.checked)} />
              )}
            />
            {updateMut.isError ? (
              <Text c="red" size="sm">
                {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button variant="default" type="button" onClick={() => setEditRow(null)}>
                Отмена
              </Button>
              <Button type="submit" loading={updateMut.isPending}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!deleteRow} onClose={() => setDeleteRow(null)} title="Удалить тип ручки?">
        <Stack>
          <Text size="sm">Удалить «{deleteRow?.name}»?</Text>
          {deleteMut.isError ? (
            <Text c="red" size="sm">
              {deleteMut.error instanceof Error ? deleteMut.error.message : "Ошибка"}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteRow(null)}>
              Отмена
            </Button>
            <Button color="red" loading={deleteMut.isPending} onClick={() => deleteRow && deleteMut.mutate(deleteRow.id)}>
              Удалить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export function FacadeCatalogPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const isAdmin = me.data?.user.role === "ADMIN";

  if (!isAdmin) {
    return <Text c="dimmed">Раздел доступен только администратору.</Text>;
  }

  return (
    <>
      <Title order={3} mb="md">
        Справочники фасадов
      </Title>
      <Tabs defaultValue="milling">
        <Tabs.List>
          <Tabs.Tab value="milling">Фрезеровка</Tabs.Tab>
          <Tabs.Tab value="coating">Покрытие</Tabs.Tab>
          <Tabs.Tab value="handle">Ручки</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="milling" pt="md">
          <MillingTab />
        </Tabs.Panel>
        <Tabs.Panel value="coating" pt="md">
          <CoatingTab />
        </Tabs.Panel>
        <Tabs.Panel value="handle" pt="md">
          <HandleTab />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
