import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { formatOrderNumber } from "./order-number.js";

const TEMPLATE_FILE = "blank_zakaza_fasadov_emal.xlsx";

const orderIncludeForPrint = {
  customer: true,
  currentStage: true,
  facades: {
    orderBy: { sortIndex: "asc" as const },
    include: { coatingType: true },
  },
} as const;

export type OrderForPrint = Prisma.OrderGetPayload<{ include: typeof orderIncludeForPrint }>;

export { orderIncludeForPrint };

function resolveTemplatePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "../templates", TEMPLATE_FILE),
    path.join(process.cwd(), "templates", TEMPLATE_FILE),
    path.join(process.cwd(), "apps/api/templates", TEMPLATE_FILE),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `Не найден шаблон печати ${TEMPLATE_FILE}. Ожидается apps/api/templates/ или dist/templates/ после сборки.`,
  );
}

function formatDateRu(d: Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function handleCellText(f: OrderForPrint["facades"][number]): string {
  const hl = f.handleLabel?.trim() ?? "";
  if (hl && f.handleLengthMm != null && f.handleLengthMm > 0) {
    return `${hl}, ${f.handleLengthMm} мм`;
  }
  if (hl) {
    return hl;
  }
  return "нет";
}

function millingCoatingText(f: OrderForPrint["facades"][number]): string {
  const parts = [f.millingLabel.trim() || "—"];
  if (f.coatingType.slug !== "none") {
    parts.push(f.coatingType.name);
  }
  return parts.join(" / ");
}

const FIRST_LINE_ROW = 9;
const LAST_LINE_ROW = 52;

/** Заполняет бланк `blank_zakaza_fasadov_emal.xlsx` (лист 1): шапка + строки позиций; колонка J с формулами площади не трогаем. */
export async function buildOrderPrintXlsxBuffer(order: OrderForPrint): Promise<Buffer> {
  const templatePath = resolveTemplatePath();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error("В шаблоне нет листов");
  }

  const numFormatted = formatOrderNumber(order.orderNumber);

  ws.getCell("C2").value = numFormatted;
  ws.getCell("G2").value = order.customer.name;
  ws.getCell("C3").value = formatDateRu(order.createdAt);
  ws.getCell("G3").value = order.customer.phone ?? "";
  ws.getCell("C4").value = formatDateRu(order.deadlineAt);
  ws.getCell("G4").value = order.comment?.trim() ?? "";

  const sorted = [...order.facades].sort((a, b) => a.sortIndex - b.sortIndex);
  if (sorted.length > LAST_LINE_ROW - FIRST_LINE_ROW + 1) {
    throw new Error(`В бланке не больше ${LAST_LINE_ROW - FIRST_LINE_ROW + 1} строк; в заказе ${sorted.length} позиций`);
  }

  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i]!;
    const r = FIRST_LINE_ROW + i;
    ws.getCell(`A${r}`).value = i + 1;
    ws.getCell(`B${r}`).value = f.heightMm;
    ws.getCell(`C${r}`).value = f.widthMm;
    ws.getCell(`D${r}`).value = 1;
    ws.getCell(`E${r}`).value = f.thicknessMm;
    ws.getCell(`F${r}`).value = f.edgeRadius != null && f.edgeRadius > 0 ? f.edgeRadius : "";
    ws.getCell(`G${r}`).value = handleCellText(f);
    ws.getCell(`H${r}`).value = millingCoatingText(f);
    ws.getCell(`I${r}`).value = f.color ?? "";
  }

  for (let r = FIRST_LINE_ROW + sorted.length; r <= LAST_LINE_ROW; r++) {
    ws.getCell(`A${r}`).value = null;
    ws.getCell(`B${r}`).value = null;
    ws.getCell(`C${r}`).value = null;
    ws.getCell(`D${r}`).value = null;
    ws.getCell(`E${r}`).value = null;
    ws.getCell(`F${r}`).value = null;
    ws.getCell(`G${r}`).value = null;
    ws.getCell(`H${r}`).value = null;
    ws.getCell(`I${r}`).value = null;
  }

  // Итоговые поля (колонка J)
  ws.getCell("J53").value = order.facadeAreaTotal ?? 0;
  ws.getCell("J54").value = order.facadePricePerM2 ?? 0;
  ws.getCell("J57").value = order.millingCostTotal ?? 0;
  ws.getCell("J58").value = order.handlePricePerMeter ?? 0;
  ws.getCell("J59").value = order.handleLengthTotalMm != null ? order.handleLengthTotalMm / 1000 : 0;
  ws.getCell("J60").value = order.otherServicesPrice ?? 0;
  ws.getCell("J62").value = order.discount ?? 0;
  ws.getCell("J64").value = order.advance ?? 0;
  ws.getCell("J66").value = order.facadeCount ?? 0;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
