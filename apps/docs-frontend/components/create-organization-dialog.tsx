'use client';

import { type SubmitEventHandler, useEffect, useState } from 'react';

import { useOrganization } from '@/components/organization-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';

export const CreateOrganizationDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { createOrganization } = useOrganization();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) return;

    setName('');
    setError(null);
    setIsSubmitting(false);
  }, [open]);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await createOrganization(trimmedName);
      toast.add({ type: 'success', title: 'Организация создана' });
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setError('Подтвердите почту, чтобы создавать организации');
      } else {
        setError('Не удалось создать организацию. Попробуйте ещё раз.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(event) => event.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Новая организация</DialogTitle>
            <DialogDescription>
              Документы организации доступны её участникам.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="organization-name">Название</FieldLabel>
              <Input
                id="organization-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Например, «Академия»"
                required
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Spinner />}
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
