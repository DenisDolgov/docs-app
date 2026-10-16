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
  register as apiRegister,
  bootstrapUser,
  type User,
} from '@/lib/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const authRoutes = ['/login', '/register'];

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

  // Навигационный гейт на клиенте: серверный прокси проверяет только наличие
  // refresh-cookie, а здесь сессия подтверждается вызовом /auth/refresh.
  useEffect(() => {
    if (status === 'loading') return;

    const onAuthRoute = authRoutes.includes(pathname);

    if (status === 'unauthenticated' && !onAuthRoute) {
      router.replace('/login');
    } else if (status === 'authenticated' && onAuthRoute) {
      router.replace('/');
    }
  }, [status, pathname, router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
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
