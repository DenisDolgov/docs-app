'use client';

import {
  ExternalLinkIcon,
  FilePenIcon,
  MoreVerticalIcon,
  Share2Icon,
  TrashIcon,
} from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { RemoveDocumentDialog } from '@/components/remove-document-dialog';
import { RenameDocumentDialog } from '@/components/rename-document-dialog';
import { ShareDocumentDialog } from '@/components/share-document-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DocumentDto } from '@/lib/api';

interface DocumentMenuProps {
  document: DocumentDto;
  onNewTab: (id: string) => void;
  onChanged: () => void;
}

export const DocumentMenu = ({
  document,
  onNewTab,
  onChanged,
}: DocumentMenuProps) => {
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const { user } = useAuth();

  // Управление доступом — только у владельца. Владелец документа в UI — его
  // создатель: редактор по share кнопку не получает, чтобы не ловить 403.
  const canShare = user?.id === document.createdBy;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            onClick={(e) => e.stopPropagation()}
            variant="ghost"
            size="icon"
            className="rounded-full"
          >
            <MoreVerticalIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => setIsRemoveOpen(true)}>
          <TrashIcon className="size-4" />
          Удалить
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
          <FilePenIcon className="size-4" />
          Переименовать
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNewTab(document.id)}>
          <ExternalLinkIcon className="size-4" />
          Открыть в новой вкладке
        </DropdownMenuItem>
        {canShare && (
          <DropdownMenuItem onClick={() => setIsShareOpen(true)}>
            <Share2Icon className="size-4" />
            Поделиться
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
      <RemoveDocumentDialog
        document={document}
        open={isRemoveOpen}
        onOpenChange={setIsRemoveOpen}
        onRemoved={onChanged}
      />
      <RenameDocumentDialog
        document={document}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onRenamed={onChanged}
      />
      <ShareDocumentDialog
        document={document}
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
      />
    </DropdownMenu>
  );
};
