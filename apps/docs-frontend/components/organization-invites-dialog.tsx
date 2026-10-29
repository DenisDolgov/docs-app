'use client';

import type { OrganizationInviteDto } from '@docs-app/contracts/organization';
import { type SubmitEventHandler, useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { ApiError, type OrganizationDto } from '@/lib/api';
import {
  type AssignableOrganizationRole,
  assignableRoleOptions,
  canManageMembers,
  inviteOrganizationMember,
  listOrganizationInvites,
  organizationRoleLabels,
  resendOrganizationInvite,
  revokeOrganizationInvite,
} from '@/lib/organizations';

const inviteErrorMessage = (caught: unknown): string => {
  if (!(caught instanceof ApiError)) {
    return 'Не удалось отправить приглашение. Попробуйте ещё раз.';
  }

  switch (caught.status) {
    case 403:
      return 'Подтвердите почту, чтобы приглашать участников';
    case 409:
      return 'Этот пользователь уже состоит в организации';
    default:
      return 'Не удалось отправить приглашение. Попробуйте ещё раз.';
  }
};

export const OrganizationInvitesDialog = ({
  organization,
  open,
  onOpenChange,
}: {
  organization: OrganizationDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { user } = useAuth();
  const [invites, setInvites] = useState<OrganizationInviteDto[] | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableOrganizationRole>('member');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    setInvites(null);
    setHasLoadError(false);

    listOrganizationInvites(organization.id)
      .then((list) => {
        if (!cancelled) setInvites(list);
      })
      .catch(() => {
        if (!cancelled) setHasLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, organization.id]);

  useEffect(() => {
    if (open) return;

    setEmail('');
    setRole('member');
    setFormError(null);
    setIsSubmitting(false);
    setBusyId(null);
  }, [open]);

  const canInvite =
    canManageMembers(organization.role) && user?.emailVerified === true;

  const upsertInvite = (invite: OrganizationInviteDto) => {
    setInvites((current) => {
      if (!current) return [invite];

      // Новое приглашение на тот же адрес гасит прежнее: оставляем только его.
      const withoutSameEmail = current.filter(
        (item) => item.email !== invite.email,
      );

      return [invite, ...withoutSameEmail];
    });
  };

  const handleInvite: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setFormError(null);
    setIsSubmitting(true);

    try {
      const invite = await inviteOrganizationMember({
        organizationId: organization.id,
        email: trimmedEmail,
        role,
      });

      upsertInvite(invite);
      setEmail('');
      toast.add({ type: 'success', title: 'Приглашение отправлено' });
    } catch (caught) {
      setFormError(inviteErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (invite: OrganizationInviteDto) => {
    setBusyId(invite.id);

    try {
      const resent = await resendOrganizationInvite({
        organizationId: organization.id,
        inviteId: invite.id,
      });

      upsertInvite(resent);
      toast.add({ type: 'success', title: 'Приглашение отправлено заново' });
    } catch {
      toast.add({ type: 'error', title: 'Не удалось переотправить письмо' });
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (invite: OrganizationInviteDto) => {
    setBusyId(invite.id);

    try {
      await revokeOrganizationInvite({
        organizationId: organization.id,
        inviteId: invite.id,
      });

      setInvites(
        (current) => current?.filter((item) => item.id !== invite.id) ?? null,
      );
      toast.add({ type: 'success', title: 'Приглашение отозвано' });
    } catch {
      toast.add({ type: 'error', title: 'Не удалось отозвать приглашение' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Приглашения</DialogTitle>
          <DialogDescription>{organization.name}</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-72 overflow-y-auto px-1">
          {invites === null && !hasLoadError && (
            <div className="flex justify-center py-6">
              <Spinner className="size-5" />
            </div>
          )}

          {hasLoadError && (
            <p className="py-2 text-sm text-muted-foreground">
              Не удалось загрузить приглашения.
            </p>
          )}

          {invites?.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              Приглашений пока нет.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {invites?.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {organizationRoleLabels[invite.role]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === invite.id}
                    onClick={() => handleResend(invite)}
                  >
                    Ещё раз
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === invite.id}
                    onClick={() => handleRevoke(invite)}
                  >
                    Отозвать
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {canInvite && (
          <form
            onSubmit={handleInvite}
            className="flex flex-col gap-3 border-t pt-4"
          >
            <Field data-invalid={formError ? true : undefined}>
              <FieldLabel htmlFor="invite-email">
                Пригласить по почте
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <NativeSelect
                  aria-label="Роль"
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as AssignableOrganizationRole)
                  }
                >
                  {assignableRoleOptions.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <p className="text-xs text-muted-foreground">
                Ссылка из письма одноразовая.
              </p>
              {formError && <FieldError>{formError}</FieldError>}
            </Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Отправляем…' : 'Отправить приглашение'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
