import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  snakeCase,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const auditSchema = snakeCase.schema('audit');

// Журнал событий безопасности. Таблица только пополняется: `update`/`delete`
// в коде нет, а на уровне БД их отсекает триггер из миграции. Поэтому здесь
// нет FK ни на пользователя, ни на документ: событие обязано пережить удаление
// цели, а кросс-схемные ссылки в проекте запрещены.
export const auditEvents = auditSchema.table(
  'events',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    // Актор всегда известен: анонимных security-событий в v1.0 нет.
    actorId: uuid().notNull(),
    action: text().notNull(),
    targetType: text().notNull(),
    targetId: uuid().notNull(),
    // Только то, что нужно для ответа «кто, что, над чем». Токены, пароли и
    // тела запросов сюда не попадают.
    metadata: jsonb().notNull().default(sql`'{}'::jsonb`),
    ip: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // История доступа по объекту: «что происходило с этим документом».
    index('audit_event_target_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    // История действий пользователя.
    index('audit_event_actor_idx').on(table.actorId, table.createdAt),
  ],
);
