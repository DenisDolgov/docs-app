'use client';

import type { DocumentShareDto } from '@docs-app/contracts/document';
import { type SubmitEventHandler, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
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
import { ApiError, type DocumentDto } from '@/lib/api';
import {
  createPublicLink,
  grantDocumentShare,
  listDocumentShares,
  listPublicLinks,
  type PublicLinkDto,
  revokeDocumentShare,
  revokePublicLink,
} from '@/lib/documents';

const roleLabels: Record<DocumentShareDto['role'], string> = {
  viewer: 'Читатель',
  commenter: 'Комментатор',
  editor: 'Редактор',
};

const roleOptions = [
  { value: 'viewer', label: 'Читатель' },
  { value: 'commenter', label: 'Комментатор' },
  { value: 'editor', label: 'Редактор' },
] as const;

const expiryOptions = [
  { value: 'never', label: 'Бессрочно' },
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
] as const;

const shareErrorMessage = (caught: unknown): string => {
  if (!(caught instanceof ApiError)) {
    return 'Не удалось выдать доступ. Попробуйте ещё раз.';
  }

  switch (caught.status) {
    case 403:
      return 'Раздавать доступ может только владелец документа';
    case 404:
      return 'Пользователь с такой почтой не найден';
    default:
      return 'Не удалось выдать доступ. Попробуйте ещё раз.';
  }
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export const ShareDocumentDialog = ({
  document,
  open,
  onOpenChange,
}: {
  document: DocumentDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [shares, setShares] = useState<DocumentShareDto[] | null>(null);
  const [links, setLinks] = useState<PublicLinkDto[] | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<DocumentShareDto['role']>('viewer');
  const [expiry, setExpiry] =
    useState<(typeof expiryOptions)[number]['value']>('never');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    setShares(null);
    setLinks(null);
    setHasLoadError(false);
    setCreatedLink(null);

    Promise.all([listDocumentShares(document.id), listPublicLinks(document.id)])
      .then(([shareList, linkList]) => {
        if (cancelled) return;

        setShares(shareList);
        setLinks(linkList);
      })
      .catch(() => {
        if (!cancelled) setHasLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, document.id]);

  useEffect(() => {
    if (open) return;

    setEmail('');
    setRole('viewer');
    setExpiry('never');
    setFormError(null);
    setIsSubmitting(false);
    setIsCreatingLink(false);
    setCreatedLink(null);
  }, [open]);

  const handleShare: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setFormError(null);
    setIsSubmitting(true);

    try {
      const share = await grantDocumentShare({
        documentId: document.id,
        email: trimmedEmail,
        role,
      });

      setShares((current) =>
        current
          ? [...current.filter((item) => item.userId !== share.userId), share]
          : [share],
      );
      setEmail('');
      toast.add({ type: 'success', title: 'Доступ выдан' });
    } catch (caught) {
      setFormError(shareErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeShare = async (share: DocumentShareDto) => {
    try {
      await revokeDocumentShare(document.id, share.userId);
      setShares(
        (current) =>
          current?.filter((item) => item.userId !== share.userId) ?? null,
      );
      toast.add({ type: 'success', title: 'Доступ отозван' });
    } catch {
      toast.add({ type: 'error', title: 'Не удалось отозвать доступ' });
    }
  };

  const handleCreateLink = async () => {
    setIsCreatingLink(true);

    try {
      const days = expiry === 'never' ? null : Number(expiry);
      const expiresAt = days
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const created = await createPublicLink(document.id, expiresAt);
      // Токен живёт только в строке ссылки: в списке ему делать нечего.
      const { token, ...link } = created;

      setLinks((current) => (current ? [link, ...current] : [link]));
      setCreatedLink(`${window.location.origin}/public/documents/${token}`);
      toast.add({ type: 'success', title: 'Ссылка создана' });
    } catch {
      toast.add({ type: 'error', title: 'Не удалось создать ссылку' });
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleRevokeLink = async (link: PublicLinkDto) => {
    try {
      await revokePublicLink(document.id, link.id);
      setLinks(
        (current) =>
          current?.map((item) =>
            item.id === link.id
              ? { ...item, revokedAt: new Date().toISOString() }
              : item,
          ) ?? null,
      );
      toast.add({ type: 'success', title: 'Ссылка отозвана' });
    } catch {
      toast.add({ type: 'error', title: 'Не удалось отозвать ссылку' });
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.add({ type: 'success', title: 'Ссылка скопирована' });
    } catch {
      toast.add({ type: 'error', title: 'Не удалось скопировать' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Доступ к документу</DialogTitle>
          <DialogDescription className="truncate">
            {document.title}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto pr-1">
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Только по приглашению</h3>

            {shares === null && !hasLoadError && (
              <div className="flex justify-center py-4">
                <Spinner className="size-5" />
              </div>
            )}

            {hasLoadError && (
              <p className="text-sm text-muted-foreground">
                Не удалось загрузить список доступа.
              </p>
            )}

            {shares?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Доступ никому не выдан.
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {shares?.map((share) => (
                <li
                  key={share.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    {share.email}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{roleLabels[share.role]}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeShare(share)}
                    >
                      Убрать
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <form onSubmit={handleShare} className="flex flex-col gap-3">
              <Field data-invalid={formError ? true : undefined}>
                <FieldLabel htmlFor="share-email">Выдать доступ</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="share-email"
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
                      setRole(event.target.value as DocumentShareDto['role'])
                    }
                  >
                    {roleOptions.map((option) => (
                      <NativeSelectOption
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                {formError && <FieldError>{formError}</FieldError>}
              </Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Выдаём…' : 'Выдать доступ'}
              </Button>
            </form>
          </section>

          <section className="flex flex-col gap-3 border-t pt-4">
            <h3 className="text-sm font-medium">По публичной ссылке</h3>
            <p className="text-sm text-muted-foreground">
              Ссылка даёт только чтение. Любой, у кого она есть, откроет
              документ без входа.
            </p>

            {links?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Публичных ссылок пока нет.
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {links?.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <span className="text-sm">
                    {link.revokedAt
                      ? 'Отозвана'
                      : link.expiresAt
                        ? `до ${formatDate(link.expiresAt)}`
                        : 'бессрочная'}
                  </span>
                  {!link.revokedAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeLink(link)}
                    >
                      Отозвать
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            {createdLink && (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
                <p className="text-xs text-muted-foreground">
                  Ссылка показывается один раз — скопируйте её сейчас.
                </p>
                <code className="break-all text-xs">{createdLink}</code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyLink(createdLink)}
                >
                  Скопировать
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <NativeSelect
                aria-label="Срок действия ссылки"
                value={expiry}
                onChange={(event) =>
                  setExpiry(
                    event.target
                      .value as (typeof expiryOptions)[number]['value'],
                  )
                }
              >
                {expiryOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button
                type="button"
                variant="outline"
                disabled={isCreatingLink}
                onClick={handleCreateLink}
              >
                {isCreatingLink ? 'Создаём…' : 'Создать ссылку'}
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
