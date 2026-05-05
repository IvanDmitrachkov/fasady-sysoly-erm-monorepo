import type { PrismaClient } from "@prisma/client";

/** Стартовая цепочка этапов (slug `new` — вход для новых заказов). */
export const DEFAULT_STAGES: readonly {
  slug: string;
  name: string;
  sortOrder: number;
  isComplete: boolean;
  allowWorkStates: boolean;
}[] = [
  { slug: "new", name: "Новый", sortOrder: 0, isComplete: false, allowWorkStates: false },
  { slug: "cut", name: "Раскрой", sortOrder: 1, isComplete: false, allowWorkStates: true },
  { slug: "prep", name: "Подготовка", sortOrder: 2, isComplete: false, allowWorkStates: true },
  { slug: "coating", name: "Покраска / Плёнка", sortOrder: 3, isComplete: false, allowWorkStates: true },
  { slug: "polish", name: "Полировка / Шлифовка", sortOrder: 4, isComplete: false, allowWorkStates: true },
  { slug: "pack", name: "Упаковка", sortOrder: 5, isComplete: false, allowWorkStates: true },
  { slug: "ready", name: "Готово", sortOrder: 6, isComplete: true, allowWorkStates: false },
  { slug: "ship", name: "Отгрузка", sortOrder: 7, isComplete: true, allowWorkStates: false },
];

/** Если этапов нет (не гоняли seed) — создаём дефолтные, чтобы API не падал. */
export async function ensureDefaultStages(prisma: PrismaClient): Promise<void> {
  const n = await prisma.stage.count();
  if (n > 0) return;

  for (const s of DEFAULT_STAGES) {
    await prisma.stage.create({ data: { ...s } });
  }
}
