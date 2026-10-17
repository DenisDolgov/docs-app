// Протокол совместного редактирования (WS)
export const COLLAB_WS_PATH = '/ws';
export const COLLAB_DOCUMENT_QUERY_PARAM = 'documentId';

// Тип кадра: [varUint(тип)][payload]
export const COLLAB_MESSAGE_SYNC = 0;
export const COLLAB_MESSAGE_AWARENESS = 1;

// Коды закрытия рукопожатия.
// ВАЖНО: «нет доступа» и «документ не найден» намеренно отвечают одним кодом
// (4003) — иначе клиент смог бы выяснить существование чужого документа.
// Отказ по origin (CSWSH) — отдельный код policy violation.
export const COLLAB_CLOSE_DOCUMENT_ID_REQUIRED = 4000;
export const COLLAB_CLOSE_UNAUTHORIZED = 4001;
export const COLLAB_CLOSE_ACCESS_DENIED = 4003;
export const COLLAB_CLOSE_FORBIDDEN_ORIGIN = 1008;
export const COLLAB_CLOSE_MALFORMED_MESSAGE = 1003;
export const COLLAB_CLOSE_SETUP_FAILED = 1011;

// Аргумент наблюдателя `awareness.on('update')`.
export interface AwarenessChanges {
  added: number[];
  updated: number[];
  removed: number[];
}
