process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/docs';
process.env.PORT ??= '3001';
// Всегда используем выделенную тестовую БД (индекс 1), игнорируя внешний REDIS_URL,
// чтобы flushdb() в тестах не мог зачистить рабочие данные в db 0.
process.env.REDIS_URL = 'redis://localhost:6379/1';
