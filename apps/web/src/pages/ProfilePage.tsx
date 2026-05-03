import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge, Button, Card, Group, PasswordInput, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDeviceFloppy, IconUserCircle } from "@tabler/icons-react";
import { z } from "zod";
import { meRequest, profileUpdate } from "../api/auth";
import { userDisplayName } from "../lib/user-display-name";

const profileSchema = z
  .object({
    email: z.string().email("Некорректный email"),
    firstName: z.string().max(120).optional(),
    lastName: z.string().max(120).optional(),
    patronymic: z.string().max(120).optional(),
    currentPassword: z.string().optional(),
    password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password && data.password.length > 0 && data.password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Не короче 8 символов",
        path: ["password"],
      });
    }
    if (data.password && !data.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Введите текущий пароль",
        path: ["currentPassword"],
      });
    }
  });

type ProfileForm = z.infer<typeof profileSchema>;

function roleLabel(role: string): string {
  if (role === "ADMIN") return "Администратор";
  if (role === "WORKER") return "Работник";
  if (role === "CUSTOMER") return "Заказчик";
  return role;
}

export function ProfilePage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      patronymic: "",
      currentPassword: "",
      password: "",
    },
  });

  useEffect(() => {
    if (me.data?.user) {
      form.reset({
        email: me.data.user.email,
        firstName: me.data.user.firstName ?? "",
        lastName: me.data.user.lastName ?? "",
        patronymic: me.data.user.patronymic ?? "",
        currentPassword: "",
        password: "",
      });
    }
  }, [form, me.data]);

  const updateMut = useMutation({
    mutationFn: profileUpdate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      form.reset({ ...form.getValues(), currentPassword: "", password: "" });
      notifications.show({ color: "green", message: "Профиль сохранён" });
    },
  });

  if (me.isPending) {
    return <Text c="dimmed">Загрузка…</Text>;
  }
  if (me.isError) {
    return <Text c="red">{me.error instanceof Error ? me.error.message : "Ошибка"}</Text>;
  }

  const user = me.data.user;

  return (
    <Stack gap="lg" maw={780}>
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="xs">
            <IconUserCircle size={28} stroke={1.5} />
            <Title order={3}>Профиль</Title>
          </Group>
          <Text c="dimmed" size="sm">
            Управляйте своим именем, email и паролем для входа.
          </Text>
        </Stack>
        <Badge variant="light" size="lg">
          {roleLabel(user.role)}
        </Badge>
      </Group>

      <Card withBorder radius="md" p="lg">
        <Stack gap={4} mb="lg">
          <Text fw={600}>{userDisplayName(user)}</Text>
          <Text size="sm" c="dimmed">
            {user.email}
          </Text>
        </Stack>

        <form
          onSubmit={form.handleSubmit((v) => {
            const body: Parameters<typeof profileUpdate>[0] = {
              email: v.email.trim(),
              firstName: v.firstName?.trim() || null,
              lastName: v.lastName?.trim() || null,
              patronymic: v.patronymic?.trim() || null,
            };
            if (v.password?.trim()) {
              body.currentPassword = v.currentPassword;
              body.password = v.password;
            }
            updateMut.mutate(body);
          })}
        >
          <Stack>
            <TextInput label="Email" {...form.register("email")} error={form.formState.errors.email?.message} />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput label="Имя" {...form.register("firstName")} error={form.formState.errors.firstName?.message} />
              <TextInput label="Отчество" {...form.register("patronymic")} error={form.formState.errors.patronymic?.message} />
              <TextInput label="Фамилия" {...form.register("lastName")} error={form.formState.errors.lastName?.message} />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <PasswordInput
                label="Текущий пароль"
                description="Нужен только для смены пароля"
                {...form.register("currentPassword")}
                error={form.formState.errors.currentPassword?.message}
              />
              <PasswordInput
                label="Новый пароль"
                description="Оставьте пустым, чтобы не менять"
                {...form.register("password")}
                error={form.formState.errors.password?.message}
              />
            </SimpleGrid>
            {updateMut.isError ? (
              <Text c="red" size="sm">
                {updateMut.error instanceof Error ? updateMut.error.message : "Ошибка"}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button type="submit" loading={updateMut.isPending} leftSection={<IconDeviceFloppy size={18} />}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
