'use client';

import { useMutation } from 'convex/react';
import { type SubmitEventHandler, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';

interface RenameDocumentDialogProps {
  document: Doc<'documents'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RenameDocumentDialog = ({
  document,
  open,
  onOpenChange,
}: RenameDocumentDialogProps) => {
  const update = useMutation(api.documents.updateById);
  const [isUpdating, setIsUpdating] = useState(false);
  const [title, setTitle] = useState<string>(document.title);

  useEffect(() => {
    if (!open) {
      setIsUpdating(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setTitle(document.title);
    }
  }, [open, document]);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    if (!title.trim()) return;

    setIsUpdating(true);
    update({ id: document._id, title }).finally(() => {
      onOpenChange(false);
      setIsUpdating(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Переименование</DialogTitle>
            <DialogDescription>Введите новое название:</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button disabled={isUpdating || !title.trim()} type="submit">
              ОК
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
