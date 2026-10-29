'use client';

import { FileWarningIcon, LockIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { type PublicDocumentDto, getPublicDocument } from '@/lib/documents';

type PublicState =
  | { status: 'loading' }
  | { status: 'ready'; document: PublicDocumentDto }
  | { status: 'missing' };

// Публичное чтение по ссылке: без сессии и без редактора. В v1.0 ссылка даёт
// только просмотр заголовка — прав и WS-комнаты у анонима нет.
export const PublicDocumentView = ({ token }: { token: string }) => {
  const [state, setState] = useState<PublicState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    getPublicDocument(token)
      .then((document) => {
        if (!cancelled) setState({ status: 'ready', document });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'missing' });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === 'loading') {
    return (
      <PublicFrame>
        <div className="flex justify-center py-6">
          <Spinner className="size-5" />
        </div>
      </PublicFrame>
    );
  }

  if (state.status === 'missing') {
    return (
      <PublicFrame>
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <FileWarningIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Ссылка не работает: она отозвана, истекла или документ удалён.
          </span>
        </div>
        <Button variant="outline" render={<Link href="/login" />}>
          Войти в Docs
        </Button>
      </PublicFrame>
    );
  }

  return (
    <PublicFrame>
      <div className="flex flex-col gap-2">
        <CardTitle className="text-xl break-words">
          {state.document.title}
        </CardTitle>
        <CardDescription>
          Обновлён{' '}
          {new Date(state.document.updatedAt).toLocaleDateString('ru-RU')}
        </CardDescription>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <LockIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          Доступ только для чтения. Чтобы комментировать и редактировать,
          попросите владельца выдать доступ на аккаунт.
        </span>
      </div>
      <Button variant="outline" render={<Link href="/login" />}>
        Войти в Docs
      </Button>
    </PublicFrame>
  );
};

const PublicFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center p-6">
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardDescription>Публичный просмотр</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  </div>
);
