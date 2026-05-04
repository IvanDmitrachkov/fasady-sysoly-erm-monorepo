/** Стартовые под-статусы заказа на этапе (см. BR §5). Id совпадают с миграцией `order_work_state`. */
export const DEFAULT_ORDER_WORK_STATES: readonly {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
}[] = [
  {
    id: "ows-queue-0000-4000-8000-000000000001",
    slug: "queue",
    name: "В очереди",
    sortOrder: 0,
  },
  {
    id: "ows-inpr-0000-4000-8000-000000000002",
    slug: "in_progress",
    name: "В работе",
    sortOrder: 1,
  },
  {
    id: "ows-bloc-0000-4000-8000-000000000003",
    slug: "blocked",
    name: "Заблокирован",
    sortOrder: 2,
  },
  {
    id: "ows-read-0000-4000-8000-000000000004",
    slug: "ready",
    name: "Готов на участке",
    sortOrder: 3,
  },
];

/** Статус по умолчанию для нового заказа и после смены этапа. */
export const DEFAULT_ORDER_WORK_STATE_SLUG = "queue" as const;
