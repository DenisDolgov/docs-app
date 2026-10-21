'use client';

import type {
  OrganizationMemberDto,
  OrganizationRole,
} from '@docs-app/contracts/organization';
import { type SubmitEventHandler, useEffect, useState } from 'react';

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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
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
  addOrganizationMember,
  canManageMembers,
  listOrganizationMembers,
} from '@/lib/organizations';

const roleLabels: Record<OrganizationRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
};

const assignableRoles = [
  { value: 'admin', label: 'Администратор' },
  { value: 'member', label: 'Участник' },
] as const satisfies readonly {
  value: AssignableOrganizationRole;
  label: string;
}[];

const addMemberErrorMessage = (caught: unknown): string => {
  if (!(caught instanceof ApiError)) {
    return 'Не удалось добавить участника. Попробуйте ещё раз.';
  }

  switch (caught.status) {
    case 403:
      return 'Подтвердите почту, чтобы управлять участниками';
    case 404:
      return 'Пользователь с такой почтой не найден';
    case 409:
      return 'Этот пользователь уже состоит в организации';
    default:
      return 'Не удалось добавить участника. Попробуйте ещё раз.';
  }
};

export const OrganizationMembersDialog = ({
  organization,
  open,
  onOpenChange,
}: {
  organization: OrganizationDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<OrganizationMemberDto[] | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableOrganizationRole>('member');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    setMembers(null);
    setHasLoadError(false);

    listOrganizationMembers(organization.id)
      .then((list) => {
        if (!cancelled) setMembers(list);
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
  }, [open]);

  const isVerificationRequired =
    canManageMembers(organization.role) && user?.emailVerified !== true;
  const canAddMembers =
    canManageMembers(organization.role) && user?.emailVerified === true;

  const handleAdd: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setFormError(null);
    setIsSubmitting(true);

    try {
      const member = await addOrganizationMember({
        organizationId: organization.id,
        email: trimmedEmail,
        role,
      });

      setMembers((current) => (current ? [...current, member] : [member]));
      setEmail('');
      toast.add({ type: 'success', title: 'Участник добавлен' });
    } catch (caught) {
      setFormError(addMemberErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Участники</DialogTitle>
          <DialogDescription>{organization.name}</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-72 overflow-y-auto px-1">
          {members === null && !hasLoadError && (
            <div className="flex justify-center py-6">
              <Spinner className="size-5" />
            </div>
          )}

          {hasLoadError && (
            <p className="py-2 text-sm text-muted-foreground">
              Не удалось загрузить участников.
            </p>
          )}

          {members?.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              В организации пока никого нет.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {members?.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm">{member.email}</span>
                <Badge
                  variant={member.role === 'owner' ? 'default' : 'secondary'}
                >
                  {roleLabels[member.role]}
                </Badge>
              </li>
            ))}
          </ul>
        </div>

        {canAddMembers && (
          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-3 border-t pt-4"
          >
            <Field data-invalid={formError ? true : undefined}>
              <FieldLabel htmlFor="member-email">Добавить участника</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="member-email"
                  type="email"
                  autoComplete="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <NativeSelect
                  aria-label="Роль"
                  className="w-40 shrink-0"
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as AssignableOrganizationRole)
                  }
                >
                  {assignableRoles.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <FieldDescription>
                Пользователь должен быть уже зарегистрирован.
              </FieldDescription>
              {formError && <FieldError>{formError}</FieldError>}
            </Field>
            <Button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="self-start"
            >
              {isSubmitting && <Spinner />}
              Добавить
            </Button>
          </form>
        )}

        {isVerificationRequired && (
          <p className="border-t pt-4 text-sm text-muted-foreground">
            Подтвердите почту, чтобы добавлять участников.
          </p>
        )}

        {!canAddMembers && !isVerificationRequired && (
          <p className="border-t pt-4 text-sm text-muted-foreground">
            Добавлять участников могут владелец и администратор.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
