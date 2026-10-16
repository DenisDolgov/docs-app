'use client';

import { useEffect, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/toast';
import type { DocumentDto } from '@/lib/api';
import { removeDocument } from '@/lib/documents';

interface RemoveDocumentDialogProps {
  document: DocumentDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoved: () => void;
}

export const RemoveDocumentDialog = ({
  document,
  open,
  onOpenChange,
  onRemoved,
}: RemoveDocumentDialogProps) => {
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsRemoving(false);
    }
  }, [open]);

  const handleConfirm = () => {
    setIsRemoving(true);
    removeDocument(document.id)
      .then(() => {
        onOpenChange(false);
        onRemoved();
        toast.add({
          type: 'success',
          title: 'Документ удален',
        });
      })
      .catch(() =>
        toast.add({
          type: 'error',
          title: 'Не удалось удалить документ',
        }),
      )
      .finally(() => setIsRemoving(false));
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить?</AlertDialogTitle>
          <AlertDialogDescription>
            Объект "{document.title}" будет удален окончательно
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction disabled={isRemoving} onClick={handleConfirm}>
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
