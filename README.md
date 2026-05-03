# ERM «Фасады Сысолы»

Монорепо: **Fastify + Prisma (MySQL)** + **React + Vite + Mantine**.

Документация: каталог [`docs/`](./docs/), стек: [`docs/technology-stack-and-ui.md`](./docs/technology-stack-and-ui.md).

## Требования

- [Yarn](https://yarnpkg.com/) (Classic 1.x **workspaces** или Berry с workspaces)
- Node.js 22+ (LTS)

## Первый запуск

```bash
cp apps/api/.env.example apps/api/.env
yarn install
yarn db:generate
```

Локальный `.env` подключается к общей MySQL БД стенда. Не запускайте локально `prisma migrate`, `prisma db push` и другие команды, меняющие схему: миграции применяет только CI/CD.

После изменения `prisma/schema.prisma` клиент обновляется автоматически при `yarn install` (в `@erm/api` есть `postinstall: prisma generate`). Если seed падает с **`Cannot read properties of undefined (reading 'upsert')`** — вручную из корня: `yarn workspace @erm/api prisma generate`, затем снова `yarn db:seed`.

## Разработка

Два процесса (API и Vite; фронт проксирует `/api` на порт 3000):

```bash
yarn dev
```

Либо в двух терминалах: `yarn dev:api` и `yarn dev:web`.

- UI: http://localhost:5173/admin/
- API: http://localhost:3000/api/health

Учётки после seed: `admin@example.com` / `Admin123!`, `worker@example.com` / `Worker123!`, `customer@example.com` / `Customer123!`. Seed на общей БД запускайте только осознанно, обычно через CI/CD с `SEED_DATABASE=true`.

### Миграции БД

Схема общей MySQL БД меняется только через CI/CD. Локальные `yarn db:migrate`, `yarn db:push` и `yarn db:reset` заблокированы guard-скриптом, чтобы случайно не применить изменения в общую БД.

Процесс изменения схемы:

1. Обновить `apps/api/prisma/schema.prisma`.
2. Добавить Prisma migration в `apps/api/prisma/migrations/` и закоммитить ее вместе с кодом.
3. Дождаться деплоя: CI/CD выполнит `db:baseline`, затем `db:migrate:deploy`.

Если деплой падает на миграциях, не чините схему через `db push` с локальной машины. Сначала проверьте состояние `_prisma_migrations` и текст упавшей миграции.

## Сборка

```bash
yarn build
```

API собирается в `apps/api/dist/`, статика фронта — `apps/web/dist/` и копируется в `apps/api/web-dist/`.

## Запуск собранного API

Из каталога `apps/api` с переменными окружения и существующей БД:

```bash
node dist/server.js
```
