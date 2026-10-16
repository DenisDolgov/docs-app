'use client';

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
import { toast } from '@/components/ui/toast';
import type { DocumentDto } from '@/lib/api';
import { renameDocument } from '@/lib/documents';

interface RenameDocumentDialogProps {
  document: DocumentDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: () => void;
}

export const RenameDocumentDialog = ({
  document,
  open,
  onOpenChange,
  onRenamed,
}: RenameDocumentDialogProps) => {
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
    renameDocument(document.id, title)
      .then(() => onRenamed())
      .catch(() =>
        toast.add({
          type: 'error',
          title: 'Не удалось переименовать документ',
        }),
      )
      .finally(() => {
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
