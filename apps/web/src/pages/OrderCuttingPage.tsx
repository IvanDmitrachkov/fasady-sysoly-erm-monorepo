import { useQuery } from "@tanstack/react-query";
import { Button, Group, Paper, Stack, Table, Text, Title } from "@mantine/core";
import { Link, Navigate, useParams } from "react-router-dom";
import { meRequest } from "../api/auth";
import { cuttingPdfPath, cuttingPlanGet, type CuttingSheetDto } from "../api/cutting";
import { apiBlob } from "../api/http";
import { orderPrintXlsxPath } from "../api/orders";

function SheetSvg({ sheet }: { sheet: CuttingSheetDto }) {
  const w = sheet.widthMm;
  const h = sheet.heightMm;
  const vb = `0 0 ${w} ${h}`;
  return (
    <svg viewBox={vb} style={{ width: "100%", maxWidth: 720, height: "auto", border: "1px solid var(--mantine-color-gray-4)" }}>
      <rect x={0} y={0} width={w} height={h} fill="#faf8f5" stroke="#bbb" strokeWidth={w * 0.0015} />
      {sheet.placements.map((p) => (
        <g key={`${p.facadeId}-${p.xMm}-${p.yMm}`}>
          <rect
            x={p.xMm}
            y={p.yMm}
            width={p.widthMm}
            height={p.heightMm}
            fill="#e3f2fd"
            stroke="#1976d2"
            strokeWidth={Math.max(w, h) * 0.0008}
          />
          <text
            x={p.xMm + p.widthMm * 0.04}
            y={p.yMm + p.heightMm * 0.12}
            fontSize={Math.min(p.widthMm, p.heightMm) * 0.09}
            fill="#0d47a1"
          >
            {p.label}
            {p.rotated ? " ↻" : ""}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function OrderCuttingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const me = useQuery({ queryKey: ["me"], queryFn: meRequest });
  const plan = useQuery({
    queryKey: ["cutting", orderId],
    queryFn: () => cuttingPlanGet(orderId!),
    enabled: !!orderId && (me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER"),
  });

  const canUse = me.data?.user.role === "ADMIN" || me.data?.user.role === "WORKER";

  if (!orderId) {
    return <Text>Некорректная ссылка</Text>;
  }

  if (me.isPending) {
    return <Text c="dimmed">Загрузка…</Text>;
  }

  if (!canUse) {
    return <Navigate to={`/orders/${orderId}`} replace />;
  }

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Button component={Link} to={`/orders/${orderId}`} variant="subtle">
          ← К заказу
        </Button>
        <Group gap="xs">
          <Button
            variant="filled"
            loading={plan.isFetching}
            onClick={async () => {
              const blob = await apiBlob(cuttingPdfPath(orderId));
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `raskroy_${plan.data?.orderNumberFormatted?.replace(/\s/g, "_") ?? orderId}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={!plan.data}
          >
            Скачать PDF
          </Button>
          <Button
            variant="light"
            onClick={async () => {
              const blob = await apiBlob(orderPrintXlsxPath(orderId));
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `zakaz_${plan.data?.orderNumberFormatted?.replace(/\s/g, "_") ?? orderId}.xlsx`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Печать заказа
          </Button>
        </Group>
      </Group>

      <Title order={2} mb="xs">
        Раскрой
      </Title>
      <Text c="dimmed" size="sm" mb="lg">
        Расчёт по листу {plan.data ? `${plan.data.sheetSize.widthMm}×${plan.data.sheetSize.heightMm} мм` : "…"} · группы по
        толщине (MVP: {plan.data?.material ?? "MDF"}). Не сохраняется на сервере.
      </Text>

      {plan.isPending ? <Text c="dimmed">Считаем раскрой…</Text> : null}
      {plan.isError ? (
        <Text c="red">{plan.error instanceof Error ? plan.error.message : "Ошибка"}</Text>
      ) : null}

      {plan.data ? (
        <Stack gap="xl">
          {plan.data.groups.map((g) => (
            <Paper key={g.thicknessMm} withBorder p="md" radius="md">
              <Title order={4} mb="sm">
                {g.material} · {g.thicknessMm} мм
              </Title>
              {g.sheets.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Нет размещённых деталей
                </Text>
              ) : (
                <Stack gap="md">
                  {g.sheets.map((s) => (
                    <div key={s.sheetIndex}>
                      <Text size="sm" fw={600} mb={6}>
                        Лист {s.sheetIndex}
                      </Text>
                      <SheetSvg sheet={s} />
                    </div>
                  ))}
                </Stack>
              )}
              {g.overflow.length > 0 ? (
                <>
                  <Text size="sm" fw={600} mt="md" c="orange">
                    Не поместились на лист
                  </Text>
                  <Table striped withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Позиция</Table.Th>
                        <Table.Th>Причина</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {g.overflow.map((o) => (
                        <Table.Tr key={o.facadeId}>
                          <Table.Td>{o.label}</Table.Td>
                          <Table.Td>{o.reason}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </>
              ) : null}
            </Paper>
          ))}
        </Stack>
      ) : null}
    </>
  );
}
