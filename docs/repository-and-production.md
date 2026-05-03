# ERM «Фасады Сысолы» — Структура репозитория и продакшен (Beget)

Документ фиксирует **целевую** раскладку кода и способ выкладки на прод. Общий стек, JWT, `/admin` + `/api`, MySQL — см. [architecture.md](./architecture.md). Список библиотек и UI — [technology-stack-and-ui.md](./technology-stack-and-ui.md).

---

## 1. Монорепозиторий

Один репозиторий: фронт и бэк собираются отдельно, на прод уходит **один процесс Node** и **одна точка входа** в корне артефакта (ниже).

Рекомендуемое дерево **исходников**:

```txt
fasady-sysoly-erm-2/
├── docs/
├── apps/
│   ├── api/                    # Fastify + Prisma + бизнес-логика
│   │   ├── src/
│   │   │   ├── server.ts       # сборка → корневой server.js (или dist/server.js)
│   │   │   ├── plugins/        # jwt, prisma, multipart…
│   │   │   └── modules/        # orders, stages, facades, customers, users,
│   │   │                         # time-entries, audit, cutting, files…
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── package.json
│   └── web/                    # React + Vite + TypeScript
│       ├── src/
│       ├── vite.config.ts      # base: '/admin/'
│       └── package.json
├── packages/                   # опционально: shared типы/DTO между web и api
│   └── shared/
├── package.json                # Yarn workspaces (`"workspaces": ["apps/*"]`)
└── .github/workflows/          # build → артефакт → deploy на Beget
```

**Принцип:** исходники модульные; «один файл на проде» — это **точка входа процесса**, не требование держать весь код в одном файле.

---

## 2. Поведение `server.js` на продакшене

На Beget в панели Node задаётся **один файл запуска** — стандартно **`server.js`** в корне выкладываемого каталога приложения.

Этот файл (результат сборки TypeScript из `apps/api`) должен:

1. Поднять **Fastify**.
2. Зарегистрировать маршруты **`/api/*`** (REST, JSON; для раскроя — отдельные ответы, в т.ч. `application/pdf`).
3. Подключить **статику** собранного SPA: префикс **`/admin`**, корень файлов — каталог артефакта сборки Vite (например `web-dist/` рядом с `server.js` или вложенная папка с известным путём).
4. Для SPA включить **fallback** на `index.html` для путей под `/admin`, чтобы работали клиентские маршруты React Router.
5. Слушать **`process.env.PORT`** (порт задаёт хостинг Beget).

Итог для браузера: **один домен**, без отдельного origin для API — как в [architecture.md](./architecture.md) §7.

---

## 3. Сборка и артефакт для выкладки

Пайплайн (локально или GitHub Actions):

| Шаг | Результат |
|-----|-----------|
| `apps/web`: `vite build` | статика (`index.html` + ассеты), `base: '/admin/'` |
| `apps/api`: компиляция TS | `server.js` + вспомогательные `.js` из `src/` (или один бандл — по выбранному тулу) |
| Prisma `generate` | клиент в `node_modules` |
| Упаковка | каталог для FTP/SSH: `server.js`, `package.json`, `node_modules` (prod), папка со статикой, `prisma/schema.prisma` и `prisma/migrations/` для `migrate deploy` |

**Миграции БД:** применять только в CI/CD перед рестартом приложения. На Beget пайплайн запускает `db:baseline` для уже существующей БД, затем `prisma migrate deploy`. Локальные машины не выполняют `prisma migrate` и `prisma db push` против общей БД.

Переменные окружения на проде (минимум): `DATABASE_URL`, секрет JWT, путь к каталогу `uploads`, при необходимости `NODE_ENV=production`.

---

## 3.1 Локальная разработка: общая MySQL БД

Локальная разработка и стенд используют одну MySQL БД. Локальный `.env` может указывать на тот же `DATABASE_URL`, но локальный процесс считается runtime-клиентом этой БД, а не владельцем схемы.

Разрешено локально:

- запускать API и фронт для разработки;
- выполнять `prisma generate`;
- открывать Prisma Studio для просмотра и аккуратного редактирования данных, если это согласовано.

Запрещено локально:

- `prisma migrate dev`;
- `prisma migrate deploy`;
- `prisma db push`;
- любые ручные `ALTER TABLE` без отдельного решения.

Новая схема попадает в репозиторий через файлы в `apps/api/prisma/migrations/`. Применение этих файлов к общей БД выполняет только CI/CD. Если база была создана до появления истории Prisma, CI/CD один раз пометит `20260503143500_init_mysql` как примененную через `prisma migrate resolve --applied`, после чего будет докатывать только новые миграции.

---

## 4. Связь с требованиями

- Раздача SPA с **`/admin`** и API с **`/api`** — обязательное соответствие [architecture.md](./architecture.md).
- Вложения заказов — каталог на диске сервера (не путать с PDF раскроя, который не сохраняется) — см. [business-requirements.md](./business-requirements.md).

---

## 5. Что не фиксируем здесь

Инструмент сборки бэка (tsc / esbuild / tsup) и точное имя папки со статикой при необходимости уточняются в репозитории; смысл схемы остаётся: **один процесс, один entry, два префикса пути**.
