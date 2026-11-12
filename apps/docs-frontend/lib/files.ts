import type {
  DownloadUrlResponseDto,
  FileDto,
  UploadUrlRequestDto,
  UploadUrlResponseDto,
} from '@docs-app/contracts/file';
import { MAX_UPLOAD_BYTES } from '@docs-app/contracts/file/limits';
import { fileRoute } from '@docs-app/contracts/file/routes';

import { apiJson } from '@/lib/api';

export type { FileDto };

const { paths } = fileRoute;

export const requestUploadUrl = (
  request: UploadUrlRequestDto,
): Promise<UploadUrlResponseDto> =>
  apiJson<UploadUrlResponseDto>(paths.uploadUrl, {
    method: 'POST',
    body: JSON.stringify(request),
  });

export const completeUpload = (fileId: string): Promise<FileDto> =>
  apiJson<FileDto>(paths.complete(fileId), { method: 'POST' });

export const listFiles = (documentId: string): Promise<FileDto[]> =>
  apiJson<FileDto[]>(
    `${paths.collection}?documentId=${encodeURIComponent(documentId)}`,
  );

export const getDownloadUrl = (
  fileId: string,
): Promise<DownloadUrlResponseDto> =>
  apiJson<DownloadUrlResponseDto>(paths.downloadUrl(fileId));

export const removeFile = (fileId: string): Promise<void> =>
  apiJson<void>(paths.byId(fileId), { method: 'DELETE' });

// Стабильный адрес для `src` в документе: сам редиректит на свежую подпись,
// поэтому в контенте не хранится истекающая ссылка. Путь относительный:
// запрос идёт на origin фронта, и браузер прикладывает httpOnly-куку.
export const fileContentUrl = (fileId: string): string => paths.content(fileId);

export const fileDownload = async (fileId: string): Promise<void> => {
  const { url } = await getDownloadUrl(fileId);

  window.open(url, '_blank', 'noopener,noreferrer');
};

// Двухфазная загрузка: заявка → PUT прямо в MinIO → complete. Клиент не может
// сразу считать файл готовым: решение принимает сервер по фактам объекта.
export const uploadFile = async ({
  file,
  documentId,
}: {
  file: File;
  documentId: string;
}): Promise<FileDto> => {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Файл слишком большой');
  }

  const upload = await requestUploadUrl({
    filename: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    documentId,
  });

  const response = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error('Не удалось загрузить файл в хранилище');
  }

  return completeUpload(upload.fileId);
};
