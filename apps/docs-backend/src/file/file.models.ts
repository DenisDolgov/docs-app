import type { FileStatus } from '@docs-app/contracts/file';

import type { EffectiveAccessLevel } from '../permission/permission.models';

export interface FileMetadata {
  mime: string;
  size: number;
}

// Внутренняя форма строки: `key` нужен сервису для подписи и удаления, но
// наружу не уходит — response-DTO его отсекает.
export interface FileView extends FileMetadata {
  id: string;
  ownerId: string;
  organizationId: string | null;
  documentId: string | null;
  key: string;
  name: string;
  status: FileStatus;
  createdAt: string;
}

// Заявка клиента на загрузку. `size` и `mime` здесь — обещание, а не факт.
export interface UploadRequest extends FileMetadata {
  filename: string;
}

// Что сервер собирается подписать и записать в `pending`.
export interface PlannedUpload extends FileMetadata {
  name: string;
}

// Факты из `HeadObject`: после `PUT` сервер видит только размер и content-type.
export type StoredObjectFacts = Partial<FileMetadata>;

// Проверенные факты, которые попадают в `ready` вместо клиентской заявки.
export type VerifiedObject = FileMetadata;

// Минимум сведений о файле, нужный политике доступа.
export interface FileAccessFacts {
  ownerId: string;
  documentId: string | null;
  // Уровень пользователя на документ; `null` — файл не привязан или доступа
  // к документу нет.
  documentAccess: EffectiveAccessLevel | null;
}

export interface CreatePendingFileParams extends FileMetadata {
  ownerId: string;
  organizationId: string | null;
  documentId: string | null;
  key: string;
  name: string;
}

export interface RequestUploadParams extends UploadRequest {
  actorId: string;
  documentId?: string;
}

export interface CompleteUploadParams {
  fileId: string;
  actorId: string;
}

export interface GetFileParams {
  fileId: string;
  actorId: string;
}

export interface ListFilesParams {
  documentId: string;
  actorId: string;
}

export interface RemoveFileParams {
  fileId: string;
  actorId: string;
}
