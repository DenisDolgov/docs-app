import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CollabClient, openCollabClient } from '../collab-client';
import {
  createDocument,
  createOrganization,
  registerAndLogin,
} from '../collab-fixtures';
import { createTestApp, waitFor } from '../utils';

describe('collab gateway (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let accessToken: string;
  let firstDocumentId: string;
  let secondDocumentId: string;
  const clients: CollabClient[] = [];

  const connect = async (documentId: string): Promise<CollabClient> => {
    const client = openCollabClient(baseUrl, documentId, accessToken);
    clients.push(client);
    await client.opened;

    return client;
  };

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `ws://127.0.0.1:${address.port}`;

    const owner = await registerAndLogin(app);
    accessToken = owner.accessToken;

    const organization = await createOrganization(app, accessToken);
    const first = await createDocument(app, accessToken, organization.body.id);
    const second = await createDocument(app, accessToken, organization.body.id);
    firstDocumentId = first.body.id as string;
    secondDocumentId = second.body.id as string;
  });

  afterAll(async () => {
    for (const client of clients) client.close();
    await app.close();
  });

  it('два клиента в одной комнате сходятся к одному тексту', async () => {
    const a = await connect(firstDocumentId);
    const b = await connect(firstDocumentId);

    a.doc.getText('content').insert(0, 'Hello');
    await waitFor(() => b.doc.getText('content').toString() === 'Hello');

    b.doc.getText('content').insert(5, ' World');
    await waitFor(() => a.doc.getText('content').toString() === 'Hello World');

    expect(a.doc.getText('content').toString()).toBe('Hello World');
    expect(b.doc.getText('content').toString()).toBe('Hello World');
  });

  it('комнаты изолированы по documentId', async () => {
    const a = await connect(firstDocumentId);
    const b = await connect(secondDocumentId);

    a.doc.getText('content').insert(0, 'private');
    await waitFor(() => a.doc.getText('content').toString() === 'private');

    expect(b.doc.getText('content').toString()).toBe('');
  });
});
