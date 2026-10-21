'use client';

import { MailWarningIcon } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { resendVerificationEmail } from '@/lib/api';

// Напоминание на главной: без подтверждённой почты бэкенд не даёт создавать
// организации и приглашать участников (`EmailVerificationPolicy`).
export const EmailVerificationBanner = () => {
  const { user, status } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  if (status !== 'authenticated' || !user || user.emailVerified) return null;

  const handleResend = async () => {
    setIsSending(true);

    try {
      await resendVerificationEmail();
      setIsSent(true);
      toast.add({
        type: 'success',
        title: 'Письмо отправлено',
        description: `Проверьте ${user.email}`,
      });
    } catch {
      toast.add({
        type: 'error',
        title: 'Не удалось отправить письмо',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto max-w-7xl px-16 py-3">
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <MailWarningIcon />
          <AlertTitle>Подтвердите почту</AlertTitle>
          <AlertDescription className="text-amber-900/80">
            {isSent
              ? `Письмо отправлено на ${user.email}. Ссылка действует 24 часа.`
              : `Мы отправили ссылку на ${user.email}. Пока почта не подтверждена, организации и приглашения недоступны.`}
          </AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="xs"
              onClick={handleResend}
              disabled={isSending}
            >
              {isSending && <Spinner />}
              {isSent ? 'Отправить ещё раз' : 'Отправить снова'}
            </Button>
          </AlertAction>
        </Alert>
      </div>
    </div>
  );
};
