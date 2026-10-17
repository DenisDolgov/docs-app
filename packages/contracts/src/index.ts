// Контракт клиент↔бэкенд: wire-схемы (zod), пути и WS-протокол.
// Внутренние сервис-сервисные швы (gRPC/events) сюда не входят.
export * from './auth';
export * from './auth/routes';
export * from './collab';
export * from './document';
export * from './document/routes';
export * from './http';
export * from './organization';
export * from './organization/routes';
