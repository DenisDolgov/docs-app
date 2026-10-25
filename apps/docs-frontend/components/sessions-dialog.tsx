'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { LaptopIcon, SmartphoneIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import {
  describeSessionDevice,
  listSessions,
  revokeSession,
  type Session,
} from '@/lib/sessions';

const formatLastUsed = (lastUsedAt: string) =>
  formatDistanceToNow(new Date(lastUsedAt), { addSuffix: true, locale: ru });

// Диалог со всеми живыми сессиями аккаунта. Текущую сессию сервер помечает
// флагом `current`; её отзыв означает выход на этом устройстве.
export const SessionsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { expireSession } = useAuth();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  // Номер последнего запроса: быстрый повтор или переоткрытие диалога не должны
  // перетирать свежий список ответом предыдущего запроса.
  const requestId = useRef(0);

  const loadSessions = useCallback(() => {
    const currentRequest = ++requestId.current;

    setSessions(null);
    setHasLoadError(false);

    listSessions()
      .then((list) => {
        if (requestId.current === currentRequest) setSessions(list);
      })
      .catch(() => {
        if (requestId.current === currentRequest) setHasLoadError(true);
      });
  }, []);

  useEffect(() => {
    if (open) loadSessions();
  }, [open, loadSessions]);

  useEffect(() => {
    if (open) return;

    setRevokingId(null);
  }, [open]);

  const handleRevoke = async (session: Session) => {
    setRevokingId(session.id);

    try {
      await revokeSession(session.id);

      if (session.current) {
        toast.add({
          type: 'success',
          title: 'Вы вышли на этом устройстве',
        });
        onOpenChange(false);
        // Куки уже почистил сервер, остаётся сбросить состояние на клиенте.
        expireSession();
        return;
      }

      setSessions((current) =>
        current ? current.filter((item) => item.id !== session.id) : current,
      );
      toast.add({ type: 'success', title: 'Сессия завершена' });
    } catch {
      toast.add({ type: 'error', title: 'Не удалось завершить сессию' });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Устройства и сессии</DialogTitle>
          <DialogDescription>
            Все браузеры и устройства, где выполнен вход в ваш аккаунт.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-80 overflow-y-auto px-1">
          {sessions === null && !hasLoadError && (
            <div className="flex justify-center py-6">
              <Spinner className="size-5" />
            </div>
          )}

          {hasLoadError && (
            <div className="flex flex-col items-start gap-2 py-2">
              <p className="text-sm text-muted-foreground">
                Не удалось загрузить сессии.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadSessions()}
              >
                Повторить
              </Button>
            </div>
          )}

          {sessions?.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              Активных сессий нет.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {sessions?.map((session) => {
              const device = describeSessionDevice(session.userAgent);
              const isRevoking = revokingId === session.id;

              return (
                <li
                  key={session.id}
                  className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-muted-foreground">
                      {device.mobile ? (
                        <SmartphoneIcon className="size-4" />
                      ) : (
                        <LaptopIcon className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {device.label}
                        </span>
                        {session.current && (
                          <Badge variant="secondary">Текущая</Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.ip ?? 'IP неизвестен'}
                      </p>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        title={format(
                          new Date(session.lastUsedAt),
                          'dd.MM.yyyy, HH:mm',
                        )}
                      >
                        Активность {formatLastUsed(session.lastUsedAt)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Вход:{' '}
                        {format(
                          new Date(session.createdAt),
                          'dd.MM.yyyy, HH:mm',
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={isRevoking}
                    onClick={() => handleRevoke(session)}
                  >
                    {isRevoking ? (
                      <Spinner className="size-3.5" />
                    ) : session.current ? (
                      'Выйти'
                    ) : (
                      'Завершить'
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
};
