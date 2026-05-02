/** Стартовая цепочка этапов (slug `new` — вход для новых заказов). */
export const DEFAULT_STAGES = [
    { slug: "new", name: "Новый", sortOrder: 0, isComplete: false },
    { slug: "cut", name: "Раскрой", sortOrder: 1, isComplete: false },
    { slug: "prep", name: "Подготовка", sortOrder: 2, isComplete: false },
    { slug: "coating", name: "Покраска / Плёнка", sortOrder: 3, isComplete: false },
    { slug: "polish", name: "Полировка / Шлифовка", sortOrder: 4, isComplete: false },
    { slug: "pack", name: "Упаковка", sortOrder: 5, isComplete: false },
    { slug: "ship", name: "Отгрузка", sortOrder: 6, isComplete: true },
];
/** Если этапов нет (не гоняли seed) — создаём дефолтные, чтобы API не падал. */
export async function ensureDefaultStages(prisma) {
    const n = await prisma.stage.count();
    if (n > 0)
        return;
    for (const s of DEFAULT_STAGES) {
        await prisma.stage.create({ data: { ...s } });
    }
}
//# sourceMappingURL=default-stages.js.map