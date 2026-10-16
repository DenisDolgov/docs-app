// Тонкий клиент нашего REST API.
// Access-токен живёт в переменной модуля (в памяти вкладки), refresh — в
// httpOnly-cookie, которую браузер шлёт сам при `credentials: 'include'`.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const REFRESH_COOKIE_NAME = 'docs.refreshToken';

// Несекретный маркер «сессия есть» для серверного гейта `proxy.ts`: refresh
// httpOnly-cookie лежит с `path=/auth` и на страницах просто не видна.
export const SESSION_HINT_COOKIE = 'docs.session';

const setSessionHint = () => {
  // biome-ignore lint/suspicious/noDocumentCookie: несекретный маркер для proxy.ts
  document.cookie = `${SESSION_HINT_COOKIE}=1; path=/; SameSite=Lax`;
};

const clearSessionHint = () => {
  // biome-ignore lint/suspicious/noDocumentCookie: несекретный маркер для proxy.ts
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
};

export type OrganizationRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  email: string;
}

export interface DocumentDto {
  id: string;
  organizationId: string | null;
  createdBy: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
  role: OrganizationRole;
}

export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// Single-flight: параллельные вызовы делят один запрос refresh.
export const refresh = (): Promise<string | null> => {
  refreshPromise ??= requestRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
};

const requestRefresh = async (): Promise<string | null> => {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    accessToken = null;
    clearSessionHint();
    return null;
  }

  const { accessToken: token } = (await response.json()) as {
    accessToken: string;
  };
  accessToken = token;
  setSessionHint();

  return accessToken;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    const { message } = body;

    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  } catch {
    // тело не JSON — отдадим статус
  }

  return `Запрос завершился с кодом ${response.status}`;
};

// Обёртка над fetch: подставляет токен, при 401 один раз обновляет его и
// повторяет запрос. Возвращает «сырой» Response — вызывающий решает, как читать.
export const apiFetch = async (
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> => {
  if (!accessToken) await refresh();

  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && retry) {
    const token = await refresh();
    if (token) return apiFetch(path, init, false);
  }

  return response;
};

export const apiJson = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
};

export const login = async (email: string, password: string): Promise<User> => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  const { accessToken: token } = (await response.json()) as {
    accessToken: string;
  };
  accessToken = token;
  setSessionHint();

  return fetchMe();
};

export const register = async (
  email: string,
  password: string,
): Promise<User> => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return (await response.json()) as User;
};

export const logout = async (): Promise<void> => {
  await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
  accessToken = null;
  clearSessionHint();
};

export const fetchMe = async (): Promise<User> => {
  return apiJson<User>('/auth/me');
};

// Восстановление сессии при загрузке страницы: пробуем refresh и, если токен
// есть, читаем пользователя. Иначе — «не авторизован».
export const bootstrapUser = async (): Promise<User | null> => {
  const token = await refresh();
  if (!token) return null;

  try {
    return await fetchMe();
  } catch {
    accessToken = null;
    return null;
  }
};
