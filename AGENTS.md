# Конвенции монорепо

- Репозиторий — pnpm workspaces монорепо. Приложения в `apps/*`, пакеты с общим
  кодом (когда появятся) — в `packages/*`.
- Пакеты воркспейса именуются `@docs-app/<name>` и подключаются через
  `workspace:*`.
- Общие версии зависимостей объявляются в `catalog:` в `pnpm-workspace.yaml`,
  в пакетах указывается `catalog:`.
- Линтинг и форматирование — единый корневой `biome.json`. Собственных
  eslint/prettier/biome-конфигов в приложениях нет.
- Запускать команды приложений из корня через `pnpm --filter @docs-app/<name> <script>`.
- Скрипты `prepare` (lefthook) живут только в корневом `package.json`.
- Env-файлы лежат в каталоге соответствующего приложения (например,
  `apps/docs-frontend/.env.local`) и не коммитятся.
- **Нейминг бэкенд-домена — в единственном числе.** Модули, папки, классы и
  таблицы/схемы: `auth/`, `AuthModule`, `UserRepository`, `organization/`,
  `OrganizationService`, `organization.organization_members`. Множественное
  число не используем, даже если сущностей много. Исключение — имя таблицы
  `organizations` (так задано схемой), но схема — `organization`.
  Эталон — уже существующий `auth/`.
