import { format } from 'date-fns';
import { Building2Icon, CircleUserIcon, FileIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { TableCell, TableRow } from '@/components/ui/table';
import type { Doc } from '@/convex/_generated/dataModel';

import { DocumentMenu } from './document-menu';

interface DocumentRowProps {
  document: Doc<'documents'>;
}

export const DocumentRow = ({ document }: DocumentRowProps) => {
  const router = useRouter();

  const handleNewTabClick = (id: string) => {
    window.open(`/documents/${id}`, '_blank');
  };

  const handleRowClick = (id: string) => {
    router.push(`/documents/${id}`);
  };

  return (
    <TableRow
      onClick={() => handleRowClick(document._id)}
      className="cursor-pointer"
    >
      <TableCell className="w-[50px]">
        <FileIcon className="size-6 text-blue-500" />
      </TableCell>
      <TableCell className="font-medium md:w-[45%]">{document.title}</TableCell>
      <TableCell className="text-muted-foreground hidden md:flex items-center gap-2">
        {document.organizationId ? (
          <Building2Icon className="size-4" />
        ) : (
          <CircleUserIcon className="size-4" />
        )}
        {document.organizationId ? 'Организация' : 'Персональный'}
      </TableCell>
      <TableCell className="text-muted-foreground hidden md:table-cell">
        {format(document._creationTime, 'MMM dd, yyyy')}
      </TableCell>
      <TableCell className="flex justify-end">
        <DocumentMenu onNewTab={handleNewTabClick} document={document} />
      </TableCell>
    </TableRow>
  );
};
