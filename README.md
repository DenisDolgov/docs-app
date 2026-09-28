# docs-app

Монорепозиторий на pnpm workspaces.

## Структура

```
apps/
  docs-frontend/   Next.js 16, React 19, Convex, Clerk, Liveblocks
  docs-backend/    NestJS
```

Единый `pnpm-lock.yaml` и `pnpm-workspace.yaml` в корне. Общие версии пакетов
объявляются через `catalog:` в `pnpm-workspace.yaml`.

## Требования

- Node.js >= 24
- pnpm 10

## Установка

```bash
pnpm install
```

## Запуск

```bash
pnpm dev            # оба приложения параллельно
pnpm dev:frontend   # только фронтенд (http://localhost:3000)
pnpm dev:backend    # только бэкенд (http://localhost:3001)
```

## Проверки

```bash
pnpm lint       # biome по всему монорепо
pnpm typecheck  # tsc в каждом приложении
pnpm build      # сборка всех приложений
```

Линт и проверка типов затронутых приложений запускаются автоматически в
pre-commit через lefthook.

## Конвенции

- Пакеты воркспейса имеют scope `@docs-app/*`.
- Форматирование и линтинг — единый корневой `biome.json`.
- Скрипты `dev`/`build`/`typecheck` живут в приложениях, оркестрация — в корне.
