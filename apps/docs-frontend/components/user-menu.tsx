'use client';

import {
  CircleUserIcon,
  LogOutIcon,
  MailWarningIcon,
  MonitorSmartphoneIcon,
  MonitorXIcon,
} from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { SessionsDialog } from '@/components/sessions-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { resendVerificationEmail } from '@/lib/api';

export const UserMenu = () => {
  const { user, logout, logoutAll } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);

  if (!user) return null;

  const handleResend = async () => {
    setIsSending(true);

    try {
      await resendVerificationEmail();
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="rounded-full">
              <CircleUserIcon className="size-5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="max-w-[220px] truncate">
            {user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!user.emailVerified && (
            <DropdownMenuItem onClick={handleResend} disabled={isSending}>
              {isSending ? (
                <Spinner className="size-4" />
              ) : (
                <MailWarningIcon className="size-4" />
              )}
              Подтвердить почту
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setIsSessionsOpen(true)}>
            <MonitorSmartphoneIcon className="size-4" />
            Устройства и сессии
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => logout()}>
            <LogOutIcon className="size-4" />
            Выйти
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => logoutAll()}>
            <MonitorXIcon className="size-4" />
            Выйти на всех устройствах
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SessionsDialog open={isSessionsOpen} onOpenChange={setIsSessionsOpen} />
    </>
  );
};
