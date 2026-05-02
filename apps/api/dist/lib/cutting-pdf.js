import PDFDocument from "pdfkit";
const MM_TO_PT = 72 / 25.4;
export function cuttingPlanToPdfBuffer(plan) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ autoFirstPage: false, margin: 36 });
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
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
                    .text(`Раскрой · Заказ ${plan.orderNumberFormatted} · ${plan.material} ${group.thicknessMm} мм · лист ${sheet.sheetIndex}`, marginX, titleY, { width: doc.page.width - 2 * marginX });
                const drawW = doc.page.width - 2 * marginX;
                const drawH = doc.page.height - marginY - 72;
                const scale = Math.min(drawW / (sheet.widthMm * MM_TO_PT), drawH / (sheet.heightMm * MM_TO_PT));
                const sc = (mm) => mm * MM_TO_PT * scale;
                const ox = marginX;
                const oy = marginY;
                doc.lineWidth(0.8).rect(ox, oy, sc(sheet.widthMm), sc(sheet.heightMm)).stroke();
                for (const p of sheet.placements) {
                    const px = ox + sc(p.xMm);
                    const py = oy + sc(p.yMm);
                    doc.lineWidth(0.4).rect(px, py, sc(p.widthMm), sc(p.heightMm)).stroke();
                    doc.fontSize(7).fillColor("#222").text(p.label + (p.rotated ? " (пов.)" : ""), px + 2, py + 2, {
                        width: sc(p.widthMm) - 4,
                        height: sc(p.heightMm) - 4,
                        ellipsis: true,
                    });
                    doc.fillColor("#000");
                }
                doc.fontSize(8).fillColor("#666").text(`Лист ${sheet.widthMm}×${sheet.heightMm} мм (чертёж в масштабе для просмотра)`, marginX, doc.page.height - 36);
                doc.fillColor("#000");
            }
            if (group.overflow.length > 0) {
                anyPage = true;
                doc.addPage({ size: "A4", layout: "landscape" });
                doc.fontSize(12).text(`Не размещено на листе · ${group.thicknessMm} мм`, 40, 36);
                doc.moveDown(0.5);
                doc.fontSize(9);
                for (const o of group.overflow) {
                    doc.text(`• ${o.label} (${o.facadeId.slice(0, 8)}…): ${o.reason}`, { indent: 8 });
                }
            }
        }
        if (!anyPage) {
            doc.addPage({ size: "A4", layout: "landscape" });
            doc.fontSize(12).text("Нет позиций для раскроя", 40, 40);
        }
        doc.end();
    });
}
//# sourceMappingURL=cutting-pdf.js.map