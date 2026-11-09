import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { DocumentService } from '../../src/document/document.service';
import { DocumentShareService } from '../../src/permission/document-share.service';
import { PublicLinkService } from '../../src/permission/public-link.service';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `audit-${randomUUID()}@example.com`;

// Приёмка событий на живом сценарии: журнал должен отвечать «кто, что, над
// чем», не содержать секретов и переживать удаление цели.
describe('audit events (integration)', () => {
  let auth: AuthService;
  let users: UserRepository;
  let documents: DocumentService;
  let shares: DocumentShareService;
  let publicLinks: PublicLinkService;
  let db: Database;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });

    await users.markEmailVerified(user.id);

    return { email, id: user.id };
  };

  const createDocument = async () => {
    const owner = await register();
    const document = await documents.createPersonal({
      actorId: owner.id,
      title: 'Документ под аудитом',
    });

    return { owner, document };
  };

  const documentActions = async (documentId: string) => {
    const result = await db.execute<{ action: string }>(
      sql`select action from audit.events where target_type = 'document' and target_id = ${documentId} order by created_at, id`,
    );

    return result.rows.map((row) => row.action);
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    users = moduleRef.get(UserRepository);
    documents = moduleRef.get(DocumentService);
    shares = moduleRef.get(DocumentShareService);
    publicLinks = moduleRef.get(PublicLinkService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('логин оставляет событие с актором, ip и user agent', async () => {
    const user = await register();

    await auth.login({
      email: user.email,
      password: PASSWORD,
      ip: '203.0.113.9',
      userAgent: 'audit-test-agent/1.0',
    });

    const result = await db.execute<{
      actor_id: string;
      ip: string | null;
      user_agent: string | null;
    }>(
      sql`select actor_id, ip, user_agent from audit.events where actor_id = ${user.id} and action = 'auth.login' order by created_at desc limit 1`,
    );

    expect(result.rows[0]).toEqual({
      actor_id: user.id,
      ip: '203.0.113.9',
      user_agent: 'audit-test-agent/1.0',
    });
  });

  it('в metadata события логина нет секретов', async () => {
    const user = await register();

    await auth.login({
      email: user.email,
      password: PASSWORD,
      ip: '203.0.113.9',
      userAgent: 'audit-test-agent/1.0',
    });

    const result = await db.execute<{ metadata: unknown }>(
      sql`select metadata from audit.events where actor_id = ${user.id} and action = 'auth.login' limit 1`,
    );
    const event = result.rows[0];
    const serialized = JSON.stringify(event?.metadata ?? {}).toLowerCase();

    expect(event).toBeDefined();
    expect(serialized).not.toContain(PASSWORD.toLowerCase());
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('token');
  });

  it('события сценария шаринга складываются в цепочку по документу', async () => {
    const { owner, document } = await createDocument();
    const grantee = await register();

    await shares.grant({
      documentId: document.id,
      userId: grantee.id,
      role: 'viewer',
      actorId: owner.id,
    });

    await shares.revoke({
      documentId: document.id,
      userId: grantee.id,
      actorId: owner.id,
    });

    const link = await publicLinks.create({
      documentId: document.id,
      actorId: owner.id,
      expiresAt: null,
    });

    await publicLinks.revoke({
      documentId: document.id,
      linkId: link.id,
      actorId: owner.id,
    });

    await expect(documentActions(document.id)).resolves.toEqual([
      'document_share.granted',
      'document_share.revoked',
      'public_link.created',
      'public_link.revoked',
    ]);
  });

  it('событие переживает удаление цели', async () => {
    const { owner, document } = await createDocument();

    await documents.remove({ documentId: document.id, actorId: owner.id });

    const events = await db.execute<{ action: string }>(
      sql`select action from audit.events where target_type = 'document' and target_id = ${document.id} and action = 'document.removed'`,
    );
    const alive = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from document.documents where id = ${document.id}`,
    );

    expect(events.rows.map((row) => row.action)).toEqual(['document.removed']);
    expect(Number(alive.rows[0]?.count ?? 0)).toBe(0);
  });
});
