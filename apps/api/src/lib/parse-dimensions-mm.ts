/** Как на фронте в facade-pricing: «720×2400», «1200 x 800 мм» → мм. */
export function parseDimensionsMm(dimensionsMm: string): { widthMm: number; heightMm: number } | null {
  const normalized = dimensionsMm.replace(/мм/gi, "").replace(/×/g, "x").trim();
  const parts = normalized.split(/[xх]/i).map((s) => parseFloat(s.trim()));
  const nums = parts.filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length >= 2) {
    return { widthMm: nums[0]!, heightMm: nums[1]! };
  }
  if (nums.length === 1) {
    const a = nums[0]!;
    return { widthMm: a, heightMm: a };
  }
  return null;
}
