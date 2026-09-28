# Настройка монорепо (pnpm workspaces)

Ветка: `chore/monorepo`. Мерж одним PR в `main`.

## Цель

Преобразовать текущий репозиторий в pnpm-workspaces монорепо:

- `apps/docs-frontend` — текущий Next.js 16 проект (`@docs-app/docs-frontend`).
- `apps/docs-backend` — новый каркас NestJS (`@docs-app/docs-backend`).

Единый `pnpm-lock.yaml` и `pnpm-workspace.yaml` в корне. Convex не трогаем.
`packages/` не создаём. Чистый pnpm без Turborepo, scope `@docs-app/*`,
общие версии через `catalog:`.

## Решения

- Бэкенд: NestJS, CommonJS, порт 3001, только каркас (`GET /health`,
  `AppModule`/`AppController`/`AppService`). Без БД/ORM, без доменных модулей,
  без Docker (позже отдельной задачей).
- `next.config.ts` оставляем пустым: корень воркспейса Next определяет
  автоматически по `pnpm-lock.yaml`; `transpilePackages` не нужен, пока нет
  shared-пакетов.
- Тулинг в корне: `biome.json`, `lefthook.yml`, `.gitignore`,
  `scripts/lint-commit.js`. `prepare: lefthook install` — только в корневом
  `package.json`.
- Pre-commit: общий вызов biome в корне + два glob-скоупед-коммита typecheck
  (по одному на приложение).
- Скрипты корня: `dev` (оба приложения параллельно), `dev:frontend`,
  `dev:backend`, `lint`, `typecheck`.
- Env: `.env.local` переезжает в `apps/docs-frontend/` (файлы не в git).
- Документация: корневой `README.md` переписан под монорепо, добавлен
  корневой `AGENTS.md` + `CLAUDE.md` → `@AGENTS.md`;
  `apps/docs-frontend/AGENTS.md` не трогаем.

## Порядок коммитов

1. `refactor: фронтенд перенесен в apps/docs-frontend` — только `git mv`.
2. `chore: настроены pnpm workspaces и корневой тулинг`.
3. `feat: добавлен каркас NestJS-бэкенда`.
4. `chore: обновлены скрипты, хуки и документация монорепо`.

## Проверка

`pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm --filter ... build`
для обоих приложений.
