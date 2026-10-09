# Конвенции бэкенда (`@docs-app/docs-backend`)

Дополняет корневой `AGENTS.md` (монорепо). Здесь — правила по коду модулей:
где живут типы, DTO, константы и ошибки.

## Типы по роли — один файл на роль

Тип кладём туда, где живёт его смысл, и не смешиваем роли в одном файле.

| Что это | Где | Содержит | Пример |
| --- | --- | --- | --- |
| Схема БД | `database/schema/<entity>.ts` | таблицы Drizzle, `pgEnum`, выведенные union-типы | `organizations`, `organizationRoleEnum`, `OrganizationRole` |
| Вход HTTP | `<module>/dto/<name>.dto.ts` | zod-схема + класс `createZodDto` | `AddMemberDto` |
| Домен / приложение | `<module>/<module>.models.ts` | команды, read-модели, порты, транспортные типы модуля | `AddMemberParams`, `OrganizationMemberListItem` |
| Значения и токены | `<module>/<module>.constants.ts` | `Symbol`-токены DI, TTL, наборы допустимых значений | `DATABASE`, `assignableOrganizationRoles` |
| Тексты ошибок | `<module>/errors.ts` | строковые константы сообщений | `USER_NOT_FOUND_ERROR` |
| Глобальное расширение | `types/index.d.ts` | только `declare global` | `Express.Request` |
| Env | `config/env.schema.ts` | zod-схема окружения | `envSchema` |

**Правило колокации.** Типы живут рядом с модулем-владельцем. Общей папки
`types/` для доменных типов нет — там только глобальные амбиенты
(`declare global`). Если тип нужен двум модулям, он либо принадлежит одному из
них и импортируется, либо переезжает в `database/schema` (если это про данные).

## Правила

1. **Выводи, не дублируй.** Единственный источник истины для доменного
   перечисления — `pgEnum` в схеме. Union-тип выводим из него:
   ```ts
   export const organizationRoleEnum = pgEnum('organization_role', ['owner', 'admin', 'member']);
   export type OrganizationRole = (typeof organizationRoleEnum.enumValues)[number];
   ```
   DTO и сервис переиспользуют этот тип, а не переписывают строки заново.

2. **Наборы значений — `as const satisfies`.** Константы-наборы объявляем
   неизменяемыми литеральными кортежами и сверяем с доменным типом:
   ```ts
   export const assignableOrganizationRoles = ['admin', 'member'] as const satisfies readonly OrganizationRole[];
   ```
   Так `z.enum(...)` получает точные литералы, а не `string[]`, и опечатка
   ловится компилятором. Логику «входит ли роль в набор» прячем в именованный
   предикат (`canManageMembers(role)`), а не разбрасываем `includes` по сервису.

3. **Именование в `.models.ts`:**
   - вход команды — `<Действие>Params` (`CreateOrganizationParams`,
     `AddMemberParams`);
   - выход/чтение — `<Сущность>ListItem` / `<Сущность>View`;
   - сквозной контекст — существительное (`ActorInOrganization`).

4. **DTO не пересекает границу слоя.** DTO (zod + класс) живёт только в
   контроллере. Сервис и репозитории принимают типы из `.models.ts`, а не класс
   DTO. Если поля совпадают — это нормально: домен не должен зависеть от формы
   HTTP-запроса.

5. **`.constants.ts` — это значения, а не типы.** Если константе нужен тип —
   импортируй его из `database/schema`, не объявляй новый здесь.

6. **Транспортные типы модуля** (например payload access-JWT —
   `AuthenticatedRequest`) живут в `<module>.models.ts`; файл `types/index.d.ts`
   их только импортирует и навешивает через `declare global`.

7. **Тип из БД наружу не течёт.** Наружу отдаём явную форму (`returning({...})`,
   ручной маппинг), чтобы случайные колонки (например `passwordHash`) не
   уходили в JSON. См. `docs/backend-tech-debt.md` → «Сериализация ответов».

## Схема БД

- Схема и таблицы — в единственном числе (`organization`), имя таблицы может
  быть во множественном (`organizations`). См. корневой `AGENTS.md`.
- `pgEnum` создаётся в `public` (Drizzle не квалифицирует имя типа схемой) —
  это ожидаемо; таблицы при этом живут в своей схеме.
- Ссылки между схемами (`organization.*` → `auth.users`) запрещены — только
  голый `uuid`. FK внутри своей схемы допустим.
