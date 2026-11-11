import type { DocumentVersionKind } from '@docs-app/contracts/document';
import type { WebSocket } from 'ws';

export interface CollabConnection extends WebSocket {
  documentId: string;
}

export interface ResolveAccessParams {
  documentId: string;
  userId: string;
}

// Метаданные версии — то, что уходит наружу. Байты снапшота сюда не входят.
export interface DocumentVersionView {
  id: string;
  documentId: string;
  kind: DocumentVersionKind;
  name: string | null;
  createdBy: string | null;
  createdAt: string;
  updateId: number | null;
}

export interface DocumentVersionWithSnapshot extends DocumentVersionView {
  snapshot: Uint8Array;
}

export interface ListVersionsParams {
  documentId: string;
  actorId: string;
}

export interface CreateNamedVersionParams {
  documentId: string;
  actorId: string;
  name: string;
}

export interface RestoreVersionParams {
  documentId: string;
  versionId: string;
  actorId: string;
}

export interface RecordVersionParams {
  documentId: string;
  kind: DocumentVersionKind;
  name: string | null;
  snapshot: Uint8Array;
  createdBy: string | null;
  updateId: number | null;
}

// Факты для решения об авто-чекпоинте. Счётчик живёт в комнате: журнал
// компактится и не годится как накопительный счётчик.
export interface CheckpointFacts {
  lastUpdateId: number | null;
  updatesSinceCheckpoint: number;
  lastCheckpointAt: Date | null;
}

// Снапшот комнаты и watermark журнала на момент съёмки.
export interface RoomVersionSnapshot {
  snapshot: Uint8Array;
  updateId: number;
}
