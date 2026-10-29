import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { DocumentService } from '../../src/document/document.service';
import { PublicLinkResolver } from '../../src/permission/public-link.resolver';
import { PublicLinkService } from '../../src/permission/public-link.service';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

// Ссылка как источник доступа: выпуск, хранение только хеша и отзыв, который
// действует на следующем же запросе (кэша у публичного контура нет).
describe('public links (integration)', () => {
  let auth: AuthService;
  let users: UserRepository;
  let documents: DocumentService;
  let publicLinks: PublicLinkService;
  let access: PublicLinkResolver;
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
      title: 'Публичная заметка',
    });

    return { owner, document };
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    users = moduleRef.get(UserRepository);
    documents = moduleRef.get(DocumentService);
    publicLinks = moduleRef.get(PublicLinkService);
    access = moduleRef.get(PublicLinkResolver);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('выпускает ссылку и отдаёт токен один раз', async () => {
    const { owner, document } = await createDocument();

    const created = await publicLinks.create({
      documentId: document.id,
      actorId: owner.id,
      expiresAt: null,
    });

    expect(created.token).toEqual(expect.any(String));
    expect(created.token.length).toBeGreaterThan(20);

    const listed = await publicLinks.list({
      documentId: document.id,
      actorId: owner.id,
    });

    expect(listed).toHaveLength(1);
    expect(listed[0]).not.toHaveProperty('token');
  });

  it('хранит в БД хеш, а не токен', async () => {
    const { owner, document } = await createDocument();

    const created = await publicLinks.create({
      documentId: document.id,
      actorId: owner.id,
      expiresAt: null,
    });

    const result = await db.execute<{ token_hash: string }>(
      sql`select token_hash from permission.public_links where document_id = ${document.id}`,
    );

    expect(result.rows[0]?.token_hash).toBe(sha256(created.token));
    expect(result.rows[0]?.token_hash).not.toBe(created.token);
  });

  it('просроченная ссылка не разрешается', async () => {
    const { owner, document } = await createDocument();
    const created = await publicLinks.create({
      documentId: document.id,
      actorId: owner.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await db.execute(
      sql`update permission.public_links set expires_at = now() - interval '1 second' where id = ${created.id}`,
    );

    await expect(access.resolve({ token: created.token })).resolves.toBeNull();
  });

  it('отзыв ссылки действует на следующем запросе', async () => {
    const { owner, document } = await createDocument();
    const created = await publicLinks.create({
      documentId: document.id,
      actorId: owner.id,
      expiresAt: null,
    });

    await expect(access.resolve({ token: created.token })).resolves.toEqual({
      documentId: document.id,
    });

    await publicLinks.revoke({
      documentId: document.id,
      linkId: created.id,
      actorId: owner.id,
    });

    await expect(access.resolve({ token: created.token })).resolves.toBeNull();
  });

  it('удалённый документ не оживает от ссылки', async () => {
    const { owner, document } = await createDocument();
    const created = await publicLinks.create({
      documentId: document.id,
      actorId: owner.id,
      expiresAt: null,
    });

    await documents.remove({ documentId: document.id, actorId: owner.id });

    await expect(access.resolve({ token: created.token })).resolves.toBeNull();
  });
});
