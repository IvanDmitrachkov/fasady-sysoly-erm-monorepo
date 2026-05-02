/** MVP-оценка базовой цены позиции (руб.), по ТЗ считается на клиенте. */

export type FacadePricingInput = {
  dimensionsMm: string;
  thicknessMm: number;
  integratedHandle: boolean;
  milling: string;
  coating: string;
  color: string;
  edgeRadius?: number | null;
  optionsExtra?: string | null;
};

/** Парсит «1200×800», «1200 x 800 мм», «1200х800» → площадь м². */
export function parseDimensionsToAreaM2(dimensionsMm: string): number {
  const normalized = dimensionsMm.replace(/мм/gi, "").replace(/×/g, "x").trim();
  const parts = normalized.split(/[xх]/i).map((s) => parseFloat(s.trim()));
  const nums = parts.filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length >= 2) {
    return (nums[0]! * nums[1]!) / 1_000_000;
  }
  if (nums.length === 1) {
    const a = nums[0]!;
    return (a * a) / 1_000_000;
  }
  return 0;
}

const BASE_PER_M2 = 12000;
const THICKNESS_REF_MM = 16;
const HANDLE_EXTRA = 1500;
const MILLING_PER_M2 = 2500;
const COATING_PER_M2 = 1800;
const COLOR_EXTRA = 400;
const EDGE_PER_MM_RADIUS = 35;
const OPTIONS_PER_CHAR = 12;

export function estimateFacadeBasePrice(input: FacadePricingInput): number {
  const area = parseDimensionsToAreaM2(input.dimensionsMm);
  if (area <= 0) return 0;

  let rub =
    area *
    BASE_PER_M2 *
    Math.max(0.5, input.thicknessMm / THICKNESS_REF_MM);

  if (input.integratedHandle) rub += HANDLE_EXTRA;
  if (input.milling.trim()) rub += area * MILLING_PER_M2;
  if (input.coating.trim()) rub += area * COATING_PER_M2;
  if (input.color.trim()) rub += COLOR_EXTRA;

  const r = input.edgeRadius;
  if (r != null && Number.isFinite(r) && r > 0) {
    rub += r * EDGE_PER_MM_RADIUS;
  }

  const opt = input.optionsExtra?.trim();
  if (opt) rub += Math.min(5000, opt.length * OPTIONS_PER_CHAR);

  return Math.round(rub);
}

export function sumFacadeBasePrices(lines: FacadePricingInput[]): number {
  return lines.reduce((acc, line) => acc + estimateFacadeBasePrice(line), 0);
}

/** Итог заказа: сумма базовых × (1 + %) + фикс. надбавка. */
export function computeOrderTotal(
  sumBase: number,
  overridePercent: number | null | undefined,
  overridePrice: number | null | undefined,
): number {
  const pct = overridePercent != null && Number.isFinite(overridePercent) ? overridePercent : 0;
  const fixed = overridePrice != null && Number.isFinite(overridePrice) ? overridePrice : 0;
  const afterPct = sumBase * (1 + pct / 100);
  return Math.round(afterPct + fixed);
}
