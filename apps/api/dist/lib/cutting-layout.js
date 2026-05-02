/** Лист MDF (мм), типовой для цеха. */
export const CUTTING_SHEET_MM = { widthMm: 2800, heightMm: 2070 };
export const CUTTING_MATERIAL_MVP = "MDF";
const MARGIN_MM = 8;
const KERF_MM = 2;
function toItem(f) {
    const w = f.widthMm;
    const h = f.heightMm;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
        return null;
    return {
        id: f.id,
        sortIndex: f.sortIndex,
        label: `Поз. ${f.sortIndex + 1}`,
        w,
        h,
    };
}
function orientationsForSheet(it, innerW, innerH) {
    const out = [];
    if (it.w <= innerW && it.h <= innerH)
        out.push({ w: it.w, h: it.h, rot: false });
    if (it.h <= innerW && it.w <= innerH && (it.w !== it.h || out.length === 0)) {
        if (!(it.w === it.h && out.some((o) => o.w === it.w && o.h === it.h))) {
            out.push({ w: it.h, h: it.w, rot: true });
        }
    }
    return out;
}
/** Полки слева направо, перенос строки, новый лист. Без оптимизации остатков (MVP). */
function packShelf(items) {
    const overflow = [];
    const sheets = [];
    const SW = CUTTING_SHEET_MM.widthMm;
    const SH = CUTTING_SHEET_MM.heightMm;
    const M = MARGIN_MM;
    const K = KERF_MM;
    const innerW = SW - 2 * M;
    const innerH = SH - 2 * M;
    const sorted = [...items].sort((a, b) => b.w * b.h - a.w * a.h);
    let placements = [];
    let x = M;
    let y = M;
    let rowH = 0;
    const emitSheet = () => {
        if (placements.length === 0)
            return;
        sheets.push({
            sheetIndex: sheets.length + 1,
            widthMm: SW,
            heightMm: SH,
            placements: [...placements],
        });
        placements = [];
        x = M;
        y = M;
        rowH = 0;
    };
    outer: for (const it of sorted) {
        const oris = orientationsForSheet(it, innerW, innerH);
        if (oris.length === 0) {
            overflow.push({
                facadeId: it.id,
                sortIndex: it.sortIndex,
                label: it.label,
                reason: "Деталь больше полезного поля листа",
            });
            continue;
        }
        for (;;) {
            let chosen = null;
            for (const o of oris) {
                if (x + o.w <= M + innerW && y + o.h <= M + innerH) {
                    chosen = o;
                    break;
                }
            }
            if (chosen) {
                placements.push({
                    facadeId: it.id,
                    label: it.label,
                    xMm: x,
                    yMm: y,
                    widthMm: chosen.w,
                    heightMm: chosen.h,
                    rotated: chosen.rot,
                });
                x += chosen.w + K;
                rowH = Math.max(rowH, chosen.h);
                continue outer;
            }
            const minOh = Math.min(...oris.map((o) => o.h));
            const ny = y + rowH + K;
            if (ny + minOh <= M + innerH) {
                y = ny;
                x = M;
                rowH = 0;
                continue;
            }
            emitSheet();
        }
    }
    emitSheet();
    return { sheets, overflow };
}
export function computeCuttingPlan(input) {
    const byThickness = new Map();
    for (const f of input.facades) {
        const t = f.thicknessMm;
        const list = byThickness.get(t) ?? [];
        list.push(f);
        byThickness.set(t, list);
    }
    const groups = [];
    const entries = [...byThickness.entries()].sort((a, b) => a[0] - b[0]);
    for (const [thicknessMm, facades] of entries) {
        const items = [];
        const parseOverflow = [];
        for (const f of facades) {
            const p = toItem(f);
            if (!p) {
                parseOverflow.push({
                    facadeId: f.id,
                    sortIndex: f.sortIndex,
                    label: `Поз. ${f.sortIndex + 1}`,
                    reason: "Некорректные ширина или высота (мм)",
                });
            }
            else {
                items.push(p);
            }
        }
        const packed = packShelf(items);
        groups.push({
            material: CUTTING_MATERIAL_MVP,
            thicknessMm,
            sheets: packed.sheets,
            overflow: [...parseOverflow, ...packed.overflow],
        });
    }
    return {
        orderId: input.orderId,
        orderNumberFormatted: input.orderNumberFormatted,
        material: CUTTING_MATERIAL_MVP,
        sheetSize: { widthMm: CUTTING_SHEET_MM.widthMm, heightMm: CUTTING_SHEET_MM.heightMm },
        groups,
    };
}
//# sourceMappingURL=cutting-layout.js.map