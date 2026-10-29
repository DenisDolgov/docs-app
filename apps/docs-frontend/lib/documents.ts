import type {
  CreatedPublicLinkDto,
  DocumentShareDto,
  PublicDocumentDto,
  PublicLinkDto,
} from '@docs-app/contracts/document';
import {
  documentRoute,
  organizationDocumentRoute,
  publicDocumentRoute,
} from '@docs-app/contracts/document/routes';

import { apiJson, type DocumentDto } from '@/lib/api';

export type { DocumentShareDto, PublicDocumentDto, PublicLinkDto };

const { paths: documentPaths } = documentRoute;
const { paths: organizationDocumentPaths } = organizationDocumentRoute;
const { paths: publicDocumentPaths } = publicDocumentRoute;

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

export const listDocumentShares = (
  documentId: string,
): Promise<DocumentShareDto[]> =>
  apiJson<DocumentShareDto[]>(documentPaths.shares(documentId));

export const grantDocumentShare = ({
  documentId,
  email,
  role,
}: {
  documentId: string;
  email: string;
  role: DocumentShareDto['role'];
}): Promise<DocumentShareDto> =>
  apiJson<DocumentShareDto>(documentPaths.shares(documentId), {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });

export const revokeDocumentShare = (
  documentId: string,
  userId: string,
): Promise<void> =>
  apiJson<void>(documentPaths.share(documentId, userId), {
    method: 'DELETE',
  });

export const listPublicLinks = (documentId: string): Promise<PublicLinkDto[]> =>
  apiJson<PublicLinkDto[]>(documentPaths.publicLinks(documentId));

// Токен приходит только в ответе на создание: дальше его нет ни в списке, ни
// в БД (там хеш). Ссылку показываем один раз и просим скопировать.
export const createPublicLink = (
  documentId: string,
  expiresAt: string | null,
): Promise<CreatedPublicLinkDto> =>
  apiJson<CreatedPublicLinkDto>(documentPaths.publicLinks(documentId), {
    method: 'POST',
    body: JSON.stringify({ expiresAt }),
  });

export const revokePublicLink = (
  documentId: string,
  linkId: string,
): Promise<void> =>
  apiJson<void>(documentPaths.publicLink(documentId, linkId), {
    method: 'DELETE',
  });

// Публичное чтение: вызывается без сессии, поэтому отдельный путь по токену.
export const getPublicDocument = (token: string): Promise<PublicDocumentDto> =>
  apiJson<PublicDocumentDto>(publicDocumentPaths.document(token));
