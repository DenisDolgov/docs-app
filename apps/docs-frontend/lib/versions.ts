import type { DocumentVersionDto } from '@docs-app/contracts/document';
import { documentRoute } from '@docs-app/contracts/document/routes';

import { apiJson } from '@/lib/api';

export type { DocumentVersionDto };

const { paths: documentPaths } = documentRoute;

export const listVersions = (
  documentId: string,
): Promise<DocumentVersionDto[]> =>
  apiJson<DocumentVersionDto[]>(documentPaths.versions(documentId));

export const createVersion = (
  documentId: string,
  name: string,
): Promise<DocumentVersionDto> =>
  apiJson<DocumentVersionDto>(documentPaths.versions(documentId), {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

// Откат не перезагружает редактор: сервер присылает изменение по WS.
export const restoreVersion = (
  documentId: string,
  versionId: string,
): Promise<DocumentVersionDto> =>
  apiJson<DocumentVersionDto>(
    documentPaths.versionRestore(documentId, versionId),
    { method: 'POST' },
  );
