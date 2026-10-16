'use client';

import { useParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useAuth } from '@/components/auth-provider';
import { ScreenLoader } from '@/components/screen-loader';
import { getAccessToken } from '@/lib/api';
import {
  type CollabCloseInfo,
  CollabProvider,
  type CollabStatus,
} from '@/lib/collab/provider';

const COLLAB_WS_URL =
  process.env.NEXT_PUBLIC_COLLAB_WS_URL ?? 'ws://localhost:3001';

export type { CollabStatus } from '@/lib/collab/provider';

interface RoomContextValue {
  provider: CollabProvider;
  status: CollabStatus;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export const useRoom = (): RoomContextValue => {
  const context = useContext(RoomContext);

  if (!context) {
    throw new Error('useRoom должен вызываться внутри Room');
  }

  return context;
};

export const Room = ({ children }: { children: ReactNode }) => {
  const params = useParams<{ documentId: string }>();
  const { status: authStatus } = useAuth();
  const [provider, setProvider] = useState<CollabProvider | null>(null);
  const [status, setStatus] = useState<CollabStatus>('connecting');
  const [closeInfo, setCloseInfo] = useState<CollabCloseInfo | null>(null);

  // Провайдер создаём только при готовой сессии и уничтожаем при размонтировании.
  useEffect(() => {
    if (authStatus !== 'authenticated') return;

    const token = getAccessToken();
    if (!token) return;

    const created = new CollabProvider({
      documentId: params.documentId,
      token,
      url: COLLAB_WS_URL,
      onStatusChange: setStatus,
      onClose: setCloseInfo,
    });
    setProvider(created);

    return () => {
      created.destroy();
      setProvider(null);
      setCloseInfo(null);
    };
  }, [authStatus, params.documentId]);

  if (closeInfo) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        {closeInfo.message}
      </div>
    );
  }

  if (!provider) {
    return <ScreenLoader label="Подключение к документу..." />;
  }

  return <RoomContext value={{ provider, status }}>{children}</RoomContext>;
};
