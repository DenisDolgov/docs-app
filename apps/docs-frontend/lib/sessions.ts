// Активные сессии пользователя: список устройств и принудительный выход с
// конкретного. Текущую сессию сервер определяет по refresh-куке, поэтому
// признак `current` приходит с бэкенда, а не вычисляется на клиенте.

import type { SessionResponseDto } from '@docs-app/contracts/auth';
import { authPaths } from '@docs-app/contracts/auth/routes';

import { apiJson } from '@/lib/api';

export type Session = SessionResponseDto;

export const listSessions = (): Promise<Session[]> =>
  apiJson<Session[]>(authPaths.sessions);

// Ответ — 204 без тела. Если отозвана текущая сессия, сервер сам чистит куки,
// клиенту остаётся сбросить локальное состояние (`expireSession`).
export const revokeSession = (sessionId: string): Promise<void> =>
  apiJson<void>(authPaths.session(sessionId), { method: 'DELETE' });

// Разбор User-Agent для списка устройств. Это эвристика для интерфейса, а не
// безопасность: показываем понятную подпись, незнакомый агент не ломает список.

interface Matcher {
  pattern: RegExp;
  label: string;
}

// Порядок важен: Edge и Opera маскируются под Chrome, Chrome — под Safari.
const browserMatchers: readonly Matcher[] = [
  { pattern: /Edg(A|iOS)?\//, label: 'Edge' },
  { pattern: /OPR\/|Opera/, label: 'Opera' },
  { pattern: /YaBrowser\//, label: 'Яндекс.Браузер' },
  { pattern: /Firefox\/|FxiOS\//, label: 'Firefox' },
  { pattern: /CriOS\/|Chrome\//, label: 'Chrome' },
  { pattern: /Safari\//, label: 'Safari' },
];

// iOS-агент содержит «Mac OS X», Android — «Linux», поэтому мобильные впереди.
const osMatchers: readonly Matcher[] = [
  { pattern: /Windows/, label: 'Windows' },
  { pattern: /Android/, label: 'Android' },
  { pattern: /iPhone|iPad|iPod/, label: 'iOS' },
  { pattern: /CrOS/, label: 'ChromeOS' },
  { pattern: /Mac OS X|Macintosh/, label: 'macOS' },
  { pattern: /Linux/, label: 'Linux' },
];

const mobilePattern = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/;

const UNKNOWN_DEVICE_LABEL = 'Неизвестное устройство';

export interface SessionDevice {
  browser: string | null;
  os: string | null;
  mobile: boolean;
  // Готовая подпись для строки списка.
  label: string;
}

const matchLabel = (
  userAgent: string,
  matchers: readonly Matcher[],
): string | null =>
  matchers.find(({ pattern }) => pattern.test(userAgent))?.label ?? null;

export const describeSessionDevice = (
  userAgent: string | null,
): SessionDevice => {
  if (!userAgent) {
    return {
      browser: null,
      os: null,
      mobile: false,
      label: UNKNOWN_DEVICE_LABEL,
    };
  }

  const browser = matchLabel(userAgent, browserMatchers);
  const os = matchLabel(userAgent, osMatchers);
  const label = [browser, os].filter(Boolean).join(' · ');

  return {
    browser,
    os,
    mobile: mobilePattern.test(userAgent),
    label: label || UNKNOWN_DEVICE_LABEL,
  };
};
