import { apiJson, type DocumentDto } from '@/lib/api';

export const listDocuments = (): Promise<DocumentDto[]> =>
  apiJson<DocumentDto[]>('/documents');

export const getDocument = (documentId: string): Promise<DocumentDto> =>
  apiJson<DocumentDto>(`/documents/${documentId}`);

// Цель создания: выбранная организация или личный документ.
export const createDocument = ({
  title,
  organizationId,
}: {
  title: string;
  organizationId: string | null;
}): Promise<DocumentDto> =>
  organizationId
    ? apiJson<DocumentDto>(`/organizations/${organizationId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      })
    : apiJson<DocumentDto>('/documents', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });

export const renameDocument = (
  documentId: string,
  title: string,
): Promise<DocumentDto> =>
  apiJson<DocumentDto>(`/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });

export const removeDocument = (documentId: string): Promise<void> =>
  apiJson<void>(`/documents/${documentId}`, { method: 'DELETE' });
