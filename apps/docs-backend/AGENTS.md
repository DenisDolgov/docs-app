# Конвенции бэкенда (`@docs-app/docs-backend`)

Дополняет корневой `AGENTS.md` (монорепо). Здесь — правила по коду модулей:
где живут типы, DTO, константы и ошибки.

## Типы по роли — один файл на роль

Тип кладём туда, где живёт его смысл, и не смешиваем роли в одном файле.

| Что это | Где | Содержит | Пример |
| --- | --- | --- | --- |
| Схема БД | `database/schema/<entity>.ts` | таблицы Drizzle, `pgEnum` (выводится из набора контракта) | `organizations`, `organizationRoleEnum` |
| Вход HTTP | `packages/contracts/src/<module>/` | zod-схема (`z.object`) | `addMemberDto` |
| Выход HTTP | `packages/contracts/src/<module>/` | zod-схема разрешённой формы ответа | `documentResponseDto` |
| Маршруты HTTP | `packages/contracts/src/<module>/routes.ts` | сегменты/параметры для декораторов и полные пути клиента | `documentRoute`, `authPaths` |
| Домен / приложение | `<module>/<module>.models.ts` | команды, read-модели, порты, транспортные типы модуля | `AddMemberParams`, `OrganizationMemberListItem` |
| Значения и токены | `<module>/<module>.constants.ts` | `Symbol`-токены DI, TTL, внутренние тайминги | `DATABASE`, `COLLAB_SAVE_INTERVAL` |
| Тексты ошибок | `<module>/errors.ts` | строковые константы сообщений | `USER_NOT_FOUND_ERROR` |
| Глобальное расширение | `types/index.d.ts` | только `declare global` | `Express.Request` |
| Env | `config/env.schema.ts` | zod-схема окружения | `envSchema` |

**Правило колокации.** Доменные типы и внутренние константы живут рядом с
модулем-владельцем. Общей папки `types/` для доменных типов нет — там только
глобальные амбиенты (`declare global`). Если тип нужен двум модулям, он либо
принадлежит одному из них и импортируется, либо переезжает в `database/schema`
(если это про данные).

**Исключение — wire-контракт.** Всё, что пересекает границу HTTP или WS (схемы
запросов/ответов, шаблоны путей, opcodes и коды закрытия), живёт в
`packages/contracts` (`@docs-app/contracts/<module>`), а модуль его импортирует.
Модуль владеет только тем, что не выходит наружу.

## Правила

1. **Выводи, не дублируй.** Источник истины для wire-перечисления — контракт.
   Набор объявлен в `packages/contracts/src/<module>`, а `pgEnum` выводится из
   него:
   ```ts
   // packages/contracts/src/organization/roles.ts
   export const organizationRoles = ['owner', 'admin', 'member'] as const;
   export type OrganizationRole = (typeof organizationRoles)[number];

   // database/schema/organizations.ts
   export const organizationRoleEnum = pgEnum('organization_role', organizationRoles);
   ```
   DTO, схема и сервис переиспользуют этот тип, а не переписывают строки заново.

2. **Наборы значений — `as const satisfies`.** Константы-наборы объявляем
   неизменяемыми литеральными кортежами и сверяем с доменным типом:
   ```ts
   // packages/contracts/src/organization/roles.ts
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

4. **DTO не пересекает границу слоя.** DTO (zod-схема) живёт в контракте и
   используется только контроллером. Сервис и репозитории принимают типы из
   `.models.ts`, а не схему DTO. Если поля совпадают — это нормально: домен не
   должен зависеть от формы HTTP-запроса.

5. **`.constants.ts` — это значения, а не типы.** Если константе нужен тип —
   импортируй его из `database/schema` или из контракта, не объявляй новый здесь.

6. **Транспортные типы модуля** (например payload access-JWT —
   `AuthenticatedRequest`) живут в `<module>.models.ts`; файл `types/index.d.ts`
   их только импортирует и навешивает через `declare global`.

7. **Тип из БД наружу не течёт.** Наружу отдаём явную форму (`returning({...})`,
   ручной маппинг), чтобы случайные колонки (например `passwordHash`) не
   уходили в JSON. Даты — тоже: репозиторий отдаёт ISO-строки
   (`row.createdAt.toISOString()`), а не `Date` из драйвера. См.
   `docs/architecture.md` → «Контракты и сериализация».

8. **Вход валидирует схема на параметре, а не пайп.** Контроллер навешивает
   zod-схему (из контракта) прямо на параметр: `@Body({ schema: registerDto })`.
   Глобальный `AppValidationPipe` (наследник `StandardSchemaValidationPipe`,
   Nest 12) валидирует по этой метадане, а `@nestjs/swagger` берёт её же в
   OpenAPI — одно описание на вход и доку.

9. **Ответ описывает response-DTO, а не форма из репозитория.** Форма ответа —
   отдельная zod-схема в контракте (`packages/contracts/src/<module>/`). Рантайм-гарантию
   дают `@SerializeOptions({ schema })` на хендлере и глобальный
   `StandardSchemaSerializerInterceptor`: результат хендлера прогоняется через
   схему, лишнее отсекается. Документацию ответа даёт `@ApiOkResponse({
   standardSchema })` (для списка — `{ standardSchema, isArray: true }`).
   См. урок 0017 и `reference/typed-http-contract-cheatsheet.html`.

10. **Даты в response-DTO — ISO-строки.** В схеме — `z.iso.datetime()`;
   `Date` из Drizzle конвертирует репозиторий. `z.date()`/`z.coerce.date()` в
   response-схему не ставим: они не представимы в JSON Schema и ломают генерацию
   OpenAPI. (Со Standard Schema кодек не работает: сериализатор вызывает
   `validate`, а не `encode`.)

11. **Текущий пользователь — `@CurrentUser()`.** Контроллер не тащит `@Req()` и
    не лезет в `req.user`; payload из гуарда достаёт параметрический декоратор
    `src/auth/current-user.decorator.ts`.

12. **Ошибки — один конверт `problem+json` (RFC 9457).** Любой выброшенный
    `HttpException` и непредвиденная ошибка проходят через глобальный
    `AllExceptionsFilter` (`src/common/all-exceptions.filter.ts`) и отдаются как
    `application/problem+json`: `title` — фраза HTTP-статуса, конкретика — в
    `detail`, полевые ошибки валидации — в `errors: [{ path, message }]`.
    Непредвиденные ошибки логируются и наружу отдают безликий 500 без
    внутренностей. Ошибки входа контроллер не переписывает: сообщения берутся из
    `<module>/errors.ts`. Схема конверта — `@docs-app/contracts/http`.

13. **Валидация входа — поле `errors`.** Пайп `AppValidationPipe` (наследник
    `StandardSchemaValidationPipe`) вместо плоского списка строк отдаёт
    структурированные `{ path, message }`, которые фильтр кладёт в `errors`.

## Схема БД

- Схема и таблицы — в единственном числе (`organization`), имя таблицы может
  быть во множественном (`organizations`). См. корневой `AGENTS.md`.
- `pgEnum` создаётся в `public` (Drizzle не квалифицирует имя типа схемой) —
  это ожидаемо; таблицы при этом живут в своей схеме.
- Ссылки между схемами (`organization.*` → `auth.users`) запрещены — только
  голый `uuid`. FK внутри своей схемы допустим.
