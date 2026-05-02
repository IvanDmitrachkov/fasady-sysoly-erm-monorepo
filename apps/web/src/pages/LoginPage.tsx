import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { loginRequest } from "../api/auth";
import { ACCESS_TOKEN_KEY } from "../api/http";
import { queryClient } from "../queryClient";

const schema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem(ACCESS_TOKEN_KEY)) {
      void navigate("/", { replace: true });
    }
  }, [navigate]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@example.com", password: "" },
  });

  const login = useMutation({
    mutationFn: (values: FormValues) => loginRequest(values.email, values.password),
    onSuccess: (data) => {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.token);
      void queryClient.invalidateQueries();
      void navigate("/", { replace: true });
    },
  });

  return (
    <Container size={420} my={80}>
      <Title ta="center" order={2}>
        ERM
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Фасады Сысолы — вход
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form
          onSubmit={form.handleSubmit((values) => {
            login.mutate(values);
          })}
        >
          <Stack>
            <TextInput label="Email" placeholder="admin@example.com" {...form.register("email")} error={form.formState.errors.email?.message} />
            <PasswordInput
              label="Пароль"
              {...form.register("password")}
              error={form.formState.errors.password?.message}
            />
            {login.isError ? (
              <Text c="red" size="sm">
                {login.error instanceof Error ? login.error.message : "Ошибка входа"}
              </Text>
            ) : null}
            <Button type="submit" loading={login.isPending} fullWidth>
              Войти
            </Button>
          </Stack>
        </form>
      </Paper>

      <Text c="dimmed" size="xs" ta="center" mt="lg">
        После <code>yarn db:seed</code>: admin@example.com / Admin123!
      </Text>
    </Container>
  );
}
