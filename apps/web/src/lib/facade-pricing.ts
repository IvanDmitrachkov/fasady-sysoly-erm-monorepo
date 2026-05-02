/** MVP-оценка базовой цены позиции (руб.), по ТЗ считается на клиенте. */

export type FacadePricingInput = {
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  /** Надбавка за м² по выбранному типу фрезеровки (из справочника). */
  millingPricePerM2: number;
  /** Надбавка за м² по выбранному типу покрытия. */
  coatingPricePerM2: number;
  /** Цена за п.м. ручки; если null — ручка не выбрана. */
  handlePricePerMeter: number | null;
  /** Длина ручки, мм (если выбран тип). */
  handleLengthMm: number | null;
  color: string;
  edgeRadius?: number | null;
  optionsExtra?: string | null;
};

/** Площадь прямоугольника по сторонам в мм → м². */
export function rectangleAreaM2(widthMm: number, heightMm: number): number {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) return 0;
  return (widthMm * heightMm) / 1_000_000;
}

const BASE_PER_M2 = 12000;
const THICKNESS_REF_MM = 16;
const COLOR_EXTRA = 400;
const EDGE_PER_MM_RADIUS = 35;
const OPTIONS_PER_CHAR = 12;

export function estimateFacadeBasePrice(input: FacadePricingInput): number {
  const area = rectangleAreaM2(input.widthMm, input.heightMm);
  if (area <= 0) return 0;

  let rub =
    area *
    BASE_PER_M2 *
    Math.max(0.5, input.thicknessMm / THICKNESS_REF_MM);

  rub += area * Math.max(0, input.millingPricePerM2);
  rub += area * Math.max(0, input.coatingPricePerM2);

  const ppm = input.handlePricePerMeter;
  const lenMm = input.handleLengthMm;
  if (ppm != null && Number.isFinite(ppm) && ppm > 0 && lenMm != null && Number.isFinite(lenMm) && lenMm > 0) {
    rub += (lenMm / 1000) * ppm;
  }

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
