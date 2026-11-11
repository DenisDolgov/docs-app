import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CollabClient, openCollabClient } from '../collab-client';
import {
  createDocument,
  createOrganization,
  registerAndLogin,
} from '../collab-fixtures';
import { createTestApp, waitFor } from '../utils';

const textOf = (client: CollabClient) =>
  client.doc.getText('content').toString();

describe('document versions (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let accessToken: string;
  let documentId: string;
  const clients: CollabClient[] = [];

  const http = () => request(app.getHttpServer());

  const connect = async (documentId: string): Promise<CollabClient> => {
    const client = openCollabClient(baseUrl, documentId, accessToken);
    clients.push(client);
    await client.opened;

    return client;
  };

  const listVersions = (token: string, id = documentId) =>
    http()
      .get(`/documents/${id}/versions`)
      .set('Authorization', `Bearer ${token}`);

  const createVersion = (token: string, name: string, id = documentId) =>
    http()
      .post(`/documents/${id}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name });

  const restoreVersion = (token: string, versionId: string, id = documentId) =>
    http()
      .post(`/documents/${id}/versions/${versionId}/restore`)
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `ws://127.0.0.1:${address.port}`;

    const owner = await registerAndLogin(app);
    accessToken = owner.accessToken;

    const organization = await createOrganization(app, accessToken);
    const document = await createDocument(
      app,
      accessToken,
      organization.body.id,
    );
    documentId = document.body.id as string;
  });

  afterAll(async () => {
    for (const client of clients) client.close();
    await app.close();
  });

  // Сценарий 4 приёмки: правка видна второму участнику, откат приходит
  // апдейтом по WS без перезагрузки редактора.
  it('откат приходит обоим клиентам, история сохраняет обе версии', async () => {
    const first = await connect(documentId);
    const second = await connect(documentId);

    first.doc.getText('content').insert(0, 'version text');
    await waitFor(() => textOf(second) === 'version text');

    const created = await createVersion(accessToken, 'v1');
    expect(created.status).toBe(201);
    expect(created.body.kind).toBe('named');
    expect(created.body.name).toBe('v1');

    first.doc.getText('content').insert(12, ' edited');
    await waitFor(() => textOf(second) === 'version text edited');

    const restored = await restoreVersion(accessToken, created.body.id);
    expect(restored.status).toBe(201);
    expect(restored.body.name).toBe('restored from v1');

    await waitFor(() => textOf(first) === 'version text');
    await waitFor(() => textOf(second) === 'version text');

    const listed = await listVersions(accessToken);
    expect(listed.status).toBe(200);
    expect(listed.body.map((row: { name: string }) => row.name)).toEqual([
      'restored from v1',
      'v1',
    ]);
    // Снапшот в список не попадает.
    expect(listed.body[0]).not.toHaveProperty('snapshot');
  });

  it('viewer читает историю, но не создаёт и не восстанавливает', async () => {
    const viewer = await registerAndLogin(app);
    const ownerVersion = await createVersion(accessToken, 'для viewer');
    expect(ownerVersion.status).toBe(201);

    await http()
      .post(`/documents/${documentId}/shares`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: viewer.email, role: 'viewer' });

    const versions = await listVersions(viewer.accessToken);
    expect(versions.status).toBe(200);
    expect(versions.body.length).toBeGreaterThan(0);

    const versionId = versions.body.at(-1).id as string;

    const createDenied = await createVersion(viewer.accessToken, 'denied');
    expect(createDenied.status).toBe(403);

    const restoreDenied = await restoreVersion(viewer.accessToken, versionId);
    expect(restoreDenied.status).toBe(403);
  });

  it('чужой документ и чужая версия отвечают 404', async () => {
    const stranger = await registerAndLogin(app);

    const strangerList = await listVersions(stranger.accessToken);
    expect(strangerList.status).toBe(404);

    const created = await createVersion(accessToken, 'for 404');
    expect(created.status).toBe(201);

    const other = await createDocument(
      app,
      accessToken,
      (await createOrganization(app, accessToken)).body.id,
    );

    const wrongDocument = await restoreVersion(
      accessToken,
      created.body.id,
      other.body.id as string,
    );
    expect(wrongDocument.status).toBe(404);
  });
});
