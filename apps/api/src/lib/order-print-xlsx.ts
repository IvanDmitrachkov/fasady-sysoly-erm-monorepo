import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { formatOrderNumber } from "./order-number.js";

const TEMPLATE_FILE_EMAL = "zakaz-naryad-emal.xlsx";
const TEMPLATE_FILE_PLENKA = "zakaz-naryad-plenka.xlsx";
const TEMPLATE_FILE_LEGACY = "blank_zakaza_fasadov_emal.xlsx";

const orderIncludeForPrint = {
  customer: true,
  currentStage: true,
  facades: {
    orderBy: { sortIndex: "asc" as const },
    include: { coatingType: true },
  },
  materialEntries: {
    orderBy: { usedAt: "asc" as const },
  },
} as const;

export type OrderForPrint = Prisma.OrderGetPayload<{ include: typeof orderIncludeForPrint }>;

export { orderIncludeForPrint };

function resolveTemplatePath(templateFile: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "../templates", templateFile),
    path.join(process.cwd(), "templates", templateFile),
    path.join(process.cwd(), "apps/api/templates", templateFile),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `Не найден шаблон печати ${templateFile}. Ожидается apps/api/templates/ или dist/templates/ после сборки.`,
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

function pickTemplateByWorkType(workType: string | null | undefined): string {
  const normalized = (workType ?? "").toLowerCase();
  if (normalized.includes("плен")) return TEMPLATE_FILE_PLENKA;
  if (normalized.includes("эмал")) return TEMPLATE_FILE_EMAL;
  return TEMPLATE_FILE_EMAL;
}

function detectLinesRange(ws: ExcelJS.Worksheet): { first: number; last: number } {
  // Шаблоны: старый (9..52) и новые (8..31).
  const header7 = String(ws.getCell("A7").value ?? "").toLowerCase();
  if (header7.includes("№")) return { first: 8, last: 31 };
  return { first: 9, last: 52 };
}

function clearMaterialsSection(ws: ExcelJS.Worksheet): { byLabel: Map<string, number>; otherRow: number | null } {
  let headerRow: number | null = null;
  for (let r = 1; r <= 120; r++) {
    const v = String(ws.getCell(`A${r}`).value ?? "").trim().toLowerCase();
    if (v === "материал") {
      headerRow = r;
      break;
    }
  }
  if (!headerRow) return { byLabel: new Map(), otherRow: null };
  const byLabel = new Map<string, number>();
  let otherRow: number | null = null;
  for (let r = headerRow + 1; r <= headerRow + 20; r++) {
    const label = String(ws.getCell(`A${r}`).value ?? "").trim();
    if (!label) break;
    if (label.toLowerCase().startsWith("подготовка")) break;
    ws.getCell(`D${r}`).value = null;
    ws.getCell(`H${r}`).value = null;
    byLabel.set(label.toLowerCase(), r);
    if (label.trim().toLowerCase() === "прочее") otherRow = r;
  }
  return { byLabel, otherRow };
}

function formatQuantity(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

function fillMaterialsSection(ws: ExcelJS.Worksheet, materials: OrderForPrint["materialEntries"]): void {
  const section = clearMaterialsSection(ws);
  if (section.byLabel.size === 0 || materials.length === 0) return;
  const sortedMaterials = [...materials].sort((a, b) => {
    const diff = a.usedAt.getTime() - b.usedAt.getTime();
    if (diff !== 0) return diff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  const grouped = new Map<string, { qty: number; units: Set<string> }>();
  for (const m of sortedMaterials) {
    const key = m.name.trim().toLowerCase();
    const prev = grouped.get(key) ?? { qty: 0, units: new Set<string>() };
    prev.qty += m.quantity;
    if (m.unit.trim()) prev.units.add(m.unit.trim());
    grouped.set(key, prev);
  }
  const otherBucket: { name: string; qty: number; units: Set<string> }[] = [];
  for (const [name, g] of grouped.entries()) {
    let matchedRow: number | null = null;
    for (const [label, row] of section.byLabel.entries()) {
      if (label === "прочее") continue;
      if (name.includes(label) || label.includes(name)) {
        matchedRow = row;
        break;
      }
    }
    if (matchedRow) {
      ws.getCell(`D${matchedRow}`).value = [...g.units].join(", ");
      ws.getCell(`H${matchedRow}`).value = formatQuantity(g.qty);
    } else {
      otherBucket.push({ name, qty: g.qty, units: g.units });
    }
  }
  if (section.otherRow && otherBucket.length > 0) {
    const names = otherBucket.map((x) => x.name).join(", ");
    const qty = otherBucket.reduce((s, x) => s + x.qty, 0);
    const units = [...new Set(otherBucket.flatMap((x) => [...x.units]))].join(", ");
    ws.getCell(`D${section.otherRow}`).value = [names, units].filter(Boolean).join(" | ");
    ws.getCell(`H${section.otherRow}`).value = formatQuantity(qty);
  }
}

/** Заполняет бланк `blank_zakaza_fasadov_emal.xlsx` (лист 1): шапка + строки позиций; колонка J с формулами площади не трогаем. */
export async function buildOrderPrintXlsxBuffer(order: OrderForPrint): Promise<Buffer> {
  const templatePath = resolveTemplatePath(pickTemplateByWorkType(order.workType));
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
  ws.getCell("G4").value = order.deliveryAddress?.trim() ?? "";
  ws.getCell("C5").value = order.workType?.trim() ?? "";

  const lines = detectLinesRange(ws);
  const sorted = [...order.facades].sort((a, b) => a.sortIndex - b.sortIndex);
  if (sorted.length > lines.last - lines.first + 1) {
    throw new Error(`В бланке не больше ${lines.last - lines.first + 1} строк; в заказе ${sorted.length} позиций`);
  }

  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i]!;
    const r = lines.first + i;
    ws.getCell(`A${r}`).value = i + 1;
    ws.getCell(`B${r}`).value = f.heightMm;
    ws.getCell(`C${r}`).value = f.widthMm;
    ws.getCell(`D${r}`).value = f.quantity ?? 1;
    ws.getCell(`E${r}`).value = f.thicknessMm;
    ws.getCell(`F${r}`).value = f.edgeRadius != null && f.edgeRadius > 0 ? f.edgeRadius : "";
    ws.getCell(`G${r}`).value = handleCellText(f);
    ws.getCell(`H${r}`).value = millingCoatingText(f);
    ws.getCell(`I${r}`).value = f.color ?? "";
  }

  for (let r = lines.first + sorted.length; r <= lines.last; r++) {
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
  fillMaterialsSection(ws, order.materialEntries);

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
