'use client';

import { format } from 'date-fns';
import { Building2Icon, CircleUserIcon, FileIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useOrganization } from '@/components/organization-provider';
import { TableCell, TableRow } from '@/components/ui/table';
import type { DocumentDto } from '@/lib/api';

import { DocumentMenu } from './document-menu';

interface DocumentRowProps {
  document: DocumentDto;
  onChanged: () => void;
}

export const DocumentRow = ({ document, onChanged }: DocumentRowProps) => {
  const router = useRouter();
  const { organizations } = useOrganization();

  const organization = document.organizationId
    ? organizations.find((item) => item.id === document.organizationId)
    : null;

  const handleNewTabClick = (id: string) => {
    window.open(`/documents/${id}`, '_blank');
  };

  const handleRowClick = (id: string) => {
    router.push(`/documents/${id}`);
  };

  return (
    <TableRow
      onClick={() => handleRowClick(document.id)}
      className="cursor-pointer"
    >
      <TableCell>
        <div className="flex items-center gap-2 font-medium">
          <FileIcon className="size-6 shrink-0 text-blue-500" />
          <span className="truncate">{document.title}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground hidden md:table-cell">
        <div className="flex items-center gap-2">
          {document.organizationId ? (
            <Building2Icon className="size-4" />
          ) : (
            <CircleUserIcon className="size-4" />
          )}
          <span className="truncate">
            {organization?.name ??
              (document.organizationId ? 'Организация' : 'Персональный')}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground hidden md:table-cell">
        {format(new Date(document.createdAt), 'dd.MM.yyyy')}
      </TableCell>
      <TableCell className="text-right">
        <DocumentMenu
          document={document}
          onNewTab={handleNewTabClick}
          onChanged={onChanged}
        />
      </TableCell>
    </TableRow>
  );
};
