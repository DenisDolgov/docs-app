export const REFRESH_COOKIE_NAME = 'docs.refreshToken';
export const REFRESH_COOKIE_TTL = 30 * 24 * 60 * 60 * 1000;

// Префикс `__Host-` требует Secure, path=/ и отсутствие Domain. Так access-куку
// видят `proxy.ts`, `/api` и `/ws`, а украсть её у другого поддомена нельзя.
export const ACCESS_COOKIE_NAME = '__Host-access';
// Max-Age access-куки = TTL refresh: реальная валидность токена всё равно по
// `exp` внутри JWT, а кука живёт, пока клиент может её ротировать.
export const ACCESS_COOKIE_TTL = REFRESH_COOKIE_TTL;

// Окно, в котором повторно предъявленный «ротированный» refresh-токен считается
// гонкой между вкладками, а не кражей: вместо сноса всех сессий — ещё одна
// ротация в ту же sessionId.
export const REFRESH_GRACE_PERIOD = 15_000;
