// Тонкий клиент нашего REST API. Access- и refresh-токены живут в httpOnly-куках,
// которые браузер шлёт сам при `credentials: 'include'`; JS их не читает.

import { API_URL } from './auth-config';
import {
  refreshSession,
  resetSessionExpired,
  SessionExpired,
} from './auth-session';

export {
  ACCESS_COOKIE_NAME,
  API_URL,
  REFRESH_COOKIE_NAME,
} from './auth-config';
export {
  ensureRefreshed,
  refreshSession,
  SessionExpired,
  setSessionExpiredHandler,
  TransientError,
} from './auth-session';

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

// Обёртка над fetch: при 401 один раз обновляет сессию и повторяет запрос.
// Возвращает «сырой» Response — вызывающий решает, как читать.
export const apiFetch = async (
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && retry) {
    try {
      await refreshSession();
    } catch (error) {
      if (error instanceof SessionExpired) return response;

      throw error; // транзиент — наверх
    }

    return apiFetch(path, init, false);
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

  resetSessionExpired();

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
};

export const fetchMe = async (): Promise<User> => {
  return apiJson<User>('/auth/me');
};

// Восстановление сессии при загрузке страницы: `apiFetch` сам сходит в refresh
// при 401. Если сессии нет — «не авторизован».
export const bootstrapUser = async (): Promise<User | null> => {
  try {
    return await fetchMe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;

    throw error;
  }
};
