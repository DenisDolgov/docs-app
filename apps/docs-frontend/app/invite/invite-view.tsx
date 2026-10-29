'use client';

import type { OrganizationRole } from '@docs-app/contracts/organization';
import { CircleCheckIcon, MailWarningIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { useOrganization } from '@/components/organization-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import {
  acceptOrganizationInvite,
  organizationRoleLabels,
} from '@/lib/organizations';

type InviteState = 'accepting' | 'accepted' | 'failed';

export const InviteView = ({ token }: { token: string | null }) => {
  const { status } = useAuth();
  const { refreshOrganizations } = useOrganization();
  const [state, setState] = useState<InviteState>('accepting');
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [role, setRole] = useState<OrganizationRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedToken = useRef<string | null>(null);

  useEffect(() => {
    // Токен одноразовый: в StrictMode эффект запускается дважды, второй запрос
    // получил бы «уже принято» и затёр успешный результат.
    if (!token || status !== 'authenticated') return;
    if (requestedToken.current === token) return;
    requestedToken.current = token;

    acceptOrganizationInvite(token)
      .then(async (accepted) => {
        setOrganizationName(accepted.organizationName);
        setRole(accepted.role);
        setState('accepted');
        await refreshOrganizations();
      })
      .catch((caught) => {
        setError(inviteErrorMessage(caught));
        setState('failed');
      });
  }, [token, status, refreshOrganizations]);

  if (!token) {
    return (
      <InviteFrame title="Ссылка неполная">
        <p className="text-sm text-muted-foreground">
          В адресе нет токена приглашения. Откройте ссылку из письма целиком.
        </p>
      </InviteFrame>
    );
  }

  if (status === 'loading') {
    return (
      <InviteFrame title="Приглашение">
        <div className="flex justify-center py-4">
          <Spinner className="size-5" />
        </div>
      </InviteFrame>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <InviteFrame title="Войдите, чтобы принять приглашение">
        <p className="text-sm text-muted-foreground">
          Приглашение привязано к почте аккаунта. Войдите или зарегистрируйтесь
          с тем адресом, на который пришло письмо, и откройте ссылку ещё раз.
        </p>
        <div className="flex gap-2">
          <Button render={<Link href="/login" />}>Войти</Button>
          <Button variant="outline" render={<Link href="/register" />}>
            Регистрация
          </Button>
        </div>
      </InviteFrame>
    );
  }

  if (state === 'accepted') {
    return (
      <InviteFrame title="Вы в организации">
        <div className="flex items-center gap-2 text-sm">
          <CircleCheckIcon className="size-4 text-primary" />
          <span>
            {organizationName}
            {role && ` · ${organizationRoleLabels[role].toLowerCase()}`}
          </span>
        </div>
        <Button render={<Link href="/" />}>К документам</Button>
      </InviteFrame>
    );
  }

  if (state === 'failed') {
    return (
      <InviteFrame title="Приглашение не сработало">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MailWarningIcon className="size-4" />
          <span>{error}</span>
        </div>
        <Button variant="outline" render={<Link href="/" />}>
          На главную
        </Button>
      </InviteFrame>
    );
  }

  return (
    <InviteFrame title="Принимаем приглашение">
      <div className="flex justify-center py-4">
        <Spinner className="size-5" />
      </div>
    </InviteFrame>
  );
};

const InviteFrame = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex min-h-screen items-center justify-center p-6">
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Приглашение в организацию</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  </div>
);

const inviteErrorMessage = (caught: unknown): string => {
  if (!(caught instanceof ApiError)) {
    return 'Не удалось принять приглашение. Попробуйте ещё раз.';
  }

  switch (caught.status) {
    case 403:
      return 'Приглашение выдано на другую почту. Войдите под адресом из письма.';
    case 400:
      return 'Приглашение истекло, отозвано или уже использовано.';
    default:
      return 'Не удалось принять приглашение. Попробуйте ещё раз.';
  }
};
