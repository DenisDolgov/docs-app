import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WS from 'ws';

import { openCollabClient } from '../collab-client';
import {
  addMember,
  createDocument,
  createOrganization,
  registerAndLogin,
} from '../collab-fixtures';
import { createTestApp, waitFor } from '../utils';

const BAD_REQUEST = 4000;
const UNAUTHORIZED = 4001;
const ACCESS_DENIED = 4003;

describe('collab access (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  const setup = async () => {
    const owner = await registerAndLogin(app);
    const organization = await createOrganization(app, owner.accessToken);
    const document = await createDocument(
      app,
      owner.accessToken,
      organization.body.id,
    );

    return {
      owner,
      organizationId: organization.body.id as string,
      documentId: document.body.id as string,
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `ws://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('отклоняет соединение без токена', async () => {
    const { documentId } = await setup();

    const client = openCollabClient(baseUrl, documentId);

    await expect(client.closed).resolves.toMatchObject({ code: UNAUTHORIZED });
  });

  it('отклоняет соединение с недействительным токеном', async () => {
    const { documentId } = await setup();

    const client = openCollabClient(baseUrl, documentId, 'not-a-real-token');

    await expect(client.closed).resolves.toMatchObject({ code: UNAUTHORIZED });
  });

  it('отклоняет соединение без documentId', async () => {
    const owner = await registerAndLogin(app);

    const client = openCollabClient(baseUrl, '', owner.accessToken);

    await expect(client.closed).resolves.toMatchObject({ code: BAD_REQUEST });
  });

  it('отклоняет не-участника организации', async () => {
    const { documentId } = await setup();
    const outsider = await registerAndLogin(app);

    const client = openCollabClient(baseUrl, documentId, outsider.accessToken);

    await expect(client.closed).resolves.toMatchObject({ code: ACCESS_DENIED });
  });

  it('не отличает чужой документ от несуществующего', async () => {
    const { documentId, owner } = await setup();
    const outsider = await registerAndLogin(app);

    const foreign = openCollabClient(baseUrl, documentId, outsider.accessToken);
    const missing = openCollabClient(baseUrl, randomUUID(), owner.accessToken);

    const [foreignResult, missingResult] = await Promise.all([
      foreign.closed,
      missing.closed,
    ]);

    expect(foreignResult.code).toBe(ACCESS_DENIED);
    expect(missingResult.code).toBe(ACCESS_DENIED);
  });

  it('пускает участника и синхронизирует документ с владельцем', async () => {
    const { owner, organizationId, documentId } = await setup();
    const member = await registerAndLogin(app);
    await addMember(app, owner.accessToken, organizationId, member.email);

    const ownerClient = openCollabClient(
      baseUrl,
      documentId,
      owner.accessToken,
    );
    const memberClient = openCollabClient(
      baseUrl,
      documentId,
      member.accessToken,
    );
    await Promise.all([ownerClient.opened, memberClient.opened]);

    ownerClient.doc.getText('content').insert(0, 'Hello');

    await waitFor(
      () => memberClient.doc.getText('content').toString() === 'Hello',
    );

    expect(memberClient.socket.readyState).toBe(WS.OPEN);
    ownerClient.close();
    memberClient.close();
  });
});
