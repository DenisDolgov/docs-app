// Тонкий клиент нашего REST API. Access- и refresh-токены живут в httpOnly-куках,
// которые браузер шлёт сам при `credentials: 'include'`; JS их не читает.

import type { MeResponseDto } from '@docs-app/contracts/auth';
import { authPaths } from '@docs-app/contracts/auth/routes';
import type { ProblemDetails } from '@docs-app/contracts/http';

import { API_URL } from './auth-config';
import {
  refreshSession,
  resetSessionExpired,
  SessionExpired,
} from './auth-session';

export type { DocumentDto } from '@docs-app/contracts/document';
export type { OrganizationDto } from '@docs-app/contracts/organization';

// Профиль пользователя: `/auth/me` отдаёт больше, чем ответ регистрации
// (например, `emailVerified`), и именно эта форма нужна интерфейсу.
export type User = MeResponseDto;

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

// Ошибка API несёт разобранный problem+json (RFC 9457).
export class ApiError extends Error {
  public readonly status: number;
  public readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.problem = problem;
  }
}

const fallbackProblem = (status: number): ProblemDetails => ({
  type: 'about:blank',
  title: `Ошибка ${status}`,
  status,
});

const readProblem = async (response: Response): Promise<ProblemDetails> => {
  try {
    const body = (await response.json()) as Partial<ProblemDetails>;

    if (typeof body.title === 'string' && typeof body.status === 'number') {
      return {
        type: body.type ?? 'about:blank',
        title: body.title,
        status: body.status,
        ...(body.detail ? { detail: body.detail } : {}),
        ...(body.instance ? { instance: body.instance } : {}),
        ...(body.errors ? { errors: body.errors } : {}),
      };
    }
  } catch {
    // тело не JSON — отдадим статус
  }

  return fallbackProblem(response.status);
};

const toApiError = async (response: Response): Promise<ApiError> =>
  new ApiError(await readProblem(response));

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
    throw await toApiError(response);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
};

export const login = async (email: string, password: string): Promise<User> => {
  const response = await fetch(`${API_URL}${authPaths.login}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  resetSessionExpired();

  return fetchMe();
};

export const register = async (
  email: string,
  password: string,
): Promise<void> => {
  const response = await fetch(`${API_URL}${authPaths.register}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw await toApiError(response);
  }
};

export const logout = async (): Promise<void> => {
  await fetch(`${API_URL}${authPaths.logout}`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
};

export const logoutAll = async (): Promise<void> => {
  await fetch(`${API_URL}${authPaths.logoutAll}`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
};

// POST, который по контракту отвечает 204: тело не читаем, ошибки — в ApiError.
const postNoContent = async (path: string, body?: unknown): Promise<void> => {
  const response = await apiFetch(path, {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    throw await toApiError(response);
  }
};

// Всегда 204, даже если почта не зарегистрирована: ответ не должен выдавать
// существование аккаунта.
export const requestPasswordReset = (email: string): Promise<void> =>
  postNoContent(authPaths.requestPasswordReset, { email });

export const resetPassword = (token: string, password: string): Promise<void> =>
  postNoContent(authPaths.resetPassword, { token, password });

export const verifyEmail = (token: string): Promise<void> =>
  postNoContent(authPaths.verifyEmail, { token });

export const resendVerificationEmail = (): Promise<void> =>
  postNoContent(authPaths.resendEmail);

export const fetchMe = async (): Promise<User> => {
  return apiJson<User>(authPaths.me);
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
