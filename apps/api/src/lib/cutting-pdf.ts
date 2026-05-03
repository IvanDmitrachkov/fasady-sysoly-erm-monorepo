import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import type { CuttingPlan } from "./cutting-layout.js";

const MM_TO_PT = 72 / 25.4;
const PDF_FONT_NAME = "UnicodeRegular";
const UNICODE_FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/Library/Fonts/Arial.ttf",
  "C:/Windows/Fonts/arial.ttf",
] as const;

const CYRILLIC_ASCII: Record<string, string> = {
  А: "A",
  Б: "B",
  В: "V",
  Г: "G",
  Д: "D",
  Е: "E",
  Ё: "E",
  Ж: "Zh",
  З: "Z",
  И: "I",
  Й: "Y",
  К: "K",
  Л: "L",
  М: "M",
  Н: "N",
  О: "O",
  П: "P",
  Р: "R",
  С: "S",
  Т: "T",
  У: "U",
  Ф: "F",
  Х: "Kh",
  Ц: "Ts",
  Ч: "Ch",
  Ш: "Sh",
  Щ: "Sch",
  Ъ: "",
  Ы: "Y",
  Ь: "",
  Э: "E",
  Ю: "Yu",
  Я: "Ya",
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function registerUnicodeFont(doc: PDFKit.PDFDocument): boolean {
  for (const path of UNICODE_FONT_CANDIDATES) {
    if (!existsSync(path)) continue;
    try {
      doc.registerFont(PDF_FONT_NAME, path);
      doc.font(PDF_FONT_NAME);
      return true;
    } catch {
      // Try the next common system font; PDFKit cannot embed every container format.
    }
  }
  return false;
}

function pdfText(text: string, hasUnicodeFont: boolean) {
  if (hasUnicodeFont) return text;
  return text
    .replace(/[А-Яа-яЁё]/g, (char) => CYRILLIC_ASCII[char] ?? char)
    .replace(/×/g, "x")
    .replace(/·/g, "-")
    .replace(/•/g, "-")
    .replace(/…/g, "...");
}

function placementLabelText(label: string, widthMm: number, heightMm: number, rotated: boolean) {
  return `${label}\n${widthMm}×${heightMm} мм${rotated ? "\nповернуто" : ""}`;
}

export function cuttingPlanToPdfBuffer(plan: CuttingPlan): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const hasUnicodeFont = registerUnicodeFont(doc);

    let anyPage = false;

    for (const group of plan.groups) {
      for (const sheet of group.sheets) {
        anyPage = true;
        doc.addPage({ size: "A4", layout: "landscape" });
        const marginX = 40;
        const marginY = 48;
        const titleY = 28;
        doc
          .fontSize(11)
          .text(
            pdfText(
              `Раскрой · Заказ ${plan.orderNumberFormatted} · ${plan.material} ${group.thicknessMm} мм · лист ${sheet.sheetIndex}`,
              hasUnicodeFont,
            ),
            marginX,
            titleY,
            { width: doc.page.width - 2 * marginX },
          );

        const drawW = doc.page.width - 2 * marginX;
        const drawH = doc.page.height - marginY - 36;
        const scale = Math.min(drawW / (sheet.widthMm * MM_TO_PT), drawH / (sheet.heightMm * MM_TO_PT));
        const sc = (mm: number) => mm * MM_TO_PT * scale;
        const ox = marginX;
        const oy = marginY;

        doc.lineWidth(0.8).rect(ox, oy, sc(sheet.widthMm), sc(sheet.heightMm)).stroke();

        for (const p of sheet.placements) {
          const px = ox + sc(p.xMm);
          const py = oy + sc(p.yMm);
          doc.lineWidth(0.4).rect(px, py, sc(p.widthMm), sc(p.heightMm)).stroke();
          doc
            .fontSize(7)
            .fillColor("#222")
            .text(pdfText(placementLabelText(p.label, p.widthMm, p.heightMm, p.rotated), hasUnicodeFont), px + 2, py + 2, {
              width: sc(p.widthMm) - 4,
              height: sc(p.heightMm) - 4,
              ellipsis: true,
            });
          doc.fillColor("#000");
        }
      }

      if (group.overflow.length > 0) {
        anyPage = true;
        doc.addPage({ size: "A4", layout: "landscape" });
        doc.fontSize(12).text(pdfText(`Не размещено на листе · ${group.thicknessMm} мм`, hasUnicodeFont), 40, 36);
        doc.moveDown(0.5);
        doc.fontSize(9);
        for (const o of group.overflow) {
          doc.text(pdfText(`• ${o.label} (${o.facadeId.slice(0, 8)}…): ${o.reason}`, hasUnicodeFont), { indent: 8 });
        }
      }
    }

    if (!anyPage) {
      doc.addPage({ size: "A4", layout: "landscape" });
      doc.fontSize(12).text(pdfText("Нет позиций для раскроя", hasUnicodeFont), 40, 40);
    }

    doc.end();
  });
}
