import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hashToken } from '../../src/auth/token';
import { DocumentAccessRepository } from '../../src/permission/document-access.repository';
import { PublicLinkRepository } from '../../src/permission/public-link.repository';
import { PublicLinkResolver } from '../../src/permission/public-link.resolver';

const DOCUMENT_ID = '0192f5b0-1c00-7000-8000-000000000020';
const TOKEN = 'plaintext-link-token';

const publicLinkRepository = {
  findByTokenHash: vi.fn(),
};

const documentAccessRepository = {
  findDocumentFacts: vi.fn(),
};

const linkRow = (overrides: Record<string, unknown> = {}) => ({
  documentId: DOCUMENT_ID,
  expiresAt: null,
  revokedAt: null,
  ...overrides,
});

describe('PublicLinkResolver (unit)', () => {
  let resolver: PublicLinkResolver;

  const resolve = (token = TOKEN) => resolver.resolve({ token });

  beforeEach(async () => {
    vi.clearAllMocks();

    documentAccessRepository.findDocumentFacts.mockResolvedValue({
      organizationId: null,
      createdBy: 'owner-id',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicLinkResolver,
        { provide: PublicLinkRepository, useValue: publicLinkRepository },
        {
          provide: DocumentAccessRepository,
          useValue: documentAccessRepository,
        },
      ],
    }).compile();

    resolver = moduleRef.get(PublicLinkResolver);
  });

  it('ищет по хешу и не передаёт plaintext токен в репозиторий', async () => {
    publicLinkRepository.findByTokenHash.mockResolvedValue(linkRow());

    await resolve();

    expect(publicLinkRepository.findByTokenHash).toHaveBeenCalledWith(
      hashToken(TOKEN),
    );
    expect(publicLinkRepository.findByTokenHash).not.toHaveBeenCalledWith(
      TOKEN,
    );
  });

  it('неизвестный токен — null', async () => {
    publicLinkRepository.findByTokenHash.mockResolvedValue(null);

    await expect(resolve()).resolves.toBeNull();
  });

  it('просроченная ссылка — null', async () => {
    publicLinkRepository.findByTokenHash.mockResolvedValue(
      linkRow({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(resolve()).resolves.toBeNull();
  });

  it('отозванная ссылка — null', async () => {
    publicLinkRepository.findByTokenHash.mockResolvedValue(
      linkRow({ revokedAt: new Date() }),
    );

    await expect(resolve()).resolves.toBeNull();
  });

  it('живая ссылка без срока отдаёт документ', async () => {
    publicLinkRepository.findByTokenHash.mockResolvedValue(linkRow());

    await expect(resolve()).resolves.toEqual({ documentId: DOCUMENT_ID });
  });

  it('живая ссылка со сроком в будущем работает', async () => {
    publicLinkRepository.findByTokenHash.mockResolvedValue(
      linkRow({ expiresAt: new Date(Date.now() + 60_000) }),
    );

    await expect(resolve()).resolves.toEqual({ documentId: DOCUMENT_ID });
  });

  it('удалённый документ не оживает от ссылки', async () => {
    publicLinkRepository.findByTokenHash.mockResolvedValue(linkRow());
    documentAccessRepository.findDocumentFacts.mockResolvedValue(null);

    await expect(resolve()).resolves.toBeNull();
  });
});
