process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/docs';
process.env.PORT ??= '3001';
// Всегда используем выделенную тестовую БД (индекс 1), игнорируя внешний REDIS_URL,
// чтобы flushdb() в тестах не мог зачистить рабочие данные в db 0.
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.RABBITMQ_URL ??= 'amqp://user:pass@localhost:5672';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.S3_ENDPOINT ??= 'http://localhost:9000';
process.env.S3_ACCESS_KEY ??= 'user';
process.env.S3_SECRET_KEY ??= 'pass-secret';
