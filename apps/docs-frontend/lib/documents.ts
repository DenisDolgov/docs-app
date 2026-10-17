import {
  documentRoute,
  organizationDocumentRoute,
} from '@docs-app/contracts/document/routes';

import { apiJson, type DocumentDto } from '@/lib/api';

const { paths: documentPaths } = documentRoute;
const { paths: organizationDocumentPaths } = organizationDocumentRoute;

export const listDocuments = (): Promise<DocumentDto[]> =>
  apiJson<DocumentDto[]>(documentPaths.collection);

export const getDocument = (documentId: string): Promise<DocumentDto> =>
  apiJson<DocumentDto>(documentPaths.byId(documentId));

// Цель создания: выбранная организация или личный документ.
export const createDocument = ({
  title,
  organizationId,
}: {
  title: string;
  organizationId: string | null;
}): Promise<DocumentDto> =>
  organizationId
    ? apiJson<DocumentDto>(
        organizationDocumentPaths.collection(organizationId),
        {
          method: 'POST',
          body: JSON.stringify({ title }),
        },
      )
    : apiJson<DocumentDto>(documentPaths.collection, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });

export const renameDocument = (
  documentId: string,
  title: string,
): Promise<DocumentDto> =>
  apiJson<DocumentDto>(documentPaths.byId(documentId), {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });

export const removeDocument = (documentId: string): Promise<void> =>
  apiJson<void>(documentPaths.byId(documentId), { method: 'DELETE' });
