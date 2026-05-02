# ERM «Фасады Сысолы»

Монорепо: **Fastify + Prisma (SQLite локально)** + **React + Vite + Mantine**.

Документация: каталог [`docs/`](./docs/), стек: [`docs/technology-stack-and-ui.md`](./docs/technology-stack-and-ui.md).

## Требования

- [Yarn](https://yarnpkg.com/) (Classic 1.x **workspaces** или Berry с workspaces)
- Node.js 22+ (LTS)

## Первый запуск

```bash
cp apps/api/.env.example apps/api/.env
yarn install
mkdir -p apps/api/.data
yarn db:migrate
yarn db:seed
```

`yarn db:migrate` при первом запуске спросит имя миграции (можно `init`).

После изменения `prisma/schema.prisma` клиент обновляется автоматически при `yarn install` (в `@erm/api` есть `postinstall: prisma generate`). Если seed падает с **`Cannot read properties of undefined (reading 'upsert')`** — вручную из корня: `yarn workspace @erm/api prisma generate`, затем снова `yarn db:seed`.

## Разработка

Два процесса (API и Vite; фронт проксирует `/api` на порт 3000):

```bash
yarn dev
```

Либо в двух терминалах: `yarn dev:api` и `yarn dev:web`.

- UI: http://localhost:5173/admin/
- API: http://localhost:3000/api/health

Учётки после seed: `admin@example.com` / `Admin123!`, `worker@example.com` / `Worker123!`, `customer@example.com` / `Customer123!`.

### Сброс локальной БД (удалит все dev-данные)

Если после обновления схемы API отвечает 500 (`The table main.Facade does not exist` и т.п.), **остановите `yarn dev`** (и Prisma Studio, если открыт), затем:

```bash
yarn db:reset
```

Скрипт удаляет `apps/api/.data/dev.db*` и выполняет `prisma migrate deploy` + seed на **абсолютный** путь к этой БД (совпадает с тем, как API резолвит `file:./.data/...` от каталога пакета, а не от `process.cwd()`).

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
