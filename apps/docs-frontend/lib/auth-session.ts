import { API_URL } from './auth-config';

export class SessionExpired extends Error {
  constructor() {
    super('Сессия истекла');
    this.name = 'SessionExpired';
  }
}

// 5xx / сеть / таймаут
export class TransientError extends Error {
  constructor() {
    super('Не удалось обновить сессию');
    this.name = 'TransientError';
  }
}

const REFRESH_LOCK = 'docs:auth:refresh';
const LOCK_WAIT_TIMEOUT = 2000;

let inFlight: Promise<void> | null = null;
let sessionExpiredNotified = false;

let sessionExpiredHandler = () => {
  window.location.assign('/login');
};

export const setSessionExpiredHandler = (handler: () => void) => {
  sessionExpiredHandler = handler;
};

export const resetSessionExpired = () => {
  sessionExpiredNotified = false;
};

// Дедуплицированный переход на /login, несколько параллельных 401 не должны
// дёргать редирект несколько раз.
export const onSessionExpired = () => {
  if (sessionExpiredNotified) return;

  sessionExpiredNotified = true;
  sessionExpiredHandler();
};

// Отменяем свой запрос на `freeze`/`pagehide`, зависшая вкладка не должна
// держать лок и подвешивать остальные.
const abortOnPageHide = (controller: AbortController) => {
  if (typeof window === 'undefined') return () => {};

  const abort = () => controller.abort();
  window.addEventListener('pagehide', abort, { once: true });
  window.addEventListener('freeze', abort, { once: true });

  return () => {
    window.removeEventListener('pagehide', abort);
    window.removeEventListener('freeze', abort);
  };
};

const refreshOnce = async () => {
  const controller = new AbortController();
  const cleanup = abortOnPageHide(controller);

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new SessionExpired();
    }

    if (!response.ok) {
      throw new TransientError();
    }

    sessionExpiredNotified = false;
  } finally {
    cleanup();
  }
};

// Ждём лок ограниченное время, зависшая вкладка не должна подвешивать остальные
const withLock = async (task: () => Promise<void>) => {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    return task();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCK_WAIT_TIMEOUT);

  try {
    return await navigator.locks.request(
      REFRESH_LOCK,
      { signal: controller.signal },
      async () => {
        clearTimeout(timer);
        return task();
      },
    );
  } catch (error) {
    if (controller.signal.aborted) {
      return task();
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// In-tab single-flight внутри лока. Лок берём только здесь!!!
export const ensureRefreshed = (): Promise<void> => {
  inFlight ??= withLock(refreshOnce).finally(() => {
    inFlight = null;
  });

  return inFlight;
};

// Обновление сессии для вызывающих, которым нужен единый конец сессии
// пробрасываем все ошибки кроме мертвой сессии
export const refreshSession = async (): Promise<void> => {
  try {
    await ensureRefreshed();
  } catch (error) {
    if (error instanceof SessionExpired) onSessionExpired();

    throw error;
  }
};
