import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { meRequest } from "../api/auth";
import { customersList } from "../api/customers";
import { userCreate, userDelete, userUpdate, usersList, type UserListDto, type UserRole } from "../api/users";

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: "Администратор" },
  { value: "WORKER", label: "Работник (цех)" },
  { value: "CUSTOMER", label: "Заказчик" },
];

function roleLabel(role: UserRole): string {
  return roleOptions.find((r) => r.value === role)?.label ?? role;
}

const createSchema = z
  .object({
    email: z.string().email("Некорректный email"),
    password: z.string().min(8, "Не короче 8 символов"),
    role: z.enum(["ADMIN", "WORKER", "CUSTOMER"]),
    customerId: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "CUSTOMER" && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите организацию",
        path: ["customerId"],
      });
    }
  });

type CreateForm = z.infer<typeof createSchema>;

const editSchema = z
  .object({
    email: z.string().email("Некорректный email"),
    password: z.string().optional(),
    role: z.enum(["ADMIN", "WORKER", "CUSTOMER"]),
    customerId: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "CUSTOMER" && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите организацию",
        path: ["customerId"],
      });
    }
    if (data.password && data.password.length > 0 && data.password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Не короче 8 символов",
        path: ["password"],
      });
    }
  });

type EditForm = z.infer<typeof editSchema>;

export function UsersPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: usersList,
    enabled: me.data?.user.role === "ADMIN",
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: customersList,
    enabled: me.data?.user.role === "ADMIN",
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListDto | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserListDto | null>(null);

  const customerSelectData = useMemo(
    () => (customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name })),
    [customers.data],
  );

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "WORKER",
      customerId: null,
    },
  });

  const createRole = createForm.watch("role");
  useEffect(() => {
    if (createRole !== "CUSTOMER") {
      createForm.setValue("customerId", null);
    }
  }, [createRole, createForm]);

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "WORKER",
      customerId: null,
    },
  });

  const editRole = editForm.watch("role");
  useEffect(() => {
    if (editRole !== "CUSTOMER") {
      editForm.setValue("customerId", null);
    }
  }, [editRole, editForm]);

  useEffect(() => {
    if (editUser) {
      editForm.reset({
        email: editUser.email,
        password: "",
        role: editUser.role,
        customerId: editUser.customerId,
      });
    }
  }, [editUser, editForm]);

  const createMut = useMutation({
    mutationFn: userCreate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
      createForm.reset({ email: "", password: "", role: "WORKER", customerId: null });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof userUpdate>[1] }) => userUpdate(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      setEditUser(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: userDelete,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      setDeleteUser(null);
    },
  });

  if (me.isPending) {
    return <Text c="dimmed">Загрузка…</Text>;
  }
  if (me.isSuccess && me.data.user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  const myId = me.data?.user.id;

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={3}>Пользователи</Title>
        <Button onClick={() => setCreateOpen(true)}>Новый пользователь</Button>
      </Group>
      <Text c="dimmed" size="sm" mb="lg">
        Учётные записи и роли (BR §2.1). Заказчик привязывается к организации.
      </Text>

      {users.isPending ? <Text c="dimmed">Загрузка…</Text> : null}
      {users.isError ? (
        <Text c="red">{users.error instanceof Error ? users.error.message : "Ошибка"}</Text>
      ) : null}

      {users.data ? (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Email</Table.Th>
              <Table.Th>Роль</Table.Th>
              <Table.Th>Организация</Table.Th>
              <Table.Th style={{ width: 200 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.data.users.map((u) => (
              <Table.Tr key={u.id}>
                <Table.Td>{u.email}</Table.Td>
                <Table.Td>{roleLabel(u.role)}</Table.Td>
                <Table.Td>{u.customer?.name ?? "—"}</Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end">
                    <Button size="xs" variant="light" onClick={() => setEditUser(u)}>
                      Изменить
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      disabled={u.id === myId}
                      onClick={() => setDeleteUser(u)}
                    >
                      Удалить
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : null}

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Новый пользователь">
        <form
          onSubmit={createForm.handleSubmit((v) =>
            createMut.mutate({
              email: v.email.trim(),
              password: v.password,
              role: v.role,
              customerId: v.role === "CUSTOMER" ? v.customerId! : null,
            }),
          )}
        >
          <Stack>
            <TextInput label="Email" {...createForm.register("email")} error={createForm.formState.errors.email?.message} />
            <PasswordInput
              label="Пароль"
              {...createForm.register("password")}
              error={createForm.formState.errors.password?.message}
            />
            <Controller
              name="role"
              control={createForm.control}
              render={({ field }) => (
                <Select label="Роль" data={roleOptions} value={field.value} onChange={(val) => field.onChange(val as UserRole)} />
              )}
            />
            {createRole === "CUSTOMER" ? (
              <Controller
                name="customerId"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <Select
                    label="Организация"
                    placeholder="Выберите"
                    data={customerSelectData}
                    value={field.value}
                    onChange={field.onChange}
                    searchable
                    error={fieldState.error?.message}
                  />
                )}
              />
            ) : null}
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

      <Modal opened={!!editUser} onClose={() => setEditUser(null)} title="Пользователь">
        <form
          onSubmit={editForm.handleSubmit((v) => {
            if (!editUser) return;
            const body: Parameters<typeof userUpdate>[1] = {
              email: v.email.trim(),
              role: v.role,
              customerId: v.role === "CUSTOMER" ? v.customerId! : null,
            };
            if (v.password?.trim()) {
              body.password = v.password;
            }
            updateMut.mutate({ id: editUser.id, body });
          })}
        >
          <Stack>
            <TextInput label="Email" {...editForm.register("email")} error={editForm.formState.errors.email?.message} />
            <PasswordInput
              label="Новый пароль"
              description="Оставьте пустым, чтобы не менять"
              {...editForm.register("password")}
              error={editForm.formState.errors.password?.message}
            />
            <Controller
              name="role"
              control={editForm.control}
              render={({ field }) => (
                <Select label="Роль" data={roleOptions} value={field.value} onChange={(val) => field.onChange(val as UserRole)} />
              )}
            />
            {editRole === "CUSTOMER" ? (
              <Controller
                name="customerId"
                control={editForm.control}
                render={({ field, fieldState }) => (
                  <Select
                    label="Организация"
                    placeholder="Выберите"
                    data={customerSelectData}
                    value={field.value}
                    onChange={field.onChange}
                    searchable
                    error={fieldState.error?.message}
                  />
                )}
              />
            ) : null}
            {updateMut.isError ? (
              <Text c="red" size="sm">
                {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button variant="default" type="button" onClick={() => setEditUser(null)}>
                Отмена
              </Button>
              <Button type="submit" loading={updateMut.isPending}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!deleteUser} onClose={() => setDeleteUser(null)} title="Удалить пользователя?">
        <Stack>
          <Text size="sm">
            Удалить <strong>{deleteUser?.email}</strong>? Действие необратимо.
          </Text>
          {deleteMut.isError ? (
            <Text c="red" size="sm">
              {deleteMut.error instanceof Error ? deleteMut.error.message : "Ошибка"}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteUser(null)}>
              Отмена
            </Button>
            <Button
              color="red"
              loading={deleteMut.isPending}
              onClick={() => {
                if (deleteUser) deleteMut.mutate(deleteUser.id);
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
