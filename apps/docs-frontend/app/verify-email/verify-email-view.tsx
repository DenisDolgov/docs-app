'use client';

import { CircleCheckIcon, MailWarningIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldError } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { resendVerificationEmail, verifyEmail } from '@/lib/api';

type VerificationState = 'verifying' | 'verified' | 'failed';

export const VerifyEmailView = ({ token }: { token: string | null }) => {
  const { user, status, refreshUser } = useAuth();
  const [state, setState] = useState<VerificationState>(
    token ? 'verifying' : 'failed',
  );
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const requestedToken = useRef<string | null>(null);

  useEffect(() => {
    // В dev StrictMode эффекты запускаются дважды. Токен одноразовый, поэтому
    // второй запрос получил бы 400 и затёр успешный результат — шлём один раз
    // на токен.
    if (requestedToken.current === token) return;
    requestedToken.current = token;

    if (!token) {
      setState('failed');
      return;
    }

    verifyEmail(token)
      .then(() => setState('verified'))
      .catch(() => setState('failed'));
  }, [token]);

  // Профиль мог быть прочитан до подтверждения — обновляем `emailVerified`,
  // чтобы баннер на главной не висел.
  useEffect(() => {
    if (state !== 'verified' || status !== 'authenticated') return;

    refreshUser().catch(() => undefined);
  }, [state, status, refreshUser]);

  const handleResend = async () => {
    setSendError(null);
    setIsSending(true);

    try {
      await resendVerificationEmail();
      setIsSent(true);
    } catch {
      setSendError('Не удалось отправить письмо. Попробуйте ещё раз.');
    } finally {
      setIsSending(false);
    }
  };

  const canResend =
    status === 'authenticated' && user !== null && !user.emailVerified;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        {state === 'verifying' && (
          <>
            <CardHeader>
              <CardTitle>Подтверждаем почту</CardTitle>
              <CardDescription>Это займёт пару секунд.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-4">
              <Spinner className="size-6" />
            </CardContent>
          </>
        )}

        {state === 'verified' && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleCheckIcon className="size-5 text-emerald-600" />
                Почта подтверждена
              </CardTitle>
              <CardDescription>
                Аккаунт активен: можно создавать организации и приглашать
                участников.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                render={
                  <Link href={status === 'authenticated' ? '/' : '/login'} />
                }
                className="w-full"
              >
                {status === 'authenticated' ? 'К документам' : 'Войти'}
              </Button>
            </CardContent>
          </>
        )}

        {state === 'failed' && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailWarningIcon className="size-5 text-amber-600" />
                Не удалось подтвердить почту
              </CardTitle>
              <CardDescription>
                Ссылка повреждена, истекла или уже была использована. Можно
                запросить новое письмо.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {canResend ? (
                <>
                  <Button onClick={handleResend} disabled={isSending || isSent}>
                    {isSending && <Spinner />}
                    {isSent ? 'Письмо отправлено' : 'Отправить письмо ещё раз'}
                  </Button>
                  {isSent && (
                    <p className="text-sm text-muted-foreground">
                      Проверьте почту {user.email} — ссылка действует 24 часа.
                    </p>
                  )}
                  {sendError && <FieldError>{sendError}</FieldError>}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Войдите в аккаунт и запросите новое письмо из главной
                    страницы.
                  </p>
                  <Button variant="outline" render={<Link href="/login" />}>
                    Войти
                  </Button>
                </>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};
