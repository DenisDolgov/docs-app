// Маршруты файлов. `base`/`param`/паттерны используются в бэкенд-декораторах,
// `paths` — полные пути для клиента.
const base = 'files';
const param = 'fileId';
const uploadUrlSegment = 'upload-url';
const completeSegment = 'complete';
const downloadUrlSegment = 'download-url';
const contentSegment = 'content';

export const fileRoute = {
  base,
  param,
  uploadUrlSegment,
  completeSegment,
  downloadUrlSegment,
  contentSegment,
  byIdPattern: `/:${param}`,
  completePattern: `/:${param}/${completeSegment}`,
  downloadUrlPattern: `/:${param}/${downloadUrlSegment}`,
  contentPattern: `/:${param}/${contentSegment}`,
  paths: {
    collection: `/${base}`,
    uploadUrl: `/${base}/${uploadUrlSegment}`,
    byId: (fileId: string) => `/${base}/${fileId}`,
    complete: (fileId: string) => `/${base}/${fileId}/${completeSegment}`,
    downloadUrl: (fileId: string) => `/${base}/${fileId}/${downloadUrlSegment}`,
    // Стабильный путь для `src` в контенте документа: подпись истекает, этот
    // адрес — нет.
    content: (fileId: string) => `/${base}/${fileId}/${contentSegment}`,
  },
} as const;
