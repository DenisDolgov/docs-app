import { LoaderIcon } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DocumentDto } from '@/lib/api';

import { DocumentRow } from './document-row';

interface DocumentsTableProps {
  documents: DocumentDto[] | null;
  hasError: boolean;
  onChanged: () => void;
}

export const DocumentsTable = ({
  documents,
  hasError,
  onChanged,
}: DocumentsTableProps) => {
  return (
    <div className="max-w-7xl mx-auto px-16 py-6 flex flex-col gap-5">
      {documents === null ? (
        <div className="flex justify-center items-center h-24">
          <LoaderIcon className="animate-spin text-muted-foreground size-5" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead className="hidden md:table-cell">
                Владелец/Организация
              </TableHead>
              <TableHead className="hidden md:table-cell">Создан</TableHead>
              <TableHead>&nbsp;</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={4}
                >
                  Не удалось загрузить документы
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={4}
                >
                  Пока нет документов
                </TableCell>
              </TableRow>
            ) : (
              documents.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  onChanged={onChanged}
                />
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
