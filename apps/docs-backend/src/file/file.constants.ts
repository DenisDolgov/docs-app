import { MAX_UPLOAD_BYTES } from '@docs-app/contracts/file';
import { hoursToMilliseconds, minutesToMilliseconds } from 'date-fns';

// Allowlist серверный: клиентский `accept` — подсказка для диалога, а не
// политика. SVG сюда не входит: он исполняет скрипты при открытии.
export const allowedUploadMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
] as const;

export const maxUploadBytes = MAX_UPLOAD_BYTES;

// Префикс ключа в бакете. Пользовательских данных в пути нет.
export const FILE_KEY_PREFIX = 'files';

// Брошенная загрузка живёт сутки: за это время `complete` успевает доехать
// даже с медленного канала.
export const FILE_PENDING_RETENTION = hoursToMilliseconds(24);

// Уборка — интервальная фоновая задача, а не очередь с ретраями.
export const FILE_GC_INTERVAL = minutesToMilliseconds(60);

// Имя бакета из env раздаётся модулем одним токеном.
export const FILE_BUCKET = Symbol('FileBucket');
