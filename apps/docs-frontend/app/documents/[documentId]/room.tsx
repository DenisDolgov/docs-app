'use client';

import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from '@liveblocks/react/suspense';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';

export const Room = ({ children }: { children: ReactNode }) => {
  const params = useParams<{ documentId: string }>();

  return (
    <LiveblocksProvider
      publicApiKey={
        'pk_dev_XDq5VW77aLggEuRA7mdsyjpT73RZzIjvYdgptOZHMuOuAJIB52ja32KLmnHVuMjh'
      }
    >
      <RoomProvider id={params.documentId}>
        <ClientSideSuspense fallback={<div>Loading…</div>}>
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
};
