'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  login as apiLogin,
  logout as apiLogout,
  logoutAll as apiLogoutAll,
  register as apiRegister,
  bootstrapUser,
  fetchMe,
  setSessionExpiredHandler,
  type User,
} from '@/lib/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  // Сессию уже закрыл сервер: чистим только локальное состояние.
  expireSession: () => void;
  // Перечитать профиль: нужен после подтверждения почты, чтобы флаги
  // (`emailVerified`) в интерфейсе обновились без перезагрузки страницы.
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Доступны без сессии: сброс пароля и подтверждение почты открываются по
// ссылке из письма, в том числе в браузере без активной сессии.
const publicAuthRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/invite',
];

// Публичный просмотр открыт без сессии и живёт в отдельном префиксе.
const isPublicRoute = (pathname: string) =>
  publicAuthRoutes.includes(pathname) || pathname.startsWith('/public/');

// Со страниц входа и регистрации авторизованного пользователя уводим на
// главную. Остальные публичные страницы открываются как есть: иначе переход
// по ссылке подтверждения из письма молча пропускался бы.
const guestOnlyRoutes = ['/login', '/register'];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    bootstrapUser()
      .then((restored) => {
        setUser(restored);
        setStatus(restored ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => setStatus('unauthenticated'));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const authenticated = await apiLogin(email, password);
    setUser(authenticated);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await apiRegister(email, password);
    const authenticated = await apiLogin(email, password);
    setUser(authenticated);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const logoutAll = useCallback(async () => {
    await apiLogoutAll();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Отзыв текущей сессии из списка устройств: куки почистил бэкенд, поэтому
  // API не зовём. На /login уводит навигационный гейт ниже.
  const expireSession = useCallback(() => {
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refreshUser = useCallback(async () => {
    const restored = await fetchMe();
    setUser(restored);
    setStatus('authenticated');
  }, []);

  // Жёсткий конец сессии (refresh вернул 401) — сбрасываем состояние и уходим
  // на /login. С публичных страниц (ссылка из письма) не уводим: сессия там не
  // нужна, а редирект съел бы результат подтверждения или сброса пароля.
  // Дедупликация живёт в `auth-session`.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('unauthenticated');

      if (!isPublicRoute(pathname)) {
        router.replace('/login');
      }
    });
  }, [pathname, router]);

  // Навигационный гейт на клиенте: серверный прокси проверяет только наличие
  // access-куки, а здесь сессия подтверждается вызовом /auth/me (+ refresh).
  useEffect(() => {
    if (status === 'loading') return;

    const isPublic = isPublicRoute(pathname);

    if (status === 'unauthenticated' && !isPublic) {
      router.replace('/login');
    } else if (
      status === 'authenticated' &&
      guestOnlyRoutes.includes(pathname)
    ) {
      router.replace('/');
    }
  }, [status, pathname, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      logoutAll,
      expireSession,
      refreshUser,
    }),
    [
      user,
      status,
      login,
      register,
      logout,
      logoutAll,
      expireSession,
      refreshUser,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth должен вызываться внутри AuthProvider');
  }

  return context;
};
