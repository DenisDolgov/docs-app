// Пути auth-маршрутов. `base` и сегменты методов использует бэкенд
// (`@Controller(authRoute.base)`, `@Post(authRoute.login)`), полные пути —
// клиент. Строки выводятся из `base`, чтобы не разъезжались.
const base = 'auth';

export const authRoute = {
  base,
  register: 'register',
  login: 'login',
  refresh: 'refresh',
  logout: 'logout',
  logoutAll: 'logout-all',
  me: 'me',
  verifyEmail: 'email/verify',
  resendEmail: 'email/resend',
} as const;

export const authPaths = {
  register: `/${base}/register`,
  login: `/${base}/login`,
  refresh: `/${base}/refresh`,
  logout: `/${base}/logout`,
  logoutAll: `/${base}/logout-all`,
  me: `/${base}/me`,
  verifyEmail: `/${base}/email/verify`,
  resendEmail: `/${base}/email/resend`,
} as const;
