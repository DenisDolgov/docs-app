import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { CollabRepository } from '../../src/collab/collab.repository';
import { CollabService } from '../../src/collab/collab.service';
import { createTestingModule, waitFor } from '../utils';

describe('collab recovery (integration)', () => {
  const modules: Array<{ close: () => Promise<void> }> = [];

  afterAll(async () => {
    for (const moduleRef of modules) await moduleRef.close();
  });

  it('восстанавливает комнату после нового запуска из снапшота и хвоста апдейтов', async () => {
    const documentId = randomUUID();
    const firstModule = await createTestingModule();
    modules.push(firstModule);
    const firstService = firstModule.get(CollabService);
    const repository = firstModule.get(CollabRepository);

    const firstRoom = await firstService.getRoom(documentId);
    firstRoom.doc.getText('content').insert(0, 'Hello');
    await waitFor(
      async () => (await repository.listUpdates(documentId)).length > 0,
    );

    await firstService.compact(documentId);
    expect(await repository.loadSnapshot(documentId)).not.toBeNull();
    expect(await repository.listUpdates(documentId)).toEqual([]);

    firstRoom.doc.getText('content').insert(5, ' World');
    await waitFor(
      async () => (await repository.listUpdates(documentId)).length > 0,
    );
    await firstModule.close();
    modules.pop();

    const secondModule = await createTestingModule();
    modules.push(secondModule);
    const secondRoom = await secondModule
      .get(CollabService)
      .getRoom(documentId);

    expect(secondRoom).not.toBe(firstRoom);
    expect(secondRoom.doc.getText('content').toString()).toBe('Hello World');
    expect(Y.encodeStateVector(secondRoom.doc)).toEqual(
      Y.encodeStateVector(firstRoom.doc),
    );
  });
});
