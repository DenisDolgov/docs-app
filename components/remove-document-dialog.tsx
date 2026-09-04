'use client';

import { useMutation } from 'convex/react';
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
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';

interface RemoveDocumentDialogProps {
  document: Doc<'documents'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RemoveDocumentDialog = ({
  document,
  open,
  onOpenChange,
}: RemoveDocumentDialogProps) => {
  const remove = useMutation(api.documents.removeById);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsRemoving(false);
    }
  }, [open]);

  const handleConfirm = () => {
    setIsRemoving(true);
    remove({ id: document._id })
      .then(() => onOpenChange(false))
      .catch(() =>
        toast.add({
          type: 'error',
          title: 'Не удалось удалить документ',
        }),
      )
      .then(() =>
        toast.add({
          type: 'success',
          title: 'Документ удален',
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
