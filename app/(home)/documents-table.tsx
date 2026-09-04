import type { PaginationStatus } from 'convex/react';
import { LoaderIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Doc } from '@/convex/_generated/dataModel';

import { DocumentRow } from './document-row';

interface DocumentsTableProps {
  documents?: Doc<'documents'>[];
  loadMore: (numItems: number) => void;
  status: PaginationStatus;
}

export const DocumentsTable = ({
  documents,
  loadMore,
  status,
}: DocumentsTableProps) => {
  return (
    <div className="max-w-7xl mx-auto px-16 py-6 flex flex-col gap-5">
      {documents === undefined ? (
        <div className="flex justify-center items-center h-24">
          <LoaderIcon className="animate-spin text-muted-foreground size-5" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>&nbsp;</TableHead>
              <TableHead className="hidden md:table-cell">Shared</TableHead>
              <TableHead className="hidden md:table-cell">Created at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={4}
                >
                  No documents found
                </TableCell>
              </TableRow>
            ) : (
              <>
                {documents.map((document) => (
                  <DocumentRow key={document._id} document={document} />
                ))}
              </>
            )}
          </TableBody>
        </Table>
      )}
      {status === 'CanLoadMore' && (
        <div className="flex items-center justify-center">
          <Button variant="ghost" size="sm" onClick={() => loadMore(5)}>
            Загрузить еще
          </Button>
        </div>
      )}
    </div>
  );
};
