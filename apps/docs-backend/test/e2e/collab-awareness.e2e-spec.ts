import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CollabClient, openCollabClient } from '../collab-client';
import {
  createDocument,
  createOrganization,
  registerAndLogin,
} from '../collab-fixtures';
import { createTestApp, waitFor } from '../utils';

describe('collab awareness (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const openedClients: CollabClient[] = [];

  const setup = async () => {
    const owner = await registerAndLogin(app);
    const organization = await createOrganization(app, owner.accessToken);
    const document = await createDocument(
      app,
      owner.accessToken,
      organization.body.id,
    );

    return {
      token: owner.accessToken as string,
      documentId: document.body.id as string,
    };
  };

  const open = async (documentId: string, token: string) => {
    const client = openCollabClient(baseUrl, documentId, token);
    openedClients.push(client);
    await client.opened;

    return client;
  };

  const nameOf = (client: CollabClient, clientId: number) =>
    client.awareness.getStates().get(clientId)?.user?.name;

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `ws://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    for (const client of openedClients) client.close();
    await app.close();
  });

  it('два клиента видят присутствие друг друга', async () => {
    const { documentId, token } = await setup();
    const alice = await open(documentId, token);
    const bob = await open(documentId, token);

    alice.awareness.setLocalStateField('user', { name: 'Alice' });
    bob.awareness.setLocalStateField('user', { name: 'Bob' });

    await waitFor(() => nameOf(alice, bob.doc.clientID) === 'Bob');
    await waitFor(() => nameOf(bob, alice.doc.clientID) === 'Alice');

    expect(nameOf(alice, bob.doc.clientID)).toBe('Bob');
    expect(nameOf(bob, alice.doc.clientID)).toBe('Alice');
  });

  it('новый клиент сразу получает присутствие уже подключённых', async () => {
    const { documentId, token } = await setup();
    const alice = await open(documentId, token);
    alice.awareness.setLocalStateField('user', { name: 'Alice' });

    const bob = await open(documentId, token);

    await waitFor(() => nameOf(bob, alice.doc.clientID) === 'Alice');

    expect(nameOf(bob, alice.doc.clientID)).toBe('Alice');
  });

  it('отключение клиента убирает его присутствие у остальных', async () => {
    const { documentId, token } = await setup();
    const alice = await open(documentId, token);
    const bob = await open(documentId, token);
    bob.awareness.setLocalStateField('user', { name: 'Bob' });

    await waitFor(() => nameOf(alice, bob.doc.clientID) === 'Bob');

    bob.close();

    await waitFor(
      () => alice.awareness.getStates().has(bob.doc.clientID) === false,
    );

    expect(alice.awareness.getStates().has(bob.doc.clientID)).toBe(false);
  });

  it('присутствие эфемерно: после переподключения оно не восстанавливается', async () => {
    const { documentId, token } = await setup();
    const alice = await open(documentId, token);
    alice.awareness.setLocalStateField('user', { name: 'Alice' });

    const bob = await open(documentId, token);
    await waitFor(() => nameOf(bob, alice.doc.clientID) === 'Alice');

    alice.close();
    bob.close();

    const carol = await open(documentId, token);

    expect(carol.awareness.getStates().has(alice.doc.clientID)).toBe(false);
    expect(carol.awareness.getStates().has(bob.doc.clientID)).toBe(false);
  });
});
