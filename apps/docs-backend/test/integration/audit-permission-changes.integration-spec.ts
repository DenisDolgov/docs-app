import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AuditService } from '../../src/audit/audit.service';
import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { DocumentService } from '../../src/document/document.service';
import { AccessPolicyService } from '../../src/permission/access-policy.service';
import { DocumentShareService } from '../../src/permission/document-share.service';
import { PublicLinkService } from '../../src/permission/public-link.service';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `audit-share-${randomUUID()}@example.com`;

// Права и audit — одна единица работы: изменение состава доступа без события
// невозможно, а откат не должен трогать кэш прав.
describe('audit + permission changes (integration)', () => {
  let auth: AuthService;
  let users: UserRepository;
  let documents: DocumentService;
  let shares: DocumentShareService;
  let publicLinks: PublicLinkService;
  let accessPolicy: AccessPolicyService;
  let audit: AuditService;
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
      title: 'Документ с share',
    });

    return { owner, document };
  };

  const shareCount = async (documentId: string, userId: string) => {
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from permission.document_shares where document_id = ${documentId} and user_id = ${userId}`,
    );

    return Number(result.rows[0]?.count ?? 0);
  };

  const shareActions = async (documentId: string) => {
    const result = await db.execute<{ action: string }>(
      sql`select action from audit.events where target_type = 'document' and target_id = ${documentId} order by created_at, id`,
    );

    return result.rows.map((row) => row.action);
  };

  const publicLinkCount = async (documentId: string) => {
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from permission.public_links where document_id = ${documentId}`,
    );

    return Number(result.rows[0]?.count ?? 0);
  };

  const publicLinkRevokedAt = async (linkId: string) => {
    const result = await db.execute<{ revoked_at: Date | null }>(
      sql`select revoked_at from permission.public_links where id = ${linkId}`,
    );

    return result.rows[0]?.revoked_at ?? null;
  };

  const documentExists = async (documentId: string) => {
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from documents.documents where id = ${documentId}`,
    );

    return Number(result.rows[0]?.count ?? 0) === 1;
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    users = moduleRef.get(UserRepository);
    documents = moduleRef.get(DocumentService);
    shares = moduleRef.get(DocumentShareService);
    publicLinks = moduleRef.get(PublicLinkService);
    accessPolicy = moduleRef.get(AccessPolicyService);
    audit = moduleRef.get(AuditService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('выдача share и событие фиксируются вместе', async () => {
    const { owner, document } = await createDocument();
    const grantee = await register();

    await shares.grant({
      documentId: document.id,
      userId: grantee.id,
      role: 'editor',
      actorId: owner.id,
    });

    await expect(shareCount(document.id, grantee.id)).resolves.toBe(1);
    await expect(shareActions(document.id)).resolves.toContain(
      'document_share.granted',
    );
  });

  it('отказ audit-записи откатывает выдачу share', async () => {
    const { owner, document } = await createDocument();
    const grantee = await register();
    const record = vi
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('audit down'));

    try {
      await expect(
        shares.grant({
          documentId: document.id,
          userId: grantee.id,
          role: 'editor',
          actorId: owner.id,
        }),
      ).rejects.toThrow('audit down');
    } finally {
      record.mockRestore();
    }

    await expect(shareCount(document.id, grantee.id)).resolves.toBe(0);
  });

  it('отзыв share и событие фиксируются вместе', async () => {
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

    await expect(shareCount(document.id, grantee.id)).resolves.toBe(0);
    await expect(shareActions(document.id)).resolves.toContain(
      'document_share.revoked',
    );
  });

  it('отказ audit-записи не отзывает share', async () => {
    const { owner, document } = await createDocument();
    const grantee = await register();

    await shares.grant({
      documentId: document.id,
      userId: grantee.id,
      role: 'viewer',
      actorId: owner.id,
    });

    const record = vi
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('audit down'));

    try {
      await expect(
        shares.revoke({
          documentId: document.id,
          userId: grantee.id,
          actorId: owner.id,
        }),
      ).rejects.toThrow('audit down');
    } finally {
      record.mockRestore();
    }

    await expect(shareCount(document.id, grantee.id)).resolves.toBe(1);
  });

  it('кэш прав не инвалидируется, если транзакция откатилась', async () => {
    const { owner, document } = await createDocument();
    const grantee = await register();
    const invalidate = vi.spyOn(accessPolicy, 'invalidateDocument');
    const record = vi
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('audit down'));

    try {
      await expect(
        shares.grant({
          documentId: document.id,
          userId: grantee.id,
          role: 'viewer',
          actorId: owner.id,
        }),
      ).rejects.toThrow('audit down');
    } finally {
      record.mockRestore();
    }

    expect(invalidate).not.toHaveBeenCalled();
    invalidate.mockRestore();
  });

  // Публичная ссылка — тоже изменение состава доступа: доступ получает любой
  // держатель токена. Поэтому режим отказа тот же, что у share.
  it('выпуск ссылки и событие фиксируются вместе', async () => {
    const { owner, document } = await createDocument();

    await publicLinks.create({
      documentId: document.id,
      actorId: owner.id,
      expiresAt: null,
    });

    await expect(publicLinkCount(document.id)).resolves.toBe(1);
    await expect(shareActions(document.id)).resolves.toContain(
      'public_link.created',
    );
  });

  it('отказ audit-записи откатывает выпуск ссылки', async () => {
    const { owner, document } = await createDocument();
    const record = vi
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('audit down'));

    try {
      await expect(
        publicLinks.create({
          documentId: document.id,
          actorId: owner.id,
          expiresAt: null,
        }),
      ).rejects.toThrow('audit down');
    } finally {
      record.mockRestore();
    }

    await expect(publicLinkCount(document.id)).resolves.toBe(0);
  });

  it('отзыв ссылки и событие фиксируются вместе', async () => {
    const { owner, document } = await createDocument();
    const link = await publicLinks.create({
      documentId: document.id,
      actorId: owner.id,
      expiresAt: null,
    });

    await expect(
      publicLinks.revoke({
        documentId: document.id,
        linkId: link.id,
        actorId: owner.id,
      }),
    ).resolves.toBe(true);

    await expect(publicLinkRevokedAt(link.id)).resolves.not.toBeNull();
    await expect(shareActions(document.id)).resolves.toContain(
      'public_link.revoked',
    );
  });

  it('отказ audit-записи не отзывает ссылку', async () => {
    const { owner, document } = await createDocument();
    const link = await publicLinks.create({
      documentId: document.id,
      actorId: owner.id,
      expiresAt: null,
    });
    const record = vi
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('audit down'));

    try {
      await expect(
        publicLinks.revoke({
          documentId: document.id,
          linkId: link.id,
          actorId: owner.id,
        }),
      ).rejects.toThrow('audit down');
    } finally {
      record.mockRestore();
    }

    await expect(publicLinkRevokedAt(link.id)).resolves.toBeNull();
    await expect(shareActions(document.id)).resolves.not.toContain(
      'public_link.revoked',
    );
  });

  // Удаление стирает объект и весь его состав доступа, поэтому событие —
  // единственный след: без него документ не удаляется.
  it('удаление документа и событие фиксируются вместе', async () => {
    const { owner, document } = await createDocument();

    await documents.remove({ actorId: owner.id, documentId: document.id });

    await expect(documentExists(document.id)).resolves.toBe(false);
    await expect(shareActions(document.id)).resolves.toContain(
      'document.removed',
    );
  });

  it('отказ audit-записи откатывает удаление документа', async () => {
    const { owner, document } = await createDocument();
    const record = vi
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('audit down'));

    try {
      await expect(
        documents.remove({ actorId: owner.id, documentId: document.id }),
      ).rejects.toThrow('audit down');
    } finally {
      record.mockRestore();
    }

    await expect(documentExists(document.id)).resolves.toBe(true);
  });
});
