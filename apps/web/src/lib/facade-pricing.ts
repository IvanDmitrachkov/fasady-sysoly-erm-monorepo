/** Новые формулы расчета цены заказа по ТЗ. */

export type FacadePricingInput = {
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  millingLabel: string;
  coatingTypeId: string;
  millingPricePerM2?: number;
  handleLabel?: string | null;
  handleLengthMm?: number | null;
  color: string;
  edgeRadius?: number | null;
  optionsExtra?: string | null;
};

/** Площадь прямоугольника по сторонам в мм → м². */
export function rectangleAreaM2(widthMm: number, heightMm: number): number {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) return 0;
  return (widthMm * heightMm) / 1_000_000;
}

/** Суммарная площадь всех фасадов. */
export function calcFacadeAreaTotal(facades: { widthMm: number; heightMm: number }[]): number {
  return facades.reduce((sum, f) => sum + rectangleAreaM2(f.widthMm, f.heightMm), 0);
}

/** Количество фасадов штук. */
export function calcFacadeCount(facades: unknown[]): number {
  return facades.length;
}

/** Стоимость прямых фасадов, руб. = площадь * цена за кв.м. */
export function calcFacadeCostTotal(areaM2: number, pricePerM2: number | null | undefined): number {
  if (!areaM2 || !pricePerM2) return 0;
  return Math.round(areaM2 * pricePerM2);
}

/** Стоимость фрезеровки, руб. = площадь * цена за кв.м фрезеровки. */
export function calcMillingCostTotal(areaM2: number, millingPricePerM2: number | null | undefined): number {
  if (!areaM2 || !millingPricePerM2) return 0;
  return Math.round(areaM2 * millingPricePerM2);
}

/** Стоимость интегрированной ручки, руб. = длина (м) * цена за метр. */
export function calcHandleCostTotal(
  handleLengthMm: number | null | undefined,
  handlePricePerMeter: number | null | undefined,
): number {
  if (!handleLengthMm || !handlePricePerMeter) return 0;
  return Math.round((handleLengthMm / 1000) * handlePricePerMeter);
}

/** Итого = сумма составляющих. */
export function calcSubtotal(params: {
  facadeCostTotal: number;
  millingCostTotal: number;
  handleCostTotal: number;
  otherServicesPrice: number | null | undefined;
}): number {
  return Math.round(
    params.facadeCostTotal +
    params.millingCostTotal +
    params.handleCostTotal +
    (params.otherServicesPrice || 0),
  );
}

/** Общая стоимость = итого - скидка. */
export function calcTotalCost(subtotal: number, discount: number | null | undefined): number {
  return Math.round(subtotal - (discount || 0));
}

/** Остаток = общая стоимость - аванс. */
export function calcBalance(totalCost: number | null | undefined, advance: number | null | undefined): number {
  return Math.round((totalCost || 0) - (advance || 0));
}

export const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
