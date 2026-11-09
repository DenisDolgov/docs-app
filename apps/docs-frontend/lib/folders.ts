import type {
  FolderDto,
  FolderShareDto,
  FolderTreeNodeDto,
} from '@docs-app/contracts/folder';
import { folderRoute } from '@docs-app/contracts/folder/routes';

import { apiJson } from '@/lib/api';

export type { FolderDto, FolderShareDto, FolderTreeNodeDto };

const { paths } = folderRoute;

// MIME-типы для HTML5 drag-and-drop между таблицей документов и деревом папок.
export const DOCUMENT_DRAG_TYPE = 'application/x-docs-document-id';
export const FOLDER_DRAG_TYPE = 'application/x-docs-folder-id';

export const listFolderTree = (
  organizationId: string,
): Promise<FolderTreeNodeDto[]> =>
  apiJson<FolderTreeNodeDto[]>(paths.collection(organizationId));

export const createFolder = (
  organizationId: string,
  body: { name: string; parentId?: string | null },
): Promise<FolderDto> =>
  apiJson<FolderDto>(paths.collection(organizationId), {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateFolder = (
  folderId: string,
  body: { name?: string; parentId?: string | null },
): Promise<FolderDto> =>
  apiJson<FolderDto>(paths.byId(folderId), {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const removeFolder = (folderId: string): Promise<void> =>
  apiJson<void>(paths.byId(folderId), { method: 'DELETE' });

export const listFolderShares = (folderId: string): Promise<FolderShareDto[]> =>
  apiJson<FolderShareDto[]>(paths.shares(folderId));

export const grantFolderShare = (
  folderId: string,
  body: { email: string; role: string },
): Promise<FolderShareDto> =>
  apiJson<FolderShareDto>(paths.shares(folderId), {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const revokeFolderShare = (
  folderId: string,
  userId: string,
): Promise<void> =>
  apiJson<void>(paths.share(folderId, userId), { method: 'DELETE' });
