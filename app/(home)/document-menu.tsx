'use client';

import {
  ExternalLinkIcon,
  FilePenIcon,
  MoreVerticalIcon,
  TrashIcon,
} from 'lucide-react';
import { useState } from 'react';

import { RemoveDocumentDialog } from '@/components/remove-document-dialog';
import { RenameDocumentDialog } from '@/components/rename-document-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Doc, Id } from '@/convex/_generated/dataModel';

interface DocumentMenuProps {
  document: Doc<'documents'>;
  onNewTab: (id: Id<'documents'>) => void;
}

export const DocumentMenu = ({ document, onNewTab }: DocumentMenuProps) => {
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

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
        <DropdownMenuItem onClick={() => onNewTab(document._id)}>
          <ExternalLinkIcon className="size-4" />
          Открыть в новой вкладке
        </DropdownMenuItem>
      </DropdownMenuContent>
      <RemoveDocumentDialog
        document={document}
        open={isRemoveOpen}
        onOpenChange={setIsRemoveOpen}
      />
      <RenameDocumentDialog
        document={document}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </DropdownMenu>
  );
};
