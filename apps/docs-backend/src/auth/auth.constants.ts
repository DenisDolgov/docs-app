import { hoursToMilliseconds, secondsToMilliseconds } from 'date-fns';

export const REFRESH_COOKIE_NAME = 'docs.refreshToken';
// 30 дней: сессия живёт, пока клиент может её ротировать.
export const REFRESH_COOKIE_TTL = hoursToMilliseconds(24 * 30);

// Префикс `__Host-` требует Secure, path=/ и отсутствие Domain. Так access-куку
// видят `proxy.ts`, `/api` и `/ws`, а украсть её у другого поддомена нельзя.
export const ACCESS_COOKIE_NAME = '__Host-access';
// Max-Age access-куки = TTL refresh: реальная валидность токена всё равно по
// `exp` внутри JWT, а кука живёт, пока клиент может её ротировать.
export const ACCESS_COOKIE_TTL = REFRESH_COOKIE_TTL;
export const ACCESS_TOKEN_TTL = '15m';

// Окно, в котором повторно предъявленный «ротированный» refresh-токен считается
// гонкой между вкладками, а не кражей: вместо сноса всех сессий — ещё одна
// ротация в ту же sessionId.
export const REFRESH_GRACE_PERIOD = secondsToMilliseconds(5);

// Время жизни токена для подтверждения почты. Часы нужны и здесь, и в тексте
// письма, поэтому одно значение питает оба места.
export const EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24;
export const EMAIL_VERIFICATION_TOKEN_TTL = hoursToMilliseconds(
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS,
);

export const PASSWORD_RESET_TOKEN_TTL_HOURS = 1;
export const PASSWORD_RESET_TOKEN_TTL = hoursToMilliseconds(
  PASSWORD_RESET_TOKEN_TTL_HOURS,
);

// User-Agent — управляемый клиентом заголовок: длину ограничиваем, чтобы одна
// строка не раздувала БД и ответ списка устройств.
export const SESSION_USER_AGENT_MAX_LENGTH = 512;

// Истёкшие и отозванные токены нужны только для истории сессии (created_at,
// первые метаданные), поэтому держим месяц и чистим раз в сутки.
export const REFRESH_TOKEN_RETENTION_DAYS = 30;
export const REFRESH_TOKEN_RETENTION = hoursToMilliseconds(
  REFRESH_TOKEN_RETENTION_DAYS * 24,
);
export const REFRESH_TOKEN_GC_INTERVAL = hoursToMilliseconds(24);
