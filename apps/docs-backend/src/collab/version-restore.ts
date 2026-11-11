import * as Y from 'yjs';

export const createVersionRestoreUpdate = (
  current: Y.Doc,
  snapshot: Uint8Array,
): Uint8Array => {
  const tempDocument = new Y.Doc();
  Y.applyUpdate(tempDocument, snapshot);

  const versionStateVector = Y.encodeStateVector(tempDocument);

  const changesSinceVersion = Y.encodeStateAsUpdate(
    current,
    versionStateVector,
  );

  const undoManager = new Y.UndoManager(tempDocument, { captureTimeout: 0 });

  Y.applyUpdate(tempDocument, changesSinceVersion, null);

  undoManager.undo();
  undoManager.destroy();

  const restoreUpdate = Y.encodeStateAsUpdate(tempDocument, versionStateVector);

  tempDocument.destroy();

  return restoreUpdate;
};
