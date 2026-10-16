// Общие имена куки и адрес API. Куками владеет сервер (обе httpOnly); фронт
// читает только access-куку — серверному гейту `proxy.ts` она нужна на всех
// маршрутах.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const ACCESS_COOKIE_NAME = '__Host-access';
export const REFRESH_COOKIE_NAME = 'docs.refreshToken';
