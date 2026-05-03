import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { meRequest } from "../api/auth";
import { customersList } from "../api/customers";
import { coatingTypesList, handleTypesList, millingTypesList } from "../api/facade-types";
import { orderCreate } from "../api/orders";
import { OrderFormBody } from "../components/OrderFormBody";
import {
  buildOrderWritePayload,
  createOrderFormSchema,
  defaultsForNewFacadeRow,
  defaultFacadeRow,
  type CreateOrderFormValues,
} from "../lib/order-form";

export function OrderCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });

  const canCreate =
    me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";

  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: customersList,
    enabled: canCreate,
  });
  const millingTypes = useQuery({
    queryKey: ["milling-types"],
    queryFn: millingTypesList,
    enabled: canCreate,
  });
  const coatingTypes = useQuery({
    queryKey: ["coating-types"],
    queryFn: coatingTypesList,
    enabled: canCreate,
  });
  const handleTypes = useQuery({
    queryKey: ["handle-types"],
    queryFn: handleTypesList,
    enabled: canCreate,
  });

  const catalogsReady = !!(millingTypes.data && coatingTypes.data && handleTypes.data);

  const newRowDefaults = useMemo(() => {
    if (!millingTypes.data || !coatingTypes.data) return { millingLabel: "", coatingTypeId: "" };
    return defaultsForNewFacadeRow({
      millingTypes: millingTypes.data.millingTypes,
      coatingTypes: coatingTypes.data.coatingTypes,
    });
  }, [millingTypes.data, coatingTypes.data]);

  const millingCatalog = useMemo(
    () =>
      (millingTypes.data?.millingTypes ?? []).map((t) => ({
        name: t.name,
        pricePerM2: t.pricePerM2,
      })),
    [millingTypes.data],
  );
  const handleCatalog = useMemo(
    () =>
      (handleTypes.data?.handleTypes ?? []).map((t) => ({
        name: t.name,
        pricePerMeter: t.pricePerMeter,
      })),
    [handleTypes.data],
  );

  const coatingOptions = useMemo(
    () =>
      (coatingTypes.data?.coatingTypes ?? []).map((t) => ({
        value: t.id,
        label: `${t.name} (${t.pricePerM2.toLocaleString("ru-RU")} ₽/м²)`,
      })),
    [coatingTypes.data],
  );

  const customerOptions = useMemo(
    () => (customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name })),
    [customers.data],
  );

  const createForm = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: {
      customerId: "",
      deadlineAt: null,
      comment: "",
      facades: [defaultFacadeRow({ millingLabel: "", coatingTypeId: "" })],
    },
  });

  useEffect(() => {
    if (!millingTypes.data || !coatingTypes.data || !handleTypes.data) return;
    const defs = defaultsForNewFacadeRow({
      millingTypes: millingTypes.data.millingTypes,
      coatingTypes: coatingTypes.data.coatingTypes,
    });
    createForm.reset({
      customerId: "",
      deadlineAt: null,
      comment: "",
      facades: [defaultFacadeRow(defs)],
    });
  }, [millingTypes.data, coatingTypes.data, handleTypes.data, createForm]);

  const { fields, append, remove } = useFieldArray({
    control: createForm.control,
    name: "facades",
  });

  const createMut = useMutation({
    mutationFn: (v: CreateOrderFormValues) => {
      if (!catalogsReady) throw new Error("Справочники не загружены");
      return orderCreate(buildOrderWritePayload(v));
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void navigate(`/orders/${data.order.id}`, { replace: true });
    },
  });

  if (me.isPending) {
    return (
      <Container size="xl" py="md">
        <Text c="dimmed">Загрузка…</Text>
      </Container>
    );
  }

  if (!canCreate) {
    return <Navigate to="/orders" replace />;
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Title order={3}>Новый заказ</Title>
            <Text size="sm" c="dimmed" mt={4}>
              Заполните данные заказчика и позиции фасадов. После сохранения откроется карточка заказа.
            </Text>
          </div>
          <Button component={Link} to="/orders" variant="default">
            К списку заказов
          </Button>
        </Group>

        <form
          onSubmit={createForm.handleSubmit((v) => {
            createMut.mutate(v);
          })}
        >
          {!catalogsReady ? (
            <Text c="dimmed" size="sm">
              Загрузка справочников фрезеровки / покрытия / ручки…
            </Text>
          ) : (
            <OrderFormBody
              form={createForm}
              fields={fields}
              append={append}
              remove={remove}
              customerOptions={customerOptions}
              millingCatalog={millingCatalog}
              coatingOptions={coatingOptions}
              handleCatalog={handleCatalog}
              newRowDefaults={newRowDefaults}
              actions={
                <>
                  {createMut.isError ? (
                    <Text c="red" size="sm">
                      {createMut.error instanceof Error ? createMut.error.message : "Ошибка"}
                    </Text>
                  ) : null}
                  <Group justify="flex-end">
                    <Button type="button" variant="default" component={Link} to="/orders">
                      Отмена
                    </Button>
                    <Button type="submit" loading={createMut.isPending}>
                      Создать заказ
                    </Button>
                  </Group>
                </>
              }
            />
          )}
        </form>
      </Stack>
    </Container>
  );
}
